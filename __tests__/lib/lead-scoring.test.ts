import { describe, it, expect } from 'vitest'

// ─── Lead scoring functions mirrored from app/portal/page.tsx ─────────────────
// computeLeadScore uses: status, lastContact, nextFollowUp, budgetMin, budgetMax

interface LeadContact {
  status: string
  lastContact: string
  nextFollowUp: string
  budgetMin: number
  budgetMax: number
}

function computeLeadScore(contact: LeadContact): {
  score: number
  label: string
  color: string
  breakdown: { factor: string; pts: number }[]
} {
  const breakdown: { factor: string; pts: number }[] = []
  let score = 0

  // Status score (0-35)
  const statusPts = contact.status === 'vip' ? 35
    : contact.status === 'cliente' ? 28
    : contact.status === 'prospect' ? 18
    : 8 // lead
  score += statusPts
  breakdown.push({ factor: `Status (${contact.status})`, pts: statusPts })

  // Recency score (0-30)
  const lastDate = new Date(contact.lastContact)
  const daysSince = Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)))
  const recencyPts = daysSince <= 1 ? 30
    : daysSince <= 7 ? 22
    : daysSince <= 30 ? 12
    : daysSince <= 90 ? 5
    : 0
  score += recencyPts
  breakdown.push({ factor: `Último contacto (${daysSince}d)`, pts: recencyPts })

  // Follow-up urgency (0-25)
  const followDate = new Date(contact.nextFollowUp)
  const daysUntil = Math.floor((followDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const followPts = daysUntil < 0 ? 25
    : daysUntil === 0 ? 22
    : daysUntil <= 3 ? 15
    : daysUntil <= 7 ? 8
    : 3
  score += followPts
  breakdown.push({ factor: `Follow-up (${daysUntil < 0 ? 'overdue' : daysUntil + 'd'})`, pts: followPts })

  // Budget alignment bonus (0-10)
  const midBudget = ((Number(contact.budgetMin) || 0) + (Number(contact.budgetMax) || 0)) / 2
  const budgetPts = midBudget >= 500000 ? 10
    : midBudget >= 300000 ? 6
    : 3
  score += budgetPts
  breakdown.push({ factor: `Budget (€${(midBudget / 1e6).toFixed(1)}M)`, pts: budgetPts })

  score = Math.min(100, score)
  const label = score >= 80 ? '🔥 Hot' : score >= 60 ? '⚡ Warm' : score >= 40 ? '📞 Active' : '💤 Cold'
  const color = score >= 80 ? '#e05454' : score >= 60 ? '#c9a96e' : score >= 40 ? '#4a9c7a' : 'rgba(14,14,13,.3)'
  return { score, label, color, breakdown }
}

// ─── Helper for recent dates ──────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ─── Status score tests ───────────────────────────────────────────────────────

describe('Lead Scoring — Status points', () => {
  it('vip status = 35 points', () => {
    const { breakdown } = computeLeadScore({
      status: 'vip',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 1000000,
      budgetMax: 2000000,
    })
    const statusFactor = breakdown.find(b => b.factor.includes('Status'))
    expect(statusFactor?.pts).toBe(35)
  })

  it('cliente status = 28 points', () => {
    const { breakdown } = computeLeadScore({
      status: 'cliente',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const statusFactor = breakdown.find(b => b.factor.includes('Status'))
    expect(statusFactor?.pts).toBe(28)
  })

  it('prospect status = 18 points', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const statusFactor = breakdown.find(b => b.factor.includes('Status'))
    expect(statusFactor?.pts).toBe(18)
  })

  it('lead status = 8 points', () => {
    const { breakdown } = computeLeadScore({
      status: 'lead',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 200000,
      budgetMax: 400000,
    })
    const statusFactor = breakdown.find(b => b.factor.includes('Status'))
    expect(statusFactor?.pts).toBe(8)
  })
})

// ─── Recency score tests ──────────────────────────────────────────────────────

describe('Lead Scoring — Recency points', () => {
  it('contacted today (0 days) = 30 recency points', () => {
    const { breakdown } = computeLeadScore({
      status: 'vip',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const recency = breakdown.find(b => b.factor.includes('contacto'))
    expect(recency?.pts).toBe(30)
  })

  it('contacted 1 day ago = 30 recency points', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(1),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const recency = breakdown.find(b => b.factor.includes('contacto'))
    expect(recency?.pts).toBe(30)
  })

  it('contacted 5 days ago = 22 recency points', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(5),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const recency = breakdown.find(b => b.factor.includes('contacto'))
    expect(recency?.pts).toBe(22)
  })

  it('contacted 15 days ago = 12 recency points', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(15),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const recency = breakdown.find(b => b.factor.includes('contacto'))
    expect(recency?.pts).toBe(12)
  })

  it('contacted 60 days ago = 5 recency points', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(60),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const recency = breakdown.find(b => b.factor.includes('contacto'))
    expect(recency?.pts).toBe(5)
  })

  it('contacted 100 days ago = 0 recency points', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(100),
      nextFollowUp: daysFromNow(5),
      budgetMin: 500000,
      budgetMax: 1000000,
    })
    const recency = breakdown.find(b => b.factor.includes('contacto'))
    expect(recency?.pts).toBe(0)
  })
})

