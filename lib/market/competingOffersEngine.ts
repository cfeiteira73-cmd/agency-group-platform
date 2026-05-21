// =============================================================================
// Agency Group — Competing Offers & Price Pressure Engine
// lib/market/competingOffersEngine.ts
//
// Simulates win probability per bid, fair value estimates, and price pressure.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetingOffer {
  investor_id: string
  bid_price_eur: number
  yield_target_pct: number
  urgency_level: string
  win_probability: number
  rank: number
  price_gap_to_leader_eur: number
  price_gap_to_leader_pct: number
  recommended_counter_bid_eur: number
}

export interface PricePressureResult {
  property_id: string
  ask_price_eur: number
  fair_value_estimate_eur: number
  price_pressure_index: number
  time_to_close_estimate_days: number
  offers: CompetingOffer[]
  market_verdict: 'sellers_market' | 'balanced' | 'buyers_market'
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  id: string
  investor_id: string
  bid_price_eur: number
  yield_target_pct: number
  urgency_level: string
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const URGENCY_DAYS: Record<string, number> = {
  immediate:  7,
  within_30d: 25,
  within_90d: 60,
  flexible:   120,
}

function rawWinProb(rank: number): number {
  if (rank === 1) return 0.65
  if (rank === 2) return 0.25
  if (rank === 3) return 0.08
  return 0.02 / (rank - 3)
}

// ─── computePricePressure ────────────────────────────────────────────────────

export async function computePricePressure(
  tenantId: string,
  propertyId: string,
): Promise<PricePressureResult> {
  const db = supabaseAdmin as any

  const empty: PricePressureResult = {
    property_id:                propertyId,
    ask_price_eur:              0,
    fair_value_estimate_eur:    0,
    price_pressure_index:       0,
    time_to_close_estimate_days: 0,
    offers:                     [],
    market_verdict:             'balanced',
  }

  try {
    // ── 1. Fetch property ask price ───────────────────────────────────────────
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('preco')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !propRaw) {
      log.warn('[CompetingOffersEngine] property not found', { property_id: propertyId })
      return empty
    }

    const askPrice: number = (propRaw as { preco: number | null }).preco ?? 0

    // ── 2. Fetch active bids ──────────────────────────────────────────────────
    const { data: bidsRaw, error: bidsErr } = await db
      .from('investor_bids')
      .select('id, investor_id, bid_price_eur, yield_target_pct, urgency_level')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('bid_price_eur', { ascending: false })

    if (bidsErr) {
      log.warn('[CompetingOffersEngine] failed to load bids', { error: bidsErr.message })
      return { ...empty, ask_price_eur: askPrice }
    }

    const bids = (bidsRaw ?? []) as BidRow[]

    if (bids.length === 0) {
      return {
        property_id:                propertyId,
        ask_price_eur:              askPrice,
        fair_value_estimate_eur:    askPrice,
        price_pressure_index:       100,
        time_to_close_estimate_days: 120,
        offers:                     [],
        market_verdict:             'buyers_market',
      }
    }

    const N = bids.length

    // ── 3. Raw win probabilities ──────────────────────────────────────────────
    const rawProbs = bids.map((_, i) => rawWinProb(i + 1))
    const probSum  = rawProbs.reduce((s, p) => s + p, 0)
    const normProbs = rawProbs.map(p => Math.round((p / probSum) * 10000) / 10000)

    // ── 4. Fair value estimate (avg of top min(3,N) bids) ────────────────────
    const topBids    = bids.slice(0, Math.min(3, N))
    const fairValue  = topBids.reduce((s, b) => s + b.bid_price_eur, 0) / topBids.length

    // ── 5. Price pressure index ───────────────────────────────────────────────
    const pricePressureIndex = Math.round((fairValue / Math.max(1, askPrice)) * 100 * 100) / 100

    // ── 6. Time to close estimate (weighted avg by urgency) ──────────────────
    let weightedDays    = 0
    let weightedProb    = 0
    for (let i = 0; i < N; i++) {
      const days  = URGENCY_DAYS[bids[i]!.urgency_level] ?? 90
      weightedDays += days * normProbs[i]!
      weightedProb += normProbs[i]!
    }
    const timeToClose = weightedProb > 0
      ? Math.round(weightedDays / weightedProb)
      : 90

    // ── 7. Market verdict ─────────────────────────────────────────────────────
    let market_verdict: PricePressureResult['market_verdict']
    if (pricePressureIndex > 110)      market_verdict = 'sellers_market'
    else if (pricePressureIndex >= 90) market_verdict = 'balanced'
    else                               market_verdict = 'buyers_market'

    // ── 8. Assemble offers ────────────────────────────────────────────────────
    const leaderBid = bids[0]!.bid_price_eur

    const offers: CompetingOffer[] = bids.map((b, i) => {
      const priceGapEur = leaderBid - b.bid_price_eur
      const priceGapPct = leaderBid > 0
        ? Math.round((priceGapEur / leaderBid) * 10000) / 100
        : 0
      const counterBid  = i === 0
        ? b.bid_price_eur
        : Math.round(leaderBid * 1.01)

      return {
        investor_id:                 b.investor_id,
        bid_price_eur:               b.bid_price_eur,
        yield_target_pct:            b.yield_target_pct,
        urgency_level:               b.urgency_level,
        win_probability:             normProbs[i]!,
        rank:                        i + 1,
        price_gap_to_leader_eur:     priceGapEur,
        price_gap_to_leader_pct:     priceGapPct,
        recommended_counter_bid_eur: counterBid,
      }
    })

    return {
      property_id:                propertyId,
      ask_price_eur:              askPrice,
      fair_value_estimate_eur:    Math.round(fairValue * 100) / 100,
      price_pressure_index:       pricePressureIndex,
      time_to_close_estimate_days: timeToClose,
      offers,
      market_verdict,
    }
  } catch (err) {
    log.warn('[CompetingOffersEngine] computePricePressure exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return empty
  }
}
