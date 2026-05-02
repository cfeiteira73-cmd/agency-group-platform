// =============================================================================
// Agency Group — Cross-Provider Deduplication Engine
// lib/ingestion/dedup.ts
//
// Prevents duplicate listings from being created when multiple providers
// have the same property (e.g. same apartment listed on both Idealista and Imovirtual).
//
// ALGORITHM (three-pass):
//   Pass 1 (exact)   — same provider + provider_listing_id in properties table
//   Pass 2 (address) — normalize address → compare Jaccard token similarity ≥ 0.7
//   Pass 3 (metric)  — city + area within 8% + price within 12% + bedrooms match
//
// Result:
//   - is_new = true  → safe to insert as new property
//   - is_new = false → existing property_id to upsert/update
//   - merge_confidence: 0-1 indicating match certainty
//
// PURE FUNCTIONS (dedup logic):
//   normalizeAddress, tokenJaccard, isSameProperty
//
// DB FUNCTIONS (need Supabase):
//   findExistingByProviderKey, findExistingByMetrics
//
// The pure functions are tested in __tests__/lib/ingestion/dedup.test.ts
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import {
  type ProviderListing,
  type DedupResult,
} from '@/lib/ingestion/types'

// ---------------------------------------------------------------------------
// Address normalization (pure — testable)
// ---------------------------------------------------------------------------

/**
 * Normalize an address string for comparison.
 * Strips punctuation, lowercases, removes common noise words.
 */
export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return ''
  return addr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip diacritics
    .replace(/[.,\-_#º°]/g, ' ')
    .replace(/\b(rua|avenida|av|travessa|largo|praca|praceta|beco|calçada|estrada)\b/g, '')
    .replace(/\b(n|nr|numero|no)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute Jaccard similarity between two strings based on word tokens.
 * Returns 0–1 (1 = identical).
 */
export function tokenJaccard(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 1))
  const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 1))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }
  const union = tokensA.size + tokensB.size - intersection
  return intersection / union
}

/**
 * Check if two numbers are within a given relative tolerance.
 */
export function withinTolerance(a: number, b: number, tolerance: number): boolean {
  if (a <= 0 || b <= 0) return false
  const ratio = Math.abs(a - b) / Math.max(a, b)
  return ratio <= tolerance
}

/**
 * Check if two listings are the same property using metric matching only.
 * Returns merge confidence (0 = definitely different, 1 = definitely same).
 * Pure function — no DB calls.
 */
export function isSameProperty(
  a: { price?: number; area_m2?: number | null; bedrooms?: number | null; city?: string | null },
  b: { price?: number; area_m2?: number | null; bedrooms?: number | null; city?: string | null },
): number {
  let score = 0
  let checks = 0

  // City must match (case-insensitive) if both provided
  if (a.city && b.city) {
    checks++
    if (a.city.toLowerCase().trim() === b.city.toLowerCase().trim()) score++
    else return 0  // different city = definitely different property
  }

  // Price within 12%
  if (a.price && b.price) {
    checks++
    if (withinTolerance(a.price, b.price, 0.12)) score++
  }

  // Area within 8%
  if (a.area_m2 && b.area_m2) {
    checks++
    if (withinTolerance(a.area_m2, b.area_m2, 0.08)) score++
  }

  // Bedrooms must match exactly (if both provided)
  if (a.bedrooms != null && b.bedrooms != null) {
    checks++
    if (a.bedrooms === b.bedrooms) score++
    else if (Math.abs(a.bedrooms - b.bedrooms) > 1) return 0  // >1 bedroom difference = different
  }

  return checks > 0 ? score / checks : 0
}

// ---------------------------------------------------------------------------
// DB lookups
// ---------------------------------------------------------------------------

/**
 * Look up existing property by provider + provider_listing_id (exact match).
 */
async function findByProviderKey(
  provider: string,
  listingId: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from('properties')
    .select('id')
    .eq('source_provider', provider)
    .eq('provider_listing_id', listingId)
    .limit(1)
    .single()

  return data?.id ?? null
}

/**
 * Find candidate existing properties by city + approximate price range.
 * Returns limited results for metric comparison.
 */
