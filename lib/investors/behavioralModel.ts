// =============================================================================
// Agency Group — Behavioral Investor Model
// lib/investors/behavioralModel.ts
//
// Statistical model of investor behavior — who actually buys what,
// conversion probability by investor type, capital deployment patterns.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvestorType =
  | 'family_office'
  | 'hnwi'
  | 'institutional'
  | 'retail'
  | 'developer'
  | 'fund'

export interface BehavioralProfile {
  investor_id: string
  tenant_id: string
  investor_type: InvestorType
  // Behavioral signals derived from historical data
  avg_bid_to_ask_ratio: number        // e.g., 0.95 = bids at 95% of ask
  avg_time_to_decision_days: number   // how fast they decide
  preferred_zones: string[]           // top 3 zones by historical activity
  preferred_property_types: string[]  // T2, Villa, etc.
  preferred_price_range_min: number
  preferred_price_range_max: number
  avg_capital_deployment_eur: number  // average deal size
  conversion_rate: number             // bids / accepted (0-1)
  urgency_pattern: 'decisive' | 'deliberate' | 'opportunistic'
  // Computed scores
  capital_velocity_score: number      // 0-1, how fast they deploy capital
  market_sensitivity: number          // 0-1, how much they react to competition
  loyalty_score: number               // 0-1, repeat engagement rate
  updated_at: string
}

export interface ConversionPrediction {
  investor_id: string
  property_id: string
  tenant_id: string
  conversion_probability: number    // 0-1
  confidence: number                // 0-1
  drivers: Array<{ factor: string; impact: number }>  // ranked by |impact|
  recommended_approach: 'urgent_outreach' | 'standard_follow_up' | 'low_priority' | 'do_not_contact'
  predicted_bid_amount: number | null
  computed_at: string
}

// ─── Private row shapes ───────────────────────────────────────────────────────

interface BidRow {
  property_id: string
  bid_price_eur: number
  max_price_eur: number
  urgency_level: string
  status: string
  submitted_at: string
}

interface PropertyRow {
  id: string
  preco: number | null
  zona: string | null
  tipo: string | null
}

interface DealRow {
  id: string
  status: string
  investor_id: string | null
  created_at: string
}

// ─── Sigmoid helper ───────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x * 5 + 2.5))
}

// ─── clamp helper ─────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

// ─── gaussianMatch ────────────────────────────────────────────────────────────
// Gaussian-curve price match: peak=1.0 at midpoint, ~0.2 at 2× range

function gaussianMatch(price: number, min: number, max: number): number {
  if (max <= min) return 0.5
  const mid   = (min + max) / 2
  const range = max - min
  const sigma = range * 0.5  // std dev = half the range
  const diff  = price - mid
  return Math.exp(-(diff * diff) / (2 * sigma * sigma))
}

// ─── inferUrgencyPattern ─────────────────────────────────────────────────────

function inferUrgencyPattern(
  bids: BidRow[],
): BehavioralProfile['urgency_pattern'] {
  if (bids.length === 0) return 'deliberate'

  const urgencyCounts: Record<string, number> = {
    immediate: 0,
    within_30d: 0,
    within_90d: 0,
    flexible: 0,
  }

  for (const b of bids) {
    const key = b.urgency_level as keyof typeof urgencyCounts
    if (key in urgencyCounts) urgencyCounts[key]++
  }

  const total   = bids.length
  const immPct  = (urgencyCounts['immediate'] ?? 0) / total
  const flexPct = (urgencyCounts['flexible'] ?? 0) / total

  if (immPct >= 0.5) return 'decisive'
  if (flexPct >= 0.5) return 'opportunistic'
  return 'deliberate'
}

// ─── buildBehavioralProfile ──────────────────────────────────────────────────

