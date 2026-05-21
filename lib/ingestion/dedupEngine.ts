// =============================================================================
// Agency Group — Dedup Engine
// lib/ingestion/dedupEngine.ts
//
// Probabilistic duplicate detection for canonical properties.
// Uses multi-factor similarity scoring to identify duplicate listings
// across sources (casafari, idealista, manual, broker).
//
// Similarity weights:
//   geo_similarity   × 0.35  (strongest signal — same building = same property)
//   price_similarity × 0.20
//   area_similarity  × 0.20
//   type_match       × 0.10
//   title_similarity × 0.08
//   address_similarity × 0.07
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DedupCandidate {
  canonical_id: string
  similarity_score: number // 0-1
  match_factors: {
    geo_similarity: number     // distance-based, 1.0 if < 50m
    price_similarity: number   // 1 - abs(p1-p2)/max(p1,p2)
    area_similarity: number    // 1 - abs(a1-a2)/max(a1,a2)
    type_match: number         // 1.0 if exact match
    title_similarity: number   // Jaccard token overlap
    address_similarity: number // edit distance normalized
  }
  confidence: 'high' | 'medium' | 'low'
  auto_merge: boolean // true if similarity_score >= 0.92
}

export interface DedupResult {
  is_duplicate: boolean
  best_match: DedupCandidate | null
  candidates: DedupCandidate[]
  recommendation: 'merge' | 'flag_for_review' | 'new_entity'
}

// ─── Geo Similarity ───────────────────────────────────────────────────────────

/**
 * Haversine distance between two coordinates in metres.
 */
function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000 // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function geoSimilarity(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null,
): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0.5 // neutral when coords missing
  const dist = haversineMetres(lat1, lon1, lat2, lon2)
  if (dist < 50) return 1.0
  if (dist < 200) return 0.9
  if (dist < 500) return 0.7
  if (dist < 1000) return 0.4
  if (dist < 2000) return 0.2
  return 0.0
}

// ─── Text Similarity ─────────────────────────────────────────────────────────

/**
 * Jaccard similarity on word tokens (lowercase, stripped punctuation).
 */
export function tokenOverlap(a: string, b: string): number {
  const tokenise = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1),
    )
  const setA = tokenise(a)
  const setB = tokenise(b)
  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  return intersection / (setA.size + setB.size - intersection)
}

/**
 * Levenshtein edit distance, normalised to [0, 1] where 1 = identical.
 */
export function levenshteinNormalized(a: string, b: string): number {
  const s1 = a.toLowerCase().trim()
  const s2 = b.toLowerCase().trim()
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const m = s1.length
  const n = s2.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  const editDist = dp[m][n]
  return 1 - editDist / Math.max(m, n)
}

// ─── Similarity Scoring ───────────────────────────────────────────────────────

function scoreSimilarity(
  incoming: {
    title: string
    address: string
    city: string
    price_eur: number
    area_m2: number
    property_type: string
    latitude?: number | null
    longitude?: number | null
  },
  candidate: {
    canonical_id: string
    title: string
    address: string
    city: string
    price_eur: number
    area_m2: number
    property_type: string
    latitude?: number | null
    longitude?: number | null
  },
): DedupCandidate {
  const geo = geoSimilarity(
    incoming.latitude ?? null,
    incoming.longitude ?? null,
    candidate.latitude ?? null,
    candidate.longitude ?? null,
  )

  const maxPrice = Math.max(incoming.price_eur, candidate.price_eur)
  const price = maxPrice > 0
    ? 1 - Math.abs(incoming.price_eur - candidate.price_eur) / maxPrice
    : 1.0

  const maxArea = Math.max(incoming.area_m2, candidate.area_m2)
  const area = maxArea > 0
    ? 1 - Math.abs(incoming.area_m2 - candidate.area_m2) / maxArea
    : 1.0

  const type = incoming.property_type === candidate.property_type ? 1.0 : 0.0

  const title = tokenOverlap(incoming.title ?? '', candidate.title ?? '')
  const address = levenshteinNormalized(incoming.address, candidate.address)

  const overall =
    geo * 0.35 +
    price * 0.20 +
    area * 0.20 +
    type * 0.10 +
    title * 0.08 +
    address * 0.07

  const confidence: 'high' | 'medium' | 'low' =
    overall >= 0.85 ? 'high' : overall >= 0.70 ? 'medium' : 'low'

  return {
    canonical_id:    candidate.canonical_id,
    similarity_score: Math.round(overall * 10000) / 10000,
    match_factors: {
      geo_similarity:     Math.round(geo * 10000) / 10000,
      price_similarity:   Math.round(price * 10000) / 10000,
      area_similarity:    Math.round(area * 10000) / 10000,
      type_match:         type,
      title_similarity:   Math.round(title * 10000) / 10000,
      address_similarity: Math.round(address * 10000) / 10000,
    },
    confidence,
    auto_merge: overall >= 0.92,
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Finds duplicate canonical properties using multi-factor probabilistic scoring.
 *
 * Candidate window: same city + same type + price ±30% + area ±25%.
 * Up to 50 candidates are scored per call.
 */
export async function findDuplicates(
  tenantId: string,
  property: {
    address: string
    city: string
    price_eur: number
    area_m2: number
    property_type: string
    title?: string
    latitude?: number | null
    longitude?: number | null
  },
): Promise<DedupResult> {
  const title = property.title ?? ''
  const priceMin = property.price_eur * 0.70
  const priceMax = property.price_eur * 1.30
  const areaMin  = property.area_m2   * 0.75
  const areaMax  = property.area_m2   * 1.25

  const { data: rows, error } = await supabaseAdmin
    .from('canonical_properties')
    .select(
      'canonical_id, title, address, city, price_eur, area_m2, property_type, latitude, longitude',
    )
    .eq('tenant_id', tenantId)
    .eq('city', property.city)
    .eq('property_type', property.property_type)
    .eq('listing_status', 'active')
    .gte('price_eur', priceMin)
    .lte('price_eur', priceMax)
    .gte('area_m2', areaMin)
    .lte('area_m2', areaMax)
    .limit(50)

  if (error) {
    console.error('[DedupEngine] findDuplicates query error:', error.message)
    return { is_duplicate: false, best_match: null, candidates: [], recommendation: 'new_entity' }
  }

  if (!rows || rows.length === 0) {
    return { is_duplicate: false, best_match: null, candidates: [], recommendation: 'new_entity' }
  }

  const scored: DedupCandidate[] = (rows as {
    canonical_id: string
    title: string | null
    address: string
    city: string
    price_eur: number
    area_m2: number
    property_type: string
    latitude: number | null
    longitude: number | null
  }[])
    .map((row) =>
      scoreSimilarity(
        { ...property, title },
        {
          canonical_id:  row.canonical_id,
          title:         row.title ?? '',
          address:       row.address,
          city:          row.city,
          price_eur:     Number(row.price_eur),
          area_m2:       Number(row.area_m2),
          property_type: row.property_type,
          latitude:      row.latitude,
          longitude:     row.longitude,
        },
      ),
    )
    .filter((c) => c.similarity_score >= 0.60)
    .sort((a, b) => b.similarity_score - a.similarity_score)

  const best = scored[0] ?? null

  let recommendation: 'merge' | 'flag_for_review' | 'new_entity' = 'new_entity'
  if (best) {
    if (best.auto_merge) recommendation = 'merge'
    else if (best.similarity_score >= 0.70) recommendation = 'flag_for_review'
  }

  return {
    is_duplicate: best !== null && best.similarity_score >= 0.85,
    best_match:   best,
    candidates:   scored,
    recommendation,
  }
}
