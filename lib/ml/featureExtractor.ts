// =============================================================================
// Agency Group — ML Feature Extractor
// lib/ml/featureExtractor.ts
//
// Extracts structured feature vectors from DB entities for ML scoring.
// Heuristic baseline — pluggable interface for trained models.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Feature shape interfaces
// ---------------------------------------------------------------------------

export interface PropertyFeatures {
  price_eur: number
  price_per_m2: number | null
  area_m2: number | null
  investment_tier: string | null
  geo_tier: string | null
  days_listed: number | null
  match_count: number
  avg_match_score: number | null
  zone: string | null
  property_type: string | null
}

export interface InvestorFeatures {
  capital_min_eur: number | null
  capital_max_eur: number | null
  yield_target_pct: number | null
  risk_tolerance: string | null
  geography_count: number
  type_preference_count: number
  match_count: number
  deal_count: number
  conversion_rate: number | null
}

export interface DealFeatures {
  deal_value_eur: number | null
  days_in_pipeline: number | null
  stage_transitions: number
  investment_tier: string | null
  geo_tier: string | null
  has_investor_match: boolean
  commission_tier: string | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function daysBetween(earlier: string | null, later: string | null): number | null {
  if (!earlier || !later) return null
  const ms = new Date(later).getTime() - new Date(earlier).getTime()
  if (isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function classifyGeoTier(zone: string | null): string | null {
  if (!zone) return null
  const z = zone.toLowerCase()
  if (z.includes('lisboa') || z.includes('cascais') || z.includes('sintra') || z.includes('oeiras')) {
    return 'prime'
  }
  if (z.includes('porto') || z.includes('algarve') || z.includes('madeira') || z.includes('setubal')) {
    return 'secondary'
  }
  return 'emerging'
}

function classifyInvestmentTier(priceEur: number): string {
  if (priceEur >= 3_000_000) return 'luxury'
  if (priceEur >= 1_000_000) return 'premium'
  if (priceEur >= 300_000)   return 'mid'
  return 'entry'
}

function classifyCommissionTier(dealValue: number | null): string | null {
  if (dealValue === null) return null
  if (dealValue >= 5_000_000) return 'institutional'
  if (dealValue >= 1_000_000) return 'premium'
  return 'standard'
}

// ---------------------------------------------------------------------------
// extractPropertyFeatures
// ---------------------------------------------------------------------------

export async function extractPropertyFeatures(
  propertyId: string,
  tenantId: string,
): Promise<PropertyFeatures> {
  const defaults: PropertyFeatures = {
    price_eur: 0,
    price_per_m2: null,
    area_m2: null,
    investment_tier: null,
    geo_tier: null,
    days_listed: null,
    match_count: 0,
    avg_match_score: null,
    zone: null,
    property_type: null,
  }

  try {
    const { data: prop, error: propErr } = await (supabaseAdmin as any)
      .from('properties')
      .select('id, preco, preco_m2, area_util, zona, tipo, investment_tier, geo_tier, created_at')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !prop) {
      console.error('[featureExtractor] extractPropertyFeatures — property query failed:', propErr?.message ?? 'not found')
      return defaults
    }

    // Match aggregates
    const { data: matchAgg, error: matchErr } = await (supabaseAdmin as any)
      .from('investor_matches')
      .select('match_score')
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId)

    if (matchErr) {
      console.error('[featureExtractor] extractPropertyFeatures — match query failed:', matchErr.message)
    }

    const matches: { match_score: number }[] = matchAgg ?? []
    const matchCount = matches.length
    const avgMatchScore = matchCount > 0
      ? matches.reduce((sum, m) => sum + (m.match_score ?? 0), 0) / matchCount
      : null

    const priceEur: number = Number(prop.preco ?? 0)

    return {
      price_eur:       priceEur,
      price_per_m2:    prop.preco_m2 !== undefined && prop.preco_m2 !== null ? Number(prop.preco_m2) : null,
      area_m2:         prop.area_util !== undefined && prop.area_util !== null ? Number(prop.area_util) : null,
      investment_tier: prop.investment_tier ?? classifyInvestmentTier(priceEur),
      geo_tier:        prop.geo_tier ?? classifyGeoTier(prop.zona ?? null),
      days_listed:     daysBetween(prop.created_at ?? null, new Date().toISOString()),
      match_count:     matchCount,
      avg_match_score: avgMatchScore,
      zone:            prop.zona ?? null,
      property_type:   prop.tipo ?? null,
    }
  } catch (err) {
    console.error('[featureExtractor] extractPropertyFeatures — unexpected error:', err instanceof Error ? err.message : String(err))
    return defaults
  }
}

// ---------------------------------------------------------------------------
// extractInvestorFeatures
// ---------------------------------------------------------------------------

export async function extractInvestorFeatures(
  investorId: string,
  tenantId: string,
): Promise<InvestorFeatures> {
  const defaults: InvestorFeatures = {
    capital_min_eur: null,
    capital_max_eur: null,
    yield_target_pct: null,
    risk_tolerance: null,
    geography_count: 0,
    type_preference_count: 0,
    match_count: 0,
    deal_count: 0,
    conversion_rate: null,
  }

  try {
    const { data: investor, error: invErr } = await (supabaseAdmin as any)
      .from('investors')
      .select('id, capital_min_eur, capital_max_eur, yield_target_pct, risk_tolerance, geography_preference, property_type_preference')
      .eq('id', investorId)
      .eq('tenant_id', tenantId)
      .single()

    if (invErr || !investor) {
      console.error('[featureExtractor] extractInvestorFeatures — investor query failed:', invErr?.message ?? 'not found')
      return defaults
    }

    // Match count
    const { count: matchCount, error: matchErr } = await (supabaseAdmin as any)
      .from('investor_matches')
      .select('id', { count: 'exact', head: true })
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)

    if (matchErr) {
      console.error('[featureExtractor] extractInvestorFeatures — match count failed:', matchErr.message)
    }

    // Deal count (from commission_events as proxy for closed deals)
    const { count: dealCount, error: dealErr } = await (supabaseAdmin as any)
      .from('commission_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (dealErr) {
      console.error('[featureExtractor] extractInvestorFeatures — deal count failed:', dealErr.message)
    }

    const mc = matchCount ?? 0
    const dc = dealCount ?? 0
    const conversionRate = mc > 0 ? (dc / mc) * 100 : null

    const geoPrefs: unknown[] = Array.isArray(investor.geography_preference) ? investor.geography_preference : []
    const typePrefs: unknown[] = Array.isArray(investor.property_type_preference) ? investor.property_type_preference : []

    return {
      capital_min_eur:       investor.capital_min_eur !== undefined ? Number(investor.capital_min_eur) : null,
      capital_max_eur:       investor.capital_max_eur !== undefined ? Number(investor.capital_max_eur) : null,
      yield_target_pct:      investor.yield_target_pct !== undefined ? Number(investor.yield_target_pct) : null,
      risk_tolerance:        investor.risk_tolerance ?? null,
      geography_count:       geoPrefs.length,
      type_preference_count: typePrefs.length,
      match_count:           mc,
      deal_count:            dc,
      conversion_rate:       conversionRate,
    }
  } catch (err) {
    console.error('[featureExtractor] extractInvestorFeatures — unexpected error:', err instanceof Error ? err.message : String(err))
    return defaults
  }
}

