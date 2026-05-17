// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// lib/buyer-intelligence/intentClassifier.ts

import type {
  BuyerBehaviorEvent,
  BuyerIntent,
  BuyerIntentProfile,
  UrgencyLevel,
} from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function toString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// ---------------------------------------------------------------------------
// IntentClassifier
// ---------------------------------------------------------------------------

export class IntentClassifier {
  /**
   * Derive a BuyerIntentProfile from a list of raw behavior events.
   * All scoring is deterministic and runs in-process — no external calls.
   */
  classify(events: BuyerBehaviorEvent[]): BuyerIntentProfile {
    const sessionId = events[0]?.session_id ?? 'unknown'

    // ── Mutable score accumulators ──────────────────────────────────────────
    let luxuryAffinity = 0
    let investorAffinity = 0
    let familyAffinity = 0
    let internationalProbability = 0
    let urgency: UrgencyLevel = 'unknown'
    let budgetMaxEstimate: number | undefined
    let budgetMinEstimate: number | undefined

    const preferredZones = new Set<string>()
    const preferredTypes = new Set<string>()

    const timestamps = events.map((e) => new Date(e.timestamp).getTime())
    const firstSeen = new Date(Math.min(...timestamps, Date.now()))
    const lastSeen = new Date(Math.max(...timestamps, Date.now()))

    // ── Signal processing ───────────────────────────────────────────────────
    for (const event of events) {
      const p = event.payload

      switch (event.event_type) {
        // ── listing_view ─────────────────────────────────────────────────
        case 'listing_view': {
          const price = toNumber(p.price)
          if (price !== undefined) {
            if (price > 1_000_000) {
              luxuryAffinity += 20
            }
            if (price > 2_000_000) {
              luxuryAffinity += 10 // stacked: already +20 above
              if (budgetMaxEstimate === undefined || price > budgetMaxEstimate) {
                budgetMaxEstimate = price
              }
            }
          }
          const zone = toString(p.zone)
          if (zone) preferredZones.add(zone)
          const type = toString(p.property_type)
          if (type) preferredTypes.add(type)
          // Repeated views of same listing → investor signal (due diligence)
          const viewCount = toNumber(p.view_count)
          if (viewCount !== undefined && viewCount >= 3) {
            investorAffinity += 10
          }
          break
        }

        // ── listing_save ─────────────────────────────────────────────────
        case 'listing_save': {
          const price = toNumber(p.price)
          if (price !== undefined && price > 1_000_000) {
            luxuryAffinity += 10
          }
          const zone = toString(p.zone)
          if (zone) preferredZones.add(zone)
          break
        }

        // ── filter_apply ─────────────────────────────────────────────────
        case 'filter_apply': {
          const filterType = toString(p.type)
          if (filterType === 'investor' || filterType === 'investment') {
            investorAffinity += 30
          }
          if (filterType === 'family' || filterType === 'family_home') {
            familyAffinity += 20
          }
          if (filterType === 'retirement' || filterType === 'golden_visa') {
            investorAffinity += 15
            internationalProbability += 15
          }
          // Price filter signals budget
          const minPrice = toNumber(p.price_min)
          const maxPrice = toNumber(p.price_max)
          if (minPrice !== undefined) {
            if (budgetMinEstimate === undefined || minPrice < budgetMinEstimate) {
              budgetMinEstimate = minPrice
            }
          }
          if (maxPrice !== undefined) {
            if (budgetMaxEstimate === undefined || maxPrice > budgetMaxEstimate) {
              budgetMaxEstimate = maxPrice
            }
            if (maxPrice > 1_000_000) luxuryAffinity += 15
          }
          // Bedroom filter → family signal
          const beds = toNumber(p.bedrooms_min)
          if (beds !== undefined && beds >= 3) {
            familyAffinity += 15
          }
          // Zone filter
          const zone = toString(p.zone)
          if (zone) preferredZones.add(zone)
          const propType = toString(p.property_type)
          if (propType) preferredTypes.add(propType)
          break
        }

        // ── price_range_view ─────────────────────────────────────────────
        case 'price_range_view': {
          const price = toNumber(p.price_max) ?? toNumber(p.price)
          if (price !== undefined && price > 2_000_000) {
            luxuryAffinity += 30
            if (budgetMaxEstimate === undefined || price > budgetMaxEstimate) {
              budgetMaxEstimate = price
            }
          }
          const minPrice = toNumber(p.price_min)
          if (minPrice !== undefined) {
            if (budgetMinEstimate === undefined || minPrice < budgetMinEstimate) {
              budgetMinEstimate = minPrice
            }
          }
          break
        }

        // ── page_view ────────────────────────────────────────────────────
        case 'page_view': {
          const path = toString(p.path) ?? ''
          if (path.includes('/imoveis') || path.includes('/properties')) {
            // browsing signal — no affinity bump, handled in urgency fallthrough
          }
          if (path.includes('/investidor') || path.includes('/investor')) {
            investorAffinity += 20
          }
          if (path.includes('/international') || path.includes('/relocat')) {
            internationalProbability += 20
          }
          if (path.includes('/familia') || path.includes('/family')) {
            familyAffinity += 15
          }
          // Language / locale signals
          const locale = toString(p.locale)
          if (locale && locale !== 'pt' && locale !== 'pt-PT') {
            internationalProbability += 10
          }
          break
        }

        // ── map_view ─────────────────────────────────────────────────────
        case 'map_view': {
          // Exploring zones → mild investor / relocating signal
          investorAffinity += 5
          const zone = toString(p.zone)
          if (zone) preferredZones.add(zone)
          break
        }

        // ── inquiry_start ────────────────────────────────────────────────
        case 'inquiry_start': {
          if (urgency !== 'hot') urgency = 'warm'
          break
        }

        // ── inquiry_submit ───────────────────────────────────────────────
        case 'inquiry_submit': {
          urgency = 'hot'
          // Submitting an inquiry on a high-value property → investor/luxury signal
          const price = toNumber(p.price)
          if (price !== undefined && price > 1_000_000) {
            luxuryAffinity += 15
          }
          break
        }

        // ── revisit ──────────────────────────────────────────────────────
        case 'revisit': {
          if (urgency !== 'hot') urgency = 'warm'
          investorAffinity += 10 // revisits signal due diligence
          break
        }

        // ── scroll_depth ─────────────────────────────────────────────────
        case 'scroll_depth': {
          const depth = toNumber(p.depth_percent)
          if (depth !== undefined && depth >= 90) {
            // Deep reading → engaged, mild luxury signal
            luxuryAffinity += 5
          }
          break
        }

        default:
          break
      }
    }

    // ── Urgency fallback ────────────────────────────────────────────────────
    if (urgency === 'unknown' && events.length > 0) {
      urgency = 'browsing'
    }

    // ── Clamp all affinities ────────────────────────────────────────────────
    luxuryAffinity         = clamp(luxuryAffinity)
    investorAffinity       = clamp(investorAffinity)
    familyAffinity         = clamp(familyAffinity)
    internationalProbability = clamp(internationalProbability)

    // ── Determine primary and secondary intents ─────────────────────────────
    const intentScores: Array<{ intent: BuyerIntent; score: number }> = [
      { intent: 'investor',      score: investorAffinity },
      { intent: 'luxury_buyer',  score: luxuryAffinity },
      { intent: 'family',        score: familyAffinity },
      { intent: 'international', score: internationalProbability },
    ]

    // Sort descending by score
    intentScores.sort((a, b) => b.score - a.score)

    const topIntent = intentScores[0]
    const runnerUp  = intentScores[1]

    let primaryIntent: BuyerIntent = 'unknown'
    let secondaryIntent: BuyerIntent | undefined

    if (topIntent.score > 0) {
      primaryIntent = topIntent.intent

      // Only assign secondary if meaningfully different from primary
      if (runnerUp.score > 0 && runnerUp.score >= topIntent.score * 0.5) {
        secondaryIntent = runnerUp.intent !== primaryIntent ? runnerUp.intent : undefined
      }
    }

    // ── Confidence: grows with signal count, capped at 100 ─────────────────
    const signalCount  = events.length
    const confidence   = clamp(signalCount * 15)

    return {
      session_id:              sessionId,
      primary_intent:          primaryIntent,
      secondary_intent:        secondaryIntent,
      urgency,
      budget_min_estimate:     budgetMinEstimate,
      budget_max_estimate:     budgetMaxEstimate,
      preferred_zones:         Array.from(preferredZones),
      preferred_types:         Array.from(preferredTypes),
      luxury_affinity:         luxuryAffinity,
      investor_affinity:       investorAffinity,
      family_affinity:         familyAffinity,
      international_probability: internationalProbability,
      confidence,
      signal_count:            signalCount,
      first_seen:              firstSeen,
      last_seen:               lastSeen,
      events,
    }
  }
}

export const intentClassifier = new IntentClassifier()
