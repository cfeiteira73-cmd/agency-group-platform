// Agency Group — ROI Tracker
// lib/ml/roiTracker.ts
// TypeScript strict — 0 errors
//
// Tracks actual vs predicted ROI per deal. Computes prediction accuracy
// for continuous model improvement feedback.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ROITrackerEntry {
  id: string
  tenant_id: string
  deal_id: string
  property_id: string
  investor_id: string | null
  predicted_roi_pct: number | null
  actual_roi_pct: number | null
  prediction_error_pct: number | null
  capital_deployed_eur: number
  gross_return_eur: number | null
  days_to_close: number | null
  tracked_at: string
}

// ---------------------------------------------------------------------------
// trackDealROI
// ---------------------------------------------------------------------------

export async function trackDealROI(
  tenantId: string,
  dealId: string
): Promise<ROITrackerEntry> {
  // 1. Get the deal
  const { data: deal, error: dealErr } = await (supabaseAdmin as any)
    .from('deals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', dealId)
    .single()

  if (dealErr || !deal) {
    log.error('[roiTracker] deal not found', dealErr as Error ?? new Error('not found'), {
      tenant_id: tenantId,
      deal_id: dealId,
    })
    throw dealErr ?? new Error(`Deal not found: ${dealId}`)
  }

  const capital_deployed_eur = (deal.valor_total as number) ?? 0
  const property_id = deal.property_id as string
  const investor_id = (deal.investor_id as string) ?? null

  // 2. Get closing price if available
  let actual_roi_pct: number | null = null
  let gross_return_eur: number | null = null

  if (property_id) {
    const { data: closingRecord } = await (supabaseAdmin as any)
      .from('closing_price_records')
      .select('closing_price_eur, asking_price_eur, price_delta_pct')
      .eq('tenant_id', tenantId)
      .eq('property_id', property_id)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (closingRecord && capital_deployed_eur > 0) {
      const closing = closingRecord.closing_price_eur as number
      gross_return_eur = closing - capital_deployed_eur
      actual_roi_pct = (gross_return_eur / capital_deployed_eur) * 100
    } else if (closingRecord?.price_delta_pct != null) {
      actual_roi_pct = closingRecord.price_delta_pct as number
    }
  }

  // 3. Get prediction from roi_predictions table
  let predicted_roi_pct: number | null = null

  const { data: prediction } = await (supabaseAdmin as any)
    .from('roi_predictions')
    .select('predicted_roi_pct')
    .eq('tenant_id', tenantId)
    .eq('property_id', property_id)
    .order('predicted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prediction?.predicted_roi_pct != null) {
    predicted_roi_pct = prediction.predicted_roi_pct as number
  }

  // 4. Compute prediction_error_pct
  const prediction_error_pct =
    actual_roi_pct != null && predicted_roi_pct != null
      ? actual_roi_pct - predicted_roi_pct
      : null

  // 5. Compute days_to_close
  let days_to_close: number | null = null
  if (deal.created_at && deal.closed_at) {
    const created = new Date(deal.created_at as string).getTime()
    const closed = new Date(deal.closed_at as string).getTime()
    if (!isNaN(created) && !isNaN(closed)) {
      days_to_close = Math.round((closed - created) / (1000 * 60 * 60 * 24))
    }
  }

  const row = {
    tenant_id: tenantId,
    deal_id: dealId,
    property_id,
    investor_id,
    predicted_roi_pct,
    actual_roi_pct,
    prediction_error_pct,
    capital_deployed_eur,
    gross_return_eur,
    days_to_close,
    tracked_at: new Date().toISOString(),
  }

  // UPSERT to roi_tracking (unique on tenant_id, deal_id)
  const { data: inserted, error: upsertErr } = await (supabaseAdmin as any)
    .from('roi_tracking')
    .upsert(row, { onConflict: 'tenant_id,deal_id' })
    .select()
    .single()

  if (upsertErr) {
    log.error('[roiTracker] upsert failed', upsertErr as Error, {
      tenant_id: tenantId,
      deal_id: dealId,
    })
    throw upsertErr
  }

  log.info('[roiTracker] tracked', {
    tenant_id: tenantId,
    deal_id: dealId,
    actual_roi_pct,
    predicted_roi_pct,
    prediction_error_pct,
  })

  return inserted as ROITrackerEntry
}

// ---------------------------------------------------------------------------
// getROIHistory
// ---------------------------------------------------------------------------

export async function getROIHistory(
  tenantId: string,
  opts?: { property_id?: string; investor_id?: string; limit?: number }
): Promise<ROITrackerEntry[]> {
  const limit = opts?.limit ?? 100

  let query = (supabaseAdmin as any)
    .from('roi_tracking')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('tracked_at', { ascending: false })
    .limit(limit)

  if (opts?.property_id) query = query.eq('property_id', opts.property_id)
  if (opts?.investor_id) query = query.eq('investor_id', opts.investor_id)

  const { data, error } = await query

  if (error) {
    log.warn('[roiTracker] getROIHistory failed', { tenant_id: tenantId, error })
    return []
  }

  return (data ?? []) as ROITrackerEntry[]
}

// ---------------------------------------------------------------------------
// computeSystemROIAccuracy
// ---------------------------------------------------------------------------

export async function computeSystemROIAccuracy(tenantId: string): Promise<{
  mean_absolute_error_pct: number
  sample_count: number
  avg_actual_roi_pct: number
  avg_predicted_roi_pct: number
}> {
  const { data, error } = await (supabaseAdmin as any)
    .from('roi_tracking')
    .select('actual_roi_pct, predicted_roi_pct, prediction_error_pct')
    .eq('tenant_id', tenantId)
    .not('actual_roi_pct', 'is', null)
    .not('predicted_roi_pct', 'is', null)
    .order('tracked_at', { ascending: false })
    .limit(500)

  if (error || !data || data.length === 0) {
    return {
      mean_absolute_error_pct: 0,
      sample_count: 0,
      avg_actual_roi_pct: 0,
      avg_predicted_roi_pct: 0,
    }
  }

  const rows = data as Array<{
    actual_roi_pct: number
    predicted_roi_pct: number
    prediction_error_pct: number | null
  }>

  const sample_count = rows.length
  const sum_abs_error = rows.reduce(
    (sum, r) => sum + Math.abs(r.prediction_error_pct ?? (r.actual_roi_pct - r.predicted_roi_pct)),
    0
  )
  const sum_actual = rows.reduce((sum, r) => sum + r.actual_roi_pct, 0)
  const sum_predicted = rows.reduce((sum, r) => sum + r.predicted_roi_pct, 0)

  return {
    mean_absolute_error_pct: round2(sum_abs_error / sample_count),
    sample_count,
    avg_actual_roi_pct: round2(sum_actual / sample_count),
    avg_predicted_roi_pct: round2(sum_predicted / sample_count),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
