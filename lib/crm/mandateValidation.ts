// =============================================================================
// Phase 2B.1 — Demand Mandate Validation
// Pure TypeScript constraint validators mirroring SQL CHECK constraints.
// No DB calls. No side effects. All functions return ValidationResult.
// Used by: tests (jsdom), API routes (Node), future RPC wrappers.
// =============================================================================

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

function ok(): ValidationResult                    { return { ok: true,  errors: [] } }
function fail(...msgs: string[]): ValidationResult { return { ok: false, errors: msgs } }
function merge(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap(r => r.errors)
  return { ok: errors.length === 0, errors }
}

// ── Enums (mirroring SQL CHECK constraints) ───────────────────────────────────

export const TRANSACTION_MODES = ['BUY', 'RENT'] as const
export type TransactionMode = typeof TRANSACTION_MODES[number]

export const PURPOSES = [
  'PRIMARY_RESIDENCE', 'SECONDARY_RESIDENCE',
  'HOLIDAY', 'INVESTMENT', 'DEVELOPMENT', 'OTHER',
] as const
export type Purpose = typeof PURPOSES[number]

export const LIFECYCLE_STATES = [
  'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'CANCELLED',
] as const
export type LifecycleState = typeof LIFECYCLE_STATES[number]

export const BUDGET_PROVENANCES = [
  'USER_STATED', 'AGENT_VERIFIED', 'AI_EXTRACTED', 'INFERRED', 'IMPORT',
] as const
export type BudgetProvenance = typeof BUDGET_PROVENANCES[number]

export const ORIGINS = [
  'CONTACT_FORM', 'SOFIA_DRAFT', 'AGENT_ENTRY', 'IMPORT', 'SAVED_SEARCH',
] as const
export type Origin = typeof ORIGINS[number]

export const CONSTRAINT_TYPES = ['HARD', 'PREFERENCE', 'EXCLUSION'] as const
export type ConstraintType = typeof CONSTRAINT_TYPES[number]

export const LOCATION_MODES = ['INCLUDE', 'EXCLUDE'] as const
export type LocationMode = typeof LOCATION_MODES[number]

export const PARTICIPANT_ROLES = [
  'HOLDER', 'DECISION_MAKER', 'ADVISER', 'REPRESENTATIVE', 'OTHER',
] as const
export type ParticipantRole = typeof PARTICIPANT_ROLES[number]

export const GEOGRAPHY_LEVELS = [
  'COUNTRY', 'DISTRICT', 'MUNICIPALITY', 'PARISH', 'ZONE',
] as const
export type GeographyLevel = typeof GEOGRAPHY_LEVELS[number]

export const HISTORY_CHANGE_TYPES = [
  'CREATED',
  'LIFECYCLE_CHANGE',
  'BUDGET_CHANGE',
  'BUDGET_VERIFIED',
  'GEOGRAPHY_CHANGE',
  'CRITERIA_CHANGE',
  'OWNERSHIP_CHANGE',
  'VERIFICATION',
  'EXTENSION_CHANGE',
  'NOTE_CHANGE',
] as const
export type HistoryChangeType = typeof HISTORY_CHANGE_TYPES[number]

export const FINANCING_TYPES = ['CASH', 'MORTGAGE', 'MIXED', 'UNKNOWN'] as const
export type FinancingType = typeof FINANCING_TYPES[number]

export const TIMELINES = [
  'IMMEDIATE', '3_MONTHS', '6_MONTHS', '1_YEAR', 'FLEXIBLE', 'UNKNOWN',
] as const
export type Timeline = typeof TIMELINES[number]

export const PROOF_OF_FUNDS = ['NONE', 'STATED', 'DOCUMENT_SEEN', 'VERIFIED'] as const
export type ProofOfFunds = typeof PROOF_OF_FUNDS[number]

export const RISK_TOLERANCES = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const
export type RiskTolerance = typeof RISK_TOLERANCES[number]

// ── Types matching the schema ─────────────────────────────────────────────────

export interface DemandMandateInput {
  holder_contact_id: number          // BIGINT — contacts.id is numeric in production
  owner_id:          string          // UUID — session.user.id = profiles.id
  transaction_mode:  string
  purpose:           string
  lifecycle_state?:  string
  budget_min?:       number | null
  budget_max?:       number | null
  currency_code?:    string
  budget_provenance?: string
  origin?:           string
  expires_at?:       string | null
}

