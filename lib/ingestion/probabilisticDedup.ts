// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Probabilistic Deduplication (Wave 32 Layer 1)
// lib/ingestion/probabilisticDedup.ts
//
// ML-style similarity scoring between CanonicalPropertyInput objects.
// Factors: geo_similarity, price_similarity, area_similarity, text_similarity,
// type_match.  is_duplicate = score >= 0.80.
//
// deduplicateBatch: O(n²) for batches ≤ 500.  For each duplicate pair,
// keeps the item with the more recent updated_at.
// =============================================================================

import type { CanonicalPropertyInput } from '@/lib/ingestion/normalizationPipeline'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DedupScore {
  score: number
  factors: {
    geo_similarity: number
    price_similarity: number
    area_similarity: number
    text_similarity: number
    type_match: number
  }
  is_duplicate: boolean
}

// ─── Factor helpers ───────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lon points */
function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function geoSimilarity(
  a: CanonicalPropertyInput,
  b: CanonicalPropertyInput,
): number {
  if (
    a.latitude == null || a.longitude == null ||
    b.latitude == null || b.longitude == null
  ) return 0.5   // no geo data — neutral

  const dist = haversineMetres(a.latitude, a.longitude, b.latitude, b.longitude)
  if (dist <= 50)  return 1.0
  if (dist <= 100) return 0.7 + (100 - dist) / 50 * 0.3   // 0.7–1.0
  if (dist <= 500) return 0.3 + (500 - dist) / 400 * 0.4   // 0.3–0.7
  return 0.0
}

function ratioDiff(a: number, b: number): number {
  if (a <= 0 && b <= 0) return 0
  if (a <= 0 || b <= 0) return 1
  const avg = (a + b) / 2
  return Math.abs(a - b) / avg
}

function priceSimilarity(a: CanonicalPropertyInput, b: CanonicalPropertyInput): number {
  const diff = ratioDiff(a.price_eur, b.price_eur)
  if (diff <= 0.03) return 1.0
  if (diff <= 0.10) return 0.6 + (0.10 - diff) / 0.07 * 0.4
  if (diff <= 0.25) return 0.2 + (0.25 - diff) / 0.15 * 0.4
  return 0.0
}

function areaSimilarity(a: CanonicalPropertyInput, b: CanonicalPropertyInput): number {
  const diff = ratioDiff(a.area_sqm, b.area_sqm)
  if (diff <= 0.03) return 1.0
  if (diff <= 0.10) return 0.6 + (0.10 - diff) / 0.07 * 0.4
  if (diff <= 0.20) return 0.2 + (0.20 - diff) / 0.10 * 0.4
  return 0.0
}

/** Jaccard similarity on lower-cased word tokens */
function jaccardTokens(s1: string, s2: string): number {
  const tok = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1))
  const a = tok(s1)
  const b = tok(s2)
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) { if (b.has(t)) inter++ }
  return inter / (a.size + b.size - inter)
}

function textSimilarity(a: CanonicalPropertyInput, b: CanonicalPropertyInput): number {
  return jaccardTokens(a.title, b.title)
}

function typeMatch(a: CanonicalPropertyInput, b: CanonicalPropertyInput): number {
  return a.typology === b.typology ? 1.0 : 0.0
}

// ─── Weights ─────────────────────────────────────────────────────────────────
// Must sum to 1.0

const W_GEO   = 0.35
const W_PRICE = 0.25
const W_AREA  = 0.20
const W_TEXT  = 0.12
const W_TYPE  = 0.08

// ─── Main exports ─────────────────────────────────────────────────────────────

export function computeDedupScore(
  a: CanonicalPropertyInput,
  b: CanonicalPropertyInput,
): DedupScore {
  const geo   = geoSimilarity(a, b)
  const price = priceSimilarity(a, b)
  const area  = areaSimilarity(a, b)
  const text  = textSimilarity(a, b)
  const type  = typeMatch(a, b)

  const score =
    geo   * W_GEO   +
    price * W_PRICE +
    area  * W_AREA  +
    text  * W_TEXT  +
    type  * W_TYPE

  return {
    score: Math.round(score * 1000) / 1000,
    factors: {
      geo_similarity:   Math.round(geo   * 1000) / 1000,
      price_similarity: Math.round(price * 1000) / 1000,
      area_similarity:  Math.round(area  * 1000) / 1000,
      text_similarity:  Math.round(text  * 1000) / 1000,
      type_match:       type,
    },
    is_duplicate: score >= 0.80,
  }
}

export function deduplicateBatch(items: CanonicalPropertyInput[]): {
  unique: CanonicalPropertyInput[]
  duplicates: Array<{
    kept: CanonicalPropertyInput
    removed: CanonicalPropertyInput
    score: DedupScore
  }>
} {
  if (items.length > 500) {
    // Safety: skip dedup for oversized batches — caller should chunk
    return { unique: items, duplicates: [] }
  }

  const kept: CanonicalPropertyInput[] = [...items]
  const duplicates: Array<{
    kept: CanonicalPropertyInput
    removed: CanonicalPropertyInput
    score: DedupScore
  }> = []

  // Track indices that are marked as removed
  const removed = new Set<number>()

  for (let i = 0; i < kept.length; i++) {
    if (removed.has(i)) continue
    for (let j = i + 1; j < kept.length; j++) {
      if (removed.has(j)) continue
      const dedupScore = computeDedupScore(kept[i], kept[j])
      if (dedupScore.is_duplicate) {
        // Keep the more recently updated one
        const iDate = new Date(kept[i].updated_at).getTime()
        const jDate = new Date(kept[j].updated_at).getTime()
        if (jDate > iDate) {
          // j is newer — remove i, re-anchor as j
          duplicates.push({ kept: kept[j], removed: kept[i], score: dedupScore })
          removed.add(i)
          break   // i is gone, no further comparisons for i
        } else {
          // i is newer (or equal) — remove j
          duplicates.push({ kept: kept[i], removed: kept[j], score: dedupScore })
          removed.add(j)
        }
      }
    }
  }

  const unique = kept.filter((_, idx) => !removed.has(idx))
  return { unique, duplicates }
}
