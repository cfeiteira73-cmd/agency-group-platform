// =============================================================================
// Agency Group — Counterfactual Learning Engine
// lib/ml/counterfactualLearning.ts
//
// "What did we lose by NOT recommending this?"
// Generates negative training signals from:
//   1. Lost deals (investor viewed but didn't bid → implicit negative)
//   2. Rejected deals (investor bid but deal went to someone else)
//   3. Missed opportunities (property sold to uninvited investor not in ranked list)
//
// Table: counterfactual_labels (see migration 20260522000023)
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CounterfactualType =
  | 'missed_recommendation'
  | 'rejected_bid'
  | 'lost_deal'
  | 'implicit_ignore'

export interface CounterfactualLabel {
  id:                      string
  tenant_id:               string
  investor_id:             string
  property_id:             string
  counterfactual_type:     CounterfactualType
  // The "what-if" signal
  opportunity_value_eur:   number   // estimated value of the missed opportunity
  counterfactual_score:    number   // 0-1, negative label value (0=should have recommended, 1=correctly ignored)
  // Context
  actual_outcome:          string   // what actually happened
  reason:                  string   // human-readable explanation
  // Training signal
  training_label:          number   // -1 to 0 range (negative signal for gradient)
  model_name:              string   // which model to update
  created_at:              string
}

