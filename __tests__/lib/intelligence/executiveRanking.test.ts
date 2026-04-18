import { describe, it, expect } from 'vitest'
import {
  rankContacts,
  rankDeals,
  computePortfolioHealth,
  generateExecutiveRanking,
} from '../../../app/portal/lib/intelligence/executiveRanking'
import type { ScoredContact } from '../../../app/portal/lib/leadScoring'
import type { ScoredDeal } from '../../../app/portal/lib/dealScoring'
import type { CRMContact, Deal } from '../../../app/portal/components/types'

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeContact(overrides: Partial<CRMContact> = {}): CRMContact {
  return {
    id: 1,
    name: 'Ana Ferreira',
    email: 'ana@example.com',
    phone: '+351900000001',
    nationality: 'PT',
    budgetMin: 0,
    budgetMax: 1_000_000,
    tipos: ['Apartamento'],
    zonas: ['Lisboa'],
    status: 'prospect',
    notes: '',
    lastContact: '',
    nextFollowUp: '',
    dealRef: '',
    origin: '',
    createdAt: '',
    activities: [],
    ...overrides,
  }
}

function makeScoredContact(
  contactOverrides: Partial<CRMContact> = {},
  scoringOverrides: Partial<ScoredContact['scoring']> = {},
): ScoredContact {
  return {
    contact: makeContact(contactOverrides),
    scoring: {
      score: 60,
      band: 'B',
      bandLabel: 'Bom Prospecto',
      reasons: [],
      penalties: [],
      recommendedNextAction: '',
      confidence: 'medium',
      dataCompleteness: 0.6,
      ...scoringOverrides,
    },
  }
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 1,
    ref: 'DEAL-001',
    imovel: 'Apartamento T2 Lisboa',
    valor: '€500.000',
    fase: 'Negociação',
    comprador: 'João Silva',
    cpcvDate: '',
    escrituraDate: '',
    checklist: {},
    notas: 'Em negociação',
    ...overrides,
  }
}

function makeScoredDeal(
  dealOverrides: Partial<Deal> = {},
  scoringOverrides: Partial<ScoredDeal['scoring']> = {},
): ScoredDeal {
  return {
    deal: makeDeal(dealOverrides),
    scoring: {
      dealScore: 60,
      dealHealth: 'MODERADO',
      dealHealthLabel: 'Moderado',
      closureProbabilityBand: 'MEDIA',
      closurePct: 80,
      reasons: [],
      dealRiskFlags: [],
      dealAccelerationActions: [],
      confidence: 'medium',
      ...scoringOverrides,
    },
  }
}

// ─── rankContacts ─────────────────────────────────────────────────────────────

describe('rankContacts', () => {

  it('1. Returns contacts sorted by revenueOpportunity descending', () => {
    const contacts = [
      makeScoredContact({ id: 1, budgetMax: 500_000 }, { score: 50 }),  // rev = round(500000*0.05*0.5) = 12500
      makeScoredContact({ id: 2, budgetMax: 1_000_000 }, { score: 80 }), // rev = round(1000000*0.05*0.8) = 40000
      makeScoredContact({ id: 3, budgetMax: 200_000 }, { score: 90 }),  // rev = round(200000*0.05*0.9) = 9000
    ]
    const result = rankContacts(contacts)
    expect(result[0].contactId).toBe(2)
    expect(result[1].contactId).toBe(1)
    expect(result[2].contactId).toBe(3)
  })

  it('2. revenueOpportunity = budgetMax * 0.05 * (score/100)', () => {
    // budgetMax=1_000_000, score=80 → 1000000*0.05*0.8 = 40000
    const contacts = [makeScoredContact({ budgetMax: 1_000_000 }, { score: 80 })]
    const result = rankContacts(contacts)
    expect(result[0].revenueOpportunity).toBe(40_000)
  })

  it('3. rawRevenueOpportunity = budgetMax * 0.05', () => {
    // budgetMax=1_000_000 → 1000000*0.05 = 50000
    const contacts = [makeScoredContact({ budgetMax: 1_000_000 }, { score: 80 })]
    const result = rankContacts(contacts)
    expect(result[0].rawRevenueOpportunity).toBe(50_000)
  })

  it('4. isUrgent = true for band A', () => {
    const contacts = [makeScoredContact({}, { band: 'A', score: 40 })]
    const result = rankContacts(contacts)
    expect(result[0].isUrgent).toBe(true)
  })

  it('5. isUrgent = true for band B with score >= 55', () => {
    const contacts = [makeScoredContact({}, { band: 'B', score: 55 })]
    const result = rankContacts(contacts)
    expect(result[0].isUrgent).toBe(true)
  })

  it('6. isUrgent = false for band B with score < 55', () => {
    const contacts = [makeScoredContact({}, { band: 'B', score: 54 })]
    const result = rankContacts(contacts)
    expect(result[0].isUrgent).toBe(false)
  })

  it('7. Rank starts at 1 and increments correctly', () => {
    const contacts = [
      makeScoredContact({ id: 1, budgetMax: 1_000_000 }, { score: 80 }),
      makeScoredContact({ id: 2, budgetMax: 500_000 }, { score: 50 }),
      makeScoredContact({ id: 3, budgetMax: 200_000 }, { score: 30 }),
    ]
    const result = rankContacts(contacts)
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
    expect(result[2].rank).toBe(3)
  })

  it('8. Empty array → returns empty array', () => {
    const result = rankContacts([])
    expect(result).toEqual([])
  })

})

