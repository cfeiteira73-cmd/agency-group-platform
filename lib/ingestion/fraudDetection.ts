// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Fraud Detection (Wave 32 Layer 1)
// lib/ingestion/fraudDetection.ts
//
// Detects suspicious listings based on price, staleness, area, and description
// quality.  Pure functions — no DB access.
//
// Signals:
//   price_too_low         price_per_sqm < 200 EUR/m² in PT/ES
//   price_too_high        price_per_sqm > 30 000 EUR/m²
//   stale_listing         updated_at older than 90 days
//   zero_area             area_sqm <= 0
//   duplicate_injection   dedup_score >= 0.95 but different external_id
//   description_spam      > 5 URLs or obvious repeated phrases in description
// =============================================================================

import type { CanonicalPropertyInput } from '@/lib/ingestion/normalizationPipeline'

// ─── Public types ─────────────────────────────────────────────────────────────

export type FraudSignal =
  | 'price_too_low'
  | 'price_too_high'
  | 'stale_listing'
  | 'zero_area'
  | 'duplicate_injection'
  | 'description_spam'

export interface FraudCheckResult {
  is_suspicious: boolean
  signals: FraudSignal[]
  confidence: number     // 0.0–1.0
}

// ─── Signal detectors ─────────────────────────────────────────────────────────

const MIN_PRICE_PER_SQM = 200    // EUR/m² — below this in PT/ES is suspect
const MAX_PRICE_PER_SQM = 30_000 // EUR/m² — above this is suspect
const STALE_DAYS = 90

function detectPriceTooLow(item: CanonicalPropertyInput): boolean {
  if (item.area_sqm <= 0) return false
  const ppsm = item.price_per_sqm ?? (item.price_eur / item.area_sqm)
  return ppsm < MIN_PRICE_PER_SQM
}

function detectPriceTooHigh(item: CanonicalPropertyInput): boolean {
  if (item.area_sqm <= 0) return false
  const ppsm = item.price_per_sqm ?? (item.price_eur / item.area_sqm)
  return ppsm > MAX_PRICE_PER_SQM
}

function detectStaleListing(item: CanonicalPropertyInput): boolean {
  const updatedMs = new Date(item.updated_at).getTime()
  const daysAgo   = (Date.now() - updatedMs) / 86_400_000
  return daysAgo > STALE_DAYS
}

function detectZeroArea(item: CanonicalPropertyInput): boolean {
  return item.area_sqm <= 0
}

function detectDescriptionSpam(item: CanonicalPropertyInput): boolean {
  const desc = item.description
  if (!desc) return false
  // Count URLs
  const urlMatches = desc.match(/https?:\/\/[^\s]+/g)
  if (urlMatches && urlMatches.length > 5) return true
  // Detect repeated word sequences (3+ words repeated 3+ times)
  const words = desc.toLowerCase().split(/\s+/)
  if (words.length >= 6) {
    const trigramCounts = new Map<string, number>()
    for (let i = 0; i <= words.length - 3; i++) {
      const trigram = words.slice(i, i + 3).join(' ')
      trigramCounts.set(trigram, (trigramCounts.get(trigram) ?? 0) + 1)
    }
    for (const count of trigramCounts.values()) {
      if (count >= 3) return true
    }
  }
  return false
}

// ─── Confidence heuristic ─────────────────────────────────────────────────────

function computeConfidence(signals: FraudSignal[]): number {
  if (signals.length === 0) return 0
  // Each signal contributes a weight; combined with diminishing returns
  const weights: Record<FraudSignal, number> = {
    zero_area:             0.8,
    price_too_low:         0.6,
    price_too_high:        0.5,
    stale_listing:         0.3,
    duplicate_injection:   0.9,
    description_spam:      0.4,
  }
  let score = 0
  for (const sig of signals) {
    score = Math.min(1.0, score + weights[sig] * (1 - score))
  }
  return Math.round(score * 1000) / 1000
}

// ─── Main exports ─────────────────────────────────────────────────────────────

export function detectFraud(item: CanonicalPropertyInput): FraudCheckResult {
  const signals: FraudSignal[] = []

  if (detectZeroArea(item))           signals.push('zero_area')
  if (detectPriceTooLow(item))        signals.push('price_too_low')
  if (detectPriceTooHigh(item))       signals.push('price_too_high')
  if (detectStaleListing(item))       signals.push('stale_listing')
  if (detectDescriptionSpam(item))    signals.push('description_spam')

  const confidence = computeConfidence(signals)

  return {
    is_suspicious: signals.length > 0,
    signals,
    confidence,
  }
}

/**
 * Filters a batch of items into clean and flagged groups.
 * The `duplicate_injection` signal is only possible when the caller injects it
 * externally (e.g. after dedup with score >= 0.95 but different external_id).
 * This function does not cross-check items against each other — use the
 * probabilisticDedup module for that.
 */
export function filterSuspicious(items: CanonicalPropertyInput[]): {
  clean: CanonicalPropertyInput[]
  flagged: Array<{ item: CanonicalPropertyInput; result: FraudCheckResult }>
} {
  const clean: CanonicalPropertyInput[] = []
  const flagged: Array<{ item: CanonicalPropertyInput; result: FraudCheckResult }> = []

  for (const item of items) {
    const result = detectFraud(item)
    if (result.is_suspicious) {
      flagged.push({ item, result })
    } else {
      clean.push(item)
    }
  }

  return { clean, flagged }
}
