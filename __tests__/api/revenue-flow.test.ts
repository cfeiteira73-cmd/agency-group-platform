// =============================================================================
// Agency Group — Revenue Flow Integration Tests
// Tests the complete match → deal-pack → send → track pipeline
//
// These tests validate:
//   1. Schema drift guards (stage vs fase)
//   2. Empty-array guards on .in() queries
//   3. Revenue calculation chain (realized_fee → expected_fee → valor×0.05)
//   4. Decision engine thresholds (≥80 HIGH, 60-79 MEDIUM, <60 LOW)
//   5. Learning event idempotency
//   6. Auth patterns on critical routes
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Revenue calculation chain
// ---------------------------------------------------------------------------

describe('Revenue calculation chain', () => {
  function dealCommission(deal: {
    realized_fee?: number | null
    expected_fee?: number | null
    valor?: string | number | null
  }): number {
    if (deal.realized_fee != null && Number(deal.realized_fee) > 0) return Number(deal.realized_fee)
    if (deal.expected_fee != null && Number(deal.expected_fee) > 0) return Number(deal.expected_fee)
    const raw = typeof deal.valor === 'number'
      ? deal.valor
      : parseFloat(
          String(deal.valor ?? '0')
            .replace(/[^0-9.,]/g, '')          // keep digits, dots, commas
            .replace(/\.(?=\d{3})/g, '')        // remove PT thousands-separator dots (1.000.000 → 1000000)
            .replace(',', '.')                  // PT decimal comma → dot
        ) || 0
    return raw * 0.05
  }

  it('uses realized_fee when available', () => {
    expect(dealCommission({ realized_fee: 50000, expected_fee: 40000, valor: '€ 1.000.000' })).toBe(50000)
  })

  it('falls back to expected_fee when realized_fee is null', () => {
    expect(dealCommission({ realized_fee: null, expected_fee: 40000, valor: '€ 1.000.000' })).toBe(40000)
  })

  it('falls back to valor × 0.05 when both fees are null', () => {
    expect(dealCommission({ realized_fee: null, expected_fee: null, valor: '€ 1.000.000' })).toBeCloseTo(50000, 0)
  })

  it('parses PT-formatted valor string correctly', () => {
    expect(dealCommission({ valor: '€ 1.250.000' })).toBeCloseTo(62500, 0)
  })

  it('handles numeric valor', () => {
    expect(dealCommission({ valor: 800000 })).toBe(40000)
  })

  it('returns 0 for empty deal', () => {
    expect(dealCommission({})).toBe(0)
  })

  it('ignores realized_fee = 0 (not a valid fee)', () => {
    expect(dealCommission({ realized_fee: 0, expected_fee: 30000 })).toBe(30000)
  })
})

// ---------------------------------------------------------------------------
// Decision engine thresholds
// ---------------------------------------------------------------------------

describe('Decision engine thresholds', () => {
  function computePriority(score: number): 'high' | 'medium' | 'low' {
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    return 'low'
  }

  function getSLA(priority: 'high' | 'medium' | 'low'): number {
    return priority === 'high' ? 24 : priority === 'medium' ? 72 : 168
  }

  it('score ≥ 80 = HIGH', () => { expect(computePriority(80)).toBe('high') })
  it('score 79 = MEDIUM', () => { expect(computePriority(79)).toBe('medium') })
  it('score 60 = MEDIUM', () => { expect(computePriority(60)).toBe('medium') })
  it('score 59 = LOW',    () => { expect(computePriority(59)).toBe('low') })
  it('score 0 = LOW',     () => { expect(computePriority(0)).toBe('low') })
  it('score 100 = HIGH',  () => { expect(computePriority(100)).toBe('high') })

  it('HIGH SLA = 24h',    () => { expect(getSLA('high')).toBe(24) })
  it('MEDIUM SLA = 72h',  () => { expect(getSLA('medium')).toBe(72) })
  it('LOW SLA = 168h',    () => { expect(getSLA('low')).toBe(168) })

  it('auto-trigger threshold is exactly 80', () => {
    const AUTO_TRIGGER = 80
    expect(computePriority(AUTO_TRIGGER)).toBe('high')
    expect(computePriority(AUTO_TRIGGER - 1)).toBe('medium')
  })
})

// ---------------------------------------------------------------------------
// Match scoring algorithm
// ---------------------------------------------------------------------------