// ─── rankDeals ────────────────────────────────────────────────────────────────

describe('rankDeals', () => {

  it('9. Returns deals sorted by expectedCommission descending', () => {
    // Deal A: valor=€500.000, closurePct=80 → rawCommission=25000, expected=20000
    // Deal B: valor=€500.000, closurePct=40 → rawCommission=25000, expected=10000
    const deals = [
      makeScoredDeal({ id: 1, valor: '€500.000' }, { closurePct: 40 }),
      makeScoredDeal({ id: 2, valor: '€500.000' }, { closurePct: 80 }),
    ]
    const result = rankDeals(deals)
    expect(result[0].dealId).toBe(2)
    expect(result[1].dealId).toBe(1)
  })

  it('10. expectedCommission = dealValue * 0.05 * (closurePct/100)', () => {
    // valor='€500.000' → parsePTValue=500000, closurePct=80
    // rawCommission = 500000*0.05 = 25000
    // expectedCommission = 25000 * (80/100) = 20000
    const deals = [makeScoredDeal({ valor: '€500.000' }, { closurePct: 80 })]
    const result = rankDeals(deals)
    expect(result[0].rawCommission).toBe(25_000)
    expect(result[0].expectedCommission).toBe(20_000)
  })

  it('11. Escritura Concluída deals are excluded', () => {
    const deals = [
      makeScoredDeal({ id: 1, fase: 'Negociação' }, {}),
      makeScoredDeal({ id: 2, fase: 'Escritura Concluída' }, {}),
      makeScoredDeal({ id: 3, fase: 'CPCV Assinado' }, {}),
    ]
    const result = rankDeals(deals)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.dealFase !== 'Escritura Concluída')).toBe(true)
  })

  it('12. Rank starts at 1', () => {
    const deals = [
      makeScoredDeal({ id: 1, valor: '€500.000' }, { closurePct: 80 }),
      makeScoredDeal({ id: 2, valor: '€500.000' }, { closurePct: 50 }),
    ]
    const result = rankDeals(deals)
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
  })

})

// ─── computePortfolioHealth ───────────────────────────────────────────────────

