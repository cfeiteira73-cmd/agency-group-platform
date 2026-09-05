// =============================================================================
// Phase 2B.1 — Demand Mandate Schema Unit Tests
// vitest, jsdom environment, zero DB connections.
// Tests validate constraint semantics mirrored in mandateValidation.ts.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  validateCurrencyCode,
  validateBudget,
  validateTransactionMode,
  validatePurpose,
  validateLifecycleState,
  validateOrigin,
  validateHolderId,
  validateDemandMandate,
  validateLifecycleTransition,
  validateGeographyLevel,
  validateLocationMode,
  validatePreferenceWeight,
  validateConstraintType,
  validateBuyerMandateDetails,
  validateInvestorMandateDetails,
  validateHistoryChangeType,
  assertNoMatchEvent,
  isBudgetStated,
  isBudgetVerified,
  TRANSACTION_MODES,
  PURPOSES,
  LIFECYCLE_STATES,
  BUDGET_PROVENANCES,
  ORIGINS,
  GEOGRAPHY_LEVELS,
  HISTORY_CHANGE_TYPES,
} from '@/lib/crm/mandateValidation'

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001'
const VALID_UUID2 = '00000000-0000-4000-8000-000000000002'

function validMandateInput() {
  return {
    holder_contact_id: VALID_UUID,
    owner_id:          VALID_UUID2,
    transaction_mode:  'BUY',
    purpose:           'PRIMARY_RESIDENCE',
    lifecycle_state:   'DRAFT',
    currency_code:     'EUR',
    budget_provenance: 'AI_EXTRACTED',
    origin:            'AGENT_ENTRY',
  }
}

// =============================================================================
// 1. CURRENCY CODE
// =============================================================================

describe('validateCurrencyCode', () => {
  it('accepts EUR', () => expect(validateCurrencyCode('EUR').ok).toBe(true))
  it('accepts GBP', () => expect(validateCurrencyCode('GBP').ok).toBe(true))
  it('accepts USD', () => expect(validateCurrencyCode('USD').ok).toBe(true))
  it('accepts CHF', () => expect(validateCurrencyCode('CHF').ok).toBe(true))

  it('rejects lowercase', () => {
    const r = validateCurrencyCode('eur')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('3 uppercase letters')
  })

  it('rejects 2-letter code', () => expect(validateCurrencyCode('EU').ok).toBe(false))
  it('rejects 4-letter code', () => expect(validateCurrencyCode('EURO').ok).toBe(false))
  it('rejects numeric', ()    => expect(validateCurrencyCode('123').ok).toBe(false))
  it('rejects empty string',  () => expect(validateCurrencyCode('').ok).toBe(false))
  it('accepts undefined (nullable)', () => expect(validateCurrencyCode(undefined).ok).toBe(true))
  it('accepts null (nullable)',       () => expect(validateCurrencyCode(null).ok).toBe(true))
})

// =============================================================================
// 2. BUDGET VALIDATION
// =============================================================================

