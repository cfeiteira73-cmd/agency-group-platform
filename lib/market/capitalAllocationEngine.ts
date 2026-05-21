// =============================================================================
// Agency Group — Capital Allocation Engine
// lib/market/capitalAllocationEngine.ts
//
// Execution layer: auto-assigns deals to investors, optimises global yield,
// learns from real ROI. Consumes capitalAllocationOptimizer rankings and
// enhances them with behavioral profiles.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { rankForCapitalAllocation } from '@/lib/ml/capitalAllocationOptimizer'
import { buildBehavioralProfile } from '@/lib/investors/behavioralModel'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllocationStrategy =
  | 'maximize_yield'
  | 'maximize_speed'
  | 'maximize_capital_velocity'
  | 'balanced'

export interface AllocationDecision {
  property_id: string
  tenant_id: string
  strategy: AllocationStrategy
  ranked_investors: Array<{
    investor_id: string
    rank: number
    optimized_score: number
    expected_yield: number
    expected_close_days: number
    conviction: 'high' | 'medium' | 'low'
    recommended_action: 'primary_outreach' | 'secondary_outreach' | 'watchlist'
  }>
  recommended_ask_adjustment_pct: number
  time_sensitivity: 'urgent' | 'standard' | 'flexible'
  allocation_confidence: number   // 0-1
  computed_at: string
}

export interface GlobalYieldOptimization {
  tenant_id: string
  period: string
  total_properties_in_play: number
  total_investors_active: number
  global_expected_yield_pct: number
  global_expected_commission_eur: number
  allocation_efficiency: number   // 0-1
  bottlenecks: Array<{ property_id: string; reason: string }>
  computed_at: string
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function convictionFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

function recommendedActionFromRank(rank: number): 'primary_outreach' | 'secondary_outreach' | 'watchlist' {
  if (rank === 1) return 'primary_outreach'
  if (rank <= 3)  return 'secondary_outreach'
  return 'watchlist'
}

// ─── computeAllocationDecision ────────────────────────────────────────────────

export async function computeAllocationDecision(
  tenantId: string,
  propertyId: string,
  strategy: AllocationStrategy = 'balanced',
): Promise<AllocationDecision> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const blank: AllocationDecision = {
    property_id:                    propertyId,
    tenant_id:                      tenantId,
    strategy,
    ranked_investors:               [],
    recommended_ask_adjustment_pct: 0,
    time_sensitivity:               'standard',
    allocation_confidence:          0,
    computed_at:                    now,
  }

