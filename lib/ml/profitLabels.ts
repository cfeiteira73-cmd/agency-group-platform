// Agency Group — Profit Labels
// lib/ml/profitLabels.ts
// TypeScript strict — 0 errors
//
// Generates ground-truth profit quality labels from closed deals.
// These labels drive profit-oriented ML training (trainWithProfitLabels).

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfitLabel {
  id: string
  tenant_id: string
  deal_id: string
  property_id: string | null
  investor_id: string | null
  gross_deal_value_eur: number
  commission_eur: number
  net_profit_eur: number
  profit_margin_pct: number
  time_to_close_days: number
  days_on_market: number | null
  time_efficiency_score: number
  competing_bids_count: number
  final_price_vs_ask_pct: number
  liquidity_efficiency_score: number
  label_value: number
  label_class: 'excellent' | 'good' | 'acceptable' | 'poor'
  created_at: string
}

// ---------------------------------------------------------------------------
// generateProfitLabel
// ---------------------------------------------------------------------------

export async function generateProfitLabel(
  tenantId: string,
  dealId: string,
  params: {
    gross_deal_value_eur: number
    commission_rate_pct: number
    days_to_close: number
    days_on_market: number | null
    competing_bids_count: number
    final_price_eur: number
    ask_price_eur: number | null
  },
): Promise<ProfitLabel> {
  const {
    gross_deal_value_eur,
    commission_rate_pct,
    days_to_close,
    days_on_market,
    competing_bids_count,
    final_price_eur,
    ask_price_eur,
  } = params

  // --- Commission & profit ------------------------------------------------
  const commission_eur  = gross_deal_value_eur * (commission_rate_pct / 100)
  const net_profit_eur  = commission_eur * 0.77   // after 23% VAT
  const profit_margin_pct = (net_profit_eur / Math.max(1, gross_deal_value_eur)) * 100

  // --- Time efficiency (0-100) -------------------------------------------
  // 100 at <=30 days, linearly decays to 0 at 365 days
  const time_efficiency_score = Math.max(
    0,
    100 - Math.max(0, days_to_close - 30) * (100 / 335),
  )

  // --- Final price vs ask (%) -------------------------------------------
  const final_price_vs_ask_pct =
    ask_price_eur != null && ask_price_eur > 0
      ? ((final_price_eur - ask_price_eur) / ask_price_eur) * 100
      : 0

  // --- Liquidity efficiency (0-100) ------------------------------------
  const bidComponent  = Math.min(100, competing_bids_count * 25) * 0.5
  const priceComponent = Math.max(0, 50 + final_price_vs_ask_pct * 2) * 0.5
  const liquidity_efficiency_score = Math.min(100, Math.max(0, bidComponent + priceComponent))

  // --- Label value (0-1) -----------------------------------------------
  const label_value = Math.min(
    1,
    (profit_margin_pct / 5) * 0.5 +
    (time_efficiency_score / 100) * 0.3 +
    (liquidity_efficiency_score / 100) * 0.2,
  )

  // --- Label class ------------------------------------------------------
  let label_class: ProfitLabel['label_class']
  if (label_value >= 0.75)      label_class = 'excellent'
  else if (label_value >= 0.50) label_class = 'good'
  else if (label_value >= 0.25) label_class = 'acceptable'
  else                          label_class = 'poor'

  const id  = randomUUID()
  const now = new Date().toISOString()

  const record = {
    id,
    tenant_id:                  tenantId,
    deal_id:                    dealId,
    property_id:                null as string | null,
    investor_id:                null as string | null,
    gross_deal_value_eur,
    commission_eur,
    net_profit_eur,
    profit_margin_pct,
    time_to_close_days:         days_to_close,
    days_on_market,
    time_efficiency_score,
    competing_bids_count,
    final_price_vs_ask_pct,
    liquidity_efficiency_score,
    label_value,
    label_class,
    created_at:                 now,
  }

  const { error } = await (supabaseAdmin as any)
    .from('profit_labels')
    .insert(record)

  if (error) {
    log.warn('[profitLabels] generateProfitLabel — insert failed', {
      error:   error.message,
      deal_id: dealId,
    } as any)
    // Return the computed label even if DB insert failed — caller can use it
  } else {
    log.info('[profitLabels] generateProfitLabel — label created', {
      id,
      deal_id:     dealId,
      label_class,
      label_value: Math.round(label_value * 1000) / 1000,
    } as any)
  }

  return record
}

// ---------------------------------------------------------------------------
// getProfitLabelsForTraining
// ---------------------------------------------------------------------------

export async function getProfitLabelsForTraining(
  tenantId: string,
  fromDate?: string,
): Promise<ProfitLabel[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('profit_labels')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }

    const { data, error } = await query

    if (error) {
      log.error('[profitLabels] getProfitLabelsForTraining — query failed', undefined, {
        error:    error.message,
        tenantId,
      })
      return []
    }

    return (data ?? []) as ProfitLabel[]
  } catch (err) {
    log.error(
      '[profitLabels] getProfitLabelsForTraining — unexpected error',
      err instanceof Error ? err : undefined,
      { tenantId },
    )
    return []
  }
}
