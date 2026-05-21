// =============================================================================
// Agency Group — Capital Pipeline Trace Engine
// lib/economics/capitalPipeline.ts
//
// Full trace from lead qualification → property match → deal → bid →
// CPCV → Escritura → commission payment.
//
// Reconstructed from:
//   - causal_trace table (correlation chain)
//   - financial_ledger entries (financial events)
//   - deals table (stage history + timestamps)
//   - investor_engagement_events (bid/offer events)
//
// AMI: 22506 | SH-ROS | TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { STAGE_PROBABILITY } from '@/lib/constants/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineStep {
  step_name: string
  step_type: 'lead' | 'match' | 'deal' | 'bid' | 'signing' | 'close' | 'revenue' | 'commission'
  entity_id: string
  occurred_at: string
  duration_from_prev_step_hours: number | null
  value_eur: number | null
  status: 'completed' | 'pending' | 'failed' | 'skipped'
  metadata: Record<string, unknown>
}

export interface CapitalPipelineTrace {
  trace_id: string
  deal_id: string
  tenant_id: string

  steps: PipelineStep[]

  // Pipeline metrics
  total_pipeline_days: number
  stage_durations: Record<string, number>  // stage name → hours elapsed in that stage
  bottleneck_stage: string | null          // stage with longest duration

  // Financial
  initial_estimated_value_eur: number | null
  final_deal_value_eur: number | null
  value_change_pct: number | null

  // Outcome
  outcome: 'won' | 'lost' | 'in_progress'
  probability_at_each_stage: Record<string, number>  // stage → calibrated close probability

  computed_at: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000
}

function normaliseStageName(stage: string): string {
  return stage.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, '')
}

function getProbabilityForStage(stage: string): number {
  const key = normaliseStageName(stage)
  if (STAGE_PROBABILITY[key] !== undefined) return STAGE_PROBABILITY[key]
  for (const [k, p] of Object.entries(STAGE_PROBABILITY)) {
    if (key.includes(k) || k.includes(key)) return p
  }
  return 0.10
}

// ─── buildPipelineTrace ───────────────────────────────────────────────────────

/**
 * Reconstruct the full capital pipeline trace for a deal.
 *
 * Sources consumed (in order):
 *   1. deals table — stage history, timestamps, value
 *   2. financial_ledger — financial milestone entries for this deal
 *   3. causal_trace — event → decision chain (correlation_id linkage)
 *   4. investor_engagement_events — bids and offers (best-effort, table may not exist)
 */
