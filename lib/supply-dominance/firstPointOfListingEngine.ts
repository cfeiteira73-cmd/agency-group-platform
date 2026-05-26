// Agency Group — First Point of Listing Engine
// lib/supply-dominance/firstPointOfListingEngine.ts
//
// Captures listings before they appear on public portals.
// Detects first-mover advantage and prioritizes distribution.
//
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FirstMoverSignal {
  signal_id: string
  tenant_id: string
  asset_id: string
  source: string
  days_ahead_of_market: number
  is_exclusive: boolean
  first_seen_at: string
  market: string
  city: string
  asking_price_eur_cents: number
}

// ─── detectFirstMoverListings ─────────────────────────────────────────────────

export async function detectFirstMoverListings(
  tenantId: string,
  sinceHours = 24,
): Promise<FirstMoverSignal[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

  // Fetch candidates: BROKER_CRM or days_on_market < 3, ingested recently
  const { data: candidates, error } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .select(
      'id, source_id, source, market, city, asking_price_eur_cents, days_on_market, is_exclusive, ingested_at, data_observed',
    )
    .eq('tenant_id', tenantId)
    .gte('ingested_at', since.toISOString())
    .or('source.eq.BROKER_CRM,days_on_market.lt.3')

  if (error) {
    log.warn('[firstPointOfListingEngine] query error', { error })
    return []
  }

  type CandidateRow = {
    id: string
    source_id: string
    source: string
    market: string
    city: string
    asking_price_eur_cents: number
    days_on_market: number | null
    is_exclusive: boolean | null
    ingested_at: string
    data_observed: Record<string, unknown>
  }

  const rows = (candidates ?? []) as CandidateRow[]
  const signals: FirstMoverSignal[] = []

  for (const row of rows) {
    // Check if same asset (price + city) appears in non-BROKER_CRM source
    //  → only if it does NOT appear elsewhere, it qualifies as first-mover
    const priceMin = Math.round(row.asking_price_eur_cents * 0.95)
    const priceMax = Math.round(row.asking_price_eur_cents * 1.05)

    const { count: duplicateCount } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('city', row.city)
      .neq('source', 'BROKER_CRM')
      .gte('asking_price_eur_cents', priceMin)
      .lte('asking_price_eur_cents', priceMax)
      .not('id', 'eq', row.id)

    // It's a first-mover if no portal duplicate found
    const isFirstMover = (duplicateCount ?? 0) === 0
    if (!isFirstMover) continue

    const daysOnMarket = row.days_on_market ?? 0
    const daysAhead = row.source === 'BROKER_CRM' ? Math.max(7, 7 - daysOnMarket) : Math.max(0, 3 - daysOnMarket)

    const signal: FirstMoverSignal = {
      signal_id: randomUUID(),
      tenant_id: tenantId,
      asset_id: row.source_id,
      source: row.source,
      days_ahead_of_market: daysAhead,
      is_exclusive: row.is_exclusive ?? false,
      first_seen_at: row.ingested_at,
      market: row.market,
      city: row.city,
      asking_price_eur_cents: row.asking_price_eur_cents,
    }

    signals.push(signal)
  }

  // Persist all signals
  if (signals.length > 0) {
    void (supabaseAdmin as any)
      .from('first_mover_signals')
      .upsert(
        signals.map((s) => ({
          signal_id: s.signal_id,
          tenant_id: s.tenant_id,
          asset_id: s.asset_id,
          source: s.source,
          days_ahead_of_market: s.days_ahead_of_market,
          is_exclusive: s.is_exclusive,
          first_seen_at: s.first_seen_at,
          market: s.market,
          city: s.city,
          asking_price_eur_cents: s.asking_price_eur_cents,
        })),
        { onConflict: 'signal_id' },
      )
      .catch((e: unknown) =>
        log.warn('[firstPointOfListingEngine] persist error', { e }),
      )
  }

  log.info('[firstPointOfListingEngine] detected', {
    tenantId,
    sinceHours,
    candidates: rows.length,
    firstMovers: signals.length,
  })

  return signals
}

// ─── getFirstMoverStats ───────────────────────────────────────────────────────

export async function getFirstMoverStats(tenantId: string): Promise<{
  total_first_mover_30d: number
  exclusive_30d: number
  avg_days_ahead: number | null
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { data, error } = await (supabaseAdmin as any)
    .from('first_mover_signals')
    .select('is_exclusive, days_ahead_of_market')
    .eq('tenant_id', tenantId)
    .gte('first_seen_at', thirtyDaysAgo.toISOString())

  if (error) {
    log.warn('[firstPointOfListingEngine] stats error', { error })
    return { total_first_mover_30d: 0, exclusive_30d: 0, avg_days_ahead: null }
  }

  type StatsRow = { is_exclusive: boolean; days_ahead_of_market: number }
  const rows = (data ?? []) as StatsRow[]

  const totalFirstMover30d = rows.length
  const exclusive30d = rows.filter((r) => r.is_exclusive).length
  const totalDays = rows.reduce((s, r) => s + (r.days_ahead_of_market ?? 0), 0)
  const avgDaysAhead = rows.length > 0 ? Math.round((totalDays / rows.length) * 10) / 10 : null

  return { total_first_mover_30d: totalFirstMover30d, exclusive_30d: exclusive30d, avg_days_ahead: avgDaysAhead }
}

// ─── prioritizeFirstMoverOpportunities ───────────────────────────────────────

export async function prioritizeFirstMoverOpportunities(
  tenantId: string,
): Promise<string[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Get first-mover asset_ids and join with detected_opportunities for scoring
  const { data: signalRows } = await (supabaseAdmin as any)
    .from('first_mover_signals')
    .select('asset_id')
    .eq('tenant_id', tenantId)
    .gte('first_seen_at', thirtyDaysAgo.toISOString())

  type SignalRow = { asset_id: string }
  const assetIds = ((signalRows ?? []) as SignalRow[]).map((r) => r.asset_id)

  if (assetIds.length === 0) return []

  // Fetch matching detected_opportunities sorted by opportunity_score
  const { data: oppRows } = await (supabaseAdmin as any)
    .from('detected_opportunities')
    .select('asset_id, opportunity_score')
    .eq('tenant_id', tenantId)
    .in('asset_id', assetIds)
    .eq('status', 'ACTIVE')
    .order('opportunity_score', { ascending: false })

  type OppRow = { asset_id: string; opportunity_score: number }
  const sorted = ((oppRows ?? []) as OppRow[]).map((r) => r.asset_id)

  // Include any first-mover assets that don't have detected_opportunities yet
  const inOpps = new Set<string>(sorted)
  const extra = assetIds.filter((id) => !inOpps.has(id))

  log.info('[firstPointOfListingEngine] prioritized', {
    tenantId,
    count: sorted.length + extra.length,
  })

  return [...sorted, ...extra]
}
