// =============================================================================
// Agency Group — Outcome Capture Engine
// lib/intelligence/outcomeCapture.ts
//
// Phase 1: Economic Truth & Outcome Capture
//
// Records full post-close economic reality: final prices, negotiation deltas,
// rejection taxonomy, and deal friction. Every closed deal teaches the platform.
//
// REJECTION TAXONOMY:
//   price | location | condition | timing | financing | competition |
//   buyer_mismatch | valuation_mismatch | due_diligence | seller_withdrawal |
//   portfolio_full | other
//
// PURE FUNCTIONS:
//   computeNegotiationDelta, computeAvmError, classifyRejectionCategory,
//   buildTransactionOutcome, buildRejectionRecord, buildNegotiationEvent
//
// DB FUNCTIONS:
//   recordTransactionOutcome, recordRejection, recordNegotiationEvent,
//   getOutcomesByProperty
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutcomeType = 'won' | 'lost' | 'withdrawn'

export type RejectionCategory =
  | 'price'
  | 'location'
  | 'condition'
  | 'timing'
  | 'financing'
  | 'competition'
  | 'buyer_mismatch'
  | 'valuation_mismatch'
  | 'due_diligence'
  | 'seller_withdrawal'
  | 'portfolio_full'
  | 'other'

export type ClosingFriction =
  | 'financing'
  | 'due_diligence'
  | 'legal'
  | 'timing'
  | 'valuation'
  | 'seller_withdrawal'
  | 'buyer_mismatch'
  | 'competition'
  | 'other'

export type NegotiationEventType =
  | 'offer_submitted'
  | 'counter_offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'stalled'
  | 'due_diligence_started'
  | 'financing_confirmed'

export interface TransactionOutcomeRecord {
  property_id:               string
  distribution_event_id?:    string
  agent_email?:              string
  investor_id?:              string
  asking_price?:             number
  final_sale_price?:         number
  avm_value_at_time?:        number
  negotiation_delta_pct?:    number
  avm_error_pct?:            number
  negotiation_duration_days?: number
  outcome_type:              OutcomeType
  closing_friction?:         ClosingFriction
  score_at_time?:            number
  grade_at_time?:            string
  distribution_rank_at_time?: number
  distribution_tier_at_time?: string
  closed_at?:                string
  recorded_by?:              string
  notes?:                    string
}

export interface RejectionRecord {
  property_id:           string
  distribution_event_id?: string
  recipient_email?:      string
  recipient_type?:       'agent' | 'investor'
  rejection_category:    RejectionCategory
  rejection_reason?:     string
  lost_to_competitor:    boolean
  competitor_price?:     number
  score_at_time?:        number
  grade_at_time?:        string
  responded_at?:         string
}

export interface NegotiationEventRecord {
  property_id:    string
  outcome_id?:    string
  event_type:     NegotiationEventType
  event_date?:    string   // ISO date
  offer_price?:   number
  counter_price?: number
  notes?:         string
  recorded_by?:   string
}

// ---------------------------------------------------------------------------
// PURE: Compute negotiation delta %
// (sale_price - ask_price) / ask_price * 100
// Positive = sold above ask, negative = discount
// ---------------------------------------------------------------------------

export function computeNegotiationDelta(
  askPrice:  number,
  salePrice: number,
): number | null {
  if (askPrice <= 0) return null
  return parseFloat(((salePrice - askPrice) / askPrice * 100).toFixed(4))
}

// ---------------------------------------------------------------------------
// PURE: Compute AVM error %
// (avm_value - sale_price) / sale_price * 100
// Positive = AVM overestimated, negative = underestimated
// ---------------------------------------------------------------------------

export function computeAvmError(
  avmValue:  number,
  salePrice: number,
): number | null {
  if (salePrice <= 0) return null
  return parseFloat(((avmValue - salePrice) / salePrice * 100).toFixed(4))
}

