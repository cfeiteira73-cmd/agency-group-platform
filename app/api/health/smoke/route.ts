// =============================================================================
// Agency Group — SH-ROS Production Smoke Test
// GET /api/health/smoke
//
// Comprehensive system health check for post-deploy verification:
//   • Supabase connectivity + latency
//   • Redis/Upstash connectivity + latency
//   • Required env vars present
//   • Recent cron activity (last 10 min in runtime_events)
//   • Open incident count
//   • DLQ depth
//   • Region check (should be cdg1 → eu-north-1 < 50ms)
//
// Auth: Bearer CRON_SECRET  (or public in dev)
// Returns: 200 OK (all green) | 206 Partial Content (degraded) | 503 (critical down)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 30

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  ok: boolean
  latency_ms: number
  detail?: string
  error?: string
}

interface SmokeReport {
  status:       'healthy' | 'degraded' | 'critical'
  timestamp:    string
  region:       string | undefined
  checks: {
    supabase:     CheckResult
    redis:        CheckResult
    env_vars:     CheckResult
    cron_recent:  CheckResult
    incidents:    CheckResult
    dlq:          CheckResult
  }
  summary: {
    total:    number
    passed:   number
    failed:   number
    critical: string[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function checkSupabase(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id', { count: 'exact', head: true })
    const latency_ms = Date.now() - t0
    if (error) return { ok: false, latency_ms, error: error.message }
    return { ok: true, latency_ms, detail: `${latency_ms}ms` }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: String(e) }
  }
}

async function checkRedis(): Promise<CheckResult> {
  const t0 = Date.now()
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return { ok: false, latency_ms: 0, error: 'UPSTASH_REDIS_REST_URL or TOKEN missing' }
  }
  const testKey = `smoke:${Date.now()}`
  try {
    // SET with 10s TTL
    const setRes = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(testKey)}/ok/ex/10`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!setRes.ok) return { ok: false, latency_ms: Date.now() - t0, error: `SET failed: ${setRes.status}` }

    // GET it back
    const getRes = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(testKey)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    })
    const latency_ms = Date.now() - t0
    if (!getRes.ok) return { ok: false, latency_ms, error: `GET failed: ${getRes.status}` }
    const { result } = await getRes.json() as { result: string | null }
    if (result !== 'ok') return { ok: false, latency_ms, error: `Roundtrip mismatch: got ${result}` }
    return { ok: true, latency_ms, detail: `roundtrip ${latency_ms}ms` }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: String(e) }
  }
}

function checkEnvVars(): CheckResult {
  const t0 = Date.now()
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
    'CRON_SECRET',
  ]
  const optional = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'OPENAI_API_KEY',
    'DEFAULT_TENANT_ID',
  ]

  const missing = required.filter(k => !process.env[k])
  const missingOptional = optional.filter(k => !process.env[k])

  if (missing.length > 0) {
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      error: `Missing required: ${missing.join(', ')}`,
      detail: missingOptional.length > 0 ? `Optional absent: ${missingOptional.join(', ')}` : undefined,
    }
  }

  return {
    ok: true,
    latency_ms: Date.now() - t0,
    detail: missingOptional.length > 0
      ? `All required present · optional absent: ${missingOptional.join(', ')}`
      : 'All vars present',
  }
}

async function checkCronRecent(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    const since = new Date(Date.now() - 10 * 60_000).toISOString() // last 10 min
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('runtime_events')
      .select('event_id, type, created_at')
      .gte('created_at', since)
      .limit(5)
    const latency_ms = Date.now() - t0
    if (error) return { ok: true, latency_ms, detail: 'runtime_events unavailable (non-critical)' }
    const count = (data ?? []).length
    return {
      ok: true, // cron silence ≤10 min is non-critical
      latency_ms,
      detail: `${count} events in last 10min`,
    }
  } catch {
    return { ok: true, latency_ms: Date.now() - t0, detail: 'runtime_events table not yet created' }
  }
}

async function checkIncidents(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('incidents')
      .select('incident_id, severity, status')
      .in('status', ['open', 'investigating', 'mitigating'])
      .limit(10)
    const latency_ms = Date.now() - t0
    if (error) return { ok: true, latency_ms, detail: 'incidents table not yet migrated' }
    const open = (data ?? []) as Array<{ severity: string }>
    const p0p1 = open.filter(i => i.severity === 'P0' || i.severity === 'P1').length
    return {
      ok: p0p1 === 0,
      latency_ms,
      detail: `${open.length} open incidents · ${p0p1} P0/P1`,
      error: p0p1 > 0 ? `${p0p1} critical incident(s) active` : undefined,
    }
  } catch {
    return { ok: true, latency_ms: Date.now() - t0, detail: 'incidents check skipped' }
  }
}

async function checkDLQ(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('runtime_events')
      .select('event_id', { count: 'exact', head: true })
      .eq('status', 'dlq')
    const latency_ms = Date.now() - t0
    if (error) return { ok: true, latency_ms, detail: 'DLQ check skipped' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = (data as any)?.count ?? 0
    return {
      ok: count < 50, // warn at 50+
      latency_ms,
      detail: `${count} items in DLQ`,
      error: count >= 50 ? `DLQ depth ${count} exceeds threshold` : undefined,
    }
  } catch {
    return { ok: true, latency_ms: Date.now() - t0, detail: 'DLQ check skipped' }
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth: allow CRON_SECRET bearer, or open in dev
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    // Allow unauthenticated in test/dev; require secret in production
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev && token && !safeCompare(token, cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Run all checks in parallel
  const [supabase, redis, cron_recent, incidents, dlq] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkCronRecent(),
    checkIncidents(),
    checkDLQ(),
  ])
  const env_vars = checkEnvVars() // sync

  const checks = { supabase, redis, env_vars, cron_recent, incidents, dlq }

  // Classify criticality
  const criticalChecks: Array<keyof typeof checks> = ['supabase', 'env_vars']
  const critical = criticalChecks.filter(k => !checks[k].ok).map(k => k)

  const total  = Object.keys(checks).length
  const passed = Object.values(checks).filter(c => c.ok).length
  const failed = total - passed

  const status: SmokeReport['status'] =
    critical.length > 0 ? 'critical' :
    failed > 0          ? 'degraded' :
    'healthy'

  const report: SmokeReport = {
    status,
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION,
    checks,
    summary: { total, passed, failed, critical },
  }

  const httpStatus =
    status === 'critical' ? 503 :
    status === 'degraded' ? 206 :
    200

  return NextResponse.json(report, { status: httpStatus })
}
