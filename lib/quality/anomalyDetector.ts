// =============================================================================
// Agency Group — Data Anomaly Detector
// lib/quality/anomalyDetector.ts
//
// Flags suspicious data during ingestion and scoring.
// All functions are PURE — no DB calls, fully testable.
//
// FLAG TYPES:
//   price_anomaly      — price deviates >3σ from zone median
//   impossible_avm     — AVM / price ratio outside plausible range
//   score_outlier      — opportunity score statistically extreme
//   malformed_listing  — required fields missing or invalid
//   stale_data         — listing unchanged for >180 days
//   duplicate_risk     — near-identical to existing listing
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlagType =
  | 'price_anomaly'
  | 'impossible_avm'
  | 'score_outlier'
  | 'malformed_listing'
  | 'stale_data'
  | 'duplicate_risk'

export type FlagSeverity = 'info' | 'warning' | 'critical'

export interface AnomalyFlag {
  flag_type:    FlagType
  severity:     FlagSeverity
  details:      Record<string, unknown>
  description:  string
}

export interface ListingInput {
  price?:             number | null
  area_m2?:           number | null
  zone_key?:          string | null
  type?:              string | null
  bedrooms?:          number | null
  avm_value_base?:    number | null
  opportunity_score?: number | null
  days_on_market?:    number | null
  address?:           string | null
  source_provider?:   string | null
}

export interface ZoneContext {
  zone_key:       string
  median_price:   number
  median_pm2:     number
  std_dev_price:  number
}

// ---------------------------------------------------------------------------
// PURE: Detect price anomaly vs zone context
// Flag if price is outside [median ± 3σ] or implausibly small/large
// ---------------------------------------------------------------------------

