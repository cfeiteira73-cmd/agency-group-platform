// =============================================================================
// Agency Group — Cost Stream Engine
// lib/economics/costStreamEngine.ts
//
// Event-driven streaming cost attribution engine.
// Each AI/infra operation emits a CostEvent to Redis Streams (XADD).
// Rolling aggregation via XRANGE for real-time cost windows.
//
// Transport  : Upstash Redis REST API (pipeline endpoint for XADD)
// Stream key : cost_stream:{tenant_id}   (MAXLEN ~ 1000 per tenant)
// Fail-open  : all Redis operations degrade gracefully to zeros / no-op
//
// TypeScript strict — 0 errors
// =============================================================================

import { getCachedTenantEconomics } from '@/lib/billing/economicsCache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostEvent {
  tenant_id:      string
  correlation_id: string | null
  event_type:     string        // 'ai_call' | 'db_query' | 'api_request' | 'storage_op' | 'embedding'
  compute_cost:   number        // EUR
  ai_cost:        number        // EUR
  infra_cost:     number        // EUR
  storage_cost:   number        // EUR
  total_cost:     number        // sum of above four fields
  model?:         string        // e.g. 'claude-3-5-sonnet'
  tokens_used?:   number
  timestamp:      string        // ISO
  metadata?:      Record<string, unknown>
}

export interface RollingCostWindow {
  tenant_id:          string
  window_seconds:     number    // how many seconds back was considered
  total_cost_eur:     number
  ai_cost_eur:        number
  infra_cost_eur:     number
  compute_cost_eur:   number
  event_count:        number
  burn_rate_per_hour: number    // extrapolated from window
  margin:             number | null  // null if no revenue data available
  generated_at:       string
}

// ─── AI model cost estimation (EUR per token) ─────────────────────────────────

const MODEL_RATES: Record<string, number> = {
  // Claude Sonnet variants — ~€0.003/1K tokens (blended input+output)
  'claude-3-5-sonnet':         0.000003,
  'claude-3-5-sonnet-20241022': 0.000003,
  'claude-3-7-sonnet':         0.000003,
  'claude-sonnet-4-6':         0.000003,
  // Haiku variants — ~€0.0003/1K tokens
  'claude-3-haiku':            0.0000003,
  'claude-haiku-4-5':          0.0000003,
  // Opus — ~€0.015/1K tokens
  'claude-3-opus':             0.000015,
  'claude-opus-4-6':           0.000015,
}

function estimateCostPerToken(model: string): number {
  if (MODEL_RATES[model] !== undefined) return MODEL_RATES[model]
  // Prefix match for unversioned names
  const lower = model.toLowerCase()
  if (lower.includes('haiku'))  return 0.0000003
  if (lower.includes('sonnet')) return 0.000003
  if (lower.includes('opus'))   return 0.000015
  return 0.000001   // generic fallback
}

// ─── Upstash config ───────────────────────────────────────────────────────────

interface RedisConfig {
  url:   string
  token: string
}

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

// ─── Redis Streams helpers ────────────────────────────────────────────────────

/**
 * XADD via Upstash pipeline endpoint so we can pass MAXLEN capping.
 * Command: XADD cost_stream:{tenant_id} MAXLEN ~ 1000 * field val ...
 * Fail-open: any network/parse error is swallowed.
 */
async function xadd(
  key:    string,
  fields: Record<string, string>,
): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  // Build flat field-value array: ["field1", "val1", "field2", "val2", ...]
  const fieldPairs: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    fieldPairs.push(k, v)
  }

  // Pipeline body: [["XADD", key, "MAXLEN", "~", "1000", "*", ...fieldPairs]]
  const body = JSON.stringify([
    ['XADD', key, 'MAXLEN', '~', '1000', '*', ...fieldPairs],
  ])

  try {
    await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type':  'application/json',
      },
      body,
      signal: AbortSignal.timeout(500),
    })
  } catch {
    // fail-open
  }
}

