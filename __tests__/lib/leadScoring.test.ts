import { describe, it, expect } from 'vitest'
import type { CRMContact } from '../../app/portal/components/types'
import {
  scoreLeadContact,
  scoreAllContacts,
  getUrgentLeads,
  getHighPriorityLeads,
  getStalledLeads,
} from '../../app/portal/lib/leadScoring'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString()
}

function daysFromNow(n: number): string {
  const d = new Date(Date.now() + n * 86400000)
  return d.toISOString()
}

function makeContact(overrides: Partial<CRMContact> = {}): CRMContact {
  return {
    id: 1,
    name: 'Test Contact',
    email: 'test@example.com',
    phone: '+351900000000',
    nationality: 'PT',
    budgetMin: 0,
    budgetMax: 0,
    tipos: [],
    zonas: [],
    status: 'lead',
    notes: '',
    lastContact: '',
    nextFollowUp: '',
    dealRef: '',
    origin: '',
    createdAt: daysAgo(10),
    activities: [],
    ...overrides,
  }
}

// ─── 1. Band Assignment ───────────────────────────────────────────────────────

describe('Band assignment', () => {
  it('assigns band A for score ≥ 75', () => {
    // vip(30) + budget≥2M(20) + today(20) + 10acts(15) + full profile(10) = 95
    const contact = makeContact({
      status: 'vip',
      budgetMax: 3_000_000,
      lastContact: daysAgo(0),
      activities: Array(10).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
      nextFollowUp: daysFromNow(3),
    })
    const result = scoreLeadContact(contact)
    expect(result.band).toBe('A')
    expect(result.score).toBeGreaterThanOrEqual(75)
  })

  it('assigns band B for score ≥ 55 and < 75', () => {
    // prospect(14) + 1M budget(16) + 7d recency(12) + 5 acts(12) + email+phone(4) = 58
    const contact = makeContact({
      status: 'prospect',
      budgetMax: 1_500_000,
      lastContact: daysAgo(6),
      activities: Array(5).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'b@b.com',
      phone: '456',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: daysFromNow(3),
    })
    const result = scoreLeadContact(contact)
    expect(result.band).toBe('B')
    expect(result.score).toBeGreaterThanOrEqual(55)
    expect(result.score).toBeLessThan(75)
  })

  it('assigns band C for score ≥ 35 and < 55', () => {
    // lead(6) + 500K budget(12) + 14d recency(7) + 3 acts(8) + email+phone(4) = 37
    const contact = makeContact({
      status: 'lead',
      budgetMax: 600_000,
      lastContact: daysAgo(10),
      activities: Array(3).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'c@c.com',
      phone: '789',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: '',
    })
    const result = scoreLeadContact(contact)
    expect(result.band).toBe('C')
    expect(result.score).toBeGreaterThanOrEqual(35)
    expect(result.score).toBeLessThan(55)
  })

  it('assigns band D for score < 35', () => {
    const contact = makeContact({
      status: 'lead',
      budgetMax: 0,
      lastContact: '',
      activities: [],
      email: '',
      phone: '',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: '',
    })
    const result = scoreLeadContact(contact)
    expect(result.band).toBe('D')
    expect(result.score).toBeLessThan(35)
  })
})

// ─── 2. Status Points ─────────────────────────────────────────────────────────

describe('Status scoring', () => {
  it('gives VIP 30 status points', () => {
    const base = makeContact({ status: 'vip' })
    const result = scoreLeadContact(base)
    expect(result.reasons.some(r => r.includes('VIP') && r.includes('30/30'))).toBe(true)
  })

  it('gives cliente 22 status points', () => {
    const result = scoreLeadContact(makeContact({ status: 'cliente' }))
    expect(result.reasons.some(r => r.includes('CLIENTE') && r.includes('22/30'))).toBe(true)
  })

  it('gives prospect 14 status points', () => {
    const result = scoreLeadContact(makeContact({ status: 'prospect' }))
    expect(result.reasons.some(r => r.includes('PROSPECT') && r.includes('14/30'))).toBe(true)
  })

  it('gives lead 6 status points', () => {
    const result = scoreLeadContact(makeContact({ status: 'lead' }))
    expect(result.reasons.some(r => r.includes('LEAD') && r.includes('6/30'))).toBe(true)
  })
})

// ─── 3. Budget Tiers ──────────────────────────────────────────────────────────

