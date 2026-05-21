// =============================================================================
// Agency Group — Bid Competition Engine
// lib/market/bidCompetitionEngine.ts
//
// Dynamic repricing and urgency escalation. Processes new bids, marks lower
// competing bids as outbid, computes competition intensity, urgency heat, and
// recommended ask price adjustments for seller-side repricing decisions.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { getOrderBook } from '@/lib/market/orderBook'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitionEvent {
  property_id: string
  tenant_id: string
  event_type: 'new_bid' | 'outbid' | 'urgency_escalation' | 'price_discovery_update'
  trigger_investor_id: string
  affected_investor_ids: string[]
  new_clearing_price: number | null
  competition_intensity: number
  urgency_heat: number
  recommended_action: 'hold' | 'escalate_bid' | 'withdraw' | 'accept'
  created_at: string
}

export interface DynamicRepricingSignal {
  property_id: string
  current_ask: number
  recommended_ask_adjustment_pct: number
  driver: 'high_competition' | 'low_interest' | 'urgency_expiry' | 'market_momentum'
  confidence: number
  computed_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  id: string
  investor_id: string
  bid_amount: number
  urgency: string
  created_at: string
  status: string
}

interface PropertyRow {
  preco: number | null
  created_at: string | null
}

// ─── computeUrgencyHeat ───────────────────────────────────────────────────────

export function computeUrgencyHeat(
  bids: Array<{ urgency: string; created_at: string }>,
): number {
  if (bids.length === 0) return 0

  const URGENCY_WEIGHTS: Record<string, number> = {
    immediate:  1.0,
    within_30d: 0.7,
    within_90d: 0.4,
    flexible:   0.1,
  }

  const HALF_LIFE_DAYS = 14
  const now = Date.now()
  let weightedSum = 0
  let totalDecay  = 0

  for (const bid of bids) {
    const weight     = URGENCY_WEIGHTS[bid.urgency] ?? 0.1
    const bidDate    = new Date(bid.created_at).getTime()
    const daysSince  = Math.max(0, (now - bidDate) / (1000 * 60 * 60 * 24))
    const decay      = Math.exp((-Math.LN2 * daysSince) / HALF_LIFE_DAYS)
    weightedSum     += weight * decay
    totalDecay      += decay
  }

  if (totalDecay === 0) return 0
  const raw = weightedSum / totalDecay
  return Math.round(Math.min(1, Math.max(0, raw)) * 10000) / 10000
}

// ─── recordCompetitionEvent ───────────────────────────────────────────────────

export async function recordCompetitionEvent(event: CompetitionEvent): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await (db
    .from('bid_competition_events')
    .insert({
      property_id:           event.property_id,
      tenant_id:             event.tenant_id,
      event_type:            event.event_type,
      trigger_investor_id:   event.trigger_investor_id,
      affected_investor_ids: event.affected_investor_ids,
      new_clearing_price:    event.new_clearing_price,
      competition_intensity: event.competition_intensity,
      urgency_heat:          event.urgency_heat,
      recommended_action:    event.recommended_action,
      created_at:            event.created_at,
    }) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[bidCompetition] recordCompetitionEvent failed', { error: error.message })
  }
}

// ─── processNewBid ────────────────────────────────────────────────────────────

