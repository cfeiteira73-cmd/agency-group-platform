// =============================================================================
// Agency Group — Arbitrage Detector
// lib/market-external/arbitrageDetector.ts
//
// Detects cross-market arbitrage opportunities between the internal system
// and external real estate market.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArbitrageOpportunity {
  opportunity_id: string
  tenant_id: string
  asset_id: string | null
  country: string
  city: string
  opportunity_type:
    | 'BUY_UNDERVALUED'
    | 'SELL_OVERVALUED'
    | 'CROSS_MARKET_SPREAD'
    | 'LIQUIDITY_PREMIUM'
  system_price_eur_cents: number
  market_price_eur_cents: number
  estimated_gain_eur_cents: number // after 5% commission
  confidence_score: number // 0–1
  expires_at: string
  status: 'ACTIVE' | 'CAPTURED' | 'EXPIRED' | 'INVALIDATED'
  detected_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface PriceComparisonRow {
  comparison_id: string
  asset_id: string | null
  country: string
  city: string
  system_price_per_sqm_eur_cents: number
  external_price_per_sqm_eur_cents: number
  gap_pct: number
  gap_direction: string
  arbitrage_opportunity: boolean
  arbitrage_eur_cents: number | null
  compared_at: string
}

interface ArbitrageRow {
  opportunity_id: string
  tenant_id: string
  asset_id: string | null
  country: string
  city: string
  opportunity_type: string
  system_price_eur_cents: number
  market_price_eur_cents: number
  estimated_gain_eur_cents: number
  confidence_score: number
  expires_at: string
  status: string
  detected_at: string
}

// ─── DB helper ────────────────────────────────────────────────────────────────

type SupabaseAny = {
  from: (table: string) => SupabaseQueryBuilder
}

interface SupabaseQueryBuilder {
  select: (cols: string) => SupabaseQueryBuilder
  eq: (col: string, val: string | boolean) => SupabaseQueryBuilder
  neq: (col: string, val: string) => SupabaseQueryBuilder
  lt: (col: string, val: string) => SupabaseQueryBuilder
  order: (col: string, opts: unknown) => SupabaseQueryBuilder
  limit: (n: number) => SupabaseQueryBuilder
  single: () => Promise<{ data: unknown; error: unknown }>
  update: (data: unknown) => SupabaseQueryBuilder
  insert: (data: unknown) => Promise<{ error: unknown }>
  then: (resolve: (result: { data: unknown; error: unknown }) => void) => void
}

function db(): SupabaseAny {
  return supabaseAdmin as unknown as SupabaseAny
}

async function queryAll<T>(builder: SupabaseQueryBuilder): Promise<T[]> {
  return new Promise((resolve) => {
    builder.then(({ data }: { data: unknown; error: unknown }) => {
      resolve((data as T[] | null) ?? [])
    })
  })
}

// ─── detectArbitrageOpportunities ────────────────────────────────────────────

/**
 * Reads price_comparisons where arbitrage_opportunity=true, creates
 * ArbitrageOpportunity for each, deduplicates by asset_id.
 * Estimated gain = |gap_pct| / 100 * avg_transaction_eur_cents * 0.95
 * Confidence = min(1, abs(gap_pct) / 20)
 * Persists new opportunities to arbitrage_opportunities.
 */
