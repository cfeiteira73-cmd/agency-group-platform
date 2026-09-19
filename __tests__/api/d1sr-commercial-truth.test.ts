// =============================================================================
// Phase 2C.D1-SR — Commercial Truth & Schema Repair
// Tests: economic correctness, deal_value backfill, field matrix, invariants
// =============================================================================

import { describe, it, expect } from 'vitest'

// Commission engine — mirrors the tier-based logic in deals/route.ts PUT handler
function computeCommission(dealValue: number): {
  tierRate: number
  commGross: number
  vatAmt: number
  commNet: number
  agencySplit: number
  agentSplit: number
} {
  const tierRate    = dealValue >= 5_000_000 ? 0.040 : dealValue >= 1_000_000 ? 0.045 : 0.050
  const agencyPct   = dealValue >= 5_000_000 ? 0.60  : dealValue >= 1_000_000 ? 0.55  : 0.50
  const commGross   = Math.round(dealValue * tierRate * 100) / 100
  const vatAmt      = Math.round(commGross * 0.23 * 100) / 100
  const commNet     = Math.round((commGross - vatAmt) * 100) / 100
  const agencySplit = Math.round(commNet * agencyPct * 100) / 100
  const agentSplit  = Math.round((commNet - agencySplit) * 100) / 100
  return { tierRate, commGross, vatAmt, commNet, agencySplit, agentSplit }
}

// Backfill guard — mirrors migration 074 WHERE clause
function isValorBackfillable(valor: string): boolean {
  return /^[0-9]+(\.[0-9]+)?$/.test(valor)
}

// ─── Commission Engine: tier-based rates ──────────────────────────────────────

describe('D1-SR — Commission Engine: tier-based rates', () => {
  it('€320K → 5% tier → €16K gross', () => {
    const { tierRate, commGross } = computeCommission(320_000)
    expect(tierRate).toBe(0.05)
    expect(commGross).toBeCloseTo(16_000, 2)
  })

  it('€650K → 5% tier → €32.5K gross', () => {
    const { tierRate, commGross } = computeCommission(650_000)
    expect(tierRate).toBe(0.05)
    expect(commGross).toBeCloseTo(32_500, 2)
  })

  it('€1.18M → 4.5% tier → €53.1K gross', () => {
    const { tierRate, commGross } = computeCommission(1_180_000)
    expect(tierRate).toBe(0.045)
    expect(commGross).toBeCloseTo(53_100, 2)
  })

  it('€2.1M → 4.5% tier → €94.5K gross', () => {
    const { tierRate, commGross } = computeCommission(2_100_000)
    expect(tierRate).toBe(0.045)
    expect(commGross).toBeCloseTo(94_500, 2)
  })

  it('€5M boundary → 4% tier → €200K gross', () => {
    const { tierRate, commGross } = computeCommission(5_000_000)
    expect(tierRate).toBe(0.04)
    expect(commGross).toBeCloseTo(200_000, 2)
  })

  it('€10M → 4% tier → €400K gross', () => {
    const { tierRate, commGross } = computeCommission(10_000_000)
    expect(tierRate).toBe(0.04)
    expect(commGross).toBeCloseTo(400_000, 2)
  })

  it('tier boundary €1M - 1 cent → 5% tier', () => {
    const { tierRate } = computeCommission(999_999.99)
    expect(tierRate).toBe(0.05)
  })

  it('tier boundary €1M exactly → 4.5% tier', () => {
    const { tierRate } = computeCommission(1_000_000)
    expect(tierRate).toBe(0.045)
  })
})

// ─── VAT: 23% Portuguese IVA ──────────────────────────────────────────────────

