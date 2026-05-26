// AGENCY GROUP — SH-ROS | AMI: 22506
// app/api/observability/control-plane/route.ts
// Advanced Observability + Control Plane API
// Wave 44 Agent 4
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import {
  getTrace,
  getSlowOperations,
  getTraceHealth,
} from '@/lib/observability/distributedTracingEngine'
import {
  recordMetric,
  runFullAnomalyScan,
  resolveAnomaly,
  getActiveAlerts,
  type MetricName,
} from '@/lib/observability/anomalyDetectionEngine'
import {
  inferRootCause,
  getRecentRcaHistory,
} from '@/lib/observability/rootCauseInferenceEngine'
import {
  capturePerformanceSnapshot,
  getPerformanceTrend,
} from '@/lib/observability/controlPlaneEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function verifyBearer(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.CRON_SECRET ?? ''
  if (!expected) return true // no secret configured — allow in dev
  return safeCompare(token, expected)
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'health'

  try {
    switch (mode) {
      case 'trace': {
        const traceId = searchParams.get('trace_id')
        if (!traceId) {
          return NextResponse.json({ error: 'trace_id is required' }, { status: 400 })
        }
        const spans = await getTrace(traceId)
        return NextResponse.json({ trace_id: traceId, spans, count: spans.length })
      }

      case 'slow-ops': {
        const thresholdMs = Number(searchParams.get('threshold_ms') ?? 2000)
        const hours = Number(searchParams.get('hours') ?? 24)
        const ops = await getSlowOperations(TENANT_ID, thresholdMs, hours)
        return NextResponse.json({ slow_operations: ops, threshold_ms: thresholdMs })
      }

      case 'anomalies': {
        const alerts = await getActiveAlerts(TENANT_ID)
        return NextResponse.json({ active_alerts: alerts, count: alerts.length })
      }

      case 'performance': {
        const snapshot = await capturePerformanceSnapshot(TENANT_ID)
        return NextResponse.json(snapshot, {
          headers: { 'Content-Type': 'application/json' },
          // BigInt is not JSON-serialisable — convert to string
          replacer: (_k: string, v: unknown) =>
            typeof v === 'bigint' ? v.toString() : v,
        } as Parameters<typeof NextResponse.json>[1])
      }

      case 'trend': {
        const hours = Number(searchParams.get('hours') ?? 24)
        const trend = await getPerformanceTrend(TENANT_ID, hours)
        return NextResponse.json({ snapshots: trend, hours })
      }

      case 'rca': {
        const limit = Number(searchParams.get('limit') ?? 20)
        const history = await getRecentRcaHistory(TENANT_ID, limit)
        return NextResponse.json({ rca_history: history })
      }

      case 'health':
      default: {
        const [traceHealth, activeAlerts] = await Promise.all([
          getTraceHealth(TENANT_ID),
          getActiveAlerts(TENANT_ID),
        ])
        return NextResponse.json({
          trace_health: traceHealth,
          active_alerts: activeAlerts,
          active_anomaly_count: activeAlerts.length,
        })
      }
    }
  } catch (e) {
    console.error('[control-plane GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  try {
    switch (action) {
      case 'record-metric': {
        const metricName = body.metric_name as MetricName | undefined
        const value = body.value as number | undefined
        if (!metricName || value === undefined) {
          return NextResponse.json(
            { error: 'metric_name and value are required' },
            { status: 400 }
          )
        }
        recordMetric(metricName, value, TENANT_ID)
        return NextResponse.json({ ok: true, action, metric_name: metricName, value })
      }

      case 'scan-anomalies': {
        const result = await runFullAnomalyScan(TENANT_ID)
        return NextResponse.json({ ok: true, ...result })
      }

      case 'infer-rca': {
        const alertIds = body.alert_ids as string[] | undefined
        if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
          return NextResponse.json({ error: 'alert_ids array is required' }, { status: 400 })
        }
        const rca = await inferRootCause(alertIds, TENANT_ID)
        return NextResponse.json({ ok: true, rca })
      }

      case 'resolve-anomaly': {
        const alertId = body.alert_id as string | undefined
        if (!alertId) {
          return NextResponse.json({ error: 'alert_id is required' }, { status: 400 })
        }
        await resolveAnomaly(alertId)
        return NextResponse.json({ ok: true, alert_id: alertId, resolved: true })
      }

      default:
        return NextResponse.json(
          {
            error: 'Unknown action',
            valid_actions: ['record-metric', 'scan-anomalies', 'infer-rca', 'resolve-anomaly'],
          },
          { status: 400 }
        )
    }
  } catch (e) {
    console.error('[control-plane POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