async function findCandidatesByMetrics(
  city: string,
  price: number,
  area_m2: number | null | undefined,
): Promise<Array<{
  id: string
  price: number
  area_m2: number | null
  bedrooms: number | null
  city: string | null
  address: string | null
}>> {
  // Price tolerance for DB query: wider than dedup threshold to cast a net
  const priceMin = Math.round(price * 0.80)
  const priceMax = Math.round(price * 1.25)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('properties')
    .select('id, price, area_m2, bedrooms, city, address')
    .eq('status', 'active')
    .gte('price', priceMin)
    .lte('price', priceMax)
    .ilike('city', `%${city}%`)
    .limit(20)

  if (area_m2) {
    const areaMin = Math.round(area_m2 * 0.88)
    const areaMax = Math.round(area_m2 * 1.12)
    query = query.gte('area_m2', areaMin).lte('area_m2', areaMax)
  }

  const { data } = await query
  return data ?? []
}

// ---------------------------------------------------------------------------
// Main dedup function
// ---------------------------------------------------------------------------

/**
 * Check if a provider listing already exists in the properties table.
 * Returns DedupResult with canonical_id and match confidence.
 */
export async function checkDuplicate(
  listing: ProviderListing,
): Promise<DedupResult> {
  // ── Pass 1: Exact provider key match ─────────────────────────────────────
  const exactId = await findByProviderKey(listing.provider, listing.provider_listing_id)
  if (exactId) {
    return {
      canonical_id:     exactId,
      is_new:           false,
      merge_confidence: 1.0,
      match_signals:    ['provider_key_exact'],
    }
  }

  // ── Pass 2: Skip address-based dedup if no address data ──────────────────
  if (!listing.price || listing.price <= 0) {
    return { canonical_id: null, is_new: true, merge_confidence: 0, match_signals: [] }
  }

  // ── Pass 3: Metric-based match with DB candidates ────────────────────────
  const city = listing.city ?? ''
  if (!city) {
    return { canonical_id: null, is_new: true, merge_confidence: 0, match_signals: [] }
  }

  const candidates = await findCandidatesByMetrics(city, listing.price, listing.area_m2)
  if (candidates.length === 0) {
    return { canonical_id: null, is_new: true, merge_confidence: 0, match_signals: [] }
  }

  let bestId: string | null = null
  let bestScore = 0
  const matchSignals: string[] = []

  for (const candidate of candidates) {
    const metricScore = isSameProperty(
      { price: listing.price, area_m2: listing.area_m2, bedrooms: listing.bedrooms, city: listing.city },
      { price: candidate.price, area_m2: candidate.area_m2, bedrooms: candidate.bedrooms, city: candidate.city },
    )

    // Also check address similarity if both have addresses
    let addressBoost = 0
    if (listing.address && candidate.address) {
      const sim = tokenJaccard(
        normalizeAddress(listing.address),
        normalizeAddress(candidate.address),
      )
      if (sim >= 0.7) addressBoost = 0.3
    }

    const totalScore = Math.min(1.0, metricScore + addressBoost)

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestId = candidate.id
    }
  }

  // Threshold: >0.75 = confident duplicate
  if (bestScore >= 0.75) {
    matchSignals.push(`metric_match_confidence_${Math.round(bestScore * 100)}`)
    return {
      canonical_id:     bestId,
      is_new:           false,
      merge_confidence: bestScore,
      match_signals:    matchSignals,
    }
  }

  return {
    canonical_id:     null,
    is_new:           true,
    merge_confidence: 0,
    match_signals:    [],
  }
}

// ---------------------------------------------------------------------------
// Batch dedup — check a batch of listings against each other (intra-batch)
// and against the DB.
// ---------------------------------------------------------------------------

export interface BatchDedupItem {
  listing:  ProviderListing
  result:   DedupResult
}

export async function batchCheckDuplicates(
  listings: ProviderListing[],
): Promise<BatchDedupItem[]> {
  const results: BatchDedupItem[] = []
  // Track which provider_listing_ids we've already processed in this batch
  // to avoid within-batch duplication
  const seenThisBatch = new Set<string>()

  for (const listing of listings) {
    const batchKey = `${listing.provider}:${listing.provider_listing_id}`

    if (seenThisBatch.has(batchKey)) {
      results.push({
        listing,
        result: {
          canonical_id:     null,
          is_new:           false,
          merge_confidence: 1.0,
          match_signals:    ['intra_batch_duplicate'],
        },
      })
      continue
    }

    seenThisBatch.add(batchKey)
    const result = await checkDuplicate(listing)
    results.push({ listing, result })
  }

  return results
}