export interface CounterfactualBatch {
  tenant_id:                  string
  generated_at:               string
  total_labels:               number
  by_type:                    Record<CounterfactualType, number>
  total_opportunity_cost_eur: number   // sum of missed value
  labels:                     CounterfactualLabel[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyBatch(tenantId: string, generatedAt: string): CounterfactualBatch {
  return {
    tenant_id:    tenantId,
    generated_at: generatedAt,
    total_labels: 0,
    by_type: {
      missed_recommendation: 0,
      rejected_bid:          0,
      lost_deal:             0,
      implicit_ignore:       0,
    },
    total_opportunity_cost_eur: 0,
    labels: [],
  }
}

function mergeBatches(a: CounterfactualBatch, b: CounterfactualBatch): CounterfactualBatch {
  const merged = { ...a }
  merged.labels = [...a.labels, ...b.labels]
  merged.total_labels = merged.labels.length
  merged.total_opportunity_cost_eur = a.total_opportunity_cost_eur + b.total_opportunity_cost_eur

  const byType: Record<CounterfactualType, number> = {
    missed_recommendation: a.by_type.missed_recommendation + b.by_type.missed_recommendation,
    rejected_bid:          a.by_type.rejected_bid          + b.by_type.rejected_bid,
    lost_deal:             a.by_type.lost_deal             + b.by_type.lost_deal,
    implicit_ignore:       a.by_type.implicit_ignore       + b.by_type.implicit_ignore,
  }
  merged.by_type = byType
  return merged
}

// Estimate opportunity value from a deal's commission
function estimateOpportunityValue(dealValueEur: number, commissionRate = 0.05): number {
  return Math.round(dealValueEur * commissionRate * 100) / 100
}

// ---------------------------------------------------------------------------
// generateCounterfactualsFromClosedDeals
// For each closed deal, identify investors who matched the winning buyer's profile
// but were NOT contacted — generate missed_recommendation labels for them.
// ---------------------------------------------------------------------------

export async function generateCounterfactualsFromClosedDeals(
  tenantId:  string,
  fromDate?: string,
): Promise<CounterfactualBatch> {
  const generatedAt = new Date().toISOString()
  const batch       = emptyBatch(tenantId, generatedAt)
  const db          = supabaseAdmin as any

  try {
    // Fetch recently closed deals
    let dealsQuery = db
      .from('deals')
      .select('id, property_id, investor_id, deal_value_eur, commission_rate_pct, status, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['closed', 'completed'])
      .order('created_at', { ascending: false })
      .limit(500)

    if (fromDate) {
      dealsQuery = dealsQuery.gte('created_at', fromDate)
    }

    const { data: deals, error: dealsErr } = await dealsQuery

    if (dealsErr) {
      log.error('[counterfactualLearning] generateCounterfactualsFromClosedDeals — deals query failed', undefined, {
        error: dealsErr.message,
        tenantId,
      })
      return batch
    }

    const dealsArr = (deals ?? []) as Array<{
      id: string
      property_id: string
      investor_id: string
      deal_value_eur: number
      commission_rate_pct: number | null
      status: string
      created_at: string
    }>

    if (dealsArr.length === 0) return batch

    // For each closed deal, find investors who DID NOT bid but have a similar profile
    // (proxy: same tenant, not the winner, had at least 1 bid in last 180 days)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()

    const { data: activeInvestors, error: invErr } = await db
      .from('investor_bids')
      .select('investor_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', sixMonthsAgo)
      .limit(1000)

    if (invErr) {
      log.warn('[counterfactualLearning] generateCounterfactualsFromClosedDeals — investor query failed', {
        error: invErr.message,
        tenantId,
      } as any)
      return batch
    }

    const allActiveInvestorIds = [...new Set(
      ((activeInvestors ?? []) as Array<{ investor_id: string }>).map(r => r.investor_id)
    )]

    for (const deal of dealsArr) {
      // Investors who DID NOT close this deal and were not the winner
      const winnerId = deal.investor_id
      const propertyId = deal.property_id
      const dealValue = deal.deal_value_eur ?? 0
      const commRate = deal.commission_rate_pct ?? 5

      // Check which of these investors bid on this specific property
      const { data: biddersOnProperty } = await db
        .from('investor_bids')
        .select('investor_id')
        .eq('tenant_id', tenantId)
        .eq('property_id', propertyId)
        .limit(200)

      const biddersSet = new Set<string>(
        ((biddersOnProperty ?? []) as Array<{ investor_id: string }>).map(r => r.investor_id)
      )
      biddersSet.add(winnerId) // exclude winner

      // Missed candidates: active but never bid on this property
      const missedCandidates = allActiveInvestorIds
        .filter(id => !biddersSet.has(id))
        .slice(0, 5) // cap at 5 per deal to avoid label explosion

      for (const investorId of missedCandidates) {
        const oppValue = estimateOpportunityValue(dealValue, commRate / 100)
        const label: CounterfactualLabel = {
          id:                    randomUUID(),
          tenant_id:             tenantId,
          investor_id:           investorId,
          property_id:           propertyId,
          counterfactual_type:   'missed_recommendation',
          opportunity_value_eur: oppValue,
          counterfactual_score:  0.3,   // moderate negative signal — we don't know if they'd have converted
          actual_outcome:        `Deal ${deal.id} closed at ${dealValue} EUR with investor ${winnerId}`,
          reason:                `Investor was active in period but not contacted for property ${propertyId}`,
          training_label:        -0.3,  // moderate negative gradient
          model_name:            'investor_conversion_predictor',
          created_at:            generatedAt,
        }
        batch.labels.push(label)
        batch.by_type.missed_recommendation++
        batch.total_opportunity_cost_eur += oppValue
      }
    }

    batch.total_labels = batch.labels.length

    log.info('[counterfactualLearning] generateCounterfactualsFromClosedDeals — complete', {
      deals_processed:     dealsArr.length,
      labels_generated:    batch.total_labels,
      opportunity_cost:    batch.total_opportunity_cost_eur,
    } as any)

  } catch (err) {
    log.error('[counterfactualLearning] generateCounterfactualsFromClosedDeals — unexpected error',
      err instanceof Error ? err : undefined,
      { tenantId, error: err instanceof Error ? err.message : String(err) }
    )
  }

  return batch
}

// ---------------------------------------------------------------------------
// generateCounterfactualsFromRejectedBids
// For each bid that was outbid or rejected, creates a rejected_bid label.
// The losing bidder represents a real money signal — model should learn
// why the investor was not the winner.
// ---------------------------------------------------------------------------

export async function generateCounterfactualsFromRejectedBids(
  tenantId:  string,
  fromDate?: string,
): Promise<CounterfactualBatch> {
  const generatedAt = new Date().toISOString()
  const batch       = emptyBatch(tenantId, generatedAt)
  const db          = supabaseAdmin as any

  try {
    // Fetch rejected/outbid bids
    let bidsQuery = db
      .from('investor_bids')
      .select('id, investor_id, property_id, bid_amount, status, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['rejected', 'outbid', 'lost', 'declined'])
      .order('created_at', { ascending: false })
      .limit(1000)

    if (fromDate) {
      bidsQuery = bidsQuery.gte('created_at', fromDate)
    }

    const { data: rejectedBids, error: bidsErr } = await bidsQuery

    if (bidsErr) {
      log.error('[counterfactualLearning] generateCounterfactualsFromRejectedBids — bids query failed', undefined, {
        error: bidsErr.message,
        tenantId,
      })
      return batch
    }

    const bidsArr = (rejectedBids ?? []) as Array<{
      id: string
      investor_id: string
      property_id: string
      bid_amount: number
      status: string
      created_at: string
    }>

    // Fetch property prices for opportunity value estimation
    const propertyIds = [...new Set(bidsArr.map(b => b.property_id))].slice(0, 200)
    const { data: props } = await db
      .from('properties')
      .select('id, preco')
      .in('id', propertyIds)
      .eq('tenant_id', tenantId)

    const priceMap = new Map<string, number>(
      ((props ?? []) as Array<{ id: string; preco: number }>).map(p => [p.id, p.preco ?? 0])
    )

    for (const bid of bidsArr) {
      const askPrice   = priceMap.get(bid.property_id) ?? bid.bid_amount ?? 0
      const oppValue   = estimateOpportunityValue(askPrice)

      // Stronger negative signal for rejected bids vs implicit ignores
      // because the investor actively tried — the model should understand why they lost
      const counterfactual_score  = 0.6   // higher = more certain this was a real loss
      const training_label        = -0.6  // stronger negative gradient

      const label: CounterfactualLabel = {
        id:                    randomUUID(),
        tenant_id:             tenantId,
        investor_id:           bid.investor_id,
        property_id:           bid.property_id,
        counterfactual_type:   'rejected_bid',
        opportunity_value_eur: oppValue,
        counterfactual_score,
        actual_outcome:        `Bid ${bid.id} was ${bid.status} — bid amount ${bid.bid_amount} EUR on property ${bid.property_id}`,
        reason:                `Investor placed a bid that was ${bid.status}; represents real revenue signal for counter-factual training`,
        training_label,
        model_name:            'investor_conversion_predictor',
        created_at:            generatedAt,
      }

      batch.labels.push(label)
      batch.by_type.rejected_bid++
      batch.total_opportunity_cost_eur += oppValue
    }

    batch.total_labels = batch.labels.length

    log.info('[counterfactualLearning] generateCounterfactualsFromRejectedBids — complete', {
      bids_processed:   bidsArr.length,
      labels_generated: batch.total_labels,
      opportunity_cost: batch.total_opportunity_cost_eur,
    } as any)

  } catch (err) {
    log.error('[counterfactualLearning] generateCounterfactualsFromRejectedBids — unexpected error',
      err instanceof Error ? err : undefined,
      { tenantId, error: err instanceof Error ? err.message : String(err) }
    )
  }

  return batch
}

// ---------------------------------------------------------------------------
// generateAllCounterfactuals
// Runs both generators and merges results into a single batch.
// ---------------------------------------------------------------------------

export async function generateAllCounterfactuals(
  tenantId:  string,
  fromDate?: string,
): Promise<CounterfactualBatch> {
  const generatedAt = new Date().toISOString()

  const [closedBatch, rejectedBatch] = await Promise.all([
    generateCounterfactualsFromClosedDeals(tenantId, fromDate),
    generateCounterfactualsFromRejectedBids(tenantId, fromDate),
  ])

  const merged = mergeBatches(closedBatch, rejectedBatch)
  merged.generated_at = generatedAt

  log.info('[counterfactualLearning] generateAllCounterfactuals — merged', {
    total_labels:               merged.total_labels,
    total_opportunity_cost_eur: merged.total_opportunity_cost_eur,
    by_type:                    merged.by_type,
  } as any)

  return merged
}

// ---------------------------------------------------------------------------
// persistCounterfactualBatch
// Bulk INSERT to counterfactual_labels table.
// Fires and forgets on individual insert failures — logs warnings.
// ---------------------------------------------------------------------------

export async function persistCounterfactualBatch(batch: CounterfactualBatch): Promise<void> {
  if (batch.labels.length === 0) return

  const db = supabaseAdmin as any

  // Insert in chunks of 100 to stay under Supabase payload limits
  const CHUNK_SIZE = 100
  let inserted     = 0
  let failed       = 0

  for (let i = 0; i < batch.labels.length; i += CHUNK_SIZE) {
    const chunk = batch.labels.slice(i, i + CHUNK_SIZE).map(label => ({
      id:                    label.id,
      tenant_id:             label.tenant_id,
      investor_id:           label.investor_id,
      property_id:           label.property_id,
      counterfactual_type:   label.counterfactual_type,
      opportunity_value_eur: label.opportunity_value_eur,
      counterfactual_score:  label.counterfactual_score,
      actual_outcome:        label.actual_outcome,
      reason:                label.reason,
      training_label:        label.training_label,
      model_name:            label.model_name,
      created_at:            label.created_at,
    }))

    const { error } = await db
      .from('counterfactual_labels')
      .insert(chunk)

    if (error) {
      failed += chunk.length
      log.warn('[counterfactualLearning] persistCounterfactualBatch — chunk insert failed', {
        chunk_start: i,
        chunk_size:  chunk.length,
        error:       error.message,
      } as any)
    } else {
      inserted += chunk.length
    }
  }

  log.info('[counterfactualLearning] persistCounterfactualBatch — done', {
    total:    batch.labels.length,
    inserted,
    failed,
  } as any)
}

// ---------------------------------------------------------------------------
// getCounterfactualsForTraining
// Fetches labels for a specific model, optionally filtered by date.
// ---------------------------------------------------------------------------

export async function getCounterfactualsForTraining(
  tenantId:  string,
  modelName: string,
  fromDate?: string,
): Promise<CounterfactualLabel[]> {
  const db = supabaseAdmin as any

  try {
    let query = db
      .from('counterfactual_labels')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('model_name', modelName)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }

    const { data, error } = await query

    if (error) {
      log.error('[counterfactualLearning] getCounterfactualsForTraining — query failed', undefined, {
        tenantId,
        modelName,
        error: error.message,
      })
      return []
    }

    return ((data ?? []) as Record<string, unknown>[]).map(row => ({
      id:                    row['id']                    as string,
      tenant_id:             row['tenant_id']             as string,
      investor_id:           row['investor_id']           as string,
      property_id:           row['property_id']           as string,
      counterfactual_type:   row['counterfactual_type']   as CounterfactualType,
      opportunity_value_eur: row['opportunity_value_eur'] as number,
      counterfactual_score:  row['counterfactual_score']  as number,
      actual_outcome:        row['actual_outcome']        as string,
      reason:                row['reason']                as string,
      training_label:        row['training_label']        as number,
      model_name:            row['model_name']            as string,
      created_at:            row['created_at']            as string,
    }))
  } catch (err) {
    log.error('[counterfactualLearning] getCounterfactualsForTraining — unexpected error',
      err instanceof Error ? err : undefined,
      { tenantId, modelName, error: err instanceof Error ? err.message : String(err) }
    )
    return []
  }
}