describe('Budget tiers', () => {
  it('gives 20pts for budget ≥ €2M', () => {
    const result = scoreLeadContact(makeContact({ budgetMax: 2_000_000 }))
    expect(result.reasons.some(r => r.includes('≥€2M') && r.includes('20/20'))).toBe(true)
  })

  it('gives 16pts for budget €1M–€2M', () => {
    const result = scoreLeadContact(makeContact({ budgetMax: 1_500_000 }))
    expect(result.reasons.some(r => r.includes('€1M-€2M') && r.includes('16/20'))).toBe(true)
  })

  it('gives 12pts for budget €500K–€1M', () => {
    const result = scoreLeadContact(makeContact({ budgetMax: 750_000 }))
    expect(result.reasons.some(r => r.includes('€500K-€1M') && r.includes('12/20'))).toBe(true)
  })

  it('gives 8pts for budget €200K–€500K', () => {
    const result = scoreLeadContact(makeContact({ budgetMax: 300_000 }))
    expect(result.reasons.some(r => r.includes('€200K-€500K') && r.includes('8/20'))).toBe(true)
  })

  it('gives 4pts for budget < €200K', () => {
    const result = scoreLeadContact(makeContact({ budgetMax: 100_000 }))
    expect(result.reasons.some(r => r.includes('<€200K') && r.includes('4/20'))).toBe(true)
  })

  it('gives 0pts for no budget set', () => {
    const result = scoreLeadContact(makeContact({ budgetMax: 0 }))
    expect(result.reasons.some(r => r.includes('Budget não especificado'))).toBe(true)
  })
})

// ─── 4. Recency Tiers ─────────────────────────────────────────────────────────

describe('Recency tiers', () => {
  it('gives 20pts when contacted today', () => {
    const result = scoreLeadContact(makeContact({ lastContact: daysAgo(0) }))
    expect(result.reasons.some(r => r.includes('Contactado hoje') && r.includes('20/20'))).toBe(true)
  })

  it('gives 16pts when contacted 3 days ago', () => {
    const result = scoreLeadContact(makeContact({ lastContact: daysAgo(3) }))
    expect(result.reasons.some(r => r.includes('16/20'))).toBe(true)
  })

  it('gives 12pts when contacted 7 days ago', () => {
    const result = scoreLeadContact(makeContact({ lastContact: daysAgo(7) }))
    expect(result.reasons.some(r => r.includes('12/20'))).toBe(true)
  })

  it('gives 7pts when contacted 14 days ago', () => {
    const result = scoreLeadContact(makeContact({ lastContact: daysAgo(14) }))
    expect(result.reasons.some(r => r.includes('7/20'))).toBe(true)
  })

  it('gives 3pts when contacted 30 days ago', () => {
    const result = scoreLeadContact(makeContact({ lastContact: daysAgo(30) }))
    expect(result.reasons.some(r => r.includes('3/20'))).toBe(true)
  })

  it('gives 0pts and penalty when contacted > 30 days ago', () => {
    const result = scoreLeadContact(makeContact({ lastContact: daysAgo(45) }))
    expect(result.reasons.some(r => r.includes('0/20'))).toBe(true)
    expect(result.penalties.some(r => r.includes('>30d'))).toBe(true)
  })
})

// ─── 5. Activity Depth Tiers ──────────────────────────────────────────────────

describe('Activity depth tiers', () => {
  it('gives 15pts for 10+ activities', () => {
    const contact = makeContact({
      activities: Array(10).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('15/15'))).toBe(true)
  })

  it('gives 12pts for 5–9 activities', () => {
    const contact = makeContact({
      activities: Array(5).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('12/15'))).toBe(true)
  })

  it('gives 8pts for 3–4 activities', () => {
    const contact = makeContact({
      activities: Array(3).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('8/15'))).toBe(true)
  })

  it('gives 4pts for 1–2 activities', () => {
    const contact = makeContact({
      activities: [{ id: 1, type: 'call', date: daysAgo(1), note: '' }],
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('4/15'))).toBe(true)
  })

  it('gives 0pts for no activities', () => {
    const result = scoreLeadContact(makeContact({ activities: [] }))
    expect(result.reasons.some(r => r.includes('Sem actividades registadas'))).toBe(true)
  })
})

// ─── 6. Profile Completeness ──────────────────────────────────────────────────

