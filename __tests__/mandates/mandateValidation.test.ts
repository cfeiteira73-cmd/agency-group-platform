// =============================================================================
// Phase 2B.2 — Mandate Validation Tests
// Pure unit tests — no DB, no network.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  validateDemandMandate,
  validateBudget,
  validateLifecycleTransition,
  validateHolderId,
  validateBuyerMandateDetails,
  validateInvestorMandateDetails,
  validateConstraintType,
  validateLocationMode,
  isBudgetStated,
  isBudgetVerified,
  CONSTRAINT_TYPES,
  LIFECYCLE_STATES,
} from '@/lib/crm/mandateValidation'

describe('validateHolderId', () => {
  it('accepts a positive integer', () => {
    expect(validateHolderId(999000001).ok).toBe(true)
    expect(validateHolderId(1).ok).toBe(true)
  })
  it('rejects zero', () => {
    expect(validateHolderId(0).ok).toBe(false)
  })
  it('rejects negative', () => {
    expect(validateHolderId(-1).ok).toBe(false)
  })
  it('rejects null', () => {
    expect(validateHolderId(null).ok).toBe(false)
  })
  it('rejects undefined', () => {
    expect(validateHolderId(undefined).ok).toBe(false)
  })
  it('rejects fractional number', () => {
    expect(validateHolderId(1.5).ok).toBe(false)
  })
  // Regression: must NOT accept a UUID-shaped string
  it('rejects UUID string (contacts.id is BIGINT, not UUID)', () => {
    expect(validateHolderId('9b100000-0000-4000-8000-000000000001' as unknown as number).ok).toBe(false)
  })
})

describe('validateDemandMandate', () => {
  const baseValid = {
    holder_contact_id: 42,
    owner_id: '00000000-0000-4000-8000-000000000001',
    transaction_mode: 'BUY',
    purpose: 'INVESTMENT',
  }

  it('accepts a valid minimal mandate', () => {
    expect(validateDemandMandate(baseValid).ok).toBe(true)
  })
  it('rejects missing holder_contact_id', () => {
    expect(validateDemandMandate({ ...baseValid, holder_contact_id: 0 }).ok).toBe(false)
  })
  it('rejects invalid transaction_mode', () => {
    expect(validateDemandMandate({ ...baseValid, transaction_mode: 'LEASE' }).ok).toBe(false)
  })
  it('rejects invalid purpose', () => {
    expect(validateDemandMandate({ ...baseValid, purpose: 'SPECULATION' }).ok).toBe(false)
  })
  it('rejects budget_min > budget_max', () => {
    expect(validateDemandMandate({ ...baseValid, budget_min: 1000, budget_max: 500 }).ok).toBe(false)
  })
  it('accepts budget_min = budget_max', () => {
    expect(validateDemandMandate({ ...baseValid, budget_min: 500, budget_max: 500 }).ok).toBe(true)
  })
  it('rejects non-UUID owner_id', () => {
    expect(validateDemandMandate({ ...baseValid, owner_id: 'not-a-uuid' }).ok).toBe(false)
  })
  it('accepts RENT transaction mode', () => {
    expect(validateDemandMandate({ ...baseValid, transaction_mode: 'RENT' }).ok).toBe(true)
  })
})

describe('validateLifecycleTransition', () => {
  it('allows DRAFT → ACTIVE', () => {
    expect(validateLifecycleTransition('DRAFT', 'ACTIVE').ok).toBe(true)
  })
  it('allows ACTIVE → PAUSED', () => {
    expect(validateLifecycleTransition('ACTIVE', 'PAUSED').ok).toBe(true)
  })
  it('allows PAUSED → ACTIVE (reactivate)', () => {
    expect(validateLifecycleTransition('PAUSED', 'ACTIVE').ok).toBe(true)
  })
  it('allows ACTIVE → COMPLETED', () => {
    expect(validateLifecycleTransition('ACTIVE', 'COMPLETED').ok).toBe(true)
  })
  it('allows ACTIVE → CANCELLED', () => {
    expect(validateLifecycleTransition('ACTIVE', 'CANCELLED').ok).toBe(true)
  })
  it('rejects COMPLETED → ACTIVE (terminal state)', () => {
    expect(validateLifecycleTransition('COMPLETED', 'ACTIVE').ok).toBe(false)
  })
  it('rejects EXPIRED → ACTIVE (terminal state)', () => {
    expect(validateLifecycleTransition('EXPIRED', 'ACTIVE').ok).toBe(false)
  })
  it('rejects CANCELLED → ACTIVE (terminal state)', () => {
    expect(validateLifecycleTransition('CANCELLED', 'ACTIVE').ok).toBe(false)
  })
  it('rejects DRAFT → COMPLETED (skipping ACTIVE)', () => {
    expect(validateLifecycleTransition('DRAFT', 'COMPLETED').ok).toBe(false)
  })
  it('rejects invalid state', () => {
    expect(validateLifecycleTransition('BOGUS', 'ACTIVE').ok).toBe(false)
  })
})

describe('validateConstraintType', () => {
  it('accepts all valid types', () => {
    for (const t of CONSTRAINT_TYPES) {
      expect(validateConstraintType(t).ok).toBe(true)
    }
  })
  it('rejects SOFT (not a valid value)', () => {
    expect(validateConstraintType('SOFT').ok).toBe(false)
  })
  it('rejects NICE_TO_HAVE (not a valid value)', () => {
    expect(validateConstraintType('NICE_TO_HAVE').ok).toBe(false)
  })
  it('rejects empty', () => {
    expect(validateConstraintType('').ok).toBe(false)
  })
})

describe('validateBuyerMandateDetails', () => {
  it('accepts empty object (all optional)', () => {
    expect(validateBuyerMandateDetails({}).ok).toBe(true)
  })
  it('rejects bedrooms_min > bedrooms_max', () => {
    expect(validateBuyerMandateDetails({ bedrooms_min: 4, bedrooms_max: 2 }).ok).toBe(false)
  })
  it('rejects negative area', () => {
    expect(validateBuyerMandateDetails({ area_min_m2: -1 }).ok).toBe(false)
  })
  it('rejects area_min > area_max', () => {
    expect(validateBuyerMandateDetails({ area_min_m2: 200, area_max_m2: 100 }).ok).toBe(false)
  })
  it('rejects invalid financing_type', () => {
    expect(validateBuyerMandateDetails({ financing_type: 'LEASE' }).ok).toBe(false)
  })
  it('accepts CASH financing', () => {
    expect(validateBuyerMandateDetails({ financing_type: 'CASH' }).ok).toBe(true)
  })
})

describe('isBudgetStated / isBudgetVerified', () => {
  it('budget_stated = true when budget_min is set', () => {
    expect(isBudgetStated({ budget_min: 0 })).toBe(true)
  })
  it('budget_stated = false when both null', () => {
    expect(isBudgetStated({ budget_min: null, budget_max: null })).toBe(false)
  })
  it('budget_verified = true for AGENT_VERIFIED', () => {
    expect(isBudgetVerified({ budget_provenance: 'AGENT_VERIFIED' })).toBe(true)
  })
  it('budget_verified = false for USER_STATED', () => {
    expect(isBudgetVerified({ budget_provenance: 'USER_STATED' })).toBe(false)
  })
})