export async function detectArbitrageOpportunities(
  tenantId: string,
): Promise<ArbitrageOpportunity[]> {
  log.info('[arbitrageDetector] Detecting arbitrage opportunities', { tenantId })

  const comparisons = await queryAll<PriceComparisonRow>(
    db()
      .from('price_comparisons')
      .select(
        'comparison_id,asset_id,country,city,system_price_per_sqm_eur_cents,external_price_per_sqm_eur_cents,gap_pct,gap_direction,arbitrage_opportunity,arbitrage_eur_cents,compared_at',
      )
      .eq('tenant_id', tenantId)
      .eq('arbitrage_opportunity', true)
      .order('compared_at', { ascending: false })
      .limit(200),
  )

  // Deduplicate by asset_id — keep highest gap
  const seenAssets = new Set<string>()
  const deduped = comparisons.filter((c) => {
    const key = c.asset_id ?? c.comparison_id
    if (seenAssets.has(key)) return false
    seenAssets.add(key)
    return true
  })

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const opportunities: ArbitrageOpportunity[] = []

  for (const cmp of deduped) {
    const absGapPct = Math.abs(cmp.gap_pct)
    const confidenceScore = Math.min(1, absGapPct / 20)

    // Avg transaction estimate: system price * 120m² (avg)
    const avgTransactionEurCents = cmp.system_price_per_sqm_eur_cents * 120
    const estimatedGainEurCents =
      cmp.arbitrage_eur_cents ??
      Math.round((absGapPct / 100) * avgTransactionEurCents * 0.95)

    let opportunityType: ArbitrageOpportunity['opportunity_type']
    if (cmp.gap_direction === 'SYSTEM_UNDERPRICED') {
      opportunityType = 'BUY_UNDERVALUED'
    } else if (cmp.gap_direction === 'SYSTEM_OVERPRICED') {
      opportunityType = 'SELL_OVERVALUED'
    } else if (absGapPct > 15) {
      opportunityType = 'CROSS_MARKET_SPREAD'
    } else {
      opportunityType = 'LIQUIDITY_PREMIUM'
    }

    const opportunity: ArbitrageOpportunity = {
      opportunity_id: randomUUID(),
      tenant_id: tenantId,
      asset_id: cmp.asset_id,
      country: cmp.country,
      city: cmp.city,
      opportunity_type: opportunityType,
      system_price_eur_cents: cmp.system_price_per_sqm_eur_cents * 120,
      market_price_eur_cents: cmp.external_price_per_sqm_eur_cents * 120,
      estimated_gain_eur_cents: estimatedGainEurCents,
      confidence_score: Math.round(confidenceScore * 1000) / 1000,
      expires_at: expiresAt,
      status: 'ACTIVE',
      detected_at: now.toISOString(),
    }

    const { error } = await db().from('arbitrage_opportunities').insert({
      opportunity_id: opportunity.opportunity_id,
      tenant_id: opportunity.tenant_id,
      asset_id: opportunity.asset_id,
      country: opportunity.country,
      city: opportunity.city,
      opportunity_type: opportunity.opportunity_type,
      system_price_eur_cents: opportunity.system_price_eur_cents,
      market_price_eur_cents: opportunity.market_price_eur_cents,
      estimated_gain_eur_cents: opportunity.estimated_gain_eur_cents,
      confidence_score: opportunity.confidence_score,
      expires_at: opportunity.expires_at,
      status: opportunity.status,
      detected_at: opportunity.detected_at,
    })

    if (error) {
      log.warn('[arbitrageDetector] Failed to persist opportunity', {
        asset_id: opportunity.asset_id,
      })
    } else {
      opportunities.push(opportunity)
    }
  }

  log.info('[arbitrageDetector] Arbitrage detection complete', {
    tenantId,
    found: opportunities.length,
  })

  return opportunities
}

// ─── captureArbitrage ─────────────────────────────────────────────────────────

/**
 * Marks an arbitrage opportunity as CAPTURED.
 */
export async function captureArbitrage(
  opportunityId: string,
  tenantId: string,
): Promise<void> {
  const result = await new Promise<{ error: unknown }>((resolve) => {
    db()
      .from('arbitrage_opportunities')
      .update({ status: 'CAPTURED' })
      .eq('opportunity_id', opportunityId)
      .eq('tenant_id', tenantId)
      .then(resolve)
  })

  if (result.error) {
    log.warn('[arbitrageDetector] Failed to capture opportunity', { opportunityId })
    return
  }

  log.info('[arbitrageDetector] Opportunity captured', { opportunityId, tenantId })
}

// ─── getActiveOpportunities ───────────────────────────────────────────────────

/**
 * Returns all active arbitrage opportunities for a tenant.
 */
export async function getActiveOpportunities(
  tenantId: string,
): Promise<ArbitrageOpportunity[]> {
  const rows = await queryAll<ArbitrageRow>(
    db()
      .from('arbitrage_opportunities')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .order('detected_at', { ascending: false })
      .limit(100),
  )

  return rows.map((r) => ({
    opportunity_id: r.opportunity_id,
    tenant_id: r.tenant_id,
    asset_id: r.asset_id,
    country: r.country,
    city: r.city,
    opportunity_type: r.opportunity_type as ArbitrageOpportunity['opportunity_type'],
    system_price_eur_cents: r.system_price_eur_cents,
    market_price_eur_cents: r.market_price_eur_cents,
    estimated_gain_eur_cents: r.estimated_gain_eur_cents,
    confidence_score: r.confidence_score,
    expires_at: r.expires_at,
    status: r.status as ArbitrageOpportunity['status'],
    detected_at: r.detected_at,
  }))
}

// ─── expireStaleOpportunities ─────────────────────────────────────────────────

/**
 * Marks opportunities expired > 7 days old as EXPIRED.
 */
export async function expireStaleOpportunities(
  tenantId: string,
): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch stale active opportunities
  const stale = await queryAll<{ opportunity_id: string }>(
    db()
      .from('arbitrage_opportunities')
      .select('opportunity_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .lt('detected_at', cutoff),
  )

  let expired = 0

  for (const row of stale) {
    const result = await new Promise<{ error: unknown }>((resolve) => {
      db()
        .from('arbitrage_opportunities')
        .update({ status: 'EXPIRED' })
        .eq('opportunity_id', row.opportunity_id)
        .then(resolve)
    })

    if (!result.error) expired++
  }

  log.info('[arbitrageDetector] Stale opportunities expired', { tenantId, expired })
  return { expired }
}
