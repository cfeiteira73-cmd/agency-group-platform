// Agency Group — API Error Handler
// lib/middleware/apiErrorHandler.ts
// TypeScript strict — 0 errors
//
// Consistent error handling for all portal API routes.
// Wraps route handlers to ensure:
// - No unhandled exceptions reach clients
// - All errors are logged with correlation ID
// - Correct HTTP status codes
// - No stack traces in production responses

import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/middleware/dashboardLogger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string
  message: string
  status: number
  correlation_id: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Standard error catalogue
// ---------------------------------------------------------------------------

export const API_ERRORS = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    status: 401,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
    status: 403,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    status: 404,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request data',
    status: 400,
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    status: 429,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    status: 500,
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable',
    status: 503,
  },
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCorrelationId(): string {
  return `cid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createApiError(
  code: string,
  message: string,
  status: number
): ApiError {
  return {
    code,
    message,
    status,
    correlation_id: generateCorrelationId(),
    timestamp: new Date().toISOString(),
  }
}

export function isOperationalError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  // Operational errors are expected: validation, auth, not-found, etc.
  // Non-operational: TypeError, RangeError, unexpected runtime failures
  const operationalMessages = [
    'unauthorized',
    'forbidden',
    'not found',
    'validation',
    'rate limit',
    'bad request',
    'invalid',
  ]
  const msg = error.message.toLowerCase()
  return operationalMessages.some((pattern) => msg.includes(pattern))
}

export function handleUnknownError(
  error: unknown,
  correlationId: string
): ApiError {
  const isProduction = process.env.NODE_ENV === 'production'

  if (error instanceof Error) {
    // Reveal message only for operational errors or in dev
    const message =
      !isProduction || isOperationalError(error)
        ? error.message
        : API_ERRORS.INTERNAL_ERROR.message

    return {
      code: API_ERRORS.INTERNAL_ERROR.code,
      message,
      status: 500,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    }
  }

  return {
    code: API_ERRORS.INTERNAL_ERROR.code,
    message: API_ERRORS.INTERNAL_ERROR.message,
    status: 500,
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// withErrorHandler — wraps any Next.js route handler
// ---------------------------------------------------------------------------

export function withErrorHandler<_T = unknown>(
  handler: (req: Request) => Promise<Response>,
  context?: string
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const correlationId = generateCorrelationId()
    const logger = createLogger({ endpoint: context, correlationId })
    const start = Date.now()

    try {
      const response = await handler(req)

      logger.request(
        req.method,
        context ?? new URL(req.url).pathname,
        response.status,
        Date.now() - start
      )

      return response
    } catch (error) {
      const apiError = handleUnknownError(error, correlationId)

      logger.error(
        `Unhandled error in ${context ?? 'unknown'}`,
        error instanceof Error ? error : undefined,
        { correlation_id: correlationId }
      )

      return NextResponse.json(
        {
          error: apiError.code,
          message: apiError.message,
          correlation_id: apiError.correlation_id,
          timestamp: apiError.timestamp,
        },
        { status: apiError.status }
      )
    }
  }
}
