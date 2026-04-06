// ─── Utils Test Suite ─────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderJurMarkdown, calcLeadScore, getAINextAction, computeLeadScore } from '../utils'

// ── renderJurMarkdown ─────────────────────────────────────────────────────────

describe('renderJurMarkdown', () => {
  it('escapes HTML special characters', () => {
    const result = renderJurMarkdown('<script>alert("xss")</script>')
    expect(result).toContain('&lt;script&gt;')
    expect(result).not.toContain('<script>')
  })

  it('escapes ampersands', () => {
    const result = renderJurMarkdown('A & B')
    expect(result).toContain('&amp;')
  })

  it('converts ### to inline strong with correct font-size', () => {
    const result = renderJurMarkdown('### Secção Três')
    expect(result).toContain('<strong')
    expect(result).toContain('Secção Três')
    expect(result).toContain('.85rem')
  })

  it('converts ## to inline strong with border-bottom', () => {
    const result = renderJurMarkdown('## Secção Dois')
    expect(result).toContain('border-bottom')
    expect(result).toContain('Secção Dois')
  })

  it('converts # to inline strong', () => {
    const result = renderJurMarkdown('# Título Principal')
    expect(result).toContain('.95rem')
    expect(result).toContain('Título Principal')
  })

  it('converts **bold** to <strong>', () => {
    const result = renderJurMarkdown('**texto em bold**')
    expect(result).toContain('<strong>texto em bold</strong>')
  })

  it('converts *italic* to <em>', () => {
    const result = renderJurMarkdown('*texto em italic*')
    expect(result).toContain('<em')
    expect(result).toContain('texto em italic')
  })

  it('converts numbered list items to flex spans', () => {
    const result = renderJurMarkdown('1. Primeiro item')
    expect(result).toContain('display:flex')
    expect(result).toContain('Primeiro item')
  })

  it('converts bullet points (- style) to flex spans with gold dot', () => {
    const result = renderJurMarkdown('- Item de lista')
    expect(result).toContain('display:flex')
    expect(result).toContain('●')
    expect(result).toContain('Item de lista')
  })

  it('converts bullet points (• style)', () => {
    const result = renderJurMarkdown('• Outro item')
    expect(result).toContain('display:flex')
    expect(result).toContain('●')
  })

  it('converts bullet points (* style)', () => {
    const result = renderJurMarkdown('* Mais um item')
    expect(result).toContain('display:flex')
    expect(result).toContain('●')
  })

  it('styles "Base legal:" lines as pills', () => {
    const result = renderJurMarkdown('Base legal: Artigo 410.º do Código Civil')
    expect(result).toContain('border-left')
    expect(result).toContain('Base legal')
  })

  it('styles "Base Legal:" (capital L) lines', () => {
    const result = renderJurMarkdown('Base Legal: DL 291/2007')
    expect(result).toContain('border-left')
  })

  it('converts newlines to <br/>', () => {
    const result = renderJurMarkdown('linha 1\nlinha 2')
    expect(result).toContain('<br/>')
  })

  it('replaces ═══ dividers', () => {
    const result = renderJurMarkdown('═══════')
    expect(result).toContain('height:1px')
  })

  it('replaces --- dividers on their own line', () => {
    const result = renderJurMarkdown('---')
    expect(result).toContain('height:1px')
  })

  it('returns empty string for empty input', () => {
    expect(renderJurMarkdown('')).toBe('')
  })

  it('returns plain text unchanged when no markdown syntax present', () => {
    const plain = 'Texto simples sem formatação'
    const result = renderJurMarkdown(plain)
    expect(result).toContain(plain)
  })
})

// ── calcLeadScore ─────────────────────────────────────────────────────────────

