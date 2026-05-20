// =============================================================================
// Agency Group — Incident Ingestor
// lib/incidents/incidentIngestor.ts
//
// Real-time incident capture layer.
// Every failure becomes a structured dataset in Supabase `incidents` table.
//
// DDL (run once in Supabase):
// -- CREATE TABLE incidents (
// --   incident_id   text        primary key,
// --   tenant_id     text        not null,
// --   severity      text        not null,   -- 'P0'|'P1'|'P2'|'P3'
// --   classification text,                  -- FailureType (set later)
// --   region        text        not null,
// --   subsystem     text        not null,   -- 'api'|'graph'|'ai'|'queue'|'billing'|'database'|'cache'|'region'
// --   raw_error     text,
// --   status        text        not null default 'open', -- 'open'|'investigating'|'resolved'|'autopsy_complete'
// --   detected_at   timestamptz not null default now(),
// --   resolved_at   timestamptz,
// --   metrics_snapshot jsonb    not null default '{}',
// --   causal_chain  jsonb,
// --   impact        jsonb,
// --   autopsy_report jsonb,
// --   created_at    timestamptz not null default now(),
// --   updated_at    timestamptz not null default now()
// -- );
// -- CREATE INDEX idx_incidents_tenant ON incidents(tenant_id, detected_at DESC);
// -- CREATE INDEX idx_incidents_severity ON incidents(severity, status, detected_at DESC);
// -- CREATE INDEX idx_incidents_status ON incidents(status, detected_at DESC);
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID }              from 'crypto'
import { supabaseAdmin }           from '@/lib/supabase'
import { CURRENT_REGION }          from '@/lib/events/globalOrdering'
import { getRealWorldLoadProfile } from '@/lib/reality/humanTrafficRouter'
import {
  cacheOpenIncidents,
  invalidateIncidentCache,
  getCachedOpenIncidents,
} from '@/lib/resilience/incidentCache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncidentSeverity  = 'P0' | 'P1' | 'P2' | 'P3'
export type IncidentSubsystem = 'api' | 'graph' | 'ai' | 'queue' | 'billing' | 'database' | 'cache' | 'region'
export type IncidentStatus    = 'open' | 'investigating' | 'resolved' | 'autopsy_complete'

export interface IncidentMetricsSnapshot {
  [key: string]:   unknown   // index signature so this satisfies Record<string, unknown>
  p95_latency_ms?: number
  error_rate?:     number
  queue_depth?:    number
  ai_cost_spike?:  number
  cost_per_hour?:  number
  load_mode?:      string
  graph_tier?:     string
}

export interface IncidentEvent {
  incident_id:      string                  // `inc_${randomUUID()}`
  tenant_id:        string
  timestamp:        string                  // ISO
  severity:         IncidentSeverity
  region:           string
  subsystem:        IncidentSubsystem
  raw_error:        string | null
  metrics_snapshot: IncidentMetricsSnapshot
  status:           IncidentStatus
  detected_at:      string
}