export async function buildPipelineTrace(
  dealId: string,
  tenantId: string,
): Promise<CapitalPipelineTrace> {
  const client = getClient()
  const traceId    = crypto.randomUUID()
  const computedAt = new Date().toISOString()
  const steps: PipelineStep[] = []

  // ── 1. Load deal ───────────────────────────────────────────────────────────
  const { data: deal, error: dealErr } = await client
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (dealErr) {
    log.warn('[capitalPipeline] deal fetch failed', { error: dealErr.message, deal_id: dealId })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealRow = deal as Record<string, any> | null
  const dealValueEur    = dealRow?.deal_value     ?? null
  const dealCreatedAt   = dealRow?.created_at     ?? computedAt
  const dealUpdatedAt   = dealRow?.updated_at     ?? computedAt
  const dealFase        = dealRow?.fase            ?? null
  const dealRef         = dealRow?.ref             ?? dealId
  const dealClosedAt    = dealRow?.actual_close_date ?? null

  // Stage probability at each stage
  const probabilityAtEachStage: Record<string, number> = {}
  if (dealFase) {
    probabilityAtEachStage[dealFase] = getProbabilityForStage(dealFase)
  }

  // ── 2. Deal creation step ──────────────────────────────────────────────────
  steps.push({
    step_name:                   'deal_created',
    step_type:                   'deal',
    entity_id:                   dealId,
    occurred_at:                 dealCreatedAt,
    duration_from_prev_step_hours: null,
    value_eur:                   dealValueEur,
    status:                      'completed',
    metadata:                    { ref: dealRef, fase: dealFase },
  })

  // ── 3. Load financial_ledger entries for this deal ─────────────────────────
  const { data: ledgerEntries, error: ledgerErr } = await client
    .from('financial_ledger')
    .select('*')
    .eq('deal_id', dealId)
    .eq('tenant_id', tenantId)
    .order('sequence_number', { ascending: true })

  if (ledgerErr) {
    log.warn('[capitalPipeline] ledger fetch failed', { error: ledgerErr.message, deal_id: dealId })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledger = (ledgerEntries ?? []) as Array<Record<string, any>>

  for (const entry of ledger) {
    const prevStep = steps[steps.length - 1]
    const duration = prevStep ? hoursBetween(prevStep.occurred_at, entry.recorded_at) : null

    let stepType: PipelineStep['step_type'] = 'deal'
    switch (entry.entry_type as string) {
      case 'lead_qualified':         stepType = 'lead';       break
      case 'match_created':          stepType = 'match';      break
      case 'bid_submitted':          stepType = 'bid';        break
      case 'cpcv_signed':            stepType = 'signing';    break
      case 'escritura_completed':    stepType = 'close';      break
      case 'revenue_recognized':     stepType = 'revenue';    break
      case 'commission_calculated':
      case 'commission_paid':        stepType = 'commission'; break
      default:                       stepType = 'deal';       break
    }

    if (entry.entry_type === 'deal_stage_advanced' && entry.notes) {
      const match = String(entry.notes).match(/→\s*(.+)$/)
      if (match) {
        probabilityAtEachStage[match[1].trim()] = getProbabilityForStage(match[1].trim())
      }
    }

    steps.push({
      step_name:                   entry.entry_type,
      step_type:                   stepType,
      entity_id:                   dealId,
      occurred_at:                 entry.recorded_at,
      duration_from_prev_step_hours: duration !== null ? Math.round(duration * 100) / 100 : null,
      value_eur:                   entry.gross_value_eur ?? entry.commission_gross_eur ?? null,
      status:                      'completed',
      metadata: {
        sequence_number:     entry.sequence_number,
        correlation_id:      entry.correlation_id,
        commission_rate_pct: entry.commission_rate_pct,
        recognition_pct:     entry.recognition_pct,
        notes:               entry.notes,
      },
    })
  }

  // ── 4. Best-effort: load investor_engagement_events ────────────────────────
  try {
    const { data: bids, error: bidsErr } = await client
      .from('investor_engagement_events')
      .select('*')
      .eq('deal_id', dealId)
      .order('occurred_at', { ascending: true })
      .limit(50)

    if (!bidsErr && bids && Array.isArray(bids)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const bid of bids as Array<Record<string, any>>) {
        const prevStep = steps[steps.length - 1]
        const duration = prevStep ? hoursBetween(prevStep.occurred_at, bid.occurred_at) : null
        steps.push({
          step_name:                   'bid_submitted',
          step_type:                   'bid',
          entity_id:                   bid.investor_id ?? dealId,
          occurred_at:                 bid.occurred_at,
          duration_from_prev_step_hours: duration !== null ? Math.round(duration * 100) / 100 : null,
          value_eur:                   bid.bid_amount_eur ?? null,
          status:                      bid.status ?? 'completed',
          metadata:                    { event_type: bid.event_type, investor_id: bid.investor_id },
        })
      }
    }
  } catch {
    // investor_engagement_events may not exist in all deployments — silent skip
  }

  // ── 5. Causal trace steps (best-effort) ────────────────────────────────────
  try {
    if (dealRow?.id) {
      const { data: causal, error: causalErr } = await client
        .from('causal_trace')
        .select('*')
        .eq('entity_id', String(dealRow.id))
        .eq('entity_type', 'deal')
        .order('created_at', { ascending: true })
        .limit(100)

      if (!causalErr && causal && Array.isArray(causal) && causal.length > 0) {
        // Add causal steps that aren't already represented in ledger entries
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const cs of causal as Array<Record<string, any>>) {
          const alreadyCovered = steps.some(s =>
            Math.abs(new Date(s.occurred_at).getTime() - new Date(cs.created_at).getTime()) < 5000 &&
            s.step_name === cs.action
          )
          if (!alreadyCovered) {
            const prevStep = steps[steps.length - 1]
            const duration = prevStep ? hoursBetween(prevStep.occurred_at, cs.created_at) : null
            steps.push({
              step_name:                   cs.action ?? cs.step_type,
              step_type:                   'deal',
              entity_id:                   cs.entity_id ?? dealId,
              occurred_at:                 cs.created_at,
              duration_from_prev_step_hours: duration !== null ? Math.round(duration * 100) / 100 : null,
              value_eur:                   cs.revenue_delta ?? null,
              status:                      cs.success ? 'completed' : 'failed',
              metadata:                    { step_type: cs.step_type, correlation_id: cs.correlation_id },
            })
          }
        }
      }
    }
  } catch {
    // causal_trace may not be reachable — silent skip
  }

  // ── 6. Sort all steps by occurred_at ──────────────────────────────────────
  steps.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())

  // Recompute durations after sort
  for (let i = 1; i < steps.length; i++) {
    const dur = hoursBetween(steps[i - 1].occurred_at, steps[i].occurred_at)
    steps[i].duration_from_prev_step_hours = Math.round(dur * 100) / 100
  }

  // ── 7. Compute pipeline metrics ────────────────────────────────────────────
  const firstAt = steps[0]?.occurred_at ?? dealCreatedAt
  const lastAt  = dealClosedAt ?? dealUpdatedAt ?? computedAt
  const totalPipelineDays = Math.round(
    (new Date(lastAt).getTime() - new Date(firstAt).getTime()) / 86_400_000 * 10
  ) / 10

  // Stage durations: group consecutive steps by stage name
  const stageDurations: Record<string, number> = {}
  for (const step of steps) {
    if (step.duration_from_prev_step_hours !== null) {
      const stage = step.step_name
      stageDurations[stage] = (stageDurations[stage] ?? 0) + step.duration_from_prev_step_hours
    }
  }

  const bottleneckStage = Object.entries(stageDurations).length > 0
    ? Object.entries(stageDurations).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // ── 8. Financial summary ──────────────────────────────────────────────────
  const initialEstimated = steps.find(s => s.value_eur !== null)?.value_eur ?? null
  const finalDealValue   = dealValueEur
  const valueChangePct   = (initialEstimated && finalDealValue && initialEstimated !== 0)
    ? Math.round(((finalDealValue - initialEstimated) / initialEstimated) * 10000) / 100
    : null

  // ── 9. Outcome ────────────────────────────────────────────────────────────
  const lostStages    = ['Perdido', 'Rejeitado', 'lost', 'rejected']
  const wonStages     = ['Escritura Concluída', 'Escritura', 'fechado', 'post_sale', 'pos_venda', 'escritura_sell']
  let outcome: CapitalPipelineTrace['outcome'] = 'in_progress'
  if (dealFase && wonStages.includes(dealFase))  outcome = 'won'
  if (dealFase && lostStages.includes(dealFase)) outcome = 'lost'

  // ── 10. Cache to pipeline_traces ─────────────────────────────────────────
  const trace: CapitalPipelineTrace = {
    trace_id:                   traceId,
    deal_id:                    dealId,
    tenant_id:                  tenantId,
    steps,
    total_pipeline_days:        totalPipelineDays,
    stage_durations:            stageDurations,
    bottleneck_stage:           bottleneckStage,
    initial_estimated_value_eur: initialEstimated,
    final_deal_value_eur:       finalDealValue,
    value_change_pct:           valueChangePct,
    outcome,
    probability_at_each_stage:  probabilityAtEachStage,
    computed_at:                computedAt,
  }

  // Upsert cached trace (best-effort — read path depends on this for speed)
  void client
    .from('pipeline_traces')
    .upsert(
      { tenant_id: tenantId, deal_id: dealId, trace, computed_at: computedAt },
      { onConflict: 'tenant_id,deal_id' }
    )
    .then(({ error: upsertErr }: { error: { message: string } | null }) => {
      if (upsertErr) {
        log.warn('[capitalPipeline] trace cache upsert failed', { error: upsertErr.message, deal_id: dealId })
      }
    })

  return trace
}