describe('validateBudget', () => {
  it('accepts null budget (no budget set)', () => {
    expect(validateBudget({ budget_min: null, budget_max: null, currency_code: 'EUR' }).ok).toBe(true)
  })

  it('accepts budget_min only', () => {
    expect(validateBudget({ budget_min: 100000, currency_code: 'EUR' }).ok).toBe(true)
  })

  it('accepts budget_max only', () => {
    expect(validateBudget({ budget_max: 500000, currency_code: 'EUR' }).ok).toBe(true)
  })

  it('accepts budget_min == budget_max (equality allowed)', () => {
    expect(validateBudget({ budget_min: 300000, budget_max: 300000, currency_code: 'EUR' }).ok).toBe(true)
  })

  it('accepts budget_min < budget_max (standard range)', () => {
    expect(validateBudget({ budget_min: 100000, budget_max: 3000000, currency_code: 'EUR' }).ok).toBe(true)
  })

  it('rejects budget_min > budget_max', () => {
    const r = validateBudget({ budget_min: 500000, budget_max: 100000, currency_code: 'EUR' })
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => e.includes('<= budget_max'))).toBe(true)
  })

  it('rejects negative budget_min', () => {
    const r = validateBudget({ budget_min: -1, currency_code: 'EUR' })
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => e.includes('>= 0'))).toBe(true)
  })

  it('rejects negative budget_max', () => {
    const r = validateBudget({ budget_max: -1, currency_code: 'EUR' })
    expect(r.ok).toBe(false)
  })

  it('rejects invalid provenance', () => {
    const r = validateBudget({
      budget_min: 100000, currency_code: 'EUR',
      budget_provenance: 'GUESSED',
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => e.includes('budget_provenance'))).toBe(true)
  })

  it('accepts all valid provenances', () => {
    for (const p of BUDGET_PROVENANCES) {
      expect(validateBudget({ currency_code: 'EUR', budget_provenance: p }).ok).toBe(true)
    }
  })

  it('rejects invalid currency_code', () => {
    const r = validateBudget({ budget_min: 100000, currency_code: 'eur' })
    expect(r.ok).toBe(false)
  })
})

// =============================================================================
// 3. COMPUTED FIELDS (mirror GENERATED ALWAYS AS)
// =============================================================================

describe('isBudgetStated', () => {
  it('returns true when budget_min is set', () => {
    expect(isBudgetStated({ budget_min: 100000 })).toBe(true)
  })
  it('returns true when budget_max is set', () => {
    expect(isBudgetStated({ budget_max: 500000 })).toBe(true)
  })
  it('returns true when both are set', () => {
    expect(isBudgetStated({ budget_min: 100000, budget_max: 500000 })).toBe(true)
  })
  it('returns false when neither is set', () => {
    expect(isBudgetStated({ budget_min: null, budget_max: null })).toBe(false)
  })
  it('returns false when both undefined', () => {
    expect(isBudgetStated({})).toBe(false)
  })
})

describe('isBudgetVerified', () => {
  it('returns true for AGENT_VERIFIED', () => {
    expect(isBudgetVerified({ budget_provenance: 'AGENT_VERIFIED' })).toBe(true)
  })
  it('returns false for USER_STATED', () => {
    expect(isBudgetVerified({ budget_provenance: 'USER_STATED' })).toBe(false)
  })
  it('returns false for AI_EXTRACTED', () => {
    expect(isBudgetVerified({ budget_provenance: 'AI_EXTRACTED' })).toBe(false)
  })
  it('returns false for INFERRED', () => {
    expect(isBudgetVerified({ budget_provenance: 'INFERRED' })).toBe(false)
  })
  it('returns false for undefined', () => {
    expect(isBudgetVerified({})).toBe(false)
  })
})

// =============================================================================
// 4. TRANSACTION MODE
// =============================================================================

describe('validateTransactionMode', () => {
  it.each(TRANSACTION_MODES as readonly string[])('accepts %s', (mode) => {
    expect(validateTransactionMode(mode).ok).toBe(true)
  })

  it('rejects LEASE (not a valid mode)', () => {
    expect(validateTransactionMode('LEASE').ok).toBe(false)
  })

  it('rejects lowercase rent', () => {
    expect(validateTransactionMode('rent').ok).toBe(false)
  })

  it('rejects null (required)', () => {
    expect(validateTransactionMode(null).ok).toBe(false)
  })

  it('rejects empty string (required)', () => {
    expect(validateTransactionMode('').ok).toBe(false)
  })
})

// =============================================================================
// 5. PURPOSE
// =============================================================================

describe('validatePurpose', () => {
  it.each(PURPOSES as readonly string[])('accepts %s', (purpose) => {
    expect(validatePurpose(purpose).ok).toBe(true)
  })

  it('rejects MATCHED (not a purpose)', () => {
    expect(validatePurpose('MATCHED').ok).toBe(false)
  })

  it('rejects null (required)', () => {
    expect(validatePurpose(null).ok).toBe(false)
  })
})

