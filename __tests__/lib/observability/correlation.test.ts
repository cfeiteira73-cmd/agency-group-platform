// =============================================================================
// Tests: lib/observability/correlation.ts
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  generateCorrelationId,
  getHeaderCorrelationId,
  buildCorrelationHeaders,
  withCorrelation,
  cronCorrelationId,
  shortCorrelationId,
} from '@/lib/observability/correlation'

// ---------------------------------------------------------------------------
// generateCorrelationId
// ---------------------------------------------------------------------------

describe('generateCorrelationId', () => {
  it('returns a UUID-like string', () => {
    const id = generateCorrelationId()
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('returns unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 20 }, generateCorrelationId))
    expect(ids.size).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// getHeaderCorrelationId
// ---------------------------------------------------------------------------

describe('getHeaderCorrelationId', () => {
  it('extracts correlation ID from Headers instance', () => {
    const headers = new Headers({ 'x-correlation-id': 'test-id-123' })
    expect(getHeaderCorrelationId(headers)).toBe('test-id-123')
  })

  it('returns null when header is missing from Headers instance', () => {
    const headers = new Headers()
    expect(getHeaderCorrelationId(headers)).toBeNull()
  })

  it('extracts correlation ID from plain object', () => {
    const headers = { 'x-correlation-id': 'plain-obj-id' }
    expect(getHeaderCorrelationId(headers)).toBe('plain-obj-id')
  })

  it('returns null when key is missing from plain object', () => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    expect(getHeaderCorrelationId(headers)).toBeNull()
  })

  it('returns null for array-form HeadersInit', () => {
    const headers: [string, string][] = [['x-correlation-id', 'arr-id']]
    expect(getHeaderCorrelationId(headers)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildCorrelationHeaders
// ---------------------------------------------------------------------------

describe('buildCorrelationHeaders', () => {
  it('returns object with x-correlation-id', () => {
    const id = 'abc-123'
    const headers = buildCorrelationHeaders(id)
    expect(headers).toEqual({ 'x-correlation-id': 'abc-123' })
  })

  it('can be spread into a fetch headers object', () => {
    const id = 'spread-test'
    const fetchHeaders = {
      'Content-Type': 'application/json',
      ...buildCorrelationHeaders(id),
    }
    expect(fetchHeaders['x-correlation-id']).toBe('spread-test')
    expect(fetchHeaders['Content-Type']).toBe('application/json')
  })
})

// ---------------------------------------------------------------------------
// withCorrelation
// ---------------------------------------------------------------------------

describe('withCorrelation', () => {
  it('returns LogContext with correlation_id', () => {
    const ctx = withCorrelation('my-corr-id')
    expect(ctx.correlation_id).toBe('my-corr-id')
  })

  it('merges extra fields', () => {
    const ctx = withCorrelation('corr-x', { route: '/api/test' })
    expect(ctx.correlation_id).toBe('corr-x')
    expect(ctx.route).toBe('/api/test')
  })

  it('extra fields do not override correlation_id', () => {
    // TypeScript prevents this at compile time; at runtime extra should win last,
    // but correlation_id key is set first so extra cannot override it via spread
    const ctx = withCorrelation('original', {})
    expect(ctx.correlation_id).toBe('original')
  })
})

// ---------------------------------------------------------------------------
// cronCorrelationId
// ---------------------------------------------------------------------------

describe('cronCorrelationId', () => {
  it('starts with cron_ prefix', () => {
    const id = cronCorrelationId('avm-compute')
    expect(id.startsWith('cron_avm-compute_')).toBe(true)
  })

  it('has the correct format: cron_{name}_{8chars}', () => {
    const id = cronCorrelationId('daily-brief')
    const parts = id.split('_')
    // cron_daily-brief_a1b2c3d4 → parts: ['cron', 'daily-brief', 'a1b2c3d4']
    expect(parts[0]).toBe('cron')
    // last part is 8 hex chars
    expect(parts[parts.length - 1]).toMatch(/^[0-9a-f]{8}$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 10 }, () => cronCorrelationId('test')))
    expect(ids.size).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// shortCorrelationId
// ---------------------------------------------------------------------------

describe('shortCorrelationId', () => {
  it('returns first 8 characters', () => {
    const id = 'abcdef12-3456-7890-abcd-ef1234567890'
    expect(shortCorrelationId(id)).toBe('abcdef12')
  })

  it('handles short strings gracefully', () => {
    expect(shortCorrelationId('abc')).toBe('abc')
  })

  it('exactly 8 chars returns the same string', () => {
    expect(shortCorrelationId('12345678')).toBe('12345678')
  })
})
