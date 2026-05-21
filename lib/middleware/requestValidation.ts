// Agency Group — Request Validation Middleware
// lib/middleware/requestValidation.ts
// TypeScript strict — 0 errors
//
// Lightweight request validation without Zod (to avoid adding dependencies).
// Validates: required fields, type checking, string length, number ranges.
// Used in new API routes for portal operations.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'uuid'
  | 'email'
  | 'array'
  | 'object'

export interface FieldSpec {
  type: FieldType
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: string[]
}

export type Schema = Record<string, FieldSpec>

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUUID(value: string): boolean {
  return UUID_RE.test(value)
}

export function validateEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254
}

export function sanitizeString(value: string, maxLength = 10_000): string {
  // Trim whitespace and remove null bytes
  return value.replace(/\0/g, '').trim().slice(0, maxLength)
}

// ---------------------------------------------------------------------------
// validateSchema — validates an arbitrary object against a Schema definition
// ---------------------------------------------------------------------------

export function validateSchema(data: unknown, schema: Schema): ValidationResult {
  const errors: string[] = []

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Request body must be a JSON object'] }
  }

  const obj = data as Record<string, unknown>

  for (const [field, spec] of Object.entries(schema)) {
    const value = obj[field]
    const missing = value === undefined || value === null

    // Required check
    if (spec.required && missing) {
      errors.push(`Field '${field}' is required`)
      continue
    }

    // Skip optional missing fields
    if (missing) continue

    // Type checks
    switch (spec.type) {
      case 'string': {
        if (typeof value !== 'string') {
          errors.push(`Field '${field}' must be a string`)
          break
        }
        if (spec.minLength !== undefined && value.length < spec.minLength) {
          errors.push(
            `Field '${field}' must be at least ${spec.minLength} characters`
          )
        }
        if (spec.maxLength !== undefined && value.length > spec.maxLength) {
          errors.push(
            `Field '${field}' must be at most ${spec.maxLength} characters`
          )
        }
        if (spec.pattern && !spec.pattern.test(value)) {
          errors.push(`Field '${field}' has an invalid format`)
        }
        if (spec.enum && !spec.enum.includes(value)) {
          errors.push(
            `Field '${field}' must be one of: ${spec.enum.join(', ')}`
          )
        }
        break
      }

      case 'uuid': {
        if (typeof value !== 'string' || !validateUUID(value)) {
          errors.push(`Field '${field}' must be a valid UUID`)
        }
        break
      }

      case 'email': {
        if (typeof value !== 'string' || !validateEmail(value)) {
          errors.push(`Field '${field}' must be a valid email address`)
        }
        break
      }

      case 'number': {
        if (typeof value !== 'number' || !isFinite(value)) {
          errors.push(`Field '${field}' must be a finite number`)
          break
        }
        if (spec.min !== undefined && value < spec.min) {
          errors.push(`Field '${field}' must be >= ${spec.min}`)
        }
        if (spec.max !== undefined && value > spec.max) {
          errors.push(`Field '${field}' must be <= ${spec.max}`)
        }
        break
      }

      case 'boolean': {
        if (typeof value !== 'boolean') {
          errors.push(`Field '${field}' must be a boolean`)
        }
        break
      }

      case 'array': {
        if (!Array.isArray(value)) {
          errors.push(`Field '${field}' must be an array`)
          break
        }
        if (spec.min !== undefined && value.length < spec.min) {
          errors.push(`Field '${field}' must contain at least ${spec.min} items`)
        }
        if (spec.max !== undefined && value.length > spec.max) {
          errors.push(`Field '${field}' must contain at most ${spec.max} items`)
        }
        break
      }

      case 'object': {
        if (
          value === null ||
          typeof value !== 'object' ||
          Array.isArray(value)
        ) {
          errors.push(`Field '${field}' must be an object`)
        }
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// validatePaginationParams — validates page/limit query params
// ---------------------------------------------------------------------------

export function validatePaginationParams(searchParams: URLSearchParams): {
  page: number
  limit: number
  valid: boolean
} {
  const DEFAULT_PAGE = 1
  const DEFAULT_LIMIT = 20
  const MAX_LIMIT = 100

  const rawPage = searchParams.get('page')
  const rawLimit = searchParams.get('limit')

  const page = rawPage !== null ? parseInt(rawPage, 10) : DEFAULT_PAGE
  const limit = rawLimit !== null ? parseInt(rawLimit, 10) : DEFAULT_LIMIT

  const valid =
    Number.isInteger(page) &&
    page >= 1 &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_LIMIT

  return {
    page: valid ? page : DEFAULT_PAGE,
    limit: valid ? limit : DEFAULT_LIMIT,
    valid,
  }
}

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------

export {
  validateSchema as default,
}
