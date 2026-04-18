// =============================================================================
// AGENCY GROUP — Pricing Optimisation Signal Engine — Vitest Tests
// Module: __tests__/lib/intelligence/pricing.test.ts
// =============================================================================

import { describe, it, expect } from 'vitest'
import { computePricingInsight, computeAllPricingInsights } from '../../../app/portal/lib/intelligence/pricing'
import type { Deal } from '../../../app/portal/components/types'
import type { DealScoreResult } from '../../../app/portal/lib/dealScoring'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeDeal(overrides: Partial<Deal> & { createdAt?: string } = {}): Deal & { createdAt?: string } {
  return {
    id: 1,
    ref: 'AG-001',
    imovel: 'Apto Lisboa',
    valor: '€200.000',
    fase: 'Contacto',
    comprador: 'João Silva',
    cpcvDate: '',
    escrituraDate: '',
    checklist: {},
    notas: '',
    ...overrides,
  }
}

function makeScoring(overrides: Partial<DealScoreResult> = {}): DealScoreResult {
  return {
    dealScore: 60,
    dealHealth: 'MODERADO',
    dealHealthLabel: 'Moderado',
    closureProbabilityBand: 'MEDIA',
    closurePct: 55,
    reasons: ['Test reason'],
    dealRiskFlags: [],
    dealAccelerationActions: [],
    confidence: 'medium',
    ...overrides,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('computePricingInsight', () => {

  // ── Test 1: NEUTRAL when no signals ──────────────────────────────────────────
  it('returns NEUTRAL when no overpriced or demand signals exist', () => {
    // Early stage (Contacto — not late), low value, no age, no flags, low score
    const deal = makeDeal({ fase: 'Contacto', valor: '€150.000' })
    const scoring = makeScoring({ closurePct: 40, dealScore: 30, dealRiskFlags: [] })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('NEUTRAL')
  })

  // ── Test 2: NEUTRAL is default with missing data ──────────────────────────────
  it('defaults to NEUTRAL when deal has no createdAt and minimal data', () => {
    const deal = makeDeal()  // no createdAt, empty checklist, early stage
    const scoring = makeScoring({ closurePct: 30, dealScore: 25, dealRiskFlags: [] })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('NEUTRAL')
  })

  // ── Test 3: POSSIBLY_OVERPRICED with 2+ signals ───────────────────────────────
  it('returns POSSIBLY_OVERPRICED when old deal + STALLED_NO_ACTIVITY_SIGNAL flag', () => {
    // Contacto benchmark = 14d; age = 35d → 35/14 ≈ 2.5 → >2× → signal 1
    // STALLED_NO_ACTIVITY_SIGNAL → signal 3 (signals 1+3 = 2 total → POSSIBLY_OVERPRICED)
    const deal = makeDeal({ fase: 'Contacto', createdAt: daysAgo(35) })
    const scoring = makeScoring({
      dealRiskFlags: [
        { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
      ],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('POSSIBLY_OVERPRICED')
  })

  // ── Test 4: POSSIBLY_OVERPRICED confidence medium at exactly 2 signals ────────
  it('sets confidence to medium when exactly 2 overpriced signals are present', () => {
    const deal = makeDeal({ fase: 'Contacto', createdAt: daysAgo(35) })
    const scoring = makeScoring({
      dealRiskFlags: [
        { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
      ],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('POSSIBLY_OVERPRICED')
    expect(result.confidence).toBe('medium')
  })

  // ── Test 5: POSSIBLY_OVERPRICED confidence high at 3+ signals ────────────────
  it('sets confidence to high when 3 or more overpriced signals are present', () => {
    // Signal 1: old deal age >2× benchmark (Contacto 14d → age 35d)
    // Signal 2: STALLED_NO_ACTIVITY_SIGNAL
    // Signal 3: dealScore < 35 AND valor >= €500K
    const deal = makeDeal({
      fase: 'Contacto',
      createdAt: daysAgo(35),
      valor: '€600.000',
    })
    const scoring = makeScoring({
      dealScore: 30,
      dealRiskFlags: [
        { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
      ],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('POSSIBLY_OVERPRICED')
    expect(result.confidence).toBe('high')
  })

  // ── Test 6: STRONG_DEMAND with 2+ signals ─────────────────────────────────────
  it('returns STRONG_DEMAND when closurePct >=75, no HIGH risk, and dealScore >=70', () => {
    // Demand signal 1: closurePct >= 75 + no HIGH risk flags
    // Demand signal 4: dealScore >= 70
    const deal = makeDeal({ fase: 'Negociação' })
    const scoring = makeScoring({
      closurePct: 80,
      dealScore: 75,
      dealRiskFlags: [],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('STRONG_DEMAND')
  })

  // ── Test 7: WATCH with exactly 1 overpriced signal ────────────────────────────
  it('returns WATCH when only 1 overpriced signal is present', () => {
    // Signal 1 only: old deal age >2× benchmark (Contacto 14d → age 35d)
    // No other signals
    const deal = makeDeal({ fase: 'Contacto', createdAt: daysAgo(35) })
    const scoring = makeScoring({
      closurePct: 40,
      dealScore: 40,
      dealRiskFlags: [],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('WATCH')
  })

  // ── Test 8: WATCH has confidence 'low' ───────────────────────────────────────
  it('sets confidence to low for WATCH signal', () => {
    const deal = makeDeal({ fase: 'Contacto', createdAt: daysAgo(35) })
    const scoring = makeScoring({
      closurePct: 40,
      dealScore: 40,
      dealRiskFlags: [],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('WATCH')
    expect(result.confidence).toBe('low')
  })

  // ── Test 9: Late stage + checklist <30% counts as overpriced signal ───────────
  it('counts low checklist completion in late stage as an overpriced signal', () => {
    // Signal from checklist: late stage (Negociação) + checklist 20% (< 30%)
    // Signal from STALLED: ensures we get to POSSIBLY_OVERPRICED
    const deal = makeDeal({
      fase: 'Negociação',
      checklist: {
        docs: [true, false, false, false, false],  // 1/5 = 20%
      },
    })
    const scoring = makeScoring({
      dealRiskFlags: [
        { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
      ],
    })
    const result = computePricingInsight(deal, scoring)
    // At least 2 signals → POSSIBLY_OVERPRICED
    expect(result.signal).toBe('POSSIBLY_OVERPRICED')
    expect(result.reasoning.some(r => r.includes('Checklist'))).toBe(true)
  })

  // ── Test 10: Early stage + checklist <30% does NOT trigger overpriced signal ──
  it('does NOT count low checklist completion as overpriced signal in early stage', () => {
    // Contacto is NOT in LATE_STAGES → checklist signal should not fire
    const deal = makeDeal({
      fase: 'Contacto',
      checklist: {
        docs: [true, false, false, false, false],  // 1/5 = 20%
      },
    })
    const scoring = makeScoring({
      closurePct: 40,
      dealScore: 40,
      dealRiskFlags: [],
    })
    const result = computePricingInsight(deal, scoring)
    // Only 0 overpriced signals → NEUTRAL (not WATCH or POSSIBLY_OVERPRICED)
    expect(result.signal).toBe('NEUTRAL')
    expect(result.reasoning.every(r => !r.includes('Checklist'))).toBe(true)
  })

  // ── Test 11: dealScore < 35 AND valor >= €500K counts as overpriced signal ────
  it('counts low score on high-value deal as overpriced signal', () => {
    // Signal: dealScore < 35 AND valor >= €500K → 1 signal → WATCH
    const deal = makeDeal({ fase: 'Contacto', valor: '€750.000' })
    const scoring = makeScoring({
      dealScore: 30,
      closurePct: 40,
      dealRiskFlags: [],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('WATCH')
    expect(result.reasoning.some(r => r.includes('Score CRÍTICO'))).toBe(true)
  })

  // ── Test 15: STRONG_DEMAND suggestedAction is 'HOLD' ─────────────────────────
  it('sets suggestedAction to HOLD for STRONG_DEMAND signal', () => {
    const deal = makeDeal({ fase: 'Negociação' })
    const scoring = makeScoring({
      closurePct: 80,
      dealScore: 75,
      dealRiskFlags: [],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('STRONG_DEMAND')
    expect(result.suggestedAction).toBe('HOLD')
  })

  // ── Test 16: POSSIBLY_OVERPRICED suggestedAction is 'REVIEW_PRICE' ────────────
  it('sets suggestedAction to REVIEW_PRICE for POSSIBLY_OVERPRICED signal', () => {
    const deal = makeDeal({ fase: 'Contacto', createdAt: daysAgo(35) })
    const scoring = makeScoring({
      dealRiskFlags: [
        { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
      ],
    })
    const result = computePricingInsight(deal, scoring)
    expect(result.signal).toBe('POSSIBLY_OVERPRICED')
    expect(result.suggestedAction).toBe('REVIEW_PRICE')
  })

})

describe('computeAllPricingInsights', () => {

  // ── Test 12: Escritura Concluída is excluded ───────────────────────────────────
  it('excludes deals in Escritura Concluída phase', () => {
    const scoredDeals = [
      {
        deal: makeDeal({ ref: 'AG-CLOSED', fase: 'Escritura Concluída', createdAt: daysAgo(35) }),
        scoring: makeScoring({
          dealRiskFlags: [
            { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
          ],
        }),
      },
    ]
    const results = computeAllPricingInsights(scoredDeals)
    expect(results.find(r => r.dealRef === 'AG-CLOSED')).toBeUndefined()
    expect(results.length).toBe(0)
  })

  // ── Test 13: NEUTRAL is excluded from output ──────────────────────────────────
  it('excludes deals with NEUTRAL signal from results', () => {
    const scoredDeals = [
      {
        deal: makeDeal({ ref: 'AG-NEUTRAL', fase: 'Contacto', valor: '€150.000' }),
        scoring: makeScoring({ closurePct: 40, dealScore: 30, dealRiskFlags: [] }),
      },
    ]
    const results = computeAllPricingInsights(scoredDeals)
    expect(results.find(r => r.dealRef === 'AG-NEUTRAL')).toBeUndefined()
    expect(results.length).toBe(0)
  })

  // ── Test 14: computeAllPricingInsights sorts POSSIBLY_OVERPRICED before WATCH ──
  it('sorts POSSIBLY_OVERPRICED before WATCH in output', () => {
    const scoredDeals = [
      // WATCH deal: 1 overpriced signal (old deal only)
      {
        deal: makeDeal({ ref: 'AG-WATCH', fase: 'Contacto', createdAt: daysAgo(35) }),
        scoring: makeScoring({
          closurePct: 40,
          dealScore: 40,
          dealRiskFlags: [],
        }),
      },
      // POSSIBLY_OVERPRICED deal: 2 signals
      {
        deal: makeDeal({ ref: 'AG-OVER', fase: 'Contacto', createdAt: daysAgo(35) }),
        scoring: makeScoring({
          dealRiskFlags: [
            { code: 'STALLED_NO_ACTIVITY_SIGNAL', label: 'test', severity: 'medium' },
          ],
        }),
      },
    ]

    const results = computeAllPricingInsights(scoredDeals)

    expect(results.length).toBeGreaterThanOrEqual(2)
    const firstSignal  = results[0].insight.signal
    const secondSignal = results[1].insight.signal

    expect(firstSignal).toBe('POSSIBLY_OVERPRICED')
    expect(secondSignal).toBe('WATCH')
  })

})
