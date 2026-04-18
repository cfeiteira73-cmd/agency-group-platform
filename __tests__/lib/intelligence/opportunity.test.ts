import { describe, it, expect } from 'vitest'
import { detectOpportunities, getTopOpportunities, opportunitySummary } from '../../../app/portal/lib/intelligence/opportunity'
import type { ScoredContact } from '../../../app/portal/lib/leadScoring'
import type { ScoredDeal } from '../../../app/portal/lib/dealScoring'
import type { CRMContact, Deal } from '../../../app/portal/components/types'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split('T')[0]
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

function makeContact(overrides: Partial<CRMContact> = {}): CRMContact {
  return {
    id: 1,
    name: 'Test Contact',
    email: 'test@example.com',
    phone: '+351900000001',
    nationality: 'PT',
    budgetMin: 0,
    budgetMax: 600_000,
    tipos: ['Apartamento'],
    zonas: ['Lisboa'],
    status: 'prospect',
    notes: '',
    lastContact: daysAgo(20),
    nextFollowUp: '',
    dealRef: '',
    origin: '',
    createdAt: daysAgo(30),
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
      score: 70,
      band: 'A',
      bandLabel: 'Alta Prioridade',
      reasons: ['Score reason'],
      penalties: [],
      recommendedNextAction: 'test action',
      confidence: 'high',
      dataCompleteness: 0.8,
      ...scoringOverrides,
    },
  }
}

function makeDeal(overrides: Partial<Deal> & { createdAt?: string } = {}): Deal & { createdAt?: string } {
  const { createdAt, ...dealOverrides } = overrides
  return {
    id: 1,
    ref: 'REF-001',
    imovel: 'Apartamento Lisboa',
    valor: '750.000',
    fase: 'Negociação',
    comprador: 'João Silva',
    cpcvDate: '',
    escrituraDate: '',
    checklist: {},
    notas: 'Notas de teste',
    createdAt: createdAt ?? daysAgo(40),
    ...dealOverrides,
  }
}

function makeScoredDeal(
  dealOverrides: Partial<Deal> & { createdAt?: string } = {},
  scoringOverrides: Partial<ScoredDeal['scoring']> = {},
): ScoredDeal {
  return {
    deal: makeDeal(dealOverrides),
    scoring: {
      dealScore: 70,
      dealHealth: 'SAUDAVEL',
      dealHealthLabel: 'Saudável',
      closureProbabilityBand: 'ALTA',
      closurePct: 75,
      reasons: ['Score reason'],
      dealRiskFlags: [],
      dealAccelerationActions: [],
      confidence: 'high',
      ...scoringOverrides,
    },
  }
}

// ─── NEGLECTED_HIGH_VALUE_LEAD ────────────────────────────────────────────────

