// =============================================================================
// Agency Group — Manual Ingestion Trigger
// app/api/ingestion/run/route.ts
//
// POST /api/ingestion/run
// Queues an ingestion job and returns 202 Accepted immediately.
// Actual processing happens asynchronously via the 'enrichment' worker.
//
// Body: { provider?: 'casafari' | 'idealista' | 'all'; tenant_id?: string; limit?: number }
// Response (202): { run_id, status: 'queued', message }
//
// Auth: requirePortalAuth (session cookie, magic-link, or service token)
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { getQueueAdapter }           from '@/lib/queue/adapter'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

export const runtime = 'nodejs'

// ─── Allowed provider values ──────────────────────────────────────────────────

const VALID_PROVIDERS = ['casafari', 'idealista', 'all'] as const
type Provider = typeof VALID_PROVIDERS[number]

function isValidProvider(v: unknown): v is Provider {
  return typeof v === 'string' && (VALID_PROVIDERS as readonly string[]).includes(v)
}

// ─── POST /api/ingestion/run ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { provider?: unknown; tenant_id?: unknown; limit?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Validate provider ────────────────────────────────────────────────────────
  const rawProvider = body.provider ?? 'all'
  if (!isValidProvider(rawProvider)) {
    return NextResponse.json(
      {
        error:            'Invalid provider',
        valid_providers:  VALID_PROVIDERS,
        received:         rawProvider,
      },
      { status: 400 },
    )
  }
  const provider: Provider = rawProvider

  // ── Coerce other fields ───────────────────────────────────────────────────────
  const limit    = typeof body.limit     === 'number' ? body.limit     : 50
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : 'agency-group'

  // ── Build run ID ──────────────────────────────────────────────────────────────
  const runId  = `ingest-${Date.now()}`
  const corrId = getRequestCorrelationId(req)

  // ── Enqueue the ingestion job ─────────────────────────────────────────────────
  try {
    const adapter = getQueueAdapter()

    await adapter.enqueue(
      'enrichment_jobs',
      {
        run_id:    runId,
        provider,
        limit,
        tenant_id: tenantId,
        queued_by: auth.email,
        queued_at: new Date().toISOString(),
      },
      {
        tenant_id:      tenantId,
        correlation_id: corrId,
      },
    )
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[ingestion/run] Failed to enqueue run_id=${runId}: ${errMsg}`)
    return NextResponse.json(
      { error: 'Failed to queue ingestion job', detail: errMsg },
      { status: 500 },
    )
  }

  console.log(
    `[ingestion/run] Queued run_id=${runId} provider=${provider} limit=${limit} tenant=${tenantId} by=${auth.email}`,
  )

  const res = NextResponse.json(
    {
      run_id:  runId,
      status:  'queued',
      message: `Ingestion job queued for provider="${provider}". Poll /api/ingestion/status?run_id=${runId} for results.`,
    },
    { status: 202 },
  )
  res.headers.set('x-correlation-id', corrId)
  res.headers.set('x-run-id', runId)
  return res
}
