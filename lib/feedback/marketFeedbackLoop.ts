// Agency Group — Market Feedback Loop
// lib/feedback/marketFeedbackLoop.ts
// TypeScript strict — 0 errors
//
// Uses real closing prices to calibrate ML predictions against actual market
// outcomes. Produces per-zone calibration metrics stored in market_calibration_runs.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { getRecentClosingPrices } from '@/lib/feedback/closingPriceIngestion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketCalibration {
  tenant_id: string
  zone: string
  sample_count: number
  avg_price_delta_pct: number
  median_days_on_market: number
  cash_purchase_rate: number
  price_discovery_accuracy: number
  liquidity_engine_delta: number
  calibrated_at: string
}

// ---------------------------------------------------------------------------
// runMarketCalibration
// ---------------------------------------------------------------------------

export async function runMarketCalibration(tenantId: string): Promise<MarketCalibration[]> {
  // Fetch all recent closing prices (90 days)
  const allRecords = await getRecentClosingPrices(tenantId, { days: 90, limit: 2000 })

  // Group by zone
  const byZone = new Map<string, typeof allRecords>()
  for (const r of allRecords) {
    const z = r.zone ?? '__unknown__'
    if (!byZone.has(z)) byZone.set(z, [])
    byZone.get(z)!.push(r)
  }

  const results: MarketCalibration[] = []

  for (const [zone, records] of byZone.entries()) {
    if (records.length < 5) continue

    // avg_price_delta_pct
    const withDelta = records.filter(r => r.price_delta_pct != null)
    const avg_price_delta_pct =
      withDelta.length > 0
        ? withDelta.reduce((sum, r) => sum + r.price_delta_pct!, 0) / withDelta.length
        : 0

    // median_days_on_market
    const domValues = records
      .filter(r => r.days_on_market != null && r.days_on_market > 0)
      .map(r => r.days_on_market!)
      .sort((a, b) => a - b)
    const median_days_on_market = domValues.length > 0 ? medianArr(domValues) : 0

    // cash_purchase_rate: % of records where cash_percentage is 100 (or mortgage is null/0)
    const cashDeals = records.filter(
      r => r.cash_percentage != null && r.cash_percentage >= 99
        || (r.mortgage_amount_eur != null && r.mortgage_amount_eur === 0)
        || (r.cash_percentage == null && r.mortgage_amount_eur == null)
    )
    const cash_purchase_rate = cashDeals.length / records.length

    // price_discovery_accuracy: compare ML predictions to actual closing prices if available
    let price_discovery_accuracy = 0.5 // default neutral
    try {
      const propertyIds = records
        .filter(r => r.property_id != null)
        .map(r => r.property_id!)
        .slice(0, 50)

      if (propertyIds.length > 0) {
        const { data: predictions } = await (supabaseAdmin as any)
          .from('roi_predictions')
          .select('property_id, predicted_roi_pct')
          .eq('tenant_id', tenantId)
          .in('property_id', propertyIds)
          .order('predicted_at', { ascending: false })
          .limit(propertyIds.length)

        if (predictions && predictions.length > 0) {
          // Accuracy: how close predicted ROI correlates to actual price delta
          // Simplified: count predictions within 5% of avg delta → accuracy score
          let accurate = 0
          for (const pred of predictions) {
            const predicted = pred.predicted_roi_pct as number
            const actual = avg_price_delta_pct
            if (Math.abs(predicted - actual) <= 5) accurate++
          }
          price_discovery_accuracy = accurate / predictions.length
        }
      }
    } catch (err) {
      log.warn('[marketFeedbackLoop] prediction comparison failed', { tenant_id: tenantId, zone, error: err })
    }

    // liquidity_engine_delta: diff between predicted and actual days-to-close
    let liquidity_engine_delta = 0
    try {
      const { data: snapshots } = await (supabaseAdmin as any)
        .from('liquidity_snapshots')
        .select('predicted_days_to_sale')
        .eq('tenant_id', tenantId)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (snapshots && typeof snapshots.predicted_days_to_sale === 'number' && median_days_on_market > 0) {
        liquidity_engine_delta = snapshots.predicted_days_to_sale - median_days_on_market
      }
    } catch {
      // liquidity_snapshots may not have data — use 0
    }

    const calibrated_at = new Date().toISOString()

    const calibration: MarketCalibration = {
      tenant_id: tenantId,
      zone,
      sample_count: records.length,
      avg_price_delta_pct,
      median_days_on_market,
      cash_purchase_rate,
      price_discovery_accuracy,
      liquidity_engine_delta,
      calibrated_at,
    }

    // UPSERT to market_calibration_runs
    void (supabaseAdmin as any)
      .from('market_calibration_runs')
      .upsert(
        {
          tenant_id: tenantId,
          zone,
          sample_count: records.length,
          avg_price_delta_pct,
          median_days_on_market,
          cash_purchase_rate,
          price_discovery_accuracy,
          liquidity_engine_delta,
          calibrated_at,
        },
        { onConflict: 'tenant_id,zone,calibrated_at' }
      )
      .then(({ error }: { error: unknown }) => {
        if (error) {
          log.warn('[marketFeedbackLoop] upsert failed', { tenant_id: tenantId, zone, error })
        }
      })

    results.push(calibration)
  }

  log.info('[marketFeedbackLoop] calibration complete', {
    tenant_id: tenantId,
    zones_calibrated: results.length,
  })

  return results
}

// ---------------------------------------------------------------------------
// getLatestCalibration
// ---------------------------------------------------------------------------

export async function getLatestCalibration(
  tenantId: string,
  zone?: string
): Promise<MarketCalibration[]> {
  let query = (supabaseAdmin as any)
    .from('market_calibration_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('calibrated_at', { ascending: false })
    .limit(zone ? 1 : 50)

  if (zone) query = query.eq('zone', zone)

  const { data, error } = await query

  if (error) {
    log.warn('[marketFeedbackLoop] getLatestCalibration failed', { tenant_id: tenantId, error })
    return []
  }

  return (data ?? []) as MarketCalibration[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function medianArr(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}
