// =============================================================================
// Agency Group — Revenue Attribution Engine
// lib/commercial/revenueAttribution.ts
//
// Tracks the full deal attribution chain: listing → score → route → close.
// Every closed deal is attributed to its source, score grade, and recipient.
//
// COMMISSION MODEL (AMI 22506):
//   Total = sale_price × 5%
//   CPCV  = total × 50%    (on signing of Contrato Promessa)
//   Final = total × 50%    (on Escritura / completion)
//
// PURE FUNCTIONS:
//   computeCommission, computeSplitAmounts, buildAttributionRecord
//
// DB FUNCTIONS:
//   recordAttribution, recordCommission, getAttributionSummary
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommissionBreakdown {
  sale_price:         number
  commission_total:   number
  commission_rate:    number   // typically 0.05
  cpcv_amount:        number   // 50% at CPCV
  escritura_amount:   number   // 50% at Escritura
  split_pct:          number   // % of total going to primary agent
  agent_net:          number   // what the agent actually receives
}

export interface AttributionRecord {
  property_id:           string
  distribution_event_id?: string
  agent_email?:          string
  investor_id?:          string
  close_status:          'won' | 'lost'
  sale_price?:           number
  commission_total?:     number
  commission_rate:       number
  attributed_source?:    string
  attributed_score_grade?: string
  attributed_tier?:      string
  distribution_rank?:    number
  closed_at?:            string
}

// ---------------------------------------------------------------------------
// PURE: Compute commission breakdown
// ---------------------------------------------------------------------------

export function computeCommission(
  salePrice:     number,
  commissionRate = 0.05,   // AMI 22506 standard: 5%
  splitPct       = 100,    // % of commission going to primary agent
): CommissionBreakdown {
  const commission_total  = parseFloat((salePrice * commissionRate).toFixed(2))
  const cpcv_amount       = parseFloat((commission_total * 0.50).toFixed(2))
  const escritura_amount  = parseFloat((commission_total - cpcv_amount).toFixed(2))
  const agent_net         = parseFloat((commission_total * (splitPct / 100)).toFixed(2))

  return {
    sale_price:       salePrice,
    commission_total,
    commission_rate:  commissionRate,
    cpcv_amount,
    escritura_amount,
    split_pct:        splitPct,
    agent_net,
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute split amounts for co-agent arrangements
// ---------------------------------------------------------------------------

export function computeSplitAmounts(
  commissionTotal: number,
  primaryPct:      number,   // 0-100
): { primary: number; counterpart: number } {
  const primary     = parseFloat((commissionTotal * primaryPct / 100).toFixed(2))
  const counterpart = parseFloat((commissionTotal - primary).toFixed(2))
  return { primary, counterpart }
}

// ---------------------------------------------------------------------------
// PURE: Build an attribution record from deal close data
// ---------------------------------------------------------------------------

export function buildAttributionRecord(
  propertyId:    string,
  closeStatus:   'won' | 'lost',
  opts: {
    salePrice?:          number
    agentEmail?:         string
    investorId?:         string
    distributionEventId?: string
    attributedSource?:   string
    attributedGrade?:    string
    attributedTier?:     string
    distributionRank?:   number
    commissionRate?:     number
    closedAt?:           string
  } = {},
): AttributionRecord {
  const commissionRate = opts.commissionRate ?? 0.05
  const commission_total = opts.salePrice
    ? parseFloat((opts.salePrice * commissionRate).toFixed(2))
    : undefined

  return {
    property_id:             propertyId,
    distribution_event_id:   opts.distributionEventId,
    agent_email:             opts.agentEmail,
    investor_id:             opts.investorId,
    close_status:            closeStatus,
    sale_price:              opts.salePrice,
    commission_total,
    commission_rate:         commissionRate,
    attributed_source:       opts.attributedSource,
    attributed_score_grade:  opts.attributedGrade,
    attributed_tier:         opts.attributedTier,
    distribution_rank:       opts.distributionRank,
    closed_at:               opts.closedAt ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// DB: Record a revenue attribution event
// ---------------------------------------------------------------------------

export async function recordAttribution(record: AttributionRecord): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('revenue_attribution')
    .upsert({
      property_id:             record.property_id,
      distribution_event_id:   record.distribution_event_id ?? null,
      agent_email:             record.agent_email ?? null,
      investor_id:             record.investor_id ?? null,
      close_status:            record.close_status,
      sale_price:              record.sale_price ?? null,
      commission_total:        record.commission_total ?? null,
      commission_rate:         record.commission_rate,
      attributed_source:       record.attributed_source ?? null,
      attributed_score_grade:  record.attributed_score_grade ?? null,
      attributed_tier:         record.attributed_tier ?? null,
      distribution_rank:       record.distribution_rank ?? null,
      closed_at:               record.closed_at ?? new Date().toISOString(),
    }, { onConflict: 'property_id, agent_email, investor_id' })
    .select('id')
    .single()

  if (error) throw new Error(`recordAttribution: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Record commission for an agent on a deal
// ---------------------------------------------------------------------------

export async function recordCommission(
  propertyId:   string,
  agentEmail:   string,
  salePrice:    number,
  splitPct      = 100,
  opts: {
    splitCounterpartEmail?: string
    cpcvDate?:              string
    escrituraDate?:         string
    notes?:                 string
    commissionRate?:        number
  } = {},
): Promise<string> {
  const breakdown = computeCommission(salePrice, opts.commissionRate ?? 0.05, splitPct)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('commission_records')
    .upsert({
      property_id:             propertyId,
      agent_email:             agentEmail,
      sale_price:              salePrice,
      expected_commission:     breakdown.commission_total,
      split_pct:               splitPct,
      split_counterpart_email: opts.splitCounterpartEmail ?? null,
      cpcv_date:               opts.cpcvDate      ?? null,
      cpcv_amount:             breakdown.cpcv_amount,
      escritura_date:          opts.escrituraDate ?? null,
      escritura_amount:        breakdown.escritura_amount,
      payout_status:           'pending',
      notes:                   opts.notes ?? null,
      updated_at:              new Date().toISOString(),
    }, { onConflict: 'property_id, agent_email' })
    .select('id')
    .single()

  if (error) throw new Error(`recordCommission: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Get attribution summary by score grade
// ---------------------------------------------------------------------------

export async function getAttributionSummary(): Promise<unknown[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('v_revenue_by_grade')
    .select('*')

  if (error) throw new Error(`getAttributionSummary: ${error.message}`)
  return data ?? []
}
