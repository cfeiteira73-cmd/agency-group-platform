import { describe, it, expect } from 'vitest'
import { generateRevenueForecast } from '../../../app/portal/lib/intelligence/forecast'
import type { ScoredDeal } from '../../../app/portal/lib/dealScoring'
import type { DealScoreResult } from '../../../app/portal/lib/dealScoring'
import type { Deal } from '../../../app/portal/components/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a YYYY-MM-DD date string N days from today */
function daysFromNow(n: number): string {
  const d = new Date(Date.now() + n * 86400000)
  return d.toISOString().slice(0, 10)
}

const defaultScoring: DealScoreResult = {
  closurePct: 70,
  closureProbabilityBand: 'ALTA',
  dealHealth: 'SAUDAVEL',
  dealScore: 75,
  dealRiskFlags: [],
  dealAccelerationActions: [],
  reasons: [],
  confidence: 'high',
  dealHealthLabel: 'Saudável',
}

const defaultDeal: Deal = {
  id: 1,
  ref: 'AG-001',
  imovel: 'Apto Lisboa',
  valor: '€500.000',
  fase: 'CPCV Assinado',
  comprador: 'João',
  cpcvDate: '',
  escrituraDate: '',
  checklist: {},
  notas: '',
}

function makeScoredDeal(overrides: {
  deal?: Partial<Deal> & { createdAt?: string }
  scoring?: Partial<DealScoreResult>
} = {}): ScoredDeal {
  return {
    deal: { ...defaultDeal, ...overrides.deal } as Deal,
    scoring: { ...defaultScoring, ...overrides.scoring },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateRevenueForecast — empty input', () => {
  it('1. empty array produces no errors and all GCI values are 0', () => {
    const out = generateRevenueForecast([])
    expect(out.monthly.expectedGCI).toBe(0)
    expect(out.quarterly.expectedGCI).toBe(0)
    expect(out.semiAnnual.expectedGCI).toBe(0)
    expect(out.rawPipelineGCI).toBe(0)
    expect(out.weightedPipelineGCI).toBe(0)
    expect(typeof out.generatedAt).toBe('number')
  })
})

describe('generateRevenueForecast — Escritura Concluída exclusion', () => {
  it('2. deal with fase=Escritura Concluída contributes 0 to any period', () => {
    const closed = makeScoredDeal({
      deal: { fase: 'Escritura Concluída', valor: '€1.000.000' },
      scoring: { closureProbabilityBand: 'ALTA', closurePct: 100 },
    })
    const out = generateRevenueForecast([closed])
    expect(out.monthly.expectedGCI).toBe(0)
    expect(out.quarterly.expectedGCI).toBe(0)
    expect(out.semiAnnual.expectedGCI).toBe(0)
    expect(out.rawPipelineGCI).toBe(0)
    expect(out.weightedPipelineGCI).toBe(0)
  })
})

describe('generateRevenueForecast — monthly (30d) inclusion', () => {
  it('3. ALTA band + late stage (CPCV Assinado) is included in monthly regardless of dates', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'CPCV Assinado', cpcvDate: '', escrituraDate: '', valor: '€500.000' },
      scoring: { closureProbabilityBand: 'ALTA' },
    })
    const out = generateRevenueForecast([deal])
    expect(out.monthly.dealsCount).toBe(1)
    expect(out.monthly.expectedGCI).toBeGreaterThan(0)
  })

  it('4. ALTA band + cpcvDate within 30 days is included in monthly', () => {
    const deal = makeScoredDeal({
      deal: {
        fase: 'Negociação',
        cpcvDate: daysFromNow(15),
        escrituraDate: '',
        valor: '€500.000',
      },
      scoring: { closureProbabilityBand: 'ALTA' },
    })
    const out = generateRevenueForecast([deal])
    expect(out.monthly.dealsCount).toBe(1)
    expect(out.monthly.expectedGCI).toBeGreaterThan(0)
  })

  it('5. ALTA band + cpcvDate > 30d and non-late-stage is NOT in monthly but IS in quarterly', () => {
    const deal = makeScoredDeal({
      deal: {
        fase: 'Negociação',
        cpcvDate: daysFromNow(60),
        escrituraDate: '',
        valor: '€500.000',
      },
      scoring: { closureProbabilityBand: 'ALTA' },
    })
    const out = generateRevenueForecast([deal])
    expect(out.monthly.dealsCount).toBe(0)
    expect(out.quarterly.dealsCount).toBe(1)
  })
})

