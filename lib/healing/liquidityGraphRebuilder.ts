// Agency Group — Liquidity Graph Rebuilder
// lib/healing/liquidityGraphRebuilder.ts
// TypeScript strict — 0 errors
//
// Rebuilds liquidity state from closed transactions when liquidity data is stale/corrupt.
// Source of truth: completed capital_transactions + settlement_tracking
// SAFE: Read-only from financial tables, writes only to liquidity_scores + market_calibrations

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityRebuildReport {
  rebuild_id: string
  tenant_id: string

  source_data: {
    completed_transactions: number
    settled_properties: number
    avg_days_to_close: number | null
    avg_price_delta_pct: number | null  // from closing_price_ingestion
  }

  rebuilt_metrics: {
    zones_recalibrated: number
    properties_rescored: number
    market_calibration_entries: number
  }

  rebuild_status: 'completed' | 'partial' | 'failed'
  errors: string[]

  executed_at: string
}

// ─── assessLiquidityDataHealth ────────────────────────────────────────────────

/**
 * Checks current liquidity data health:
 * - stale scores (not updated in > 7 days)
 * - missing zone calibrations
 * - last calibration timestamp
 */
export async function assessLiquidityDataHealth(
  tenantId: string,
): Promise<{ stale_scores: number; missing_calibrations: number; last_calibration_at: string | null }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Stale liquidity scores
  const { count: staleCount } = await (supabaseAdmin as any)
    .from('liquidity_scores')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .lt('updated_at', sevenDaysAgo)

  // Missing calibrations: zones without recent calibration
  const { count: missingCalib } = await (supabaseAdmin as any)
    .from('market_zone_calibrations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .lt('calibrated_at', sevenDaysAgo)

  // Last calibration timestamp
  const { data: lastCalibData } = await (supabaseAdmin as any)
    .from('market_zone_calibrations')
    .select('calibrated_at')
    .eq('tenant_id', tenantId)
    .order('calibrated_at', { ascending: false })
    .limit(1)

  const lastCalibAt: string | null =
    Array.isArray(lastCalibData) && lastCalibData.length > 0
      ? (lastCalibData[0] as { calibrated_at: string }).calibrated_at
      : null

  return {
    stale_scores:          typeof staleCount === 'number' ? staleCount : 0,
    missing_calibrations:  typeof missingCalib === 'number' ? missingCalib : 0,
    last_calibration_at:   lastCalibAt,
  }
}

// ─── rebuildFromClosedTransactions ────────────────────────────────────────────

/**
 * Reads settled transactions and closing prices to rebuild zone calibrations.
 * Writes to market_zone_calibrations only.
 * SAFE: Never modifies financial tables.
 */
export async function rebuildFromClosedTransactions(
  tenantId: string,
  dryRun = false,
): Promise<LiquidityRebuildReport> {
  const rebuildId  = randomUUID()
  const executedAt = new Date().toISOString()
  const errors: string[] = []

  // 1. Count completed settlements
  const { count: settlementCount, error: settleErr } = await (supabaseAdmin as any)
    .from('settlement_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')

  if (settleErr) errors.push(`settlement_tracking query: ${settleErr.message}`)

  // 2. Fetch closing prices for delta calculation
  const { data: closingData, error: closingErr } = await (supabaseAdmin as any)
    .from('closing_prices')
    .select('original_price, closing_price, days_to_close, zone_id')
    .eq('tenant_id', tenantId)
    .limit(1000)

  if (closingErr) errors.push(`closing_prices query: ${closingErr.message}`)

  type ClosingRow = {
    original_price: number
    closing_price: number
    days_to_close: number | null
    zone_id: string | null
  }

  const rows: ClosingRow[] = Array.isArray(closingData) ? (closingData as ClosingRow[]) : []
  const completedTxns = typeof settlementCount === 'number' ? settlementCount : 0

  // 3. Calculate averages
  let avgDaysToClose: number | null = null
  let avgPriceDeltaPct: number | null = null

  if (rows.length > 0) {
    const withDays = rows.filter(r => r.days_to_close !== null)
    if (withDays.length > 0) {
      avgDaysToClose =
        withDays.reduce((acc, r) => acc + (r.days_to_close ?? 0), 0) / withDays.length
    }

    const withPrices = rows.filter(r => r.original_price > 0)
    if (withPrices.length > 0) {
      avgPriceDeltaPct =
        withPrices.reduce(
          (acc, r) => acc + ((r.closing_price - r.original_price) / r.original_price) * 100,
          0,
        ) / withPrices.length
    }
  }

  // 4. Group by zone and build calibration entries
  const zoneMap = new Map<string, ClosingRow[]>()
  for (const row of rows) {
    const zone = row.zone_id ?? 'unknown'
    if (!zoneMap.has(zone)) zoneMap.set(zone, [])
    zoneMap.get(zone)!.push(row)
  }

  let zonesRecalibrated = 0
  let calibrationEntries = 0

  if (!dryRun && zoneMap.size > 0) {
    for (const [zoneId, zoneRows] of zoneMap.entries()) {
      const withPrices = zoneRows.filter(r => r.original_price > 0)
      const zoneDelta = withPrices.length > 0
        ? withPrices.reduce(
            (acc, r) => acc + ((r.closing_price - r.original_price) / r.original_price) * 100,
            0,
          ) / withPrices.length
        : 0

      const withDays = zoneRows.filter(r => r.days_to_close !== null)
      const zoneDays = withDays.length > 0
        ? withDays.reduce((acc, r) => acc + (r.days_to_close ?? 0), 0) / withDays.length
        : null

      const { error: calibErr } = await (supabaseAdmin as any)
        .from('market_zone_calibrations')
        .upsert({
          id:                  randomUUID(),
          tenant_id:           tenantId,
          zone_id:             zoneId,
          avg_price_delta_pct: zoneDelta,
          avg_days_to_close:   zoneDays,
          sample_count:        zoneRows.length,
          calibrated_at:       new Date().toISOString(),
          source:              'liquidity_graph_rebuilder',
        }, { onConflict: 'tenant_id,zone_id' })

      if (calibErr) {
        errors.push(`zone ${zoneId} calibration upsert: ${calibErr.message}`)
      } else {
        zonesRecalibrated++
        calibrationEntries++
      }
    }
  } else if (dryRun) {
    zonesRecalibrated = zoneMap.size
    calibrationEntries = zoneMap.size
  }

  const rebuildStatus: LiquidityRebuildReport['rebuild_status'] =
    errors.length === 0 ? 'completed' : zonesRecalibrated > 0 ? 'partial' : 'failed'

  const report: LiquidityRebuildReport = {
    rebuild_id: rebuildId,
    tenant_id:  tenantId,
    source_data: {
      completed_transactions: completedTxns,
      settled_properties:     rows.length,
      avg_days_to_close:      avgDaysToClose,
      avg_price_delta_pct:    avgPriceDeltaPct,
    },
    rebuilt_metrics: {
      zones_recalibrated:          zonesRecalibrated,
      properties_rescored:         0, // updated by rebuildLiquidityScores
      market_calibration_entries:  calibrationEntries,
    },
    rebuild_status: rebuildStatus,
    errors,
    executed_at: executedAt,
  }

  // Persist run
  void (supabaseAdmin as any)
    .from('liquidity_rebuild_runs')
    .insert({
      id:              rebuildId,
      tenant_id:       tenantId,
      source_data:     report.source_data,
      rebuilt_metrics: report.rebuilt_metrics,
      rebuild_status:  rebuildStatus,
      errors,
      executed_at:     executedAt,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[liquidityGraphRebuilder] persist error', { error: error.message })
    })

  log.info('[liquidityGraphRebuilder] rebuild complete', {
    rebuild_id:  rebuildId,
    status:      rebuildStatus,
    zones:       zonesRecalibrated,
    errors:      errors.length,
    tenant_id:   tenantId,
  })

  return report
}

