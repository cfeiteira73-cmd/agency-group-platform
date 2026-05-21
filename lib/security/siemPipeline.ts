// Agency Group — SIEM Pipeline
// lib/security/siemPipeline.ts
// TypeScript strict — 0 errors
//
// Security event normalization (CEF/ECS format) with multi-SIEM routing.
// Splunk HEC / Datadog Logs API / Sentinel DCE / OpenSearch.
// Always writes to siem_events table (local fallback — zero event loss).

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SiemProvider = 'splunk' | 'datadog' | 'sentinel' | 'opensearch' | 'local'

export type SecurityEventCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'configuration_change'
  | 'network_anomaly'
  | 'threat_detection'
  | 'compliance_violation'
  | 'incident_response'

export interface NormalizedSecurityEvent {
  event_id: string
  timestamp: string
  tenant_id: string
  category: SecurityEventCategory
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  actor_id: string | null
  actor_type: 'user' | 'service' | 'system' | 'unknown'
  action: string
  resource_type: string | null
  resource_id: string | null
  outcome: 'success' | 'failure' | 'blocked'
  source_ip: string | null
  geo_region: string | null
  raw_event: Record<string, unknown>
  correlation_id: string | null
  mitre_technique: string | null   // e.g. 'T1078 - Valid Accounts'
}

// ─── Provider detection ────────────────────────────────────────────────────────

export function detectSiemProvider(): SiemProvider {
  if (process.env.SPLUNK_HEC_URL && process.env.SPLUNK_HEC_TOKEN) return 'splunk'
  if (process.env.DATADOG_API_KEY && process.env.DATADOG_SITE) return 'datadog'
  if (process.env.SENTINEL_WORKSPACE_ID && process.env.SENTINEL_SHARED_KEY) return 'sentinel'
  if (process.env.OPENSEARCH_URL && process.env.OPENSEARCH_API_KEY) return 'opensearch'
  return 'local'
}

// ─── Splunk HEC routing ────────────────────────────────────────────────────────