describe('generateRevenueForecast — band filtering', () => {
  it('6. BAIXA band deal is NOT in monthly or quarterly, but IS in semiAnnual', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'Angariação', cpcvDate: daysFromNow(10), escrituraDate: '', valor: '€300.000' },
      scoring: { closureProbabilityBand: 'BAIXA', closurePct: 20 },
    })
    const out = generateRevenueForecast([deal])
    expect(out.monthly.dealsCount).toBe(0)
    expect(out.quarterly.dealsCount).toBe(0)
    expect(out.semiAnnual.dealsCount).toBe(1)
  })

  it('7. MEDIA band + Negociação stage is included in quarterly', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'Negociação', cpcvDate: '', escrituraDate: '', valor: '€400.000' },
      scoring: { closureProbabilityBand: 'MEDIA', closurePct: 50 },
    })
    const out = generateRevenueForecast([deal])
    expect(out.quarterly.dealsCount).toBe(1)
  })

  it('8. MEDIA band + Angariação stage (early stage) is NOT in quarterly', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'Angariação', cpcvDate: '', escrituraDate: '', valor: '€400.000' },
      scoring: { closureProbabilityBand: 'MEDIA', closurePct: 50 },
    })
    const out = generateRevenueForecast([deal])
    expect(out.quarterly.dealsCount).toBe(0)
  })
})

describe('generateRevenueForecast — GCI calculations', () => {
  it('9. expectedGCI = dealValue * 0.05 * (closurePct/100): €500K at 80% → 20000', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'CPCV Assinado', valor: '€500.000', cpcvDate: '', escrituraDate: '' },
      scoring: { closureProbabilityBand: 'ALTA', closurePct: 80 },
    })
    const out = generateRevenueForecast([deal])
    // 500000 * 0.05 * 0.80 = 20000
    expect(out.monthly.expectedGCI).toBe(20000)
  })

  it('10. pessimisticGCI = 75% of expectedGCI', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'CPCV Assinado', valor: '€500.000', cpcvDate: '', escrituraDate: '' },
      scoring: { closureProbabilityBand: 'ALTA', closurePct: 80 },
    })
    const out = generateRevenueForecast([deal])
    expect(out.monthly.pessimisticGCI).toBe(Math.round(out.monthly.expectedGCI * 0.75))
  })

  it('11. optimisticGCI = 125% of expectedGCI', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'CPCV Assinado', valor: '€500.000', cpcvDate: '', escrituraDate: '' },
      scoring: { closureProbabilityBand: 'ALTA', closurePct: 80 },
    })
    const out = generateRevenueForecast([deal])
    expect(out.monthly.optimisticGCI).toBe(Math.round(out.monthly.expectedGCI * 1.25))
  })

  it('12. rawPipelineGCI = sum of dealValue * 0.05 (no probability weighting)', () => {
    const deals = [
      makeScoredDeal({ deal: { fase: 'CPCV Assinado', valor: '€500.000' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 60 } }),
      makeScoredDeal({ deal: { id: 2, ref: 'AG-002', fase: 'Negociação', valor: '€1.000.000' }, scoring: { closureProbabilityBand: 'MEDIA', closurePct: 40 } }),
    ]
    const out = generateRevenueForecast(deals)
    // 500000 * 0.05 + 1000000 * 0.05 = 25000 + 50000 = 75000
    expect(out.rawPipelineGCI).toBe(75000)
  })

  it('13. weightedPipelineGCI = sum of expectedCommission (probability-weighted)', () => {
    const deals = [
      makeScoredDeal({ deal: { fase: 'CPCV Assinado', valor: '€500.000' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 60 } }),
      makeScoredDeal({ deal: { id: 2, ref: 'AG-002', fase: 'Negociação', valor: '€1.000.000' }, scoring: { closureProbabilityBand: 'MEDIA', closurePct: 40 } }),
    ]
    const out = generateRevenueForecast(deals)
    // 500000 * 0.05 * 0.60 + 1000000 * 0.05 * 0.40 = 15000 + 20000 = 35000
    expect(out.weightedPipelineGCI).toBe(35000)
  })

  it('14. weightedPipelineGCI is always <= rawPipelineGCI', () => {
    const deals = [
      makeScoredDeal({ deal: { fase: 'CPCV Assinado', valor: '€800.000' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 85 } }),
      makeScoredDeal({ deal: { id: 2, ref: 'AG-002', fase: 'Visita', valor: '€300.000' }, scoring: { closureProbabilityBand: 'BAIXA', closurePct: 15 } }),
    ]
    const out = generateRevenueForecast(deals)
    expect(out.weightedPipelineGCI).toBeLessThanOrEqual(out.rawPipelineGCI)
  })
})