/**
 * XRANGE over a time window [startMs, nowMs], avoiding full-stream scans.
 * Redis Stream IDs are "{milliseconds}-{seq}"; we use "{ms}-0" as lower bound
 * and "{ms}-9999999" as upper bound for inclusive range queries.
 *
 * Returns [] on any error (fail-open).
 *
 * Upstash response shape:
 *   { result: [[id, [field, val, field, val, ...]], ...] }
 */
async function xrange(
  key:     string,
  startMs: number,
  endMs:   number,
): Promise<Array<[string, string[]]>> {
  const cfg = getRedisConfig()
  if (!cfg) return []

  // Encode as "{ms}-0" and "{ms}-9999999" for proper range boundaries
  const startId = `${startMs}-0`
  const endId   = `${endMs}-9999999`

  try {
    const res = await fetch(
      `${cfg.url}/xrange/${encodeURIComponent(key)}/${encodeURIComponent(startId)}/${encodeURIComponent(endId)}`,
      {
        headers: { Authorization: `Bearer ${cfg.token}` },
        signal:  AbortSignal.timeout(500),
      },
    )
    if (!res.ok) return []
    const body = await res.json() as { result: unknown }
    if (!Array.isArray(body.result)) return []
    return body.result as Array<[string, string[]]>
  } catch {
    return []
  }
}

/**
 * Parse a flat [field, val, field, val, ...] array returned by XRANGE
 * into a plain object.
 */
function parseFields(flat: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out[flat[i]] = flat[i + 1]
  }
  return out
}

// ─── emitCostEvent ────────────────────────────────────────────────────────────

/**
 * Serialize a CostEvent and write it to `cost_stream:{tenant_id}`.
 * All values are stored as strings (Redis Stream requirement).
 * Fire-and-forget: the returned Promise never rejects.
 */
export function emitCostEvent(event: CostEvent): Promise<void> {
  const key = `cost_stream:${event.tenant_id}`

  const fields: Record<string, string> = {
    tenant_id:      event.tenant_id,
    correlation_id: event.correlation_id ?? '',
    event_type:     event.event_type,
    compute_cost:   String(event.compute_cost),
    ai_cost:        String(event.ai_cost),
    infra_cost:     String(event.infra_cost),
    storage_cost:   String(event.storage_cost),
    total_cost:     String(event.total_cost),
    timestamp:      event.timestamp,
  }

  if (event.model       !== undefined) fields['model']       = event.model
  if (event.tokens_used !== undefined) fields['tokens_used'] = String(event.tokens_used)
  if (event.metadata    !== undefined) {
    try {
      fields['metadata'] = JSON.stringify(event.metadata)
    } catch {
      // skip unserializable metadata
    }
  }

  // Fire-and-forget — xadd is already fail-open
  return xadd(key, fields)
}

// ─── getRollingCostWindow ─────────────────────────────────────────────────────

/**
 * Reads all entries from `cost_stream:{tenantId}`, filters those within the
 * last `windowSeconds` seconds, and returns a RollingCostWindow aggregate.
 *
 * Fail-open: returns a zero-valued window if Redis is unavailable.
 */