describe('computePortfolioHealth', () => {

  it('13. score formula: avgLead*0.3 + avgDeal*0.4 + avgClosure*0.3', () => {
    // avgLead=80, avgDeal=70, avgClosure=60
    // score = round(80*0.3 + 70*0.4 + 60*0.3) = round(24+28+18) = round(70) = 70
    const contacts = [makeScoredContact({}, { score: 80 })]
    const deals = [makeScoredDeal({}, { dealScore: 70, closurePct: 60 })]
    const result = computePortfolioHealth(contacts, deals)
    expect(result.score).toBe(70)
  })

  it('14. label EXCELENTE when score >= 75', () => {
    // avgLead=100, avgDeal=100, avgClosure=100 → score=100
    const contacts = [makeScoredContact({}, { score: 100 })]
    const deals = [makeScoredDeal({}, { dealScore: 100, closurePct: 100 })]
    const result = computePortfolioHealth(contacts, deals)
    expect(result.score).toBeGreaterThanOrEqual(75)
    expect(result.label).toBe('EXCELENTE')
  })

  it('15. label EM_RISCO when score < 35', () => {
    // avgLead=10, avgDeal=10, avgClosure=10 → score = round(10*0.3+10*0.4+10*0.3) = round(10) = 10
    const contacts = [makeScoredContact({}, { score: 10 })]
    const deals = [makeScoredDeal({}, { dealScore: 10, closurePct: 10 })]
    const result = computePortfolioHealth(contacts, deals)
    expect(result.score).toBeLessThan(35)
    expect(result.label).toBe('EM_RISCO')
  })

  it('16. contactsAtRisk counts band D contacts', () => {
    const contacts = [
      makeScoredContact({ id: 1 }, { band: 'D', score: 20 }),
      makeScoredContact({ id: 2 }, { band: 'D', score: 15 }),
      makeScoredContact({ id: 3 }, { band: 'A', score: 90 }),
    ]
    const result = computePortfolioHealth(contacts, [])
    expect(result.contactsAtRisk).toBe(2)
  })

  it('17. dealsAtRisk counts CRITICO + EM_RISCO (excluding Escritura Concluída)', () => {
    const deals = [
      makeScoredDeal({ id: 1, fase: 'Negociação' }, { dealHealth: 'CRITICO' }),
      makeScoredDeal({ id: 2, fase: 'Proposta Enviada' }, { dealHealth: 'EM_RISCO' }),
      makeScoredDeal({ id: 3, fase: 'Negociação' }, { dealHealth: 'SAUDAVEL' }),
      makeScoredDeal({ id: 4, fase: 'Escritura Concluída' }, { dealHealth: 'CRITICO' }),
    ]
    const result = computePortfolioHealth([], deals)
    expect(result.dealsAtRisk).toBe(2)
  })

  it('18. totalWeightedGCI < totalRawGCI when closurePct < 100', () => {
    // valor='€500.000' → rawCommission=25000, weighted=25000*(60/100)=15000
    const deals = [makeScoredDeal({ valor: '€500.000' }, { closurePct: 60 })]
    const result = computePortfolioHealth([], deals)
    expect(result.totalRawGCI).toBe(25_000)
    expect(result.totalWeightedGCI).toBe(15_000)
    expect(result.totalWeightedGCI).toBeLessThan(result.totalRawGCI)
  })

})

// ─── generateExecutiveRanking ─────────────────────────────────────────────────

describe('generateExecutiveRanking', () => {

  it('returns topContacts, topDeals and portfolioHealth', () => {
    const contacts = Array.from({ length: 3 }, (_, i) =>
      makeScoredContact({ id: i + 1, budgetMax: (i + 1) * 200_000 }, { score: 50 + i * 10 })
    )
    const deals = Array.from({ length: 3 }, (_, i) =>
      makeScoredDeal({ id: i + 1, valor: '€500.000' }, { closurePct: 50 + i * 10 })
    )
    const result = generateExecutiveRanking(contacts, deals)
    expect(result.topContacts.length).toBeGreaterThan(0)
    expect(result.topDeals.length).toBeGreaterThan(0)
    expect(result.portfolioHealth).toBeDefined()
    expect(result.portfolioHealth.score).toBeGreaterThanOrEqual(0)
  })

  it('topContacts is capped at 10 even with more contacts', () => {
    const contacts = Array.from({ length: 15 }, (_, i) =>
      makeScoredContact({ id: i + 1, budgetMax: (i + 1) * 100_000 }, { score: 50 })
    )
    const result = generateExecutiveRanking(contacts, [])
    expect(result.topContacts.length).toBeLessThanOrEqual(10)
  })

})
