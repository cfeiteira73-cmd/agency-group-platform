// =============================================================================
// Tests — lib/analytics/funnelMetrics.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  computeFunnelConversions,
  computeGradeConversions,
  summarizeNetworkHealth,
} from '../../../lib/analytics/funnelMetrics'
import type { FunnelCounts, NetworkStats } from '../../../lib/analytics/funnelMetrics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCounts(overrides: Partial<FunnelCounts> = {}): FunnelCounts {
  return {
    ingested:    1000,
    scored:       900,
    distributed:  800,
    opened:       400,
    replied:      200,
    meetings:     100,
    offers:        60,
    closed:        40,
    ...overrides,
  }
}

function makeNetworkStats(overrides: Partial<NetworkStats> = {}): NetworkStats {
  return {
    top_agents: [
      { agent_email: 'top@ag.com', zone: 'lisboa', close_rate_pct: 72, deals_won: 20, avg_deal_size: 800_000, tier: 'ELITE' },
      { agent_email: 'mid@ag.com', zone: 'porto',  close_rate_pct: 55, deals_won: 12, avg_deal_size: 600_000, tier: 'PRIORITY' },
    ],
    top_investors: [
      { investor_id: 'inv-001', engagement_score: 85, conversion_pct: 0.15, deals_total: 5, tier: 'ELITE' },
      { investor_id: 'inv-002', engagement_score: 60, conversion_pct: 0.08, deals_total: 3, tier: 'STANDARD' },
    ],
    underperformers: [
      { partner_email: 'low@ag.com', partner_type: 'agent', tier: 'WATCHLIST', tier_score: 30, reason: 'Low close rate' },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeFunnelConversions — stages
// ---------------------------------------------------------------------------

describe('computeFunnelConversions — stages', () => {
  it('returns 8 stages', () => {
    const report = computeFunnelConversions(makeCounts())
    expect(report.stages).toHaveLength(8)
  })

  it('first stage (Ingested) has null conversion_pct and null drop_pct', () => {
    const report = computeFunnelConversions(makeCounts())
    const first  = report.stages[0]
    expect(first.stage).toBe('Ingested')
    expect(first.conversion_pct).toBeNull()
    expect(first.drop_pct).toBeNull()
  })

  it('subsequent stages have numeric conversion_pct', () => {
    const report = computeFunnelConversions(makeCounts())
    report.stages.slice(1).forEach(s => {
      expect(s.conversion_pct).not.toBeNull()
    })
  })

  it('conversion_pct + drop_pct = 100 for every non-first stage', () => {
    const report = computeFunnelConversions(makeCounts())
    report.stages.slice(1).forEach(s => {
      if (s.conversion_pct != null && s.drop_pct != null) {
        expect(s.conversion_pct + s.drop_pct).toBeCloseTo(100, 1)
      }
    })
  })

  it('Scored stage: 900/1000 = 90%', () => {
    const report = computeFunnelConversions(makeCounts())
    const scored = report.stages.find(s => s.stage === 'Scored')!
    expect(scored.conversion_pct).toBe(90)
  })

  it('Distributed stage: 800/900 ≈ 88.9%', () => {
    const report = computeFunnelConversions(makeCounts())
    const dist   = report.stages.find(s => s.stage === 'Distributed')!
    expect(dist.conversion_pct).toBeCloseTo(88.9, 0)
  })

  it('stage counts match input', () => {
    const counts = makeCounts()
    const report = computeFunnelConversions(counts)
    expect(report.stages[0].count).toBe(counts.ingested)
    expect(report.stages[7].count).toBe(counts.closed)
  })
})

// ---------------------------------------------------------------------------
// computeFunnelConversions — overall_close_rate
// ---------------------------------------------------------------------------

describe('computeFunnelConversions — overall_close_rate', () => {
  it('closed / ingested × 100', () => {
    const report = computeFunnelConversions(makeCounts({ ingested: 1000, closed: 40 }))
    expect(report.overall_close_rate).toBe(4)
  })

  it('null when ingested = 0', () => {
    const report = computeFunnelConversions(makeCounts({ ingested: 0 }))
    expect(report.overall_close_rate).toBeNull()
  })

  it('100% close rate (all closed)', () => {
    const report = computeFunnelConversions(makeCounts({ ingested: 100, closed: 100 }))
    expect(report.overall_close_rate).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// computeFunnelConversions — top_drop_stage
// ---------------------------------------------------------------------------

describe('computeFunnelConversions — top_drop_stage', () => {
  it('identifies stage with biggest drop', () => {
    // Big drop from Distributed(800) → Opened(400): 50% drop
    const report = computeFunnelConversions(makeCounts({
      ingested:    1000,
      scored:       990,  // tiny drop
      distributed:  980,  // tiny drop
      opened:       100,  // massive 89.8% drop
      replied:       90,
      meetings:      80,
      offers:        70,
      closed:        60,
    }))
    expect(report.top_drop_stage).toBe('Opened')
  })

  it('returns null when ingested = 0 and all stages = 0', () => {
    // All zeros — conversion_pct will be null for stages after first (prev=0)
    const report = computeFunnelConversions(makeCounts({
      ingested: 0, scored: 0, distributed: 0, opened: 0,
      replied: 0, meetings: 0, offers: 0, closed: 0,
    }))
    // top_drop_stage will be null since all drop_pcts are null
    expect(report.top_drop_stage).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// computeFunnelConversions — edge cases
// ---------------------------------------------------------------------------

describe('computeFunnelConversions — edge cases', () => {
  it('handles all zeros gracefully', () => {
    const counts = makeCounts({ ingested: 0, scored: 0, distributed: 0, opened: 0, replied: 0, meetings: 0, offers: 0, closed: 0 })
    expect(() => computeFunnelConversions(counts)).not.toThrow()
  })

  it('handles perfect funnel (100% at every stage)', () => {
    const counts = makeCounts({ ingested: 100, scored: 100, distributed: 100, opened: 100, replied: 100, meetings: 100, offers: 100, closed: 100 })
    const report = computeFunnelConversions(counts)
    expect(report.overall_close_rate).toBe(100)
    report.stages.slice(1).forEach(s => expect(s.conversion_pct).toBe(100))
  })
})

// ---------------------------------------------------------------------------
// computeGradeConversions
// ---------------------------------------------------------------------------

describe('computeGradeConversions', () => {
  it('computes close_rate_pct correctly', () => {
    const rows = [
      { grade: 'A+', distributed: 100, closed: 30 },
      { grade: 'A',  distributed: 200, closed: 50 },
    ]
    const result = computeGradeConversions(rows)
    expect(result[0].close_rate_pct).toBe(30)
    expect(result[1].close_rate_pct).toBe(25)
  })

  it('null close_rate_pct when distributed = 0', () => {
    const result = computeGradeConversions([{ grade: 'B', distributed: 0, closed: 0 }])
    expect(result[0].close_rate_pct).toBeNull()
  })

  it('passes through avg_commission', () => {
    const result = computeGradeConversions([{ grade: 'A', distributed: 10, closed: 5, avg_commission: 25_000 }])
    expect(result[0].avg_commission).toBe(25_000)
  })

  it('null avg_commission when not provided', () => {
    const result = computeGradeConversions([{ grade: 'A', distributed: 10, closed: 5 }])
    expect(result[0].avg_commission).toBeNull()
  })

  it('returns empty array for empty input', () => {
    expect(computeGradeConversions([])).toEqual([])
  })

  it('preserves grade and count fields', () => {
    const result = computeGradeConversions([{ grade: 'B', distributed: 150, closed: 20 }])
    expect(result[0].grade).toBe('B')
    expect(result[0].distributed).toBe(150)
    expect(result[0].closed).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// summarizeNetworkHealth
// ---------------------------------------------------------------------------

describe('summarizeNetworkHealth', () => {
  it('counts ELITE agents correctly', () => {
    const summary = summarizeNetworkHealth(makeNetworkStats())
    expect(summary.elite_agent_count).toBe(1)
  })

  it('counts all ELITE agents when multiple', () => {
    const stats = makeNetworkStats({
      top_agents: [
        { agent_email: 'a@t.com', zone: 'x', close_rate_pct: 80, deals_won: 5, avg_deal_size: null, tier: 'ELITE' },
        { agent_email: 'b@t.com', zone: 'y', close_rate_pct: 85, deals_won: 8, avg_deal_size: null, tier: 'ELITE' },
        { agent_email: 'c@t.com', zone: 'z', close_rate_pct: 55, deals_won: 3, avg_deal_size: null, tier: 'STANDARD' },
      ],
    })
    expect(summarizeNetworkHealth(stats).elite_agent_count).toBe(2)
  })

  it('watchlist_count = number of underperformers', () => {
    const summary = summarizeNetworkHealth(makeNetworkStats())
    expect(summary.watchlist_count).toBe(1)
  })

  it('top_agent_close_rate = first agent close_rate_pct', () => {
    const summary = summarizeNetworkHealth(makeNetworkStats())
    expect(summary.top_agent_close_rate).toBe(72)
  })

  it('top_agent_close_rate null when no agents', () => {
    const stats   = makeNetworkStats({ top_agents: [] })
    const summary = summarizeNetworkHealth(stats)
    expect(summary.top_agent_close_rate).toBeNull()
  })

  it('avg_engagement_score is mean of investor engagement scores', () => {
    const summary = summarizeNetworkHealth(makeNetworkStats())
    // (85 + 60) / 2 = 72.5
    expect(summary.avg_engagement_score).toBe(72.5)
  })

  it('avg_engagement_score null when no investors', () => {
    const stats   = makeNetworkStats({ top_investors: [] })
    const summary = summarizeNetworkHealth(stats)
    expect(summary.avg_engagement_score).toBeNull()
  })

  it('all zeros case', () => {
    const stats = makeNetworkStats({ top_agents: [], top_investors: [], underperformers: [] })
    const summary = summarizeNetworkHealth(stats)
    expect(summary.elite_agent_count).toBe(0)
    expect(summary.watchlist_count).toBe(0)
    expect(summary.top_agent_close_rate).toBeNull()
    expect(summary.avg_engagement_score).toBeNull()
  })
})