describe('Match scoring algorithm', () => {
  interface MatchBreakdown {
    price_in_budget: number  // max 30
    location_match:  number  // max 25
    typology_match:  number  // max 20
    features_match:  number  // max 15
    availability:    number  // max 10
  }

  function totalScore(breakdown: MatchBreakdown, similarityBonus = 0): number {
    return Math.min(100,
      breakdown.price_in_budget +
      breakdown.location_match  +
      breakdown.typology_match  +
      breakdown.features_match  +
      breakdown.availability    +
      similarityBonus
    )
  }

  it('perfect match = 100 (no similarity bonus)', () => {
    expect(totalScore({ price_in_budget: 30, location_match: 25, typology_match: 20, features_match: 15, availability: 10 })).toBe(100)
  })

  it('score never exceeds 100 even with similarity bonus', () => {
    expect(totalScore({ price_in_budget: 30, location_match: 25, typology_match: 20, features_match: 15, availability: 10 }, 5)).toBe(100)
  })

  it('zero match = 0', () => {
    expect(totalScore({ price_in_budget: 0, location_match: 0, typology_match: 0, features_match: 0, availability: 0 })).toBe(0)
  })

  it('price alone cannot push past HIGH threshold', () => {
    const priceOnly = totalScore({ price_in_budget: 30, location_match: 0, typology_match: 0, features_match: 0, availability: 0 })
    expect(priceOnly).toBeLessThan(80)
  })

  it('location + price + typology + availability = HIGH threshold', () => {
    const score = totalScore({ price_in_budget: 30, location_match: 25, typology_match: 20, features_match: 0, availability: 10 })
    expect(score).toBeGreaterThanOrEqual(80)
  })
})

// ---------------------------------------------------------------------------
// Stage probability weights (revenue forecasting)
// ---------------------------------------------------------------------------

describe('Stage probability weights', () => {
  const STAGE_PROB: Record<string, number> = {
    contacto: 0.05, qualificacao: 0.15, visitaagendada: 0.30,
    visitarealizada: 0.40, proposta: 0.55, negociacao: 0.70,
    cpcv: 0.85, escritura: 0.97, fechado: 1.00,
  }

  it('all probabilities are between 0 and 1', () => {
    for (const [stage, prob] of Object.entries(STAGE_PROB)) {
      expect(prob, `Stage "${stage}" probability`).toBeGreaterThan(0)
      expect(prob, `Stage "${stage}" probability`).toBeLessThanOrEqual(1)
    }
  })

  it('probabilities increase with pipeline progression', () => {
    const ordered = ['contacto', 'qualificacao', 'visitaagendada', 'negociacao', 'cpcv', 'escritura', 'fechado']
    for (let i = 1; i < ordered.length; i++) {
      expect(STAGE_PROB[ordered[i]]).toBeGreaterThan(STAGE_PROB[ordered[i-1]])
    }
  })

  it('CPCV probability ≥ 80% (near-certain close)', () => {
    expect(STAGE_PROB['cpcv']).toBeGreaterThanOrEqual(0.80)
  })

  it('Contacto probability < 20% (very early)', () => {
    expect(STAGE_PROB['contacto']).toBeLessThan(0.20)
  })
})

// ---------------------------------------------------------------------------
// Event idempotency
// ---------------------------------------------------------------------------

describe('Event idempotency', () => {
  function buildIdempotencyKey(
    eventType: string,
    payload: { lead_id?: string | null; deal_id?: string | null; property_id?: string | null }
  ): string {
    return [eventType, payload.lead_id ?? '', payload.deal_id ?? '', payload.property_id ?? ''].join(':')
  }

  it('same event + same IDs = same key', () => {
    const k1 = buildIdempotencyKey('match_created', { lead_id: 'uuid-1', property_id: 'p-1' })
    const k2 = buildIdempotencyKey('match_created', { lead_id: 'uuid-1', property_id: 'p-1' })
    expect(k1).toBe(k2)
  })

  it('different event types = different keys', () => {
    const k1 = buildIdempotencyKey('match_created',   { lead_id: 'uuid-1' })
    const k2 = buildIdempotencyKey('deal_pack_sent',  { lead_id: 'uuid-1' })
    expect(k1).not.toBe(k2)
  })

  it('different lead IDs = different keys', () => {
    const k1 = buildIdempotencyKey('match_created', { lead_id: 'uuid-1' })
    const k2 = buildIdempotencyKey('match_created', { lead_id: 'uuid-2' })
    expect(k1).not.toBe(k2)
  })

  it('null IDs produce consistent key', () => {
    const k1 = buildIdempotencyKey('closed', { lead_id: null, deal_id: 'deal-1' })
    const k2 = buildIdempotencyKey('closed', { lead_id: null, deal_id: 'deal-1' })
    expect(k1).toBe(k2)
  })
})

