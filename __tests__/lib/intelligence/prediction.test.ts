// =============================================================================
// AGENCY GROUP — Deal Closure Prediction Engine — Vitest Tests
// Module: __tests__/lib/intelligence/prediction.test.ts
// =============================================================================

import { describe, it, expect } from 'vitest'
import { predictDealClosure, predictAllDeals } from '../../../app/portal/lib/intelligence/prediction'
import type { Deal } from '../../../app/portal/components/types'
import type { DealScoreResult } from '../../../app/portal/lib/dealScoring'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeDeal(overrides: Partial<Deal> & { createdAt?: string } = {}): Deal & { createdAt?: string } {
  return {
    id: 1,
    ref: 'AG-001',
    imovel: 'Apto Lisboa',
    valor: '€500.000',
    fase: 'Negociação',
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

describe('predictDealClosure', () => {

  // ── Test 1: Escritura Concluída fast path ───────────────────────────────────
  it('returns 100 / 7d / high / concluída for Escritura Concluída', () => {
    const deal = makeDeal({ fase: 'Escritura Concluída' })
    const scoring = makeScoring()
    const result = predictDealClosure(deal, scoring)

    expect(result.closureProbability).toBe(100)
    expect(result.estimatedCloseWindow).toBe('7d')
    expect(result.predictionConfidence).toBe('high')
    expect(result.explanation.some(e => e.toLowerCase().includes('concluída'))).toBe(true)
  })

  // ── Test 2: Base closurePct appears in explanation[0] ──────────────────────
  it('prepends Base closurePct to explanation', () => {
    const deal = makeDeal()
    const scoring = makeScoring({ closurePct: 55 })
    const result = predictDealClosure(deal, scoring)

    expect(result.explanation[0]).toContain('Base closurePct')
    expect(result.explanation[0]).toContain('55')
  })

  // ── Test 3: HIGH risk flags degrade probability ─────────────────────────────
  it('reduces closureProbability by 14pts for 2 HIGH risk flags', () => {
    const base = 55
    const deal = makeDeal()
    const scoring = makeScoring({
      closurePct: base,
      dealRiskFlags: [
        { code: 'NO_CPCV_DATE_IN_LATE_STAGE', label: 'flag1', severity: 'high' },
        { code: 'NO_ESCRITURA_DATE_IN_LATE_STAGE', label: 'flag2', severity: 'high' },
      ],
    })
    const result = predictDealClosure(deal, scoring)
    // 2 HIGH flags = -14pts; no other signals except flag signal
    // No dates → no date signal; no createdAt → no velocity signal
    // probability = 55 - 14 = 41, clamped [1,99]
    expect(result.closureProbability).toBeLessThan(base)
    // Penalty is exactly 14 (ignoring clamp)
    expect(base - result.closureProbability).toBe(14)
  })

  // ── Test 4: MEDIUM risk flags degrade probability ───────────────────────────
  it('reduces closureProbability by 6pts for 2 MEDIUM risk flags', () => {
    const base = 55
    const deal = makeDeal()
    const scoring = makeScoring({
      closurePct: base,
      dealRiskFlags: [
        { code: 'NO_BUYER_NAME', label: 'flag1', severity: 'medium' },
        { code: 'NO_NOTES', label: 'flag2', severity: 'medium' },
      ],
    })
    const result = predictDealClosure(deal, scoring)
    expect(result.closureProbability).toBeLessThan(base)
    expect(base - result.closureProbability).toBe(6)
  })

  // ── Test 5: No flags → no flag degradation ──────────────────────────────────
  it('does not degrade probability when there are no risk flags', () => {
    const base = 55
    const deal = makeDeal()
    const scoring = makeScoring({ closurePct: base, dealRiskFlags: [] })
    const result = predictDealClosure(deal, scoring)
    // With no dates and no createdAt the only adjustment is none from flags
    // probability = base (55), clamped
    expect(result.closureProbability).toBe(base)
  })

  // ── Test 6: CPCV date within 7d → +6% boost ────────────────────────────────
  it('boosts closureProbability by 6pts when cpcvDate is within 7 days', () => {
    const base = 55
    const deal = makeDeal({ cpcvDate: daysFromNow(5) })
    const scoring = makeScoring({ closurePct: base })
    const result = predictDealClosure(deal, scoring)
    expect(result.closureProbability).toBeGreaterThan(base)
    expect(result.closureProbability - base).toBe(6)
  })

  // ── Test 7: CPCV date within 30d → +3% boost ────────────────────────────────
  it('boosts closureProbability by 3pts when cpcvDate is within 30 days', () => {
    const base = 55
    const deal = makeDeal({ cpcvDate: daysFromNow(20) })
    const scoring = makeScoring({ closurePct: base })
    const result = predictDealClosure(deal, scoring)
    expect(result.closureProbability).toBeGreaterThan(base)
    expect(result.closureProbability - base).toBe(3)
  })

  // ── Test 8: Date > 90d → -5% penalty ────────────────────────────────────────
  it('applies -5pts penalty when nearest date is more than 90 days away', () => {
    const base = 55
    const deal = makeDeal({ cpcvDate: daysFromNow(100) })
    const scoring = makeScoring({ closurePct: base })
    const result = predictDealClosure(deal, scoring)
    expect(result.closureProbability).toBeLessThan(base)
    expect(base - result.closureProbability).toBe(5)
  })

  // ── Test 9: Old deal in Visita (>3× benchmark) degrades via velocity ─────────
  it('applies -12pts velocity penalty when deal age exceeds 3× stage benchmark', () => {
    // Visita benchmark = 14d; age = 60d → ratio = 60/14 ≈ 4.28 → >3× → -12pts
    const base = 55
    const deal = makeDeal({ fase: 'Visita', createdAt: daysAgo(60) })
    const scoring = makeScoring({ closurePct: base })
    const result = predictDealClosure(deal, scoring)
    expect(result.closureProbability).toBeLessThan(base)
    expect(base - result.closureProbability).toBe(12)
  })

  // ── Test 10: Young deal (within benchmark) → +2% ────────────────────────────
  it('boosts probability by 2pts when deal age is within stage benchmark', () => {
    const base = 55
    const deal = makeDeal({ fase: 'Visita', createdAt: daysAgo(7) })
    const scoring = makeScoring({ closurePct: base })
    const result = predictDealClosure(deal, scoring)
    expect(result.closureProbability).toBeGreaterThan(base)
    expect(result.closureProbability - base).toBe(2)
  })

  // ── Test 11: closureProbability always clamped to [1, 99] ───────────────────
  it('clamps closureProbability to [1, 99] with extreme inputs', () => {
    // Push to extremes: very high base + max boosts
    const highDeal = makeDeal({
      cpcvDate: daysFromNow(5),   // +6
      createdAt: daysAgo(1),       // +2 (within Negociação benchmark 21d)
    })
    const highScoring = makeScoring({
      closurePct: 99,
      dealRiskFlags: [],
    })
    const highResult = predictDealClosure(highDeal, highScoring)
    expect(highResult.closureProbability).toBeLessThanOrEqual(99)
    expect(highResult.closureProbability).toBeGreaterThanOrEqual(1)

    // Push to low extreme: massive penalties
    const lowDeal = makeDeal({
      fase: 'Visita',
      cpcvDate: daysFromNow(100),  // -5
      createdAt: daysAgo(60),       // -12 (>3× benchmark)
    })
    const lowScoring = makeScoring({
      closurePct: 1,
      dealRiskFlags: [
        { code: 'NO_CPCV_DATE_IN_LATE_STAGE', label: 'f1', severity: 'high' },
        { code: 'NO_ESCRITURA_DATE_IN_LATE_STAGE', label: 'f2', severity: 'high' },
        { code: 'HIGH_VALUE_LOW_DOCUMENTS', label: 'f3', severity: 'high' },
        { code: 'NO_BUYER_NAME', label: 'f4', severity: 'medium' },
      ],
    })
    const lowResult = predictDealClosure(lowDeal, lowScoring)
    expect(lowResult.closureProbability).toBeGreaterThanOrEqual(1)
    expect(lowResult.closureProbability).toBeLessThanOrEqual(99)
  })

  // ── Test 12: NaN safety — empty/null dates produce no NaN ──────────────────
  it('never produces NaN in output when dates are empty or missing', () => {
    const deal = makeDeal({ cpcvDate: '', escrituraDate: '' })
    const scoring = makeScoring({ closurePct: 55 })
    const result = predictDealClosure(deal, scoring)

    expect(Number.isNaN(result.closureProbability)).toBe(false)
    expect(result.explanation.every(e => !e.includes('NaN'))).toBe(true)
  })

  // ── Test 13: estimatedCloseWindow = '7d' when nearest date ≤7d ──────────────
  it('sets estimatedCloseWindow to 7d when nearest date is within 7 days', () => {
    const deal = makeDeal({ cpcvDate: daysFromNow(4) })
    const scoring = makeScoring()
    const result = predictDealClosure(deal, scoring)
    expect(result.estimatedCloseWindow).toBe('7d')
  })

  // ── Test 14: estimatedCloseWindow = 'uncertain' when no dates + early stage ──
  it('sets estimatedCloseWindow to uncertain when no dates and stage has no fallback', () => {
    // Stage not in any named fallback bucket → stageFallbackWindow returns 'uncertain'
    const deal = makeDeal({ fase: 'Qualificação', cpcvDate: '', escrituraDate: '' })
    const scoring = makeScoring()
    const result = predictDealClosure(deal, scoring)
    expect(result.estimatedCloseWindow).toBe('uncertain')
  })

  // ── Test 15: estimatedCloseWindow = '30d' for CPCV Assinado with no dates ───
  it('sets estimatedCloseWindow to 30d for CPCV Assinado when no dates present', () => {
    const deal = makeDeal({ fase: 'CPCV Assinado', cpcvDate: '', escrituraDate: '' })
    const scoring = makeScoring()
    const result = predictDealClosure(deal, scoring)
    expect(result.estimatedCloseWindow).toBe('30d')
  })

  // ── Test 16: predictionConfidence = 'low' when signalCount = 0 ──────────────
  it('returns low confidence when there are no signal-generating inputs', () => {
    // No flags, no dates, no createdAt → signalCount = 0
    const deal = makeDeal({ cpcvDate: '', escrituraDate: '' })
    const scoring = makeScoring({ dealRiskFlags: [] })
    const result = predictDealClosure(deal, scoring)
    expect(result.predictionConfidence).toBe('low')
    expect(result.explanation.some(e => e.includes('Poucos sinais'))).toBe(true)
  })

  // ── Test 17: predictionConfidence = 'high' when all 3 signals present ────────
  it('returns high confidence when risk flags, dates, and createdAt are all present', () => {
    const deal = makeDeal({
      cpcvDate: daysFromNow(15),
      createdAt: daysAgo(5),
      dealRiskFlags: undefined,  // will be set in scoring
    } as Parameters<typeof makeDeal>[0])
    const scoring = makeScoring({
      dealRiskFlags: [
        // Must be 'high' or 'medium' — prediction.ts only counts those toward signalCount
        { code: 'NO_BUYER_NAME', label: 'test', severity: 'medium' },
      ],
    })
    const result = predictDealClosure(deal, scoring)
    // signalCount: mediumFlags=1 (flags branch), dates=1, createdAt=1 → total 3 → 'high'
    expect(result.predictionConfidence).toBe('high')
  })

  // ── Test 18: predictAllDeals sorts by closureProbability descending ──────────
  it('predictAllDeals returns results sorted by closureProbability descending', () => {
    const scoredDeals = [
      // Low probability: old deal, high risk flags
      {
        deal: makeDeal({ id: 1, ref: 'AG-001', fase: 'Visita', createdAt: daysAgo(60) }),
        scoring: makeScoring({
          closurePct: 20,
          dealRiskFlags: [
            { code: 'NO_BUYER_NAME', label: 'f', severity: 'high' },
            { code: 'NO_NOTES', label: 'f2', severity: 'high' },
          ],
        }),
      },
      // High probability: upcoming date, no flags, young deal
      {
        deal: makeDeal({ id: 2, ref: 'AG-002', fase: 'CPCV Assinado', cpcvDate: daysFromNow(5), createdAt: daysAgo(3) }),
        scoring: makeScoring({ closurePct: 85, dealRiskFlags: [] }),
      },
      // Medium probability: no dates, no flags, no createdAt
      {
        deal: makeDeal({ id: 3, ref: 'AG-003', fase: 'Negociação' }),
        scoring: makeScoring({ closurePct: 50, dealRiskFlags: [] }),
      },
    ]

    const results = predictAllDeals(scoredDeals)

    expect(results.length).toBe(3)
    expect(results[0].prediction.closureProbability).toBeGreaterThanOrEqual(
      results[1].prediction.closureProbability
    )
    expect(results[1].prediction.closureProbability).toBeGreaterThanOrEqual(
      results[2].prediction.closureProbability
    )
    // The high-probability deal (AG-002) should be first
    expect(results[0].dealRef).toBe('AG-002')
  })

})