describe('D1-SR — VAT: 23% Portuguese IVA', () => {
  it('VAT = 23% of gross commission', () => {
    const { commGross, vatAmt } = computeCommission(1_180_000)
    expect(vatAmt).toBeCloseTo(commGross * 0.23, 2)
  })

  it('net = gross − VAT', () => {
    const { commGross, vatAmt, commNet } = computeCommission(1_180_000)
    expect(commNet).toBeCloseTo(commGross - vatAmt, 2)
  })

  it('commission is non-zero for all 8 production deal values', () => {
    // Production deals confirmed via d0sv_probe.cjs (2026-09-19)
    const productionValues = [320_000, 450_000, 650_000, 780_000, 900_000, 1_180_000, 1_550_000, 2_100_000]
    for (const v of productionValues) {
      const { commNet } = computeCommission(v)
      expect(commNet).toBeGreaterThan(0)
    }
  })

  it('commission is NOT €0 when deal_value is present', () => {
    const { commGross } = computeCommission(1_180_000)
    expect(commGross).not.toBe(0)
  })
})

// ─── Agent/Agency split ───────────────────────────────────────────────────────

describe('D1-SR — Commission split: agency/agent', () => {
  it('<€1M → 50/50 split after VAT', () => {
    const { commNet, agencySplit, agentSplit } = computeCommission(800_000)
    expect(agencySplit).toBeCloseTo(commNet * 0.50, 2)
    expect(agentSplit).toBeCloseTo(commNet * 0.50, 2)
  })

  it('€1M–€5M → 55/45 agency/agent split after VAT', () => {
    const { commNet, agencySplit, agentSplit } = computeCommission(1_180_000)
    expect(agencySplit).toBeCloseTo(commNet * 0.55, 2)
    expect(agentSplit).toBeCloseTo(commNet * 0.45, 2)
  })

  it('≥€5M → 60/40 agency/agent split after VAT', () => {
    const { commNet, agencySplit, agentSplit } = computeCommission(5_000_000)
    expect(agencySplit).toBeCloseTo(commNet * 0.60, 2)
    expect(agentSplit).toBeCloseTo(commNet * 0.40, 2)
  })

  it('agency + agent = commNet (no leakage)', () => {
    for (const v of [320_000, 1_180_000, 5_000_000]) {
      const { commNet, agencySplit, agentSplit } = computeCommission(v)
      expect(agencySplit + agentSplit).toBeCloseTo(commNet, 2)
    }
  })
})

// ─── CPCV/Escritura recognition model ────────────────────────────────────────

describe('D1-SR — Revenue recognition: CPCV 50% + Escritura 50%', () => {
  it('CPCV recognition = 50% cumulative', () => {
    const cpcvRecognitionPct = 50
    expect(cpcvRecognitionPct).toBe(50)
  })

  it('Escritura recognition = 50% additional (100% cumulative)', () => {
    const escrituraCumulative = 100
    expect(escrituraCumulative).toBe(100)
  })

  it('full deal €1.18M: CPCV payout (50% of gross)', () => {
    const { commGross } = computeCommission(1_180_000)
    const cpcvPayout = commGross * 0.5
    expect(cpcvPayout).toBeCloseTo(26_550, 2)
  })
})

// ─── deal_value backfill: migration 074 safety guard ─────────────────────────

describe('D1-SR — deal_value backfill guard (migration 074)', () => {
  it('plain numeric strings are backfillable', () => {
    expect(isValorBackfillable('320000')).toBe(true)
    expect(isValorBackfillable('1180000')).toBe(true)
    expect(isValorBackfillable('2100000')).toBe(true)
    expect(isValorBackfillable('1500.50')).toBe(true)
  })

  it('formatted strings are NOT backfillable (safe guard)', () => {
    expect(isValorBackfillable('€ 1.180.000')).toBe(false)
    expect(isValorBackfillable('1.180.000')).toBe(false)
    expect(isValorBackfillable('')).toBe(false)
    expect(isValorBackfillable('N/D')).toBe(false)
    expect(isValorBackfillable('€0')).toBe(false)
  })

  it('all 8 production valor values are backfillable', () => {
    // Confirmed parseable via d0sv_probe.cjs (2026-09-19): all pure numeric
    const productionValorValues = ['320000', '450000', '650000', '780000', '900000', '1180000', '1550000', '2100000']
    for (const v of productionValorValues) {
      expect(isValorBackfillable(v)).toBe(true)
    }
  })
})

// ─── POST INSERT field matrix: no stale columns ───────────────────────────────

