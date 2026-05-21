// Agency Group — Intelligent Retry Engine
// lib/automation/intelligentRetry.ts
// Exponential backoff with jitter. Circuit-state-aware. NOT brute-force retry.

import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number
  retryOn: (error: Error) => boolean
}

export interface RetryResult<T> {
  success: boolean
  value?: T
  attempts: number
  total_duration_ms: number
  last_error?: string
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  jitterFactor: 0.3,
  retryOn: (_error: Error) => true,
}

// ─── computeDelay ─────────────────────────────────────────────────────────────

/**
 * Computes exponential backoff delay with jitter.
 * Formula: base * 2^attempt * (1 + jitter * Math.random()), capped at maxDelayMs.
 */
export function computeDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt)
  const jittered = exponential * (1 + config.jitterFactor * Math.random())
  return Math.min(jittered, config.maxDelayMs)
}

// ─── withRetry ────────────────────────────────────────────────────────────────

/**
 * Executes fn with retry logic using exponential backoff + jitter.
 * Never throws — returns RetryResult with success:false on final failure.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  operationName?: string,
): Promise<RetryResult<T>> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const name = operationName ?? 'operation'
  const startedAt = Date.now()
  let attempts = 0
  let last_error: string | undefined

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    attempts++
    try {
      const value = await fn()
      const total_duration_ms = Date.now() - startedAt
      log.info(`[intelligentRetry] ${name} succeeded`, { attempts, total_duration_ms })
      return { success: true, value, attempts, total_duration_ms }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      last_error = error.message

      log.info(`[intelligentRetry] ${name} attempt ${attempt + 1} failed`, {
        error: last_error,
        attempt: attempt + 1,
        maxAttempts: cfg.maxAttempts,
      })

      if (!cfg.retryOn(error)) {
        log.info(`[intelligentRetry] ${name} not retryable — aborting`, { error: last_error })
        break
      }

      if (attempt < cfg.maxAttempts - 1) {
        const delayMs = computeDelay(attempt, cfg)
        await new Promise<void>(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  const total_duration_ms = Date.now() - startedAt
  log.info(`[intelligentRetry] ${name} exhausted all attempts`, {
    attempts,
    total_duration_ms,
    last_error,
  })

  return { success: false, attempts, total_duration_ms, last_error }
}

// ─── withRetryOrThrow ─────────────────────────────────────────────────────────

/**
 * Convenience wrapper — throws on final failure.
 */
export async function withRetryOrThrow<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const result = await withRetry<T>(fn, config)
  if (!result.success) {
    throw new Error(result.last_error ?? 'Operation failed after retries')
  }
  return result.value as T
}