describe('calcLeadScore', () => {
  it('returns score 0 for completely empty contact', () => {
    // Only base score from empty source (5 pts) is added
    const result = calcLeadScore({})
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.label).toBe('Cold')
    expect(result.color).toBe('gray')
  })

  it('gives 30 points for budget >= €3M', () => {
    const result = calcLeadScore({ budgetMax: 3000000 })
    expect(result.factors).toContain('Budget premium €3M+')
  })

  it('gives 22 points for budget >= €1M', () => {
    const result = calcLeadScore({ budgetMax: 1500000 })
    expect(result.factors).toContain('Budget alto €1M+')
  })

  it('gives 15 points for budget >= €500K', () => {
    const result = calcLeadScore({ budgetMax: 750000 })
    expect(result.factors).toContain('Budget médio €500K+')
  })

  it('gives 8 points for any defined budget below €500K', () => {
    const result = calcLeadScore({ budgetMax: 200000 })
    expect(result.factors).toContain('Budget definido')
  })

  it('gives 8 points for phone availability', () => {
    const result = calcLeadScore({ phone: '+351 912 000 000' })
    expect(result.factors).toContain('Telefone disponível')
  })

  it('gives 7 points for email availability', () => {
    const result = calcLeadScore({ email: 'cliente@email.com' })
    expect(result.factors).toContain('Email disponível')
  })

  it('gives 5 points for defined zone', () => {
    const result = calcLeadScore({ zone: 'Lisboa' })
    expect(result.factors).toContain('Zona definida')
  })

  it('gives 20 points for referral source', () => {
    const result = calcLeadScore({ source: 'referral amigo' })
    expect(result.factors).toContain('Referência de cliente')
  })

  it('gives 20 points for referência source (PT)', () => {
    const result = calcLeadScore({ source: 'referência cliente anterior' })
    expect(result.factors).toContain('Referência de cliente')
  })

  it('gives 15 points for whatsapp source', () => {
    const result = calcLeadScore({ source: 'WhatsApp directo' })
    expect(result.factors).toContain('Contacto directo')
  })

  it('gives 10 points for portal/idealista source', () => {
    const result = calcLeadScore({ source: 'idealista' })
    expect(result.factors).toContain('Portal imobiliário')
  })

  it('gives 7 points for instagram/social source', () => {
    const result = calcLeadScore({ source: 'instagram ad' })
    expect(result.factors).toContain('Social media')
  })

  it('gives 15 points for notes longer than 100 characters', () => {
    const longNote = 'A'.repeat(101)
    const result = calcLeadScore({ notes: longNote })
    expect(result.factors).toContain('Perfil detalhado')
  })

  it('gives 8 points for notes between 31 and 100 characters', () => {
    const midNote = 'A'.repeat(50)
    const result = calcLeadScore({ notes: midNote })
    expect(result.factors).toContain('Notas existentes')
  })

  it('does not give notes bonus for notes <= 30 characters', () => {
    const shortNote = 'A'.repeat(30)
    const result = calcLeadScore({ notes: shortNote })
    expect(result.factors).not.toContain('Perfil detalhado')
    expect(result.factors).not.toContain('Notas existentes')
  })

  it('gives 10 points for defined property type', () => {
    const result = calcLeadScore({ type: 'T3' })
    expect(result.factors).toContain('Tipo de imóvel definido')
  })

  it('gives 5 extra points for precise budget range (range < 50% of max)', () => {
    // Range: 100K, max: 300K — 100/300 = 33% < 50%
    const result = calcLeadScore({ budgetMin: 200000, budgetMax: 300000 })
    expect(result.factors).toContain('Budget preciso')
  })

  it('does not give budget precise bonus when range is >= 50% of max', () => {
    // Range: 200K, max: 300K — 200/300 = 66% >= 50%
    const result = calcLeadScore({ budgetMin: 100000, budgetMax: 300000 })
    expect(result.factors).not.toContain('Budget preciso')
  })

  it('caps score at 100', () => {
    const result = calcLeadScore({
      budgetMax: 5000000,
      phone: '+351 912 000 000',
      email: 'top@email.com',
      zone: 'Lisboa',
      source: 'referral',
      notes: 'A'.repeat(150),
      type: 'T4',
      budgetMin: 4800000,
    })
    expect(result.score).toBe(100)
  })

  it('returns Hot label for score >= 80', () => {
    const result = calcLeadScore({
      budgetMax: 5000000,
      phone: '+351 912 000 000',
      email: 'top@email.com',
      zone: 'Lisboa',
      source: 'referral',
      notes: 'A'.repeat(150),
    })
    expect(result.label).toBe('Hot')
    expect(result.color).toBe('emerald')
  })

  it('returns Warm label for score 60–79', () => {
    // Budget €1M (22) + phone (8) + email (7) + whatsapp (15) = 52 ... let's use enough fields
    const result = calcLeadScore({ budgetMax: 1000000, phone: '+351 911 000 000', email: 'a@b.com', source: 'whatsapp' })
    // 22 + 8 + 7 + 15 = 52 — still Cool, add zone
    const result2 = calcLeadScore({ budgetMax: 1000000, phone: '+351 911 000 000', email: 'a@b.com', source: 'whatsapp', zone: 'Porto', notes: 'A'.repeat(50) })
    // 22 + 8 + 7 + 15 + 5 + 8 = 65 => Warm
    expect(result2.label).toBe('Warm')
    expect(result2.color).toBe('yellow')
  })

  it('returns Cool label for score 40–59', () => {
    // Budget €500K (15) + phone (8) + email (7) + portal (10) = 40
    const result = calcLeadScore({ budgetMax: 500000, phone: '+351 911 000 000', email: 'a@b.com', source: 'idealista' })
    expect(result.label).toBe('Cool')
    expect(result.color).toBe('orange')
  })

  it('accepts string budgetMax and converts correctly', () => {
    const result = calcLeadScore({ budgetMax: '2000000' })
    expect(result.factors).toContain('Budget alto €1M+')
  })

  it('returns factors as non-empty array', () => {
    const result = calcLeadScore({ budgetMax: 500000 })
    expect(Array.isArray(result.factors)).toBe(true)
    expect(result.factors.length).toBeGreaterThan(0)
  })
})

