// Agency Group — ML Feedback Loop
// lib/ml/feedbackLoop.ts
// TypeScript strict — 0 errors
//
// When deals close or investors convert: record outcome labels on feature snapshots.
// This grows the labeled training dataset over time.
// Weekly retraining job exports this data for Python/XGBoost training.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { snapshotFeatures, extractDealFeatures, extractInvestorFeatures } from '@/lib/ml/featureExtractor'

export type OutcomeLabel = 'converted' | 'closed_won' | 'closed_lost' | 'expired' | 'rejected'

export interface DealOutcome {
  dealId: string
  tenantId: string
  outcome: OutcomeLabel
  dealValueEur: number | null
  daysInPipeline: number | null
  agentEmail: string | null
  closedAt: string
}

export interface InvestorOutcome {
  investorId: string
  propertyId: string
  tenantId: string
  outcome: OutcomeLabel
  matchScore: number
  responseTimeHours: number | null
  occurredAt: string
}

// ---------------------------------------------------------------------------
// recordDealOutcome
// Called when a deal reaches a terminal stage (won or lost).
// Labels all feature snapshots for this deal's entity_id with the outcome.
// ---------------------------------------------------------------------------

export async function recordDealOutcome(outcome: DealOutcome): Promise<void> {
  const labelValue = outcome.outcome === 'closed_won' ? 1.0 : 0.0

  try {
    // 1. Update existing feature snapshots for this deal with the outcome label
    const { error: updateErr } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .update({
        label_outcome: outcome.outcome,
        label_value:   labelValue,
      })
      .eq('entity_id', outcome.dealId)
      .eq('entity_type', 'deal')
      .eq('tenant_id', outcome.tenantId)

    if (updateErr) {
      log.error('[feedbackLoop] recordDealOutcome — update snapshots failed', undefined, { error: updateErr.message, deal_id: outcome.dealId })
    }

    // 2. Snapshot current deal features at close time, labeled with outcome
    try {
      const dealFeatures = await extractDealFeatures(outcome.dealId, outcome.tenantId)
      const closureFeatures = {
        ...dealFeatures,
        close_deal_value_eur:  outcome.dealValueEur,
        close_days_in_pipeline: outcome.daysInPipeline,
        close_agent_email:     outcome.agentEmail,
        closed_at:             outcome.closedAt,
      }
      await snapshotFeatures(
        'deal',
        outcome.dealId,
        outcome.tenantId,
        closureFeatures as Record<string, unknown>,
        outcome.outcome,
        labelValue,
      )
    } catch (snapErr) {
      log.error('[feedbackLoop] recordDealOutcome — closure snapshot failed (non-critical)', snapErr instanceof Error ? snapErr : undefined, { error: snapErr instanceof Error ? snapErr.message : String(snapErr), deal_id: outcome.dealId })
    }

    // Generate profit label (fire-and-forget, non-critical)
    if (outcome.outcome === 'closed_won' && outcome.dealValueEur) {
      const { generateProfitLabel } = await import('@/lib/ml/profitLabels')
      void generateProfitLabel(outcome.tenantId, outcome.dealId, {
        gross_deal_value_eur:   outcome.dealValueEur,
        commission_rate_pct:    outcome.dealValueEur >= 5_000_000 ? 4 : outcome.dealValueEur >= 1_000_000 ? 4.5 : 5,
        days_to_close:          outcome.daysInPipeline ?? 90,
        days_on_market:         null,
        competing_bids_count:   0,
        final_price_eur:        outcome.dealValueEur,
        ask_price_eur:          null,
      }).catch((e: unknown) => log.warn('[feedbackLoop] profitLabel generation failed', { error: e instanceof Error ? e.message : String(e) } as any))
    }

    // Record RL reward signal (fire-and-forget, non-critical)
    const { recordReward } = await import('@/lib/ml/rewardFunction')
    void recordReward(
      outcome.dealId,
      '',
      outcome.tenantId,
      {
        won:                          outcome.outcome === 'closed_won',
        actual_profit_eur:            outcome.dealValueEur ? outcome.dealValueEur * 0.05 : 0,
        time_to_close_days:           outcome.daysInPipeline ?? 90,
        expected_time_to_close_days:  90,
        max_possible_profit_eur:      outcome.dealValueEur ? outcome.dealValueEur * 0.05 : 50_000,
      }
    ).catch(() => {})
  } catch (err) {
    log.error('[feedbackLoop] recordDealOutcome — unexpected error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), deal_id: outcome.dealId })
  }
}

// ---------------------------------------------------------------------------
// recordInvestorOutcome
// Called when an investor converts (offer_made or deal_closed engagement event).
// Labels feature snapshots for this investor-property pair.
// ---------------------------------------------------------------------------

export async function recordInvestorOutcome(outcome: InvestorOutcome): Promise<void> {
  const labelValue = outcome.outcome === 'converted' || outcome.outcome === 'closed_won' ? 1.0 : 0.0

  try {
    // 1. Update existing feature snapshots for the investor
    const { error: invUpdateErr } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .update({
        label_outcome: outcome.outcome,
        label_value:   labelValue,
      })
      .eq('entity_id', outcome.investorId)
      .eq('entity_type', 'investor')
      .eq('tenant_id', outcome.tenantId)

    if (invUpdateErr) {
      log.error('[feedbackLoop] recordInvestorOutcome — update investor snapshots failed', undefined, { error: invUpdateErr.message, lead_id: outcome.investorId })
    }

    // 2. Update existing feature snapshots for the property involved
    const { error: propUpdateErr } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .update({
        label_outcome: outcome.outcome,
        label_value:   labelValue,
      })
      .eq('entity_id', outcome.propertyId)
      .eq('entity_type', 'property')
      .eq('tenant_id', outcome.tenantId)

    if (propUpdateErr) {
      log.error('[feedbackLoop] recordInvestorOutcome — update property snapshots failed', undefined, { error: propUpdateErr.message, property_id: outcome.propertyId })
    }

    // 3. Snapshot current investor features at outcome time
    try {
      const investorFeatures = await extractInvestorFeatures(outcome.investorId, outcome.tenantId)
      const outcomeFeatures = {
        ...investorFeatures,
        outcome_property_id:      outcome.propertyId,
        outcome_match_score:      outcome.matchScore,
        outcome_response_time_hrs: outcome.responseTimeHours,
        outcome_occurred_at:      outcome.occurredAt,
      }
      await snapshotFeatures(
        'investor',
        outcome.investorId,
        outcome.tenantId,
        outcomeFeatures as Record<string, unknown>,
        outcome.outcome,
        labelValue,
      )
    } catch (snapErr) {
      log.error('[feedbackLoop] recordInvestorOutcome — investor snapshot failed (non-critical)', snapErr instanceof Error ? snapErr : undefined, { error: snapErr instanceof Error ? snapErr.message : String(snapErr), lead_id: outcome.investorId })
    }
  } catch (err) {
    log.error('[feedbackLoop] recordInvestorOutcome — unexpected error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), lead_id: outcome.investorId })
  }
}

// ---------------------------------------------------------------------------
// getLabeledCount
// Returns labeled training data statistics for a tenant.
// ---------------------------------------------------------------------------

export async function getLabeledCount(tenantId: string): Promise<{
  total: number
  by_entity_type: Record<string, number>
  by_outcome: Record<string, number>
  oldest_label: string | null
  newest_label: string | null
}> {
  const empty = {
    total: 0,
    by_entity_type: {},
    by_outcome: {},
    oldest_label: null,
    newest_label: null,
  }

  try {
    // Fetch all labeled records (label_outcome is not null)
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('entity_type, label_outcome, computed_at')
      .eq('tenant_id', tenantId)
      .not('label_outcome', 'is', null)
      .order('computed_at', { ascending: true })
      .limit(10000)

    if (error) {
      log.error('[feedbackLoop] getLabeledCount — query failed', undefined, { error: error.message })
      return empty
    }

    const rows: { entity_type: string; label_outcome: string; computed_at: string }[] = data ?? []

    if (rows.length === 0) return empty

    const by_entity_type: Record<string, number> = {}
    const by_outcome: Record<string, number> = {}

    for (const row of rows) {
      by_entity_type[row.entity_type] = (by_entity_type[row.entity_type] ?? 0) + 1
      by_outcome[row.label_outcome]   = (by_outcome[row.label_outcome] ?? 0) + 1
    }

    return {
      total:          rows.length,
      by_entity_type,
      by_outcome,
      oldest_label:   rows[0]?.computed_at ?? null,
      newest_label:   rows[rows.length - 1]?.computed_at ?? null,
    }
  } catch (err) {
    log.error('[feedbackLoop] getLabeledCount — unexpected error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err) })
    return empty
  }
}