export async function buildBehavioralProfile(
  tenantId: string,
  investorId: string,
): Promise<BehavioralProfile> {
  const db = supabaseAdmin as any

  const now = new Date().toISOString()

  // Defaults when data is sparse
  const fallback: BehavioralProfile = {
    investor_id:                investorId,
    tenant_id:                  tenantId,
    investor_type:              'hnwi',
    avg_bid_to_ask_ratio:       0.95,
    avg_time_to_decision_days:  30,
    preferred_zones:            [],
    preferred_property_types:   [],
    preferred_price_range_min:  100_000,
    preferred_price_range_max:  2_000_000,
    avg_capital_deployment_eur: 0,
    conversion_rate:            0,
    urgency_pattern:            'deliberate',
    capital_velocity_score:     0,
    market_sensitivity:         0.5,
    loyalty_score:              0,
    updated_at:                 now,
  }

  try {
    // ── 1. Fetch investor base record ────────────────────────────────────────
    const { data: investorRaw } = await db
      .from('investors')
      .select('investor_type, capital_min_eur, capital_max_eur, geography_preference, property_type_preference')
      .eq('id', investorId)
      .eq('tenant_id', tenantId)
      .single()

    type InvestorBase = {
      investor_type: string | null
      capital_min_eur: number | null
      capital_max_eur: number | null
      geography_preference: string[] | null
      property_type_preference: string[] | null
    }

    const base = investorRaw as InvestorBase | null

    // ── 2. Fetch bid history ─────────────────────────────────────────────────
    const { data: bidsRaw, error: bidsErr } = await db
      .from('investor_bids')
      .select('property_id, bid_price_eur, max_price_eur, urgency_level, status, submitted_at')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .order('submitted_at', { ascending: false })
      .limit(100)

    if (bidsErr) {
      log.warn('[behavioralModel] buildBehavioralProfile — bids fetch failed', {
        error:       bidsErr.message,
        investor_id: investorId,
        tenant_id:   tenantId,
      } as any)
    }

    const bids: BidRow[] = (bidsRaw ?? []) as BidRow[]

    // ── 3. Fetch deal history for conversion rate ────────────────────────────
    const { data: dealsRaw } = await db
      .from('deals')
      .select('id, status, investor_id, created_at')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .limit(50)

    const deals: DealRow[] = (dealsRaw ?? []) as DealRow[]

    // ── 4. Fetch properties bid on — for zone/type distribution ─────────────
    const bidPropertyIds = [...new Set(bids.map(b => b.property_id))].slice(0, 50)

    let properties: PropertyRow[] = []
    if (bidPropertyIds.length > 0) {
      const { data: propsRaw } = await db
        .from('properties')
        .select('id, preco, zona, tipo')
        .in('id', bidPropertyIds)
        .eq('tenant_id', tenantId)

      properties = (propsRaw ?? []) as PropertyRow[]
    }

    const propMap = new Map<string, PropertyRow>()
    for (const p of properties) propMap.set(p.id, p)

    // ── 5. Derive behavioral signals ─────────────────────────────────────────

    // avg_bid_to_ask_ratio
    const ratios: number[] = []
    for (const b of bids) {
      const prop = propMap.get(b.property_id)
      const ask  = prop?.preco ?? 0
      if (ask > 0) {
        ratios.push(b.bid_price_eur / ask)
      }
    }
    const avg_bid_to_ask_ratio = ratios.length > 0
      ? ratios.reduce((s, r) => s + r, 0) / ratios.length
      : fallback.avg_bid_to_ask_ratio

    // avg_time_to_decision_days — from urgency distribution
    const urgencyDaysMap: Record<string, number> = {
      immediate: 3,
      within_30d: 20,
      within_90d: 60,
      flexible: 120,
    }
    const decisionDays = bids.map(b => urgencyDaysMap[b.urgency_level] ?? 45)
    const avg_time_to_decision_days = decisionDays.length > 0
      ? Math.round(decisionDays.reduce((s, d) => s + d, 0) / decisionDays.length)
      : fallback.avg_time_to_decision_days

    // preferred_zones — top 3 by frequency
    const zoneFreq = new Map<string, number>()
    for (const b of bids) {
      const zona = propMap.get(b.property_id)?.zona
      if (zona) zoneFreq.set(zona, (zoneFreq.get(zona) ?? 0) + 1)
    }
    const preferred_zones = [...zoneFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([z]) => z)

    // Fall back to investor's geography_preference if no bid history
    const effectiveZones = preferred_zones.length > 0
      ? preferred_zones
      : (base?.geography_preference ?? []).slice(0, 3)

    // preferred_property_types — top 3 by frequency
    const typeFreq = new Map<string, number>()
    for (const b of bids) {
      const tipo = propMap.get(b.property_id)?.tipo
      if (tipo) typeFreq.set(tipo, (typeFreq.get(tipo) ?? 0) + 1)
    }
    const preferred_property_types = [...typeFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t)

    const effectiveTypes = preferred_property_types.length > 0
      ? preferred_property_types
      : (base?.property_type_preference ?? []).slice(0, 3)

    // preferred_price_range from bids or investor record
    const bidAmounts = bids.map(b => b.max_price_eur).filter(a => a > 0)
    const preferred_price_range_min = bidAmounts.length > 0
      ? Math.min(...bidAmounts)
      : (base?.capital_min_eur ?? fallback.preferred_price_range_min)
    const preferred_price_range_max = bidAmounts.length > 0
      ? Math.max(...bidAmounts)
      : (base?.capital_max_eur ?? fallback.preferred_price_range_max)

    // avg_capital_deployment_eur
    const avg_capital_deployment_eur = bidAmounts.length > 0
      ? Math.round(bidAmounts.reduce((s, a) => s + a, 0) / bidAmounts.length)
      : 0

    // conversion_rate — accepted bids / total bids
    const acceptedBids    = bids.filter(b => b.status === 'accepted').length
    const conversion_rate = bids.length > 0
      ? Math.round((acceptedBids / bids.length) * 10000) / 10000
      : 0

    // urgency_pattern
    const urgency_pattern = inferUrgencyPattern(bids)

    // investor_type — map from DB enum
    const investorTypeMap: Record<string, InvestorType> = {
      family_office: 'family_office',
      fund:          'fund',
      institution:   'institutional',
      individual:    'hnwi',
    }
    const investor_type: InvestorType =
      (investorTypeMap[base?.investor_type ?? ''] as InvestorType | undefined)
      ?? 'hnwi'

    // ── 6. Compute derived scores ─────────────────────────────────────────────

    // capital_velocity_score — faster decisions + more bids = higher velocity
    const decisionScore   = clamp01(1 - avg_time_to_decision_days / 120)
    const activityScore   = clamp01(bids.length / 20)  // normalized to 20 bids = 1.0
    const capital_velocity_score = Math.round(
      clamp01(decisionScore * 0.6 + activityScore * 0.4) * 10000,
    ) / 10000

    // market_sensitivity — how often they bid on competitive (multi-bid) properties
    // proxy: use bid-to-ask ratio variance — high variance = sensitive to competition
    const ratioVariance = ratios.length > 1
      ? ratios.reduce((s, r) => s + (r - avg_bid_to_ask_ratio) ** 2, 0) / ratios.length
      : 0
    const market_sensitivity = Math.round(clamp01(ratioVariance * 10) * 10000) / 10000

    // loyalty_score — repeat engagement: multiple bids over time
    const uniqueMonths = new Set(
      bids.map(b => b.submitted_at.slice(0, 7)),
    ).size
    const loyalty_score = Math.round(clamp01(uniqueMonths / 6) * 10000) / 10000

    // ── 7. Build profile ──────────────────────────────────────────────────────

    const profile: BehavioralProfile = {
      investor_id:                investorId,
      tenant_id:                  tenantId,
      investor_type,
      avg_bid_to_ask_ratio:       Math.round(avg_bid_to_ask_ratio * 10000) / 10000,
      avg_time_to_decision_days,
      preferred_zones:            effectiveZones,
      preferred_property_types:   effectiveTypes,
      preferred_price_range_min,
      preferred_price_range_max,
      avg_capital_deployment_eur,
      conversion_rate,
      urgency_pattern,
      capital_velocity_score,
      market_sensitivity,
      loyalty_score,
      updated_at:                 now,
    }

    // Fire-and-forget persist
    void persistBehavioralProfile(profile).catch(e =>
      log.warn('[behavioralModel] persistBehavioralProfile failed', {
        error: e instanceof Error ? e.message : String(e),
      } as any),
    )

    log.info('[behavioralModel] buildBehavioralProfile — completed', {
      investor_id:  investorId,
      tenant_id:    tenantId,
      bids_count:   bids.length,
      deals_count:  deals.length,
    } as any)

    return profile
  } catch (err) {
    log.warn('[behavioralModel] buildBehavioralProfile — unexpected error', {
      error:       err instanceof Error ? err.message : String(err),
      investor_id: investorId,
      tenant_id:   tenantId,
    } as any)
    return fallback
  }
}

