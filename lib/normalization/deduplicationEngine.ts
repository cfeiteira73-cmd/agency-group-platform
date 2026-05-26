// =============================================================================
// Agency Group — Deduplication Engine v1.0
// Wave 42 | lib/normalization/deduplicationEngine.ts
// TypeScript strict — 0 errors
//
// Probabilistic deduplication across sources.
// Same property from Idealista AND Casafari = one canonical asset.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeduplicationCandidate {
  asset_a_id: string
  asset_b_id: string
  similarity_score: number  // 0–1
  match_signals: Array<{
    signal: string
    matches: boolean
    weight: number
    value_a: unknown
    value_b: unknown
  }>
  recommendation: 'MERGE' | 'LIKELY_SAME' | 'POSSIBLY_SAME' | 'DIFFERENT'
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Haversine formula — returns distance in meters between two coordinates.
 * Pure function.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000  // Earth radius in meters
  const toRad = (deg: number): number => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Computes similarity between two asset records.
 * Pure function — no I/O.
 *
 * Signals (weights must sum to 1.0):
 * - price within 5%:          0.30
 * - size within 10%:          0.25
 * - same city + district:     0.20
 * - coordinates within 100m:  0.15
 * - same bedrooms:            0.10
 *
 * Recommendation thresholds:
 * - MERGE:         score >= 0.75
 * - LIKELY_SAME:   score >= 0.55
 * - POSSIBLY_SAME: score >= 0.35
 * - DIFFERENT:     score < 0.35
 */
export function computeSimilarity(
  assetA: Record<string, unknown>,
  assetB: Record<string, unknown>
): DeduplicationCandidate {
  const asset_a_id = String(assetA['asset_id'] ?? '')
  const asset_b_id = String(assetB['asset_id'] ?? '')

  const signals: DeduplicationCandidate['match_signals'] = []
  let totalScore = 0

  // ── Signal 1: Price within 5% — weight 0.30 ──────────────────────────────
  const priceA = assetA['asking_price_eur_cents'] != null ? Number(assetA['asking_price_eur_cents']) : null
  const priceB = assetB['asking_price_eur_cents'] != null ? Number(assetB['asking_price_eur_cents']) : null
  const priceWeight = 0.30
  const priceMatches =
    priceA !== null && priceB !== null && priceA > 0 && priceB > 0
      ? Math.abs(priceA - priceB) / Math.max(priceA, priceB) <= 0.05
      : false
  signals.push({
    signal: 'price_within_5pct',
    matches: priceMatches,
    weight: priceWeight,
    value_a: priceA,
    value_b: priceB,
  })
  if (priceMatches) totalScore += priceWeight

  // ── Signal 2: Size within 10% — weight 0.25 ──────────────────────────────
  const sizeA = assetA['size_sqm'] != null ? Number(assetA['size_sqm']) : null
  const sizeB = assetB['size_sqm'] != null ? Number(assetB['size_sqm']) : null
  const sizeWeight = 0.25
  const sizeMatches =
    sizeA !== null && sizeB !== null && sizeA > 0 && sizeB > 0
      ? Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB) <= 0.10
      : false
  signals.push({
    signal: 'size_within_10pct',
    matches: sizeMatches,
    weight: sizeWeight,
    value_a: sizeA,
    value_b: sizeB,
  })
  if (sizeMatches) totalScore += sizeWeight

  // ── Signal 3: Same city + district — weight 0.20 ─────────────────────────
  const cityA = assetA['city'] != null ? String(assetA['city']).toUpperCase().trim() : null
  const cityB = assetB['city'] != null ? String(assetB['city']).toUpperCase().trim() : null
  const districtA = assetA['district'] != null ? String(assetA['district']).toUpperCase().trim() : null
  const districtB = assetB['district'] != null ? String(assetB['district']).toUpperCase().trim() : null
  const locationWeight = 0.20
  const cityMatches = cityA !== null && cityB !== null && cityA === cityB
  // If both have districts, require district match too. If one is null, city match is sufficient.
  const districtMatches =
    districtA !== null && districtB !== null
      ? districtA === districtB
      : true  // null district = not disqualifying
  const locationMatches = cityMatches && districtMatches
  signals.push({
    signal: 'same_city_district',
    matches: locationMatches,
    weight: locationWeight,
    value_a: `${cityA ?? ''}|${districtA ?? ''}`,
    value_b: `${cityB ?? ''}|${districtB ?? ''}`,
  })
  if (locationMatches) totalScore += locationWeight

  // ── Signal 4: Coordinates within 100m — weight 0.15 ──────────────────────
  const latA = assetA['latitude'] != null ? Number(assetA['latitude']) : null
  const lonA = assetA['longitude'] != null ? Number(assetA['longitude']) : null
  const latB = assetB['latitude'] != null ? Number(assetB['latitude']) : null
  const lonB = assetB['longitude'] != null ? Number(assetB['longitude']) : null
  const coordWeight = 0.15
  let coordMatches = false
  let distMeters: number | null = null
  if (latA !== null && lonA !== null && latB !== null && lonB !== null) {
    distMeters = haversineDistance(latA, lonA, latB, lonB)
    coordMatches = distMeters <= 100
  }
  signals.push({
    signal: 'coordinates_within_100m',
    matches: coordMatches,
    weight: coordWeight,
    value_a: latA !== null ? `${latA},${lonA}` : null,
    value_b: latB !== null ? `${latB},${lonB}` : null,
  })
  if (coordMatches) totalScore += coordWeight

  // ── Signal 5: Same bedrooms — weight 0.10 ────────────────────────────────
  const bedroomsA = assetA['bedrooms'] != null ? Number(assetA['bedrooms']) : null
  const bedroomsB = assetB['bedrooms'] != null ? Number(assetB['bedrooms']) : null
  const bedroomsWeight = 0.10
  const bedroomsMatch =
    bedroomsA !== null && bedroomsB !== null ? bedroomsA === bedroomsB : false
  signals.push({
    signal: 'same_bedrooms',
    matches: bedroomsMatch,
    weight: bedroomsWeight,
    value_a: bedroomsA,
    value_b: bedroomsB,
  })
  if (bedroomsMatch) totalScore += bedroomsWeight

  // ── Recommendation ────────────────────────────────────────────────────────
  const recommendation: DeduplicationCandidate['recommendation'] =
    totalScore >= 0.75 ? 'MERGE' :
    totalScore >= 0.55 ? 'LIKELY_SAME' :
    totalScore >= 0.35 ? 'POSSIBLY_SAME' :
    'DIFFERENT'

  return {
    asset_a_id,
    asset_b_id,
    similarity_score: Math.round(totalScore * 1000) / 1000,  // 3 decimal places
    match_signals: signals,
    recommendation,
  }
}

