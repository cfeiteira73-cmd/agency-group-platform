// =============================================================================
// Agency Group — Capital Bidding Simulation Engine
// lib/investors/capitalBidding.ts
//
// Simulates multi-investor bidding on a property to estimate market clearing
// price, competitive premium, and recommended list price.
//
// Bidding model:
//   Institutional: bid 0–3% above asking (disciplined)
//   Premium:       bid asking ± 5%
//   Standard:      bid asking ± 10%
// Market clearing = median of top 3 bids
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BidSimulation {
  property_id:      string
  tenant_id:        string
  asking_price_eur: number

  bids: Array<{
    investor_id:          string
    simulated_bid_eur:    number
    bid_confidence:       number    // probability they would actually bid at this price
    yield_expectation_pct: number
    financing_type:       'cash' | 'mortgage' | 'institutional'
  }>

  market_clearing_price_eur:        number
  expected_competitive_premium_pct: number   // % above asking due to competition
  recommended_list_price_eur:       number

  computed_at: string
}

// ─── Internal DB row shapes ────────────────────────────────────────────────────

interface InvestorRow {
  id:               string
  investor_type:    string | null
  capital_max_eur:  number | null
  yield_target_pct: number | null
  risk_tolerance:   string | null
}

interface EngagementRow {
  investor_id:  string
  event_type:   string
}

interface MatchRow {
  investor_id:  string
  match_score:  number
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Seeded pseudo-random number in [0, 1) — deterministic per investor+property.
 * Uses djb2 hash so results are stable for the same inputs.
 */
function seededRandom(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i)
    h = h >>> 0
  }
  return (h % 10000) / 10000
}

