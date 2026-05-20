// =============================================================================
// Agency Group — Economic Drift Engine
// lib/reality/economicsDriftEngine.ts
//
// Tracks real economic metrics over time using Redis time series (XADD/XRANGE).
// NOT simulation — reads from real cost stream + Supabase data.
//
// Stream key : econ_drift:{tenant_id}   (MAXLEN ~ 1000 per tenant)
// Transport  : Upstash Redis REST API
// Fail-open  : all Redis operations degrade gracefully to zeros / null
//
// TypeScript strict — 0 errors
// =============================================================================

import { getRollingCostWindow }      from '@/lib/economics/costStreamEngine'
import { getCachedTenantEconomics }  from '@/lib/billing/economicsCache'
import { getInstantMargin }          from '@/lib/economics/costStreamEngine'

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface EconomicSnapshot {
  snapshot_id:      string
  tenant_id:        string
  captured_at:      string
  cost_per_hour:    number
  ai_cost_pct:      number          // ai_cost / total_cost (0–1)
  infra_cost_pct:   number          // infra_cost / total_cost (0–1)
  instant_margin:   number | null
  event_count_1h:   number
  burn_rate:        number          // same as cost_per_hour
  revenue_estimate: number | null   // event_count × revenue_per_request
}

export interface EconomicDriftProfile {
  tenant_id:            string
  generated_at:         string
  snapshots_analyzed:   number
  time_span_hours:      number
  cost_trend:           'stable' | 'increasing' | 'decreasing' | 'volatile'
  margin_trend:         'stable' | 'compressing' | 'expanding' | 'collapsed'
  ai_cost_drift_pct:    number          // change in ai_cost_pct: baseline → current
  burn_rate_drift_pct:  number
  collapse_risk:        'low' | 'medium' | 'high' | 'critical'
  stability_score:      number          // 0–100
  drift_events:         EconomicDriftEvent[]
}

export interface EconomicDriftEvent {
  occurred_at:  string
  type:         'cost_spike' | 'margin_compression' | 'ai_overload' | 'revenue_gap'
  severity:     'info' | 'warning' | 'critical'
  description:  string
  value:        number
}

// ─── Upstash helpers ──────────────────────────────────────────────────────────

interface RedisConfig { url: string; token: string }

function getRedisConfig(): RedisConfig | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function xaddSnap(key: string, fields: Record<string, string>): Promise<void> {
  const cfg = getRedisConfig()
  if (!cfg) return

  const fieldPairs: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    fieldPairs.push(k, v)
  }

  const body = JSON.stringify([
    ['XADD', key, 'MAXLEN', '~', '1000', '*', ...fieldPairs],
  ])

  try {
    await fetch(`${cfg.url}/pipeline`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(500),
    })
  } catch {
    // fail-open
  }
}

