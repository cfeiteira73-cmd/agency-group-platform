// =============================================================================
// AGENCY GROUP — Deals Service
// Transaction pipeline: lead → qualification → CPCV → escritura
// Commission: 5% (AMI 22506) | CPCV 50% + Escritura 50%
// =============================================================================

import { supabase, supabaseAdmin } from '../supabase'
import type { Database, DealStage } from '../database.types'

type Deal = Database['public']['Tables']['deals']['Row']
type DealInsert = Database['public']['Tables']['deals']['Insert']
type DealUpdate = Database['public']['Tables']['deals']['Update']

// Stage probability map (matches schema ENUM definitions)
const STAGE_PROBABILITY: Record<DealStage, number> = {
  lead: 5,
  qualification: 15,
  visit_scheduled: 30,
  visit_done: 40,
  proposal: 60,
  negotiation: 70,
  cpcv: 90,
  escritura: 97,
  post_sale: 100,
  prospecting: 20,
  valuation: 45,
  mandate: 60,
  active_listing: 65,
  offer_received: 75,
  cpcv_sell: 90,
  escritura_sell: 97,
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get all deals, optionally scoped to a consultant.
 * Returns deals with contact and property names for display.
 */
export async function getDeals(assignedConsultant?: string): Promise<Deal[]> {
  let query = supabase
    .from('deals')
    .select('*')
    .order('updated_at', { ascending: false })

  if (assignedConsultant) {
    query = query.eq('assigned_consultant', assignedConsultant)
  }

  const { data, error } = await query
  if (error) throw new Error(`getDeals: ${error.message}`)
  return data
}

/**
 * Get a single deal by ID.
 */
export async function getDealById(id: string): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`getDealById(${id}): ${error.message}`)
  return data
}

/**
 * Get all deals grouped by stage (pipeline board view).
 * Returns a Record<DealStage, Deal[]> for Kanban rendering.
 */
export async function getDealsByStage(
  assignedConsultant?: string
): Promise<Record<string, Deal[]>> {
  const deals = await getDeals(assignedConsultant)

  const grouped: Record<string, Deal[]> = {}
  for (const deal of deals) {
    const stage = deal.stage
    if (!grouped[stage]) grouped[stage] = []
    grouped[stage].push(deal)
  }

  return grouped
}

/**
 * Get the full pipeline summary — calls get_pipeline_summary() RPC.
 * Returns weighted GCI per stage for the pipeline revenue forecast.
 */
export async function getPipelineSummary(): Promise<
  Array<{
    stage: DealStage
    count: number
    total_value: number
    weighted_value: number
    avg_probability: number
  }>
> {
  const { data, error } = await supabase.rpc('get_pipeline_summary')
  if (error) throw new Error(`getPipelineSummary: ${error.message}`)
  return data
}

/**
 * Get active deals (not in post_sale/lost) for a consultant.
 * Ordered by expected_close_date asc — soonest close first.
 */
export async function getActiveDeals(assignedConsultant?: string): Promise<Deal[]> {
  const closedStages: DealStage[] = ['post_sale']

  const { data: allDeals, error } = await supabase
    .from('deals')
    .select('*')
    .is('lost_at', null)
    .not('stage', 'in', `(${closedStages.map((s) => `"${s}"`).join(',')})`)
    .order('expected_close_date', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`getActiveDeals: ${error.message}`)

  if (assignedConsultant) {
    return allDeals.filter((d) => d.assigned_consultant === assignedConsultant)
  }

  return allDeals
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/**
 * Create a new deal. Auto-sets probability based on stage.
 */
export async function createDeal(deal: DealInsert): Promise<Deal> {
  const stage = (deal.stage ?? 'lead') as DealStage
  const probability = deal.probability ?? STAGE_PROBABILITY[stage] ?? 5

  const { data, error } = await supabase
    .from('deals')
    .insert({
      ...deal,
      probability,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`createDeal: ${error.message}`)
  return data
}

/**
 * Update a deal by ID.
 */
export async function updateDeal(id: string, updates: DealUpdate): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateDeal(${id}): ${error.message}`)
  return data
}

/**
 * Advance a deal to the next stage. Auto-updates probability.
 * Throws if the requested stage is not a valid DealStage.
 */
export async function advanceDeal(id: string, stage: DealStage): Promise<Deal> {
  const probability = STAGE_PROBABILITY[stage]

  const updates: DealUpdate = {
    stage,
    probability,
    updated_at: new Date().toISOString(),
  }

  // Auto-stamp close dates at terminal stages
  if (stage === 'post_sale') {
    updates.actual_close_date = new Date().toISOString().split('T')[0]
  }

  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`advanceDeal(${id}, ${stage}): ${error.message}`)
  return data
}

/**
 * Mark a deal as lost with reason.
 */
export async function markDealLost(
  id: string,
  reason: string,
  lostToAgency?: string
): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .update({
      lost_at: new Date().toISOString(),
      lost_reason: reason,
      lost_to_agency: lostToAgency ?? null,
      probability: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`markDealLost(${id}): ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// ADMIN — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * SERVER ONLY — use in API routes.
 * Hard-delete a deal (bypasses RLS).
 */
export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('deals').delete().eq('id', id)
  if (error) throw new Error(`deleteDeal(${id}): ${error.message}`)
}
