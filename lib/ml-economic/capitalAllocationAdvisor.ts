// Agency Group — Capital Allocation Advisor
// lib/ml-economic/capitalAllocationAdvisor.ts
// Uses learned patterns to recommend optimal capital allocation.
// Outputs: ROI prediction, bid acceptance probability, capital recommendation.
// Reads ONLY from real data. Makes recommendations, never executes.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { LearnedPattern } from './executionLearner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AllocationRecommendation {
  recommendation_id: string
  tenant_id: string
  investor_id: string
  asset_id: string
  recommended_bid_eur_cents: number
  max_bid_eur_cents: number
  predicted_roi_pct: number
  predicted_days_to_close: number
  bid_acceptance_probability: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rationale: string[]
  risk_warnings: string[]
  generated_at: string
}

// ─── Internal types for DB rows ───────────────────────────────────────────────

interface BidRow {
  asset_id: string
  status: string
}

interface OutcomeRow {
  commission_eur_cents: number
  final_price_eur_cents: number
  days_to_close: number
  zone: string
  asset_class: string
}

// ─── recommendAllocation ─────────────────────────────────────────────────────

/**
 * Produces an ML-driven capital allocation recommendation for a single asset.
 * Reads learned_patterns, active bids, and investor history from real Supabase data.
 */
export async function recommendAllocation(params: {
  investor_id: string
  asset_id: string
  zone: string
  asset_class: string
  listed_price_eur_cents: number
  tenant_id: string
}): Promise<AllocationRecommendation> {
  const { investor_id, asset_id, zone, asset_class, listed_price_eur_cents, tenant_id } = params

  // 1. Load learned patterns for this zone + asset_class
  const { data: patternData } = await (supabaseAdmin as any)
    .from('learned_patterns')
    .select('*')
    .eq('tenant_id', tenant_id)
    .in('pattern_type', ['HIGH_ROI', 'FAST_CLOSE'])

  const patterns = (patternData ?? []) as LearnedPattern[]

  const relevantPatterns = patterns.filter(p => {
    const cond = p.conditions as Record<string, unknown>
    return cond['zone'] === zone || cond['asset_class'] === asset_class
  })

  // 2. Count active bids for asset
  const { data: bidsData } = await (supabaseAdmin as any)
    .from('bids')
    .select('asset_id, status')
    .eq('asset_id', asset_id)
    .eq('status', 'active')

  const activeBids = ((bidsData ?? []) as BidRow[]).length

  // 3. Investor history in this zone + asset_class
  const { data: investorHistory } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('commission_eur_cents, final_price_eur_cents, days_to_close, zone, asset_class')
    .eq('tenant_id', tenant_id)
    .eq('investor_id', investor_id)

  const history = (investorHistory ?? []) as OutcomeRow[]

  // 4. Compute recommended bid
  let premiumFactor = 0
  if (relevantPatterns.length > 0) {
    // Use avg price_premium_pct from HIGH_ROI patterns where it's set in conditions
    const premiums = relevantPatterns
      .map(p => (p.conditions as Record<string, unknown>)['avg_price_premium_pct'] as number | undefined)
      .filter((v): v is number => typeof v === 'number')
    if (premiums.length > 0) {
      premiumFactor = premiums.reduce((s, v) => s + v, 0) / premiums.length
    }
  }
  const recommended_bid_eur_cents = Math.round(listed_price_eur_cents * (1 + premiumFactor / 100))
  const max_bid_eur_cents = Math.round(listed_price_eur_cents * 1.15) // hard cap: 15% above list

  // 5. predicted_roi_pct
  const similarDeals = history.filter(h => h.zone === zone || h.asset_class === asset_class)
  let predicted_roi_pct = 0
  let predicted_days_to_close = 90
  if (similarDeals.length > 0) {
    const totalPrice = similarDeals.reduce((s, d) => s + d.final_price_eur_cents, 0)
    const totalCommission = similarDeals.reduce((s, d) => s + d.commission_eur_cents, 0)
    const baseRoi = totalPrice > 0 ? (totalCommission / totalPrice) * 100 : 0
    // Confidence adjustment: scale down if few patterns
    const confidenceAdj = Math.min(1.0, relevantPatterns.length / 5)
    predicted_roi_pct = Math.round(baseRoi * (0.7 + 0.3 * confidenceAdj) * 100) / 100
    predicted_days_to_close = Math.round(
      similarDeals.reduce((s, d) => s + (d.days_to_close ?? 90), 0) / similarDeals.length,
    )
  } else if (relevantPatterns.length > 0) {
    // Estimate from pattern avg_reward
    const avgReward = relevantPatterns.reduce((s, p) => s + p.avg_reward, 0) / relevantPatterns.length
    predicted_roi_pct = Math.round((avgReward / 1000) * 5 * 100) / 100 // rough proxy
  }

  // 6. bid_acceptance_probability
  const competitionLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
    activeBids >= 5 ? 'HIGH' : activeBids >= 2 ? 'MEDIUM' : 'LOW'
  const bid_acceptance_probability =
    competitionLevel === 'HIGH' ? 0.3 : competitionLevel === 'MEDIUM' ? 0.5 : 0.8

  // 7. Overall confidence
  const patternSampleSum = relevantPatterns.reduce((s, p) => s + p.sample_count, 0)
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    patternSampleSum >= 10 ? 'HIGH' : patternSampleSum >= 3 ? 'MEDIUM' : 'LOW'

  // 8. Rationale
  const rationale: string[] = []
  if (relevantPatterns.length > 0) {
    rationale.push(
      `${relevantPatterns.length} learned pattern(s) match zone "${zone}" / asset class "${asset_class}"`,
    )
  }
  if (premiumFactor > 0) {
    rationale.push(`Bid premium of ${premiumFactor.toFixed(1)}% recommended based on historical pattern analysis`)
  }
  if (similarDeals.length > 0) {
    rationale.push(
      `Investor has ${similarDeals.length} prior deal(s) in similar segments — ROI calibrated from real history`,
    )
  }
  rationale.push(
    `${activeBids} active competing bid(s) detected — competition level: ${competitionLevel}`,
  )

  // 9. Risk warnings
  const risk_warnings: string[] = []

  // Zone has < 3 historical deals
  const { data: zoneHistory } = await (supabaseAdmin as any)
    .from('execution_outcomes')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('zone', zone)

  const zoneCount = ((zoneHistory ?? []) as unknown[]).length
  if (zoneCount < 3) {
    risk_warnings.push(`Insufficient zone data: only ${zoneCount} historical deal(s) in "${zone}" — prediction confidence is LOW`)
  }

  // Investor concentration risk
  const investorZones = [...new Set(history.map(h => h.zone))]
  if (history.length >= 3 && investorZones.length === 1) {
    risk_warnings.push(`Investor concentration risk: all ${history.length} prior deals in single zone "${investorZones[0]}"`)
  }

  // Negative ROI in asset class
  const assetClassDeals = history.filter(h => h.asset_class === asset_class)
  if (assetClassDeals.length > 0) {
    const assetClassTotalCommission = assetClassDeals.reduce((s, d) => s + d.commission_eur_cents, 0)
    if (assetClassTotalCommission <= 0) {
      risk_warnings.push(`Historical data shows zero or negative ROI for asset class "${asset_class}" — review before committing capital`)
    }
  }

  // 10. Persist recommendation
  const recommendation_id = `rec_${randomUUID()}`
  const generated_at = new Date().toISOString()

  const row = {
    recommendation_id,
    tenant_id,
    investor_id,
    asset_id,
    recommended_bid_eur_cents,
    max_bid_eur_cents,
    predicted_roi_pct,
    predicted_days_to_close,
    bid_acceptance_probability,
    confidence,
    rationale,
    risk_warnings,
    generated_at,
  }

  void (supabaseAdmin as any)
    .from('allocation_recommendations')
    .insert(row)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.info('[capitalAllocationAdvisor] persist error', { error: error.message, recommendation_id })
    })
    .catch((e: unknown) => console.warn('[capitalAllocationAdvisor] persist catch', e))

  log.info('[capitalAllocationAdvisor] recommendation generated', {
    recommendation_id,
    investor_id,
    asset_id,
    confidence,
  })

  return row
}

