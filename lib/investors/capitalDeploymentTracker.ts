// =============================================================================
// Agency Group — Capital Deployment Tracker
// lib/investors/capitalDeploymentTracker.ts
//
// Tracks capital movements and patterns — who deployed how much,
// to what zones, at what velocity.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapitalDeploymentPattern {
  investor_id: string
  tenant_id: string
  period: string                               // 'YYYY-MM' monthly
  // Volume
  capital_committed_eur: number               // total bids submitted
  capital_deployed_eur: number                // deals closed (won)
  capital_withdrawn_eur: number               // bids withdrawn
  // Velocity
  avg_days_to_close: number
  deployment_rate: number                      // deployed / committed (0-1)
  // Distribution
  zone_allocation: Record<string, number>     // zone → EUR committed
  type_allocation: Record<string, number>     // property_type → EUR committed
  // Signals
  is_active_deployer: boolean                  // committed > 0 this month
  deployment_trend: 'increasing' | 'stable' | 'decreasing'
}

export interface SystemCapitalFlow {
  tenant_id: string
  period: string
  total_capital_committed_eur: number
  total_capital_deployed_eur: number
  unique_active_investors: number
  top_zones_by_capital: Array<{ zone: string; capital_eur: number }>
  capital_concentration_index: number         // HHI-like: 0=dispersed, 1=concentrated
  computed_at: string
}

// ─── Private row shapes ───────────────────────────────────────────────────────

interface BidHistoryRow {
  bid_price_eur: number
  max_price_eur: number
  status: string
  submitted_at: string
  urgency_level: string
  property_id: string
}

interface DealRow {
  status: string
  valor: number | null
  data_escritura: string | null
  data_cpcv: string | null
  created_at: string
}