describe('Profile completeness', () => {
  it('gives 10pts for fully complete profile (email+phone+nationality+zonas+tipos)', () => {
    const contact = makeContact({
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('10/10'))).toBe(true)
  })

  it('gives 4pts for partial profile (email+phone only)', () => {
    const contact = makeContact({
      email: 'a@a.com',
      phone: '123',
      nationality: '',
      zonas: [],
      tipos: [],
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('4/10'))).toBe(true)
  })

  it('gives 0pts and incomplete reason for empty profile', () => {
    const contact = makeContact({
      email: '',
      phone: '',
      nationality: '',
      zonas: [],
      tipos: [],
    })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('Perfil incompleto'))).toBe(true)
  })
})

// ─── 7. Urgency Bonus ─────────────────────────────────────────────────────────

describe('Urgency bonus (follow-up)', () => {
  it('gives 5pts urgency for overdue follow-up', () => {
    const contact = makeContact({ nextFollowUp: daysAgo(2) })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('+5pts urgência'))).toBe(true)
  })

  it('gives 4pts urgency for follow-up today', () => {
    const contact = makeContact({ nextFollowUp: daysFromNow(0) })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('+4pts urgência'))).toBe(true)
  })

  it('gives 2pts urgency for follow-up within 7 days', () => {
    const contact = makeContact({ nextFollowUp: daysFromNow(5) })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('+2pts urgência'))).toBe(true)
  })

  it('gives no urgency pts for follow-up beyond 7 days', () => {
    const contact = makeContact({ nextFollowUp: daysFromNow(10) })
    const result = scoreLeadContact(contact)
    expect(result.reasons.some(r => r.includes('urgência'))).toBe(false)
  })
})

// ─── 8. Penalties ─────────────────────────────────────────────────────────────

describe('Penalties', () => {
  it('applies -10 penalty for >30d no contact', () => {
    const contact = makeContact({ lastContact: daysAgo(45), status: 'lead' })
    const noContact = makeContact({ lastContact: daysAgo(20), status: 'lead' })
    const withPenalty = scoreLeadContact(contact)
    const without = scoreLeadContact(noContact)
    // Score with >30d penalty should be lower by at least 10 (minus recency difference)
    expect(withPenalty.penalties.some(r => r.includes('>30d'))).toBe(true)
  })

  it('applies -5 penalty for vip with no activities', () => {
    const contact = makeContact({ status: 'vip', activities: [] })
    const result = scoreLeadContact(contact)
    expect(result.penalties.some(r => r.includes('VIP') && r.includes('actividades'))).toBe(true)
  })

  it('applies -5 penalty for prospect with no activities', () => {
    const contact = makeContact({ status: 'prospect', activities: [] })
    const result = scoreLeadContact(contact)
    expect(result.penalties.some(r => r.includes('PROSPECT') && r.includes('actividades'))).toBe(true)
  })

  it('does NOT apply no-activities penalty for lead status', () => {
    const contact = makeContact({ status: 'lead', activities: [] })
    const result = scoreLeadContact(contact)
    expect(result.penalties.some(r => r.includes('actividades'))).toBe(false)
  })

  it('applies -5 penalty for vip missing follow-up', () => {
    const contact = makeContact({ status: 'vip', nextFollowUp: '' })
    const result = scoreLeadContact(contact)
    expect(result.penalties.some(r => r.includes('VIP') && r.includes('follow-up'))).toBe(true)
  })

  it('applies -5 penalty for prospect missing follow-up', () => {
    const contact = makeContact({ status: 'prospect', nextFollowUp: '' })
    const result = scoreLeadContact(contact)
    expect(result.penalties.some(r => r.includes('PROSPECT') && r.includes('follow-up'))).toBe(true)
  })

  it('does NOT apply missing follow-up penalty for lead status', () => {
    const contact = makeContact({ status: 'lead', nextFollowUp: '' })
    const result = scoreLeadContact(contact)
    expect(result.penalties.some(r => r.includes('follow-up'))).toBe(false)
  })
})

// ─── 9. Score Caps ────────────────────────────────────────────────────────────

