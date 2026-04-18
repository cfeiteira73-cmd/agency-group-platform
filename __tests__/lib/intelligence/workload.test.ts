import { describe, it, expect } from 'vitest'
import { computeWorkload } from '../../../app/portal/lib/intelligence/workload'
import type { ScoredContact } from '../../../app/portal/lib/leadScoring'
import type { ScoredDeal } from '../../../app/portal/lib/dealScoring'
import type { AgentCopilotOutput } from '../../../app/portal/lib/intelligence/copilot'
import type { CRMContact, Deal } from '../../../app/portal/components/types'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
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
    lastContact: daysAgo(5),
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
      score: 50,
      band: 'B',
      bandLabel: 'Bom Prospecto',
      reasons: [],
      penalties: [],
      recommendedNextAction: 'Enviar conteúdo relevante ou nova proposta',
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
      closurePct: 55,
      reasons: [],
      dealRiskFlags: [],
      dealAccelerationActions: [],
      confidence: 'medium',
      ...scoringOverrides,
    },
  }
}

function makeEmptyCopilot(): AgentCopilotOutput {
  return {
    topLeadSuggestions: [],
    topDealSuggestions: [],
    managerBrief: {
      biggestRisk: 'Pipeline estável',
      whereToIntervene: [],
      topPriority: '',
      revenueAtRisk: 0,
    },
  }
}