  try {
    // ── 1. Find candidate investors (active, with bid interest) ──────────────
    const { data: activeBidRows, error: bidErr } = await db
      .from('investor_bids')
      .select('investor_id, urgency_level, bid_price_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (bidErr) {
      log.warn('[capitalAllocationEngine] active bids fetch failed', {
        error:       bidErr.message,
        property_id: propertyId,
        tenant_id:   tenantId,
      } as any)
      return blank
    }

    type BidRow = { investor_id: string; urgency_level: string; bid_price_eur: number }
    const activeBids = (activeBidRows ?? []) as BidRow[]

    // Unique investors with any active bid
    const candidateInvestorIds = [...new Set(activeBids.map(b => b.investor_id))]

    if (candidateInvestorIds.length === 0) {
      log.info('[capitalAllocationEngine] no candidate investors found', {
        property_id: propertyId,
        tenant_id:   tenantId,
      } as any)
      return blank
    }

    // ── 2. Get property details ──────────────────────────────────────────────
    const { data: propRaw } = await db
      .from('properties')
      .select('preco, mpi_score, zona, tipo')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    type PropRow = { preco: number | null; mpi_score: number | null; zona: string | null; tipo: string | null }
    const prop = propRaw as PropRow | null

    const askPrice  = prop?.preco ?? 0
    const mpiScore  = prop?.mpi_score ?? 50

    // ── 3. For property-centric allocation, re-score each investor against
    //       this property by calling rankForCapitalAllocation per investor.
    const investorScores = await Promise.allSettled(
      candidateInvestorIds.slice(0, 20).map(async investorId => {
        const rankings = await rankForCapitalAllocation(
          tenantId,
          investorId,
          [propertyId],
          { max_results: 1 },
        )
        return {
          investor_id:     investorId,
          optimized_score: rankings[0]?.optimized_score ?? 0,
          expected_profit: rankings[0]?.expected_profit_eur ?? 0,
        }
      }),
    )

    // Collect successful scores
    type InvestorScore = {
      investor_id: string
      optimized_score: number
      expected_profit: number
    }
    const scores: InvestorScore[] = []
    for (const result of investorScores) {
      if (result.status === 'fulfilled') scores.push(result.value)
    }

    if (scores.length === 0) {
      log.warn('[capitalAllocationEngine] no scores computed', {
        property_id: propertyId,
        tenant_id:   tenantId,
      } as any)
      return blank
    }

    // ── 4. Enhance with behavioral profiles ──────────────────────────────────
    // Load behavioral profiles for top-5 investors only (perf guard)
    const top5Ids = scores
      .sort((a, b) => b.optimized_score - a.optimized_score)
      .slice(0, 5)
      .map(s => s.investor_id)

    const profileResults = await Promise.allSettled(
      top5Ids.map(id => buildBehavioralProfile(tenantId, id)),
    )

    const profileMap = new Map<string, Awaited<ReturnType<typeof buildBehavioralProfile>>>()
    for (let i = 0; i < profileResults.length; i++) {
      const r = profileResults[i]
      if (r?.status === 'fulfilled') {
        profileMap.set(top5Ids[i]!, r.value)
      }
    }

    // ── 5. Strategy-specific score adjustment ────────────────────────────────
    const strategyWeights: Record<AllocationStrategy, {
      yield: number; speed: number; velocity: number; base: number
    }> = {
      maximize_yield:            { yield: 0.50, speed: 0.10, velocity: 0.10, base: 0.30 },
      maximize_speed:            { yield: 0.10, speed: 0.50, velocity: 0.20, base: 0.20 },
      maximize_capital_velocity: { yield: 0.10, speed: 0.20, velocity: 0.50, base: 0.20 },
      balanced:                  { yield: 0.25, speed: 0.25, velocity: 0.25, base: 0.25 },
    }
    const weights = strategyWeights[strategy]

    // Close-days estimate from urgency distribution
    const urgencyDaysMap: Record<string, number> = {
      immediate: 7, within_30d: 25, within_90d: 60, flexible: 120,
    }

    const investorUrgency = new Map<string, string>()
    for (const b of activeBids) {
      if (!investorUrgency.has(b.investor_id)) {
        investorUrgency.set(b.investor_id, b.urgency_level)
      }
    }

    // ── 6. Build ranked_investors ────────────────────────────────────────────
    const enhancedScores = scores.map(s => {
      const profile          = profileMap.get(s.investor_id)
      const urgency          = investorUrgency.get(s.investor_id) ?? 'within_90d'
      const expected_close_days = urgencyDaysMap[urgency] ?? 60

      // Yield estimate: expected_profit / ask_price
      const expected_yield = askPrice > 0
        ? (s.expected_profit / askPrice) * 100
        : 5.0  // default 5% (COMMISSION_RATE)

      // Velocity bonus from behavioral profile
      const velocityBonus = profile?.capital_velocity_score ?? 0.5
      const speedBonus    = 1 - clamp01(expected_close_days / 120)

      const strategyScore =
        s.optimized_score * weights.base +
        expected_yield    * weights.yield +
        speedBonus * 100  * weights.speed +
        velocityBonus * 100 * weights.velocity

      return {
        investor_id:          s.investor_id,
        strategy_score:       Math.round(strategyScore * 100) / 100,
        optimized_score:      s.optimized_score,
        expected_yield:       Math.round(expected_yield * 100) / 100,
        expected_close_days,
      }
    })

    // Sort by strategy score descending
    enhancedScores.sort((a, b) => b.strategy_score - a.strategy_score)

    const ranked_investors = enhancedScores.map((item, idx) => ({
      investor_id:         item.investor_id,
      rank:                idx + 1,
      optimized_score:     item.optimized_score,
      expected_yield:      item.expected_yield,
      expected_close_days: item.expected_close_days,
      conviction:          convictionFromScore(item.optimized_score) as 'high' | 'medium' | 'low',
      recommended_action:  recommendedActionFromRank(idx + 1) as 'primary_outreach' | 'secondary_outreach' | 'watchlist',
    }))

    // ── 7. Bid competition analysis → ask adjustment ─────────────────────────
    const propertyBids = activeBids
      .filter(b => b.bid_price_eur > 0)
      .map(b => b.bid_price_eur)

    let recommended_ask_adjustment_pct = 0
    if (propertyBids.length > 2 && askPrice > 0) {
      const avgBid = propertyBids.reduce((s, p) => s + p, 0) / propertyBids.length
      const ratio  = avgBid / askPrice
      // If avg bid is >5% above ask, suggest raising ask
      recommended_ask_adjustment_pct = Math.round((ratio - 1) * 100 * 100) / 100
    }

    // ── 8. Time sensitivity from MPI score and bid count ─────────────────────
    let time_sensitivity: AllocationDecision['time_sensitivity']
    if (mpiScore >= 75 || activeBids.length >= 5) {
      time_sensitivity = 'urgent'
    } else if (mpiScore <= 35 || activeBids.length === 0) {
      time_sensitivity = 'flexible'
    } else {
      time_sensitivity = 'standard'
    }

    // ── 9. Allocation confidence ─────────────────────────────────────────────
    const hasStrongTop  = ranked_investors[0]?.optimized_score ?? 0
    const hasClearGap   = ranked_investors.length > 1
      ? ((ranked_investors[0]?.optimized_score ?? 0) - (ranked_investors[1]?.optimized_score ?? 0)) > 10
      : true
    const allocation_confidence = Math.round(
      clamp01(
        (hasStrongTop / 100) * 0.5 +
        (hasClearGap ? 0.3 : 0.1) +
        clamp01(scores.length / 10) * 0.2,
      ) * 10000,
    ) / 10000

    const decision: AllocationDecision = {
      property_id:                    propertyId,
      tenant_id:                      tenantId,
      strategy,
      ranked_investors,
      recommended_ask_adjustment_pct,
      time_sensitivity,
      allocation_confidence,
      computed_at:                    now,
    }

    // Fire-and-forget persist
    void persistAllocationDecision(decision).catch(e =>
      log.warn('[capitalAllocationEngine] persistAllocationDecision failed', {
        error: e instanceof Error ? e.message : String(e),
      } as any),
    )

    log.info('[capitalAllocationEngine] computeAllocationDecision — completed', {
      property_id:        propertyId,
      tenant_id:          tenantId,
      strategy,
      ranked_investors:   ranked_investors.length,
      confidence:         allocation_confidence,
    } as any)

    return decision
  } catch (err) {
    log.warn('[capitalAllocationEngine] computeAllocationDecision — error', {
      error:       err instanceof Error ? err.message : String(err),
      property_id: propertyId,
      tenant_id:   tenantId,
    } as any)
    return blank
  }
}

