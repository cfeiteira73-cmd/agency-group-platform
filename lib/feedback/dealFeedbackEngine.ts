// =============================================================================
// Agency Group — Deal Feedback Engine
// lib/feedback/dealFeedbackEngine.ts
//
// Every real action on an opportunity feeds back into the system to improve
// scoring and matching. Captures feedback signals (views, bids, closes, passes)
// and injects them back into opportunity demand scoring.
//
// EUR cents arithmetic: integer bigint, never float for money.
// Fire-and-forget: void promise.catch(e => console.warn('[module]', e))
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedbackSignalType =
  | 'OPPORTUNITY_VIEWED'    // interest signal
  | 'BID_SUBMITTED'         // demand signal
  | 'BID_ACCEPTED'          // closing signal
  | 'DEAL_CLOSED'           // truth label (highest value)
  | 'DEAL_FAILED'           // negative signal
  | 'OPPORTUNITY_PASSED'    // explicit rejection
  | 'PRICE_REDUCED'         // seller capitulation signal
  | 'DELISTED'              // removed from market
  | 'TIME_EXPIRED'          // expired without close

export type SignalWeight = {
  [K in FeedbackSignalType]: number
}

export interface FeedbackSignal {
  signal_id: string
  tenant_id: string
  opportunity_id: string
  asset_id: string
  investor_id: string | null
  signal_type: FeedbackSignalType
  signal_weight: number           // from SIGNAL_WEIGHTS map
  metadata: Record<string, unknown>
  is_truth_label: boolean         // true for DEAL_CLOSED and DEAL_FAILED
  actual_price_eur_cents: number | null  // for DEAL_CLOSED
  actual_days_to_close: number | null
  occurred_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SIGNAL_WEIGHTS: SignalWeight = {
  OPPORTUNITY_VIEWED:  1,
  BID_SUBMITTED:       10,
  BID_ACCEPTED:        25,
  DEAL_CLOSED:         50,
  DEAL_FAILED:         -20,
  OPPORTUNITY_PASSED:  -5,
  PRICE_REDUCED:       3,
  DELISTED:            -10,
  TIME_EXPIRED:        -8,
}

// ---------------------------------------------------------------------------
// recordFeedbackSignal
// ---------------------------------------------------------------------------

/**
 * Computes signal_weight from SIGNAL_WEIGHTS, persists to feedback_signals.
 * For DEAL_CLOSED: also fires recordRealOutcome to real_outcomes table.
 * Returns the persisted FeedbackSignal.
 */
export async function recordFeedbackSignal(
  signal: Omit<FeedbackSignal, 'signal_id' | 'signal_weight'>,
): Promise<FeedbackSignal> {
  const signalWeight = SIGNAL_WEIGHTS[signal.signal_type]
  const isTruthLabel = signal.signal_type === 'DEAL_CLOSED' || signal.signal_type === 'DEAL_FAILED'

  const row = {
    tenant_id:               signal.tenant_id,
    opportunity_id:          signal.opportunity_id,
    asset_id:                signal.asset_id,
    investor_id:             signal.investor_id ?? null,
    signal_type:             signal.signal_type,
    signal_weight:           signalWeight,
    metadata:                signal.metadata,
    is_truth_label:          isTruthLabel,
    actual_price_eur_cents:  signal.actual_price_eur_cents ?? null,
    actual_days_to_close:    signal.actual_days_to_close ?? null,
    occurred_at:             signal.occurred_at,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[dealFeedbackEngine] recordFeedbackSignal failed', new Error(error.message), {
      opportunity_id: signal.opportunity_id,
    })
    throw new Error(`recordFeedbackSignal: ${error.message}`)
  }

  const persisted: FeedbackSignal = {
    signal_id:               data.signal_id as string,
    tenant_id:               data.tenant_id as string,
    opportunity_id:          data.opportunity_id as string,
    asset_id:                data.asset_id as string,
    investor_id:             data.investor_id as string | null,
    signal_type:             data.signal_type as FeedbackSignalType,
    signal_weight:           data.signal_weight as number,
    metadata:                (data.metadata ?? {}) as Record<string, unknown>,
    is_truth_label:          data.is_truth_label as boolean,
    actual_price_eur_cents:  data.actual_price_eur_cents as number | null,
    actual_days_to_close:    data.actual_days_to_close as number | null,
    occurred_at:             data.occurred_at as string,
  }

  // For DEAL_CLOSED: fire-and-forget persist to real_outcomes
  if (signal.signal_type === 'DEAL_CLOSED' && signal.actual_price_eur_cents != null) {
    void _persistRealOutcome(signal).catch(e =>
      console.warn('[dealFeedbackEngine] persistRealOutcome fire-and-forget failed', e),
    )
  }

  // Inject feedback into scoring (fire-and-forget)
  void injectFeedbackIntoScoring(signal.opportunity_id, signal.tenant_id).catch(e =>
    console.warn('[dealFeedbackEngine] injectFeedbackIntoScoring fire-and-forget failed', e),
  )

  return persisted
}

