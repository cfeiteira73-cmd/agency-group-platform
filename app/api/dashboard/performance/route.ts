// app/api/dashboard/performance/route.ts
// Dashboard performance metrics endpoint
// GET  = performance report for last N hours (default 24h)
// POST = trigger fresh performance analysis and persist
// runtime = 'nodejs', maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import {
  generatePerformanceReport,
  recordMetric,
} from '@/lib/dashboard/performanceMonitor'
import { validateSchema } from '@/lib/middleware/requestValidation'
import type { Schema } from '@/lib/middleware/requestValidation'

export const runtime = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// GET /api/dashboard/performance
// Query params: ?hours=24 (default) | ?hours=48
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const searchParams = req.nextUrl.searchParams
  const rawHours = searchParams.get('hours')
  const periodHours = rawHours !== null ? parseInt(rawHours, 10) : 24

  // Validate period
  if (!Number.isInteger(periodHours) || periodHours < 1 || periodHours > 168) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: "'hours' must be between 1 and 168" },
      { status: 400 }
    )
  }

  // Resolve tenant_id: try header first, then fall back to placeholder
  const tenantId =
    req.headers.get('x-tenant-id') ??
    '00000000-0000-0000-0000-000000000000'

  try {
    const report = await generatePerformanceReport(tenantId, periodHours)
    return NextResponse.json({ data: report }, { status: 200 })
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate performance report' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/dashboard/performance
// Body: { tenant_id, endpoint, method, response_time_ms, status_code,
//         db_queries_count?, cache_hit? }
// Records a single metric sample (used by internal instrumentation)
// ---------------------------------------------------------------------------

const RECORD_SCHEMA: Schema = {
  tenant_id: { type: 'uuid', required: true },
  endpoint: { type: 'string', required: true, maxLength: 500 },
  method: {
    type: 'string',
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
  response_time_ms: { type: 'number', required: true, min: 0, max: 300_000 },
  status_code: { type: 'number', required: true, min: 100, max: 599 },
  db_queries_count: { type: 'number', required: false, min: 0, max: 10_000 },
  cache_hit: { type: 'boolean', required: false },
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const validation = validateSchema(body, RECORD_SCHEMA)
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Invalid request data', details: validation.errors },
      { status: 400 }
    )
  }

  const payload = body as {
    tenant_id: string
    endpoint: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    response_time_ms: number
    status_code: number
    db_queries_count?: number
    cache_hit?: boolean
  }

  await recordMetric({
    tenant_id: payload.tenant_id,
    endpoint: payload.endpoint,
    method: payload.method,
    response_time_ms: payload.response_time_ms,
    status_code: payload.status_code,
    db_queries_count: payload.db_queries_count ?? null,
    cache_hit: payload.cache_hit ?? false,
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