// =============================================================================
// 6. LIFECYCLE STATE
// =============================================================================

describe('validateLifecycleState', () => {
  it.each(LIFECYCLE_STATES as readonly string[])('accepts %s', (state) => {
    expect(validateLifecycleState(state).ok).toBe(true)
  })

  it('rejects MATCHED (Amendment 4 — not a lifecycle state)', () => {
    const r = validateLifecycleState('MATCHED')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('MATCHED')
  })

  it('rejects CLOSED (not a valid state)', () => {
    expect(validateLifecycleState('CLOSED').ok).toBe(false)
  })

  it('accepts undefined (defaults to DRAFT)', () => {
    expect(validateLifecycleState(undefined).ok).toBe(true)
  })
})

// =============================================================================
// 7. LIFECYCLE TRANSITIONS
// =============================================================================

describe('validateLifecycleTransition', () => {
  // Valid transitions
  it('DRAFT → ACTIVE', () => expect(validateLifecycleTransition('DRAFT', 'ACTIVE').ok).toBe(true))
  it('DRAFT → CANCELLED', () => expect(validateLifecycleTransition('DRAFT', 'CANCELLED').ok).toBe(true))
  it('ACTIVE → PAUSED', () => expect(validateLifecycleTransition('ACTIVE', 'PAUSED').ok).toBe(true))
  it('ACTIVE → COMPLETED', () => expect(validateLifecycleTransition('ACTIVE', 'COMPLETED').ok).toBe(true))
  it('ACTIVE → EXPIRED', () => expect(validateLifecycleTransition('ACTIVE', 'EXPIRED').ok).toBe(true))
  it('ACTIVE → CANCELLED', () => expect(validateLifecycleTransition('ACTIVE', 'CANCELLED').ok).toBe(true))
  it('PAUSED → ACTIVE', () => expect(validateLifecycleTransition('PAUSED', 'ACTIVE').ok).toBe(true))
  it('PAUSED → CANCELLED', () => expect(validateLifecycleTransition('PAUSED', 'CANCELLED').ok).toBe(true))
  it('PAUSED → EXPIRED', () => expect(validateLifecycleTransition('PAUSED', 'EXPIRED').ok).toBe(true))

  // Invalid transitions
  it('rejects DRAFT → COMPLETED (must activate first)', () => {
    expect(validateLifecycleTransition('DRAFT', 'COMPLETED').ok).toBe(false)
  })
  it('rejects DRAFT → EXPIRED', () => {
    expect(validateLifecycleTransition('DRAFT', 'EXPIRED').ok).toBe(false)
  })
  it('rejects DRAFT → PAUSED (must activate first)', () => {
    expect(validateLifecycleTransition('DRAFT', 'PAUSED').ok).toBe(false)
  })

  // Terminal states cannot transition
  it('COMPLETED is terminal — no transitions', () => {
    for (const to of LIFECYCLE_STATES) {
      expect(validateLifecycleTransition('COMPLETED', to).ok).toBe(false)
    }
  })
  it('EXPIRED is terminal — no transitions', () => {
    for (const to of LIFECYCLE_STATES) {
      expect(validateLifecycleTransition('EXPIRED', to).ok).toBe(false)
    }
  })
  it('CANCELLED is terminal — no transitions', () => {
    for (const to of LIFECYCLE_STATES) {
      expect(validateLifecycleTransition('CANCELLED', to).ok).toBe(false)
    }
  })

  // MATCHED must not appear
  it('rejects ACTIVE → MATCHED (not a state — Amendment 4)', () => {
    expect(validateLifecycleTransition('ACTIVE', 'MATCHED').ok).toBe(false)
  })
})

// =============================================================================
// 8. HOLDER CONTACT ID (Amendment 1: NOT NULL, person-only)
// =============================================================================

