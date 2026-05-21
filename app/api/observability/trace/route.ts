// =============================================================================
// Agency Group — Observability Trace API
// app/api/observability/trace/route.ts
//
// GET /api/observability/trace?correlation_id=<uuid>
//   Returns the full request lifecycle for a correlation_id:
//     • request_traces row (performance envelope)
//     • causal_trace steps (event → decision → mutation chain)
//     • learning_events linked to this correlation_id (if any)
//
// GET /api/observability/trace?deal_id=<uuid>
//   Returns all traces associated with a specific deal (via causal_trace
//   rows where entity_type = 'deal' and entity_id = deal_id).
//
// Auth: Bearer INTERNAL_API_SECRET or Bearer ADMIN_SECRET
//       (same guard used by /api/observability/timeline)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { safeCompare }               from '@/lib/safeCompare'
import {
  getCausalChain,
  reconstructLineage,
  type CausalStep,
  type CausalLineage,
} from '@/lib/observability/causalTrace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceRow {
  id: string
  trace_id: string
  correlation_id: string
  tenant_id: string | null
  path: string
  method: string
  status_code: number | null
  duration_ms: number | null
  ai_tokens_used: number
  ai_latency_ms: number
  db_queries: number
  db_latency_ms: number
  spans: unknown[]
  started_at: string
  completed_at: string | null
}

interface LearningEventRow {
  id: string
  event_type: string
  correlation_id: string | null
  deal_id: string | null
  agent_email: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

interface FullTrace {
  correlation_id: string
  request_trace:   TraceRow | null
  causal_chain:    CausalStep[]
  lineage:         CausalLineage
  learning_events: LearningEventRow[]
  assembled_at:    string
}

interface DealTraceResult {
  deal_id:        string
  causal_steps:   CausalStep[]
  correlation_ids: string[]
  assembled_at:   string
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const token    = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (!token) return false
  if (internal && safeCompare(token, internal)) return true
  if (admin    && safeCompare(token, admin))    return true
  return false
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role)
// ---------------------------------------------------------------------------

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Fetch the request_traces row for a correlation_id (may be null). */
async function getRequestTrace(correlationId: string): Promise<TraceRow | null> {
  const client = getClient()
  if (!client) return null
  try {
    const { data, error } = await client
      .from('request_traces')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('[trace] request_traces fetch failed:', error.message)
      return null
    }
    return data as TraceRow | null
  } catch {
    return null
  }
}

/** Fetch learning_events rows for a correlation_id. */
async function getLearningEvents(correlationId: string): Promise<LearningEventRow[]> {
  const client = getClient()
  if (!client) return []
  try {
    const { data, error } = await client
      .from('learning_events')
      .select('id, event_type, correlation_id, deal_id, agent_email, created_at, metadata')
      .eq('correlation_id', correlationId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) {
      console.warn('[trace] learning_events fetch failed:', error.message)
      return []
    }
    return (data ?? []) as LearningEventRow[]
  } catch {
    return []
  }
}

/** Fetch all causal_trace rows where entity_type='deal' and entity_id=dealId. */
async function getCausalStepsByDeal(dealId: string): Promise<CausalStep[]> {
  const client = getClient()
  if (!client) return []
  try {
    const { data, error } = await client
      .from('causal_trace')
      .select('*')
      .eq('entity_type', 'deal')
      .eq('entity_id', dealId)
      .order('created_at', { ascending: true })
      .limit(500)
    if (error) {
      console.warn('[trace] causal_trace deal fetch failed:', error.message)
      return []
    }
    return (data ?? []) as CausalStep[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp             = req.nextUrl.searchParams
  const correlationId  = sp.get('correlation_id')
  const dealId         = sp.get('deal_id')

  // Exactly one of correlation_id or deal_id must be provided
  if (!correlationId && !dealId) {
    return NextResponse.json(
      { error: 'Provide either correlation_id or deal_id as a query parameter' },
      { status: 400 },
    )
  }
  if (correlationId && dealId) {
    return NextResponse.json(
      { error: 'Provide correlation_id OR deal_id, not both' },
      { status: 400 },
    )
  }

  // ── Mode: deal_id query ───────────────────────────────────────────────────

  if (dealId) {
    try {
      const causalSteps    = await getCausalStepsByDeal(dealId)
      const correlationIds = [...new Set(causalSteps.map(s => s.correlation_id).filter(Boolean))]

      const result: DealTraceResult = {
        deal_id:         dealId,
        causal_steps:    causalSteps,
        correlation_ids: correlationIds,
        assembled_at:    new Date().toISOString(),
      }
      return NextResponse.json(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[trace] deal_id query error:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // ── Mode: correlation_id query ────────────────────────────────────────────

  // correlationId is guaranteed non-null here (checked above)
  const corrId = correlationId!

  // Validate UUID-ish format to prevent injection into DB queries
  if (!/^[a-zA-Z0-9\-_:]{8,128}$/.test(corrId)) {
    return NextResponse.json(
      { error: 'correlation_id contains invalid characters' },
      { status: 400 },
    )
  }

  try {
    // Fetch all three data sources in parallel
    const [requestTrace, causalChain, learningEvents] = await Promise.all([
      getRequestTrace(corrId),
      getCausalChain(corrId),
      getLearningEvents(corrId),
    ])

    // Reconstruct full causal lineage (revenue totals, agent list, entity map)
    const lineage = await reconstructLineage(corrId)

    const fullTrace: FullTrace = {
      correlation_id:  corrId,
      request_trace:   requestTrace,
      causal_chain:    causalChain,
      lineage,
      learning_events: learningEvents,
      assembled_at:    new Date().toISOString(),
    }

    return NextResponse.json(fullTrace)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[trace] correlation_id query error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
