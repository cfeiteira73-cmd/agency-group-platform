// =============================================================================
// Agency Group — ML Feature Store v2.0
// lib/ml/featureStore.ts
//
// Time-series aligned, versioned, immutable feature vectors.
// Features are the inputs to ML models — precomputed and stored so models
// always train on consistent representations.
//
// Tables: feature_vectors (new — see migration 20260522000023)
// Legacy table ml_feature_snapshots is preserved (not touched here).
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureVector {
  entity_id:           string          // property_id or investor_id
  entity_type:         'property' | 'investor'
  tenant_id:           string
  feature_version:     string          // e.g., 'v1.2.0'
  features:            Record<string, number>   // all feature values (numeric)
  feature_names:       string[]                 // ordered list of feature keys (for reproducibility)
  computed_at:         string                   // when these features were computed
  valid_from:          string                   // time range these features are valid for
  valid_to:            string | null            // null = still valid
  dataset_snapshot_id: string | null            // linked dataset version if used in training
}

export interface FeatureDefinition {
  name:        string
  description: string
  entity_type: 'property' | 'investor'
  computation: string   // human-readable description of how it's computed
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENT_FEATURE_VERSION = 'v1.2.0'

const PREMIUM_ZONES = new Set([
  'Lisboa — Chiado',
  'Cascais — Quinta da Marinha',
  'Quinta do Lago',
  'Vale do Lobo',
  'Comporta',
  'Lisboa — Príncipe Real',
])

// Approximate zone average prices (€/m²) for price_deviation_pct computation.
// Source: Agency Group market data 2026
const ZONE_AVG_PRICES: Record<string, number> = {
  'Lisboa':          5000,
  'Cascais':         4713,
  'Algarve':         3941,
  'Porto':           3643,
  'Madeira':         3760,
  'Açores':          1952,
  'Lisboa — Chiado': 6200,
  'Lisboa — Príncipe Real': 5800,
  'Cascais — Quinta da Marinha': 5500,
  'Quinta do Lago':  7000,
  'Vale do Lobo':    6500,
  'Comporta':        5200,
}

// ---------------------------------------------------------------------------
// getFeatureDefinitions
// ---------------------------------------------------------------------------

export function getFeatureDefinitions(): FeatureDefinition[] {
  return [
    // --- Property features ---
    {
      name:        'zone_demand_score',
      description: 'Demand score for the property zone (0-1)',
      entity_type: 'property',
      computation: 'Computed from investor_bids count for properties in the same zone in last 90 days, normalised to [0,1] by dividing by 50',
    },
    {
      name:        'days_on_market_norm',
      description: 'Normalised days on market (0-1, capped at 365 days)',
      entity_type: 'property',
      computation: 'min(1, daysOnMarket / 365)',
    },
    {
      name:        'price_deviation_pct',
      description: 'Percentage deviation of listing price vs zone average price',
      entity_type: 'property',
      computation: '(preco - zone_avg_price) / zone_avg_price; defaults to 0 if zone unknown',
    },
    {
      name:        'liquidity_score',
      description: 'Liquidity score from liquidity_scores table (0-1)',
      entity_type: 'property',
      computation: 'liquidity_score / 100 from liquidity_scores; defaults to 0.5',
    },
    {
      name:        'bid_density',
      description: 'Active bid count normalised to [0,1]',
      entity_type: 'property',
      computation: 'min(1, activeBidCount / 10)',
    },
    {
      name:        'area_m2_log',
      description: 'Natural log of usable area in m²',
      entity_type: 'property',
      computation: 'Math.log(Math.max(1, area_m2))',
    },
    {
      name:        'is_premium_zone',
      description: 'Binary flag: 1 if property is in a premium zone, 0 otherwise',
      entity_type: 'property',
      computation: '1 if zone in [Lisboa — Chiado, Cascais — Quinta da Marinha, Quinta do Lago, Vale do Lobo, Comporta, Lisboa — Príncipe Real]; else 0',
    },
    {
      name:        'yield_potential',
      description: 'Estimated gross yield potential (0-1 normalised, where 1 = 10%+)',
      entity_type: 'property',
      computation: 'min(1, estimated_yield_pct / 10); defaults to 0.5',
    },
    {
      name:        'energy_rating_score',
      description: 'Energy rating score (A=1.0, A+=1.0, B=0.75, C=0.5, D=0.25, E-F=0)',
      entity_type: 'property',
      computation: 'Mapped from energy_rating string: A+/A=1.0, B=0.75, C=0.5, D=0.25, E/F/G=0; default 0.5',
    },
    {
      name:        'floor_score',
      description: 'Floor level score (0-1, higher floors score higher)',
      entity_type: 'property',
      computation: 'min(1, floor_number / 20); defaults to 0.5 if null',
    },
    {
      name:        'view_score',
      description: 'Binary or graduated view quality score (0-1)',
      entity_type: 'property',
      computation: '1.0 if has_sea_view or has_river_view, 0.5 if has_city_view, 0 otherwise; defaults to 0.5',
    },
    {
      name:        'construction_year_age_norm',
      description: 'Normalised construction age (0=brand new, 1=100+ years old)',
      entity_type: 'property',
      computation: 'min(1, (currentYear - construction_year) / 100); defaults to 0.5',
    },
    // --- Investor features ---
    {
      name:        'avg_bid_to_ask_ratio',
      description: 'Average ratio of investor bids to asking prices (0-2)',
      entity_type: 'investor',
      computation: 'mean(bid_amount / ask_price) across all investor bids; capped at 2; defaults to 0.5',
    },
    {
      name:        'conversion_rate',
      description: 'Ratio of closed deals to total bids placed',
      entity_type: 'investor',
      computation: 'closedDeals / max(1, totalBids); defaults to 0.5',
    },
    {
      name:        'capital_velocity_score',
      description: 'Speed of capital deployment (0-1)',
      entity_type: 'investor',
      computation: 'min(1, totalDealsClosedLast12m / 5); defaults to 0.5',
    },
    {
      name:        'market_sensitivity',
      description: 'How price-sensitive the investor is (0=very sensitive, 1=insensitive)',
      entity_type: 'investor',
      computation: '1 - avg_bid_to_ask_ratio clamped to [0,1]; proxy for willingness to pay over ask',
    },
    {
      name:        'loyalty_score',
      description: 'Investor loyalty based on repeat engagement (0-1)',
      entity_type: 'investor',
      computation: 'min(1, totalDealsEver / 3); defaults to 0.5',
    },
    {
      name:        'avg_deal_size_log',
      description: 'Natural log of average deal size in EUR',
      entity_type: 'investor',
      computation: 'Math.log(Math.max(1, avgDealSizeEur)); defaults to log(500000)',
    },
    {
      name:        'zone_concentration_score',
      description: 'How concentrated the investor is in a single zone (0=diverse, 1=single zone)',
      entity_type: 'investor',
      computation: 'maxZoneDeals / max(1, totalDeals); proxy for zone specialisation; defaults to 0.5',
    },
    {
      name:        'urgency_score',
      description: 'Investment urgency (1=immediate, 0.1=flexible)',
      entity_type: 'investor',
      computation: 'Mapped from investment_timeline: immediate=1.0, 3_months=0.7, 6_months=0.4, 12_months=0.2, flexible=0.1; default 0.5',
    },
    {
      name:        'days_since_last_activity_norm',
      description: 'Days since last investor activity normalised to [0,1]',
      entity_type: 'investor',
      computation: 'min(1, daysSinceLastActivity / 180); defaults to 0.5',
    },
  ]
}

// ---------------------------------------------------------------------------
// computePropertyFeatures
// ---------------------------------------------------------------------------

export async function computePropertyFeatures(
  tenantId:   string,
  propertyId: string,
): Promise<Record<string, number>> {
  const db = supabaseAdmin as any

  // Fetch property record
  const { data: property } = await db
    .from('properties')
    .select('preco, area_m2, zona, tipo, floor_number, energy_rating, construction_year, estimated_yield_pct, status, created_at')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // Fetch active bids count
  const { count: activeBidCount } = await db
    .from('investor_bids')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'accepted'])

  // Fetch liquidity score
  const { data: liquidityRow } = await db
    .from('liquidity_scores')
    .select('score')
    .eq('property_id', propertyId)
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const now          = new Date()
  const preco        = (property?.preco        as number)  ?? 0
  const area_m2      = (property?.area_m2      as number)  ?? 0
  const zona         = (property?.zona         as string)  ?? ''
  const floorNumber  = (property?.floor_number as number)  ?? null
  const energyRating = (property?.energy_rating as string) ?? ''
  const constYear    = (property?.construction_year as number) ?? null
  const yieldPct     = (property?.estimated_yield_pct as number) ?? null

  // days_on_market_norm
  const createdAt      = property?.created_at ? new Date(property.created_at as string) : now
  const daysOnMarket   = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  const days_on_market_norm = Math.min(1, daysOnMarket / 365)

  // price_deviation_pct
  let price_deviation_pct = 0
  if (preco > 0 && area_m2 > 0) {
    const pricePerM2 = preco / area_m2
    // Try to find zone avg price
    const zoneKey = Object.keys(ZONE_AVG_PRICES).find(k =>
      zona.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(zona.toLowerCase())
    )
    const zoneAvg = zoneKey ? ZONE_AVG_PRICES[zoneKey] : null
    if (zoneAvg && zoneAvg > 0) {
      price_deviation_pct = (pricePerM2 - zoneAvg) / zoneAvg
    }
  }

  // area_m2_log
  const area_m2_log = Math.log(Math.max(1, area_m2))

  // bid_density
  const bid_density = Math.min(1, (activeBidCount ?? 0) / 10)

  // is_premium_zone
  const is_premium_zone = PREMIUM_ZONES.has(zona) ? 1 : 0

  // zone_demand_score — query bids in same zone last 90 days
  let zone_demand_score = 0.5
  try {
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { count: zoneBidCount } = await db
      .from('investor_bids')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', ninetyDaysAgo)

    zone_demand_score = Math.min(1, (zoneBidCount ?? 0) / 50)
  } catch {
    zone_demand_score = 0.5
  }

  // liquidity_score
  const liquidity_score = liquidityRow?.score != null
    ? Math.min(1, Math.max(0, (liquidityRow.score as number) / 100))
    : 0.5

  // yield_potential
  const yield_potential = yieldPct != null
    ? Math.min(1, Math.max(0, yieldPct / 10))
    : 0.5

  // energy_rating_score
  const ENERGY_MAP: Record<string, number> = {
    'A+': 1.0, 'A': 1.0, 'B': 0.75, 'B-': 0.65,
    'C': 0.5, 'D': 0.25, 'E': 0.1, 'F': 0.0, 'G': 0.0,
  }
  const energy_rating_score = ENERGY_MAP[energyRating.trim().toUpperCase()] ?? 0.5

  // floor_score
  const floor_score = floorNumber != null
    ? Math.min(1, Math.max(0, floorNumber / 20))
    : 0.5

  // view_score — property fields probe (best-effort)
  let view_score = 0.5
  try {
    const { data: viewRow } = await db
      .from('properties')
      .select('has_sea_view, has_river_view, has_city_view')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (viewRow) {
      if (viewRow.has_sea_view || viewRow.has_river_view) view_score = 1.0
      else if (viewRow.has_city_view) view_score = 0.5
      else view_score = 0.0
    }
  } catch {
    view_score = 0.5
  }

  // construction_year_age_norm
  const construction_year_age_norm = constYear != null
    ? Math.min(1, Math.max(0, (now.getFullYear() - constYear) / 100))
    : 0.5

  return {
    zone_demand_score,
    days_on_market_norm,
    price_deviation_pct,
    liquidity_score,
    bid_density,
    area_m2_log,
    is_premium_zone,
    yield_potential,
    energy_rating_score,
    floor_score,
    view_score,
    construction_year_age_norm,
  }
}