interface PropertyRow {
  id: string
  zona: string | null
  tipo: string | null
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function currentPeriod(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function periodBounds(period: string): { start: string; end: string } {
  const [year, month] = period.split('-').map(Number) as [number, number]
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end   = new Date(Date.UTC(year, month, 1))   // exclusive upper bound
  return {
    start: start.toISOString(),
    end:   end.toISOString(),
  }
}

function subtractMonths(period: string, n: number): string {
  const [year, month] = period.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(year, month - 1 - n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ─── URGENCY_DAYS map ─────────────────────────────────────────────────────────

const URGENCY_DAYS: Record<string, number> = {
  immediate: 7,
  within_30d: 25,
  within_90d: 60,
  flexible: 120,
}

// ─── trackInvestorDeployment ──────────────────────────────────────────────────

export async function trackInvestorDeployment(
  tenantId: string,
  investorId: string,
  period?: string,
): Promise<CapitalDeploymentPattern> {
  const db       = supabaseAdmin as any
  const p        = period ?? currentPeriod()
  const { start, end } = periodBounds(p)

  const blank: CapitalDeploymentPattern = {
    investor_id:            investorId,
    tenant_id:              tenantId,
    period:                 p,
    capital_committed_eur:  0,
    capital_deployed_eur:   0,
    capital_withdrawn_eur:  0,
    avg_days_to_close:      0,
    deployment_rate:        0,
    zone_allocation:        {},
    type_allocation:        {},
    is_active_deployer:     false,
    deployment_trend:       'stable',
  }

  try {
    // ── 1. Bids submitted in this period ────────────────────────────────────
    const { data: bidsRaw, error: bidsErr } = await db
      .from('investor_bids')
      .select('bid_price_eur, max_price_eur, status, submitted_at, urgency_level, property_id')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .gte('submitted_at', start)
      .lt('submitted_at', end)

    if (bidsErr) {
      log.warn('[capitalDeploymentTracker] bids fetch failed', {
        error:       bidsErr.message,
        investor_id: investorId,
        tenant_id:   tenantId,
        period:      p,
      } as any)
      return blank
    }

    const bids: BidHistoryRow[] = (bidsRaw ?? []) as BidHistoryRow[]

    // ── 2. Deals closed in this period (for deployed capital) ────────────────
    const { data: dealsRaw } = await db
      .from('deals')
      .select('status, valor, data_escritura, data_cpcv, created_at')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .gte('created_at', start)
      .lt('created_at', end)

    const deals: DealRow[] = (dealsRaw ?? []) as DealRow[]

    // ── 3. Fetch properties bid on for zone/type allocation ─────────────────
    const bidPropertyIds = [...new Set(bids.map(b => b.property_id))]
    let properties: PropertyRow[] = []

    if (bidPropertyIds.length > 0) {
      const { data: propsRaw } = await db
        .from('properties')
        .select('id, zona, tipo')
        .in('id', bidPropertyIds)
        .eq('tenant_id', tenantId)

      properties = (propsRaw ?? []) as PropertyRow[]
    }

    const propMap = new Map<string, PropertyRow>()
    for (const pr of properties) propMap.set(pr.id, pr)

    // ── 4. Capital aggregates ────────────────────────────────────────────────

    const capital_committed_eur = bids.reduce((s, b) => s + b.bid_price_eur, 0)

    const capital_withdrawn_eur = bids
      .filter(b => b.status === 'withdrawn')
      .reduce((s, b) => s + b.bid_price_eur, 0)

    const wonStages = new Set([
      'Escritura Concluída', 'Escritura', 'fechado', 'post_sale', 'pos_venda', 'escritura_sell',
    ])
    const capital_deployed_eur = deals
      .filter(d => wonStages.has(d.status))
      .reduce((s, d) => s + (d.valor ?? 0), 0)

    const deployment_rate = capital_committed_eur > 0
      ? Math.round((capital_deployed_eur / capital_committed_eur) * 10000) / 10000
      : 0

    // ── 5. avg_days_to_close ─────────────────────────────────────────────────
    const daysList: number[] = []
    for (const b of bids.filter(b => b.status === 'accepted')) {
      daysList.push(URGENCY_DAYS[b.urgency_level] ?? 45)
    }
    const avg_days_to_close = daysList.length > 0
      ? Math.round(daysList.reduce((s, d) => s + d, 0) / daysList.length)
      : 0

    // ── 6. Zone & type allocation ────────────────────────────────────────────
    const zone_allocation: Record<string, number> = {}
    const type_allocation: Record<string, number> = {}

    for (const b of bids) {
      const prop = propMap.get(b.property_id)
      if (prop?.zona) {
        zone_allocation[prop.zona] = (zone_allocation[prop.zona] ?? 0) + b.bid_price_eur
      }
      if (prop?.tipo) {
        type_allocation[prop.tipo] = (type_allocation[prop.tipo] ?? 0) + b.bid_price_eur
      }
    }

    // ── 7. deployment_trend — compare with previous 2 months ────────────────
    let deployment_trend: CapitalDeploymentPattern['deployment_trend'] = 'stable'

    try {
      const prevPeriod  = subtractMonths(p, 1)
      const prev2Period = subtractMonths(p, 2)

      const fetchCommitted = async (per: string): Promise<number> => {
        const { start: s, end: e } = periodBounds(per)
        const { data: rows } = await db
          .from('investor_bids')
          .select('bid_price_eur')
          .eq('investor_id', investorId)
          .eq('tenant_id', tenantId)
          .gte('submitted_at', s)
          .lt('submitted_at', e)
        return ((rows ?? []) as { bid_price_eur: number }[])
          .reduce((s, r) => s + r.bid_price_eur, 0)
      }

      const [prev1Cap, prev2Cap] = await Promise.all([
        fetchCommitted(prevPeriod),
        fetchCommitted(prev2Period),
      ])

      const avgPrev = (prev1Cap + prev2Cap) / 2
      if (avgPrev > 0) {
        const ratio = capital_committed_eur / avgPrev
        if (ratio > 1.2)      deployment_trend = 'increasing'
        else if (ratio < 0.8) deployment_trend = 'decreasing'
        else                  deployment_trend = 'stable'
      }
    } catch (trendErr) {
      log.warn('[capitalDeploymentTracker] trend computation failed — using stable', {
        error: trendErr instanceof Error ? trendErr.message : String(trendErr),
      } as any)
    }

    const pattern: CapitalDeploymentPattern = {
      investor_id:            investorId,
      tenant_id:              tenantId,
      period:                 p,
      capital_committed_eur:  Math.round(capital_committed_eur * 100) / 100,
      capital_deployed_eur:   Math.round(capital_deployed_eur * 100) / 100,
      capital_withdrawn_eur:  Math.round(capital_withdrawn_eur * 100) / 100,
      avg_days_to_close,
      deployment_rate,
      zone_allocation,
      type_allocation,
      is_active_deployer:     capital_committed_eur > 0,
      deployment_trend,
    }

    // Fire-and-forget persist
    void persistDeploymentPattern(pattern).catch(e =>
      log.warn('[capitalDeploymentTracker] persistDeploymentPattern failed', {
        error: e instanceof Error ? e.message : String(e),
      } as any),
    )

    return pattern
  } catch (err) {
    log.warn('[capitalDeploymentTracker] trackInvestorDeployment — error', {
      error:       err instanceof Error ? err.message : String(err),
      investor_id: investorId,
      tenant_id:   tenantId,
      period:      p,
    } as any)
    return blank
  }
}

// ─── computeSystemCapitalFlow ─────────────────────────────────────────────────

export async function computeSystemCapitalFlow(
  tenantId: string,
  period?: string,
): Promise<SystemCapitalFlow> {
  const db       = supabaseAdmin as any
  const p        = period ?? currentPeriod()
  const { start, end } = periodBounds(p)
  const now      = new Date().toISOString()

  const blank: SystemCapitalFlow = {
    tenant_id:                    tenantId,
    period:                       p,
    total_capital_committed_eur:  0,
    total_capital_deployed_eur:   0,
    unique_active_investors:      0,
    top_zones_by_capital:         [],
    capital_concentration_index:  0,
    computed_at:                  now,
  }

  try {
    // All bids in period
    const { data: bidsRaw, error: bidsErr } = await db
      .from('investor_bids')
      .select('investor_id, bid_price_eur, status, property_id')
      .eq('tenant_id', tenantId)
      .gte('submitted_at', start)
      .lt('submitted_at', end)

    if (bidsErr) {
      log.warn('[capitalDeploymentTracker] computeSystemCapitalFlow — bids fetch failed', {
        error:     bidsErr.message,
        tenant_id: tenantId,
        period:    p,
      } as any)
      return blank
    }

    type BidSummary = { investor_id: string; bid_price_eur: number; status: string; property_id: string }
    const bids: BidSummary[] = (bidsRaw ?? []) as BidSummary[]

    if (bids.length === 0) return blank

    // Total committed
    const total_capital_committed_eur = bids.reduce((s, b) => s + b.bid_price_eur, 0)

    // Unique active investors
    const activeInvestors = new Set(
      bids.filter(b => b.bid_price_eur > 0).map(b => b.investor_id),
    )
    const unique_active_investors = activeInvestors.size

    // Capital per investor (for HHI)
    const investorCapital = new Map<string, number>()
    for (const b of bids) {
      investorCapital.set(
        b.investor_id,
        (investorCapital.get(b.investor_id) ?? 0) + b.bid_price_eur,
      )
    }

    // HHI-like concentration index
    let capital_concentration_index = 0
    if (total_capital_committed_eur > 0) {
      for (const [, cap] of investorCapital) {
        const share = cap / total_capital_committed_eur
        capital_concentration_index += share * share
      }
      capital_concentration_index = Math.round(capital_concentration_index * 10000) / 10000
    }

    // Top zones by capital committed
    const propertyIds = [...new Set(bids.map(b => b.property_id))]
    const zoneCapital = new Map<string, number>()

    if (propertyIds.length > 0) {
      const { data: propsRaw } = await db
        .from('properties')
        .select('id, zona')
        .in('id', propertyIds)
        .eq('tenant_id', tenantId)

      const propZoneMap = new Map<string, string>()
      for (const pr of (propsRaw ?? []) as { id: string; zona: string | null }[]) {
        if (pr.zona) propZoneMap.set(pr.id, pr.zona)
      }

      for (const b of bids) {
        const zona = propZoneMap.get(b.property_id)
        if (zona) {
          zoneCapital.set(zona, (zoneCapital.get(zona) ?? 0) + b.bid_price_eur)
        }
      }
    }

    const top_zones_by_capital = [...zoneCapital.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([zone, capital_eur]) => ({
        zone,
        capital_eur: Math.round(capital_eur * 100) / 100,
      }))

    // Deployed capital from deals
    const wonStages = new Set([
      'Escritura Concluída', 'Escritura', 'fechado', 'post_sale', 'pos_venda', 'escritura_sell',
    ])
    const { data: dealsRaw } = await db
      .from('deals')
      .select('status, valor')
      .eq('tenant_id', tenantId)
      .gte('created_at', start)
      .lt('created_at', end)

    type DealSummary = { status: string; valor: number | null }
    const deals: DealSummary[] = (dealsRaw ?? []) as DealSummary[]
    const total_capital_deployed_eur = deals
      .filter(d => wonStages.has(d.status))
      .reduce((s, d) => s + (d.valor ?? 0), 0)

    log.info('[capitalDeploymentTracker] computeSystemCapitalFlow — completed', {
      tenant_id:  tenantId,
      period:     p,
      bids_count: bids.length,
    } as any)

    return {
      tenant_id:                    tenantId,
      period:                       p,
      total_capital_committed_eur:  Math.round(total_capital_committed_eur * 100) / 100,
      total_capital_deployed_eur:   Math.round(total_capital_deployed_eur * 100) / 100,
      unique_active_investors,
      top_zones_by_capital,
      capital_concentration_index,
      computed_at:                  now,
    }
  } catch (err) {
    log.warn('[capitalDeploymentTracker] computeSystemCapitalFlow — error', {
      error:     err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
      period:    p,
    } as any)
    return blank
  }
}

// ─── getDeploymentHistory ─────────────────────────────────────────────────────

export async function getDeploymentHistory(
  tenantId: string,
  investorId: string,
  months = 6,
): Promise<CapitalDeploymentPattern[]> {
  const p = currentPeriod()

  // Build list of periods going back N months
  const periods: string[] = []
  for (let i = 0; i < months; i++) {
    periods.push(subtractMonths(p, i))
  }

  // Check DB cache first
  const db = supabaseAdmin as any

  const { data: cachedRaw } = await db
    .from('capital_deployment_patterns')
    .select('*')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .in('period', periods)
    .order('period', { ascending: false })

  type CachedRow = CapitalDeploymentPattern & { id?: string; computed_at?: string }
  const cached: CachedRow[] = (cachedRaw ?? []) as CachedRow[]

  const cachedPeriods = new Set(cached.map(c => c.period))

  // For missing periods, compute live
  const missingPeriods = periods.filter(per => !cachedPeriods.has(per))

  const liveResults = await Promise.allSettled(
    missingPeriods.map(per => trackInvestorDeployment(tenantId, investorId, per)),
  )

  const livePatterns: CapitalDeploymentPattern[] = []
  for (const result of liveResults) {
    if (result.status === 'fulfilled') {
      livePatterns.push(result.value)
    }
  }

  // Merge and sort by period descending
  const all = [
    ...cached.map(c => ({
      investor_id:            c.investor_id,
      tenant_id:              c.tenant_id,
      period:                 c.period,
      capital_committed_eur:  Number(c.capital_committed_eur),
      capital_deployed_eur:   Number(c.capital_deployed_eur),
      capital_withdrawn_eur:  Number(c.capital_withdrawn_eur),
      avg_days_to_close:      Number(c.avg_days_to_close ?? 0),
      deployment_rate:        Number(c.deployment_rate),
      zone_allocation:        (c.zone_allocation as unknown as Record<string, number>) ?? {},
      type_allocation:        (c.type_allocation as unknown as Record<string, number>) ?? {},
      is_active_deployer:     Boolean(c.is_active_deployer),
      deployment_trend:       c.deployment_trend,
    })),
    ...livePatterns,
  ]

  // Deduplicate by period (prefer cached)
  const seen = new Set<string>()
  const deduped: CapitalDeploymentPattern[] = []
  for (const item of all.sort((a, b) => (a.period < b.period ? 1 : -1))) {
    if (!seen.has(item.period)) {
      seen.add(item.period)
      deduped.push(item)
    }
  }

  return deduped.slice(0, months)
}

// ─── persistDeploymentPattern ─────────────────────────────────────────────────

export async function persistDeploymentPattern(
  pattern: CapitalDeploymentPattern,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('capital_deployment_patterns')
    .upsert(
      {
        investor_id:            pattern.investor_id,
        tenant_id:              pattern.tenant_id,
        period:                 pattern.period,
        capital_committed_eur:  pattern.capital_committed_eur,
        capital_deployed_eur:   pattern.capital_deployed_eur,
        capital_withdrawn_eur:  pattern.capital_withdrawn_eur,
        avg_days_to_close:      pattern.avg_days_to_close,
        deployment_rate:        pattern.deployment_rate,
        zone_allocation:        pattern.zone_allocation,
        type_allocation:        pattern.type_allocation,
        is_active_deployer:     pattern.is_active_deployer,
        deployment_trend:       pattern.deployment_trend,
        computed_at:            new Date().toISOString(),
      },
      { onConflict: 'tenant_id,investor_id,period' },
    )

  if (error) {
    log.warn('[capitalDeploymentTracker] persistDeploymentPattern — upsert failed', {
      error:       error.message,
      investor_id: pattern.investor_id,
      tenant_id:   pattern.tenant_id,
      period:      pattern.period,
    } as any)
  }
}