// ─── computeConversionPrediction ─────────────────────────────────────────────

export async function computeConversionPrediction(
  tenantId: string,
  investorId: string,
  propertyId: string,
): Promise<ConversionPrediction> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const blank: ConversionPrediction = {
    investor_id:            investorId,
    property_id:            propertyId,
    tenant_id:              tenantId,
    conversion_probability: 0.1,
    confidence:             0.1,
    drivers:                [],
    recommended_approach:   'low_priority',
    predicted_bid_amount:   null,
    computed_at:            now,
  }

  try {
    // Load profile (from cache first)
    const { data: cachedRaw } = await db
      .from('investor_behavioral_profiles')
      .select('*')
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .single()

    type CachedProfile = BehavioralProfile & { id?: string }
    let profile: BehavioralProfile

    if (cachedRaw) {
      const c = cachedRaw as CachedProfile
      profile = {
        investor_id:                c.investor_id,
        tenant_id:                  c.tenant_id,
        investor_type:              c.investor_type as InvestorType,
        avg_bid_to_ask_ratio:       Number(c.avg_bid_to_ask_ratio),
        avg_time_to_decision_days:  Number(c.avg_time_to_decision_days),
        preferred_zones:            (c.preferred_zones as unknown as string[]) ?? [],
        preferred_property_types:   (c.preferred_property_types as unknown as string[]) ?? [],
        preferred_price_range_min:  Number(c.preferred_price_range_min),
        preferred_price_range_max:  Number(c.preferred_price_range_max),
        avg_capital_deployment_eur: Number(c.avg_capital_deployment_eur),
        conversion_rate:            Number(c.conversion_rate),
        urgency_pattern:            c.urgency_pattern,
        capital_velocity_score:     Number(c.capital_velocity_score),
        market_sensitivity:         Number(c.market_sensitivity),
        loyalty_score:              Number(c.loyalty_score),
        updated_at:                 c.updated_at,
      }
    } else {
      profile = await buildBehavioralProfile(tenantId, investorId)
    }

    // Load property
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('preco, zona, tipo')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !propRaw) {
      log.warn('[behavioralModel] computeConversionPrediction — property not found', {
        property_id: propertyId,
        tenant_id:   tenantId,
      } as any)
      return blank
    }

    type PropRaw = { preco: number | null; zona: string | null; tipo: string | null }
    const prop = propRaw as PropRaw

    // Count active open bids for capital availability estimate
    const { count: openBidCount } = await db
      .from('investor_bids')
      .select('id', { count: 'exact', head: true })
      .eq('investor_id', investorId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    const activeOpenBids = (openBidCount as number | null) ?? 0

    // ── Factor 1: zone_match ─────────────────────────────────────────────────
    const propertyZone = prop.zona ?? ''
    const zone_match   = profile.preferred_zones.includes(propertyZone) ? 1.0 : 0.3

    // ── Factor 2: price_match (gaussian) ────────────────────────────────────
    const propertyPrice = prop.preco ?? 0
    const price_match   = propertyPrice > 0
      ? gaussianMatch(
          propertyPrice,
          profile.preferred_price_range_min,
          profile.preferred_price_range_max,
        )
      : 0.5

    // ── Factor 3: type_match ─────────────────────────────────────────────────
    const propertyType = (prop.tipo ?? '').toLowerCase()
    const type_match   = profile.preferred_property_types
      .map(t => t.toLowerCase())
      .includes(propertyType)
      ? 1.0
      : 0.4

    // ── Factor 4: capital_availability ──────────────────────────────────────
    // Heuristic: if investor has avg_capital_deployment_eur and currently has
    // many open bids, capacity may be constrained
    const estimatedCommitted  = activeOpenBids * profile.avg_capital_deployment_eur
    const impliedCapacityLimit = profile.avg_capital_deployment_eur * 5  // 5× deal size tolerance
    const capital_availability = impliedCapacityLimit > 0
      ? clamp01(1 - estimatedCommitted / impliedCapacityLimit)
      : 0.5

    // ── Factor 5: timing_fit ─────────────────────────────────────────────────
    // 'decisive' investors match urgent markets better
    // Use capital_velocity_score as proxy for market heat readiness
    const timingBaseMap: Record<BehavioralProfile['urgency_pattern'], number> = {
      decisive:      0.9,
      deliberate:    0.6,
      opportunistic: 0.75,
    }
    const timing_fit = timingBaseMap[profile.urgency_pattern] * profile.capital_velocity_score
      + (1 - profile.capital_velocity_score) * 0.5

    // ── Weighted score (normalized [0,1]) ────────────────────────────────────
    const weighted =
      zone_match         * 0.30 +
      price_match        * 0.25 +
      type_match         * 0.20 +
      capital_availability * 0.15 +
      timing_fit         * 0.10

    const conversion_probability = Math.round(sigmoid(weighted) * 10000) / 10000

    // ── Confidence — based on data richness ─────────────────────────────────
    const hasBidHistory  = profile.avg_capital_deployment_eur > 0 ? 0.3 : 0
    const hasZoneData    = profile.preferred_zones.length > 0 ? 0.2 : 0
    const hasTypeData    = profile.preferred_property_types.length > 0 ? 0.2 : 0
    const hasConversion  = profile.conversion_rate > 0 ? 0.2 : 0
    const baseConf       = 0.1
    const confidence     = Math.round(
      clamp01(baseConf + hasBidHistory + hasZoneData + hasTypeData + hasConversion) * 10000,
    ) / 10000

    // ── Drivers (sorted by |impact|) ────────────────────────────────────────
    const driverList: Array<{ factor: string; impact: number }> = [
      { factor: 'zone_match',           impact: zone_match * 0.30 },
      { factor: 'price_match',          impact: price_match * 0.25 },
      { factor: 'type_match',           impact: type_match * 0.20 },
      { factor: 'capital_availability', impact: capital_availability * 0.15 },
      { factor: 'timing_fit',           impact: timing_fit * 0.10 },
    ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .map(d => ({ factor: d.factor, impact: Math.round(d.impact * 10000) / 10000 }))

    // ── Recommended approach ─────────────────────────────────────────────────
    let recommended_approach: ConversionPrediction['recommended_approach']
    if (conversion_probability >= 0.65) {
      recommended_approach = 'urgent_outreach'
    } else if (conversion_probability >= 0.40) {
      recommended_approach = 'standard_follow_up'
    } else if (conversion_probability >= 0.20) {
      recommended_approach = 'low_priority'
    } else {
      recommended_approach = 'do_not_contact'
    }

    // ── predicted_bid_amount ─────────────────────────────────────────────────
    const predicted_bid_amount = profile.avg_capital_deployment_eur > 0 && propertyPrice > 0
      ? Math.round(propertyPrice * profile.avg_bid_to_ask_ratio)
      : null

    return {
      investor_id:            investorId,
      property_id:            propertyId,
      tenant_id:              tenantId,
      conversion_probability,
      confidence,
      drivers:                driverList,
      recommended_approach,
      predicted_bid_amount,
      computed_at:            now,
    }
  } catch (err) {
    log.warn('[behavioralModel] computeConversionPrediction — error', {
      error:       err instanceof Error ? err.message : String(err),
      investor_id: investorId,
      property_id: propertyId,
    } as any)
    return blank
  }
}

