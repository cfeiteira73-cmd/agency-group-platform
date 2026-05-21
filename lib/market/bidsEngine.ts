// =============================================================================
// Agency Group — Real-Time Bid Book Engine
// lib/market/bidsEngine.ts
//
// Manages real-time bid books per property: submission, scoring, withdrawal,
// and materialized bid_books snapshot table.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvestorBid {
  id: string
  tenant_id: string
  property_id: string
  investor_id: string
  max_price_eur: number
  yield_target_pct: number
  urgency_level: 'immediate' | 'within_30d' | 'within_90d' | 'flexible'
  risk_tolerance: 'low' | 'medium' | 'high' | 'opportunistic'
  bid_price_eur: number
  bid_score: number
  status: 'active' | 'withdrawn' | 'accepted' | 'outbid'
  submitted_at: string
  expires_at: string
}

export interface BidBook {
  property_id: string
  tenant_id: string
  total_bids: number
  active_bids: number
  highest_bid_eur: number
  lowest_bid_eur: number
  avg_bid_eur: number
  demand_pressure_score: number
  competitive_intensity: number
  bid_spread_pct: number
  capital_committed_eur: number
  bids: InvestorBid[]
}

export interface SubmitBidParams {
  max_price_eur: number
  yield_target_pct: number
  urgency_level: InvestorBid['urgency_level']
  risk_tolerance: InvestorBid['risk_tolerance']
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const URGENCY_MULTIPLIERS: Record<InvestorBid['urgency_level'], number> = {
  immediate:  1.05,
  within_30d: 1.02,
  within_90d: 1.00,
  flexible:   0.97,
}

const URGENCY_PTS: Record<InvestorBid['urgency_level'], number> = {
  immediate:  25,
  within_30d: 20,
  within_90d: 15,
  flexible:   10,
}

const RISK_PTS: Record<InvestorBid['risk_tolerance'], number> = {
  opportunistic: 25,
  high:          20,
  medium:        15,
  low:           10,
}

function computeBidScore(
  bidPriceEur: number,
  askPrice: number,
  urgencyLevel: InvestorBid['urgency_level'],
  riskTolerance: InvestorBid['risk_tolerance'],
): number {
  const priceRatio  = Math.min(2, bidPriceEur / Math.max(1, askPrice))
  const urgencyPts  = URGENCY_PTS[urgencyLevel]
  const riskPts     = RISK_PTS[riskTolerance]
  const raw         = (priceRatio * 25) + urgencyPts * 0.3 + riskPts * 0.3
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100))
}

// ─── Internal: refresh materialized bid_books snapshot ───────────────────────

