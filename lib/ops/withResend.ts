// =============================================================================
// Agency Group — withResend: Resend Email Retry Wrapper
// lib/ops/withResend.ts
//
// Wraps Resend API calls with:
//   1. AbortSignal timeout (5 seconds per attempt)
//   2. Exponential backoff retry (2 attempts: 500ms → 1000ms)
//   3. Structured error logging with correlation_id
//
// USAGE:
//   import { withResend } from '@/lib/ops/withResend'
//
//   const { data, error } = await withResend(
//     () => resend.emails.send({ to, from, subject, html }),
//     corrId,
//   )
//   if (error) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
//
// TypeScript strict — 0 errors
// =============================================================================

const MAX_ATTEMPTS = 3       // 1 initial + 2 retries
const BASE_DELAY_MS = 500
const TIMEOUT_MS = 5_000

interface ResendResult<T> {
  data: T | null
  error: string | null
}

/**
 * Execute a Resend API call with timeout and exponential backoff retry.
 *
 * @param fn     Factory function returning a Resend API call promise
 * @param corrId Correlation ID for structured logging (optional)
 */
export async function withResend<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  corrId?: string,
): Promise<ResendResult<T>> {
  let lastError: string = 'Unknown error'

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await fn(controller.signal)
      clearTimeout(timer)
      return { data: result, error: null }
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err.message : String(err)
      const isTimeout = controller.signal.aborted || lastError.includes('timeout') || lastError.includes('aborted')

      if (attempt < MAX_ATTEMPTS) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1) // 500ms, 1000ms
        console.warn('[withResend] attempt failed, retrying', {
          corrId,
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          delayMs,
          error: lastError,
          isTimeout,
        })
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else {
        console.error('[withResend] all attempts exhausted', {
          corrId,
          attempts: MAX_ATTEMPTS,
          error: lastError,
          isTimeout,
        })
      }
    }
  }

  return { data: null, error: lastError }
}