describe('generateRevenueForecast — confidence', () => {
  it('15. confidence = high when ≥3 deals with real dates are in the period', () => {
    const deals = [
      makeScoredDeal({ deal: { id: 1, ref: 'AG-001', fase: 'CPCV Assinado', cpcvDate: daysFromNow(10), escrituraDate: '', valor: '€500.000' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 80 } }),
      makeScoredDeal({ deal: { id: 2, ref: 'AG-002', fase: 'Escritura Marcada', cpcvDate: daysFromNow(5), escrituraDate: daysFromNow(20), valor: '€700.000' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 90 } }),
      makeScoredDeal({ deal: { id: 3, ref: 'AG-003', fase: 'Financiamento', cpcvDate: daysFromNow(15), escrituraDate: '', valor: '€400.000' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 75 } }),
    ]
    const out = generateRevenueForecast(deals)
    expect(out.monthly.confidence).toBe('high')
  })

  it('16. confidence = low when 0 deals have real dates and count < 3', () => {
    const deal = makeScoredDeal({
      deal: { fase: 'CPCV Assinado', cpcvDate: '', escrituraDate: '', valor: '€500.000' },
      scoring: { closureProbabilityBand: 'ALTA', closurePct: 70 },
    })
    const out = generateRevenueForecast([deal])
    // 1 deal, no real dates → withRealDates=0, deals.length=1 < 3 → low
    expect(out.monthly.confidence).toBe('low')
  })
})

describe('generateRevenueForecast — topContributors', () => {
  it('17. topContributors contains max 3 deals, sorted by expectedCommission descending', () => {
    const deals = [
      makeScoredDeal({ deal: { id: 1, ref: 'AG-001', fase: 'CPCV Assinado', valor: '€200.000', cpcvDate: '', escrituraDate: '' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 70 } }),
      makeScoredDeal({ deal: { id: 2, ref: 'AG-002', fase: 'CPCV Assinado', valor: '€1.000.000', cpcvDate: '', escrituraDate: '' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 80 } }),
      makeScoredDeal({ deal: { id: 3, ref: 'AG-003', fase: 'Escritura Marcada', valor: '€3.000.000', cpcvDate: '', escrituraDate: '' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 90 } }),
      makeScoredDeal({ deal: { id: 4, ref: 'AG-004', fase: 'CPCV Assinado', valor: '€500.000', cpcvDate: '', escrituraDate: '' }, scoring: { closureProbabilityBand: 'ALTA', closurePct: 75 } }),
    ]
    const out = generateRevenueForecast(deals)
    expect(out.semiAnnual.topContributors.length).toBeLessThanOrEqual(3)
    const commissions = out.semiAnnual.topContributors.map(c => c.expectedCommission)
    for (let i = 1; i < commissions.length; i++) {
      expect(commissions[i - 1]).toBeGreaterThanOrEqual(commissions[i])
    }
    // Highest value deal should be first contributor
    expect(out.semiAnnual.topContributors[0].dealRef).toBe('AG-003')
  })
})

describe('generateRevenueForecast — generatedAt', () => {
  it('18. generatedAt is within 1 second of Date.now()', () => {
    const before = Date.now()
    const out = generateRevenueForecast([])
    const after = Date.now()
    expect(out.generatedAt).toBeGreaterThanOrEqual(before)
    expect(out.generatedAt).toBeLessThanOrEqual(after + 1000)
  })
})