export interface IncidentRow extends IncidentEvent {
  classification:          string | null
  resolved_at:             string | null
  healing_attempts:        number   // number of failed healing cycles (0 = never attempted)
  causal_chain:            Record<string, unknown> | null
  impact:                  Record<string, unknown> | null
  autopsy_report:          Record<string, unknown> | null
  created_at:              string
  updated_at:              string
  /**
   * The correlation_id of the runtime_event that triggered incident detection.
   * Used by causalReconstructor to query audit_log/runtime_events with the
   * correct correlation handle (incident_id is never written to audit_log).
   */
  source_correlation_id?:  string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Typed accessor for the `incidents` table.
 * Now fully typed via database.types.ts — no cast required.
 */
const incidentsTable = () => supabaseAdmin.from('incidents')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtimeEventsTable = () => (supabaseAdmin as any).from('runtime_events')

/** Maps a RuntimeEventType string to the closest IncidentSubsystem. */
function subsystemFromEventType(type: string): IncidentSubsystem {
  const t = type.toLowerCase()
  if (t.includes('ai') || t.includes('agent') || t.includes('workflow'))        return 'ai'
  if (t.includes('billing') || t.includes('revenue'))                           return 'billing'
  if (t.includes('graph') || t.includes('data_integrity'))                      return 'graph'
  if (t.includes('queue') || t.includes('pipeline') || t.includes('follow_up')) return 'queue'
  if (t.includes('kpi') || t.includes('conversion'))                            return 'database'
  return 'api'
}

/** Derives severity from retry_count: >=3=P0, 2=P1, 1=P2, 0=P3. */
function severityFromRetryCount(retryCount: number): IncidentSeverity {
  if (retryCount >= 3) return 'P0'
  if (retryCount === 2) return 'P1'
  if (retryCount === 1) return 'P2'
  return 'P3'
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingests a new incident into Supabase `incidents`.
 *
 * Generates `incident_id`, sets `status = 'open'`, `detected_at = now()`.
 * Fail-open: if the DB insert fails, logs a warning but still returns the
 * generated incident_id so callers always get a reference handle.
 *
 * @returns incident_id  e.g. "inc_550e8400-..."
 */
export async function ingestIncident(
  event: Omit<IncidentEvent, 'incident_id' | 'status' | 'detected_at'> & {
    /** correlation_id of the runtime_event that triggered detection, if any. */
    source_correlation_id?: string | null
  },
): Promise<string> {
  const incident_id = `inc_${randomUUID()}`
  const now         = new Date().toISOString()

  const record: IncidentRow = {
    ...event,
    incident_id,
    status:                 'open',
    detected_at:            now,
    classification:         null,
    resolved_at:            null,
    healing_attempts:       0,
    causal_chain:           null,
    impact:                 null,
    autopsy_report:         null,
    source_correlation_id:  event.source_correlation_id ?? null,
    created_at:             now,
    updated_at:             now,
  }

  try {
    const { error } = await incidentsTable().insert(record)
    if (error) {
      console.warn('[IncidentIngestor] DB insert failed — fail-open:', error.message)
    } else {
      // Fix B — invalidate cache so next listOpenIncidents fetches fresh data
      void invalidateIncidentCache(event.tenant_id).catch(() => undefined)
    }
  } catch (err) {
    console.warn('[IncidentIngestor] ingestIncident threw — fail-open:', err)
  }

  return incident_id
}

/**
 * Updates the status (and any extra fields) of an existing incident.
 * Always sets `updated_at` to now.
 * Fail-open: errors are logged but never re-thrown.
 */
export async function updateIncidentStatus(
  incidentId: string,
  status:     IncidentStatus,
  extra?:     Partial<IncidentRow>,
): Promise<void> {
  try {
    const patch = {
      ...extra,
      status,
      updated_at: new Date().toISOString(),
    }
    const { data: updated, error } = await incidentsTable()
      .update(patch)
      .eq('incident_id', incidentId)
      .select('tenant_id')
      .maybeSingle()

    if (error) {
      console.warn('[IncidentIngestor] updateIncidentStatus failed — fail-open:', error.message)
    } else if (updated) {
      // FIX 5: invalidate cache so next listOpenIncidents fetch reflects updated status
      const tenantId = (updated as unknown as { tenant_id: string }).tenant_id
      void invalidateIncidentCache(tenantId).catch(err =>
        console.error('[incidentIngestor] cache invalidation failed:', err)
      )
    }
  } catch (err) {
    console.warn('[IncidentIngestor] updateIncidentStatus threw — fail-open:', err)
  }
}

/**
 * Returns a single incident by ID, or null if not found or on error.
 * Fail-open: returns null on any unexpected error.
 */
export async function getIncident(incidentId: string): Promise<IncidentRow | null> {
  try {
    const { data, error } = await incidentsTable()
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()

    if (error || !data) return null
    return data as IncidentRow
  } catch {
    return null
  }
}

/**
 * Lists open and investigating incidents for a tenant, newest first.
 * Fail-open: returns [] on any error.
 *
 * @param tenantId  Tenant identifier
 * @param limit     Maximum rows to return (default 20)
 */
export async function listOpenIncidents(
  tenantId: string,
  limit     = 20,
): Promise<IncidentRow[]> {
  // Hard-cap at 500 to prevent unbounded result sets; callers may pass a lower limit.
  const safeLimit = Math.min(limit, 500)
  try {
    const { data, error } = await incidentsTable()
      .select(
        'incident_id, tenant_id, severity, status, subsystem, ' +
        'region, raw_error, classification, timestamp, ' +
        'detected_at, resolved_at, healing_attempts, ' +
        'metrics_snapshot, impact, autopsy_report, ' +
        'source_correlation_id, created_at, updated_at',
      )
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'investigating'])
      .order('detected_at', { ascending: false })
      .limit(safeLimit)

    if (error || !data) return []

    // Fix C — write-through: keep Redis cache warm after a successful read
    void cacheOpenIncidents(tenantId, data).catch(() => undefined)
    return data as unknown as IncidentRow[]
  } catch (err) {
    // Fix C — degraded mode: try Redis cache before returning empty
    console.error(
      '[incidentIngestor] Supabase error, trying Redis cache:',
      err instanceof Error ? err.message : err,
    )
    const cached = await getCachedOpenIncidents(tenantId).catch(() => null)
    if (cached && cached.length > 0) {
      console.warn(
        `[incidentIngestor] serving ${cached.length} incidents from Redis cache (degraded mode)`,
      )
      return cached as IncidentRow[] // data may be slightly stale
    }
    return []
  }
}