export interface BudgetInput {
  budget_min?:       number | null
  budget_max?:       number | null
  currency_code?:    string
  budget_provenance?: string
}

export interface BuyerMandateDetailsInput {
  bedrooms_min?:  number | null
  bedrooms_max?:  number | null
  bathrooms_min?: number | null
  area_min_m2?:   number | null
  area_max_m2?:   number | null
  financing_type?: string | null
  timeline?:       string | null
  proof_of_funds?: string
}

export interface InvestorMandateDetailsInput {
  target_yield_min_pct?: number | null
  target_yield_max_pct?: number | null
  ticket_min?:           number | null
  ticket_max?:           number | null
  ticket_currency_code?: string
  risk_tolerance?:       string | null
}

// ── Core validators ───────────────────────────────────────────────────────────

export function validateCurrencyCode(code: string | undefined | null): ValidationResult {
  if (code === undefined || code === null) return ok()
  if (!/^[A-Z]{3}$/.test(code)) {
    return fail(`currency_code must be 3 uppercase letters (ISO 4217), got: "${code}"`)
  }
  return ok()
}

export function validateBudget(input: BudgetInput): ValidationResult {
  const errors: string[] = []

  if (input.budget_min !== null && input.budget_min !== undefined) {
    if (typeof input.budget_min !== 'number' || !isFinite(input.budget_min)) {
      errors.push('budget_min must be a finite number')
    } else if (input.budget_min < 0) {
      errors.push(`budget_min must be >= 0, got ${input.budget_min}`)
    }
  }

  if (input.budget_max !== null && input.budget_max !== undefined) {
    if (typeof input.budget_max !== 'number' || !isFinite(input.budget_max)) {
      errors.push('budget_max must be a finite number')
    } else if (input.budget_max < 0) {
      errors.push(`budget_max must be >= 0, got ${input.budget_max}`)
    }
  }

  if (
    input.budget_min !== null && input.budget_min !== undefined &&
    input.budget_max !== null && input.budget_max !== undefined &&
    typeof input.budget_min === 'number' && typeof input.budget_max === 'number' &&
    isFinite(input.budget_min) && isFinite(input.budget_max)
  ) {
    if (input.budget_min > input.budget_max) {
      errors.push(`budget_min (${input.budget_min}) must be <= budget_max (${input.budget_max})`)
    }
  }

  const currencyResult = validateCurrencyCode(input.currency_code)
  if (!currencyResult.ok) errors.push(...currencyResult.errors)

  if (input.budget_provenance !== undefined) {
    if (!(BUDGET_PROVENANCES as readonly string[]).includes(input.budget_provenance)) {
      errors.push(`budget_provenance must be one of ${BUDGET_PROVENANCES.join(', ')}, got "${input.budget_provenance}"`)
    }
  }

  return errors.length ? fail(...errors) : ok()
}

export function validateTransactionMode(value: string | undefined | null): ValidationResult {
  if (!value) return fail('transaction_mode is required')
  if (!(TRANSACTION_MODES as readonly string[]).includes(value)) {
    return fail(`transaction_mode must be one of ${TRANSACTION_MODES.join(', ')}, got "${value}"`)
  }
  return ok()
}

export function validatePurpose(value: string | undefined | null): ValidationResult {
  if (!value) return fail('purpose is required')
  if (!(PURPOSES as readonly string[]).includes(value)) {
    return fail(`purpose must be one of ${PURPOSES.join(', ')}, got "${value}"`)
  }
  return ok()
}

export function validateLifecycleState(value: string | undefined | null): ValidationResult {
  if (!value) return ok() // DEFAULT 'DRAFT'
  if (!(LIFECYCLE_STATES as readonly string[]).includes(value)) {
    return fail(`lifecycle_state must be one of ${LIFECYCLE_STATES.join(', ')}, got "${value}"`)
  }
  return ok()
}

export function validateOrigin(value: string | undefined | null): ValidationResult {
  if (!value) return ok() // DEFAULT 'AGENT_ENTRY'
  if (!(ORIGINS as readonly string[]).includes(value)) {
    return fail(`origin must be one of ${ORIGINS.join(', ')}, got "${value}"`)
  }
  return ok()
}

export function validateHolderId(value: number | undefined | null): ValidationResult {
  if (value === undefined || value === null) return fail('holder_contact_id is required (Amendment 1: person-only mandates)')
  if (!Number.isInteger(value) || value <= 0) {
    return fail(`holder_contact_id must be a positive integer (contacts.id is BIGINT), got: ${value}`)
  }
  return ok()
}