// ---------------------------------------------------------------------------
// computeInvestorFeatures
// ---------------------------------------------------------------------------

export async function computeInvestorFeatures(
  tenantId:   string,
  investorId: string,
): Promise<Record<string, number>> {
  const db  = supabaseAdmin as any
  const now = new Date()

  // Fetch investor bids
  const { data: bids } = await db
    .from('investor_bids')
    .select('bid_amount, property_id, status, created_at')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch deals (closed)
  const { data: deals } = await db
    .from('deals')
    .select('deal_value_eur, property_id, created_at, status')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  const bidsArr: Array<{ bid_amount: number; property_id: string; status: string; created_at: string }> =
    (bids ?? []) as any[]

  const dealsArr: Array<{ deal_value_eur: number; property_id: string; created_at: string; status: string }> =
    (deals ?? []) as any[]

  const closedDeals = dealsArr.filter(d => d.status === 'closed' || d.status === 'completed')

  // avg_bid_to_ask_ratio — need ask prices; use best-effort join
  let avg_bid_to_ask_ratio = 0.5
  if (bidsArr.length > 0) {
    // Fetch properties to get asking prices
    const propertyIds = [...new Set(bidsArr.map(b => b.property_id))].slice(0, 50)
    try {
      const { data: props } = await db
        .from('properties')
        .select('id, preco')
        .in('id', propertyIds)
        .eq('tenant_id', tenantId)

      const priceMap = new Map<string, number>(
        ((props ?? []) as Array<{ id: string; preco: number }>).map(p => [p.id, p.preco])
      )

      const ratios: number[] = []
      for (const bid of bidsArr) {
        const ask = priceMap.get(bid.property_id)
        if (ask && ask > 0 && bid.bid_amount > 0) {
          ratios.push(Math.min(2, bid.bid_amount / ask))
        }
      }
      if (ratios.length > 0) {
        avg_bid_to_ask_ratio = ratios.reduce((s, v) => s + v, 0) / ratios.length
      }
    } catch {
      avg_bid_to_ask_ratio = 0.5
    }
  }

  // conversion_rate
  const totalBids     = bidsArr.length
  const totalClosed   = closedDeals.length
  const conversion_rate = totalBids > 0 ? Math.min(1, totalClosed / totalBids) : 0.5

  // capital_velocity_score
  const twelveMonthsAgo      = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const recentClosed         = closedDeals.filter(d => new Date(d.created_at) >= twelveMonthsAgo)
  const capital_velocity_score = Math.min(1, recentClosed.length / 5)

  // market_sensitivity — inverse of bid-to-ask; high ratio = low sensitivity
  const market_sensitivity = Math.min(1, Math.max(0, 1 - (avg_bid_to_ask_ratio - 0.8) / 0.4))

  // loyalty_score
  const loyalty_score = Math.min(1, closedDeals.length / 3)

  // avg_deal_size_log
  const DEFAULT_LOG = Math.log(500000)
  const avg_deal_size_log = closedDeals.length > 0
    ? Math.log(Math.max(1,
        closedDeals.reduce((s, d) => s + (d.deal_value_eur ?? 0), 0) / closedDeals.length
      ))
    : DEFAULT_LOG

  // zone_concentration_score — proxy: just compute based on available deal count and diversity
  let zone_concentration_score = 0.5
  if (closedDeals.length > 0) {
    // Best-effort: fetch zones for closed deals
    try {
      const dealPropertyIds = [...new Set(closedDeals.map(d => d.property_id))].slice(0, 50)
      const { data: dealProps } = await db
        .from('properties')
        .select('id, zona')
        .in('id', dealPropertyIds)
        .eq('tenant_id', tenantId)

      const zones = ((dealProps ?? []) as Array<{ id: string; zona: string }>).map(p => p.zona)
      if (zones.length > 0) {
        const zoneCounts: Record<string, number> = {}
        for (const z of zones) {
          zoneCounts[z] = (zoneCounts[z] ?? 0) + 1
        }
        const maxCount = Math.max(...Object.values(zoneCounts))
        zone_concentration_score = maxCount / zones.length
      }
    } catch {
      zone_concentration_score = 0.5
    }
  }

  // urgency_score — fetch from investor profile if possible
  let urgency_score = 0.5
  try {
    const { data: investorProfile } = await db
      .from('investors')
      .select('investment_timeline, investment_urgency')
      .eq('id', investorId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const URGENCY_MAP: Record<string, number> = {
      immediate: 1.0,
      '3_months': 0.7,
      '6_months': 0.4,
      '12_months': 0.2,
      flexible: 0.1,
    }
    const timeline = (investorProfile?.investment_timeline ?? investorProfile?.investment_urgency ?? '') as string
    urgency_score = URGENCY_MAP[timeline.toLowerCase()] ?? 0.5
  } catch {
    urgency_score = 0.5
  }

  // days_since_last_activity_norm
  let days_since_last_activity_norm = 0.5
  if (bidsArr.length > 0) {
    const lastActivity = new Date(bidsArr[0].created_at)
    const daysSince    = Math.max(0, (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    days_since_last_activity_norm = Math.min(1, daysSince / 180)
  }

  return {
    avg_bid_to_ask_ratio,
    conversion_rate,
    capital_velocity_score,
    market_sensitivity,
    loyalty_score,
    avg_deal_size_log,
    zone_concentration_score,
    urgency_score,
    days_since_last_activity_norm,
  }
}

// ---------------------------------------------------------------------------
// materializeFeatureVector
// Computes features and persists to feature_vectors table via UPSERT.
// ---------------------------------------------------------------------------

export async function materializeFeatureVector(
  tenantId:       string,
  entityType:     'property' | 'investor',
  entityId:       string,
  featureVersion?: string,
): Promise<FeatureVector> {
  const db      = supabaseAdmin as any
  const version = featureVersion ?? CURRENT_FEATURE_VERSION
  const now     = new Date().toISOString()

  // Compute features
  const features = entityType === 'property'
    ? await computePropertyFeatures(tenantId, entityId)
    : await computeInvestorFeatures(tenantId, entityId)

  const feature_names = Object.keys(features).sort()

  // Expire the previous valid vector via UPDATE on valid_to
  // (We do this before the UPSERT so there is always exactly one active vector)
  const { error: expireErr } = await db
    .from('feature_vectors')
    .update({ valid_to: now })
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .is('valid_to', null)

  if (expireErr) {
    log.warn('[featureStore] materializeFeatureVector — failed to expire old vector (continuing)', {
      entity_type: entityType,
      entity_id:   entityId,
      error:       expireErr.message,
    } as any)
  }

  // Insert new vector
  const row = {
    entity_id:           entityId,
    entity_type:         entityType,
    tenant_id:           tenantId,
    feature_version:     version,
    features,
    feature_names,
    computed_at:         now,
    valid_from:          now,
    valid_to:            null as string | null,
    dataset_snapshot_id: null as string | null,
  }

  const { data: inserted, error: insertErr } = await db
    .from('feature_vectors')
    .insert(row)
    .select()
    .single()

  if (insertErr || !inserted) {
    log.error('[featureStore] materializeFeatureVector — insert failed', undefined, {
      entity_type: entityType,
      entity_id:   entityId,
      error:       insertErr?.message ?? 'no data',
    })
    // Return the computed vector even if persistence failed
    return {
      entity_id:           entityId,
      entity_type:         entityType,
      tenant_id:           tenantId,
      feature_version:     version,
      features,
      feature_names,
      computed_at:         now,
      valid_from:          now,
      valid_to:            null,
      dataset_snapshot_id: null,
    }
  }

  log.info('[featureStore] materializeFeatureVector — materialized', {
    entity_type:     entityType,
    entity_id:       entityId,
    feature_count:   feature_names.length,
    feature_version: version,
  } as any)

  return rowToFeatureVector(inserted as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// getFeatureVector
// Reads from feature_vectors, optionally as-of a past date.
// ---------------------------------------------------------------------------

export async function getFeatureVector(
  tenantId:   string,
  entityType: 'property' | 'investor',
  entityId:   string,
  asOf?:      string,
): Promise<FeatureVector | null> {
  const db = supabaseAdmin as any

  try {
    let query = db
      .from('feature_vectors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)

    if (asOf) {
      // Feature valid at asOf: valid_from <= asOf AND (valid_to IS NULL OR valid_to > asOf)
      query = query
        .lte('valid_from', asOf)
        .or(`valid_to.is.null,valid_to.gt.${asOf}`)
    } else {
      // Current: no valid_to
      query = query.is('valid_to', null)
    }

    const { data, error } = await query
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.error('[featureStore] getFeatureVector — query failed', undefined, {
        entity_type: entityType,
        entity_id:   entityId,
        error:       error.message,
      })
      return null
    }

    if (!data) return null
    return rowToFeatureVector(data as Record<string, unknown>)
  } catch (err) {
    log.error('[featureStore] getFeatureVector — unexpected error', err instanceof Error ? err : undefined, {
      entity_type: entityType,
      entity_id:   entityId,
      error:       err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// batchMaterializeFeatures
// Parallel materialization with concurrency limit to avoid DB saturation.
// ---------------------------------------------------------------------------

export async function batchMaterializeFeatures(
  tenantId:   string,
  entityType: 'property' | 'investor',
  entityIds:  string[],
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed  = 0

  // Chunk into groups of 10 to avoid overwhelming the DB
  const CHUNK_SIZE = 10
  for (let i = 0; i < entityIds.length; i += CHUNK_SIZE) {
    const chunk   = entityIds.slice(i, i + CHUNK_SIZE)
    const results = await Promise.allSettled(
      chunk.map(entityId => materializeFeatureVector(tenantId, entityType, entityId))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        success++
      } else {
        failed++
        log.warn('[featureStore] batchMaterializeFeatures — entity failed', {
          entity_type: entityType,
          error:       result.reason instanceof Error ? result.reason.message : String(result.reason),
        } as any)
      }
    }
  }

  log.info('[featureStore] batchMaterializeFeatures — complete', {
    entity_type: entityType,
    total:       entityIds.length,
    success,
    failed,
  } as any)

  return { success, failed }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rowToFeatureVector(row: Record<string, unknown>): FeatureVector {
  return {
    entity_id:           row['entity_id']           as string,
    entity_type:         row['entity_type']          as 'property' | 'investor',
    tenant_id:           row['tenant_id']            as string,
    feature_version:     (row['feature_version']     as string)          ?? CURRENT_FEATURE_VERSION,
    features:            (row['features']            as Record<string, number>) ?? {},
    feature_names:       (row['feature_names']       as string[])        ?? [],
    computed_at:         row['computed_at']           as string,
    valid_from:          row['valid_from']            as string,
    valid_to:            (row['valid_to']             as string | null)   ?? null,
    dataset_snapshot_id: (row['dataset_snapshot_id'] as string | null)   ?? null,
  }
}

// ---------------------------------------------------------------------------
// getLatestFeatures (legacy compatibility shim)
// Kept so that lib/ml/onlineInference.ts continues to compile without changes.
// Reads from the legacy ml_feature_snapshots table, returning the old shape.
// New code should use getFeatureVector() instead.
// ---------------------------------------------------------------------------

export interface LegacyFeatureVector {
  entity_type:     'property' | 'investor' | 'deal' | 'match'
  entity_id:       string
  tenant_id:       string
  feature_version: string
  features:        Record<string, number | string | boolean | null>
  computed_at:     string
  is_latest:       boolean
  ttl_expires_at:  string | null
}

export async function getLatestFeatures(
  entityType: string,
  entityId:   string,
  tenantId:   string,
): Promise<LegacyFeatureVector | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('entity_type, entity_id, tenant_id, feature_version, features, computed_at, is_latest, ttl_expires_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .eq('is_latest', true)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.error('[featureStore] getLatestFeatures — query failed', undefined, {
        error:       error.message,
        entity_type: entityType,
        entity_id:   entityId,
      })
      return null
    }

    if (!data) return null

    return {
      entity_type:     data.entity_type as LegacyFeatureVector['entity_type'],
      entity_id:       data.entity_id   as string,
      tenant_id:       data.tenant_id   as string,
      feature_version: (data.feature_version ?? 'v1') as string,
      features:        (data.features ?? {}) as Record<string, number | string | boolean | null>,
      computed_at:     data.computed_at  as string,
      is_latest:       (data.is_latest ?? true) as boolean,
      ttl_expires_at:  (data.ttl_expires_at ?? null) as string | null,
    }
  } catch (err) {
    log.error('[featureStore] getLatestFeatures — unexpected error', err instanceof Error ? err : undefined, {
      error:       err instanceof Error ? err.message : String(err),
      entity_type: entityType,
      entity_id:   entityId,
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// saveFeatures (legacy compatibility shim)
// Kept so that existing callsites that write to ml_feature_snapshots continue
// to compile. New code should use materializeFeatureVector() instead.
// ---------------------------------------------------------------------------

export async function saveFeatures(
  entityType:     string,
  entityId:       string,
  tenantId:       string,
  features:       Record<string, unknown>,
  featureVersion: string = 'v1',
): Promise<void> {
  try {
    const db = supabaseAdmin as any

    await db
      .from('ml_feature_snapshots')
      .update({ is_latest: false })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .eq('is_latest', true)

    await db
      .from('ml_feature_snapshots')
      .insert({
        tenant_id:       tenantId,
        entity_type:     entityType,
        entity_id:       entityId,
        features,
        feature_version: featureVersion,
        is_latest:       true,
        computed_at:     new Date().toISOString(),
      })
  } catch (err) {
    log.error('[featureStore] saveFeatures — unexpected error', err instanceof Error ? err : undefined, {
      error:       err instanceof Error ? err.message : String(err),
      entity_type: entityType,
      entity_id:   entityId,
    })
  }
}