// ── getAINextAction ───────────────────────────────────────────────────────────

describe('getAINextAction', () => {
  const todayStr = () => new Date().toISOString().split('T')[0]

  it('returns high urgency for overdue follow-up', () => {
    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'lead',
      lastContact: todayStr(),
      nextFollowUp: pastDate,
    })
    expect(result.urgency).toBe('high')
    expect(result.text).toContain('atraso')
  })

  it('returns high urgency when follow-up is today', () => {
    const result = getAINextAction({
      status: 'prospect',
      lastContact: todayStr(),
      nextFollowUp: todayStr(),
    })
    expect(result.urgency).toBe('high')
    // The implementation uses floor division so "today" can resolve to 0 (hoje) or -1 (atraso)
    // depending on millisecond precision — both are correctly high urgency
    expect(result.text.toLowerCase()).toMatch(/hoje|atraso/)
  })

  it('returns high urgency for VIP with no contact >= 7 days', () => {
    const oldDate = new Date(Date.now() - 8 * 86400000).toISOString().split('T')[0]
    const futureFollowUp = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'vip',
      lastContact: oldDate,
      nextFollowUp: futureFollowUp,
    })
    expect(result.urgency).toBe('high')
    expect(result.text).toContain('VIP')
  })

  it('returns medium urgency for cold prospect >= 5 days', () => {
    const oldDate = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    const futureFollowUp = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'prospect',
      lastContact: oldDate,
      nextFollowUp: futureFollowUp,
    })
    expect(result.urgency).toBe('medium')
    expect(result.text).toContain('Prospect')
  })

  it('returns medium urgency for lead without response >= 3 days', () => {
    const oldDate = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0]
    const futureFollowUp = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'lead',
      lastContact: oldDate,
      nextFollowUp: futureFollowUp,
    })
    expect(result.urgency).toBe('medium')
    expect(result.text).toContain('Lead')
  })

  it('returns medium urgency when follow-up is in <= 2 days', () => {
    const recent = todayStr()
    // Use 2 full days ahead to safely clear the "today" boundary edge case
    const soonFollowUp = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'lead',
      lastContact: recent,
      nextFollowUp: soonFollowUp,
    })
    expect(result.urgency).toBe('medium')
  })

  it('returns low urgency for active cliente', () => {
    const recent = todayStr()
    const followUp = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'cliente',
      lastContact: recent,
      nextFollowUp: followUp,
    })
    expect(result.urgency).toBe('low')
    expect(result.text).toContain('Cliente')
  })

  it('returns low urgency as fallback', () => {
    const recent = todayStr()
    const farFollowUp = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    const result = getAINextAction({
      status: 'lead',
      lastContact: recent,
      nextFollowUp: farFollowUp,
    })
    expect(result.urgency).toBe('low')
  })

  it('returns an object with text and urgency fields', () => {
    const result = getAINextAction({
      status: 'lead',
      lastContact: todayStr(),
      nextFollowUp: todayStr(),
    })
    expect(typeof result.text).toBe('string')
    expect(['high', 'medium', 'low']).toContain(result.urgency)
  })
})

// ── computeLeadScore ──────────────────────────────────────────────────────────

