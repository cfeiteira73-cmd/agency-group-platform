import { describe, it, expect } from 'vitest'
import { generateLeadSuggestion, generateDealSuggestion, generateCopilot } from '../../../app/portal/lib/intelligence/copilot'
import type { ScoredContact } from '../../../app/portal/lib/leadScoring'
import type { ScoredDeal } from '../../../app/portal/lib/dealScoring'
import type { Opportunity } from '../../../app/portal/lib/intelligence/opportunity'
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
    name: 'Ana Ferreira',
    email: 'ana@example.com',
    phone: '+351900000001',
    nationality: 'PT',
    budgetMin: 0,
    budgetMax: 600_000,
    tipos: ['Apartamento'],
    zonas: ['Lisboa'],
    status: 'prospect',
    notes: '',
    lastContact: daysAgo(10),
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
      reasons: ['Budget €500K-€1M', 'Status PROSPECT'],
      penalties: [],
      recommendedNextAction: 'Contactar esta semana',
      confidence: 'high',
      dataCompleteness: 0.8,
      ...scoringOverrides,
    },
  }
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
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
    notas: 'Notas de negociação',
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
      dealScore: 70,
      dealHealth: 'SAUDAVEL',
      dealHealthLabel: 'Saudável',
      closureProbabilityBand: 'ALTA',
      closurePct: 75,
      reasons: ['Fase "Negociação"', 'Valor €500K-€1M'],
      dealRiskFlags: [],
      dealAccelerationActions: ['Agendar reunião'],
      confidence: 'high',
      ...scoringOverrides,
    },
  }
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'NEGLECTED_HIGH_VALUE_LEAD:1',
    type: 'NEGLECTED_HIGH_VALUE_LEAD',
    priority: 'critical',
    subjectName: 'Ana Ferreira',
    subjectRef: '1',
    reasoning: ['Sem contacto há 20d', 'Budget €600K'],
    recommendedAction: 'Contactar hoje',
    estimatedCommission: 30_000,
    confidence: 'high',
    ...overrides,
  }
}

// ─── generateLeadSuggestion ───────────────────────────────────────────────────

describe('generateLeadSuggestion', () => {
  it('overdue follow-up + score >= 60 → urgency immediate, headline contains name', () => {
    const sc = makeScoredContact(
      {
        name: 'Carlos Mendes',
        nextFollowUp: daysAgo(3),   // overdue by 3 days
        lastContact: daysAgo(10),
      },
      { score: 72, band: 'A' },
    )
    const suggestion = generateLeadSuggestion(sc)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('immediate')
    expect(suggestion?.headline).toContain('Carlos Mendes')
  })

  it('overdue follow-up but score < 60 → falls through to next rule', () => {
    // score < 60 means rule 1 does not fire; but if band is A or B and lastContact > 7d,
    // rule 2 would fire instead — use band C and recent contact to ensure null
    const sc = makeScoredContact(
      {
        nextFollowUp: daysAgo(3),
        lastContact: daysAgo(2),   // recent, prevents rule 2
      },
      { score: 55, band: 'C', bandLabel: 'Em Observação' },
    )
    const suggestion = generateLeadSuggestion(sc)
    // Rule 1 requires score >= 60, so should not fire
    expect(suggestion?.urgency).not.toBe('immediate')
  })

  it('Band A + lastContact > 7d → urgency today', () => {
    const sc = makeScoredContact(
      {
        nextFollowUp: '',           // no overdue follow-up
        lastContact: daysAgo(10),
      },
      { score: 72, band: 'A', confidence: 'high' },
    )
    const suggestion = generateLeadSuggestion(sc)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('today')
  })

  it('Band B + lastContact > 7d → urgency this_week', () => {
    const sc = makeScoredContact(
      {
        nextFollowUp: '',
        lastContact: daysAgo(10),
      },
      { score: 62, band: 'B', bandLabel: 'Bom Prospecto', confidence: 'medium' },
    )
    const suggestion = generateLeadSuggestion(sc)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('this_week')
  })

  it('score >= 75 + no activities → urgency today, action contains Agendar', () => {
    const sc = makeScoredContact(
      {
        nextFollowUp: '',
        lastContact: daysAgo(2),   // recent, prevents rule 2 on its own
        activities: [],
      },
      { score: 80, band: 'A' },
    )
    // Rule 2 fires only when lastDays > 7; here lastContact is 2d ago
    // so rule 2 won't fire → rule 3 fires (score >= 75 + actCount === 0)
    const suggestion = generateLeadSuggestion(sc)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('today')
    expect(suggestion?.action).toContain('Agendar')
  })

  it('Band C + recent contact + activities → returns null', () => {
    const sc = makeScoredContact(
      {
        nextFollowUp: daysFromNow(5),  // not overdue
        lastContact: daysAgo(3),       // recent, rule 2 won't fire (<=7d)
        activities: [
          { id: 1, type: 'call', date: daysAgo(5), note: '' },
          { id: 2, type: 'email', date: daysAgo(3), note: '' },
        ],
      },
      { score: 45, band: 'C', bandLabel: 'Em Observação' },
    )
    const suggestion = generateLeadSuggestion(sc)
    expect(suggestion).toBeNull()
  })

  it('headline.length <= 80', () => {
    const sc = makeScoredContact(
      {
        name: 'Nome Muito Longo Que Poderia Causar Problemas De Truncagem No Headline',
        nextFollowUp: daysAgo(5),
        lastContact: daysAgo(15),
      },
      { score: 75, band: 'A' },
    )
    const suggestion = generateLeadSuggestion(sc)
    if (suggestion) {
      expect(suggestion.headline.length).toBeLessThanOrEqual(80)
    }
  })

  it('action.length <= 120', () => {
    const sc = makeScoredContact(
      {
        tipos: ['Apartamento de Luxo com Piscina e Vista Mar'],
        zonas: ['Cascais e Estoril e toda a linha de Cascais'],
        nextFollowUp: daysAgo(3),
        lastContact: daysAgo(15),
      },
      { score: 72, band: 'A' },
    )
    const suggestion = generateLeadSuggestion(sc)
    if (suggestion) {
      expect(suggestion.action.length).toBeLessThanOrEqual(120)
    }
  })
})