// ---------------------------------------------------------------------------
// PURE: Classify a free-text rejection reason into a taxonomy category
// ---------------------------------------------------------------------------

export function classifyRejectionCategory(reason: string): RejectionCategory {
  const lower = reason.toLowerCase()

  if (/preço|price|caro|expensive|overpriced|valor/.test(lower))          return 'price'
  if (/localiza|location|zona|zone|área|area/.test(lower))                return 'location'
  if (/condição|condition|estado|state|renovação|renovation/.test(lower)) return 'condition'
  if (/timing|prazo|deadline|urgência|urgency/.test(lower))               return 'timing'
  if (/financiam|financing|banco|bank|crédito|credit|hipoteca/.test(lower)) return 'financing'
  if (/concorrente|competitor|outbid|superado/.test(lower))               return 'competition'
  if (/perfil|mismatch|não adequa|not a fit|criteria/.test(lower))        return 'buyer_mismatch'
  if (/avm|avaliação|valuation|estimativa/.test(lower))                   return 'valuation_mismatch'
  if (/due diligence|diligência|inspecção|inspection/.test(lower))        return 'due_diligence'
  if (/vendedor|seller|retirou|withdrew|desistiu/.test(lower))            return 'seller_withdrawal'
  if (/portfolio|carteira|sem capacidade|no capacity/.test(lower))        return 'portfolio_full'

  return 'other'
}

// ---------------------------------------------------------------------------
// PURE: Build a transaction outcome record from deal close data
// ---------------------------------------------------------------------------

export function buildTransactionOutcome(
  propertyId:  string,
  outcomeType: OutcomeType,
  opts: {
    distributionEventId?: string
    agentEmail?:          string
    investorId?:          string
    askingPrice?:         number
    salePrice?:           number
    avmValueAtTime?:      number
    durationDays?:        number
    closingFriction?:     ClosingFriction
    scoreAtTime?:         number
    gradeAtTime?:         string
    rankAtTime?:          number
    tierAtTime?:          string
    closedAt?:            string
    recordedBy?:          string
    notes?:               string
  } = {},
): TransactionOutcomeRecord {
  const negotiation_delta_pct = (opts.askingPrice != null && opts.salePrice != null)
    ? computeNegotiationDelta(opts.askingPrice, opts.salePrice) ?? undefined
    : undefined

  const avm_error_pct = (opts.avmValueAtTime != null && opts.salePrice != null)
    ? computeAvmError(opts.avmValueAtTime, opts.salePrice) ?? undefined
    : undefined

  return {
    property_id:               propertyId,
    distribution_event_id:     opts.distributionEventId,
    agent_email:               opts.agentEmail,
    investor_id:               opts.investorId,
    asking_price:              opts.askingPrice,
    final_sale_price:          opts.salePrice,
    avm_value_at_time:         opts.avmValueAtTime,
    negotiation_delta_pct,
    avm_error_pct,
    negotiation_duration_days: opts.durationDays,
    outcome_type:              outcomeType,
    closing_friction:          opts.closingFriction,
    score_at_time:             opts.scoreAtTime,
    grade_at_time:             opts.gradeAtTime,
    distribution_rank_at_time: opts.rankAtTime,
    distribution_tier_at_time: opts.tierAtTime,
    closed_at:                 opts.closedAt ?? new Date().toISOString(),
    recorded_by:               opts.recordedBy,
    notes:                     opts.notes,
  }
}

// ---------------------------------------------------------------------------
// PURE: Build a rejection record
// ---------------------------------------------------------------------------