describe('validateHolderId', () => {
  it('accepts valid UUID', () => {
    expect(validateHolderId(VALID_UUID).ok).toBe(true)
  })

  it('rejects null (not nullable — Amendment 1)', () => {
    const r = validateHolderId(null)
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('Amendment 1')
  })

  it('rejects undefined', () => {
    expect(validateHolderId(undefined).ok).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateHolderId('').ok).toBe(false)
  })

  it('rejects non-UUID string', () => {
    expect(validateHolderId('not-a-uuid').ok).toBe(false)
  })
})

// =============================================================================
// 9. FULL MANDATE VALIDATION
// =============================================================================

describe('validateDemandMandate', () => {
  it('accepts complete valid mandate', () => {
    expect(validateDemandMandate(validMandateInput()).ok).toBe(true)
  })

  it('accepts investment mandate with budget range', () => {
    const r = validateDemandMandate({
      ...validMandateInput(),
      transaction_mode:  'BUY',
      purpose:           'INVESTMENT',
      budget_min:        500000,
      budget_max:        3000000,
      currency_code:     'EUR',
      budget_provenance: 'USER_STATED',
    })
    expect(r.ok).toBe(true)
  })

  it('accepts mandate with no budget (optional)', () => {
    const r = validateDemandMandate({
      ...validMandateInput(),
      budget_min: null,
      budget_max: null,
    })
    expect(r.ok).toBe(true)
  })

  it('accepts RENT transaction', () => {
    expect(validateDemandMandate({ ...validMandateInput(), transaction_mode: 'RENT' }).ok).toBe(true)
  })

  // Multiple active mandates per holder — no unique constraint on (holder, lifecycle)
  it('validates two mandates with same holder independently (no uniqueness violation)', () => {
    const m1 = validateDemandMandate({ ...validMandateInput(), purpose: 'PRIMARY_RESIDENCE' })
    const m2 = validateDemandMandate({ ...validMandateInput(), purpose: 'INVESTMENT' })
    expect(m1.ok).toBe(true)
    expect(m2.ok).toBe(true)
  })

  it('rejects missing holder_contact_id', () => {
    const r = validateDemandMandate({ ...validMandateInput(), holder_contact_id: '' })
    expect(r.ok).toBe(false)
  })

  it('rejects invalid transaction_mode', () => {
    const r = validateDemandMandate({ ...validMandateInput(), transaction_mode: 'SWAP' })
    expect(r.ok).toBe(false)
  })

  it('rejects invalid purpose', () => {
    const r = validateDemandMandate({ ...validMandateInput(), purpose: 'SPECULATION' })
    expect(r.ok).toBe(false)
  })

  it('rejects invalid lifecycle_state', () => {
    const r = validateDemandMandate({ ...validMandateInput(), lifecycle_state: 'MATCHED' })
    expect(r.ok).toBe(false)
  })

  it('rejects budget_min > budget_max', () => {
    const r = validateDemandMandate({
      ...validMandateInput(),
      budget_min: 2000000,
      budget_max: 500000,
    })
    expect(r.ok).toBe(false)
  })

  it('accumulates multiple errors', () => {
    const r = validateDemandMandate({
      holder_contact_id: '',
      owner_id:          '',
      transaction_mode:  'INVALID',
      purpose:           'INVALID',
    })
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThan(1)
  })
})

// =============================================================================
// 10. GEOGRAPHY
// =============================================================================

describe('validateGeographyLevel', () => {
  it.each(GEOGRAPHY_LEVELS as readonly string[])('accepts %s', (level) => {
    expect(validateGeographyLevel(level).ok).toBe(true)
  })

  it('rejects REGION (not a valid level)', () => {
    expect(validateGeographyLevel('REGION').ok).toBe(false)
  })

  it('rejects null (required)', () => {
    expect(validateGeographyLevel(null).ok).toBe(false)
  })
})