// Full mandate input validation
export function validateDemandMandate(input: DemandMandateInput): ValidationResult {
  return merge([
    validateHolderId(input.holder_contact_id),
    (input.owner_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.owner_id))
      ? ok() : fail('owner_id must be a valid UUID'),
    validateTransactionMode(input.transaction_mode),
    validatePurpose(input.purpose),
    validateLifecycleState(input.lifecycle_state ?? 'DRAFT'),
    validateBudget({
      budget_min:       input.budget_min,
      budget_max:       input.budget_max,
      currency_code:    input.currency_code ?? 'EUR',
      budget_provenance:input.budget_provenance ?? 'AI_EXTRACTED',
    }),
    validateOrigin(input.origin ?? 'AGENT_ENTRY'),
  ])
}

// ── Lifecycle transition validation ───────────────────────────────────────────
// Application-level guard for valid state transitions.
// Database enforces valid states; this layer enforces transition semantics.

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  DRAFT:     ['ACTIVE', 'CANCELLED'],
  ACTIVE:    ['PAUSED', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
  PAUSED:    ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  COMPLETED: [],
  EXPIRED:   [],
  CANCELLED: [],
}

export function validateLifecycleTransition(
  from: string,
  to:   string,
): ValidationResult {
  if (!(LIFECYCLE_STATES as readonly string[]).includes(from)) {
    return fail(`Invalid current state: "${from}"`)
  }
  if (!(LIFECYCLE_STATES as readonly string[]).includes(to)) {
    return fail(`Invalid target state: "${to}"`)
  }
  const allowed = VALID_TRANSITIONS[from as LifecycleState]
  if (!allowed.includes(to as LifecycleState)) {
    return fail(
      `Lifecycle transition ${from} → ${to} is not permitted. ` +
      `Allowed: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`
    )
  }
  return ok()
}

// ── Computed field validators (mirrors GENERATED ALWAYS AS) ──────────────────

export function isBudgetStated(input: BudgetInput): boolean {
  return input.budget_min !== null && input.budget_min !== undefined
      || input.budget_max !== null && input.budget_max !== undefined
}

export function isBudgetVerified(input: BudgetInput): boolean {
  return input.budget_provenance === 'AGENT_VERIFIED'
}

// ── Geography validators ───────────────────────────────────────────────────────

export function validateGeographyLevel(value: string | undefined | null): ValidationResult {
  if (!value) return fail('level is required')
  if (!(GEOGRAPHY_LEVELS as readonly string[]).includes(value)) {
    return fail(`geography level must be one of ${GEOGRAPHY_LEVELS.join(', ')}, got "${value}"`)
  }
  return ok()
}

export function validateLocationMode(value: string | undefined | null): ValidationResult {
  if (!value) return ok() // DEFAULT 'INCLUDE'
  if (!(LOCATION_MODES as readonly string[]).includes(value)) {
    return fail(`location mode must be one of ${LOCATION_MODES.join(', ')}, got "${value}"`)
  }
  return ok()
}

export function validatePreferenceWeight(value: number | undefined | null): ValidationResult {
  if (value === null || value === undefined) return ok() // DEFAULT 50
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return fail(`preference_weight must be an integer 0–100, got ${value}`)
  }
  return ok()
}

// ── Criteria validator ────────────────────────────────────────────────────────

export function validateConstraintType(value: string | undefined | null): ValidationResult {
  if (!value) return fail('constraint_type is required')
  if (!(CONSTRAINT_TYPES as readonly string[]).includes(value)) {
    return fail(`constraint_type must be one of ${CONSTRAINT_TYPES.join(', ')}, got "${value}"`)
  }
  return ok()
}

// ── Buyer mandate details validators ─────────────────────────────────────────

