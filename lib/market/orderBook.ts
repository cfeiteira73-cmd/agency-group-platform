// =============================================================================
// Agency Group — Formal Order Book Engine
// lib/market/orderBook.ts
//
// Formal bid/ask order book per property. Aggregates active investor_bids as
// the buy side and the property's listed price (preco) as the single ask.
// Computes spread, depth levels, mid price, and price discovery confidence.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderBookEntry {
  type: 'bid' | 'ask'
  price: number
  quantity: number
  investor_id: string | null
  timestamp: string
  urgency: 'immediate' | 'within_30d' | 'within_90d' | 'flexible'
}

export interface OrderBook {
  property_id: string
  tenant_id: string
  best_bid: number | null
  best_ask: number | null
  spread: number | null
  spread_pct: number | null
  bid_depth: number
  ask_depth: number
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
  mid_price: number | null
  price_discovery_confidence: number
  computed_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  id: string
  investor_id: string
  bid_amount: number
  urgency: string
  created_at: string
}

interface PropertyRow {
  id: string
  preco: number | null
  created_at: string | null
}

// ─── computeSpread ────────────────────────────────────────────────────────────

export function computeSpread(
  bestBid: number | null,
  ask: number,
): { spread: number | null; spread_pct: number | null } {
  if (bestBid === null) return { spread: null, spread_pct: null }
  if (ask <= 0) return { spread: null, spread_pct: null }
  const spread     = ask - bestBid
  const spread_pct = (spread / ask) * 100
  return {
    spread:     Math.round(spread * 100) / 100,
    spread_pct: Math.round(spread_pct * 10000) / 10000,
  }
}

// ─── computePriceDiscoveryConfidence ─────────────────────────────────────────

export function computePriceDiscoveryConfidence(
  bidDepth: number,
  spreadPct: number | null,
): number {
  const depthScore  = Math.min(1, bidDepth / 10) * 0.6
  const spreadScore = spreadPct !== null
    ? Math.max(0, 1 - spreadPct / 20) * 0.4
    : 0
  const raw = depthScore + spreadScore
  return Math.round(Math.min(1, Math.max(0, raw)) * 10000) / 10000
}

// ─── getOrderBook ─────────────────────────────────────────────────────────────

export async function getOrderBook(
  tenantId: string,
  propertyId: string,
): Promise<OrderBook | null> {
  const db = supabaseAdmin as any

  try {
    // Fetch property (ask side)
    const { data: propRaw, error: propErr } = await (db
      .from('properties')
      .select('id, preco, created_at')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single() as Promise<{ data: PropertyRow | null; error: { message: string } | null }>)

    if (propErr || !propRaw) {
      log.warn('[orderBook] property not found', { property_id: propertyId, error: propErr?.message })
      return null
    }

    const askPrice: number | null = propRaw.preco ?? null

    // Fetch active bids (buy side)
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('id, investor_id, bid_amount, urgency, created_at')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('bid_amount', { ascending: false }) as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[orderBook] bids query failed', { property_id: propertyId, error: bidsErr.message })
    }

    const rawBids = bidsRaw ?? []

    // Build bids array
    const bids: OrderBookEntry[] = rawBids.map(b => ({
      type:        'bid',
      price:       b.bid_amount,
      quantity:    1,
      investor_id: b.investor_id,
      timestamp:   b.created_at,
      urgency:     (b.urgency as OrderBookEntry['urgency']) ?? 'flexible',
    }))

    // Build asks array (single listing = single ask)
    const asks: OrderBookEntry[] = askPrice !== null
      ? [{
          type:        'ask',
          price:       askPrice,
          quantity:    1,
          investor_id: null,
          timestamp:   propRaw.created_at ?? new Date().toISOString(),
          urgency:     'flexible',
        }]
      : []

    const bestBid = bids.length > 0 ? bids[0].price : null
    const bestAsk = askPrice

    const { spread, spread_pct } = computeSpread(bestBid, bestAsk ?? 0)

    const midPrice = bestBid !== null && bestAsk !== null
      ? Math.round(((bestBid + bestAsk) / 2) * 100) / 100
      : null

    const confidence = computePriceDiscoveryConfidence(bids.length, spread_pct)

    const book: OrderBook = {
      property_id:                 propertyId,
      tenant_id:                   tenantId,
      best_bid:                    bestBid,
      best_ask:                    bestAsk,
      spread:                      spread,
      spread_pct:                  spread_pct,
      bid_depth:                   bids.length,
      ask_depth:                   asks.length,
      bids,
      asks,
      mid_price:                   midPrice,
      price_discovery_confidence:  confidence,
      computed_at:                 new Date().toISOString(),
    }

    log.info('[orderBook] computed', { property_id: propertyId, bid_depth: bids.length, spread_pct })

    return book
  } catch (err) {
    log.error('[orderBook] failed', err instanceof Error ? err : undefined, { property_id: propertyId })
    return null
  }
}

// ─── getOrderBookDepth ────────────────────────────────────────────────────────

export async function getOrderBookDepth(
  tenantId: string,
  propertyId: string,
  levels?: number,
): Promise<{ bids: Array<{ price: number; count: number }>; asks: Array<{ price: number; count: number }> }> {
  const db = supabaseAdmin as any

  const empty = { bids: [], asks: [] }

  try {
    // Fetch property ask
    const { data: propRaw, error: propErr } = await (db
      .from('properties')
      .select('preco')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single() as Promise<{ data: { preco: number | null } | null; error: { message: string } | null }>)

    if (propErr || !propRaw) {
      log.warn('[orderBook] getOrderBookDepth: property not found', { property_id: propertyId })
      return empty
    }

    const askPrice = propRaw.preco

    // Fetch all active bid amounts
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('bid_amount')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active') as Promise<{ data: { bid_amount: number }[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[orderBook] getOrderBookDepth bids query failed', { error: bidsErr.message })
      return empty
    }

    const bidAmounts = (bidsRaw ?? []).map(b => b.bid_amount)

    if (bidAmounts.length === 0) {
      const asks = askPrice !== null ? [{ price: askPrice, count: 1 }] : []
      return { bids: [], asks }
    }

    // Group bids into 5% brackets relative to ask price
    const refPrice = askPrice ?? (bidAmounts.reduce((s, p) => s + p, 0) / bidAmounts.length)
    const bracketSize = refPrice * 0.05
    const buckets = new Map<number, number>()

    for (const amt of bidAmounts) {
      const bracket = Math.floor(amt / bracketSize) * bracketSize
      const rounded = Math.round(bracket * 100) / 100
      buckets.set(rounded, (buckets.get(rounded) ?? 0) + 1)
    }

    const maxLevels = levels ?? 10
    const sortedBidDepth = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, maxLevels)
      .map(([price, count]) => ({ price, count }))

    const asks = askPrice !== null ? [{ price: askPrice, count: 1 }] : []

    return { bids: sortedBidDepth, asks }
  } catch (err) {
    log.error('[orderBook] getOrderBookDepth failed', err instanceof Error ? err : undefined, { property_id: propertyId })
    return empty
  }
}