describe('validateLocationMode', () => {
  it('accepts INCLUDE', () => expect(validateLocationMode('INCLUDE').ok).toBe(true))
  it('accepts EXCLUDE', () => expect(validateLocationMode('EXCLUDE').ok).toBe(true))
  it('accepts undefined (default INCLUDE)', () => expect(validateLocationMode(undefined).ok).toBe(true))
  it('rejects NEUTRAL', () => expect(validateLocationMode('NEUTRAL').ok).toBe(false))
})

describe('validatePreferenceWeight', () => {
  it('accepts 0',   () => expect(validatePreferenceWeight(0).ok).toBe(true))
  it('accepts 50',  () => expect(validatePreferenceWeight(50).ok).toBe(true))
  it('accepts 100', () => expect(validatePreferenceWeight(100).ok).toBe(true))
  it('accepts null (default 50)', () => expect(validatePreferenceWeight(null).ok).toBe(true))
  it('rejects -1',   () => expect(validatePreferenceWeight(-1).ok).toBe(false))
  it('rejects 101',  () => expect(validatePreferenceWeight(101).ok).toBe(false))
  it('rejects 50.5 (not integer)', () => expect(validatePreferenceWeight(50.5).ok).toBe(false))
})

// =============================================================================
// 11. CRITERIA
// =============================================================================

describe('validateConstraintType', () => {
  it('accepts HARD',        () => expect(validateConstraintType('HARD').ok).toBe(true))
  it('accepts PREFERENCE',  () => expect(validateConstraintType('PREFERENCE').ok).toBe(true))
  it('accepts EXCLUSION',   () => expect(validateConstraintType('EXCLUSION').ok).toBe(true))
  it('rejects OPTIONAL',    () => expect(validateConstraintType('OPTIONAL').ok).toBe(false))
  it('rejects null',        () => expect(validateConstraintType(null).ok).toBe(false))
})

// =============================================================================
// 12. BUYER MANDATE DETAILS
// =============================================================================

describe('validateBuyerMandateDetails', () => {
  it('accepts minimal (all optional)', () => {
    expect(validateBuyerMandateDetails({}).ok).toBe(true)
  })

  it('accepts valid bedroom range', () => {
    expect(validateBuyerMandateDetails({ bedrooms_min: 2, bedrooms_max: 4 }).ok).toBe(true)
  })

  it('accepts bedrooms_min == bedrooms_max', () => {
    expect(validateBuyerMandateDetails({ bedrooms_min: 3, bedrooms_max: 3 }).ok).toBe(true)
  })

  it('rejects bedrooms_min > bedrooms_max', () => {
    const r = validateBuyerMandateDetails({ bedrooms_min: 5, bedrooms_max: 2 })
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('bedrooms_min')
  })

  it('accepts valid area range', () => {
    expect(validateBuyerMandateDetails({ area_min_m2: 80, area_max_m2: 200 }).ok).toBe(true)
  })

  it('rejects area_min_m2 > area_max_m2', () => {
    expect(validateBuyerMandateDetails({ area_min_m2: 300, area_max_m2: 100 }).ok).toBe(false)
  })

  it('rejects negative area_min_m2', () => {
    expect(validateBuyerMandateDetails({ area_min_m2: -5 }).ok).toBe(false)
  })

  it('accepts all valid financing types', () => {
    for (const ft of ['CASH', 'MORTGAGE', 'MIXED', 'UNKNOWN'] as const) {
      expect(validateBuyerMandateDetails({ financing_type: ft }).ok).toBe(true)
    }
  })

  it('rejects invalid financing type', () => {
    expect(validateBuyerMandateDetails({ financing_type: 'BARTER' }).ok).toBe(false)
  })

  it('accepts all valid timelines', () => {
    for (const t of ['IMMEDIATE', '3_MONTHS', '6_MONTHS', '1_YEAR', 'FLEXIBLE', 'UNKNOWN'] as const) {
      expect(validateBuyerMandateDetails({ timeline: t }).ok).toBe(true)
    }
  })

  it('rejects invalid timeline', () => {
    expect(validateBuyerMandateDetails({ timeline: 'ASAP' }).ok).toBe(false)
  })

  it('accepts all valid proof_of_funds values', () => {
    for (const pof of ['NONE', 'STATED', 'DOCUMENT_SEEN', 'VERIFIED'] as const) {
      expect(validateBuyerMandateDetails({ proof_of_funds: pof }).ok).toBe(true)
    }
  })

  it('rejects invalid proof_of_funds', () => {
    expect(validateBuyerMandateDetails({ proof_of_funds: 'PARTIALLY' }).ok).toBe(false)
  })
})