export async function processNewBid(
  tenantId: string,
  propertyId: string,
  newBid: { investor_id: string; bid_amount: number; urgency: string },
): Promise<CompetitionEvent> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  // Fetch all currently active bids on this property (excluding the new bidder)
  const { data: existingRaw, error: fetchErr } = await (db
    .from('investor_bids')
    .select('id, investor_id, bid_amount, urgency, created_at, status')
    .eq('tenant_id', tenantId)
    .eq('property_id', propertyId)
    .eq('status', 'active') as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

  if (fetchErr) {
    log.warn('[bidCompetition] processNewBid: fetch bids failed', { error: fetchErr.message })
  }

  const existingBids = (existingRaw ?? []).filter(b => b.investor_id !== newBid.investor_id)

  // Mark lower bids as outbid (only bids strictly below the new bid)
  const outbidBids = existingBids.filter(b => b.bid_amount < newBid.bid_amount)
  const outbidIds  = outbidBids.map(b => b.id)

  if (outbidIds.length > 0) {
    void (db
      .from('investor_bids')
      .update({ status: 'outbid' })
      .in('id', outbidIds)
      .eq('tenant_id', tenantId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) log.warn('[bidCompetition] outbid update failed', { error: error.message })
      }) as Promise<unknown>)
  }

  // Collect affected investor IDs (those who were outbid + those still competing)
  const affectedInvestorIds = [...new Set(existingBids.map(b => b.investor_id))]

  // Compute urgency heat across all bids (including new one)
  const allBidsForHeat = [
    ...existingBids,
    { urgency: newBid.urgency, created_at: now },
  ]
  const urgencyHeat = computeUrgencyHeat(allBidsForHeat)

  // Competition intensity: normalized by a cap of 10 competing bids
  const activeBidCount      = existingBids.length + 1 // include new bid
  const competitionIntensity = Math.round(Math.min(1, (activeBidCount - 1) / 9) * 10000) / 10000

  // Determine event type
  const eventType: CompetitionEvent['event_type'] = outbidIds.length > 0 ? 'outbid' : 'new_bid'

  // New clearing price: the highest bid in the book
  const allBidAmounts = existingBids.map(b => b.bid_amount).concat(newBid.bid_amount)
  const newClearingPrice = Math.max(...allBidAmounts)

  // Recommended action for existing bidders who are now below the leader
  let recommendedAction: CompetitionEvent['recommended_action']
  if (competitionIntensity > 0.7) {
    recommendedAction = 'escalate_bid'
  } else if (outbidIds.length > 0) {
    recommendedAction = 'escalate_bid'
  } else if (urgencyHeat < 0.2) {
    recommendedAction = 'hold'
  } else {
    recommendedAction = 'hold'
  }

  const event: CompetitionEvent = {
    property_id:           propertyId,
    tenant_id:             tenantId,
    event_type:            eventType,
    trigger_investor_id:   newBid.investor_id,
    affected_investor_ids: affectedInvestorIds,
    new_clearing_price:    Math.round(newClearingPrice * 100) / 100,
    competition_intensity: competitionIntensity,
    urgency_heat:          urgencyHeat,
    recommended_action:    recommendedAction,
    created_at:            now,
  }

  void recordCompetitionEvent(event).catch(e =>
    log.warn('[bidCompetition] fire-and-forget recordCompetitionEvent failed', {
      error: e instanceof Error ? e.message : String(e),
    }),
  )

  log.info('[bidCompetition] processNewBid complete', {
    property_id:          propertyId,
    event_type:           eventType,
    competition_intensity: competitionIntensity,
    outbid_count:         outbidIds.length,
  })

  return event
}

// ─── computeDynamicRepricing ──────────────────────────────────────────────────

export async function computeDynamicRepricing(
  tenantId: string,
  propertyId: string,
): Promise<DynamicRepricingSignal> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  // Fetch property ask + days on market
  const { data: propRaw, error: propErr } = await (db
    .from('properties')
    .select('preco, created_at')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{ data: PropertyRow | null; error: { message: string } | null }>)

  if (propErr || !propRaw) {
    log.warn('[bidCompetition] computeDynamicRepricing: property not found', { property_id: propertyId })
    return {
      property_id:                    propertyId,
      current_ask:                    0,
      recommended_ask_adjustment_pct: 0,
      driver:                         'market_momentum',
      confidence:                     0,
      computed_at:                    now,
    }
  }

  const currentAsk     = propRaw.preco ?? 0
  const listingDate    = propRaw.created_at ? new Date(propRaw.created_at) : new Date()
  const daysOnMarket   = Math.max(0, (Date.now() - listingDate.getTime()) / (1000 * 60 * 60 * 24))

  // Get order book for spread info
  const book = await getOrderBook(tenantId, propertyId)
  const bidDepth = book?.bid_depth ?? 0
  const spreadPct = book?.spread_pct ?? null

  let adjustmentPct: number
  let driver: DynamicRepricingSignal['driver']
  let confidence: number

  if (bidDepth >= 3 && spreadPct !== null && spreadPct < 5) {
    // High competition, tight spread → raise ask 5-10%
    const intensity = Math.min(1, bidDepth / 10)
    adjustmentPct   = 5 + intensity * 5  // 5% to 10%
    driver          = 'high_competition'
    confidence      = 0.8
  } else if (bidDepth === 0 && daysOnMarket > 90) {
    // No interest, stale listing → reduce ask 5%
    adjustmentPct = -5
    driver        = 'low_interest'
    confidence    = 0.7
  } else if (daysOnMarket > 180) {
    // Long on market → slight urgency signal
    adjustmentPct = -3
    driver        = 'urgency_expiry'
    confidence    = 0.5
  } else {
    adjustmentPct = 0
    driver        = 'market_momentum'
    confidence    = 0.3
  }

  const signal: DynamicRepricingSignal = {
    property_id:                    propertyId,
    current_ask:                    currentAsk,
    recommended_ask_adjustment_pct: Math.round(adjustmentPct * 100) / 100,
    driver,
    confidence:                     Math.round(confidence * 10000) / 10000,
    computed_at:                    now,
  }

  log.info('[bidCompetition] computeDynamicRepricing', {
    property_id:    propertyId,
    adjustment_pct: signal.recommended_ask_adjustment_pct,
    driver:         signal.driver,
  })

  return signal
}
