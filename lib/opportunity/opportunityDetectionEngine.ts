// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Opportunity Detection Engine (Wave 42)
// lib/opportunity/opportunityDetectionEngine.ts
//
// Detects and classifies investment opportunities from canonical assets.
// Identifies 6 opportunity types with composite scoring.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunityType =
  | 'UNDERVALUED_ASSET'
  | 'DISTRESSED_ASSET'
  | 'AUCTION_ARBITRAGE'
  | 'HIGH_LIQUIDITY_FLIP'
  | 'INSTITUTIONAL_MISPRICING'
  | 'CROSS_MARKET_ARBITRAGE'

export type OpportunityStatus =
  | 'ACTIVE'
  | 'CAPTURED'
  | 'EXPIRED'
  | 'INVALIDATED'
  | 'MONITORING'

export interface Opportunity {
  opportunity_id: string
  tenant_id: string
  asset_id: string
  opportunity_type: OpportunityType
  status: OpportunityStatus

  // Core scores (all 0–100)
  opportunity_score: number
  undervaluation_score: number
  liquidity_score: number
  urgency_score: number
  risk_score: number

  // Financial
  asking_price_eur_cents: number
  fair_value_eur_cents: number
  potential_gain_eur_cents: number
  commission_eur_cents: number
  roi_pct: number

  // Context
  market: string
  city: string
  property_type: string

  // Time
  detected_at: string
  expires_at: string
  captured_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value)
  return isFinite(n) ? n : fallback
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

// ─── computeOpportunityScore ──────────────────────────────────────────────────

/**
 * Pure function — implements the composite opportunity score formula.
 * investor_demand_component defaults to 50 until capital intel layer is injected.
 */
export function computeOpportunityScore(
  asset: Record<string, unknown>,
): { score: number; components: Record<string, number> } {
  const askingCents = toNum(asset.asking_price_eur_cents ?? (toNum(asset.price_eur) * 100))
  const fairCents   = toNum(asset.fair_value_eur_cents ?? (toNum(asset.valuation_eur) * 100))

  const undervaluation_pct =
    fairCents > 0 ? ((fairCents - askingCents) / fairCents) * 100 : 0

  const roi_pct =
    askingCents > 0
      ? ((fairCents - askingCents - fairCents * 0.05) / askingCents) * 100
      : 0

  // Components (each 0–100)
  const undervaluation_component = clamp((undervaluation_pct / 30) * 100, 0, 100)
  const liquidity_component      = clamp(toNum(asset.liquidity_score, 50), 0, 100)
  const investor_demand_component = clamp(toNum(asset.investor_demand_score, 50), 0, 100)
  const risk_adjusted_roi_component = clamp((roi_pct / 20) * 100, 0, 100)
  const source_confidence_component = clamp(
    toNum(asset.source_confidence, 0.7) * 100,
    0,
    100,
  )

  const weighted_sum =
    undervaluation_component * 0.30 +
    liquidity_component      * 0.25 +
    investor_demand_component * 0.20 +
    risk_adjusted_roi_component * 0.15 +
    source_confidence_component * 0.10

  const score = clamp(Math.round(weighted_sum * 100) / 100, 0, 100)

  return {
    score,
    components: {
      undervaluation_component,
      liquidity_component,
      investor_demand_component,
      risk_adjusted_roi_component,
      source_confidence_component,
    },
  }
}

// ─── classifyOpportunityType ──────────────────────────────────────────────────

/**
 * Pure function — classifies an asset into one of 6 opportunity types.
 */
export function classifyOpportunityType(
  asset: Record<string, unknown>,
): OpportunityType {
  const is_auction    = toBool(asset.is_auction)
  const is_distressed = toBool(asset.is_distressed)
  const askingCents   = toNum(asset.asking_price_eur_cents ?? (toNum(asset.price_eur) * 100))
  const fairCents     = toNum(asset.fair_value_eur_cents ?? (toNum(asset.valuation_eur) * 100))
  const liquidity     = toNum(asset.liquidity_score, 0)
  const size_sqm      = toNum(asset.size_sqm ?? asset.area_sqm, 999)

  const undervaluation_pct =
    fairCents > 0 ? ((fairCents - askingCents) / fairCents) * 100 : 0

  // Priority order
  if (is_auction) return 'AUCTION_ARBITRAGE'

  if (is_distressed) return 'DISTRESSED_ASSET'

  // CROSS_MARKET_ARBITRAGE — check external_price_benchmarks jsonb column
  const benchmarks = asset.external_price_benchmarks
  if (
    benchmarks &&
    typeof benchmarks === 'object' &&
    (benchmarks as Record<string, unknown>).arbitrage_opportunity === true
  ) {
    return 'CROSS_MARKET_ARBITRAGE'
  }

  // INSTITUTIONAL_MISPRICING — asking > €500K and undervalued > 10%
  if (askingCents > 500_000_00 && undervaluation_pct > 10) {
    return 'INSTITUTIONAL_MISPRICING'
  }

  // HIGH_LIQUIDITY_FLIP — liquidity > 70, undervalued > 8%, size < 150 sqm
  if (liquidity > 70 && undervaluation_pct > 8 && size_sqm < 150) {
    return 'HIGH_LIQUIDITY_FLIP'
  }

  // Default
  return 'UNDERVALUED_ASSET'
}