// ─── generateDealSuggestion ───────────────────────────────────────────────────

describe('generateDealSuggestion', () => {
  it('dealHealth CRITICO → urgency immediate', () => {
    const sd = makeScoredDeal(
      {},
      {
        dealHealth: 'CRITICO',
        dealHealthLabel: 'Crítico',
        dealAccelerationActions: ['Rever deal urgentemente'],
        dealRiskFlags: [],
      },
    )
    const suggestion = generateDealSuggestion(sd)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('immediate')
  })

  it('dealHealth EM_RISCO → urgency today', () => {
    const sd = makeScoredDeal(
      {},
      {
        dealHealth: 'EM_RISCO',
        dealHealthLabel: 'Em Risco',
        dealAccelerationActions: ['Contactar comprador'],
        dealRiskFlags: [],
      },
    )
    const suggestion = generateDealSuggestion(sd)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('today')
  })

  it('closureProbabilityBand ALTA + nearest date ≤14d → urgency immediate', () => {
    const sd = makeScoredDeal(
      {
        cpcvDate: daysFromNow(10),
        escrituraDate: '',
      },
      {
        dealHealth: 'SAUDAVEL',
        closureProbabilityBand: 'ALTA',
        closurePct: 85,
      },
    )
    const suggestion = generateDealSuggestion(sd)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('immediate')
  })

  it('closureProbabilityBand ALTA + date >14d → does NOT match closing rule', () => {
    const sd = makeScoredDeal(
      {
        cpcvDate: daysFromNow(30),
        escrituraDate: '',
      },
      {
        dealHealth: 'SAUDAVEL',
        closureProbabilityBand: 'ALTA',
        closurePct: 80,
      },
    )
    const suggestion = generateDealSuggestion(sd)
    // Should not be 'immediate' from rule 2; SAUDAVEL with dates means it won't
    // match rules 1 or 3 either → null
    if (suggestion) {
      expect(suggestion.urgency).not.toBe('immediate')
    }
  })

  it('MODERADO + no cpcvDate/escrituraDate → urgency this_week', () => {
    const sd = makeScoredDeal(
      {
        cpcvDate: '',
        escrituraDate: '',
        fase: 'Proposta Enviada',
      },
      {
        dealHealth: 'MODERADO',
        dealHealthLabel: 'Moderado',
        closureProbabilityBand: 'MEDIA',
        dealAccelerationActions: ['Agendar reunião com todas as partes'],
        reasons: ['Fase "Proposta Enviada"'],
      },
    )
    const suggestion = generateDealSuggestion(sd)
    expect(suggestion).not.toBeNull()
    expect(suggestion?.urgency).toBe('this_week')
  })

  it('SAUDAVEL with all good data → returns null', () => {
    const sd = makeScoredDeal(
      {
        cpcvDate: daysFromNow(60),
        escrituraDate: daysFromNow(90),
        fase: 'CPCV Assinado',
      },
      {
        dealHealth: 'SAUDAVEL',
        closureProbabilityBand: 'ALTA',
        closurePct: 90,
      },
    )
    // Rule 1: not CRITICO/EM_RISCO
    // Rule 2: ALTA but nearest date is 60d > 14 → does not trigger
    // Rule 3: not MODERADO
    const suggestion = generateDealSuggestion(sd)
    expect(suggestion).toBeNull()
  })
})

