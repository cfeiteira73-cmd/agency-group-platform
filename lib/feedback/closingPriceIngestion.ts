// Agency Group — Closing Price Ingestion
// lib/feedback/closingPriceIngestion.ts
// TypeScript strict — 0 errors
//
// Ingests real closing prices from notário/escritura records and provides
// zone-level median computation for market calibration.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClosingPriceRecord {
  id: string
  tenant_id: string
  property_id: string | null
  external_asset_id: string | null
  closing_price_eur: number
  asking_price_eur: number | null
  price_delta_pct: number | null   // (closing - asking) / asking * 100
  source: 'notario' | 'bank_confirmation' | 'manual' | 'registry'
  district: string
  zone: string | null
  typology: string | null
  area_sqm: number | null
  closed_at: string      // ISO date of actual transfer
  mortgage_amount_eur: number | null
  cash_percentage: number | null
  days_on_market: number | null
  ingested_at: string
}

// ---------------------------------------------------------------------------
// ingestClosingPrice
// ---------------------------------------------------------------------------

export async function ingestClosingPrice(
  tenantId: string,
  data: Omit<ClosingPriceRecord, 'id' | 'tenant_id' | 'price_delta_pct' | 'ingested_at'>
): Promise<ClosingPriceRecord> {
  const price_delta_pct =
    data.asking_price_eur != null && data.asking_price_eur > 0
      ? ((data.closing_price_eur - data.asking_price_eur) / data.asking_price_eur) * 100
      : null

  const row = {
    tenant_id: tenantId,
    property_id: data.property_id,
    external_asset_id: data.external_asset_id,
    closing_price_eur: data.closing_price_eur,
    asking_price_eur: data.asking_price_eur,
    price_delta_pct,
    source: data.source,
    district: data.district,
    zone: data.zone,
    typology: data.typology,
    area_sqm: data.area_sqm,
    closed_at: data.closed_at,
    mortgage_amount_eur: data.mortgage_amount_eur,
    cash_percentage: data.cash_percentage,
    days_on_market: data.days_on_market,
    ingested_at: new Date().toISOString(),
  }

  const { data: inserted, error } = await (supabaseAdmin as any)
    .from('closing_price_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[closingPriceIngestion] insert failed', error as Error, { tenant_id: tenantId })
    throw error
  }

  log.info('[closingPriceIngestion] ingested', {
    tenant_id: tenantId,
    id: inserted.id,
    closing_price_eur: data.closing_price_eur,
    zone: data.zone,
    price_delta_pct,
  })

  return inserted as ClosingPriceRecord
}

// ---------------------------------------------------------------------------
// getRecentClosingPrices
// ---------------------------------------------------------------------------

export async function getRecentClosingPrices(
  tenantId: string,
  opts?: { zone?: string; district?: string; days?: number; limit?: number }
): Promise<ClosingPriceRecord[]> {
  const days = opts?.days ?? 90
  const limit = opts?.limit ?? 100
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = (supabaseAdmin as any)
    .from('closing_price_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('closed_at', since)
    .order('closed_at', { ascending: false })
    .limit(limit)

  if (opts?.zone) query = query.eq('zone', opts.zone)
  if (opts?.district) query = query.eq('district', opts.district)

  const { data, error } = await query

  if (error) {
    log.warn('[closingPriceIngestion] getRecentClosingPrices failed', { tenant_id: tenantId, error })
    return []
  }

  return (data ?? []) as ClosingPriceRecord[]
}

// ---------------------------------------------------------------------------
// computeZoneMedianClosingPrice
// ---------------------------------------------------------------------------

export async function computeZoneMedianClosingPrice(
  tenantId: string,
  zone: string,
  days = 90
): Promise<{ zone: string; median_price_eur: number; median_price_per_sqm: number; sample_count: number } | null> {
  const records = await getRecentClosingPrices(tenantId, { zone, days, limit: 500 })

  if (records.length === 0) return null

  const prices = records.map(r => r.closing_price_eur).sort((a, b) => a - b)
  const median_price_eur = median(prices)

  const withArea = records.filter(r => r.area_sqm != null && r.area_sqm > 0)
  const pricePerSqm = withArea
    .map(r => r.closing_price_eur / r.area_sqm!)
    .sort((a, b) => a - b)
  const median_price_per_sqm = pricePerSqm.length > 0 ? median(pricePerSqm) : 0

  return {
    zone,
    median_price_eur,
    median_price_per_sqm,
    sample_count: records.length,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