export function validateBuyerMandateDetails(input: BuyerMandateDetailsInput): ValidationResult {
  const errors: string[] = []

  if (input.bedrooms_min !== null && input.bedrooms_min !== undefined &&
      input.bedrooms_max !== null && input.bedrooms_max !== undefined) {
    if (input.bedrooms_min > input.bedrooms_max) {
      errors.push(`bedrooms_min (${input.bedrooms_min}) must be <= bedrooms_max (${input.bedrooms_max})`)
    }
  }

  if (input.area_min_m2 !== null && input.area_min_m2 !== undefined) {
    if (input.area_min_m2 < 0) errors.push(`area_min_m2 must be >= 0`)
  }
  if (input.area_max_m2 !== null && input.area_max_m2 !== undefined) {
    if (input.area_max_m2 < 0) errors.push(`area_max_m2 must be >= 0`)
  }
  if (
    input.area_min_m2 !== null && input.area_min_m2 !== undefined &&
    input.area_max_m2 !== null && input.area_max_m2 !== undefined &&
    input.area_min_m2 > input.area_max_m2
  ) {
    errors.push(`area_min_m2 (${input.area_min_m2}) must be <= area_max_m2 (${input.area_max_m2})`)
  }

  if (input.financing_type !== null && input.financing_type !== undefined) {
    if (!(FINANCING_TYPES as readonly string[]).includes(input.financing_type)) {
      errors.push(`financing_type must be one of ${FINANCING_TYPES.join(', ')}, got "${input.financing_type}"`)
    }
  }

  if (input.timeline !== null && input.timeline !== undefined) {
    if (!(TIMELINES as readonly string[]).includes(input.timeline)) {
      errors.push(`timeline must be one of ${TIMELINES.join(', ')}, got "${input.timeline}"`)
    }
  }

  if (input.proof_of_funds !== undefined) {
    if (!(PROOF_OF_FUNDS as readonly string[]).includes(input.proof_of_funds)) {
      errors.push(`proof_of_funds must be one of ${PROOF_OF_FUNDS.join(', ')}, got "${input.proof_of_funds}"`)
    }
  }

  return errors.length ? fail(...errors) : ok()
}

// ── Investor mandate details validators ──────────────────────────────────────

export function validateInvestorMandateDetails(input: InvestorMandateDetailsInput): ValidationResult {
  const errors: string[] = []

  if (input.target_yield_min_pct !== null && input.target_yield_min_pct !== undefined) {
    if (input.target_yield_min_pct < 0) errors.push(`target_yield_min_pct must be >= 0`)
  }
  if (input.target_yield_max_pct !== null && input.target_yield_max_pct !== undefined) {
    if (input.target_yield_max_pct < 0) errors.push(`target_yield_max_pct must be >= 0`)
  }
  if (
    input.target_yield_min_pct !== null && input.target_yield_min_pct !== undefined &&
    input.target_yield_max_pct !== null && input.target_yield_max_pct !== undefined &&
    input.target_yield_min_pct > input.target_yield_max_pct
  ) {
    errors.push(`target_yield_min_pct (${input.target_yield_min_pct}) must be <= target_yield_max_pct (${input.target_yield_max_pct})`)
  }

  if (input.ticket_min !== null && input.ticket_min !== undefined) {
    if (input.ticket_min < 0) errors.push(`ticket_min must be >= 0`)
  }
  if (input.ticket_max !== null && input.ticket_max !== undefined) {
    if (input.ticket_max < 0) errors.push(`ticket_max must be >= 0`)
  }
  if (
    input.ticket_min !== null && input.ticket_min !== undefined &&
    input.ticket_max !== null && input.ticket_max !== undefined &&
    input.ticket_min > input.ticket_max
  ) {
    errors.push(`ticket_min (${input.ticket_min}) must be <= ticket_max (${input.ticket_max})`)
  }

  const currencyResult = validateCurrencyCode(input.ticket_currency_code)
  if (!currencyResult.ok) errors.push(...currencyResult.errors)

  if (input.risk_tolerance !== null && input.risk_tolerance !== undefined) {
    if (!(RISK_TOLERANCES as readonly string[]).includes(input.risk_tolerance)) {
      errors.push(`risk_tolerance must be one of ${RISK_TOLERANCES.join(', ')}, got "${input.risk_tolerance}"`)
    }
  }

  return errors.length ? fail(...errors) : ok()
}

// ── History change type validator ─────────────────────────────────────────────

export function validateHistoryChangeType(value: string | undefined | null): ValidationResult {
  if (!value) return fail('change_type is required')
  if (!(HISTORY_CHANGE_TYPES as readonly string[]).includes(value)) {
    return fail(`change_type must be one of ${HISTORY_CHANGE_TYPES.join(', ')}, got "${value}"`)
  }
  return ok()
}

// Explicit guard: MATCH_EVENT must not appear in history (Amendment 4)
export function assertNoMatchEvent(changeType: string): ValidationResult {
  if (changeType === 'MATCH_EVENT') {
    return fail('MATCH_EVENT is not a valid history change_type (Amendment 4). Match events belong in demand_mandate_matches (Phase 2C+).')
  }
  return ok()
}