// ─── batchRecommendForPortfolio ───────────────────────────────────────────────

/**
 * Runs recommendAllocation sequentially for each asset (avoids DB overload).
 */
export async function batchRecommendForPortfolio(
  investorId: string,
  assetIds: string[],
  tenantId: string,
): Promise<AllocationRecommendation[]> {
  const results: AllocationRecommendation[] = []

  for (const assetId of assetIds) {
    // Load minimal asset info from Supabase
    const { data: assetData } = await (supabaseAdmin as any)
      .from('imoveis')
      .select('id, zone, asset_class, price_eur_cents, zona')
      .eq('id', assetId)
      .maybeSingle()

    const asset = assetData as {
      id: string
      zone?: string
      zona?: string
      asset_class?: string
      price_eur_cents?: number
    } | null

    if (!asset) {
      log.info('[capitalAllocationAdvisor] batchRecommend: asset not found', { assetId })
      continue
    }

    try {
      const rec = await recommendAllocation({
        investor_id: investorId,
        asset_id: assetId,
        zone: asset.zone ?? asset.zona ?? 'unknown',
        asset_class: asset.asset_class ?? 'residential',
        listed_price_eur_cents: asset.price_eur_cents ?? 0,
        tenant_id: tenantId,
      })
      results.push(rec)
    } catch (e) {
      console.warn('[capitalAllocationAdvisor] batchRecommend error', e)
    }
  }

  return results
}

// ─── getRecommendationHistory ─────────────────────────────────────────────────

/**
 * Returns the last 20 allocation recommendations for an investor.
 */
export async function getRecommendationHistory(
  investorId: string,
  tenantId: string,
): Promise<AllocationRecommendation[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('allocation_recommendations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .order('generated_at', { ascending: false })
    .limit(20)

  if (error) {
    log.info('[capitalAllocationAdvisor] getRecommendationHistory error', { error: error.message })
    return []
  }

  return (data ?? []) as AllocationRecommendation[]
}