// ─── Main sweep ───────────────────────────────────────────────────────────────

/**
 * Reads recent canonical_assets (last 7 days), runs pairwise similarity
 * for assets in same city (max 200 comparisons per run).
 * Auto-merges MERGE recommendations.
 * Flags LIKELY_SAME for review.
 * Persists to deduplication_candidates.
 */
export async function runDeduplicationSweep(
  tenantId: string,
  limit = 200
): Promise<{ candidates: number; merged: number; flagged: number }> {
  const sweepLimit = Math.min(limit, 200)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch recent assets
  const { data: recentAssets, error } = await (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('normalization_status', 'REJECTED')
    .neq('normalization_status', 'DEDUPLICATED')
    .gte('last_updated_at', sevenDaysAgo)
    .order('last_updated_at', { ascending: false })
    .limit(sweepLimit)

  if (error || !recentAssets) {
    log.warn('[deduplicationEngine] sweep fetch error', { error })
    return { candidates: 0, merged: 0, flagged: 0 }
  }

  const assets = recentAssets as Record<string, unknown>[]

  if (assets.length < 2) {
    return { candidates: 0, merged: 0, flagged: 0 }
  }

  // Group by city for pairwise comparison
  const byCity = new Map<string, Record<string, unknown>[]>()
  for (const asset of assets) {
    const city = String(asset['city'] ?? 'UNKNOWN').toUpperCase()
    if (!byCity.has(city)) byCity.set(city, [])
    byCity.get(city)!.push(asset)
  }

  let candidatesCount = 0
  let merged = 0
  let flagged = 0
  let comparisons = 0

  for (const [, cityAssets] of byCity) {
    for (let i = 0; i < cityAssets.length; i++) {
      for (let j = i + 1; j < cityAssets.length; j++) {
        if (comparisons >= sweepLimit) break

        const candidate = computeSimilarity(cityAssets[i]!, cityAssets[j]!)
        if (candidate.recommendation === 'DIFFERENT') {
          comparisons++
          continue
        }

        candidatesCount++
        comparisons++

        // Persist candidate
        void (supabaseAdmin as any)
          .from('deduplication_candidates')
          .upsert(
            {
              tenant_id: tenantId,
              asset_a_id: candidate.asset_a_id,
              asset_b_id: candidate.asset_b_id,
              similarity_score: candidate.similarity_score,
              match_signals: candidate.match_signals,
              recommendation: candidate.recommendation,
              status: candidate.recommendation === 'MERGE' ? 'AUTO_MERGED' :
                      candidate.recommendation === 'LIKELY_SAME' ? 'NEEDS_REVIEW' : 'PENDING',
              detected_at: new Date().toISOString(),
            },
            { onConflict: 'asset_a_id,asset_b_id' }
          )
          .then(({ error: upsertError }: { error: unknown }) => {
            if (upsertError) log.warn('[deduplicationEngine] candidate upsert error', { upsertError })
          })
          .catch((e: unknown) => log.warn('[deduplicationEngine] candidate upsert exception', { e }))

        // Auto-merge MERGE recommendations
        if (candidate.recommendation === 'MERGE') {
          try {
            // Import dynamically to avoid circular dependency
            const { mergeAssets } = await import('@/lib/normalization/canonicalAssetGraph')
            await mergeAssets(candidate.asset_a_id, candidate.asset_b_id, tenantId)
            merged++
          } catch (mergeErr) {
            log.warn('[deduplicationEngine] auto-merge failed', { mergeErr, candidate })
          }
        } else if (candidate.recommendation === 'LIKELY_SAME') {
          flagged++
        }
      }
      if (comparisons >= sweepLimit) break
    }
  }

  log.info('[deduplicationEngine] sweep complete', { candidatesCount, merged, flagged, comparisons, tenantId })
  return { candidates: candidatesCount, merged, flagged }
}