export async function getRollingCostWindow(
  tenantId:      string,
  windowSeconds: number = 3600,
): Promise<RollingCostWindow> {
  const now       = Date.now()
  const cutoffMs  = now - windowSeconds * 1000

  const zero: RollingCostWindow = {
    tenant_id:          tenantId,
    window_seconds:     windowSeconds,
    total_cost_eur:     0,
    ai_cost_eur:        0,
    infra_cost_eur:     0,
    compute_cost_eur:   0,
    event_count:        0,
    burn_rate_per_hour: 0,
    margin:             null,
    generated_at:       new Date(now).toISOString(),
  }

  const key     = `cost_stream:${tenantId}`
  // Pass time-window bounds directly to XRANGE — avoids reading the entire stream.
  const entries = await xrange(key, cutoffMs, now)

  if (entries.length === 0) return zero

  let totalCost   = 0
  let aiCost      = 0
  let infraCost   = 0
  let computeCost = 0
  let count       = 0

  for (const [, flatFields] of entries) {
    // All entries returned by the time-windowed XRANGE are already in range;
    // no client-side timestamp filter needed.
    const fields = parseFields(flatFields)

    totalCost   += parseFloat(fields['total_cost']   ?? '0') || 0
    aiCost      += parseFloat(fields['ai_cost']      ?? '0') || 0
    infraCost   += parseFloat(fields['infra_cost']   ?? '0') || 0
    computeCost += parseFloat(fields['compute_cost'] ?? '0') || 0
    count++
  }

  const burnRatePerHour = windowSeconds > 0
    ? (totalCost / windowSeconds) * 3600
    : 0

  return {
    tenant_id:          tenantId,
    window_seconds:     windowSeconds,
    total_cost_eur:     Math.round(totalCost   * 1_000_000) / 1_000_000,
    ai_cost_eur:        Math.round(aiCost      * 1_000_000) / 1_000_000,
    infra_cost_eur:     Math.round(infraCost   * 1_000_000) / 1_000_000,
    compute_cost_eur:   Math.round(computeCost * 1_000_000) / 1_000_000,
    event_count:        count,
    burn_rate_per_hour: Math.round(burnRatePerHour * 1_000_000) / 1_000_000,
    margin:             null,   // populated by getInstantMargin when revenue data exists
    generated_at:       new Date(now).toISOString(),
  }
}

// ─── getInstantMargin ─────────────────────────────────────────────────────────

/**
 * Computes an instant margin estimate by combining:
 *   - Real-time rolling cost from the last 3600s (Redis stream)
 *   - Revenue-per-request from the cached TenantEconomics snapshot
 *
 * Returns null when revenue data is unavailable or cannot be computed.
 */
export async function getInstantMargin(tenantId: string): Promise<number | null> {
  const [window, economics] = await Promise.allSettled([
    getRollingCostWindow(tenantId, 3600),
    getCachedTenantEconomics(tenantId),
  ])

  if (window.status === 'rejected') return null
  const w = window.value

  if (economics.status === 'rejected') return null
  const e = economics.value

  const revenuePerRequest = e.revenue_per_request ?? 0
  if (revenuePerRequest <= 0) return null

  // Estimate revenue over the same window using event_count × revenue_per_request
  const estimatedRevenue = w.event_count * revenuePerRequest
  if (estimatedRevenue <= 0) return null

  const margin = (estimatedRevenue - w.total_cost_eur) / estimatedRevenue
  return Math.round(margin * 10_000) / 10_000   // 4 decimal places (e.g. 0.7234 = 72.34%)
}

// ─── emitAICostEvent ──────────────────────────────────────────────────────────

/**
 * Convenience helper: compute AI call costs from token counts and latency,
 * then emit via emitCostEvent.
 *
 * Cost model:
 *   ai_cost     = tokens_used × model_rate_per_token
 *   compute_cost = latency_ms × 0.000001 EUR   (~€1/1M ms = €1/277 hours of GPU)
 *   infra_cost  = 0  (attributed to the platform layer, not per-call)
 *   storage_cost = 0
 *   total_cost  = ai_cost + compute_cost
 */
export function emitAICostEvent(params: {
  tenant_id:      string
  correlation_id?: string | null
  model:          string
  tokens:         number
  latency_ms:     number
  metadata?:      Record<string, unknown>
}): Promise<void> {
  const ratePerToken  = estimateCostPerToken(params.model)
  const aiCost        = params.tokens * ratePerToken
  const computeCost   = params.latency_ms * 0.000001
  const totalCost     = aiCost + computeCost

  const event: CostEvent = {
    tenant_id:      params.tenant_id,
    correlation_id: params.correlation_id ?? null,
    event_type:     'ai_call',
    compute_cost:   Math.round(computeCost * 1_000_000) / 1_000_000,
    ai_cost:        Math.round(aiCost      * 1_000_000) / 1_000_000,
    infra_cost:     0,
    storage_cost:   0,
    total_cost:     Math.round(totalCost   * 1_000_000) / 1_000_000,
    model:          params.model,
    tokens_used:    params.tokens,
    timestamp:      new Date().toISOString(),
    metadata:       params.metadata,
  }

  return emitCostEvent(event)
}
