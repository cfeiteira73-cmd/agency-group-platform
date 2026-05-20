// =============================================================================
// Agency Group — Dead Letter Queue Router
// lib/events/dlqRouter.ts
//
// Classifies failed Kafka messages, determines retry eligibility with
// exponential backoff, and builds structured DLQ payloads.
//
// Pure functions — no I/O, no side effects. Safe to call from any context.
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Coarse-grained error taxonomy.
 * - schema_invalid:       Message cannot be parsed or fails schema validation.
 *                         Never retried — reprocess requires a code fix.
 * - tenant_not_found:     Tenant context missing or unknown.
 *                         Limited retries — may resolve after tenant provisioning.
 * - db_unavailable:       Database / Supabase connection failure.
 *                         Retryable — transient infrastructure issue.
 * - processing_timeout:   Consumer took too long.
 *                         Retryable — may succeed on a less-loaded instance.
 * - unknown:              Catch-all for unrecognised errors.
 *                         Retryable up to maxRetries.
 */
export type DlqErrorClass =
  | 'schema_invalid'
  | 'tenant_not_found'
  | 'db_unavailable'
  | 'processing_timeout'
  | 'unknown'

// ─── DLQ message shape ────────────────────────────────────────────────────────

export interface DlqMessage {
  /** Topic the message originally came from */
  originalTopic: string
  /** Kafka offset of the original message */
  originalOffset: string
  /** Kafka message timestamp (ISO string) */
  originalTimestamp: string
  /** Message key, or null */
  key: string | null
  /** Parsed message body */
  value: unknown
  /** Human-readable error description */
  error: string
  /** Classified error category */
  errorClass: DlqErrorClass
  /** How many times this message has already been retried */
  retryCount: number
  /** Maximum number of retries allowed for this error class */
  maxRetries: number
  /** ISO timestamp for the next retry attempt */
  nextRetryAt: string
  /** Tenant the message belongs to, or null if it cannot be determined */
  tenantId: string | null
}

// ─── Error classifier ─────────────────────────────────────────────────────────

/**
 * Infers a `DlqErrorClass` from a raw error string.
 * Matching is case-insensitive and checks common error substrings.
 */
export function classifyError(error: string): DlqErrorClass {
  const e = error.toLowerCase()

  if (e.includes('schema') || e.includes('validation') || e.includes('invalid json')) {
    return 'schema_invalid'
  }
  if (e.includes('tenant') || e.includes('not found') || e.includes('no data')) {
    return 'tenant_not_found'
  }
  if (e.includes('database') || e.includes('supabase') || e.includes('connection')) {
    return 'db_unavailable'
  }
  if (e.includes('timeout') || e.includes('timed out')) {
    return 'processing_timeout'
  }

  return 'unknown'
}

// ─── Retry eligibility ────────────────────────────────────────────────────────

/** Max retries per error class */
const MAX_RETRIES_BY_CLASS: Record<DlqErrorClass, number> = {
  schema_invalid:     0,  // hard failure — code bug, never retry
  tenant_not_found:   1,  // retry once after tenant may have been provisioned
  db_unavailable:     3,  // transient infra — up to 3 retries
  processing_timeout: 3,  // transient load — up to 3 retries
  unknown:            3,  // conservative default
}

/**
 * Returns true when the message should be re-enqueued for processing.
 * Schema-invalid messages are never retried regardless of retryCount.
 */
export function shouldRetry(msg: Pick<DlqMessage, 'retryCount' | 'maxRetries' | 'errorClass'>): boolean {
  if (msg.errorClass === 'schema_invalid') return false
  return msg.retryCount < msg.maxRetries
}

// ─── Exponential backoff ──────────────────────────────────────────────────────

/**
 * Calculates the ISO timestamp for the next retry using a fixed backoff ladder:
 *
 * | retryCount | delay   |
 * |-----------|---------|
 * | 0          | 1 s     |
 * | 1          | 5 s     |
 * | 2          | 30 s    |
 * | 3          | 5 min   |
 * | 4+         | 30 min  |
 */
export function calculateNextRetry(retryCount: number): string {
  const backoffMs: number[] = [
    1_000,       // 1 s
    5_000,       // 5 s
    30_000,      // 30 s
    300_000,     // 5 min
    1_800_000,   // 30 min
  ]
  const delayMs = backoffMs[Math.min(retryCount, backoffMs.length - 1)] ?? 1_800_000
  return new Date(Date.now() + delayMs).toISOString()
}

// ─── DLQ message builder ──────────────────────────────────────────────────────

/**
 * Builds a fully-typed `DlqMessage` from raw failure context.
 * Classifies the error, sets maxRetries, and calculates the next retry time.
 */
export function buildDlqMessage(params: {
  originalTopic: string
  originalOffset: string
  originalTimestamp: string
  key: string | null
  value: unknown
  error: string
  /** Current retry count (0 = first failure) */
  retryCount?: number
  tenantId?: string | null
}): DlqMessage {
  const errorClass  = classifyError(params.error)
  const retryCount  = params.retryCount ?? 0
  const maxRetries  = MAX_RETRIES_BY_CLASS[errorClass]

  const eligible = shouldRetry({ errorClass, retryCount, maxRetries })

  return {
    originalTopic:     params.originalTopic,
    originalOffset:    params.originalOffset,
    originalTimestamp: params.originalTimestamp,
    key:               params.key,
    value:             params.value,
    error:             params.error,
    errorClass,
    retryCount,
    maxRetries,
    nextRetryAt:       eligible ? calculateNextRetry(retryCount) : new Date().toISOString(),
    tenantId:          params.tenantId ?? null,
  }
}