// ─── detectOpportunities ──────────────────────────────────────────────────────

/**
 * Reads canonical_assets for the given tenant, maps qualifying assets to
 * Opportunity objects, upserts to detected_opportunities.
 */
export async function detectOpportunities(
  tenantId: string,
  assetIds?: string[],
): Promise<Opportunity[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('canonical_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .or('opportunity_score.gt.40,is_distressed.eq.true')

    if (assetIds && assetIds.length > 0) {
      query = query.in('id', assetIds)
    }

    const { data: assets, error } = await query

    if (error) {
      log.error('[opportunityDetectionEngine] Failed to query canonical_assets', error, {
        route: 'detectOpportunities',
      })
      return []
    }

    if (!assets || assets.length === 0) return []

    const now = new Date()
    const opportunities: Opportunity[] = []

    for (const asset of assets as Record<string, unknown>[]) {
      try {
        const { score, components } = computeOpportunityScore(asset)

        // Skip if score below threshold and not distressed/auction
        if (score < 40 && !toBool(asset.is_distressed) && !toBool(asset.is_auction)) {
          continue
        }

        const opportunityType = classifyOpportunityType(asset)

        const askingCents = toNum(
          asset.asking_price_eur_cents ?? (toNum(asset.price_eur) * 100),
        )
        const fairCents = toNum(
          asset.fair_value_eur_cents ?? (toNum(asset.valuation_eur) * 100),
        )
        const commissionCents = Math.round(fairCents * 0.05)
        const potentialGainCents = fairCents - askingCents - commissionCents
        const roiPct =
          askingCents > 0 ? (potentialGainCents / askingCents) * 100 : 0

        const undervaluation_pct =
          fairCents > 0 ? ((fairCents - askingCents) / fairCents) * 100 : 0

        const undervaluation_score = clamp((undervaluation_pct / 30) * 100, 0, 100)
        const liquidity_score = clamp(toNum(asset.liquidity_score, 50), 0, 100)
        const risk_score = clamp(toNum(asset.risk_score, 50), 0, 100)

        // Urgency: decays with days on market
        const days_on_market = toNum(asset.days_on_market, 0)
        const urgency_score = clamp(
          100 * Math.exp(-days_on_market / 90),
          0,
          100,
        )

        // TTL: auctions expire in 7 days, others 30 days
        const urgency_ttl_days = toBool(asset.is_auction) ? 7 : 30
        const expires_at = new Date(
          now.getTime() + urgency_ttl_days * 24 * 60 * 60 * 1000,
        ).toISOString()

        const opportunity_id = randomUUID()
        const assetId = String(asset.id ?? asset.asset_id ?? '')

        const opportunity: Opportunity = {
          opportunity_id,
          tenant_id: tenantId,
          asset_id: assetId,
          opportunity_type: opportunityType,
          status: 'ACTIVE',
          opportunity_score: score,
          undervaluation_score,
          liquidity_score,
          urgency_score,
          risk_score,
          asking_price_eur_cents: askingCents,
          fair_value_eur_cents: fairCents,
          potential_gain_eur_cents: potentialGainCents,
          commission_eur_cents: commissionCents,
          roi_pct: roiPct,
          market: String(asset.market ?? asset.country ?? 'PT'),
          city: String(asset.city ?? asset.district ?? asset.zone ?? ''),
          property_type: String(asset.property_type ?? asset.typology ?? ''),
          detected_at: now.toISOString(),
          expires_at,
          captured_at: null,
        }

        // Upsert to detected_opportunities
        const { error: upsertError } = await (supabaseAdmin as any)
          .from('detected_opportunities')
          .upsert(
            {
              opportunity_id: opportunity.opportunity_id,
              tenant_id: opportunity.tenant_id,
              asset_id: opportunity.asset_id,
              opportunity_type: opportunity.opportunity_type,
              status: opportunity.status,
              opportunity_score: opportunity.opportunity_score,
              undervaluation_score: opportunity.undervaluation_score,
              liquidity_score: opportunity.liquidity_score,
              urgency_score: opportunity.urgency_score,
              risk_score: opportunity.risk_score,
              asking_price_eur_cents: opportunity.asking_price_eur_cents,
              fair_value_eur_cents: opportunity.fair_value_eur_cents,
              potential_gain_eur_cents: opportunity.potential_gain_eur_cents,
              commission_eur_cents: opportunity.commission_eur_cents,
              roi_pct: opportunity.roi_pct,
              market: opportunity.market,
              city: opportunity.city,
              property_type: opportunity.property_type,
              detected_at: opportunity.detected_at,
              expires_at: opportunity.expires_at,
              captured_at: opportunity.captured_at,
            },
            { onConflict: 'tenant_id,asset_id' },
          )

        if (upsertError) {
          log.warn('[opportunityDetectionEngine] Upsert failed for asset', {
            asset_id: assetId,
            error: String(upsertError),
          })
        } else {
          opportunities.push(opportunity)
        }

        // Attach score components to log (non-blocking)
        log.info('[opportunityDetectionEngine] Detected opportunity', {
          opportunity_id,
          asset_id: assetId,
          opportunity_type: opportunityType,
          score,
          undervaluation_component: components.undervaluation_component,
        })
      } catch (assetErr) {
        log.warn('[opportunityDetectionEngine] Error processing asset', {
          asset_id: String((asset as Record<string, unknown>).id ?? ''),
          error: String(assetErr),
        })
      }
    }

    return opportunities
  } catch (err) {
    log.error('[opportunityDetectionEngine] detectOpportunities failed', err)
    return []
  }
}