// ---------------------------------------------------------------------------
// Internal: persist to real_outcomes
// ---------------------------------------------------------------------------

async function _persistRealOutcome(
  signal: Omit<FeedbackSignal, 'signal_id' | 'signal_weight'>,
): Promise<void> {
  const askingPriceRow = await _fetchAssetAskingPrice(signal.asset_id, signal.tenant_id)
  const askingCents    = askingPriceRow ?? 0
  const actualCents    = signal.actual_price_eur_cents ?? 0

  // ROI = (actual - asking) / asking * 100
  const roiPct = askingCents > 0
    ? ((actualCents - askingCents) / askingCents) * 100
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .insert({
      tenant_id:               signal.tenant_id,
      opportunity_id:          signal.opportunity_id,
      asset_id:                signal.asset_id,
      investor_id:             signal.investor_id ?? null,
      actual_price_eur_cents:  signal.actual_price_eur_cents,
      asking_price_eur_cents:  askingCents > 0 ? askingCents : null,
      roi_pct:                 roiPct,
      days_to_close:           signal.actual_days_to_close ?? null,
      occurred_at:             signal.occurred_at,
    })

  if (error) {
    log.warn('[dealFeedbackEngine] _persistRealOutcome upsert failed', { detail: error.message })
  }
}

async function _fetchAssetAskingPrice(
  assetId: string,
  tenantId: string,
): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('asking_price_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('id', assetId)
      .maybeSingle()

    return data?.asking_price_eur_cents ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// getFeedbackSummary
// ---------------------------------------------------------------------------

/**
 * Aggregates feedback signals for a given opportunity.
 */
export async function getFeedbackSummary(
  opportunityId: string,
  tenantId: string,
): Promise<{
  total_signals: number
  net_score: number
  last_signal_at: string | null
  truth_label: string | null
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('signal_weight, is_truth_label, signal_type, occurred_at')
    .eq('tenant_id', tenantId)
    .eq('opportunity_id', opportunityId)
    .order('occurred_at', { ascending: false })

  if (error) {
    throw new Error(`getFeedbackSummary: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{
    signal_weight:  number
    is_truth_label: boolean
    signal_type:    string
    occurred_at:    string
  }>

  const total_signals   = rows.length
  const net_score       = rows.reduce((sum, r) => sum + (r.signal_weight ?? 0), 0)
  const last_signal_at  = rows.length > 0 ? rows[0].occurred_at : null
  const truthRow        = rows.find(r => r.is_truth_label)
  const truth_label     = truthRow?.signal_type ?? null

  return { total_signals, net_score, last_signal_at, truth_label }
}

// ---------------------------------------------------------------------------
// getOpportunityPerformanceMetrics
// ---------------------------------------------------------------------------

/**
 * Reads DEAL_CLOSED vs total opportunities, computes key metrics.
 */
export async function getOpportunityPerformanceMetrics(
  tenantId: string,
  since?: Date,
): Promise<{
  close_rate: number
  avg_days_to_close: number
  avg_roi_pct: number
  top_performing_type: string
}> {
  const sinceIso = since?.toISOString() ?? new Date(0).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signals, error } = await (supabaseAdmin as any)
    .from('feedback_signals')
    .select('signal_type, actual_days_to_close, metadata, opportunity_id')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', sinceIso)

  if (error) {
    throw new Error(`getOpportunityPerformanceMetrics: ${error.message}`)
  }

  const rows = (signals ?? []) as Array<{
    signal_type:         string
    actual_days_to_close: number | null
    metadata:            Record<string, unknown>
    opportunity_id:      string
  }>

  // Unique opportunities seen
  const uniqueOpportunities = new Set(rows.map(r => r.opportunity_id))
  const totalOpportunities  = uniqueOpportunities.size

  const closedRows = rows.filter(r => r.signal_type === 'DEAL_CLOSED')
  const close_rate = totalOpportunities > 0
    ? closedRows.length / totalOpportunities
    : 0

  // Avg days to close
  const daysRows = closedRows.filter(r => r.actual_days_to_close != null)
  const avg_days_to_close = daysRows.length > 0
    ? daysRows.reduce((sum, r) => sum + (r.actual_days_to_close ?? 0), 0) / daysRows.length
    : 0

  // Avg ROI from real_outcomes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outcomesData } = await (supabaseAdmin as any)
    .from('real_outcomes')
    .select('roi_pct, opportunity_id')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', sinceIso)
    .not('roi_pct', 'is', null)

  const outcomeRows = (outcomesData ?? []) as Array<{ roi_pct: number; opportunity_id: string }>
  const avg_roi_pct = outcomeRows.length > 0
    ? outcomeRows.reduce((sum, r) => sum + (r.roi_pct ?? 0), 0) / outcomeRows.length
    : 0

  // Top performing type: most DEAL_CLOSED by opportunity_type from metadata
  const typeCounts: Record<string, number> = {}
  for (const r of closedRows) {
    const t = (r.metadata?.opportunity_type as string) ?? 'UNKNOWN'
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  let top_performing_type = 'UNKNOWN'
  let topCount = 0
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > topCount) {
      top_performing_type = type
      topCount = count
    }
  }

  return {
    close_rate:          Math.min(1, close_rate),
    avg_days_to_close:   Math.round(avg_days_to_close * 10) / 10,
    avg_roi_pct:         Math.round(avg_roi_pct * 100) / 100,
    top_performing_type,
  }
}

// ---------------------------------------------------------------------------
// injectFeedbackIntoScoring
// ---------------------------------------------------------------------------

/**
 * Updates demand_score in opportunity_demand_signals based on net feedback score.
 * Fire-and-forget caller pattern.
 */
export async function injectFeedbackIntoScoring(
  opportunityId: string,
  tenantId: string,
): Promise<void> {
  try {
    const summary  = await getFeedbackSummary(opportunityId, tenantId)
    const rawScore = summary.net_score

    // Clamp to 0-100 for demand_score
    const demandScore = Math.max(0, Math.min(100, 50 + rawScore))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('opportunity_demand_signals')
      .upsert(
        {
          tenant_id:       tenantId,
          opportunity_id:  opportunityId,
          demand_score:    demandScore,
          signal_count:    summary.total_signals,
          net_feedback:    rawScore,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,opportunity_id' },
      )

    if (error) {
      log.warn('[dealFeedbackEngine] injectFeedbackIntoScoring upsert failed', {
        detail: error.message,
        opportunity_id: opportunityId,
      })
    }
  } catch (e) {
    log.warn('[dealFeedbackEngine] injectFeedbackIntoScoring error', { detail: String(e) })
  }
}