async function _refreshBidBook(tenantId: string, propertyId: string): Promise<void> {
  const db = supabaseAdmin as any

  try {
    const { data: bidsRaw, error: bidsErr } = await db
      .from('investor_bids')
      .select('id, bid_price_eur, status')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)

    if (bidsErr) {
      log.warn('[BidsEngine] _refreshBidBook: failed to load bids', { error: bidsErr.message })
      return
    }

    const allBids  = (bidsRaw ?? []) as { id: string; bid_price_eur: number; status: string }[]
    const active   = allBids.filter(b => b.status === 'active')
    const total    = allBids.length
    const actCount = active.length

    const prices = active.map(b => b.bid_price_eur)
    const highest = prices.length > 0 ? Math.max(...prices) : 0
    const lowest  = prices.length > 0 ? Math.min(...prices) : 0
    const avg     = prices.length > 0
      ? prices.reduce((s, p) => s + p, 0) / prices.length
      : 0

    const demand_pressure_score  = Math.min(100, actCount * 15)
    const competitive_intensity  = Math.min(100, actCount * 20)
    const bid_spread_pct         = actCount > 1 ? (highest - lowest) / highest * 100 : 0
    const capital_committed_eur  = prices.reduce((s, p) => s + p, 0)

    void (db
      .from('bid_books')
      .upsert(
        {
          tenant_id:             tenantId,
          property_id:           propertyId,
          total_bids:            total,
          active_bids:           actCount,
          highest_bid_eur:       highest,
          lowest_bid_eur:        lowest,
          avg_bid_eur:           Math.round(avg * 100) / 100,
          demand_pressure_score: Math.round(demand_pressure_score * 100) / 100,
          competitive_intensity: Math.round(competitive_intensity * 100) / 100,
          bid_spread_pct:        Math.round(bid_spread_pct * 100) / 100,
          capital_committed_eur,
          updated_at:            new Date().toISOString(),
        },
        { onConflict: 'tenant_id,property_id' },
      )
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          log.warn('[BidsEngine] bid_books upsert failed', { error: error.message })
        }
      }) as Promise<unknown>)
  } catch (err) {
    log.warn('[BidsEngine] _refreshBidBook exception', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── submitBid ────────────────────────────────────────────────────────────────

export async function submitBid(
  tenantId: string,
  propertyId: string,
  investorId: string,
  params: SubmitBidParams,
): Promise<InvestorBid | null> {
  const db = supabaseAdmin as any

  try {
    const { max_price_eur, yield_target_pct, urgency_level, risk_tolerance } = params

    // Fetch property ask price
    const { data: propRaw } = await db
      .from('properties')
      .select('preco')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    const askPrice: number = (propRaw as { preco: number | null } | null)?.preco ?? max_price_eur

    const urgencyMultiplier = URGENCY_MULTIPLIERS[urgency_level]
    const bid_price_eur     = Math.round(max_price_eur * urgencyMultiplier)
    const bid_score         = computeBidScore(bid_price_eur, askPrice, urgency_level, risk_tolerance)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const now = new Date().toISOString()

    // Mark any existing active bid by same investor on same property as outbid
    void (db
      .from('investor_bids')
      .update({ status: 'outbid' })
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('investor_id', investorId)
      .eq('status', 'active')
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) log.warn('[BidsEngine] outbid update failed', { error: error.message })
      }) as Promise<unknown>)

    const { data: inserted, error: insertErr } = await db
      .from('investor_bids')
      .insert({
        tenant_id:        tenantId,
        property_id:      propertyId,
        investor_id:      investorId,
        max_price_eur,
        yield_target_pct,
        urgency_level,
        risk_tolerance,
        bid_price_eur,
        bid_score,
        status:           'active',
        submitted_at:     now,
        expires_at:       expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      log.warn('[BidsEngine] submitBid insert failed', { error: insertErr?.message })
      return null
    }

    void _refreshBidBook(tenantId, propertyId)

    return inserted as InvestorBid
  } catch (err) {
    log.warn('[BidsEngine] submitBid exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ─── getBidBook ───────────────────────────────────────────────────────────────

export async function getBidBook(tenantId: string, propertyId: string): Promise<BidBook> {
  const db = supabaseAdmin as any

  const empty: BidBook = {
    property_id:           propertyId,
    tenant_id:             tenantId,
    total_bids:            0,
    active_bids:           0,
    highest_bid_eur:       0,
    lowest_bid_eur:        0,
    avg_bid_eur:           0,
    demand_pressure_score: 0,
    competitive_intensity: 0,
    bid_spread_pct:        0,
    capital_committed_eur: 0,
    bids:                  [],
  }

  try {
    const { data: bidsRaw, error } = await db
      .from('investor_bids')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('bid_price_eur', { ascending: false })

    if (error) {
      log.warn('[BidsEngine] getBidBook query failed', { error: error.message })
      return empty
    }

    const bids        = (bidsRaw ?? []) as InvestorBid[]
    const actCount    = bids.length
    const prices      = bids.map(b => b.bid_price_eur)
    const highest     = prices.length > 0 ? Math.max(...prices) : 0
    const lowest      = prices.length > 0 ? Math.min(...prices) : 0
    const avg         = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / actCount : 0

    const { count: totalCount } = await db
      .from('investor_bids')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)

    return {
      property_id:           propertyId,
      tenant_id:             tenantId,
      total_bids:            totalCount ?? actCount,
      active_bids:           actCount,
      highest_bid_eur:       highest,
      lowest_bid_eur:        lowest,
      avg_bid_eur:           Math.round(avg * 100) / 100,
      demand_pressure_score: Math.min(100, actCount * 15),
      competitive_intensity: Math.min(100, actCount * 20),
      bid_spread_pct:        actCount > 1 ? Math.round((highest - lowest) / highest * 10000) / 100 : 0,
      capital_committed_eur: prices.reduce((s, p) => s + p, 0),
      bids,
    }
  } catch (err) {
    log.warn('[BidsEngine] getBidBook exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return empty
  }
}

// ─── withdrawBid ─────────────────────────────────────────────────────────────

export async function withdrawBid(
  tenantId: string,
  bidId: string,
  investorId: string,
): Promise<boolean> {
  const db = supabaseAdmin as any

  try {
    const { data: bid, error: fetchErr } = await db
      .from('investor_bids')
      .select('property_id')
      .eq('id', bidId)
      .eq('tenant_id', tenantId)
      .eq('investor_id', investorId)
      .single()

    if (fetchErr || !bid) {
      log.warn('[BidsEngine] withdrawBid: bid not found', { bid_id: bidId })
      return false
    }

    const { error } = await db
      .from('investor_bids')
      .update({ status: 'withdrawn' })
      .eq('id', bidId)
      .eq('tenant_id', tenantId)
      .eq('investor_id', investorId)

    if (error) {
      log.warn('[BidsEngine] withdrawBid update failed', { error: error.message })
      return false
    }

    const row = bid as { property_id: string }
    void _refreshBidBook(tenantId, row.property_id)
    return true
  } catch (err) {
    log.warn('[BidsEngine] withdrawBid exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// ─── getActiveBidsByInvestor ──────────────────────────────────────────────────

export async function getActiveBidsByInvestor(
  tenantId: string,
  investorId: string,
): Promise<InvestorBid[]> {
  const db = supabaseAdmin as any

  try {
    const { data, error } = await db
      .from('investor_bids')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('investor_id', investorId)
      .eq('status', 'active')
      .order('submitted_at', { ascending: false })

    if (error) {
      log.warn('[BidsEngine] getActiveBidsByInvestor failed', { error: error.message })
      return []
    }

    return (data ?? []) as InvestorBid[]
  } catch (err) {
    log.warn('[BidsEngine] getActiveBidsByInvestor exception', {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const bidsEngine = {
  submitBid,
  getBidBook,
  withdrawBid,
  getActiveBidsByInvestor,
}
