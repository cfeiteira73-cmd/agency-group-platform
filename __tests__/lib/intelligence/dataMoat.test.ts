// =============================================================================
// Tests — lib/intelligence/dataMoat.ts  (pure functions only)
// =============================================================================

import { describe, it, expect } from 'vitest'

import {
  computeDataUniquenessScore,
  computeNetworkEffectValue,
  computeDataDepthScore,
  computeTemporalScore,
  computeMoatScore,
  classifyMoatStrength,
  computeMarginalValue,
  estimateDefensibilityHorizon,
  buildMoatReport,
} from '../../../lib/intelligence/dataMoat'
import type { DataAsset, NetworkState } from '../../../lib/intelligence/dataMoat'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<DataAsset> = {}): DataAsset {
  return {
    total_records:       10_000,
    records_last_90d:    3_000,
    exclusive_records:   6_000,
    outcome_records:     500,
    behavioral_signals:  15_000,
    months_accumulating: 18,
    ...overrides,
  }
}

function makeNetwork(overrides: Partial<NetworkState> = {}): NetworkState {
  return {
    active_agents:      50,
    active_investors:   200,
    total_transactions: 300,
    zones_covered:      8,
    asset_classes:      4,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeDataUniquenessScore
// ---------------------------------------------------------------------------

describe('computeDataUniquenessScore', () => {
  it('0 records → 0', () => {
    expect(computeDataUniquenessScore({ total_records: 0, records_last_90d: 0, exclusive_records: 0, outcome_records: 0, behavioral_signals: 0, months_accumulating: 0 })).toBe(0)
  })

  it('more exclusive records → higher score', () => {
    const low  = computeDataUniquenessScore(makeAsset({ exclusive_records: 100 }))
    const high = computeDataUniquenessScore(makeAsset({ exclusive_records: 8_000 }))
    expect(high).toBeGreaterThan(low)
  })

  it('more recent records → higher score', () => {
    const stale  = computeDataUniquenessScore(makeAsset({ records_last_90d: 100 }))
    const recent = computeDataUniquenessScore(makeAsset({ records_last_90d: 9_000 }))
    expect(recent).toBeGreaterThan(stale)
  })

  it('score is 0-100', () => {
    expect(computeDataUniquenessScore(makeAsset())).toBeGreaterThanOrEqual(0)
    expect(computeDataUniquenessScore(makeAsset())).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// computeNetworkEffectValue
// ---------------------------------------------------------------------------

describe('computeNetworkEffectValue', () => {
  it('0 agents/investors → low score', () => {
    expect(computeNetworkEffectValue(0, 0, 0)).toBe(0)
  })

  it('more agents → higher value', () => {
    const low  = computeNetworkEffectValue(10, 50, 100)
    const high = computeNetworkEffectValue(100, 50, 100)
    expect(high).toBeGreaterThan(low)
  })

  it('more investors → higher value', () => {
    const low  = computeNetworkEffectValue(50, 50, 100)
    const high = computeNetworkEffectValue(50, 500, 100)
    expect(high).toBeGreaterThan(low)
  })

  it('score is 0-100', () => {
    expect(computeNetworkEffectValue(1000, 5000, 50000)).toBeLessThanOrEqual(100)
    expect(computeNetworkEffectValue(0, 0, 0)).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// computeDataDepthScore
// ---------------------------------------------------------------------------

describe('computeDataDepthScore', () => {
  it('0 records → 0', () => {
    expect(computeDataDepthScore({ total_records: 0, records_last_90d: 0, exclusive_records: 0, outcome_records: 0, behavioral_signals: 0, months_accumulating: 0 })).toBe(0)
  })

  it('more outcomes → higher score', () => {
    const low  = computeDataDepthScore(makeAsset({ outcome_records: 10 }))
    const high = computeDataDepthScore(makeAsset({ outcome_records: 1_000 }))
    expect(high).toBeGreaterThan(low)
  })

  it('more behavioral signals → higher score', () => {
    const low  = computeDataDepthScore(makeAsset({ behavioral_signals: 100 }))
    const high = computeDataDepthScore(makeAsset({ behavioral_signals: 100_000 }))
    expect(high).toBeGreaterThan(low)
  })

  it('score is 0-100', () => {
    expect(computeDataDepthScore(makeAsset())).toBeGreaterThanOrEqual(0)
    expect(computeDataDepthScore(makeAsset())).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// computeTemporalScore
// ---------------------------------------------------------------------------

describe('computeTemporalScore', () => {
  it('≤1 month → 5', ()    => expect(computeTemporalScore(1)).toBe(5))
  it('6 months → 30', ()   => expect(computeTemporalScore(6)).toBe(30))
  it('12 months → 50', ()  => expect(computeTemporalScore(12)).toBe(50))
  it('24 months → 70', ()  => expect(computeTemporalScore(24)).toBe(70))
  it('36+ months → 85', () => expect(computeTemporalScore(36)).toBe(85))
  it('monotonically increasing', () => {
    expect(computeTemporalScore(3)).toBeLessThan(computeTemporalScore(12))
    expect(computeTemporalScore(12)).toBeLessThan(computeTemporalScore(36))
  })
})

// ---------------------------------------------------------------------------
// computeMoatScore
// ---------------------------------------------------------------------------

describe('computeMoatScore', () => {
  it('all high scores → high composite', () => {
    const score = computeMoatScore(90, 85, 88, 80)
    expect(score).toBeGreaterThan(70)
  })

  it('all zero → 0', () => {
    expect(computeMoatScore(0, 0, 0, 0)).toBe(0)
  })

  it('weighted correctly (depth 30%, network 25%, uniqueness 30%, temporal 15%)', () => {
    // depth = 100, others = 0 → should be 30
    expect(computeMoatScore(0, 0, 100, 0)).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// classifyMoatStrength
// ---------------------------------------------------------------------------

describe('classifyMoatStrength', () => {
  it('≥80 → dominant', () => expect(classifyMoatStrength(85)).toBe('dominant'))
  it('65-79 → strong',  () => expect(classifyMoatStrength(70)).toBe('strong'))
  it('45-64 → building',() => expect(classifyMoatStrength(55)).toBe('building'))
  it('25-44 → early',   () => expect(classifyMoatStrength(30)).toBe('early'))
  it('<25 → minimal',   () => expect(classifyMoatStrength(10)).toBe('minimal'))
})

// ---------------------------------------------------------------------------
// computeMarginalValue
// ---------------------------------------------------------------------------

describe('computeMarginalValue', () => {
  it('adding an investor increases value', () => {
    const before = makeNetwork({ active_investors: 100 })
    const after  = makeNetwork({ active_investors: 101 })
    const r      = computeMarginalValue(before, after)
    expect(r.after_value).toBeGreaterThanOrEqual(r.before_value)
    expect(r.driver).toBe('new_investor')
  })

  it('adding an agent increases value', () => {
    const before = makeNetwork({ active_agents: 50 })
    const after  = makeNetwork({ active_agents: 51 })
    const r      = computeMarginalValue(before, after)
    expect(r.driver).toBe('new_agent')
  })

  it('no change → marginal_value = 0', () => {
    const r = computeMarginalValue(makeNetwork(), makeNetwork())
    expect(r.marginal_value).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// estimateDefensibilityHorizon
// ---------------------------------------------------------------------------

describe('estimateDefensibilityHorizon', () => {
  it('returns a positive number', () => {
    const h = estimateDefensibilityHorizon(makeAsset(), makeNetwork())
    expect(h).toBeGreaterThanOrEqual(0)
  })

  it('more outcomes → longer horizon', () => {
    const small = estimateDefensibilityHorizon(makeAsset({ outcome_records: 10 }), makeNetwork())
    const large = estimateDefensibilityHorizon(makeAsset({ outcome_records: 1_000 }), makeNetwork())
    expect(large).toBeGreaterThan(small)
  })
})

// ---------------------------------------------------------------------------
// buildMoatReport
// ---------------------------------------------------------------------------

describe('buildMoatReport', () => {
  it('returns all required fields', () => {
    const r = buildMoatReport(makeAsset(), makeNetwork())
    expect(r.uniqueness_score).toBeDefined()
    expect(r.network_effect_score).toBeDefined()
    expect(r.depth_score).toBeDefined()
    expect(r.temporal_score).toBeDefined()
    expect(r.moat_score).toBeDefined()
    expect(r.moat_strength).toBeDefined()
    expect(r.defensibility_horizon_months).toBeDefined()
    expect(r.key_advantages.length + r.key_gaps.length).toBeGreaterThan(0)
  })

  it('mature platform → dominant/strong moat', () => {
    const asset   = makeAsset({ months_accumulating: 36, outcome_records: 2000, exclusive_records: 9000, behavioral_signals: 100_000 })
    const network = makeNetwork({ active_agents: 200, active_investors: 1000, total_transactions: 2000 })
    const r       = buildMoatReport(asset, network)
    expect(['dominant', 'strong']).toContain(r.moat_strength)
  })

  it('early platform → early/minimal moat', () => {
    const asset   = makeAsset({ months_accumulating: 2, outcome_records: 5, exclusive_records: 10, behavioral_signals: 50, total_records: 50 })
    const network = makeNetwork({ active_agents: 3, active_investors: 5, total_transactions: 2 })
    const r       = buildMoatReport(asset, network)
    expect(['minimal', 'early']).toContain(r.moat_strength)
  })
})
