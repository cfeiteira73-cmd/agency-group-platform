// =============================================================================
// Agency Group — Enrichment Pipeline
// lib/ingestion/enrichmentPipeline.ts
//
// Enriches canonical properties with market intelligence:
//   - Price vs market comparison (from liquidity_heatmap)
//   - Zone classification (prime / secondary / emerging / peripheral)
//   - Liquidity index and average days-to-sell
//   - Demand pressure signals from watchlist + match counts
//   - Risk tagging (overpriced, stale_listing, high_demand_zone, price_drop)
//
// Emits property.enriched event to runtime_events after processing.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZoneClassification = 'prime' | 'secondary' | 'emerging' | 'peripheral'
export type DemandPressure     = 'very_high' | 'high' | 'medium' | 'low' | 'very_low'

export interface EnrichmentResult {
  canonical_id: string

  // Geo enrichment
  neighborhood:      string | null
  municipality:      string | null
  postal_code:       string | null
  zone_classification: ZoneClassification

  // Price intelligence
  price_per_m2:               number
  market_median_price_per_m2: number | null
  price_vs_market_pct:        number | null // +10 = 10% above market

  // Market liquidity
  avg_days_to_sell_in_zone: number | null
  liquidity_index:          number | null // 0-100

  // Risk tagging
  risk_tags: string[]

  // Demand signals
  demand_pressure:            DemandPressure
  similar_properties_listed:  number
  similar_properties_sold_90d: number

  enriched_at: string
}

// ─── Zone Classification ──────────────────────────────────────────────────────

function classifyZone(
  heatIndex: number | null,
  pricePerM2: number,
  medianPricePerM2: number | null,
): ZoneClassification {
  const heat = heatIndex ?? 50
  const ratio = medianPricePerM2 && medianPricePerM2 > 0
    ? pricePerM2 / medianPricePerM2
    : 1.0

  if (heat >= 70 || ratio >= 1.3) return 'prime'
  if (heat >= 45 || ratio >= 1.0) return 'secondary'
  if (heat >= 25 || ratio >= 0.75) return 'emerging'
  return 'peripheral'
}

// ─── Demand Pressure ─────────────────────────────────────────────────────────

function classifyDemandPressure(
  watchlistCount: number,
  matchCount: number,
  activeListings: number,
): DemandPressure {
  if (activeListings === 0) return 'very_low'
  const signalRatio = (watchlistCount + matchCount * 2) / Math.max(1, activeListings)
  if (signalRatio >= 5)   return 'very_high'
  if (signalRatio >= 2.5) return 'high'
  if (signalRatio >= 1)   return 'medium'
  if (signalRatio >= 0.3) return 'low'
  return 'very_low'
}

// ─── Risk Tags ────────────────────────────────────────────────────────────────

function computeRiskTags(opts: {
  priceVsMarketPct: number | null
  daysListed: number
  demandPressure: DemandPressure
  hadPriceDrop: boolean
}): string[] {
  const tags: string[] = []

  if (opts.priceVsMarketPct != null && opts.priceVsMarketPct > 20) {
    tags.push('overpriced')
  }
  if (opts.daysListed > 180) {
    tags.push('stale_listing')
  }
  if (opts.demandPressure === 'very_high' || opts.demandPressure === 'high') {
    tags.push('high_demand_zone')
  }
  if (opts.hadPriceDrop) {
    tags.push('price_drop')
  }

  return tags
}

// ─── Main Enrichment Function ─────────────────────────────────────────────────

/**
 * Enriches a canonical property with market intelligence.
 * Upserts results into property_enrichments table.
 * Emits property.enriched event.
 */