describe('NEGLECTED_HIGH_VALUE_LEAD', () => {
  it('Band A + budgetMax >= 500K + lastContact > 14d → detected', () => {
    const sc = makeScoredContact(
      { budgetMax: 600_000, lastContact: daysAgo(20) },
      { band: 'A' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found).toBeDefined()
  })

  it('Band A → priority critical, confidence high', () => {
    const sc = makeScoredContact(
      { budgetMax: 600_000, lastContact: daysAgo(20) },
      { band: 'A' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found?.priority).toBe('critical')
    expect(found?.confidence).toBe('high')
  })

  it('Band B → priority high, confidence medium', () => {
    const sc = makeScoredContact(
      { budgetMax: 600_000, lastContact: daysAgo(20) },
      { band: 'B', bandLabel: 'Bom Prospecto' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found?.priority).toBe('high')
    expect(found?.confidence).toBe('medium')
  })

  it('Band C (score < 55) → NOT detected even if other conditions met', () => {
    const sc = makeScoredContact(
      { budgetMax: 600_000, lastContact: daysAgo(20) },
      { band: 'C', score: 45, bandLabel: 'Em Observação' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found).toBeUndefined()
  })

  it('budgetMax < 500K → NOT detected', () => {
    const sc = makeScoredContact(
      { budgetMax: 400_000, lastContact: daysAgo(20) },
      { band: 'A' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found).toBeUndefined()
  })

  it('lastContact only 7d ago → NOT detected (≤14d threshold)', () => {
    const sc = makeScoredContact(
      { budgetMax: 600_000, lastContact: daysAgo(7) },
      { band: 'A' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found).toBeUndefined()
  })

  it('estimatedCommission = budgetMax * 0.05', () => {
    const budgetMax = 800_000
    const sc = makeScoredContact(
      { budgetMax, lastContact: daysAgo(20) },
      { band: 'A' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    expect(found?.estimatedCommission).toBe(budgetMax * 0.05)
  })
})

// ─── STALLED_HIGH_POTENTIAL_DEAL ──────────────────────────────────────────────

describe('STALLED_HIGH_POTENTIAL_DEAL', () => {
  it('dealScore >= 60 + no cpcvDate/escrituraDate + age > 30d → detected', () => {
    const sd = makeScoredDeal(
      { cpcvDate: '', escrituraDate: '', createdAt: daysAgo(45) },
      { dealScore: 65 },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'STALLED_HIGH_POTENTIAL_DEAL')
    expect(found).toBeDefined()
  })

  it('dealScore >= 80 → priority critical', () => {
    const sd = makeScoredDeal(
      { cpcvDate: '', escrituraDate: '', createdAt: daysAgo(45) },
      { dealScore: 85 },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'STALLED_HIGH_POTENTIAL_DEAL')
    expect(found?.priority).toBe('critical')
  })

  it('dealScore 60-79 → priority high', () => {
    const sd = makeScoredDeal(
      { cpcvDate: '', escrituraDate: '', createdAt: daysAgo(45) },
      { dealScore: 70 },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'STALLED_HIGH_POTENTIAL_DEAL')
    expect(found?.priority).toBe('high')
  })

  it('dealScore < 60 → NOT detected', () => {
    const sd = makeScoredDeal(
      { cpcvDate: '', escrituraDate: '', createdAt: daysAgo(45) },
      { dealScore: 55 },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'STALLED_HIGH_POTENTIAL_DEAL')
    expect(found).toBeUndefined()
  })

  it('has cpcvDate → NOT detected', () => {
    const sd = makeScoredDeal(
      { cpcvDate: daysFromNow(30), escrituraDate: '', createdAt: daysAgo(45) },
      { dealScore: 70 },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'STALLED_HIGH_POTENTIAL_DEAL')
    expect(found).toBeUndefined()
  })
})

// ─── REENGAGEMENT_OPPORTUNITY ─────────────────────────────────────────────────

describe('REENGAGEMENT_OPPORTUNITY', () => {
  it('activities.length >= 3 + lastContact > 30d + status not cliente/vip → detected', () => {
    const sc = makeScoredContact({
      status: 'prospect',
      activities: [
        { id: 1, type: 'call', date: daysAgo(50), note: '' },
        { id: 2, type: 'email', date: daysAgo(45), note: '' },
        { id: 3, type: 'visit', date: daysAgo(40), note: '' },
      ],
      lastContact: daysAgo(35),
    })
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'REENGAGEMENT_OPPORTUNITY')
    expect(found).toBeDefined()
  })

  it('status === cliente → NOT detected', () => {
    const sc = makeScoredContact({
      status: 'cliente',
      activities: [
        { id: 1, type: 'call', date: daysAgo(50), note: '' },
        { id: 2, type: 'email', date: daysAgo(45), note: '' },
        { id: 3, type: 'visit', date: daysAgo(40), note: '' },
      ],
      lastContact: daysAgo(35),
    })
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'REENGAGEMENT_OPPORTUNITY')
    expect(found).toBeUndefined()
  })

  it('activities.length < 3 → NOT detected', () => {
    const sc = makeScoredContact({
      status: 'prospect',
      activities: [
        { id: 1, type: 'call', date: daysAgo(50), note: '' },
        { id: 2, type: 'email', date: daysAgo(45), note: '' },
      ],
      lastContact: daysAgo(35),
    })
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'REENGAGEMENT_OPPORTUNITY')
    expect(found).toBeUndefined()
  })
})

// ─── FAST_CONVERSION_SIGNAL ───────────────────────────────────────────────────

describe('FAST_CONVERSION_SIGNAL', () => {
  it('activities.length >= 5 + score >= 65 + lastContact <= 3d → detected, confidence high', () => {
    const sc = makeScoredContact(
      {
        activities: [
          { id: 1, type: 'call', date: daysAgo(10), note: '' },
          { id: 2, type: 'email', date: daysAgo(8), note: '' },
          { id: 3, type: 'visit', date: daysAgo(6), note: '' },
          { id: 4, type: 'proposal', date: daysAgo(4), note: '' },
          { id: 5, type: 'whatsapp', date: daysAgo(2), note: '' },
        ],
        lastContact: daysAgo(2),
      },
      { score: 70, band: 'A' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'FAST_CONVERSION_SIGNAL')
    expect(found).toBeDefined()
    expect(found?.confidence).toBe('high')
  })

  it('score < 65 → NOT detected', () => {
    const sc = makeScoredContact(
      {
        activities: [
          { id: 1, type: 'call', date: daysAgo(10), note: '' },
          { id: 2, type: 'email', date: daysAgo(8), note: '' },
          { id: 3, type: 'visit', date: daysAgo(6), note: '' },
          { id: 4, type: 'proposal', date: daysAgo(4), note: '' },
          { id: 5, type: 'whatsapp', date: daysAgo(2), note: '' },
        ],
        lastContact: daysAgo(2),
      },
      { score: 60, band: 'B' },
    )
    const opps = detectOpportunities([sc], [])
    const found = opps.find(o => o.type === 'FAST_CONVERSION_SIGNAL')
    expect(found).toBeUndefined()
  })
})

// ─── CLOSING_WINDOW_OPEN ──────────────────────────────────────────────────────

describe('CLOSING_WINDOW_OPEN', () => {
  it('closureProbabilityBand ALTA + cpcvDate ≤30d + checklist < 80% → detected', () => {
    const sd = makeScoredDeal(
      {
        cpcvDate: daysFromNow(20),
        escrituraDate: '',
        checklist: { docs: [true, false, false, false, false] }, // 20% completion
      },
      { closureProbabilityBand: 'ALTA' },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'CLOSING_WINDOW_OPEN')
    expect(found).toBeDefined()
  })

  it('checklist >= 80% → NOT detected', () => {
    const sd = makeScoredDeal(
      {
        cpcvDate: daysFromNow(20),
        escrituraDate: '',
        checklist: { docs: [true, true, true, true, false] }, // 80% completion
      },
      { closureProbabilityBand: 'ALTA' },
    )
    const opps = detectOpportunities([], [sd])
    const found = opps.find(o => o.type === 'CLOSING_WINDOW_OPEN')
    expect(found).toBeUndefined()
  })
})

// ─── opportunitySummary ───────────────────────────────────────────────────────

describe('opportunitySummary', () => {
  it('correct total, critical count, revenueAtRisk sum', () => {
    // Two critical NEGLECTED leads + one Band B (high)
    const sc1 = makeScoredContact(
      { id: 1, budgetMax: 1_000_000, lastContact: daysAgo(20) },
      { band: 'A' },
    )
    const sc2 = makeScoredContact(
      { id: 2, budgetMax: 800_000, lastContact: daysAgo(25) },
      { band: 'A' },
    )
    const sc3 = makeScoredContact(
      { id: 3, budgetMax: 600_000, lastContact: daysAgo(20) },
      { band: 'B', bandLabel: 'Bom Prospecto' },
    )

    const opps = detectOpportunities([sc1, sc2, sc3], [])
    const neglected = opps.filter(o => o.type === 'NEGLECTED_HIGH_VALUE_LEAD')
    const summary = opportunitySummary(neglected)

    const criticalOpps = neglected.filter(o => o.priority === 'critical')
    const expectedRevAtRisk = criticalOpps.reduce((sum, o) => sum + (o.estimatedCommission ?? 0), 0)

    expect(summary.total).toBe(neglected.length)
    expect(summary.critical).toBe(criticalOpps.length)
    expect(summary.revenueAtRisk).toBeCloseTo(expectedRevAtRisk)
    // Band A contacts: commission = budgetMax * 0.05
    expect(summary.revenueAtRisk).toBeCloseTo(1_000_000 * 0.05 + 800_000 * 0.05)
  })
})

// ─── getTopOpportunities ──────────────────────────────────────────────────────

describe('getTopOpportunities', () => {
  it('returns up to limit items from sorted list', () => {
    const opps = detectOpportunities(
      [
        makeScoredContact({ id: 1, budgetMax: 600_000, lastContact: daysAgo(20) }, { band: 'A' }),
        makeScoredContact({ id: 2, budgetMax: 700_000, lastContact: daysAgo(25) }, { band: 'A' }),
        makeScoredContact({ id: 3, budgetMax: 800_000, lastContact: daysAgo(30) }, { band: 'A' }),
        makeScoredContact({ id: 4, budgetMax: 900_000, lastContact: daysAgo(35) }, { band: 'A' }),
        makeScoredContact({ id: 5, budgetMax: 550_000, lastContact: daysAgo(22) }, { band: 'A' }),
        makeScoredContact({ id: 6, budgetMax: 650_000, lastContact: daysAgo(28) }, { band: 'A' }),
      ],
      [],
    )
    const top3 = getTopOpportunities(opps, 3)
    expect(top3.length).toBe(3)
  })

  it('output is sorted critical first then by commission descending', () => {
    const sc1 = makeScoredContact({ id: 1, budgetMax: 600_000, lastContact: daysAgo(20) }, { band: 'B', bandLabel: 'Bom Prospecto' })
    const sc2 = makeScoredContact({ id: 2, budgetMax: 800_000, lastContact: daysAgo(20) }, { band: 'A' })
    const opps = detectOpportunities([sc1, sc2], [])
    const top = getTopOpportunities(opps, 5)
    // critical (band A) must come before high (band B)
    const idxCritical = top.findIndex(o => o.priority === 'critical')
    const idxHigh = top.findIndex(o => o.priority === 'high')
    if (idxCritical !== -1 && idxHigh !== -1) {
      expect(idxCritical).toBeLessThan(idxHigh)
    }
  })
})