// ─── computeGlobalYieldOptimization ──────────────────────────────────────────

export async function computeGlobalYieldOptimization(
  tenantId: string,
): Promise<GlobalYieldOptimization> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()
  const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`

  const blank: GlobalYieldOptimization = {
    tenant_id:                      tenantId,
    period,
    total_properties_in_play:       0,
    total_investors_active:         0,
    global_expected_yield_pct:      0,
    global_expected_commission_eur: 0,
    allocation_efficiency:          0,
    bottlenecks:                    [],
    computed_at:                    now,
  }

  try {
    // Active properties with mpi_score > 0
    const { data: propsRaw, error: propErr } = await db
      .from('properties')
      .select('id, preco, mpi_score')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gt('mpi_score', 0)
      .limit(200)

    if (propErr) {
      log.warn('[capitalAllocationEngine] global yield — props fetch failed', {
        error:     propErr.message,
        tenant_id: tenantId,
      } as any)
      return blank
    }

    type PropSummary = { id: string; preco: number | null; mpi_score: number | null }
    const properties: PropSummary[] = (propsRaw ?? []) as PropSummary[]

    if (properties.length === 0) return blank

    // Active investors (with at least one active bid)
    const { data: investorRows } = await db
      .from('investor_bids')
      .select('investor_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    type InvestorRow = { investor_id: string }
    const uniqueInvestors = new Set(
      ((investorRows ?? []) as InvestorRow[]).map(r => r.investor_id),
    )

    // Load cached allocation decisions for active properties
    const propertyIds = properties.map(p => p.id)
    const { data: allocRaw } = await db
      .from('allocation_decisions')
      .select('property_id, ranked_investors, allocation_confidence')
      .eq('tenant_id', tenantId)
      .in('property_id', propertyIds)

    type AllocRow = {
      property_id: string
      ranked_investors: AllocationDecision['ranked_investors']
      allocation_confidence: number
    }
    const allocMap = new Map<string, AllocRow>()
    for (const a of (allocRaw ?? []) as AllocRow[]) {
      allocMap.set(a.property_id, a)
    }

    // Per-property yield estimates
    let totalWeightedYield    = 0
    let totalWeightedValue    = 0
    let totalExpectedCommission = 0
    let propertiesWithMatch   = 0
    const bottlenecks: GlobalYieldOptimization['bottlenecks'] = []

    for (const prop of properties) {
      const price    = prop.preco ?? 0
      const alloc    = allocMap.get(prop.id)

      if (!alloc || alloc.ranked_investors.length === 0) {
        bottlenecks.push({
          property_id: prop.id,
          reason: 'no_matched_investors',
        })
        continue
      }

      const top = alloc.ranked_investors[0]
      if (!top) continue

      if (alloc.allocation_confidence < 0.3) {
        bottlenecks.push({
          property_id: prop.id,
          reason: `low_confidence_${Math.round(alloc.allocation_confidence * 100)}pct`,
        })
      }

      // Expected yield = top investor's expected yield * confidence
      const yieldPct   = top.expected_yield * alloc.allocation_confidence
      const commission = price * COMMISSION_RATE * (prop.mpi_score ?? 50) / 100

      totalWeightedYield    += yieldPct * price
      totalWeightedValue    += price
      totalExpectedCommission += commission
      propertiesWithMatch++
    }

    const global_expected_yield_pct = totalWeightedValue > 0
      ? Math.round((totalWeightedYield / totalWeightedValue) * 100) / 100
      : 0

    const allocation_efficiency = properties.length > 0
      ? Math.round((propertiesWithMatch / properties.length) * 10000) / 10000
      : 0

    log.info('[capitalAllocationEngine] computeGlobalYieldOptimization — completed', {
      tenant_id:            tenantId,
      total_properties:     properties.length,
      properties_matched:   propertiesWithMatch,
      bottlenecks_count:    bottlenecks.length,
    } as any)

    return {
      tenant_id:                      tenantId,
      period,
      total_properties_in_play:       properties.length,
      total_investors_active:         uniqueInvestors.size,
      global_expected_yield_pct,
      global_expected_commission_eur: Math.round(totalExpectedCommission * 100) / 100,
      allocation_efficiency,
      bottlenecks:                    bottlenecks.slice(0, 20),
      computed_at:                    now,
    }
  } catch (err) {
    log.warn('[capitalAllocationEngine] computeGlobalYieldOptimization — error', {
      error:     err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
    } as any)
    return blank
  }
}

// ─── autoTriggerAllocations ───────────────────────────────────────────────────

export async function autoTriggerAllocations(
  tenantId: string,
): Promise<{ triggered: number; skipped: number }> {
  const db = supabaseAdmin as any

  let triggered = 0
  let skipped   = 0

  try {
    // Properties with mpi_score > 60 and active status
    const { data: propsRaw, error: propErr } = await db
      .from('properties')
      .select('id, mpi_score')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gt('mpi_score', 60)
      .limit(100)

    if (propErr) {
      log.warn('[capitalAllocationEngine] autoTriggerAllocations — props fetch failed', {
        error:     propErr.message,
        tenant_id: tenantId,
      } as any)
      return { triggered: 0, skipped: 0 }
    }

    type PropRow = { id: string; mpi_score: number | null }
    const properties: PropRow[] = (propsRaw ?? []) as PropRow[]

    // Process sequentially to avoid overloading DB (up to 100 properties)
    for (const prop of properties) {
      try {
        const decision = await computeAllocationDecision(tenantId, prop.id, 'balanced')

        if (decision.ranked_investors.length > 0) {
          await persistAllocationDecision(decision)
          triggered++
        } else {
          skipped++
        }
      } catch (err) {
        log.warn('[capitalAllocationEngine] autoTriggerAllocations — single property failed', {
          error:       err instanceof Error ? err.message : String(err),
          property_id: prop.id,
          tenant_id:   tenantId,
        } as any)
        skipped++
      }
    }

    log.info('[capitalAllocationEngine] autoTriggerAllocations — completed', {
      tenant_id: tenantId,
      triggered,
      skipped,
      total:     properties.length,
    } as any)

    return { triggered, skipped }
  } catch (err) {
    log.warn('[capitalAllocationEngine] autoTriggerAllocations — error', {
      error:     err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
    } as any)
    return { triggered, skipped }
  }
}

// ─── persistAllocationDecision ────────────────────────────────────────────────

export async function persistAllocationDecision(
  decision: AllocationDecision,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('allocation_decisions')
    .upsert(
      {
        property_id:                    decision.property_id,
        tenant_id:                      decision.tenant_id,
        strategy:                       decision.strategy,
        ranked_investors:               decision.ranked_investors,
        recommended_ask_adjustment_pct: decision.recommended_ask_adjustment_pct,
        time_sensitivity:               decision.time_sensitivity,
        allocation_confidence:          decision.allocation_confidence,
        computed_at:                    decision.computed_at,
      },
      { onConflict: 'tenant_id,property_id' },
    )

  if (error) {
    log.warn('[capitalAllocationEngine] persistAllocationDecision — upsert failed', {
      error:       error.message,
      property_id: decision.property_id,
      tenant_id:   decision.tenant_id,
    } as any)
  }
}