export function detectPriceAnomaly(
  price:      number,
  context:    ZoneContext,
  sigmaLimit  = 3,
): AnomalyFlag | null {
  if (price <= 0) {
    return {
      flag_type:   'price_anomaly',
      severity:    'critical',
      details:     { price, reason: 'non_positive' },
      description: `Price ${price} is non-positive — impossible value.`,
    }
  }

  const lower = context.median_price - sigmaLimit * context.std_dev_price
  const upper = context.median_price + sigmaLimit * context.std_dev_price

  if (price < lower || price > upper) {
    const deviations = Math.abs(price - context.median_price) / context.std_dev_price
    const severity: FlagSeverity = deviations > 5 ? 'critical' : 'warning'
    return {
      flag_type: 'price_anomaly',
      severity,
      details: {
        price,
        zone_median:      context.median_price,
        zone_std_dev:     context.std_dev_price,
        deviations:       parseFloat(deviations.toFixed(2)),
        expected_range:   [Math.round(lower), Math.round(upper)],
      },
      description:
        `Price €${price.toLocaleString('pt-PT')} deviates ${deviations.toFixed(1)}σ from ` +
        `${context.zone_key} median (€${context.median_price.toLocaleString('pt-PT')}).`,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// PURE: Detect impossible AVM ratio
// AVM / sale_price should be in [0.40, 2.50] — outside = data error
// ---------------------------------------------------------------------------

export function detectImpossibleAVM(
  avmValue:  number,
  price:     number,
  minRatio   = 0.40,
  maxRatio   = 2.50,
): AnomalyFlag | null {
  if (avmValue <= 0 || price <= 0) {
    return {
      flag_type:   'impossible_avm',
      severity:    'critical',
      details:     { avm_value: avmValue, price, reason: 'non_positive' },
      description: `AVM value (${avmValue}) or price (${price}) is non-positive.`,
    }
  }

  const ratio = avmValue / price

  if (ratio < minRatio || ratio > maxRatio) {
    const severity: FlagSeverity = ratio < 0.20 || ratio > 5.0 ? 'critical' : 'warning'
    return {
      flag_type: 'impossible_avm',
      severity,
      details: {
        avm_value: avmValue,
        price,
        ratio:         parseFloat(ratio.toFixed(4)),
        expected_range: [minRatio, maxRatio],
      },
      description:
        `AVM/price ratio ${ratio.toFixed(2)} is outside plausible range ` +
        `[${minRatio}, ${maxRatio}]. Possible data error.`,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// PURE: Detect statistical score outlier using Z-score
// ---------------------------------------------------------------------------

export function detectScoreOutlier(
  score:            number,
  populationMean:   number,
  populationStdDev: number,
  zScoreLimit       = 3.5,
): AnomalyFlag | null {
  if (populationStdDev <= 0) return null

  const zScore = Math.abs(score - populationMean) / populationStdDev

  if (zScore > zScoreLimit) {
    return {
      flag_type: 'score_outlier',
      severity:  zScore > 5 ? 'critical' : 'warning',
      details: {
        score,
        population_mean:    populationMean,
        population_std_dev: populationStdDev,
        z_score:            parseFloat(zScore.toFixed(2)),
        limit:              zScoreLimit,
      },
      description:
        `Score ${score} is ${zScore.toFixed(1)}σ from population mean ` +
        `(${populationMean.toFixed(1)} ± ${populationStdDev.toFixed(1)}).`,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// PURE: Detect malformed listing (required fields missing/invalid)
// ---------------------------------------------------------------------------

export function detectMalformedListing(listing: ListingInput): AnomalyFlag[] {
  const flags: AnomalyFlag[] = []
  const missing: string[]    = []

  if (!listing.price || listing.price <= 0)              missing.push('price')
  if (!listing.zone_key)                                 missing.push('zone_key')
  if (!listing.type)                                     missing.push('type')

  // Price-per-m2 sanity: if we have both price and area, check ratio
  if (listing.price && listing.area_m2) {
    const pm2 = listing.price / listing.area_m2
    if (pm2 < 100 || pm2 > 100_000) {
      flags.push({
        flag_type:   'malformed_listing',
        severity:    'warning',
        details:     { price: listing.price, area_m2: listing.area_m2, pm2: Math.round(pm2) },
        description: `Price/m² ${Math.round(pm2)} is implausible (expected 100–100,000 €/m²).`,
      })
    }
  }

  // Bedroom sanity
  if (listing.bedrooms != null && (listing.bedrooms < 0 || listing.bedrooms > 30)) {
    flags.push({
      flag_type:   'malformed_listing',
      severity:    'warning',
      details:     { bedrooms: listing.bedrooms },
      description: `Bedroom count ${listing.bedrooms} is outside plausible range (0–30).`,
    })
  }

  if (missing.length > 0) {
    flags.push({
      flag_type:   'malformed_listing',
      severity:    missing.includes('price') || missing.includes('zone_key') ? 'critical' : 'warning',
      details:     { missing_fields: missing },
      description: `Listing missing required fields: ${missing.join(', ')}.`,
    })
  }

  return flags
}

// ---------------------------------------------------------------------------
// PURE: Detect stale listing
// ---------------------------------------------------------------------------

export function detectStaleData(
  daysOnMarket: number,
  staleThreshold = 180,
): AnomalyFlag | null {
  if (daysOnMarket >= staleThreshold) {
    return {
      flag_type:   'stale_data',
      severity:    daysOnMarket >= 365 ? 'critical' : 'warning',
      details:     { days_on_market: daysOnMarket, threshold: staleThreshold },
      description: `Listing has been on market ${daysOnMarket} days (threshold: ${staleThreshold}d). May be stale.`,
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// PURE: Run all checks on a listing — returns all flags found
// ---------------------------------------------------------------------------

export function inspectListing(
  listing:  ListingInput,
  context?: ZoneContext,
  populationScoreStats?: { mean: number; stdDev: number },
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = []

  // Structural checks
  flags.push(...detectMalformedListing(listing))

  // Price anomaly (requires zone context)
  if (context && listing.price && listing.price > 0) {
    const priceFlag = detectPriceAnomaly(listing.price, context)
    if (priceFlag) flags.push(priceFlag)
  }

  // AVM plausibility
  if (listing.avm_value_base && listing.price && listing.price > 0) {
    const avmFlag = detectImpossibleAVM(listing.avm_value_base, listing.price)
    if (avmFlag) flags.push(avmFlag)
  }

  // Score outlier
  if (
    listing.opportunity_score != null &&
    populationScoreStats &&
    populationScoreStats.stdDev > 0
  ) {
    const scoreFlag = detectScoreOutlier(
      listing.opportunity_score,
      populationScoreStats.mean,
      populationScoreStats.stdDev,
    )
    if (scoreFlag) flags.push(scoreFlag)
  }

  // Stale data
  if (listing.days_on_market != null && listing.days_on_market > 0) {
    const staleFlag = detectStaleData(listing.days_on_market)
    if (staleFlag) flags.push(staleFlag)
  }

  return flags
}

// ---------------------------------------------------------------------------
// PURE: Get the highest severity from a list of flags
// ---------------------------------------------------------------------------

export function getMaxSeverity(flags: AnomalyFlag[]): FlagSeverity | null {
  if (flags.length === 0) return null
  if (flags.some(f => f.severity === 'critical')) return 'critical'
  if (flags.some(f => f.severity === 'warning'))  return 'warning'
  return 'info'
}