export function buildRejectionRecord(
  propertyId:        string,
  rejectionCategory: RejectionCategory,
  opts: {
    distributionEventId?: string
    recipientEmail?:      string
    recipientType?:       'agent' | 'investor'
    rejectionReason?:     string
    lostToCompetitor?:    boolean
    competitorPrice?:     number
    scoreAtTime?:         number
    gradeAtTime?:         string
    respondedAt?:         string
  } = {},
): RejectionRecord {
  return {
    property_id:           propertyId,
    distribution_event_id: opts.distributionEventId,
    recipient_email:       opts.recipientEmail,
    recipient_type:        opts.recipientType,
    rejection_category:    rejectionCategory,
    rejection_reason:      opts.rejectionReason,
    lost_to_competitor:    opts.lostToCompetitor ?? false,
    competitor_price:      opts.competitorPrice,
    score_at_time:         opts.scoreAtTime,
    grade_at_time:         opts.gradeAtTime,
    responded_at:          opts.respondedAt,
  }
}

// ---------------------------------------------------------------------------
// DB: Record a transaction outcome
// ---------------------------------------------------------------------------

export async function recordTransactionOutcome(
  record: TransactionOutcomeRecord,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('transaction_outcomes')
    .upsert({
      property_id:               record.property_id,
      distribution_event_id:     record.distribution_event_id ?? null,
      agent_email:               record.agent_email ?? null,
      investor_id:               record.investor_id ?? null,
      asking_price:              record.asking_price ?? null,
      final_sale_price:          record.final_sale_price ?? null,
      avm_value_at_time:         record.avm_value_at_time ?? null,
      negotiation_delta_pct:     record.negotiation_delta_pct ?? null,
      avm_error_pct:             record.avm_error_pct ?? null,
      negotiation_duration_days: record.negotiation_duration_days ?? null,
      outcome_type:              record.outcome_type,
      closing_friction:          record.closing_friction ?? null,
      score_at_time:             record.score_at_time ?? null,
      grade_at_time:             record.grade_at_time ?? null,
      distribution_rank_at_time: record.distribution_rank_at_time ?? null,
      distribution_tier_at_time: record.distribution_tier_at_time ?? null,
      closed_at:                 record.closed_at ?? new Date().toISOString(),
      recorded_by:               record.recorded_by ?? null,
      notes:                     record.notes ?? null,
    }, {
      onConflict: 'property_id, COALESCE(distribution_event_id,\'\'), COALESCE(agent_email,\'\')',
    })
    .select('id')
    .single()

  if (error) throw new Error(`recordTransactionOutcome: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Record a rejection
// ---------------------------------------------------------------------------

export async function recordRejection(record: RejectionRecord): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('opportunity_rejections')
    .insert({
      property_id:           record.property_id,
      distribution_event_id: record.distribution_event_id ?? null,
      recipient_email:       record.recipient_email ?? null,
      recipient_type:        record.recipient_type ?? null,
      rejection_category:    record.rejection_category,
      rejection_reason:      record.rejection_reason ?? null,
      lost_to_competitor:    record.lost_to_competitor,
      competitor_price:      record.competitor_price ?? null,
      score_at_time:         record.score_at_time ?? null,
      grade_at_time:         record.grade_at_time ?? null,
      responded_at:          record.responded_at ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`recordRejection: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Record a negotiation event
// ---------------------------------------------------------------------------

export async function recordNegotiationEvent(
  event: NegotiationEventRecord,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('negotiation_events')
    .insert({
      property_id:  event.property_id,
      outcome_id:   event.outcome_id ?? null,
      event_type:   event.event_type,
      event_date:   event.event_date ?? null,
      offer_price:  event.offer_price ?? null,
      counter_price: event.counter_price ?? null,
      notes:        event.notes ?? null,
      recorded_by:  event.recorded_by ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`recordNegotiationEvent: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Get outcomes for a property
// ---------------------------------------------------------------------------

export async function getOutcomesByProperty(
  propertyId: string,
): Promise<TransactionOutcomeRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('transaction_outcomes')
    .select('*')
    .eq('property_id', propertyId)
    .order('recorded_at', { ascending: false })

  if (error) throw new Error(`getOutcomesByProperty: ${error.message}`)
  return (data ?? []) as TransactionOutcomeRecord[]
}