// =============================================================================
// 13. INVESTOR MANDATE DETAILS
// =============================================================================

describe('validateInvestorMandateDetails', () => {
  it('accepts empty (all optional)', () => {
    expect(validateInvestorMandateDetails({}).ok).toBe(true)
  })

  it('accepts valid yield range', () => {
    expect(validateInvestorMandateDetails({
      target_yield_min_pct: 4.0,
      target_yield_max_pct: 7.0,
    }).ok).toBe(true)
  })

  it('rejects negative yield_min', () => {
    expect(validateInvestorMandateDetails({ target_yield_min_pct: -1 }).ok).toBe(false)
  })

  it('rejects yield_min > yield_max', () => {
    expect(validateInvestorMandateDetails({
      target_yield_min_pct: 8,
      target_yield_max_pct: 5,
    }).ok).toBe(false)
  })

  it('accepts valid ticket range', () => {
    expect(validateInvestorMandateDetails({
      ticket_min: 500000,
      ticket_max: 5000000,
      ticket_currency_code: 'EUR',
    }).ok).toBe(true)
  })

  it('rejects ticket_min > ticket_max', () => {
    expect(validateInvestorMandateDetails({
      ticket_min: 3000000,
      ticket_max: 500000,
    }).ok).toBe(false)
  })

  it('rejects invalid ticket_currency_code', () => {
    expect(validateInvestorMandateDetails({ ticket_currency_code: 'euro' }).ok).toBe(false)
  })

  it('accepts all valid risk_tolerance values', () => {
    for (const rt of ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const) {
      expect(validateInvestorMandateDetails({ risk_tolerance: rt }).ok).toBe(true)
    }
  })

  it('rejects invalid risk_tolerance', () => {
    expect(validateInvestorMandateDetails({ risk_tolerance: 'SPECULATIVE' }).ok).toBe(false)
  })
})

// =============================================================================
// 14. HISTORY CHANGE TYPES (Amendment 4)
// =============================================================================

describe('validateHistoryChangeType', () => {
  it.each(HISTORY_CHANGE_TYPES as readonly string[])('accepts %s', (ct) => {
    expect(validateHistoryChangeType(ct).ok).toBe(true)
  })

  it('rejects null (required)', () => {
    expect(validateHistoryChangeType(null).ok).toBe(false)
  })

  it('rejects MATCH_EVENT explicitly', () => {
    const r = validateHistoryChangeType('MATCH_EVENT')
    expect(r.ok).toBe(false)
  })
})

describe('assertNoMatchEvent (Amendment 4)', () => {
  it('rejects MATCH_EVENT with informative message', () => {
    const r = assertNoMatchEvent('MATCH_EVENT')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('demand_mandate_matches')
    expect(r.errors[0]).toContain('Phase 2C+')
  })

  it('accepts any non-MATCH_EVENT value', () => {
    expect(assertNoMatchEvent('LIFECYCLE_CHANGE').ok).toBe(true)
    expect(assertNoMatchEvent('BUDGET_VERIFIED').ok).toBe(true)
    expect(assertNoMatchEvent('CREATED').ok).toBe(true)
  })
})

// =============================================================================
// 15. ENUM COVERAGE — all enums are exhaustively tested
// =============================================================================