function resolveFinancingType(
  investorType: string | null,
  capitalEur:   number,
  priceEur:     number,
): BidSimulation['bids'][number]['financing_type'] {
  if (investorType === 'institution' || investorType === 'fund') return 'institutional'
  if (capitalEur >= priceEur * 1.2)                               return 'cash'
  return 'mortgage'
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid    = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

// ─── simulateBidding ─────────────────────────────────────────────────────────

/**
 * Simulate competitive bidding for a property from its matched investor pool.
 */
export async function simulateBidding(
  propertyId: string,
  tenantId:   string,
): Promise<BidSimulation> {
  const db = supabaseAdmin as any

  const fallback: BidSimulation = {
    property_id:                      propertyId,
    tenant_id:                        tenantId,
    asking_price_eur:                 0,
    bids:                             [],
    market_clearing_price_eur:        0,
    expected_competitive_premium_pct: 0,
    recommended_list_price_eur:       0,
    computed_at:                      new Date().toISOString(),
  }

  try {
    // ── 1. Load property price ────────────────────────────────────────────────
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('preco')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !propRaw) {
      log.error('[CapitalBidding] property not found', undefined, { error: propErr?.message, property_id: propertyId })
      return fallback
    }

    const askingPrice: number = (propRaw as { preco: number }).preco ?? 0
    if (askingPrice <= 0) return { ...fallback, asking_price_eur: askingPrice }

    // ── 2. Load top matched investors for this property ───────────────────────
    const { data: matchRaw, error: matchErr } = await db
      .from('investor_matches')
      .select('investor_id, match_score')
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId)
      .gte('match_score', 50)
      .order('match_score', { ascending: false })
      .limit(20)

    if (matchErr) {
      log.error('[CapitalBidding] failed to load matches', undefined, { error: matchErr.message })
      return { ...fallback, asking_price_eur: askingPrice }
    }

    const matchRows = (matchRaw ?? []) as MatchRow[]
    if (matchRows.length === 0) {
      return { ...fallback, asking_price_eur: askingPrice }
    }

    const investorIds = matchRows.map(r => r.investor_id)

    // ── 3. Load investor profiles ─────────────────────────────────────────────
    const { data: invRaw, error: invErr } = await db
      .from('investors')
      .select('id, investor_type, capital_max_eur, yield_target_pct, risk_tolerance')
      .in('id', investorIds)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (invErr) {
      log.error('[CapitalBidding] failed to load investors', undefined, { error: invErr.message })
      return { ...fallback, asking_price_eur: askingPrice }
    }

    const invMap = new Map<string, InvestorRow>(
      ((invRaw ?? []) as InvestorRow[]).map(r => [r.id, r]),
    )

    // ── 4. Load recent engagement to gauge urgency/demand ─────────────────────
    const { data: engRaw } = await db
      .from('investor_engagement_events')
      .select('investor_id, event_type')
      .eq('tenant_id', tenantId)
      .in('investor_id', investorIds)
      .in('event_type', ['match_viewed', 'property_saved', 'offer_made'])

    const engRows       = (engRaw ?? []) as EngagementRow[]
    const savedSet      = new Set(engRows.filter(e => e.event_type === 'property_saved').map(e => e.investor_id))
    const offerSet      = new Set(engRows.filter(e => e.event_type === 'offer_made').map(e => e.investor_id))

    // ── 5. Simulate bids per investor ─────────────────────────────────────────
    const bids: BidSimulation['bids'] = []

    for (const match of matchRows) {
      const profile = invMap.get(match.investor_id)
      if (!profile) continue

      const capitalEur     = profile.capital_max_eur ?? 0
      if (capitalEur < askingPrice * 0.5) continue   // insufficient capital — skip

      const invType        = profile.investor_type
      const seed           = `${propertyId}-${match.investor_id}`
      const rng            = seededRandom(seed)     // 0–1 deterministic

      // ── Bid multiplier by tier ────────────────────────────────────────────────
      let bidMultiplier: number
      if (invType === 'institution' || invType === 'fund') {
        // Institutional: 0–3% above asking (disciplined)
        bidMultiplier = 1.0 + rng * 0.03
      } else if (invType === 'family_office') {
        // Premium: asking ± 5%
        bidMultiplier = 0.95 + rng * 0.10
      } else {
        // Standard: asking ± 10%
        bidMultiplier = 0.90 + rng * 0.20
      }

      // ── Urgency adjustment (saved / previously offered) ───────────────────────
      if (savedSet.has(match.investor_id))  bidMultiplier += 0.02
      if (offerSet.has(match.investor_id))  bidMultiplier += 0.03

      // ── Match score adjustment ────────────────────────────────────────────────
      bidMultiplier += (match.match_score / 100 - 0.5) * 0.02

      const simulated_bid_eur = Math.round(askingPrice * bidMultiplier)

      // ── Bid confidence ────────────────────────────────────────────────────────
      // Probability the investor would actually place a bid
      let bid_confidence = 0.3 + (match.match_score / 100) * 0.4
      if (savedSet.has(match.investor_id)) bid_confidence += 0.1
      if (offerSet.has(match.investor_id)) bid_confidence += 0.2
      bid_confidence = Math.min(0.95, bid_confidence)

      // ── Yield expectation ─────────────────────────────────────────────────────
      const yield_expectation_pct = profile.yield_target_pct ?? (
        invType === 'institution' ? 5.0 :
        invType === 'family_office' ? 6.0 : 7.0
      )

      const financing_type = resolveFinancingType(invType, capitalEur, askingPrice)

      bids.push({
        investor_id:           match.investor_id,
        simulated_bid_eur,
        bid_confidence:        Math.round(bid_confidence * 100) / 100,
        yield_expectation_pct,
        financing_type,
      })
    }

    // Sort bids descending
    bids.sort((a, b) => b.simulated_bid_eur - a.simulated_bid_eur)

    // ── 6. Market clearing price = median of top 3 bids ──────────────────────
    const top3 = bids.slice(0, 3).map(b => b.simulated_bid_eur)
    const market_clearing_price_eur = Math.round(median(top3))

    // ── 7. Competitive premium ────────────────────────────────────────────────
    const premium_raw = (market_clearing_price_eur - askingPrice) / askingPrice
    const expected_competitive_premium_pct = Math.round(premium_raw * 10000) / 100  // 2dp %

    // ── 8. Recommended list price ─────────────────────────────────────────────
    // If strong competition: recommend slightly above asking to capture premium
    // If weak: recommend at asking or a nudge below for velocity
    let recommended_list_price_eur: number
    if (bids.length >= 3 && expected_competitive_premium_pct > 2) {
      // Market supports a premium — list 1% above asking
      recommended_list_price_eur = Math.round(askingPrice * 1.01)
    } else if (bids.length < 2) {
      // Low competition — suggest 3% below asking for velocity
      recommended_list_price_eur = Math.round(askingPrice * 0.97)
    } else {
      recommended_list_price_eur = askingPrice
    }

    return {
      property_id:                      propertyId,
      tenant_id:                        tenantId,
      asking_price_eur:                 askingPrice,
      bids,
      market_clearing_price_eur,
      expected_competitive_premium_pct,
      recommended_list_price_eur,
      computed_at:                      new Date().toISOString(),
    }
  } catch (err) {
    log.error(
      '[CapitalBidding] simulateBidding exception',
      err instanceof Error ? err : undefined,
      { error: err instanceof Error ? err.message : String(err), property_id: propertyId },
    )
    return fallback
  }
}
