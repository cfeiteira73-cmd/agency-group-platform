// Agency Group — Data Lineage Tracker
// lib/data-trust/lineageTracker.ts
// Records origin → transformation → usage chain for key entities.
// Answers: "Where did this data come from? Was it modified? Who used it?"

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LineageEventType =
  | 'INGESTED'
  | 'TRANSFORMED'
  | 'ENRICHED'
  | 'VALIDATED'
  | 'USED'
  | 'EXPORTED'
  | 'ARCHIVED'

export interface LineageEvent {
  event_id: string
  entity_type: 'property' | 'contact' | 'deal' | 'match' | 'ml_score'
  entity_id: string
  event_type: LineageEventType
  source_system: string
  actor: string
  timestamp: string
  tenant_id: string
  payload_hash: string
  metadata: Record<string, unknown>
}

export interface LineageChain {
  entity_type: string
  entity_id: string
  events: LineageEvent[]
  completeness_score: number
  trust_score: number
  anomalies: string[]
}

// ─── hashPayload ──────────────────────────────────────────────────────────────

/**
 * SHA-256 of JSON.stringify(data). Used to verify payload integrity across
 * pipeline stages.
 */
export function hashPayload(data: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

// ─── recordLineageEvent ───────────────────────────────────────────────────────

/**
 * Fire-and-forget insert into data_lineage_events.
 * Generates event_id if not provided.
 */
export async function recordLineageEvent(
  event: Omit<LineageEvent, 'event_id'>,
): Promise<void> {
  const event_id = createHash('sha256')
    .update(`${event.entity_id}:${event.event_type}:${event.timestamp}`)
    .digest('hex')
    .slice(0, 32)

  void (supabaseAdmin as any)
    .from('data_lineage_events')
    .insert({
      event_id,
      tenant_id: event.tenant_id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      event_type: event.event_type,
      source_system: event.source_system,
      actor: event.actor,
      timestamp: event.timestamp,
      payload_hash: event.payload_hash,
      metadata: event.metadata,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) {
        log.warn('[lineageTracker] insert failed', { error, event_id })
      }
    })
    .catch((e: unknown) => console.warn('[lineageTracker]', e))
}

// ─── getEntityLineage ─────────────────────────────────────────────────────────

/**
 * Fetches all lineage events for an entity and computes trust/completeness.
 */
export async function getEntityLineage(
  entityType: LineageEvent['entity_type'],
  entityId: string,
  tenantId: string,
): Promise<LineageChain> {
  const { data, error } = await (supabaseAdmin as any)
    .from('data_lineage_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('timestamp', { ascending: true })

  if (error) {
    log.warn('[lineageTracker] getEntityLineage query failed', { error, entityId })
    return {
      entity_type: entityType,
      entity_id: entityId,
      events: [],
      completeness_score: 0,
      trust_score: 0,
      anomalies: ['fetch_error'],
    }
  }

  const events: LineageEvent[] = (data ?? []) as LineageEvent[]
  const anomalies: string[] = []

  // Completeness: INGESTED + VALIDATED = minimum 100%
  const presentTypes = new Set(events.map((e) => e.event_type))
  const hasIngested = presentTypes.has('INGESTED')
  const hasValidated = presentTypes.has('VALIDATED')
  const completeness_score =
    hasIngested && hasValidated ? 100 : hasIngested ? 50 : 0

  if (!hasIngested) anomalies.push('missing_INGESTED_event')

  // Check for gaps > 24h between consecutive events
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].timestamp).getTime()
    const curr = new Date(events[i].timestamp).getTime()
    const gapHours = (curr - prev) / (1000 * 60 * 60)
    if (gapHours > 24) {
      anomalies.push(
        `gap_>24h_between_${events[i - 1].event_type}_and_${events[i].event_type}`,
      )
    }
  }

  // Check for duplicate event types (same type + source within 1 min)
  const seen = new Map<string, string>()
  for (const e of events) {
    const key = `${e.event_type}:${e.source_system}`
    if (seen.has(key)) {
      const prevTime = new Date(seen.get(key)!).getTime()
      const currTime = new Date(e.timestamp).getTime()
      if (Math.abs(currTime - prevTime) < 60_000) {
        anomalies.push(`duplicate_event_${e.event_type}_from_${e.source_system}`)
      }
    }
    seen.set(key, e.timestamp)
  }

  // trust_score: start 100, -10 per anomaly
  const trust_score = Math.max(0, 100 - anomalies.length * 10)

  return {
    entity_type: entityType,
    entity_id: entityId,
    events,
    completeness_score,
    trust_score,
    anomalies,
  }
}

// ─── getLineageSummary ────────────────────────────────────────────────────────

/**
 * Aggregates lineage statistics for a tenant.
 */
export async function getLineageSummary(tenantId: string): Promise<{
  entities_tracked: number
  avg_trust_score: number
  low_trust_entities: number
  untracked_entities: number
}> {
  // Count distinct entities (include event_type for untracked detection)
  const { data: entityData, error: entityError } = await (supabaseAdmin as any)
    .from('data_lineage_events')
    .select('entity_type, entity_id, event_type')
    .eq('tenant_id', tenantId)

  if (entityError) {
    log.warn('[lineageTracker] getLineageSummary failed', { error: entityError })
    return {
      entities_tracked: 0,
      avg_trust_score: 0,
      low_trust_entities: 0,
      untracked_entities: 0,
    }
  }

  const rows: Array<{ entity_type: string; entity_id: string; event_type?: string }> =
    (entityData ?? []) as Array<{ entity_type: string; entity_id: string; event_type?: string }>

  // Deduplicate distinct entities
  const distinctEntities = new Map<string, string>()
  for (const row of rows) {
    distinctEntities.set(`${row.entity_type}:${row.entity_id}`, row.entity_type)
  }

  const entities_tracked = distinctEntities.size

  // Build per-entity event_type sets from already-fetched rows
  const entityEventTypes = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = `${row.entity_type}:${row.entity_id}`
    if (!entityEventTypes.has(key)) entityEventTypes.set(key, new Set())
    if (row.event_type) entityEventTypes.get(key)!.add(row.event_type)
  }

  // Sample up to 100 entities for trust score computation
  const entityKeys = Array.from(distinctEntities.keys()).slice(0, 100)
  const trustScores: number[] = []

  await Promise.all(
    entityKeys.map(async (key) => {
      const [entityType, entityId] = key.split(':') as [
        LineageEvent['entity_type'],
        string,
      ]
      const chain = await getEntityLineage(entityType, entityId, tenantId)
      trustScores.push(chain.trust_score)
    }),
  )

  const avg_trust_score =
    trustScores.length > 0
      ? Math.round(
          trustScores.reduce((a, b) => a + b, 0) / trustScores.length,
        )
      : 0

  const low_trust_entities = trustScores.filter((s) => s < 50).length

  // Untracked: entities missing an INGESTED event
  const untracked_entities = Array.from(entityEventTypes.values()).filter(
    (types) => !types.has('INGESTED'),
  ).length

  return {
    entities_tracked,
    avg_trust_score,
    low_trust_entities,
    untracked_entities,
  }
}