// ─── getConversionFunnelMetrics ───────────────────────────────────────────────

export interface ConversionFunnelMetrics {
  leads_in: number
  matches_created: number
  deals_created: number
  deals_in_negotiation: number
  deals_won: number
  deals_lost: number

  lead_to_match_rate: number
  match_to_deal_rate: number
  deal_to_close_rate: number
  overall_conversion_rate: number

  avg_deal_value_eur: number
  avg_days_to_close: number
  avg_commission_eur: number

  revenue_per_lead_eur: number
  pipeline_value_at_risk_eur: number  // in-progress deals × avg conversion
}

/**
 * Compute funnel metrics from Supabase tables + financial_ledger.
 * fromDate: ISO date string e.g. '2026-01-01'
 */
export async function getConversionFunnelMetrics(
  tenantId: string,
  fromDate: string,
): Promise<ConversionFunnelMetrics> {
  const client = getClient()

  // ── Leads ─────────────────────────────────────────────────────────────────
  const { count: leadsIn } = await client
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', fromDate)
    .catch(() => ({ count: 0 }))

  // ── Deals ─────────────────────────────────────────────────────────────────
  const { data: dealsData, error: dealsErr } = await client
    .from('deals')
    .select('fase, deal_value, created_at, actual_close_date')
    .eq('tenant_id', tenantId)
    .gte('created_at', fromDate)

  if (dealsErr) {
    log.warn('[capitalPipeline] deals funnel fetch failed', { error: dealsErr.message })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (dealsData ?? []) as Array<Record<string, any>>

  const wonStages    = ['Escritura Concluída', 'Escritura', 'fechado', 'post_sale', 'pos_venda', 'escritura_sell']
  const lostStages   = ['Perdido', 'Rejeitado', 'lost', 'rejected']
  const negoStages   = ['Negociação', 'CPCV Assinado', 'CPCV', 'Escritura Marcada']

  const dealsCreated      = deals.length
  const dealsWon          = deals.filter(d => wonStages.includes(d.fase)).length
  const dealsLost         = deals.filter(d => lostStages.includes(d.fase)).length
  const dealsInNegotiation = deals.filter(d => negoStages.includes(d.fase)).length

  // ── Matches (financial_ledger) ─────────────────────────────────────────────
  const { count: matchesCreated } = await client
    .from('financial_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'match_created')
    .gte('recorded_at', fromDate)
    .catch(() => ({ count: 0 }))

  // ── Commission data from ledger ────────────────────────────────────────────
  const { data: commData, error: commErr } = await client
    .from('financial_ledger')
    .select('commission_net_eur, gross_value_eur')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'commission_calculated')
    .gte('recorded_at', fromDate)

  if (commErr) {
    log.warn('[capitalPipeline] commission ledger fetch failed', { error: commErr.message })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commEntries = (commData ?? []) as Array<Record<string, any>>
  const totalCommission = commEntries.reduce((s, e) => s + (e.commission_net_eur ?? 0), 0)
  const avgCommissionEur = commEntries.length > 0 ? totalCommission / commEntries.length : 0

  // ── Avg deal value (won deals) ─────────────────────────────────────────────
  const wonDeals     = deals.filter(d => wonStages.includes(d.fase))
  const avgDealValue = wonDeals.length > 0
    ? wonDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0) / wonDeals.length
    : 0

  // ── Avg days to close ─────────────────────────────────────────────────────
  const closedWithDates = wonDeals.filter(d => d.created_at && d.actual_close_date)
  const avgDaysToClose  = closedWithDates.length > 0
    ? closedWithDates.reduce((s, d) => {
        const days = (new Date(d.actual_close_date).getTime() - new Date(d.created_at).getTime()) / 86_400_000
        return s + days
      }, 0) / closedWithDates.length
    : 0

  // ── Conversion rates ──────────────────────────────────────────────────────
  const leadsInSafe       = leadsIn  ?? 0
  const matchesSafe       = matchesCreated ?? 0

  const leadToMatchRate   = leadsInSafe > 0   ? matchesSafe / leadsInSafe      : 0
  const matchToDealRate   = matchesSafe > 0   ? dealsCreated / matchesSafe     : 0
  const dealToCloseRate   = dealsCreated > 0  ? dealsWon / dealsCreated        : 0
  const overallConversion = leadsInSafe > 0   ? dealsWon / leadsInSafe         : 0

  // ── Revenue per lead ──────────────────────────────────────────────────────
  const revenuePerLeadEur = leadsInSafe > 0 ? totalCommission / leadsInSafe : 0

  // ── Pipeline value at risk (in-progress × avg deal value × avg close rate) ─
  const inProgressDeals       = dealsCreated - dealsWon - dealsLost
  const pipelineValueAtRisk   = inProgressDeals * avgDealValue * dealToCloseRate

  return {
    leads_in:              leadsInSafe,
    matches_created:       matchesSafe,
    deals_created:         dealsCreated,
    deals_in_negotiation:  dealsInNegotiation,
    deals_won:             dealsWon,
    deals_lost:            dealsLost,

    lead_to_match_rate:    Math.round(leadToMatchRate   * 10000) / 100,
    match_to_deal_rate:    Math.round(matchToDealRate   * 10000) / 100,
    deal_to_close_rate:    Math.round(dealToCloseRate   * 10000) / 100,
    overall_conversion_rate: Math.round(overallConversion * 10000) / 100,

    avg_deal_value_eur:    Math.round(avgDealValue    * 100) / 100,
    avg_days_to_close:     Math.round(avgDaysToClose  * 10) / 10,
    avg_commission_eur:    Math.round(avgCommissionEur * 100) / 100,

    revenue_per_lead_eur:          Math.round(revenuePerLeadEur  * 100) / 100,
    pipeline_value_at_risk_eur:    Math.round(pipelineValueAtRisk * 100) / 100,
  }
}