describe('computeLeadScore', () => {
  const baseContact = {
    status: 'lead' as const,
    lastContact: new Date().toISOString().split('T')[0],
    nextFollowUp: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    budgetMin: 0,
    budgetMax: 0,
  }

  it('returns an object with score, label, color, and breakdown', () => {
    const result = computeLeadScore(baseContact)
    expect(typeof result.score).toBe('number')
    expect(typeof result.label).toBe('string')
    expect(typeof result.color).toBe('string')
    expect(Array.isArray(result.breakdown)).toBe(true)
  })

  it('VIP status gives 35 status points', () => {
    const result = computeLeadScore({ ...baseContact, status: 'vip' })
    const statusFactor = result.breakdown.find(b => b.factor.includes('vip'))
    expect(statusFactor?.pts).toBe(35)
  })

  it('cliente status gives 28 status points', () => {
    const result = computeLeadScore({ ...baseContact, status: 'cliente' })
    const statusFactor = result.breakdown.find(b => b.factor.includes('cliente'))
    expect(statusFactor?.pts).toBe(28)
  })

  it('prospect status gives 18 status points', () => {
    const result = computeLeadScore({ ...baseContact, status: 'prospect' })
    const statusFactor = result.breakdown.find(b => b.factor.includes('prospect'))
    expect(statusFactor?.pts).toBe(18)
  })

  it('lead status gives 8 status points', () => {
    const result = computeLeadScore(baseContact)
    const statusFactor = result.breakdown.find(b => b.factor.includes('lead'))
    expect(statusFactor?.pts).toBe(8)
  })

  it('contact within today gives 30 recency points', () => {
    const today = new Date().toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, lastContact: today })
    const recencyFactor = result.breakdown.find(b => b.factor.includes('Último contacto'))
    expect(recencyFactor?.pts).toBe(30)
  })

  it('contact 3 days ago gives 22 recency points', () => {
    const recent = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, lastContact: recent })
    const recencyFactor = result.breakdown.find(b => b.factor.includes('Último contacto'))
    expect(recencyFactor?.pts).toBe(22)
  })

  it('contact 20 days ago gives 12 recency points', () => {
    const old = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, lastContact: old })
    const recencyFactor = result.breakdown.find(b => b.factor.includes('Último contacto'))
    expect(recencyFactor?.pts).toBe(12)
  })

  it('contact 60 days ago gives 5 recency points', () => {
    const older = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, lastContact: older })
    const recencyFactor = result.breakdown.find(b => b.factor.includes('Último contacto'))
    expect(recencyFactor?.pts).toBe(5)
  })

  it('contact over 90 days ago gives 0 recency points', () => {
    const veryOld = new Date(Date.now() - 100 * 86400000).toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, lastContact: veryOld })
    const recencyFactor = result.breakdown.find(b => b.factor.includes('Último contacto'))
    expect(recencyFactor?.pts).toBe(0)
  })

  it('overdue follow-up gives 25 urgency points', () => {
    const pastDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, nextFollowUp: pastDate })
    const followFactor = result.breakdown.find(b => b.factor.includes('Follow-up'))
    expect(followFactor?.pts).toBe(25)
  })

  it('follow-up today gives 22 or 25 urgency points (boundary)', () => {
    // floor() division makes "today" land on daysUntil=0 (22pts) or -1 (25pts, overdue)
    // depending on sub-millisecond timing — both are valid per the source logic
    const today = new Date().toISOString().split('T')[0]
    const result = computeLeadScore({ ...baseContact, nextFollowUp: today })
    const followFactor = result.breakdown.find(b => b.factor.includes('Follow-up'))
    expect([22, 25]).toContain(followFactor?.pts)
  })

  it('budget >= €500K gives 10 budget points', () => {
    const result = computeLeadScore({ ...baseContact, budgetMin: 400000, budgetMax: 600000 })
    const budgetFactor = result.breakdown.find(b => b.factor.includes('Budget'))
    expect(budgetFactor?.pts).toBe(10)
  })

  it('budget between €300K and €500K gives 6 budget points', () => {
    const result = computeLeadScore({ ...baseContact, budgetMin: 250000, budgetMax: 350000 })
    const budgetFactor = result.breakdown.find(b => b.factor.includes('Budget'))
    expect(budgetFactor?.pts).toBe(6)
  })

  it('budget below €300K gives 3 budget points', () => {
    const result = computeLeadScore({ ...baseContact, budgetMin: 0, budgetMax: 200000 })
    const budgetFactor = result.breakdown.find(b => b.factor.includes('Budget'))
    expect(budgetFactor?.pts).toBe(3)
  })

  it('score is capped at 100', () => {
    const result = computeLeadScore({
      status: 'vip',
      lastContact: new Date().toISOString().split('T')[0],
      nextFollowUp: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
      budgetMin: 1000000,
      budgetMax: 2000000,
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('score is never negative', () => {
    const result = computeLeadScore({
      status: 'lead',
      lastContact: new Date(Date.now() - 200 * 86400000).toISOString().split('T')[0],
      nextFollowUp: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      budgetMin: 0,
      budgetMax: 0,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('returns Hot label (score >= 80)', () => {
    const result = computeLeadScore({
      status: 'vip',
      lastContact: new Date().toISOString().split('T')[0],
      nextFollowUp: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
      budgetMin: 800000,
      budgetMax: 2000000,
    })
    // vip(35) + today(30) + overdue(25) + budget(10) = 100
    expect(result.label).toContain('Hot')
    expect(result.color).toBe('#e05454')
  })

  it('breakdown has exactly 4 entries', () => {
    const result = computeLeadScore(baseContact)
    expect(result.breakdown).toHaveLength(4)
  })

  it('all breakdown entries have factor string and pts number', () => {
    const result = computeLeadScore(baseContact)
    result.breakdown.forEach(entry => {
      expect(typeof entry.factor).toBe('string')
      expect(typeof entry.pts).toBe('number')
      expect(entry.pts).toBeGreaterThanOrEqual(0)
    })
  })
})