// ─── getActiveOpportunities ───────────────────────────────────────────────────

export async function getActiveOpportunities(
  tenantId: string,
  filters?: {
    market?: string
    city?: string
    type?: OpportunityType
    min_score?: number
    limit?: number
  },
): Promise<Opportunity[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('detected_opportunities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .order('opportunity_score', { ascending: false })

    if (filters?.market) query = query.eq('market', filters.market)
    if (filters?.city)   query = query.eq('city', filters.city)
    if (filters?.type)   query = query.eq('opportunity_type', filters.type)
    if (filters?.min_score != null) {
      query = query.gte('opportunity_score', filters.min_score)
    }
    query = query.limit(filters?.limit ?? 100)

    const { data, error } = await query

    if (error) {
      log.error('[opportunityDetectionEngine] getActiveOpportunities failed', error)
      return []
    }

    return (data ?? []) as Opportunity[]
  } catch (err) {
    log.error('[opportunityDetectionEngine] getActiveOpportunities error', err)
    return []
  }
}

// ─── expireStaleOpportunities ─────────────────────────────────────────────────

export async function expireStaleOpportunities(
  tenantId: string,
): Promise<{ expired: number }> {
  try {
    const now = new Date().toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('detected_opportunities')
      .update({ status: 'EXPIRED' })
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .lt('expires_at', now)
      .select('opportunity_id')

    if (error) {
      log.error('[opportunityDetectionEngine] expireStaleOpportunities failed', error)
      return { expired: 0 }
    }

    const expired = (data ?? []).length
    log.info('[opportunityDetectionEngine] Expired stale opportunities', {
      tenant_id: tenantId,
      expired,
    })

    return { expired }
  } catch (err) {
    log.error('[opportunityDetectionEngine] expireStaleOpportunities error', err)
    return { expired: 0 }
  }
}

// ─── runDetectionCycle ────────────────────────────────────────────────────────

export async function runDetectionCycle(
  tenantId: string,
): Promise<{ detected: number; expired: number; total_active: number }> {
  const [detected_list, expireResult] = await Promise.all([
    detectOpportunities(tenantId),
    expireStaleOpportunities(tenantId),
  ])

  const detected = detected_list.length
  const expired  = expireResult.expired

  // Count total active
  let total_active = 0
  try {
    const { count, error } = await (supabaseAdmin as any)
      .from('detected_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')

    if (!error) total_active = count ?? 0
  } catch {
    // non-fatal
  }

  // Persist cycle log (fire-and-forget)
  void (supabaseAdmin as any)
    .from('detection_cycle_logs')
    .insert({
      tenant_id: tenantId,
      detected,
      expired,
      total_active,
      run_at: new Date().toISOString(),
    })
    .catch((e: unknown) => console.warn('[opportunityDetectionEngine] cycle log insert', e))

  log.info('[opportunityDetectionEngine] Detection cycle complete', {
    tenant_id: tenantId,
    detected,
    expired,
    total_active,
  })

  return { detected, expired, total_active }
}