// ─── batchBuildProfiles ───────────────────────────────────────────────────────

export async function batchBuildProfiles(
  tenantId: string,
  investorIds: string[],
): Promise<BehavioralProfile[]> {
  const results = await Promise.allSettled(
    investorIds.map(id => buildBehavioralProfile(tenantId, id)),
  )

  const profiles: BehavioralProfile[] = []
  let failCount = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      profiles.push(result.value)
    } else {
      failCount++
      log.warn('[behavioralModel] batchBuildProfiles — one profile failed', {
        error:     result.reason instanceof Error ? result.reason.message : String(result.reason),
        tenant_id: tenantId,
      } as any)
    }
  }

  log.info('[behavioralModel] batchBuildProfiles — completed', {
    total:     investorIds.length,
    succeeded: profiles.length,
    failed:    failCount,
    tenant_id: tenantId,
  } as any)

  return profiles
}

// ─── persistBehavioralProfile ────────────────────────────────────────────────

export async function persistBehavioralProfile(
  profile: BehavioralProfile,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('investor_behavioral_profiles')
    .upsert(
      {
        investor_id:                profile.investor_id,
        tenant_id:                  profile.tenant_id,
        investor_type:              profile.investor_type,
        avg_bid_to_ask_ratio:       profile.avg_bid_to_ask_ratio,
        avg_time_to_decision_days:  profile.avg_time_to_decision_days,
        preferred_zones:            profile.preferred_zones,
        preferred_property_types:   profile.preferred_property_types,
        preferred_price_range_min:  profile.preferred_price_range_min,
        preferred_price_range_max:  profile.preferred_price_range_max,
        avg_capital_deployment_eur: profile.avg_capital_deployment_eur,
        conversion_rate:            profile.conversion_rate,
        urgency_pattern:            profile.urgency_pattern,
        capital_velocity_score:     profile.capital_velocity_score,
        market_sensitivity:         profile.market_sensitivity,
        loyalty_score:              profile.loyalty_score,
        updated_at:                 new Date().toISOString(),
      },
      { onConflict: 'tenant_id,investor_id' },
    )

  if (error) {
    log.warn('[behavioralModel] persistBehavioralProfile — upsert failed', {
      error:       error.message,
      investor_id: profile.investor_id,
      tenant_id:   profile.tenant_id,
    } as any)
  }
}
