// =============================================================================
// Agency Group — Capital Flow Tracker
// lib/market/capitalFlowTracker.ts
//
// Tracks EUR capital flowing through the market per zone per day.
// Computes inflows (new bids), outflows (closed deals + withdrawn bids),
// running stock, velocity index, and 7-day rolling sums.
//
// Depends on `capital_flows` table (migration 20260522000013).
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapitalFlowMetrics {
  zone: string
  tenant_id: string
  date: string

  // Inflows
  new_bids_eur: number       // capital newly committed via bids today
  bid_count_today: number

  // Outflows
  deals_closed_eur: number   // capital that converted to closed deals
  deals_closed_count: number
  bids_withdrawn_eur: number // capital pulled back

  // Stock
  total_capital_in_market_eur: number   // all active bids
  net_flow_eur: number                   // new_bids - deals_closed - withdrawn

  // Velocity
  velocity_index: number     // net_flow / max(1, total_capital) * 100

  // 7-day rolling
  rolling_7d_inflow_eur: number
  rolling_7d_outflow_eur: number
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface CapitalFlowRow {
  zone: string
  tenant_id: string
  date: string
  new_bids_eur: number
  bid_count_today: number
  deals_closed_eur: number
  deals_closed_count: number
  bids_withdrawn_eur: number
  total_capital_in_market_eur: number
  net_flow_eur: number
  velocity_index: number
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildMetrics(
  row: CapitalFlowRow,
  rolling7dInflow: number,
  rolling7dOutflow: number,
): CapitalFlowMetrics {
  return {
    zone:                       row.zone,
    tenant_id:                  row.tenant_id,
    date:                       row.date,
    new_bids_eur:               row.new_bids_eur,
    bid_count_today:            row.bid_count_today,
    deals_closed_eur:           row.deals_closed_eur,
    deals_closed_count:         row.deals_closed_count,
    bids_withdrawn_eur:         row.bids_withdrawn_eur,
    total_capital_in_market_eur: row.total_capital_in_market_eur,
    net_flow_eur:               row.net_flow_eur,
    velocity_index:             row.velocity_index,
    rolling_7d_inflow_eur:      rolling7dInflow,
    rolling_7d_outflow_eur:     rolling7dOutflow,
  }
}

async function _fetchRolling7d(
  tenantId: string,
  zone: string,
  beforeDate: string,
): Promise<{ inflow: number; outflow: number }> {
  const db = supabaseAdmin as any

  // 7 calendar days before the target date (exclusive of target day itself)
  const cutoff = new Date(beforeDate)
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  const { data: rows, error } = await (db
    .from('capital_flows')
    .select('new_bids_eur, deals_closed_eur, bids_withdrawn_eur')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .gte('date', cutoffIso)
    .lt('date', beforeDate) as Promise<{
      data: { new_bids_eur: number; deals_closed_eur: number; bids_withdrawn_eur: number }[] | null
      error: { message: string } | null
    }>)

  if (error) {
    log.warn('[CapitalFlow] rolling 7d query failed', { zone, error: error.message })
    return { inflow: 0, outflow: 0 }
  }

  const inflow  = (rows ?? []).reduce((s, r) => s + (r.new_bids_eur ?? 0), 0)
  const outflow = (rows ?? []).reduce((s, r) => s + (r.deals_closed_eur ?? 0) + (r.bids_withdrawn_eur ?? 0), 0)
  return { inflow, outflow }
}

// ─── computeCapitalFlow ───────────────────────────────────────────────────────

export async function computeCapitalFlow(
  tenantId: string,
  zone: string,
  date?: string,
): Promise<CapitalFlowMetrics> {
  const db      = supabaseAdmin as any
  const dateStr = date ?? todayIso()

  // Try to load existing row for this date
  const { data: existing, error: fetchErr } = await (db
    .from('capital_flows')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .eq('date', dateStr)
    .maybeSingle() as Promise<{ data: CapitalFlowRow | null; error: { message: string } | null }>)

  if (fetchErr) {
    log.warn('[CapitalFlow] computeCapitalFlow fetch failed', { zone, date: dateStr, error: fetchErr.message })
  }

  if (existing) {
    const { inflow, outflow } = await _fetchRolling7d(tenantId, zone, dateStr)
    return buildMetrics(existing, inflow, outflow)
  }

  // No row yet — derive from live investor_bids for this zone on this date
  // Bids submitted today
  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay   = `${dateStr}T23:59:59.999Z`

  const { data: newBidsRaw, error: newBidsErr } = await (db
    .from('investor_bids')
    .select('bid_price_eur, status')
    .eq('tenant_id', tenantId)
    .gte('submitted_at', startOfDay)
    .lte('submitted_at', endOfDay) as Promise<{ data: { bid_price_eur: number; status: string }[] | null; error: { message: string } | null }>)

  if (newBidsErr) {
    log.warn('[CapitalFlow] new bids query failed', { zone, error: newBidsErr.message })
  }

  // We can't join to zone here without joining through properties, so we fetch
  // all active bids for properties in the zone to get total_capital_in_market
  const { data: allActiveBidsRaw, error: allBidsErr } = await (db
    .from('investor_bids')
    .select('bid_price_eur, properties!inner(zona)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .eq('properties.zona', zone) as Promise<{ data: { bid_price_eur: number }[] | null; error: { message: string } | null }>)

  if (allBidsErr) {
    log.warn('[CapitalFlow] total capital query failed', { zone, error: allBidsErr.message })
  }

  const todayBids         = newBidsRaw ?? []
  const newBidsEur        = todayBids.reduce((s, b) => s + b.bid_price_eur, 0)
  const bidCountToday     = todayBids.length

  const totalCapitalInMarket = (allActiveBidsRaw ?? []).reduce((s, b) => s + b.bid_price_eur, 0)
  const netFlowEur           = newBidsEur
  const velocityIndex        = Math.round(netFlowEur / Math.max(1, totalCapitalInMarket) * 100 * 100) / 100

  const syntheticRow: CapitalFlowRow = {
    zone,
    tenant_id:                  tenantId,
    date:                       dateStr,
    new_bids_eur:               newBidsEur,
    bid_count_today:            bidCountToday,
    deals_closed_eur:           0,
    deals_closed_count:         0,
    bids_withdrawn_eur:         0,
    total_capital_in_market_eur: totalCapitalInMarket,
    net_flow_eur:               netFlowEur,
    velocity_index:             velocityIndex,
  }

  const { inflow, outflow } = await _fetchRolling7d(tenantId, zone, dateStr)
  return buildMetrics(syntheticRow, inflow, outflow)
}

// ─── getCapitalFlowHistory ────────────────────────────────────────────────────

export async function getCapitalFlowHistory(
  tenantId: string,
  zone: string,
  days = 30,
): Promise<CapitalFlowMetrics[]> {
  const db = supabaseAdmin as any

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  const { data: rows, error } = await (db
    .from('capital_flows')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .gte('date', cutoffIso)
    .order('date', { ascending: false }) as Promise<{ data: CapitalFlowRow[] | null; error: { message: string } | null }>)

  if (error) {
    log.warn('[CapitalFlow] getCapitalFlowHistory failed', { zone, error: error.message })
    return []
  }

  if (!rows || rows.length === 0) return []

  // For each row, compute rolling 7d
  const metrics = await Promise.all(
    rows.map(async row => {
      const { inflow, outflow } = await _fetchRolling7d(tenantId, zone, row.date)
      return buildMetrics(row, inflow, outflow)
    }),
  )

  return metrics
}

// ─── updateDailyCapitalFlow ───────────────────────────────────────────────────

export async function updateDailyCapitalFlow(
  tenantId: string,
  zone: string,
  delta: {
    bid_added_eur?: number
    bid_withdrawn_eur?: number
    deal_closed_eur?: number
  },
): Promise<void> {
  const db      = supabaseAdmin as any
  const dateStr = todayIso()

  // Load or initialise today's row
  const { data: existing, error: fetchErr } = await (db
    .from('capital_flows')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('zone', zone)
    .eq('date', dateStr)
    .maybeSingle() as Promise<{ data: CapitalFlowRow | null; error: { message: string } | null }>)

  if (fetchErr) {
    log.warn('[CapitalFlow] updateDailyCapitalFlow fetch failed', { zone, error: fetchErr.message })
    return
  }

  const base: CapitalFlowRow = existing ?? {
    zone,
    tenant_id:                  tenantId,
    date:                       dateStr,
    new_bids_eur:               0,
    bid_count_today:            0,
    deals_closed_eur:           0,
    deals_closed_count:         0,
    bids_withdrawn_eur:         0,
    total_capital_in_market_eur: 0,
    net_flow_eur:               0,
    velocity_index:             0,
  }

  const bidAdded    = delta.bid_added_eur     ?? 0
  const bidWithdrawn = delta.bid_withdrawn_eur ?? 0
  const dealClosed  = delta.deal_closed_eur   ?? 0

  const newBidsEur        = base.new_bids_eur + bidAdded
  const bidCountToday     = base.bid_count_today + (bidAdded > 0 ? 1 : 0)
  const dealsClosedEur    = base.deals_closed_eur + dealClosed
  const dealsClosedCount  = base.deals_closed_count + (dealClosed > 0 ? 1 : 0)
  const bidsWithdrawnEur  = base.bids_withdrawn_eur + bidWithdrawn

  // Stock: add bids, remove outflows
  const totalCapital = Math.max(
    0,
    base.total_capital_in_market_eur + bidAdded - bidWithdrawn - dealClosed,
  )
  const netFlow      = newBidsEur - dealsClosedEur - bidsWithdrawnEur
  const velocity     = Math.round(netFlow / Math.max(1, totalCapital) * 100 * 100) / 100

  const { error: upsertErr } = await (db
    .from('capital_flows')
    .upsert(
      {
        tenant_id:                  tenantId,
        zone,
        date:                       dateStr,
        new_bids_eur:               Math.round(newBidsEur * 100) / 100,
        bid_count_today:            bidCountToday,
        deals_closed_eur:           Math.round(dealsClosedEur * 100) / 100,
        deals_closed_count:         dealsClosedCount,
        bids_withdrawn_eur:         Math.round(bidsWithdrawnEur * 100) / 100,
        total_capital_in_market_eur: Math.round(totalCapital * 100) / 100,
        net_flow_eur:               Math.round(netFlow * 100) / 100,
        velocity_index:             velocity,
      },
      { onConflict: 'tenant_id,zone,date' },
    ) as Promise<{ error: { message: string } | null }>)

  if (upsertErr) {
    log.warn('[CapitalFlow] updateDailyCapitalFlow upsert failed', {
      zone,
      error: upsertErr.message,
    })
    return
  }

  log.info('[CapitalFlow] daily flow updated', {
    zone,
    date:        dateStr,
    bid_added:   bidAdded,
    bid_withdrawn: bidWithdrawn,
    deal_closed: dealClosed,
    net_flow:    Math.round(netFlow * 100) / 100,
  })
}