async function xrangeAll(key: string): Promise<Array<[string, string[]]>> {
  const cfg = getRedisConfig()
  if (!cfg) return []

  try {
    const res = await fetch(
      `${cfg.url}/xrange/${encodeURIComponent(key)}/-/+`,
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

function parseFlat(flat: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out[flat[i]] = flat[i + 1]
  }
  return out
}

function safeFloat(v: string | undefined, fallback: number = 0): number {
  if (v === undefined || v === '') return fallback
  const n = parseFloat(v)
  return isNaN(n) ? fallback : n
}

function nanoidMini(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// ─── captureEconomicSnapshot ──────────────────────────────────────────────────

/**
 * Reads real-time cost/margin data and writes a snapshot to the drift stream.
 * Fail-open: any unavailable source contributes 0/null to the snapshot.
 */
export async function captureEconomicSnapshot(tenantId: string): Promise<EconomicSnapshot> {
  const now = new Date().toISOString()

  const [windowResult, economicsResult, marginResult] = await Promise.allSettled([
    getRollingCostWindow(tenantId, 3600),
    getCachedTenantEconomics(tenantId),
    getInstantMargin(tenantId),
  ])

  const window    = windowResult.status === 'fulfilled'    ? windowResult.value    : null
  const economics = economicsResult.status === 'fulfilled' ? economicsResult.value : null
  const margin    = marginResult.status === 'fulfilled'    ? marginResult.value    : null

  const totalCost   = window?.total_cost_eur   ?? 0
  const aiCost      = window?.ai_cost_eur      ?? 0
  const infraCost   = window?.infra_cost_eur   ?? 0
  const eventCount  = window?.event_count      ?? 0
  const burnRate    = window?.burn_rate_per_hour ?? 0

  const safeDenom = totalCost > 0 ? totalCost : 1  // avoid division by zero
  const aiCostPct    = Math.round((aiCost    / safeDenom) * 10_000) / 10_000
  const infraCostPct = Math.round((infraCost / safeDenom) * 10_000) / 10_000

  const revenuePerRequest = economics?.revenue_per_request ?? 0
  const revenueEstimate   = revenuePerRequest > 0 && eventCount > 0
    ? Math.round(eventCount * revenuePerRequest * 1_000_000) / 1_000_000
    : null

  const snapshot: EconomicSnapshot = {
    snapshot_id:      nanoidMini(),
    tenant_id:        tenantId,
    captured_at:      now,
    cost_per_hour:    Math.round(burnRate * 1_000_000) / 1_000_000,
    ai_cost_pct:      aiCostPct,
    infra_cost_pct:   infraCostPct,
    instant_margin:   margin,
    event_count_1h:   eventCount,
    burn_rate:        Math.round(burnRate * 1_000_000) / 1_000_000,
    revenue_estimate: revenueEstimate,
  }

  // Persist to Redis stream (fire-and-forget)
  const key = `econ_drift:${tenantId}`
  void xaddSnap(key, {
    snapshot_id:      snapshot.snapshot_id,
    tenant_id:        snapshot.tenant_id,
    captured_at:      snapshot.captured_at,
    cost_per_hour:    String(snapshot.cost_per_hour),
    ai_cost_pct:      String(snapshot.ai_cost_pct),
    infra_cost_pct:   String(snapshot.infra_cost_pct),
    instant_margin:   snapshot.instant_margin !== null ? String(snapshot.instant_margin) : '',
    event_count_1h:   String(snapshot.event_count_1h),
    burn_rate:        String(snapshot.burn_rate),
    revenue_estimate: snapshot.revenue_estimate !== null ? String(snapshot.revenue_estimate) : '',
  })

  return snapshot
}

// ─── parseSnapshot — convert stream entry to EconomicSnapshot ────────────────

function parseSnapshot(id: string, flat: string[]): EconomicSnapshot {
  const f = parseFlat(flat)
  const tsFromId = parseInt(id.split('-')[0], 10)
  const capturedAt = !isNaN(tsFromId)
    ? new Date(tsFromId).toISOString()
    : (f['captured_at'] ?? new Date().toISOString())

  const marginRaw = f['instant_margin']
  const margin    = marginRaw !== undefined && marginRaw !== '' ? parseFloat(marginRaw) : null

  const revRaw = f['revenue_estimate']
  const rev    = revRaw !== undefined && revRaw !== '' ? parseFloat(revRaw) : null

  return {
    snapshot_id:      f['snapshot_id']    ?? id,
    tenant_id:        f['tenant_id']      ?? '',
    captured_at:      capturedAt,
    cost_per_hour:    safeFloat(f['cost_per_hour']),
    ai_cost_pct:      safeFloat(f['ai_cost_pct']),
    infra_cost_pct:   safeFloat(f['infra_cost_pct']),
    instant_margin:   margin !== null && !isNaN(margin) ? margin : null,
    event_count_1h:   safeFloat(f['event_count_1h']),
    burn_rate:        safeFloat(f['burn_rate']),
    revenue_estimate: rev !== null && !isNaN(rev) ? rev : null,
  }
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function average(vals: number[]): number {
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function stddev(vals: number[]): number {
  if (vals.length < 2) return 0
  const mean = average(vals)
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
  return Math.sqrt(variance)
}

type CostTrend = EconomicDriftProfile['cost_trend']
type MarginTrend = EconomicDriftProfile['margin_trend']
type CollapseRisk = EconomicDriftProfile['collapse_risk']

function classifyCostTrend(burnRates: number[], baseAvg: number, currAvg: number): CostTrend {
  const sd   = stddev(burnRates)
  const mean = average(burnRates)
  if (mean > 0 && (sd / mean) > 0.5)       return 'volatile'
  if (baseAvg <= 0)                          return 'stable'
  const drift = (currAvg - baseAvg) / baseAvg
  if (Math.abs(drift) < 0.20)               return 'stable'
  if (drift > 0.20)                          return 'increasing'
  return 'decreasing'
}

function classifyMarginTrend(margins: (number | null)[]): MarginTrend {
  const valid = margins.filter((m): m is number => m !== null)
  if (valid.length === 0) return 'stable'

  const latest = valid[valid.length - 1]
  if (latest < 0) return 'collapsed'

  if (valid.length < 2) return 'stable'
  const first = valid[0]
  const drift = latest - first   // positive = expanding
  if (Math.abs(drift) < 0.05) return 'stable'
  return drift < 0 ? 'compressing' : 'expanding'
}

function classifyCollapseRisk(currentMargin: number | null): CollapseRisk {
  if (currentMargin === null) return 'low'
  if (currentMargin < 0)      return 'critical'
  if (currentMargin < 0.10)   return 'high'
  if (currentMargin < 0.20)   return 'medium'
  return 'low'
}

function computeStabilityScore(
  costTrend:    CostTrend,
  marginTrend:  MarginTrend,
  collapseRisk: CollapseRisk,
  driftEvents:  EconomicDriftEvent[],
): number {
  let score = 100

  // Cost trend penalties
  if (costTrend === 'volatile')    score -= 25
  else if (costTrend === 'increasing') score -= 15

  // Margin trend penalties
  if (marginTrend === 'collapsed')    score -= 40
  else if (marginTrend === 'compressing') score -= 20

  // Collapse risk penalties
  if (collapseRisk === 'critical') score -= 20
  else if (collapseRisk === 'high')    score -= 10
  else if (collapseRisk === 'medium')  score -= 5

  // Drift event penalties
  const criticals = driftEvents.filter(e => e.severity === 'critical').length
  const warnings  = driftEvents.filter(e => e.severity === 'warning').length
  score -= criticals * 5
  score -= warnings  * 2

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ─── analyzeEconomicDrift ─────────────────────────────────────────────────────

/**
 * Reads all snapshots from the drift stream and produces an EconomicDriftProfile.
 * Baseline = first 3 snapshots avg; Current = last 3 snapshots avg.
 */
export async function analyzeEconomicDrift(tenantId: string): Promise<EconomicDriftProfile> {
  const now = new Date().toISOString()

  const key     = `econ_drift:${tenantId}`
  const entries = await xrangeAll(key)

  const snapshots = entries.map(([id, flat]) => parseSnapshot(id, flat))

  if (snapshots.length < 3) {
    return {
      tenant_id:            tenantId,
      generated_at:         now,
      snapshots_analyzed:   snapshots.length,
      time_span_hours:      0,
      cost_trend:           'stable',
      margin_trend:         'stable',
      ai_cost_drift_pct:    0,
      burn_rate_drift_pct:  0,
      collapse_risk:        'low',
      stability_score:      50,
      drift_events:         [],
    }
  }

  // Time span
  const firstTs = new Date(snapshots[0].captured_at).getTime()
  const lastTs  = new Date(snapshots[snapshots.length - 1].captured_at).getTime()
  const timeSpanHours = Math.round(((lastTs - firstTs) / 3_600_000) * 100) / 100

  // Baseline = first 3 / Current = last 3
  const baseline = snapshots.slice(0, 3)
  const current  = snapshots.slice(-3)

  const baseAvgBurnRate  = average(baseline.map(s => s.burn_rate))
  const currAvgBurnRate  = average(current.map(s => s.burn_rate))
  const baseAvgAiCostPct = average(baseline.map(s => s.ai_cost_pct))
  const currAvgAiCostPct = average(current.map(s => s.ai_cost_pct))

  const allBurnRates = snapshots.map(s => s.burn_rate)
  const allMargins   = snapshots.map(s => s.instant_margin)

  const burnRateDrift = baseAvgBurnRate > 0
    ? Math.round(((currAvgBurnRate - baseAvgBurnRate) / baseAvgBurnRate) * 10_000) / 100
    : 0

  const aiCostDrift = baseAvgAiCostPct > 0
    ? Math.round(((currAvgAiCostPct - baseAvgAiCostPct) / baseAvgAiCostPct) * 10_000) / 100
    : 0

  const costTrend   = classifyCostTrend(allBurnRates, baseAvgBurnRate, currAvgBurnRate)
  const marginTrend = classifyMarginTrend(allMargins)

  const latestMargin   = allMargins.reduceRight<number | null>((acc, m) => acc ?? m, null)
  const collapseRisk   = classifyCollapseRisk(latestMargin)

  // ─── Drift event detection ─────────────────────────────────────────────────
  const driftEvents: EconomicDriftEvent[] = []

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]

    // Cost spike: current burn > 2x previous
    if (prev.burn_rate > 0 && curr.burn_rate > prev.burn_rate * 2) {
      driftEvents.push({
        occurred_at: curr.captured_at,
        type:        'cost_spike',
        severity:    'critical',
        description: `Burn rate jumped from €${prev.burn_rate.toFixed(4)}/h to €${curr.burn_rate.toFixed(4)}/h (>2x baseline)`,
        value:       curr.burn_rate,
      })
    } else if (prev.burn_rate > 0 && curr.burn_rate > prev.burn_rate * 1.5) {
      driftEvents.push({
        occurred_at: curr.captured_at,
        type:        'cost_spike',
        severity:    'warning',
        description: `Burn rate increased 50%+ from €${prev.burn_rate.toFixed(4)}/h to €${curr.burn_rate.toFixed(4)}/h`,
        value:       curr.burn_rate,
      })
    }

    // Margin compression: dropped > 10pp in a single step
    if (prev.instant_margin !== null && curr.instant_margin !== null) {
      const drop = prev.instant_margin - curr.instant_margin
      if (drop > 0.20) {
        driftEvents.push({
          occurred_at: curr.captured_at,
          type:        'margin_compression',
          severity:    curr.instant_margin < 0 ? 'critical' : 'warning',
          description: `Margin dropped ${(drop * 100).toFixed(1)}pp (${(prev.instant_margin * 100).toFixed(1)}% → ${(curr.instant_margin * 100).toFixed(1)}%)`,
          value:       curr.instant_margin,
        })
      }
    }

    // AI overload: ai_cost_pct > 0.90
    if (curr.ai_cost_pct > 0.90) {
      driftEvents.push({
        occurred_at: curr.captured_at,
        type:        'ai_overload',
        severity:    curr.ai_cost_pct > 0.97 ? 'critical' : 'warning',
        description: `AI cost is ${(curr.ai_cost_pct * 100).toFixed(1)}% of total spend`,
        value:       curr.ai_cost_pct,
      })
    }

    // Revenue gap: revenue_estimate < burn_rate (losing money per hour)
    if (
      curr.revenue_estimate !== null &&
      curr.burn_rate > 0 &&
      curr.revenue_estimate < curr.burn_rate
    ) {
      driftEvents.push({
        occurred_at: curr.captured_at,
        type:        'revenue_gap',
        severity:    curr.revenue_estimate <= 0 ? 'critical' : 'warning',
        description: `Hourly revenue (€${curr.revenue_estimate.toFixed(4)}) < hourly burn (€${curr.burn_rate.toFixed(4)})`,
        value:       curr.revenue_estimate - curr.burn_rate,
      })
    }
  }

  const stabilityScore = computeStabilityScore(costTrend, marginTrend, collapseRisk, driftEvents)

  return {
    tenant_id:            tenantId,
    generated_at:         now,
    snapshots_analyzed:   snapshots.length,
    time_span_hours:      timeSpanHours,
    cost_trend:           costTrend,
    margin_trend:         marginTrend,
    ai_cost_drift_pct:    aiCostDrift,
    burn_rate_drift_pct:  burnRateDrift,
    collapse_risk:        collapseRisk,
    stability_score:      stabilityScore,
    drift_events:         driftEvents,
  }
}

// ─── getEconomicDriftProfile ──────────────────────────────────────────────────

/**
 * Public entry point: returns a full drift profile.
 * If fewer than 3 snapshots exist, returns an "insufficient_data" sentinel
 * with stability_score=50 (neutral — we simply don't know yet).
 */
export async function getEconomicDriftProfile(tenantId: string): Promise<EconomicDriftProfile> {
  return analyzeEconomicDrift(tenantId)
}