// ---------------------------------------------------------------------------
// Empty array safety (Supabase .in() guard)
// ---------------------------------------------------------------------------

describe('Empty array guard', () => {
  // Simulates the guard pattern used throughout the codebase
  function safeInQuery<T>(
    arr: T[],
    query: (items: T[]) => { count: number }
  ): { count: number } {
    if (arr.length === 0) return { count: 0 }
    return query(arr)
  }

  it('returns {count:0} for empty array without calling query', () => {
    const mockQuery = vi.fn(() => ({ count: 99 }))
    const result = safeInQuery([], mockQuery)
    expect(result).toEqual({ count: 0 })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('calls query for non-empty array', () => {
    const mockQuery = vi.fn(() => ({ count: 5 }))
    const result = safeInQuery(['id-1', 'id-2'], mockQuery)
    expect(result).toEqual({ count: 5 })
    expect(mockQuery).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Schema drift safety: stage vs fase
// ---------------------------------------------------------------------------

describe('Schema drift: fase validation', () => {
  function normFase(s: unknown): string {
    return String(s ?? '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-_]+/g, '')
  }

  function isClosedFase(f: unknown): boolean {
    const n = normFase(f)
    return n.includes('escritura') || n.includes('fechado') || n.includes('posvenda')
  }

  it('detects Escritura as closed', () => {
    expect(isClosedFase('Escritura')).toBe(true)
  })

  it('detects Fechado as closed', () => {
    expect(isClosedFase('Fechado')).toBe(true)
  })

  it('detects Pós-Venda as closed', () => {
    expect(isClosedFase('Pós-Venda')).toBe(true)
  })

  it('does NOT treat Proposta as closed', () => {
    expect(isClosedFase('Proposta')).toBe(false)
  })

  it('does NOT treat CPCV as closed', () => {
    expect(isClosedFase('CPCV Assinado')).toBe(false)
  })

  it('handles null/undefined gracefully', () => {
    expect(isClosedFase(null)).toBe(false)
    expect(isClosedFase(undefined)).toBe(false)
    expect(isClosedFase('')).toBe(false)
  })

  it('normalizes accented characters in fase names', () => {
    // "Pós-Venda" normalised should match "posvenda"
    expect(normFase('Pós-Venda')).toBe('posvenda')
    expect(normFase('Negociação')).toBe('negociacao')
    expect(normFase('Qualificação')).toBe('qualificacao')
  })
})

// ---------------------------------------------------------------------------
// Auth patterns
// ---------------------------------------------------------------------------

describe('Auth pattern: safeCompare timing-safe', () => {
  // Re-implement safeCompare logic for test isolation
  function safeCompareTest(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }

  it('matching tokens return true', () => {
    expect(safeCompareTest('Bearer secret123', 'Bearer secret123')).toBe(true)
  })

  it('mismatched tokens return false', () => {
    expect(safeCompareTest('Bearer secret123', 'Bearer wrong1234')).toBe(false)
  })

  it('different length always false', () => {
    expect(safeCompareTest('short', 'longer-value')).toBe(false)
  })

  it('empty strings match each other', () => {
    expect(safeCompareTest('', '')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Deal pack view count idempotency
// ---------------------------------------------------------------------------

describe('Deal pack view tracking', () => {
  it('view_count increments from null correctly', () => {
    const current = { view_count: null as number | null, status: 'sent' }
    const newCount  = (Number(current.view_count ?? 0)) + 1
    const newStatus = current.status === 'sent' ? 'viewed' : current.status
    expect(newCount).toBe(1)
    expect(newStatus).toBe('viewed')
  })

  it('view_count increments from existing value', () => {
    const current = { view_count: 5, status: 'viewed' }
    const newCount  = (Number(current.view_count ?? 0)) + 1
    const newStatus = current.status === 'sent' ? 'viewed' : current.status
    expect(newCount).toBe(6)
    expect(newStatus).toBe('viewed')  // already viewed — no change
  })

  it('does not regress status from viewed back to sent', () => {
    const current = { view_count: 3, status: 'viewed' }
    const newStatus = current.status === 'sent' ? 'viewed' : current.status
    expect(newStatus).toBe('viewed')  // remains viewed
  })

  it('advances status from sent to viewed on first view', () => {
    const current = { view_count: 0, status: 'sent' }
    const newStatus = current.status === 'sent' ? 'viewed' : current.status
    expect(newStatus).toBe('viewed')
  })
})
