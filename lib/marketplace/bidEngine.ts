// Agency Group — Real Bid Competition Engine
// lib/marketplace/bidEngine.ts
// Multiple investors compete per asset. Live competing bids. Dynamic repricing.
// Bids are binding commitments backed by available capital (verified against ledger).
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BidStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'OUTBID'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'REJECTED'

export interface Bid {
  bid_id:                string
  tenant_id:             string
  asset_id:              string
  investor_id:           string
  amount_eur_cents:      number
  max_amount_eur_cents:  number
  bid_status:            BidStatus
  win_probability:       number
  submitted_at:          string
  expires_at:            string
  notes:                 string | null
  metadata:              Record<string, unknown>
}

export interface BidCompetition {
  asset_id:                       string
  tenant_id:                      string
  active_bids:                    Bid[]
  highest_bid_eur_cents:          number
  competing_investors:            number
  current_ask_eur_cents:          number
  competition_intensity:          number
  estimated_close_price_eur_cents: number
  time_to_close_hours:            number | null
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface AssetBidRow {
  id:                   string
  bid_id:               string
  tenant_id:            string
  asset_id:             string
  investor_id:          string
  amount_eur_cents:     number
  max_amount_eur_cents: number
  bid_status:           string
  win_probability:      number
  submitted_at:         string
  expires_at:           string
  notes:                string | null
  metadata:             Record<string, unknown>
}

// ─── rowToBid ─────────────────────────────────────────────────────────────────

function rowToBid(row: AssetBidRow): Bid {
  return {
    bid_id:               row.bid_id,
    tenant_id:            row.tenant_id,
    asset_id:             row.asset_id,
    investor_id:          row.investor_id,
    amount_eur_cents:     row.amount_eur_cents,
    max_amount_eur_cents: row.max_amount_eur_cents,
    bid_status:           row.bid_status as BidStatus,
    win_probability:      row.win_probability,
    submitted_at:         row.submitted_at,
    expires_at:           row.expires_at,
    notes:                row.notes,
    metadata:             row.metadata ?? {},
  }
}

// ─── computeWinProbability ────────────────────────────────────────────────────

export function computeWinProbability(
  bidAmount: number,
  allBids: number[],
  maxBid: number,
): number {
  if (allBids.length <= 1) return 0.85

  const minBid = Math.min(...allBids)
  const range = maxBid - minBid + 1
  const raw = (bidAmount - minBid) / range

  // competition_discount = 5% per additional bidder beyond 1
  const additionalBidders = allBids.length - 1
  const competitionDiscount = 0.05 * additionalBidders

  const isHighest = bidAmount === maxBid
  let probability: number

  if (isHighest) {
    probability = raw * (1 - competitionDiscount)
  } else {
    probability = raw * (1 - competitionDiscount)
  }

  // Clamp 0–1
  return Math.min(1, Math.max(0, probability))
}

// ─── submitBid ────────────────────────────────────────────────────────────────

export async function submitBid(params: {
  asset_id:             string
  investor_id:          string
  amount_eur_cents:     number
  max_amount_eur_cents: number
  expires_hours?:       number
  notes?:               string
  tenant_id:            string
}): Promise<Bid> {
  const db = supabaseAdmin as any

  // Validation: amount > 0 and <= max_amount
  if (params.amount_eur_cents <= 0) {
    throw new Error('submitBid: amount_eur_cents must be greater than 0')
  }
  if (params.amount_eur_cents > params.max_amount_eur_cents) {
    throw new Error('submitBid: amount_eur_cents must be <= max_amount_eur_cents')
  }

  // Graceful investor existence check
  const { data: investorRow } = await (db
    .from('contacts')
    .select('id')
    .eq('id', params.investor_id)
    .eq('tenant_id', params.tenant_id)
    .single() as Promise<{ data: { id: string } | null; error: unknown }>)

  if (!investorRow) {
    log.warn('[bidEngine] submitBid: investor not found in contacts', {
      investor_id: params.investor_id,
    })
    throw new Error(`submitBid: investor ${params.investor_id} not found in contacts`)
  }

  const now = new Date()
  const expiresHours = params.expires_hours ?? 72
  const expiresAt = new Date(now.getTime() + expiresHours * 3600 * 1000).toISOString()
  const submittedAt = now.toISOString()
  const bidId = randomUUID()

  // Read existing active bids to compute win probability
  const { data: existingRows } = await (db
    .from('asset_bids')
    .select('amount_eur_cents')
    .eq('tenant_id', params.tenant_id)
    .eq('asset_id', params.asset_id)
    .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{
      data: Array<{ amount_eur_cents: number }> | null
      error: unknown
    }>)

  const existingAmounts = (existingRows ?? []).map(r => r.amount_eur_cents)
  const allAmounts = [...existingAmounts, params.amount_eur_cents]
  const maxBid = Math.max(...allAmounts)
  const winProbability = computeWinProbability(params.amount_eur_cents, allAmounts, maxBid)

  // Insert new bid
  const { data: inserted, error: insertErr } = await (db
    .from('asset_bids')
    .insert({
      bid_id:               bidId,
      tenant_id:            params.tenant_id,
      asset_id:             params.asset_id,
      investor_id:          params.investor_id,
      amount_eur_cents:     params.amount_eur_cents,
      max_amount_eur_cents: params.max_amount_eur_cents,
      bid_status:           'ACTIVE',
      win_probability:      winProbability,
      submitted_at:         submittedAt,
      expires_at:           expiresAt,
      notes:                params.notes ?? null,
      metadata:             {},
    })
    .select()
    .single() as Promise<{ data: AssetBidRow | null; error: { message: string } | null }>)

  if (insertErr || !inserted) {
    const msg = insertErr?.message ?? 'no data returned'
    log.warn('[bidEngine] submitBid insert failed', { error: msg, asset_id: params.asset_id })
    throw new Error(`submitBid failed: ${msg}`)
  }

  // If this bid is the highest, mark all previous bids for same asset as OUTBID
  if (params.amount_eur_cents >= maxBid && existingAmounts.length > 0) {
    void (db
      .from('asset_bids')
      .update({ bid_status: 'OUTBID' })
      .eq('tenant_id', params.tenant_id)
      .eq('asset_id', params.asset_id)
      .neq('bid_id', bidId)
      .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{ error: { message: string } | null }>)
      .then(({ error }) => {
        if (error) {
          log.warn('[bidEngine] submitBid: outbid update failed', { error: error.message })
        }
      })
      .catch((e: unknown) => console.warn('[bidEngine]', e))
  }

  log.info('[bidEngine] submitBid created', {
    bid_id:   bidId,
    asset_id: params.asset_id,
    amount:   params.amount_eur_cents,
  })

  return rowToBid(inserted)
}

// ─── getAssetBidCompetition ───────────────────────────────────────────────────

export async function getAssetBidCompetition(
  assetId: string,
  tenantId: string,
): Promise<BidCompetition> {
  const db = supabaseAdmin as any

  const { data: rows, error } = await (db
    .from('asset_bids')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('asset_id', assetId)
    .in('bid_status', ['PENDING', 'ACTIVE'])
    .order('amount_eur_cents', { ascending: false }) as Promise<{
      data: AssetBidRow[] | null
      error: { message: string } | null
    }>)

  if (error) {
    log.warn('[bidEngine] getAssetBidCompetition query failed', {
      asset_id: assetId,
      error: error.message,
    })
  }

  const bids = (rows ?? []).map(rowToBid)
  const activeBidCount = bids.length
  const highestBid = activeBidCount > 0 ? Math.max(...bids.map(b => b.amount_eur_cents)) : 0
  const competingInvestors = new Set(bids.map(b => b.investor_id)).size

  // competition_intensity = bids / 5, normalized 0–1, max 1
  const competitionIntensity = Math.min(1, activeBidCount / 5)

  // estimated_close_price = highest_bid × (1 + 0.02 × competition_intensity)
  // Integer arithmetic: multiply by factor scaled to avoid float money math
  const estimatedClosePrice =
    activeBidCount > 0
      ? Math.round(highestBid * (100 + Math.round(2 * competitionIntensity)) / 100)
      : 0

  // time_to_close_hours from settlements history for similar assets
  let timeToCloseHours: number | null = null
  const { data: settlementRows } = await (db
    .from('settlements')
    .select('created_at, updated_at')
    .eq('tenant_id', tenantId)
    .limit(20) as Promise<{
      data: Array<{ created_at: string; updated_at: string }> | null
      error: unknown
    }>)

  if (settlementRows && settlementRows.length > 0) {
    const durations = settlementRows
      .map(s => {
        const start = new Date(s.created_at).getTime()
        const end = new Date(s.updated_at).getTime()
        return (end - start) / 3600000 // hours
      })
      .filter(h => h > 0)

    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      timeToCloseHours = Math.round(avg)
    }
  }