describe('Score capping', () => {
  it('caps score at 100', () => {
    const contact = makeContact({
      status: 'vip',
      budgetMax: 5_000_000,
      lastContact: daysAgo(0),
      activities: Array(15).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Moradia'],
      nextFollowUp: daysAgo(1),
    })
    const result = scoreLeadContact(contact)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('does not produce negative scores', () => {
    const contact = makeContact({
      status: 'vip',
      budgetMax: 0,
      lastContact: daysAgo(90),
      activities: [],
      email: '',
      phone: '',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: '',
    })
    const result = scoreLeadContact(contact)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})

// ─── 10. Confidence Levels ────────────────────────────────────────────────────

describe('Confidence levels', () => {
  it('returns high confidence when 4+ dimensions filled (≥ 0.8)', () => {
    // status + budget + recency + activity + completeness = 5 dimensions = 1.0
    const contact = makeContact({
      status: 'cliente',
      budgetMax: 1_000_000,
      lastContact: daysAgo(5),
      activities: [{ id: 1, type: 'call', date: daysAgo(1), note: '' }],
      email: 'a@a.com',
      phone: '123',
      nationality: '',
      zonas: [],
      tipos: [],
    })
    const result = scoreLeadContact(contact)
    expect(result.confidence).toBe('high')
    expect(result.dataCompleteness).toBeGreaterThanOrEqual(0.8)
  })

  it('returns medium confidence when 2–3 dimensions filled', () => {
    // status + recency only = 2/5 = 0.4
    const contact = makeContact({
      status: 'lead',
      budgetMax: 0,
      lastContact: daysAgo(5),
      activities: [],
      email: '',
      phone: '',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: '',
    })
    const result = scoreLeadContact(contact)
    expect(result.confidence).toBe('low')
    expect(result.dataCompleteness).toBeGreaterThanOrEqual(0.2)
    expect(result.dataCompleteness).toBeLessThan(0.5)
  })

  it('returns insufficient confidence when 0 dimensions filled', () => {
    const contact = makeContact({
      status: undefined as unknown as 'lead',
      budgetMax: 0,
      lastContact: '',
      activities: [],
      email: '',
      phone: '',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: '',
    })
    const result = scoreLeadContact(contact)
    expect(result.confidence).toBe('insufficient')
    expect(result.dataCompleteness).toBeLessThan(0.2)
  })
})

// ─── 11. recommendedNextAction ───────────────────────────────────────────────

describe('recommendedNextAction', () => {
  it('is always a non-empty string', () => {
    const contacts = [
      makeContact({ status: 'vip', budgetMax: 2_000_000, lastContact: daysAgo(0) }),
      makeContact({ status: 'lead' }),
      makeContact({ status: undefined as unknown as 'lead' }),
    ]
    contacts.forEach(c => {
      const result = scoreLeadContact(c)
      expect(typeof result.recommendedNextAction).toBe('string')
      expect(result.recommendedNextAction.length).toBeGreaterThan(0)
    })
  })

  it('recommends immediate contact for band A with overdue follow-up', () => {
    const contact = makeContact({
      status: 'vip',
      budgetMax: 2_000_000,
      lastContact: daysAgo(0),
      activities: Array(10).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
      nextFollowUp: daysAgo(3),
    })
    const result = scoreLeadContact(contact)
    expect(result.band).toBe('A')
    expect(result.recommendedNextAction).toContain('hoje')
  })
})

// ─── 12. scoreAllContacts — sorted by score desc ──────────────────────────────

describe('scoreAllContacts', () => {
  it('returns contacts sorted by score descending', () => {
    const contacts: CRMContact[] = [
      makeContact({ id: 1, status: 'lead', budgetMax: 0 }),
      makeContact({
        id: 2,
        status: 'vip',
        budgetMax: 3_000_000,
        lastContact: daysAgo(0),
        activities: Array(10).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
        email: 'a@a.com',
        phone: '123',
        nationality: 'PT',
        zonas: ['Lisboa'],
        tipos: ['Apartamento'],
        nextFollowUp: daysFromNow(2),
      }),
      makeContact({ id: 3, status: 'prospect', budgetMax: 500_000, lastContact: daysAgo(7) }),
    ]
    const scored = scoreAllContacts(contacts)
    expect(scored.length).toBe(3)
    for (let i = 0; i < scored.length - 1; i++) {
      expect(scored[i].scoring.score).toBeGreaterThanOrEqual(scored[i + 1].scoring.score)
    }
  })
})

// ─── 13. getUrgentLeads ───────────────────────────────────────────────────────

describe('getUrgentLeads', () => {
  it('only returns leads with overdue follow-up and score ≥ 35', () => {
    const highScoreOverdue = makeContact({
      id: 1,
      status: 'cliente',
      budgetMax: 1_000_000,
      lastContact: daysAgo(5),
      activities: Array(5).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
      nextFollowUp: daysAgo(2),
    })
    const lowScoreOverdue = makeContact({
      id: 2,
      status: 'lead',
      budgetMax: 0,
      lastContact: '',
      activities: [],
      email: '',
      phone: '',
      nationality: '',
      zonas: [],
      tipos: [],
      nextFollowUp: daysAgo(1),
    })
    const highScoreNoOverdue = makeContact({
      id: 3,
      status: 'cliente',
      budgetMax: 1_000_000,
      lastContact: daysAgo(5),
      activities: Array(5).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
      nextFollowUp: daysFromNow(3),
    })
    const scored = scoreAllContacts([highScoreOverdue, lowScoreOverdue, highScoreNoOverdue])
    const urgent = getUrgentLeads(scored)

    const urgentIds = urgent.map(s => s.contact.id)
    expect(urgentIds).toContain(1)
    expect(urgentIds).not.toContain(3)

    urgent.forEach(({ scoring }) => {
      expect(scoring.score).toBeGreaterThanOrEqual(35)
    })
  })
})

// ─── 14. getHighPriorityLeads ─────────────────────────────────────────────────

describe('getHighPriorityLeads', () => {
  it('returns only band A/B contacts with >7d no contact', () => {
    const bandAOldContact = makeContact({
      id: 1,
      status: 'vip',
      budgetMax: 3_000_000,
      lastContact: daysAgo(10),
      activities: Array(10).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
      nextFollowUp: daysFromNow(2),
    })
    const bandARecentContact = makeContact({
      id: 2,
      status: 'vip',
      budgetMax: 3_000_000,
      lastContact: daysAgo(2),
      activities: Array(10).fill({ id: 1, type: 'call', date: daysAgo(1), note: '' }),
      email: 'a@a.com',
      phone: '123',
      nationality: 'PT',
      zonas: ['Lisboa'],
      tipos: ['Apartamento'],
      nextFollowUp: daysFromNow(2),
    })
    const bandD = makeContact({
      id: 3,
      status: 'lead',
      budgetMax: 0,
      lastContact: daysAgo(45),
      activities: [],
    })

    const scored = scoreAllContacts([bandAOldContact, bandARecentContact, bandD])
    const highPriority = getHighPriorityLeads(scored)

    const ids = highPriority.map(s => s.contact.id)
    expect(ids).toContain(1)
    expect(ids).not.toContain(2)
    expect(ids).not.toContain(3)

    highPriority.forEach(({ scoring }) => {
      expect(['A', 'B']).toContain(scoring.band)
    })
  })
})

// ─── 15. getStalledLeads ──────────────────────────────────────────────────────

describe('getStalledLeads', () => {
  it('excludes cliente and vip, includes prospects/leads with >30d no contact', () => {
    const stalledProspect = makeContact({
      id: 1,
      status: 'prospect',
      lastContact: daysAgo(45),
    })
    const stalledLead = makeContact({
      id: 2,
      status: 'lead',
      lastContact: daysAgo(60),
    })
    const stalledCliente = makeContact({
      id: 3,
      status: 'cliente',
      lastContact: daysAgo(60),
    })
    const stalledVip = makeContact({
      id: 4,
      status: 'vip',
      lastContact: daysAgo(60),
    })
    const recentProspect = makeContact({
      id: 5,
      status: 'prospect',
      lastContact: daysAgo(5),
    })

    const scored = scoreAllContacts([stalledProspect, stalledLead, stalledCliente, stalledVip, recentProspect])
    const stalled = getStalledLeads(scored)

    const ids = stalled.map(s => s.contact.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2)
    expect(ids).not.toContain(3)
    expect(ids).not.toContain(4)
    expect(ids).not.toContain(5)
  })

  it('includes contacts with no lastContact date (unknown = treat as stalled)', () => {
    const unknownContact = makeContact({
      id: 10,
      status: 'lead',
      lastContact: '',
    })
    const scored = scoreAllContacts([unknownContact])
    const stalled = getStalledLeads(scored)
    expect(stalled.map(s => s.contact.id)).toContain(10)
  })
})
