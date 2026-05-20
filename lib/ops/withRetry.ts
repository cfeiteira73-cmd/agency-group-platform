// =============================================================================
// Agency Group — withRetry: Exponential Backoff + Jitter
// lib/ops/withRetry.ts
//
// Phase 6: Self-Healing Reliability Infrastructure
//
// Retry utility for external service calls.
// Designed for Vercel Edge + Node.js serverless environments.
//
// DESIGN PRINCIPLES:
//   - Pure utility — no Supabase/Redis/Anthropic SDK imports
//   - Works in Edge Runtime (no Node-only APIs)
//   - Per-attempt timeout via AbortController
//   - Jitter: +0–20% of delay to avoid thundering herd
//   - On exhaustion: re-throws the last error (callers decide fallback)
//   - TypeScript strict: zero errors
//
// SPECIALISED PRESETS:
//   withAnthropicRetry — 3 attempts, 1 000ms base, ×2.0, 30s timeout
//   withSupabaseRetry  — 3 attempts,   500ms base, ×2.5, 10s timeout
//
// USAGE:
//   import { withRetry, withAnthropicRetry, withSupabaseRetry } from '@/lib/ops/withRetry'
//
//   const result = await withAnthropicRetry(() => anthropic.messages.create(...))
//   const rows   = await withSupabaseRetry(()  => supabase.from('x').select('*'))
//   const data   = await withRetry(() => fetch(url), { maxAttempts: 5, baseDelayMs: 2000 })
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Total number of attempts (first call + retries). Default: 3 */
  maxAttempts: number
  /** Initial delay before the first retry (ms). Default: 1000 */
  baseDelayMs: number
  /** Multiplier applied to delay after each failure. Default: 2.0 */
  backoffFactor: number
  /** Add random 0–20% to each delay to spread load. Default: true */
  jitter: boolean
  /** Per-attempt wall-clock timeout (ms). Undefined = no timeout. */
  timeoutMs?: number
  /** Called after each failed attempt (before the next retry). */
  onFailure?: (attempt: number, error: unknown) => void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULTS: RetryOptions = {
  maxAttempts:   3,
  baseDelayMs:   1_000,
  backoffFactor: 2.0,
  jitter:        true,
}

/**
 * Compute delay for attempt N (0-indexed retry count).
 * delay = baseDelayMs × backoffFactor^retryN  [+ 0–20% jitter]
 */
function computeDelay(opts: RetryOptions, retryN: number): number {
  const raw = opts.baseDelayMs * Math.pow(opts.backoffFactor, retryN)
  if (!opts.jitter) return raw
  // Jitter: add 0–20% of raw delay
  const jitter = raw * 0.2 * Math.random()
  return Math.round(raw + jitter)
}

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Safe for Edge Runtime — uses setTimeout which is available everywhere.
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps `fn` with a per-attempt AbortController timeout.
 * The fn must accept an AbortSignal to honour cancellation, but since
 * most callers don't thread AbortSignal, we race a rejection timer instead.
 */
function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`withRetry: attempt timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    fn().then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err: unknown) => { clearTimeout(timer); reject(err) },
    )
  })
}

// ---------------------------------------------------------------------------
// Core: withRetry
// ---------------------------------------------------------------------------

/**
 * Execute `fn` with exponential backoff retry.
 *
 * - Attempts 1…maxAttempts
 * - Between attempts: delay = baseDelayMs × backoffFactor^(attempt-1) [+jitter]
 * - Per-attempt timeout if `timeoutMs` is set
 * - Re-throws the last error when all attempts are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
): Promise<T> {
  const options: RetryOptions = { ...DEFAULTS, ...opts }

  let lastError: unknown = new Error('withRetry: no attempts made')

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const result = options.timeoutMs !== undefined
        ? await withTimeout(fn, options.timeoutMs)
        : await fn()

      return result
    } catch (err: unknown) {
      lastError = err

      // Notify caller of failure (non-blocking, errors swallowed)
      try {
        options.onFailure?.(attempt, err)
      } catch {
        // guard: onFailure must not propagate
      }

      // If this was the last attempt, break immediately — don't sleep
      if (attempt >= options.maxAttempts) break

      // Wait before next attempt
      const delay = computeDelay(options, attempt - 1)
      await sleep(delay)
    }
  }

  // All attempts exhausted — re-throw so callers can decide the fallback
  throw lastError
}

// ---------------------------------------------------------------------------
// Specialised preset: Anthropic API
//
//   maxAttempts=3, baseDelayMs=1000, backoffFactor=2.0, jitter=true, timeoutMs=30000
//
// Rationale: Anthropic 5xx / 529 (overloaded) are transient. Three attempts
// with 1s → 2s backoff cover most transient spikes. 30s per-attempt prevents
// serverless functions from hanging on a stalled connection.
// ---------------------------------------------------------------------------

const ANTHROPIC_OPTS: RetryOptions = {
  maxAttempts:   3,
  baseDelayMs:   1_000,
  backoffFactor: 2.0,
  jitter:        true,
  timeoutMs:     30_000,
}

/**
 * Retry preset for Anthropic API calls.
 * Handles 5xx / overload (529) transient failures.
 *
 * @example
 *   const msg = await withAnthropicRetry(() =>
 *     anthropic.messages.create({ model: 'claude-sonnet-4-6', ... })
 *   )
 */
export async function withAnthropicRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, ANTHROPIC_OPTS)
}

// ---------------------------------------------------------------------------
// Specialised preset: Supabase / PostgreSQL
//
//   maxAttempts=3, baseDelayMs=500, backoffFactor=2.5, jitter=true, timeoutMs=10000
//
// Rationale: DB query failures (connection pool exhaustion, temporary lock)
// tend to resolve quickly. 500ms → 1250ms → ~3125ms covers most transient
// issues. 10s timeout aligns with Vercel Edge default timeouts.
// ---------------------------------------------------------------------------

const SUPABASE_OPTS: RetryOptions = {
  maxAttempts:   3,
  baseDelayMs:   500,
  backoffFactor: 2.5,
  jitter:        true,
  timeoutMs:     10_000,
}

/**
 * Retry preset for Supabase / PostgreSQL calls.
 * Handles connection pool exhaustion and transient DB errors.
 *
 * @example
 *   const { data } = await withSupabaseRetry(() =>
 *     supabase.from('leads').select('*').eq('status', 'active')
 *   )
 */
export async function withSupabaseRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, SUPABASE_OPTS)
}
