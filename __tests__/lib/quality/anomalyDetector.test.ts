// =============================================================================
// Tests — lib/quality/anomalyDetector.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  detectPriceAnomaly,
  detectImpossibleAVM,
  detectScoreOutlier,
  detectMalformedListing,
  detectStaleData,
  inspectListing,
  getMaxSeverity,
} from '../../../lib/quality/anomalyDetector'
import type { ZoneContext, ListingInput } from '../../../lib/quality/anomalyDetector'

const lisboaContext: ZoneContext = {
  zone_key:      'lisboa-centro',
  median_price:  600_000,
  median_pm2:    5_000,
  std_dev_price: 100_000,
}

// ---------------------------------------------------------------------------
// detectPriceAnomaly
// ---------------------------------------------------------------------------

describe('detectPriceAnomaly', () => {
  it('returns null for price within 3σ', () => {
    const flag = detectPriceAnomaly(620_000, lisboaContext)
    expect(flag).toBeNull()
  })

  it('returns warning for price outside 3σ but within 5σ', () => {
    const price = lisboaContext.median_price + 3.5 * lisboaContext.std_dev_price
    const flag  = detectPriceAnomaly(price, lisboaContext)
    expect(flag).not.toBeNull()
    expect(flag!.flag_type).toBe('price_anomaly')
    expect(flag!.severity).toBe('warning')
  })

  it('returns critical for price outside 5σ', () => {
    const price = lisboaContext.median_price + 6 * lisboaContext.std_dev_price
    const flag  = detectPriceAnomaly(price, lisboaContext)
    expect(flag).not.toBeNull()
    expect(flag!.severity).toBe('critical')
  })

  it('returns critical for non-positive price', () => {
    const flag = detectPriceAnomaly(0, lisboaContext)
    expect(flag).not.toBeNull()
    expect(flag!.severity).toBe('critical')
    expect(flag!.details.reason).toBe('non_positive')
  })

  it('negative price also triggers critical', () => {
    const flag = detectPriceAnomaly(-100, lisboaContext)
    expect(flag!.severity).toBe('critical')
  })

  it('includes deviations in details', () => {
    const price = lisboaContext.median_price + 4 * lisboaContext.std_dev_price
    const flag  = detectPriceAnomaly(price, lisboaContext)
    expect(flag!.details).toHaveProperty('deviations')
    expect(flag!.details.deviations).toBeGreaterThan(3)
  })

  it('includes expected range in details', () => {
    const price = lisboaContext.median_price - 4 * lisboaContext.std_dev_price
    const flag  = detectPriceAnomaly(price, lisboaContext)
    expect(flag!.details.expected_range).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// detectImpossibleAVM
// ---------------------------------------------------------------------------

describe('detectImpossibleAVM', () => {
  it('returns null for ratio within [0.40, 2.50]', () => {
    expect(detectImpossibleAVM(500_000, 550_000)).toBeNull()
    expect(detectImpossibleAVM(400_000, 400_000)).toBeNull()
    expect(detectImpossibleAVM(800_000, 500_000)).toBeNull()
  })

  it('returns warning for ratio just below min', () => {
    // ratio = 180,000 / 500,000 = 0.36 — below 0.40 but above 0.20
    const flag = detectImpossibleAVM(180_000, 500_000)
    expect(flag).not.toBeNull()
    expect(flag!.flag_type).toBe('impossible_avm')
    expect(flag!.severity).toBe('warning')
  })

  it('returns critical for extreme ratio', () => {
    // ratio = 50,000 / 500,000 = 0.10 — below 0.20
    const flag = detectImpossibleAVM(50_000, 500_000)
    expect(flag).not.toBeNull()
    expect(flag!.severity).toBe('critical')
  })

  it('returns critical for non-positive AVM', () => {
    const flag = detectImpossibleAVM(0, 500_000)
    expect(flag!.details.reason).toBe('non_positive')
  })

  it('returns critical for non-positive price', () => {
    const flag = detectImpossibleAVM(400_000, 0)
    expect(flag!.details.reason).toBe('non_positive')
  })

  it('ratio is included in details', () => {
    const flag = detectImpossibleAVM(100_000, 500_000)  // ratio = 0.20
    expect(flag!.details.ratio).toBeCloseTo(0.20, 2)
  })
})

// ---------------------------------------------------------------------------
// detectScoreOutlier
// ---------------------------------------------------------------------------

describe('detectScoreOutlier', () => {
  it('returns null when score within z-score limit', () => {
    expect(detectScoreOutlier(72, 65, 10, 3.5)).toBeNull()
  })

  it('returns warning for z-score > 3.5 but ≤ 5', () => {
    const flag = detectScoreOutlier(115, 65, 10, 3.5)  // z = 5.0
    // z=5 triggers critical
    expect(flag).not.toBeNull()
    expect(flag!.flag_type).toBe('score_outlier')
  })

  it('returns critical for z-score > 5', () => {
    const flag = detectScoreOutlier(120, 65, 10, 3.5)  // z = 5.5
    expect(flag!.severity).toBe('critical')
  })

  it('returns null for zero std dev', () => {
    expect(detectScoreOutlier(90, 65, 0)).toBeNull()
  })

  it('includes z_score in details', () => {
    const flag = detectScoreOutlier(110, 65, 10, 3.5)
    expect(flag!.details.z_score).toBeDefined()
    expect(Number(flag!.details.z_score)).toBeCloseTo(4.5, 1)
  })

  it('returns null for score equal to mean', () => {
    expect(detectScoreOutlier(65, 65, 10, 3.5)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// detectMalformedListing
// ---------------------------------------------------------------------------

describe('detectMalformedListing', () => {
  it('returns empty array for valid listing', () => {
    const listing: ListingInput = { price: 500_000, zone_key: 'lisboa-centro', type: 'apartment', area_m2: 100 }
    expect(detectMalformedListing(listing)).toHaveLength(0)
  })

  it('flags missing price as critical', () => {
    const flags = detectMalformedListing({ zone_key: 'lisboa', type: 'apartment' })
    const critFlag = flags.find(f => f.details.missing_fields)
    expect(critFlag).toBeDefined()
    expect(critFlag!.severity).toBe('critical')
  })

  it('flags missing zone_key as critical', () => {
    const flags = detectMalformedListing({ price: 500_000, type: 'apartment' })
    const critFlag = flags.find(f => f.severity === 'critical')
    expect(critFlag).toBeDefined()
  })

  it('flags implausible price/m² as warning', () => {
    const flags = detectMalformedListing({ price: 1_000, area_m2: 100, zone_key: 'x', type: 'y' })
    // pm2 = 10 → below 100
    const warning = flags.find(f => f.flag_type === 'malformed_listing' && f.details.pm2 != null)
    expect(warning).toBeDefined()
    expect(warning!.severity).toBe('warning')
  })

  it('flags bedroom count > 30', () => {
    const flags = detectMalformedListing({ price: 500_000, zone_key: 'x', type: 'y', bedrooms: 35 })
    const bedroomFlag = flags.find(f => String(f.description).includes('Bedroom'))
    expect(bedroomFlag).toBeDefined()
  })

  it('allows bedrooms = 0', () => {
    const listing: ListingInput = { price: 500_000, zone_key: 'x', type: 'studio', bedrooms: 0 }
    const flags = detectMalformedListing(listing)
    const bedroomFlag = flags.find(f => String(f.description).includes('Bedroom'))
    expect(bedroomFlag).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// detectStaleData
// ---------------------------------------------------------------------------

describe('detectStaleData', () => {
  it('returns null under threshold', () => {
    expect(detectStaleData(179)).toBeNull()
    expect(detectStaleData(0)).toBeNull()
  })

  it('returns warning at threshold (180d)', () => {
    const flag = detectStaleData(180)
    expect(flag).not.toBeNull()
    expect(flag!.flag_type).toBe('stale_data')
    expect(flag!.severity).toBe('warning')
  })

  it('returns critical at 365+ days', () => {
    const flag = detectStaleData(365)
    expect(flag!.severity).toBe('critical')
  })

  it('custom threshold works', () => {
    expect(detectStaleData(90, 90)).not.toBeNull()
    expect(detectStaleData(89, 90)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// inspectListing (combined checks)
// ---------------------------------------------------------------------------

describe('inspectListing', () => {
  it('returns empty array for clean listing', () => {
    const listing: ListingInput = {
      price:             500_000,
      area_m2:           100,
      zone_key:          'lisboa-centro',
      type:              'apartment',
      bedrooms:          3,
      avm_value_base:    480_000,
      opportunity_score: 72,
      days_on_market:    45,
    }
    const flags = inspectListing(listing, lisboaContext, { mean: 65, stdDev: 15 })
    expect(flags).toHaveLength(0)
  })

  it('detects stale listing without zone context', () => {
    const listing: ListingInput = {
      price:          500_000,
      zone_key:       'x',
      type:           'y',
      days_on_market: 200,
    }
    const flags = inspectListing(listing)
    const staleFlag = flags.find(f => f.flag_type === 'stale_data')
    expect(staleFlag).toBeDefined()
  })

  it('detects malformed listing in combined inspection', () => {
    const listing: ListingInput = { type: 'apartment' }  // missing price and zone
    const flags = inspectListing(listing)
    expect(flags.length).toBeGreaterThan(0)
    expect(flags.some(f => f.flag_type === 'malformed_listing')).toBe(true)
  })

  it('detects price anomaly when context provided', () => {
    const listing: ListingInput = {
      price:    1_500_000,  // way above 3σ
      zone_key: 'lisboa-centro',
      type:     'apartment',
    }
    const flags = inspectListing(listing, lisboaContext)
    expect(flags.some(f => f.flag_type === 'price_anomaly')).toBe(true)
  })

  it('multiple flags can be returned for same listing', () => {
    const listing: ListingInput = {
      price:          2_000_000,   // price anomaly
      zone_key:       'lisboa-centro',
      type:           'apartment',
      days_on_market: 400,          // stale
    }
    const flags = inspectListing(listing, lisboaContext)
    expect(flags.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// getMaxSeverity
// ---------------------------------------------------------------------------

describe('getMaxSeverity', () => {
  it('returns null for empty array', () => {
    expect(getMaxSeverity([])).toBeNull()
  })

  it('returns critical if any flag is critical', () => {
    const flags = [
      { flag_type: 'stale_data' as const, severity: 'warning' as const, details: {}, description: '' },
      { flag_type: 'price_anomaly' as const, severity: 'critical' as const, details: {}, description: '' },
    ]
    expect(getMaxSeverity(flags)).toBe('critical')
  })

  it('returns warning if highest is warning', () => {
    const flags = [
      { flag_type: 'stale_data' as const, severity: 'info' as const, details: {}, description: '' },
      { flag_type: 'stale_data' as const, severity: 'warning' as const, details: {}, description: '' },
    ]
    expect(getMaxSeverity(flags)).toBe('warning')
  })

  it('returns info if all flags are info', () => {
    const flags = [
      { flag_type: 'stale_data' as const, severity: 'info' as const, details: {}, description: '' },
    ]
    expect(getMaxSeverity(flags)).toBe('info')
  })
})