// ─── rebuildLiquidityScores ───────────────────────────────────────────────────

/**
 * Rescores individual properties using freshly rebuilt zone calibrations.
 * Returns count of properties rescored.
 * SAFE: Only writes to liquidity_scores — never touches financial tables.
 */
export async function rebuildLiquidityScores(
  tenantId: string,
  dryRun = false,
): Promise<number> {
  // Fetch all properties needing rescore (stale > 7 days or missing score)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: properties, error: propErr } = await (supabaseAdmin as any)
    .from('properties')
    .select('id, zone_id, list_price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(500)

  if (propErr || !properties) {
    log.warn('[liquidityGraphRebuilder] rebuildLiquidityScores property fetch error', {
      error: propErr?.message,
      tenant_id: tenantId,
    })
    return 0
  }

  // Fetch zone calibrations
  const { data: calibrations, error: calibErr } = await (supabaseAdmin as any)
    .from('market_zone_calibrations')
    .select('zone_id, avg_price_delta_pct, avg_days_to_close')
    .eq('tenant_id', tenantId)
    .gt('calibrated_at', sevenDaysAgo)

  if (calibErr) {
    log.warn('[liquidityGraphRebuilder] calibration fetch error', {
      error: calibErr.message,
      tenant_id: tenantId,
    })
    return 0
  }

  type CalibRow = { zone_id: string; avg_price_delta_pct: number; avg_days_to_close: number | null }
  type PropRow  = { id: string; zone_id: string | null; list_price: number | null }

  const calibMap = new Map<string, CalibRow>()
  for (const c of (calibrations ?? []) as CalibRow[]) {
    calibMap.set(c.zone_id, c)
  }

  if (dryRun) return (properties as PropRow[]).length

  let rescored = 0

  for (const prop of properties as PropRow[]) {
    const calib = prop.zone_id ? calibMap.get(prop.zone_id) : undefined

    // Simple liquidity score: 100 - days_to_close_normalized (capped 0–100)
    const daysNorm = calib?.avg_days_to_close != null
      ? Math.min(100, Math.max(0, 100 - calib.avg_days_to_close / 3.65))
      : 50

    const priceDeltaBonus = calib ? Math.min(10, Math.max(-10, calib.avg_price_delta_pct)) : 0
    const score = Math.round(Math.min(100, Math.max(0, daysNorm + priceDeltaBonus)))

    const { error: upsertErr } = await (supabaseAdmin as any)
      .from('liquidity_scores')
      .upsert({
        id:          randomUUID(),
        tenant_id:   tenantId,
        property_id: prop.id,
        score,
        updated_at:  new Date().toISOString(),
        source:      'liquidity_graph_rebuilder',
      }, { onConflict: 'tenant_id,property_id' })

    if (!upsertErr) rescored++
  }

  log.info('[liquidityGraphRebuilder] rescored properties', {
    rescored,
    tenant_id: tenantId,
  })

  return rescored
}