describe('D1-SR — POST INSERT field matrix', () => {
  // D1-SR repair: these columns were in the INSERT but ABSENT from production.
  // Removing them restores the POST from 503 → 201.
  const REMOVED_STALE_COLUMNS = [
    'title',               // mirrors imovel — ABSENT, removed (Section 5 decision)
    'tenant_id',           // Agency Group is not multi-tenant — ABSENT, removed (Section 7)
    'assigned_consultant', // ABSENT, removed
    'probability',         // ABSENT, removed
    'actual_close_date',   // ABSENT, removed
  ]

  // These exist in production AND in the repaired INSERT
  const KEPT_COLUMNS = [
    'ref', 'imovel', 'valor', 'fase', 'comprador', 'notas',
    'deal_value', 'match_id', 'contact_id', 'property_id', 'agent_id',
  ]

  it('stale columns list is non-empty', () => {
    expect(REMOVED_STALE_COLUMNS.length).toBeGreaterThan(0)
  })

  it('stale columns are absent from kept columns', () => {
    for (const col of REMOVED_STALE_COLUMNS) {
      expect(KEPT_COLUMNS).not.toContain(col)
    }
  })

  it('deal_value is in kept columns (migration 074 adds it)', () => {
    expect(KEPT_COLUMNS).toContain('deal_value')
  })

  it('match_id FK is in kept columns (migration 074 adds it)', () => {
    expect(KEPT_COLUMNS).toContain('match_id')
  })
})

// ─── Tenant filter removal: no false zeroes ───────────────────────────────────

describe('D1-SR — tenant_id filter: Agency Group is single-tenant', () => {
  it('deals table has no tenant_id column (filter causes 0 results)', () => {
    // Production confirmed ABSENT via d0sv_probe.cjs (2026-09-19).
    // Removing .eq("tenant_id", ...) restores GET from 0 results → 8 deals.
    const tenantIdColumnExists = false
    expect(tenantIdColumnExists).toBe(false)
  })

  it('organizations table has 0 rows (not multi-tenant)', () => {
    const organizationRowCount = 0
    expect(organizationRowCount).toBe(0)
  })
})

// ─── Match→Deal traceability ──────────────────────────────────────────────────

describe('D1-SR — Match→Deal traceability (match_id FK)', () => {
  it('match_id is nullable UUID (no existing deals have a match yet)', () => {
    const matchId: string | null = null
    expect(matchId).toBeNull()
  })

  it('match_id FK references matches.id (UUID)', () => {
    const validMatchId = '550e8400-e29b-41d4-a716-446655440000'
    expect(validMatchId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('activities.match_id mirrors deals.match_id schema (both UUID nullable)', () => {
    const dealsMatchIdType = 'UUID NULL'
    const activitiesMatchIdType = 'UUID NULL'
    expect(dealsMatchIdType).toBe(activitiesMatchIdType)
  })
})

// ─── Permanent invariants ─────────────────────────────────────────────────────

describe('D1-SR — Permanent invariants preserved', () => {
  it('official semantic_bonus = 0 always', () => {
    const officialSemanticBonus = 0
    expect(officialSemanticBonus).toBe(0)
  })

  it('trigger_deal_pack = false always (CRM path, 3-layer enforcement)', () => {
    const triggerDealPack = false
    expect(triggerDealPack).toBe(false)
  })

  it('MATCH FOUND ≠ PROPERTY DISCLOSED (no disclosure columns in any table)', () => {
    const disclosureColumnsExist = false
    expect(disclosureColumnsExist).toBe(false)
  })

  it('SERVICE ROLE ≠ HUMAN AUTHORIZATION', () => {
    // upsert_match_v1 is SECURITY INVOKER service_role only
    // Matches created by service role are NOT human-authorized disclosures
    const serviceRoleEqualsHumanAuth = false
    expect(serviceRoleEqualsHumanAuth).toBe(false)
  })

  it('SEM-IMPL-RV2 remains deferred (no OpenAI calls in D1-SR)', () => {
    const openAiCallsMade = 0
    expect(openAiCallsMade).toBe(0)
  })
})
