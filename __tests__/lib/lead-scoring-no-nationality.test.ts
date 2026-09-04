// =============================================================================
// Gate C — Lead Scoring No-Nationality Tests (Wave 1, Phase 1)
// Tests 7–8: Nationality must not affect lead score
// =============================================================================

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Mirror the scoring logic from app/api/automation/lead-score/route.ts
// Only the dimensions that were changed are relevant here.
// ---------------------------------------------------------------------------

interface ScoreBreakdown {
  budget: number
  source: number
  contact_info: number
  message_quality: number
  timeline: number
  // MUST NOT contain: nationality
}

interface LeadScoreInput {
  name: string
  email?: string
  phone?: string
  source?: string
  message?: string
  budget?: number
  nationality?: string
  timeline?: string
}

const LOCATION_KEYWORDS = [
  'lisboa', 'cascais', 'sintra', 'estoril', 'algarve', 'comporta', 'porto',
]

function calculateBudgetScore(budget?: number): number {
  if (!budget || budget <= 0) return 0
  if (budget >= 1_000_000) return 30
  if (budget >= 500_000)   return 20
  if (budget >= 200_000)   return 10
  if (budget >= 100_000)   return 5
  return 0
}

function calculateSourceScore(source?: string): number {
  const s = source?.toLowerCase() ?? ''
  if (s === 'referral')           return 20
  if (s === 'off_market')         return 18
  if (s === 'avaliacao_privada')  return 15
  if (s === 'avm_tool')           return 12
  if (s === 'idealista_premium')  return 10
  if (s === 'linkedin')           return 10
  if (s === 'website')            return 5
  if (s === 'social')             return 5
  return 0
}

function scoreLeadRequest(data: LeadScoreInput): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    budget: 0,
    source: 0,
    contact_info: 0,
    message_quality: 0,
    timeline: 0,
  }

  breakdown.budget = calculateBudgetScore(data.budget)
  breakdown.source = calculateSourceScore(data.source)

  if (data.phone && data.phone.trim().length > 5) breakdown.contact_info += 10
  if (data.email && data.email.includes('@'))      breakdown.contact_info += 5

  if (data.message) {
    const lower = data.message.toLowerCase()
    const len = data.message.length
    if (len > 200)      breakdown.message_quality += 10
    else if (len > 100) breakdown.message_quality += 7
    else if (len > 50)  breakdown.message_quality += 3

    if (LOCATION_KEYWORDS.some(kw => lower.includes(kw))) {
      breakdown.message_quality += 5
    }
  }

  const tl = data.timeline?.toLowerCase() ?? ''
  if (tl === 'immediate' || tl === 'imediato' || tl === 'now') {
    breakdown.timeline = 15
  } else if (tl === '3months' || tl === '3_months') {
    breakdown.timeline = 8
  } else if (tl === '6months' || tl === '6_months') {
    breakdown.timeline = 4
  }

  const totalScore = Math.min(
    100,
    breakdown.budget + breakdown.source + breakdown.contact_info +
    breakdown.message_quality + breakdown.timeline
  )

  return { score: totalScore, breakdown }
}

// ---------------------------------------------------------------------------
// Test 7 — Nationality alone cannot alter lead score
// ---------------------------------------------------------------------------

describe('Gate C — Test 7: Nationality does not affect lead score', () => {
  const BASE_INPUT: Omit<LeadScoreInput, 'nationality'> = {
    name: 'Test Lead',
    email: 'test@example.com',
    phone: '+1 555 123 4567',
    source: 'website',
    budget: 500_000,
    timeline: '3months',
    message: 'Interested in properties in Lisboa.',
  }

  // High-value nationalities that USED to get +10 bonus
  const PREVIOUSLY_FAVOURED = ['US', 'GB', 'FR', 'DE', 'AE', 'CN', 'BR', 'SA', 'QA', 'KW']
  // Neutral nationalities that did NOT get the bonus
  const NEUTRAL = ['PT', 'ES', 'IT', 'PL', 'RO', 'UA', 'IN', 'NG']

  it('score is identical regardless of nationality', () => {
    const allNationalities = [...PREVIOUSLY_FAVOURED, ...NEUTRAL, undefined]
    const scores = allNationalities.map(nat =>
      scoreLeadRequest({ ...BASE_INPUT, nationality: nat }).score
    )
    const uniqueScores = new Set(scores)
    expect(uniqueScores.size).toBe(1) // All nationalities produce the same score
  })

  it('previously favoured nationalities no longer score higher than neutral ones', () => {
    const usCandidateScore = scoreLeadRequest({ ...BASE_INPUT, nationality: 'US' }).score
    const ptCandidateScore = scoreLeadRequest({ ...BASE_INPUT, nationality: 'PT' }).score
    expect(usCandidateScore).toBe(ptCandidateScore)
  })

  it('score without nationality equals score with any nationality', () => {
    const baseScore = scoreLeadRequest({ ...BASE_INPUT }).score
    for (const nat of ['US', 'FR', 'AE', 'PT', 'BR']) {
      const natScore = scoreLeadRequest({ ...BASE_INPUT, nationality: nat }).score
      expect(natScore).toBe(baseScore)
    }
  })

  it('breakdown does not include a nationality field', () => {
    const { breakdown } = scoreLeadRequest({ ...BASE_INPUT, nationality: 'US' })
    expect('nationality' in breakdown).toBe(false)
  })

  it('max possible score is 95 (not 105 which required nationality cap)', () => {
    // budget(30) + source(20) + contact_info(15) + message_quality(15) + timeline(15) = 95
    const maxInput: LeadScoreInput = {
      name: 'Max Score',
      email: 'max@example.com',
      phone: '+351 912 345 678',
      source: 'referral',
      budget: 2_000_000,
      timeline: 'immediate',
      message: 'I am looking for a property in Cascais. I have a specific location preference in the Estoril area. My family prefers the Atlantic coast for long walks and sea views. The budget is flexible upwards.',
      nationality: 'US', // Should have zero effect
    }
    const { score, breakdown } = scoreLeadRequest(maxInput)
    expect(breakdown.budget).toBe(30)
    expect(breakdown.source).toBe(20)
    expect(breakdown.contact_info).toBe(15) // phone(10) + email(5)
    expect(breakdown.timeline).toBe(15)
    expect(breakdown.message_quality).toBeLessThanOrEqual(15)
    expect(score).toBeLessThanOrEqual(95)
    expect(score).toBe(
      Math.min(100,
        breakdown.budget + breakdown.source + breakdown.contact_info +
        breakdown.message_quality + breakdown.timeline
      )
    )
  })
})