// ─── Budget score tests ───────────────────────────────────────────────────────

describe('Lead Scoring — Budget points', () => {
  it('budget €2M+ midpoint = 10 points', () => {
    const { breakdown } = computeLeadScore({
      status: 'vip',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 1500000,
      budgetMax: 3000000,
    })
    const budgetFactor = breakdown.find(b => b.factor.includes('Budget'))
    // midBudget = (1500000+3000000)/2 = 2250000 >= 500000 → 10 pts
    expect(budgetFactor?.pts).toBe(10)
  })

  it('budget €1M-€2M midpoint = 10 points (>= €500K)', () => {
    const { breakdown } = computeLeadScore({
      status: 'cliente',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 800000,
      budgetMax: 1200000,
    })
    const budgetFactor = breakdown.find(b => b.factor.includes('Budget'))
    // midBudget = 1000000 >= 500000 → 10 pts
    expect(budgetFactor?.pts).toBe(10)
  })

  it('budget €500K-€1M midpoint = 10 points (>= €500K)', () => {
    const { breakdown } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 400000,
      budgetMax: 600000,
    })
    const budgetFactor = breakdown.find(b => b.factor.includes('Budget'))
    // midBudget = 500000 → exactly >= 500000 → 10 pts
    expect(budgetFactor?.pts).toBe(10)
  })

  it('budget midpoint €400K = 6 points (>= €300K but < €500K)', () => {
    const { breakdown } = computeLeadScore({
      status: 'lead',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 300000,
      budgetMax: 500000,
    })
    const budgetFactor = breakdown.find(b => b.factor.includes('Budget'))
    // midBudget = 400000 → >= 300000 but < 500000 → 6 pts
    expect(budgetFactor?.pts).toBe(6)
  })

  it('budget midpoint €150K = 3 points (< €300K)', () => {
    const { breakdown } = computeLeadScore({
      status: 'lead',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 100000,
      budgetMax: 200000,
    })
    const budgetFactor = breakdown.find(b => b.factor.includes('Budget'))
    // midBudget = 150000 → < 300000 → 3 pts
    expect(budgetFactor?.pts).toBe(3)
  })
})

// ─── Total score and capping ──────────────────────────────────────────────────

describe('Lead Scoring — Total score and label thresholds', () => {
  it('score is capped at 100', () => {
    // vip(35) + today(30) + overdue(25) + budget>=500K(10) = 100
    const { score } = computeLeadScore({
      status: 'vip',
      lastContact: daysAgo(0),
      nextFollowUp: daysAgo(5), // overdue
      budgetMin: 1000000,
      budgetMax: 2000000,
    })
    expect(score).toBe(100)
  })

  it('score >= 80 = Hot label', () => {
    const { label } = computeLeadScore({
      status: 'vip',
      lastContact: daysAgo(0),
      nextFollowUp: daysAgo(2),
      budgetMin: 1000000,
      budgetMax: 2000000,
    })
    expect(label).toBe('🔥 Hot')
  })

  it('score 60-79 = Warm label', () => {
    // prospect(18) + today(30) + 5days(8) + 500K+(10) = 66
    const { label, score } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(0),
      nextFollowUp: daysFromNow(5),
      budgetMin: 400000,
      budgetMax: 600000,
    })
    expect(score).toBeGreaterThanOrEqual(60)
    expect(score).toBeLessThan(80)
    expect(label).toBe('⚡ Warm')
  })

  it('score 40-59 = Active label', () => {
    // lead(8) + 15days(12) + 5days(8) + <300K(3) = 31 → Cold? Let's use better combo
    // prospect(18) + 15days(12) + 5days(8) + <300K(3) = 41
    const { label, score } = computeLeadScore({
      status: 'prospect',
      lastContact: daysAgo(15),
      nextFollowUp: daysFromNow(5),
      budgetMin: 100000,
      budgetMax: 200000,
    })
    expect(score).toBeGreaterThanOrEqual(40)
    expect(score).toBeLessThan(60)
    expect(label).toBe('📞 Active')
  })

  it('score < 40 = Cold label', () => {
    // lead(8) + 100days(0) + 10days(3) + <300K(3) = 14
    const { label, score } = computeLeadScore({
      status: 'lead',
      lastContact: daysAgo(100),
      nextFollowUp: daysFromNow(10),
      budgetMin: 50000,
      budgetMax: 150000,
    })
    expect(score).toBeLessThan(40)
    expect(label).toBe('💤 Cold')
  })

  it('score breakdown sums to total (before cap)', () => {
    const contact = {
      status: 'cliente',
      lastContact: daysAgo(5),
      nextFollowUp: daysFromNow(7),
      budgetMin: 800000,
      budgetMax: 1500000,
    }
    const { score, breakdown } = computeLeadScore(contact)
    const sumBreakdown = breakdown.reduce((s, b) => s + b.pts, 0)
    expect(score).toBe(Math.min(100, sumBreakdown))
  })

  it('color is red (#e05454) for Hot score', () => {
    const { color } = computeLeadScore({
      status: 'vip',
      lastContact: daysAgo(0),
      nextFollowUp: daysAgo(1),
      budgetMin: 2000000,
      budgetMax: 5000000,
    })
    expect(color).toBe('#e05454')
  })
})
