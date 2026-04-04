import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Lower sample rate in production — API calls are high volume
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  beforeSend(event) {
    // Log errors server-side even in development (useful for debugging)
    if (event.level === 'error') {
      const message = event.exception?.values?.[0]?.value ?? event.message
      console.error('[Sentry] Error captured:', message)
    }
    return event
  },
})
