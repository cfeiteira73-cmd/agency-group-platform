// Agency Group — Capital Allocation Optimizer
// lib/ml/capitalAllocationOptimizer.ts
// TypeScript strict — 0 errors
//
// Ranks candidate properties for an investor using an expected-value model
// that balances match score, liquidity, and profit probability.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptimizedRanking {
  property_id: string
  investor_id: string
  match_score: number
  liquidity_score: number | null
  competition_score: number | null
  expected_profit_eur: number
  profit_probability: number
  expected_value_eur: number
  optimized_score: number
  rank: number
  rank_drivers: string[]
}

// ---------------------------------------------------------------------------
// rankForCapitalAllocation
// ---------------------------------------------------------------------------

export async function rankForCapitalAllocation(
  tenantId: string,
  investorId: string,
  candidatePropertyIds: string[],
  options?: { max_results?: number },
): Promise<OptimizedRanking[]> {
  const maxResults = options?.max_results ?? 20

  if (candidatePropertyIds.length === 0) {
    return []
  }

  try {
    // 1. Fetch property prices from the properties table
    const { data: properties, error: propErr } = await (supabaseAdmin as any)
      .from('properties')
      .select('id, preco')
      .in('id', candidatePropertyIds)
      .eq('tenant_id', tenantId)

    if (propErr) {
      log.warn('[capitalAllocationOptimizer] rankForCapitalAllocation — fetch properties failed', {
        error:      propErr.message,
        tenant_id:  tenantId,
        investor_id: investorId,
      } as any)
      return []
    }

    const priceMap = new Map<string, number>()
    for (const p of (properties ?? []) as Array<{ id: string; preco: number | null }>) {
      if (p.preco != null) {
        priceMap.set(p.id, p.preco)
      }
    }

    // 2. Fetch match/liquidity/competition scores from investor_matches (or
    //    equivalent scoring table) if available; fall back to sensible defaults.
    const { data: matchRows, error: matchErr } = await (supabaseAdmin as any)
      .from('investor_matches')
      .select('property_id, match_score, liquidity_score, competition_score, competition_count')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .in('property_id', candidatePropertyIds)

    if (matchErr) {
      log.warn('[capitalAllocationOptimizer] rankForCapitalAllocation — fetch matches failed (using defaults)', {
        error:      matchErr.message,
        tenant_id:  tenantId,
        investor_id: investorId,
      } as any)
    }

    type MatchRow = {
      property_id: string
      match_score: number | null
      liquidity_score: number | null
      competition_score: number | null
      competition_count: number | null
    }
    const matchMap = new Map<string, MatchRow>()
    for (const row of (matchRows ?? []) as MatchRow[]) {
      matchMap.set(row.property_id, row)
    }

    // 3. Build raw rankings
    interface RawRanking {
      property_id: string
      match_score: number
      liquidity_score: number | null
      competition_score: number | null
      competition_count: number
      expected_profit_eur: number
      profit_probability: number
      expected_value_eur: number
    }

    const rawRankings: RawRanking[] = []

    for (const propertyId of candidatePropertyIds) {
      const price            = priceMap.get(propertyId) ?? 0
      const matchRow         = matchMap.get(propertyId)
      const match_score      = matchRow?.match_score      ?? 50
      const liquidity_score  = matchRow?.liquidity_score  ?? null
      const competition_score = matchRow?.competition_score ?? null
      const competition_count = matchRow?.competition_count ?? 2

      const expected_profit_eur = price * 0.05  // standard 5% commission

      // win_probability decreases with more competitors
      const win_probability = 0.65 / Math.max(1, competition_count)

      const profit_probability =
        (match_score / 100) * 0.4 +
        ((liquidity_score ?? 50) / 100) * 0.3 +
        win_probability * 0.3

      const expected_value_eur = expected_profit_eur * profit_probability

      rawRankings.push({
        property_id: propertyId,
        match_score,
        liquidity_score,
        competition_score,
        competition_count,
        expected_profit_eur,
        profit_probability,
        expected_value_eur,
      })
    }

    // 4. Normalize expected_value to [0, 100]
    const maxEv = rawRankings.reduce((m, r) => Math.max(m, r.expected_value_eur), 0) || 1

    const scored: Array<OptimizedRanking & { _sort: number }> = rawRankings.map(r => {
      const norm_ev = (r.expected_value_eur / maxEv) * 100

      const optimized_score =
        r.match_score * 0.30 +
        norm_ev * 0.35 +
        (r.liquidity_score ?? 50) * 0.20 +
        (r.competition_score ?? 50) * 0.15

      const rank_drivers: string[] = []

      if (r.match_score > 75)                                              rank_drivers.push('High match score')
      if (r.liquidity_score != null && r.liquidity_score > 70)            rank_drivers.push('High liquidity')
      rank_drivers.push(`High expected profit €${Math.round(r.expected_profit_eur).toLocaleString('pt-PT')}`)
      if (r.competition_score != null && r.competition_score < 40)        rank_drivers.push('Low competition')
      if (rank_drivers.length < 3)                                         rank_drivers.push('Revenue optimized')

      return {
        property_id:         r.property_id,
        investor_id:         investorId,
        match_score:         r.match_score,
        liquidity_score:     r.liquidity_score,
        competition_score:   r.competition_score,
        expected_profit_eur: Math.round(r.expected_profit_eur * 100) / 100,
        profit_probability:  Math.round(r.profit_probability * 10000) / 10000,
        expected_value_eur:  Math.round(r.expected_value_eur * 100) / 100,
        optimized_score:     Math.round(optimized_score * 100) / 100,
        rank:                0,  // assigned below
        rank_drivers:        rank_drivers.slice(0, 3),
        _sort:               optimized_score,
      }
    })

    // 5. Sort descending, assign ranks, trim
    scored.sort((a, b) => b._sort - a._sort)
    const trimmed = scored.slice(0, maxResults)
    trimmed.forEach((item, idx) => {
      item.rank = idx + 1
    })

    // Strip internal sort key
    const result: OptimizedRanking[] = trimmed.map(({ _sort: _unused, ...rest }) => rest)

    log.info('[capitalAllocationOptimizer] rankForCapitalAllocation — completed', {
      investor_id:  investorId,
      tenant_id:    tenantId,
      candidates:   candidatePropertyIds.length,
      returned:     result.length,
    } as any)

    return result
  } catch (err) {
    log.error(
      '[capitalAllocationOptimizer] rankForCapitalAllocation — unexpected error',
      err instanceof Error ? err : undefined,
      { investor_id: investorId, tenant_id: tenantId },
    )
    return []
  }
}
