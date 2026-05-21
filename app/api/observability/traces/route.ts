// Agency Group — Observability Traces API
// app/api/observability/traces/route.ts
// Unified observability query endpoint:
//   GET ?trace_id=xxx       → single trace
//   GET ?mode=recent        → last N traces
//   GET ?mode=anomalies     → anomaly detection report
//   GET ?mode=root-cause    → root cause inference report
//   GET ?mode=errors        → error cluster report
// Auth: requirePortalAuth — session or service token required
// TypeScript strict — 0 errors

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getTrace, getRecentTraces } from '@/lib/observability/distributedTracer'
import { buildErrorClusterReport } from '@/lib/observability/errorClusterer'
import { inferRootCauses } from '@/lib/observability/rootCauseInference'
import { detectAnomalies } from '@/lib/observability/anomalyDetector'

// ─── Canonical tenant ─────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth gate
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const { searchParams } = req.nextUrl
  const traceId = searchParams.get('trace_id')
  const mode = searchParams.get('mode')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  // ── ?trace_id=xxx ──────────────────────────────────────────────────────────
  if (traceId) {
    const trace = await getTrace(traceId, TENANT_ID)
    if (!trace) {
      return NextResponse.json({ error: 'Trace not found', trace_id: traceId }, { status: 404 })
    }
    return NextResponse.json({ trace }, { status: 200 })
  }

  // ── ?mode=recent ──────────────────────────────────────────────────────────
  if (mode === 'recent') {
    const traces = await getRecentTraces(TENANT_ID, limit)
    return NextResponse.json({ traces, count: traces.length }, { status: 200 })
  }

  // ── ?mode=anomalies ───────────────────────────────────────────────────────
  if (mode === 'anomalies') {
    const report = await detectAnomalies(TENANT_ID)
    return NextResponse.json({ report }, { status: 200 })
  }

  // ── ?mode=root-cause ──────────────────────────────────────────────────────
  if (mode === 'root-cause') {
    const windowMinutes = parseInt(searchParams.get('window_minutes') ?? '30', 10)
    const report = await inferRootCauses(TENANT_ID, windowMinutes)
    return NextResponse.json({ report }, { status: 200 })
  }

  // ── ?mode=errors ──────────────────────────────────────────────────────────
  if (mode === 'errors') {
    const windowHours = parseInt(searchParams.get('window_hours') ?? '24', 10)
    const report = await buildErrorClusterReport(TENANT_ID, windowHours)
    return NextResponse.json({ report }, { status: 200 })
  }

  // ── No recognized params — return usage ───────────────────────────────────
  return NextResponse.json(
    {
      error: 'Missing required query parameter',
      usage: {
        'GET ?trace_id=<uuid>': 'Fetch a specific trace by ID',
        'GET ?mode=recent&limit=20': 'Fetch N most recent root-level traces',
        'GET ?mode=anomalies': 'Run statistical anomaly detection across all metrics',
        'GET ?mode=root-cause&window_minutes=30': 'Run rule-based root cause inference',
        'GET ?mode=errors&window_hours=24': 'Run error clustering and storm detection',
      },
    },
    { status: 400 }
  )
}
