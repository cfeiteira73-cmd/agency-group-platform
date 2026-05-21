// =============================================================================
// Agency Group — Online Inference API
// app/api/intelligence/infer/route.ts
//
// POST /api/intelligence/infer
// Body: InferenceRequest | InferenceRequest[]
// Returns: InferenceResult | InferenceResult[]
// Auth: Bearer INTERNAL_API_SECRET
//
// Handles both single and batch inference (up to 100 entities per batch).
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }              from '@/lib/safeCompare'
import { infer, batchInfer }        from '@/lib/ml/onlineInference'
import type { InferenceRequest }    from '@/lib/ml/onlineInference'
import log                          from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const VALID_ENTITY_TYPES = new Set(['property', 'investor', 'deal'])

function isValidRequest(obj: unknown): obj is InferenceRequest {
  if (!obj || typeof obj !== 'object') return false
  const r = obj as Record<string, unknown>
  return (
    typeof r['entity_type'] === 'string' &&
    VALID_ENTITY_TYPES.has(r['entity_type']) &&
    typeof r['entity_id'] === 'string' &&
    r['entity_id'].length > 0 &&
    typeof r['tenant_id'] === 'string' &&
    r['tenant_id'].length > 0
  )
}

// ---------------------------------------------------------------------------
// POST /api/intelligence/infer
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Determine if batch or single request
  const isBatch = Array.isArray(body)

  if (isBatch) {
    // ---------- Batch inference ----------
    const rawRequests = body as unknown[]

    if (rawRequests.length === 0) {
      return NextResponse.json({ error: 'Empty batch' }, { status: 400 })
    }

    if (rawRequests.length > 100) {
      return NextResponse.json(
        { error: 'Batch size exceeds maximum of 100' },
        { status: 400 },
      )
    }

    // Validate all requests
    const invalid = rawRequests.findIndex(r => !isValidRequest(r))
    if (invalid !== -1) {
      return NextResponse.json(
        { error: `Invalid request at index ${invalid}: entity_type, entity_id, and tenant_id are required` },
        { status: 400 },
      )
    }

    const requests = rawRequests as InferenceRequest[]

    try {
      const results = await batchInfer(requests)
      return NextResponse.json(results)
    } catch (err) {
      log.error('[api/intelligence/infer] batch inference failed', err instanceof Error ? err : undefined, {
        error: err instanceof Error ? err.message : String(err),
        batch_size: requests.length,
      })
      return NextResponse.json(
        { error: 'Batch inference failed', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      )
    }
  } else {
    // ---------- Single inference ----------
    if (!isValidRequest(body)) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and tenant_id are required' },
        { status: 400 },
      )
    }

    const request = body as InferenceRequest

    try {
      const result = await infer(request)
      return NextResponse.json(result)
    } catch (err) {
      log.error('[api/intelligence/infer] single inference failed', err instanceof Error ? err : undefined, {
        error:       err instanceof Error ? err.message : String(err),
        entity_type: request.entity_type,
        entity_id:   request.entity_id,
      })
      return NextResponse.json(
        { error: 'Inference failed', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      )
    }
  }
}