/**
 * Scans `runtime_events` for recent failures (status='failed', last 5 minutes).
 * For each failure not already ingested, creates a new incident and ingests it.
 *
 * Severity is derived from `retry_count`: >=3=P0, 2=P1, 1=P2, 0=P3.
 * Subsystem is derived from the event `type` field.
 * Dedup key is the `event_id` embedded in `raw_error`.
 *
 * Fail-open: returns [] on any unexpected error.
 *
 * @returns Array of newly-created incident_ids
 */
export async function detectAndIngestFromRuntimeEvents(
  tenantId: string,
): Promise<string[]> {
  try {
    const since5m = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    // Fetch recent failed runtime events
    const { data: failedEvents, error: eventsError } = await runtimeEventsTable()
      .select('event_id, org_id, type, retry_count, result, created_at')
      .eq('org_id', tenantId)
      .eq('status', 'failed')
      .gte('created_at', since5m)
      .limit(50)

    if (eventsError || !failedEvents || (failedEvents as unknown[]).length === 0) return []

    // Fetch recent open incidents to avoid duplicate ingestion
    const existingIncidents = await listOpenIncidents(tenantId, 100)

    // Dedup set: event_ids already referenced in raw_error
    const alreadyTracked = new Set<string>(
      existingIncidents
        .map(i => i.raw_error ?? '')
        .filter(e => e.startsWith('event_id:'))
        .map(e => e.split(' ')[0]?.replace('event_id:', '') ?? '')
        .filter(Boolean),
    )

    const newIncidentIds: string[] = []

    type FailedEvent = {
      event_id:    string
      org_id:      string
      type:        string
      retry_count: number
      result:      Record<string, unknown> | null
      created_at:  string
    }

    for (const ev of failedEvents as FailedEvent[]) {
      if (alreadyTracked.has(ev.event_id)) continue

      const severity  = severityFromRetryCount(ev.retry_count ?? 0)
      const subsystem = subsystemFromEventType(ev.type)
      const rawError  = `event_id:${ev.event_id} type:${ev.type} result:${JSON.stringify(ev.result ?? {})}`

      const incidentId = await ingestIncident({
        tenant_id:             tenantId,
        timestamp:             new Date().toISOString(),
        severity,
        region:                CURRENT_REGION,
        subsystem,
        raw_error:             rawError,
        metrics_snapshot:      {},
        source_correlation_id: ev.event_id,
      })

      newIncidentIds.push(incidentId)
    }

    return newIncidentIds
  } catch (err) {
    console.warn('[IncidentIngestor] detectAndIngestFromRuntimeEvents threw — fail-open:', err)
    return []
  }
}

/**
 * Reads the real-world load profile for a tenant and ingests a LOAD_SPIKE
 * incident if `p95_latency_ms` exceeds the given threshold.
 *
 * Severity tiers (relative to threshold):
 *   >= 4x threshold -> P0
 *   >= 2x threshold -> P1
 *   >= 1.5x threshold -> P2
 *   > threshold -> P3
 *
 * Fail-open: returns null on any unexpected error or when no spike is detected.
 *
 * @param tenantId    Tenant identifier
 * @param thresholdMs P95 latency threshold in ms (default 500)
 * @returns incident_id if a spike was detected and ingested, otherwise null
 */
export async function detectLatencySpike(
  tenantId:     string,
  thresholdMs = 500,
): Promise<string | null> {
  try {
    const profile = await getRealWorldLoadProfile(tenantId)
    if (!profile || profile.p95_latency_ms <= thresholdMs) return null

    const p95 = profile.p95_latency_ms
    const severity: IncidentSeverity =
      p95 >= thresholdMs * 4   ? 'P0' :
      p95 >= thresholdMs * 2   ? 'P1' :
      p95 >= thresholdMs * 1.5 ? 'P2' :
      'P3'

    const metricsSnapshot: IncidentMetricsSnapshot = {
      p95_latency_ms: p95,
      error_rate:     profile.error_rate,
    }

    const incidentId = await ingestIncident({
      tenant_id:        tenantId,
      timestamp:        new Date().toISOString(),
      severity,
      region:           CURRENT_REGION,
      subsystem:        'api',
      raw_error:        `LOAD_SPIKE: p95=${p95}ms > threshold=${thresholdMs}ms`,
      metrics_snapshot: metricsSnapshot,
    })

    return incidentId
  } catch (err) {
    console.warn('[IncidentIngestor] detectLatencySpike threw — fail-open:', err)
    return null
  }
}
