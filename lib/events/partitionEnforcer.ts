// Agency Group — Kafka Partition Key Enforcer
// lib/events/partitionEnforcer.ts
// TypeScript strict — 0 errors
//
// Validates that a partition key follows the required format: {tenantId}:{entityId}
// Both segments must be non-empty strings (tenantId minimum 4 chars).
//
// Used at publish time to guarantee tenant ordering invariants.
// Messages without a valid partition key break per-entity ordered processing
// (e.g. deal stage transitions must arrive in order per deal).

// ─── Result types ─────────────────────────────────────────────────────────────

export interface PartitionKeyResult {
  valid: boolean
  key: string
  error?: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates an existing partition key string.
 *
 * Rules:
 * 1. Must contain at least one ':' separator
 * 2. tenantId (first segment) must be ≥ 4 characters
 * 3. entityId (everything after the first ':') must be non-empty
 *
 * @example
 * validatePartitionKey('ag-001:deal-xyz')  // { valid: true,  key: '...' }
 * validatePartitionKey('ab:deal-xyz')      // { valid: false, key: '...', error: 'tenantId segment too short' }
 * validatePartitionKey('ag-001')           // { valid: false, key: '...', error: 'key must contain ":"' }
 */
export function validatePartitionKey(key: string): PartitionKeyResult {
  const colonIdx = key.indexOf(':')

  if (colonIdx === -1) {
    return { valid: false, key, error: 'key must contain ":"' }
  }

  const tenantId = key.slice(0, colonIdx)
  const entityId = key.slice(colonIdx + 1)

  if (!tenantId || tenantId.length < 4) {
    return {
      valid: false,
      key,
      error: `tenantId segment too short (got "${tenantId}", need ≥ 4 chars)`,
    }
  }

  if (!entityId) {
    return { valid: false, key, error: 'entityId segment missing' }
  }

  return { valid: true, key }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a valid partition key from tenantId and entityId components.
 *
 * Throws immediately if either component is empty — fail-fast at the call site
 * rather than silently publishing to the wrong partition.
 *
 * @example
 * buildPartitionKey('ag-001', 'deal-xyz')   // 'ag-001:deal-xyz'
 * buildPartitionKey('', 'deal-xyz')         // throws Error('tenantId required for partition key')
 */
export function buildPartitionKey(tenantId: string, entityId: string): string {
  if (!tenantId) throw new Error('tenantId required for partition key')
  if (!entityId) throw new Error('entityId required for partition key')
  return `${tenantId}:${entityId}`
}

// ─── Enforcement ─────────────────────────────────────────────────────────────

/**
 * Validates a partition key in a publish context.
 *
 * @param key     - The key to validate (may be null/undefined)
 * @param context - Human-readable label used in log messages (e.g. "deal.created publisher")
 * @param strict  - If true, throws on invalid or missing key. If false (default), logs a warning.
 * @returns       - The original key string, or null if key was absent
 *
 * @example
 * // Warn-only (non-critical topics)
 * const k = enforcePartitionKey(event.partitionKey, 'market.snapshot publisher')
 *
 * // Strict (financial topics — ordering is critical)
 * const k = enforcePartitionKey(event.partitionKey, 'commission.calculated publisher', true)
 */
export function enforcePartitionKey(
  key: string | null | undefined,
  context: string,
  strict = false,
): string | null {
  if (!key) {
    const msg = `[PartitionEnforcer] no partition key in context: ${context}`
    if (strict) throw new Error(msg)
    console.warn(msg)
    return null
  }

  const result = validatePartitionKey(key)

  if (!result.valid) {
    const msg = `[PartitionEnforcer] invalid partition key "${key}" in ${context}: ${result.error}`
    if (strict) throw new Error(msg)
    console.warn(msg)
  }

  return key
}