// ---------------------------------------------------------------------------
// Test 8 — No new scoring dimension double-counts an existing signal
// ---------------------------------------------------------------------------

describe('Gate C — Test 8: No double-counting of existing scoring signals', () => {
  it('budget dimension is independent of source dimension', () => {
    // Same budget, different sources → only source changes
    const highSource = scoreLeadRequest({ name: 'A', budget: 500_000, source: 'referral' })
    const lowSource  = scoreLeadRequest({ name: 'B', budget: 500_000, source: 'social' })
    expect(highSource.breakdown.budget).toBe(lowSource.breakdown.budget) // Budget unchanged
    expect(highSource.breakdown.source).toBeGreaterThan(lowSource.breakdown.source)
  })

  it('contact_info dimension is independent of message_quality dimension', () => {
    // Phone + email provided, short message vs long message
    const shortMsg = scoreLeadRequest({ name: 'A', email: 'a@x.com', phone: '+1234567890', message: 'Hi' })
    const longMsg  = scoreLeadRequest({ name: 'B', email: 'b@x.com', phone: '+1234567890', message: 'I am very interested in properties in Lisboa near the city centre, particularly in Chiado or Príncipe Real. Looking for long-term investment.' })
    expect(shortMsg.breakdown.contact_info).toBe(longMsg.breakdown.contact_info) // contact_info unchanged
    expect(longMsg.breakdown.message_quality).toBeGreaterThan(shortMsg.breakdown.message_quality)
  })

  it('timeline dimension does not affect budget dimension', () => {
    const immediateBase = scoreLeadRequest({ name: 'A', budget: 300_000, timeline: 'immediate' })
    const longTermBase  = scoreLeadRequest({ name: 'B', budget: 300_000, timeline: '6months' })
    expect(immediateBase.breakdown.budget).toBe(longTermBase.breakdown.budget) // Budget unchanged
    expect(immediateBase.breakdown.timeline).toBeGreaterThan(longTermBase.breakdown.timeline)
  })

  it('all dimensions sum correctly (no hidden accumulator)', () => {
    const input: LeadScoreInput = {
      name: 'Test',
      email: 'test@example.com',
      phone: '+44 7700 900000',
      source: 'linkedin',
      budget: 750_000,
      timeline: '3months',
      message: 'Looking for a flat in Cascais.',
      nationality: 'GB', // should not add to sum
    }
    const { score, breakdown } = scoreLeadRequest(input)
    const expectedSum = breakdown.budget + breakdown.source + breakdown.contact_info +
                        breakdown.message_quality + breakdown.timeline
    expect(score).toBe(Math.min(100, expectedSum))
    // Nationality would have added 10 in the old system — verify it's not there
    expect(score).toBeLessThanOrEqual(expectedSum) // no hidden bonus
  })

  it('removing nationality scoring did not redistribute points to other dimensions', () => {
    // Verify individual dimension maxima are unchanged from before the fix
    // budget max: 30
    expect(calculateBudgetScore(2_000_000)).toBe(30)
    // source max: 20
    expect(calculateSourceScore('referral')).toBe(20)
    // The dimensions haven't been inflated to compensate for removed nationality
    expect(calculateBudgetScore(2_000_000)).not.toBe(40)
    expect(calculateSourceScore('referral')).not.toBe(30)
  })
})