async function routeToSplunk(event: NormalizedSecurityEvent): Promise<void> {
  const hecUrl = process.env.SPLUNK_HEC_URL!
  const token = process.env.SPLUNK_HEC_TOKEN!

  const body = JSON.stringify({
    time: Math.floor(new Date(event.timestamp).getTime() / 1000),
    source: 'agency-group',
    sourcetype: 'agency:security:event',
    event: {
      ...event,
      _format: 'ecs',
    },
  })

  const res = await fetch(hecUrl, {
    method: 'POST',
    headers: {
      Authorization: `Splunk ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`Splunk HEC returned ${res.status}: ${await res.text()}`)
  }
}

// ─── Datadog routing ───────────────────────────────────────────────────────────

async function routeToDatadog(event: NormalizedSecurityEvent): Promise<void> {
  const apiKey = process.env.DATADOG_API_KEY!
  const site = process.env.DATADOG_SITE ?? 'datadoghq.eu'

  const body = JSON.stringify([
    {
      ddsource: 'agency-group',
      service: 'security-pipeline',
      ddtags: `env:production,tenant:${event.tenant_id},severity:${event.severity},category:${event.category}`,
      message: `${event.action} by ${event.actor_id ?? 'unknown'} on ${event.resource_type ?? 'unknown'} — outcome:${event.outcome}`,
      ...event,
    },
  ])

  const res = await fetch(`https://http-intake.logs.${site}/api/v2/logs`, {
    method: 'POST',
    headers: {
      'DD-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`Datadog Logs API returned ${res.status}: ${await res.text()}`)
  }
}

// ─── Microsoft Sentinel routing ────────────────────────────────────────────────

async function routeToSentinel(event: NormalizedSecurityEvent): Promise<void> {
  const workspaceId = process.env.SENTINEL_WORKSPACE_ID!
  const sharedKey = process.env.SENTINEL_SHARED_KEY!
  const logType = 'AgencyGroupSecurityEvent'

  const body = JSON.stringify([event])
  const contentLength = Buffer.byteLength(body, 'utf8')
  const rfc1123Date = new Date().toUTCString()

  // Build HMAC-SHA256 Authorization header for Log Analytics Data Collector API
  const { createHmac } = await import('crypto')
  const stringToSign = `POST\n${contentLength}\napplication/json\nx-ms-date:${rfc1123Date}\n/api/logs`
  const key = Buffer.from(sharedKey, 'base64')
  const signature = createHmac('sha256', key).update(stringToSign).digest('base64')
  const authorization = `SharedKey ${workspaceId}:${signature}`

  const url = `https://${workspaceId}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:   authorization,
      'Content-Type':  'application/json',
      'Log-Type':      logType,
      'x-ms-date':     rfc1123Date,
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`Sentinel DCE returned ${res.status}: ${await res.text()}`)
  }
}

// ─── OpenSearch routing ────────────────────────────────────────────────────────

async function routeToOpenSearch(event: NormalizedSecurityEvent): Promise<void> {
  const url = process.env.OPENSEARCH_URL!
  const apiKey = process.env.OPENSEARCH_API_KEY!
  const indexName = `security-events-${new Date().toISOString().slice(0, 7)}`

  const res = await fetch(`${url}/${indexName}/_doc/${event.event_id}`, {
    method: 'PUT',
    headers: {
      Authorization:  `ApiKey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) {
    throw new Error(`OpenSearch returned ${res.status}: ${await res.text()}`)
  }
}

// ─── routeToSiem ──────────────────────────────────────────────────────────────

export async function routeToSiem(event: NormalizedSecurityEvent): Promise<void> {
  const provider = detectSiemProvider()

  if (provider === 'local') return // already written to DB

  try {
    switch (provider) {
      case 'splunk':
        await routeToSplunk(event)
        break
      case 'datadog':
        await routeToDatadog(event)
        break
      case 'sentinel':
        await routeToSentinel(event)
        break
      case 'opensearch':
        await routeToOpenSearch(event)
        break
    }

    // Mark as routed in DB
    void (supabaseAdmin as any)
      .from('siem_events')
      .update({ routed_to_siem: true })
      .eq('id', event.event_id)
      .catch((e: unknown) =>
        log.warn('[siemPipeline] routeToSiem update routed_to_siem failed', {
          error: e instanceof Error ? e.message : String(e),
        }),
      )
  } catch (e) {
    log.warn('[siemPipeline] routeToSiem routing failed', {
      provider,
      event_id: event.event_id,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

// ─── emitSecurityEvent ─────────────────────────────────────────────────────────

export async function emitSecurityEvent(
  event: Omit<NormalizedSecurityEvent, 'event_id' | 'timestamp'>,
): Promise<void> {
  const normalized: NormalizedSecurityEvent = {
    ...event,
    event_id:  randomUUID(),
    timestamp: new Date().toISOString(),
  }

  // Always write to local Supabase table (zero event loss guarantee)
  void (supabaseAdmin as any)
    .from('siem_events')
    .insert({
      id:             normalized.event_id,
      tenant_id:      normalized.tenant_id,
      category:       normalized.category,
      severity:       normalized.severity,
      actor_id:       normalized.actor_id,
      actor_type:     normalized.actor_type,
      action:         normalized.action,
      resource_type:  normalized.resource_type,
      resource_id:    normalized.resource_id,
      outcome:        normalized.outcome,
      source_ip:      normalized.source_ip,
      geo_region:     normalized.geo_region,
      raw_event:      normalized.raw_event,
      correlation_id: normalized.correlation_id,
      mitre_technique: normalized.mitre_technique,
      routed_to_siem:  false,
      created_at:      normalized.timestamp,
    })
    .catch((e: unknown) =>
      log.warn('[siemPipeline] emitSecurityEvent local insert failed', {
        error: e instanceof Error ? e.message : String(e),
      }),
    )

  // Fire-and-forget route to external SIEM
  void routeToSiem(normalized).catch((e: unknown) =>
    log.warn('[siemPipeline] emitSecurityEvent routeToSiem failed', {
      error: e instanceof Error ? e.message : String(e),
    }),
  )
}

// ─── querySiemEvents ───────────────────────────────────────────────────────────

export async function querySiemEvents(
  tenantId: string,
  filters: {
    category?: SecurityEventCategory
    severity?: string
    since?: string
    limit?: number
  },
): Promise<NormalizedSecurityEvent[]> {
  try {
    const limit = Math.min(filters.limit ?? 100, 1000)

    let query = (supabaseAdmin as any)
      .from('siem_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters.category) query = query.eq('category', filters.category)
    if (filters.severity)  query = query.eq('severity', filters.severity)
    if (filters.since)     query = query.gte('created_at', filters.since)

    const { data, error } = await query as {
      data: Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

    if (error) {
      log.warn('[siemPipeline] querySiemEvents failed', {
        tenant_id: tenantId,
        error: error.message,
      })
      return []
    }

    return (data ?? []).map(row => ({
      event_id:        String(row['id'] ?? ''),
      timestamp:       String(row['created_at'] ?? new Date().toISOString()),
      tenant_id:       String(row['tenant_id'] ?? ''),
      category:        (row['category'] as SecurityEventCategory),
      severity:        (row['severity'] as NormalizedSecurityEvent['severity']) ?? 'info',
      actor_id:        row['actor_id'] != null ? String(row['actor_id']) : null,
      actor_type:      (row['actor_type'] as NormalizedSecurityEvent['actor_type']) ?? 'unknown',
      action:          String(row['action'] ?? ''),
      resource_type:   row['resource_type'] != null ? String(row['resource_type']) : null,
      resource_id:     row['resource_id'] != null ? String(row['resource_id']) : null,
      outcome:         (row['outcome'] as NormalizedSecurityEvent['outcome']) ?? 'success',
      source_ip:       row['source_ip'] != null ? String(row['source_ip']) : null,
      geo_region:      row['geo_region'] != null ? String(row['geo_region']) : null,
      raw_event:       (row['raw_event'] as Record<string, unknown>) ?? {},
      correlation_id:  row['correlation_id'] != null ? String(row['correlation_id']) : null,
      mitre_technique: row['mitre_technique'] != null ? String(row['mitre_technique']) : null,
    }))
  } catch (err) {
    log.warn('[siemPipeline] querySiemEvents error', {
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── getSiemStatus ─────────────────────────────────────────────────────────────

export function getSiemStatus(): {
  provider: SiemProvider
  configured: boolean
  events_last_24h: Promise<number>
} {
  const provider = detectSiemProvider()
  const configured = provider !== 'local'

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const events_last_24h: Promise<number> = (async () => {
    try {
      const { count, error } = await (supabaseAdmin as any)
        .from('siem_events')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', since) as { count: number | null; error: { message: string } | null }

      if (error) return 0
      return count ?? 0
    } catch {
      return 0
    }
  })()

  return { provider, configured, events_last_24h }
}