// ---------------------------------------------------------------------------
// extractDealFeatures
// ---------------------------------------------------------------------------

export async function extractDealFeatures(
  dealId: string,
  tenantId: string,
): Promise<DealFeatures> {
  const defaults: DealFeatures = {
    deal_value_eur: null,
    days_in_pipeline: null,
    stage_transitions: 0,
    investment_tier: null,
    geo_tier: null,
    has_investor_match: false,
    commission_tier: null,
  }

  try {
    // deals table is not typed — use (supabaseAdmin as any)
    const { data: deal, error: dealErr } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, valor, zona, fase, created_at, updated_at, investor_id')
      .eq('id', dealId)
      .eq('tenant_id', tenantId)
      .single()

    if (dealErr || !deal) {
      console.error('[featureExtractor] extractDealFeatures — deal query failed:', dealErr?.message ?? 'not found')
      return defaults
    }

    // Count stage transitions from deal_stage_history if available
    let stageTransitions = 0
    const { count: histCount } = await (supabaseAdmin as any)
      .from('deal_stage_history')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', dealId)
      .eq('tenant_id', tenantId)
    stageTransitions = histCount ?? 0

    const dealValue: number | null = deal.valor !== undefined && deal.valor !== null ? Number(deal.valor) : null

    return {
      deal_value_eur:    dealValue,
      days_in_pipeline:  daysBetween(deal.created_at ?? null, deal.updated_at ?? null),
      stage_transitions: stageTransitions,
      investment_tier:   dealValue !== null ? classifyInvestmentTier(dealValue) : null,
      geo_tier:          classifyGeoTier(deal.zona ?? null),
      has_investor_match: !!deal.investor_id,
      commission_tier:   classifyCommissionTier(dealValue),
    }
  } catch (err) {
    console.error('[featureExtractor] extractDealFeatures — unexpected error:', err instanceof Error ? err.message : String(err))
    return defaults
  }
}

// ---------------------------------------------------------------------------
// snapshotFeatures
// Non-critical: fire-and-forget feature snapshot for training data accumulation.
// ---------------------------------------------------------------------------

export async function snapshotFeatures(
  entityType: 'property' | 'investor' | 'deal',
  entityId: string,
  tenantId: string,
  features: Record<string, unknown>,
  labelOutcome?: string,
  labelValue?: number,
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .insert({
        tenant_id:      tenantId,
        entity_type:    entityType,
        entity_id:      entityId,
        features,
        label_outcome:  labelOutcome ?? null,
        label_value:    labelValue ?? null,
        feature_version: 'v1',
      })

    if (error) {
      console.error('[featureExtractor] snapshotFeatures — insert failed (non-critical):', error.message)
    }
  } catch (err) {
    // Feature snapshotting is non-critical — log and return, never throw
    console.error('[featureExtractor] snapshotFeatures — unexpected error (non-critical):', err instanceof Error ? err.message : String(err))
  }
}