export async function enrichProperty(
  canonicalId: string,
  tenantId: string,
): Promise<EnrichmentResult> {
  const enrichedAt = new Date().toISOString()

  // 1. Load canonical property
  const { data: canonical, error: canonicalErr } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select(
      'canonical_id, city, zone, country, price_eur, area_m2, property_type, listed_at, listing_status',
    )
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .single()

  if (canonicalErr || !canonical) {
    throw new Error(`[EnrichmentPipeline] canonical not found: ${canonicalId} — ${canonicalErr?.message ?? 'no data'}`)
  }

  const priceEur   = Number(canonical.price_eur)
  const areaM2     = Number(canonical.area_m2)
  const pricePerM2 = areaM2 > 0 ? Math.round((priceEur / areaM2) * 100) / 100 : 0
  const listedAt   = new Date(canonical.listed_at as string)
  const daysListed = Math.max(0, (Date.now() - listedAt.getTime()) / 86_400_000)

  // 2. Fetch liquidity_heatmap for zone/city context
  const { data: heatmap } = await (supabaseAdmin as any)
    .from('liquidity_heatmap')
    .select('demand_score, supply_score, heat_index, active_listings')
    .eq('tenant_id', tenantId)
    .eq('zone', canonical.zone ?? canonical.city)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const heatIndex      = heatmap?.heat_index     ? Number(heatmap.heat_index)     : null
  const demandScore    = heatmap?.demand_score   ? Number(heatmap.demand_score)   : null
  const activeListings = heatmap?.active_listings ? Number(heatmap.active_listings) : 0

  // 3. Compute market median from canonical_properties in same zone
  const { data: zonePrices } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('price_eur, area_m2')
    .eq('tenant_id', tenantId)
    .eq('city', canonical.city)
    .eq('property_type', canonical.property_type)
    .eq('listing_status', 'active')
    .neq('canonical_id', canonicalId)
    .limit(100)

  const zoneRows = (zonePrices ?? []) as { price_eur: number; area_m2: number }[]
  const zonePerM2 = zoneRows
    .map((r) => (Number(r.area_m2) > 0 ? Number(r.price_eur) / Number(r.area_m2) : 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b)

  let marketMedianPricePerM2: number | null = null
  if (zonePerM2.length > 0) {
    const mid = Math.floor(zonePerM2.length / 2)
    marketMedianPricePerM2 = zonePerM2.length % 2 === 0
      ? (zonePerM2[mid - 1] + zonePerM2[mid]) / 2
      : zonePerM2[mid]
    marketMedianPricePerM2 = Math.round(marketMedianPricePerM2 * 100) / 100
  }

  const priceVsMarketPct = marketMedianPricePerM2 && marketMedianPricePerM2 > 0
    ? Math.round(((pricePerM2 - marketMedianPricePerM2) / marketMedianPricePerM2) * 10000) / 100
    : null

  // 4. Zone classification
  const zoneClassification = classifyZone(heatIndex, pricePerM2, marketMedianPricePerM2)

  // 5. Count similar properties listed vs sold in last 90d
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()

  const { count: similarListed } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('canonical_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('city', canonical.city)
    .eq('property_type', canonical.property_type)
    .eq('listing_status', 'active')

  const { count: similarSold90d } = await (supabaseAdmin as any)
    .from('canonical_properties')
    .select('canonical_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('city', canonical.city)
    .eq('property_type', canonical.property_type)
    .eq('listing_status', 'sold')
    .gte('computed_at', ninetyDaysAgo)

  // 6. Watchlist/match demand signals from matches table
  const { count: matchCount } = await (supabaseAdmin as any)
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', canonicalId)

  const demandPressure = classifyDemandPressure(
    demandScore ? Math.round(demandScore) : 0,
    matchCount ?? 0,
    activeListings,
  )

  // 7. Check for price drop in history
  const { data: priceHistory } = await (supabaseAdmin as any)
    .from('price_history')
    .select('price')
    .eq('property_id', canonicalId)
    .order('recorded_at', { ascending: false })
    .limit(2)

  const hadPriceDrop = (() => {
    const rows = (priceHistory ?? []) as { price: number }[]
    if (rows.length < 2) return false
    return Number(rows[0].price) < Number(rows[1].price)
  })()

  // 8. Risk tags
  const riskTags = computeRiskTags({
    priceVsMarketPct,
    daysListed,
    demandPressure,
    hadPriceDrop,
  })

  // 9. Liquidity index (0–100): combines heat, demand, sell speed
  const avgDaysToSell: number | null = null // populated from market_properties if available
  const liquidityIndex = heatIndex != null
    ? Math.round(heatIndex * 0.6 + (demandScore ?? 50) * 0.4)
    : null

  const result: EnrichmentResult = {
    canonical_id:               canonicalId,
    neighborhood:               null,
    municipality:               canonical.city,
    postal_code:                null,
    zone_classification:        zoneClassification,
    price_per_m2:               pricePerM2,
    market_median_price_per_m2: marketMedianPricePerM2,
    price_vs_market_pct:        priceVsMarketPct,
    avg_days_to_sell_in_zone:   avgDaysToSell,
    liquidity_index:            liquidityIndex,
    risk_tags:                  riskTags,
    demand_pressure:            demandPressure,
    similar_properties_listed:  similarListed ?? 0,
    similar_properties_sold_90d: similarSold90d ?? 0,
    enriched_at:                enrichedAt,
  }

  // 10. Upsert enrichment record
  const { error: upsertErr } = await (supabaseAdmin as any)
    .from('property_enrichments')
    .upsert(
      {
        canonical_id:               canonicalId,
        tenant_id:                  tenantId,
        zone_classification:        zoneClassification,
        market_median_price_per_m2: marketMedianPricePerM2,
        price_vs_market_pct:        priceVsMarketPct,
        avg_days_to_sell_in_zone:   avgDaysToSell,
        liquidity_index:            liquidityIndex,
        risk_tags:                  riskTags,
        demand_pressure:            demandPressure,
        similar_listed:             similarListed ?? 0,
        similar_sold_90d:           similarSold90d ?? 0,
        enriched_at:                enrichedAt,
      },
      { onConflict: 'canonical_id,tenant_id' },
    )

  if (upsertErr) {
    console.error('[EnrichmentPipeline] upsert error:', upsertErr.message)
  }

  // 11. Also update price_per_m2 on canonical record
  void (supabaseAdmin as any)
    .from('canonical_properties')
    .update({ price_per_m2: pricePerM2, computed_at: enrichedAt })
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)

  // 12. Emit property.enriched event (fire-and-forget)
  void (supabaseAdmin as any).from('runtime_events').insert({
    org_id:          tenantId,
    type:            'property.enriched',
    status:          'completed',
    payload: {
      canonical_id:        canonicalId,
      zone_classification: zoneClassification,
      risk_tags:           riskTags,
      demand_pressure:     demandPressure,
      price_vs_market_pct: priceVsMarketPct,
    },
    correlation_id: canonicalId,
    event_timestamp: enrichedAt,
  })

  return result
}