describe('enum completeness', () => {
  it('TRANSACTION_MODES covers BUY and RENT only', () => {
    expect(TRANSACTION_MODES).toHaveLength(2)
    expect(TRANSACTION_MODES).toContain('BUY')
    expect(TRANSACTION_MODES).toContain('RENT')
  })

  it('PURPOSES covers 6 values including INVESTMENT and DEVELOPMENT', () => {
    expect(PURPOSES).toHaveLength(6)
    expect(PURPOSES).toContain('INVESTMENT')
    expect(PURPOSES).toContain('DEVELOPMENT')
    expect(PURPOSES).toContain('OTHER')
  })

  it('LIFECYCLE_STATES does not contain MATCHED', () => {
    expect(LIFECYCLE_STATES).not.toContain('MATCHED')
  })

  it('LIFECYCLE_STATES has 6 states', () => {
    expect(LIFECYCLE_STATES).toHaveLength(6)
  })

  it('ORIGINS does not auto-backfill from legacy systems', () => {
    // If LEGACY_BACKFILL were added as origin it would violate Amendment 3
    expect(ORIGINS).not.toContain('LEGACY_BACKFILL')
  })

  it('GEOGRAPHY_LEVELS includes PARISH and ZONE (schema-ready, not seeded)', () => {
    expect(GEOGRAPHY_LEVELS).toContain('PARISH')
    expect(GEOGRAPHY_LEVELS).toContain('ZONE')
  })

  it('HISTORY_CHANGE_TYPES does not contain MATCH_EVENT', () => {
    expect(HISTORY_CHANGE_TYPES).not.toContain('MATCH_EVENT')
  })
})

// =============================================================================
// 16. ORIGIN VALIDATION
// =============================================================================

describe('validateOrigin', () => {
  it('accepts CONTACT_FORM', () => expect(validateOrigin('CONTACT_FORM').ok).toBe(true))
  it('accepts SOFIA_DRAFT',  () => expect(validateOrigin('SOFIA_DRAFT').ok).toBe(true))
  it('accepts AGENT_ENTRY',  () => expect(validateOrigin('AGENT_ENTRY').ok).toBe(true))
  it('accepts IMPORT',       () => expect(validateOrigin('IMPORT').ok).toBe(true))
  it('accepts SAVED_SEARCH', () => expect(validateOrigin('SAVED_SEARCH').ok).toBe(true))
  it('accepts undefined (default AGENT_ENTRY)', () => expect(validateOrigin(undefined).ok).toBe(true))
  it('rejects LEGACY_BACKFILL (no backfill allowed)', () => {
    expect(validateOrigin('LEGACY_BACKFILL').ok).toBe(false)
  })
})

// =============================================================================
// 17. MULTIPLE ACTIVE MANDATES PER CONTACT (no unique constraint violation)
// =============================================================================

describe('multiple active mandates per contact', () => {
  it('same holder can have BUY+INVESTMENT mandate (distinct purpose)', () => {
    const holderId = VALID_UUID
    const m1 = validateDemandMandate({
      holder_contact_id: holderId,
      owner_id:          VALID_UUID2,
      transaction_mode:  'BUY',
      purpose:           'PRIMARY_RESIDENCE',
    })
    const m2 = validateDemandMandate({
      holder_contact_id: holderId,
      owner_id:          VALID_UUID2,
      transaction_mode:  'BUY',
      purpose:           'INVESTMENT',
    })
    expect(m1.ok).toBe(true)
    expect(m2.ok).toBe(true)
  })

  it('same holder can have BUY+RENT mandates simultaneously', () => {
    const holderId = VALID_UUID
    const m1 = validateDemandMandate({
      holder_contact_id: holderId,
      owner_id:          VALID_UUID2,
      transaction_mode:  'BUY',
      purpose:           'HOLIDAY',
    })
    const m2 = validateDemandMandate({
      holder_contact_id: holderId,
      owner_id:          VALID_UUID2,
      transaction_mode:  'RENT',
      purpose:           'PRIMARY_RESIDENCE',
    })
    expect(m1.ok).toBe(true)
    expect(m2.ok).toBe(true)
  })
})
