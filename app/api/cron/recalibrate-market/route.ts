// AGENCY GROUP — SH-ROS | AMI: 22506
// POST /api/cron/recalibrate-market — Daily market model recalibration
// Protected by CRON_SECRET. Runs nightly to update MarketState from closed deals.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'
import {
  getDefaultMarketState,
  updateMarketStateFromTransaction,
  type MarketState,
} from '@/lib/market-learning-v2'

export const runtime = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')
  return incoming === cronSecret
}

// ---------------------------------------------------------------------------
// Zone key normalisation
// ---------------------------------------------------------------------------

function normaliseZone(city?: string | null, zone?: string | null): string {
  const raw = (zone ?? city ?? 'portugal').toLowerCase().trim()
  if (raw.includes('lisboa') || raw.includes('lisbon')) return 'lisboa'
  if (raw.includes('cascais') || raw.includes('estoril')) return 'cascais'
  if (raw.includes('algarve') || raw.includes('faro') || raw.includes('albufeira')) return 'algarve'
  if (raw.includes('porto') || raw.includes('gaia')) return 'porto'
  if (raw.includes('madeira') || raw.includes('funchal')) return 'madeira'
  return 'portugal'
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface DealRow {
  id: string
  value_eur?: number | null
  listed_price_eur?: number | null
  city?: string | null
  zone?: string | null
  buyer_intent?: string | null
  days_on_market?: number | null
  closed_at?: string | null
}

interface MarketStateRow {
  zone_key: string
  state_json: string
  updated_at: string
  data_points: number
  confidence: number
}

// ---------------------------------------------------------------------------
// Generic Supabase caller — avoids complex type inference
// ---------------------------------------------------------------------------

async function dbQuery(
  table: string,
  select: string,
  filters: Record<string, string | number> = {},
  options: { limit?: number; gte?: { col: string; val: string } } = {},
): Promise<unknown[]> {
  try {
    const db = supabaseAdmin as unknown as Record<string, unknown>
    let q = (db['from'] as (t: string) => Record<string, unknown>)(table)
    q = (q['select'] as (s: string) => Record<string, unknown>)(select)
    for (const [k, v] of Object.entries(filters)) {
      q = (q['eq'] as (k: string, v: unknown) => Record<string, unknown>)(k, v)
    }
    if (options.gte) {
      q = (q['gte'] as (k: string, v: string) => Record<string, unknown>)(
        options.gte.col, options.gte.val,
      )
    }
    if (options.limit) {
      q = (q['limit'] as (n: number) => Record<string, unknown>)(options.limit)
    }
    const result = await (q as unknown as Promise<{ data: unknown[] | null; error: unknown }>)
    return result.data ?? []
  } catch {
    return []
  }
}

async function dbUpsert(table: string, row: Record<string, unknown>, onConflict: string): Promise<boolean> {
  try {
    const db = supabaseAdmin as unknown as Record<string, unknown>
    const q = (db['from'] as (t: string) => Record<string, unknown>)(table)
    const result = await ((q['upsert'] as (
      r: unknown,
      o: unknown,
    ) => Promise<{ error: unknown }>)(row, { onConflict }))
    return !result.error
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  logger.info('[recalibrate-market] Starting daily market recalibration')

  // ── 1. Fetch closed deals from last 90 days ─────────────────────────────
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const dealsRaw = await dbQuery(
    'deals',
    'id, value_eur, listed_price_eur, city, zone, buyer_intent, days_on_market, closed_at',
    { status: 'closed' },
    { gte: { col: 'closed_at', val: since }, limit: 500 },
  )
  const deals = dealsRaw as DealRow[]

  logger.info('[recalibrate-market] Fetched deals', { count: deals.length })

  // ── 2. Load existing MarketStates per zone ──────────────────────────────
  const zoneStates = new Map<string, MarketState>()
  const zonesInDeals = [...new Set(deals.map(d => normaliseZone(d.city, d.zone)))]

  for (const zone_key of zonesInDeals) {
    const rows = await dbQuery('market_states', 'zone_key, state_json', { zone_key })
    const row = (rows[0] ?? null) as MarketStateRow | null

    if (row?.state_json) {
      try {
        const parsed = JSON.parse(row.state_json) as MarketState
        zoneStates.set(zone_key, { ...parsed, updated_at: new Date(String(parsed.updated_at)) })
      } catch {
        zoneStates.set(zone_key, getDefaultMarketState(zone_key))
      }
    } else {
      zoneStates.set(zone_key, getDefaultMarketState(zone_key))
    }
  }

  // ── 3. Apply each deal as a learning event ──────────────────────────────
  let processed = 0
  let skipped = 0

  for (const deal of deals) {
    const zone_key = normaliseZone(deal.city, deal.zone)
    const state = zoneStates.get(zone_key) ?? getDefaultMarketState(zone_key)

    if (!deal.value_eur || deal.value_eur <= 0) { skipped++; continue }
    if (!deal.listed_price_eur || deal.listed_price_eur <= 0) { skipped++; continue }

    const updated = updateMarketStateFromTransaction(state, {
      days_to_close: deal.days_on_market ?? 210,
      price_eur: deal.value_eur,
      listed_price_eur: deal.listed_price_eur,
      buyer_intent: deal.buyer_intent ?? undefined,
    })

    zoneStates.set(zone_key, updated)
    processed++
  }

  logger.info('[recalibrate-market] Applied transactions', { processed, skipped })

  // ── 4. Persist updated states ────────────────────────────────────────────
  const now = new Date().toISOString()
  let persisted = 0
  const errors: string[] = []

  for (const [zone_key, state] of zoneStates.entries()) {
    const row: MarketStateRow = {
      zone_key,
      state_json: JSON.stringify({ ...state, updated_at: now }),
      updated_at: now,
      data_points: state.data_points,
      confidence: state.confidence,
    }

    const ok = await dbUpsert('market_states', row as unknown as Record<string, unknown>, 'zone_key')
    if (ok) { persisted++ } else { errors.push(zone_key) }
  }

  const durationMs = Date.now() - startedAt

  logger.info('[recalibrate-market] Complete', {
    deals_processed: processed,
    zones_updated: persisted,
    errors: errors.length,
    duration_ms: durationMs,
  })

  return NextResponse.json({
    ok: true,
    deals_processed: processed,
    deals_skipped: skipped,
    zones_updated: persisted,
    zones: [...zoneStates.keys()],
    errors: errors.length > 0 ? errors : undefined,
    duration_ms: durationMs,
    recalibrated_at: now,
  })
}