// ─── generateCopilot ─────────────────────────────────────────────────────────

describe('generateCopilot', () => {
  // Build 5 scoreable contacts (band A, overdue follow-ups) to generate >3 lead suggestions
  function makeOverdueLeads(count: number): ScoredContact[] {
    return Array.from({ length: count }, (_, i) =>
      makeScoredContact(
        {
          id: i + 1,
          name: `Lead ${i + 1}`,
          nextFollowUp: daysAgo(i + 1),
          lastContact: daysAgo(10 + i),
        },
        { score: 70, band: 'A' },
      ),
    )
  }

  // Build 5 CRITICO deals to generate >3 deal suggestions
  function makeCriticoDeals(count: number): ScoredDeal[] {
    return Array.from({ length: count }, (_, i) =>
      makeScoredDeal(
        { id: i + 1, ref: `DEAL-${i + 1}` },
        {
          dealHealth: 'CRITICO',
          dealHealthLabel: 'Crítico',
          dealAccelerationActions: ['Acção urgente'],
          dealRiskFlags: [],
        },
      ),
    )
  }

  it('returns up to 3 lead suggestions max', () => {
    const contacts = makeOverdueLeads(5)
    const result = generateCopilot(contacts, [], [])
    expect(result.topLeadSuggestions.length).toBeLessThanOrEqual(3)
  })

  it('returns up to 3 deal suggestions max', () => {
    const deals = makeCriticoDeals(5)
    const result = generateCopilot([], deals, [])
    expect(result.topDealSuggestions.length).toBeLessThanOrEqual(3)
  })

  it('managerBrief.revenueAtRisk = sum of critical opportunity commissions', () => {
    const opps: Opportunity[] = [
      makeOpportunity({ priority: 'critical', estimatedCommission: 40_000 }),
      makeOpportunity({ id: 'NEGLECTED_HIGH_VALUE_LEAD:2', subjectRef: '2', priority: 'critical', estimatedCommission: 30_000 }),
      makeOpportunity({ id: 'NEGLECTED_HIGH_VALUE_LEAD:3', subjectRef: '3', priority: 'high', estimatedCommission: 20_000 }),
    ]
    const result = generateCopilot([], [], opps)
    expect(result.managerBrief.revenueAtRisk).toBe(70_000)
  })

  it('managerBrief.topPriority is non-empty string', () => {
    const contacts = makeOverdueLeads(1)
    const result = generateCopilot(contacts, [], [])
    expect(typeof result.managerBrief.topPriority).toBe('string')
    expect(result.managerBrief.topPriority.length).toBeGreaterThan(0)
  })

  it('managerBrief.whereToIntervene is array of max 3 deduplicated items', () => {
    const opps: Opportunity[] = [
      makeOpportunity({ id: 'opp1', subjectName: 'Imóvel A', priority: 'critical', estimatedCommission: 40_000 }),
      makeOpportunity({ id: 'opp2', subjectName: 'Imóvel B', priority: 'critical', estimatedCommission: 35_000 }),
      makeOpportunity({ id: 'opp3', subjectName: 'Imóvel C', priority: 'critical', estimatedCommission: 30_000 }),
      makeOpportunity({ id: 'opp4', subjectName: 'Imóvel D', priority: 'critical', estimatedCommission: 25_000 }),
    ]
    const result = generateCopilot([], [], opps)
    const { whereToIntervene } = result.managerBrief

    expect(Array.isArray(whereToIntervene)).toBe(true)
    expect(whereToIntervene.length).toBeLessThanOrEqual(3)

    // All items must be unique (deduplicated)
    const unique = new Set(whereToIntervene)
    expect(unique.size).toBe(whereToIntervene.length)
  })
})