const mockSuggestion = {
  headline: 'Test',
  why: 'test',
  action: 'test',
  urgency: 'immediate' as const,
  dataPoints: [] as string[],
  confidence: 'high' as const,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeWorkload', () => {

  it('1. Empty inputs → workloadScore = 0, workloadLabel = NORMAL, isOverloaded = false', () => {
    const result = computeWorkload([], [], makeEmptyCopilot())
    expect(result.workloadScore).toBe(0)
    expect(result.workloadLabel).toBe('NORMAL')
    expect(result.isOverloaded).toBe(false)
  })

  it('2. urgentLeadCount counts contacts where nextFollowUp is overdue AND score >= 35', () => {
    const contacts = [
      makeScoredContact({ nextFollowUp: daysAgo(2) }, { score: 50 }),
      makeScoredContact({ nextFollowUp: daysAgo(5) }, { score: 35 }),
      makeScoredContact({ nextFollowUp: daysFromNow(1) }, { score: 80 }), // not overdue
    ]
    const result = computeWorkload(contacts, [], makeEmptyCopilot())
    expect(result.urgentLeadCount).toBe(2)
  })

  it('3. urgentLeadCount does NOT count contacts with score < 35 even if overdue', () => {
    const contacts = [
      makeScoredContact({ nextFollowUp: daysAgo(3) }, { score: 34 }),
      makeScoredContact({ nextFollowUp: daysAgo(1) }, { score: 10 }),
    ]
    const result = computeWorkload(contacts, [], makeEmptyCopilot())
    expect(result.urgentLeadCount).toBe(0)
  })

  it('4. atRiskDealCount counts CRITICO and EM_RISCO health deals', () => {
    const deals = [
      makeScoredDeal({}, { dealHealth: 'CRITICO' }),
      makeScoredDeal({}, { dealHealth: 'EM_RISCO' }),
      makeScoredDeal({}, { dealHealth: 'MODERADO' }),
      makeScoredDeal({}, { dealHealth: 'SAUDAVEL' }),
    ]
    const result = computeWorkload([], deals, makeEmptyCopilot())
    expect(result.atRiskDealCount).toBe(2)
  })

  it('5. atRiskDealCount does NOT count Escritura Concluída deals', () => {
    const deals = [
      makeScoredDeal({ fase: 'Escritura Concluída' }, { dealHealth: 'CRITICO' }),
      makeScoredDeal({ fase: 'Escritura Concluída' }, { dealHealth: 'EM_RISCO' }),
    ]
    const result = computeWorkload([], deals, makeEmptyCopilot())
    expect(result.atRiskDealCount).toBe(0)
  })

  it('6. immediateActions counts copilot suggestions with urgency immediate', () => {
    const copilot: AgentCopilotOutput = {
      ...makeEmptyCopilot(),
      topLeadSuggestions: [
        { ...mockSuggestion, urgency: 'immediate' },
        { ...mockSuggestion, urgency: 'immediate' },
      ],
    }
    const result = computeWorkload([], [], copilot)
    expect(result.immediateActions).toBe(2)
  })

  it('7. immediateActions counts today urgency too (combined)', () => {
    const copilot: AgentCopilotOutput = {
      ...makeEmptyCopilot(),
      topLeadSuggestions: [
        { ...mockSuggestion, urgency: 'immediate' },
        { ...mockSuggestion, urgency: 'today' },
      ],
      topDealSuggestions: [
        { ...mockSuggestion, urgency: 'today' },
      ],
    }
    const result = computeWorkload([], [], copilot)
    expect(result.immediateActions).toBe(3)
  })

  it('8. immediateActions does NOT count this_week suggestions', () => {
    const copilot: AgentCopilotOutput = {
      ...makeEmptyCopilot(),
      topLeadSuggestions: [
        { ...mockSuggestion, urgency: 'this_week' },
        { ...mockSuggestion, urgency: 'this_week' },
      ],
    }
    const result = computeWorkload([], [], copilot)
    expect(result.immediateActions).toBe(0)
  })

  it('9. workloadScore formula: 1 urgent lead (×15) + 1 atRisk deal (×20) = 35 → ELEVADO', () => {
    const contacts = [makeScoredContact({ nextFollowUp: daysAgo(1) }, { score: 50 })]
    const deals = [makeScoredDeal({}, { dealHealth: 'CRITICO' })]
    const result = computeWorkload(contacts, deals, makeEmptyCopilot())
    expect(result.workloadScore).toBe(35)
    expect(result.workloadLabel).toBe('NORMAL') // 35 < 40, so NORMAL
  })

  it('10. workloadScore capped at 100', () => {
    // 7 urgent leads × 15 = 105, should cap at 100
    const contacts = Array.from({ length: 7 }, (_, i) =>
      makeScoredContact(
        { id: i + 1, nextFollowUp: daysAgo(i + 1) },
        { score: 80 },
      )
    )
    const result = computeWorkload(contacts, [], makeEmptyCopilot())
    expect(result.workloadScore).toBe(100)
  })

  it('11. workloadLabel = CRITICO when score >= 70', () => {
    // 3 urgent leads (45) + 2 atRisk deals (40) = 85 >= 70
    const contacts = Array.from({ length: 3 }, (_, i) =>
      makeScoredContact({ id: i + 1, nextFollowUp: daysAgo(i + 1) }, { score: 60 })
    )
    const deals = Array.from({ length: 2 }, (_, i) =>
      makeScoredDeal({ id: i + 1 }, { dealHealth: 'CRITICO' })
    )
    const result = computeWorkload(contacts, deals, makeEmptyCopilot())
    expect(result.workloadScore).toBeGreaterThanOrEqual(70)
    expect(result.workloadLabel).toBe('CRITICO')
  })

  it('12. workloadLabel = ELEVADO when score 40-69', () => {
    // 3 urgent leads × 15 = 45, falls in ELEVADO range
    const contacts = Array.from({ length: 3 }, (_, i) =>
      makeScoredContact({ id: i + 1, nextFollowUp: daysAgo(i + 1) }, { score: 60 })
    )
    const result = computeWorkload(contacts, [], makeEmptyCopilot())
    expect(result.workloadScore).toBe(45)
    expect(result.workloadLabel).toBe('ELEVADO')
  })

  it('13. isOverloaded = true when score >= 70', () => {
    // 5 urgent leads × 15 = 75 >= 70
    const contacts = Array.from({ length: 5 }, (_, i) =>
      makeScoredContact({ id: i + 1, nextFollowUp: daysAgo(i + 1) }, { score: 70 })
    )
    const result = computeWorkload(contacts, [], makeEmptyCopilot())
    expect(result.workloadScore).toBeGreaterThanOrEqual(70)
    expect(result.isOverloaded).toBe(true)
  })

  it('14. priorityQueue max 5 items', () => {
    // 10 overdue contacts should yield at most 5 queue items
    const contacts = Array.from({ length: 10 }, (_, i) =>
      makeScoredContact(
        { id: i + 1, name: `Contact ${i + 1}`, nextFollowUp: daysAgo(i + 1) },
        { score: 60 },
      )
    )
    const result = computeWorkload(contacts, [], makeEmptyCopilot())
    expect(result.priorityQueue.length).toBeLessThanOrEqual(5)
  })

  it('15. priorityQueue includes immediate copilot headlines first', () => {
    const copilot: AgentCopilotOutput = {
      ...makeEmptyCopilot(),
      topLeadSuggestions: [
        { ...mockSuggestion, headline: 'Urgent Lead A', urgency: 'immediate' },
      ],
      topDealSuggestions: [
        { ...mockSuggestion, headline: 'Urgent Deal B', urgency: 'immediate' },
      ],
    }
    const contacts = [
      makeScoredContact({ name: 'Late Contact', nextFollowUp: daysAgo(1) }, { score: 60 }),
    ]
    const result = computeWorkload(contacts, [], copilot)
    expect(result.priorityQueue[0]).toBe('Urgent Lead A')
    expect(result.priorityQueue[1]).toBe('Urgent Deal B')
  })

  it('16. priorityQueue deduplicates identical strings', () => {
    const copilot: AgentCopilotOutput = {
      ...makeEmptyCopilot(),
      topLeadSuggestions: [
        { ...mockSuggestion, headline: 'Same Headline', urgency: 'immediate' },
        { ...mockSuggestion, headline: 'Same Headline', urgency: 'immediate' },
      ],
    }
    const result = computeWorkload([], [], copilot)
    const count = result.priorityQueue.filter(item => item === 'Same Headline').length
    expect(count).toBe(1)
  })

})