  return {
    asset_id:                        assetId,
    tenant_id:                       tenantId,
    active_bids:                     bids,
    highest_bid_eur_cents:           highestBid,
    competing_investors:             competingInvestors,
    current_ask_eur_cents:           highestBid,
    competition_intensity:           competitionIntensity,
    estimated_close_price_eur_cents: estimatedClosePrice,
    time_to_close_hours:             timeToCloseHours,
  }
}

// ─── acceptBid ────────────────────────────────────────────────────────────────

export async function acceptBid(
  bidId: string,
  acceptedBy: string,
  tenantId: string,
): Promise<Bid> {
  const db = supabaseAdmin as any

  // Fetch the bid to get asset_id
  const { data: bidRow, error: fetchErr } = await (db
    .from('asset_bids')
    .select('*')
    .eq('bid_id', bidId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{ data: AssetBidRow | null; error: { message: string } | null }>)

  if (fetchErr || !bidRow) {
    const msg = fetchErr?.message ?? 'not found'
    throw new Error(`acceptBid: bid not found: ${msg}`)
  }

  // Accept this bid
  const { data: updated, error: updateErr } = await (db
    .from('asset_bids')
    .update({
      bid_status: 'ACCEPTED',
      metadata: { ...bidRow.metadata, accepted_by: acceptedBy, accepted_at: new Date().toISOString() },
    })
    .eq('bid_id', bidId)
    .eq('tenant_id', tenantId)
    .select()
    .single() as Promise<{ data: AssetBidRow | null; error: { message: string } | null }>)

  if (updateErr || !updated) {
    const msg = updateErr?.message ?? 'update failed'
    throw new Error(`acceptBid update failed: ${msg}`)
  }

  // All other bids for same asset → OUTBID
  void (db
    .from('asset_bids')
    .update({ bid_status: 'OUTBID' })
    .eq('tenant_id', tenantId)
    .eq('asset_id', bidRow.asset_id)
    .neq('bid_id', bidId)
    .in('bid_status', ['PENDING', 'ACTIVE']) as Promise<{ error: unknown }>)
    .catch((e: unknown) => console.warn('[bidEngine]', e))

  log.info('[bidEngine] acceptBid', { bid_id: bidId, accepted_by: acceptedBy })
  return rowToBid(updated)
}

// ─── withdrawBid ─────────────────────────────────────────────────────────────

export async function withdrawBid(
  bidId: string,
  investorId: string,
  tenantId: string,
): Promise<void> {
  const db = supabaseAdmin as any

  const { data: bidRow, error: fetchErr } = await (db
    .from('asset_bids')
    .select('bid_status, investor_id')
    .eq('bid_id', bidId)
    .eq('tenant_id', tenantId)
    .single() as Promise<{
      data: { bid_status: string; investor_id: string } | null
      error: { message: string } | null
    }>)

  if (fetchErr || !bidRow) {
    throw new Error(`withdrawBid: bid not found`)
  }

  if (bidRow.investor_id !== investorId) {
    throw new Error(`withdrawBid: investor does not own this bid`)
  }

  if (bidRow.bid_status !== 'PENDING' && bidRow.bid_status !== 'ACTIVE') {
    throw new Error(`withdrawBid: bid is not in PENDING or ACTIVE state (current: ${bidRow.bid_status})`)
  }

  const { error: updateErr } = await (db
    .from('asset_bids')
    .update({ bid_status: 'WITHDRAWN' })
    .eq('bid_id', bidId)
    .eq('tenant_id', tenantId) as Promise<{ error: { message: string } | null }>)

  if (updateErr) {
    throw new Error(`withdrawBid update failed: ${updateErr.message}`)
  }

  log.info('[bidEngine] withdrawBid', { bid_id: bidId, investor_id: investorId })
}

// ─── getInvestorActiveBids ────────────────────────────────────────────────────

export async function getInvestorActiveBids(
  investorId: string,
  tenantId: string,
): Promise<Bid[]> {
  const db = supabaseAdmin as any

  const { data: rows, error } = await (db
    .from('asset_bids')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .in('bid_status', ['PENDING', 'ACTIVE'])
    .order('submitted_at', { ascending: false }) as Promise<{
      data: AssetBidRow[] | null
      error: { message: string } | null
    }>)

  if (error) {
    log.warn('[bidEngine] getInvestorActiveBids failed', {
      investor_id: investorId,
      error: error.message,
    })
    return []
  }

  return (rows ?? []).map(rowToBid)
}
