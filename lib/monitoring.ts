import * as Sentry from '@sentry/nextjs'

/**
 * Capture an API error with context tags for easier filtering in Sentry.
 */
export function captureApiError(
  endpoint: string,
  error: Error,
  context?: Record<string, unknown>
): void {
  Sentry.withScope(scope => {
    scope.setTag('endpoint', endpoint)
    scope.setTag('type', 'api_error')
    if (context) scope.setContext('additional', context)
    Sentry.captureException(error)
  })
}

/**
 * Capture a named event (e.g. "lead_created", "deal_closed") with optional metadata.
 */
export function captureEvent(
  name: string,
  data?: Record<string, unknown>
): void {
  Sentry.captureMessage(name, { level: 'info', extra: data })
}

/**
 * Identify the current user in Sentry for enriched error reports.
 */
export function setUserContext(user: {
  id: string
  email: string
  role: string
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    segment: user.role,
  })
}

/**
 * Clear user context on logout.
 */
export function clearUserContext(): void {
  Sentry.setUser(null)
}

/**
 * Wrap an async function with automatic error capture + rethrow.
 * Usage: const result = await withSentryCapture('api/avm', () => fetchAVM(params))
 */
export async function withSentryCapture<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    captureApiError(label, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
