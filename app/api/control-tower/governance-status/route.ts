// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: AI Governance Status
// GET /api/control-tower/governance-status
// Returns LIVE state for every AI Governance row in the CEO dashboard.
// Never returns hardcoded statuses — all values derived from real system state.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

type StatusLevel = 'ACTIVE' | 'UNAVAILABLE' | 'UNKNOWN'
type AuditStatus = 'LIVE' | 'EMPTY' | 'ERROR'
type CircuitStatus = 'HEALTHY' | 'OPEN' | 'UNKNOWN'
type ReplayStatus = 'READY' | 'ERROR' | 'UNKNOWN'

export interface GovernanceStatusResponse {
  policyEngine:   { status: StatusLevel;  detail: string }
  budgetGovernor: { status: StatusLevel;  detail: string; tokensUsed24h: number }
  circuitBreakers:{ status: CircuitStatus;detail: string; openCircuits: number }
  auditLog:       { status: AuditStatus;  detail: string; entriesLast24h: number }
  replayEngine:   { status: ReplayStatus; detail: string; queueDepth: number }
  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkRedisReachable(): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return false
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const body = await res.json() as { result?: string }
    return body.result === 'PONG'
  } catch {
    return false
  }
}

async function getAuditLogStats(): Promise<{
  exists: boolean
  entriesLast24h: number
  entriesLastHour: number
  error: string | null
}> {
  try {
    const since24h = new Date(Date.now() - 86_400_000).toISOString()
    const since1h  = new Date(Date.now() -  3_600_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }

    const [res24h, res1h] = await Promise.all([
      sb.from('ai_audit_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24h),
      sb.from('ai_audit_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since1h),
    ])

    if (res24h.error) {
      return { exists: false, entriesLast24h: 0, entriesLastHour: 0, error: res24h.error.message }
    }

    return {
      exists: true,
      entriesLast24h: res24h.count ?? 0,
      entriesLastHour: res1h.count ?? 0,
      error: null,
    }
  } catch (err) {
    return { exists: false, entriesLast24h: 0, entriesLastHour: 0, error: String(err) }
  }
}

async function getOpenAIIncidents(): Promise<{ count: number; error: string | null }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('incidents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'investigating'])

    if (error) return { count: 0, error: error.message }
    return { count: count ?? 0, error: null }
  } catch (err) {
    return { count: 0, error: String(err) }
  }
}

async function getCircuitBreakerState(): Promise<{
  openCircuits: number
  error: string | null
}> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { openCircuits: 0, error: 'Redis not configured' }

  try {
    // Circuit breaker keys follow the pattern: circuit:*:state = 'open'
    const keysRes = await fetch(`${url}/keys/circuit:*:state`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!keysRes.ok) return { openCircuits: 0, error: `Redis keys scan failed: ${keysRes.status}` }

    const { result: keys } = await keysRes.json() as { result: string[] }
    if (!keys || keys.length === 0) return { openCircuits: 0, error: null }

    // MGET all circuit states
    const mgetRes = await fetch(`${url}/mget/${keys.join('/')}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!mgetRes.ok) return { openCircuits: 0, error: `Redis mget failed: ${mgetRes.status}` }

    const { result: values } = await mgetRes.json() as { result: (string | null)[] }
    const openCount = (values ?? []).filter(v => v === 'open').length
    return { openCircuits: openCount, error: null }
  } catch (err) {
    return { openCircuits: 0, error: String(err) }
  }
}

async function getTokensUsed24h(): Promise<number> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return 0

  const today = new Date().toISOString().slice(0, 10)
  try {
    const res = await fetch(`${url}/get/tokens:used:${today}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return 0
    const { result } = await res.json() as { result: string | null }
    return result ? parseInt(result, 10) : 0
  } catch {
    return 0
  }
}

async function getReplayQueueDepth(): Promise<{ depth: number; error: string | null }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { depth: 0, error: 'Redis not configured' }

  try {
    const res = await fetch(`${url}/llen/replay:queue`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return { depth: 0, error: `Redis llen failed: ${res.status}` }
    const { result } = await res.json() as { result: number | null }
    return { depth: result ?? 0, error: null }
  } catch (err) {
    return { depth: 0, error: String(err) }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [
      redisReachable,
      auditStats,
      openIncidents,
      circuitState,
      tokensUsed24h,
      replayQueue,
    ] = await Promise.all([
      checkRedisReachable(),
      getAuditLogStats(),
      getOpenAIIncidents(),
      getCircuitBreakerState(),
      getTokensUsed24h(),
      getReplayQueueDepth(),
    ])

    // ── Policy Engine ─────────────────────────────────────────────────────────
    // Active = Redis reachable (policy enforcement uses Redis rate-limiting keys)
    const policyEngine: GovernanceStatusResponse['policyEngine'] = !process.env.UPSTASH_REDIS_REST_URL
      ? { status: 'UNKNOWN',     detail: 'UPSTASH_REDIS_REST_URL not configured' }
      : redisReachable
        ? { status: 'ACTIVE',    detail: 'Redis reachable — policy enforcement online' }
        : { status: 'UNAVAILABLE', detail: 'Redis unreachable — policy enforcement degraded' }

    // ── Budget Governor ───────────────────────────────────────────────────────
    const budgetGovernor: GovernanceStatusResponse['budgetGovernor'] = !process.env.UPSTASH_REDIS_REST_URL
      ? { status: 'UNKNOWN',     detail: 'Redis not configured — budget tracking offline', tokensUsed24h: 0 }
      : redisReachable
        ? { status: 'ACTIVE',    detail: `${tokensUsed24h.toLocaleString()} tokens tracked today`, tokensUsed24h }
        : { status: 'UNAVAILABLE', detail: 'Redis unreachable — budget counters unavailable', tokensUsed24h: 0 }

    // ── Circuit Breakers ──────────────────────────────────────────────────────
    let circuitBreakers: GovernanceStatusResponse['circuitBreakers']
    if (circuitState.error === 'Redis not configured') {
      circuitBreakers = { status: 'UNKNOWN', detail: 'Redis not configured — circuit state unknown', openCircuits: 0 }
    } else if (circuitState.error) {
      circuitBreakers = { status: 'UNKNOWN', detail: `State check failed: ${circuitState.error}`, openCircuits: 0 }
    } else if (circuitState.openCircuits > 0) {
      circuitBreakers = {
        status: 'OPEN',
        detail: `${circuitState.openCircuits} circuit(s) open — reduced capacity`,
        openCircuits: circuitState.openCircuits,
      }
    } else {
      circuitBreakers = { status: 'HEALTHY', detail: 'All monitored circuits closed', openCircuits: 0 }
    }

    // ── Audit Log ─────────────────────────────────────────────────────────────
    let auditLog: GovernanceStatusResponse['auditLog']
    if (auditStats.error) {
      auditLog = { status: 'ERROR', detail: `DB error: ${auditStats.error}`, entriesLast24h: 0 }
    } else if (auditStats.entriesLast24h === 0) {
      auditLog = {
        status: 'EMPTY',
        detail: auditStats.exists ? 'Table exists — no entries in last 24h' : 'Table missing or inaccessible',
        entriesLast24h: 0,
      }
    } else {
      auditLog = {
        status: 'LIVE',
        detail: `${auditStats.entriesLast24h} entries in last 24h · ${auditStats.entriesLastHour} in last hour`,
        entriesLast24h: auditStats.entriesLast24h,
      }
    }

    // ── Replay Engine ─────────────────────────────────────────────────────────
    let replayEngine: GovernanceStatusResponse['replayEngine']
    if (replayQueue.error === 'Redis not configured') {
      replayEngine = { status: 'UNKNOWN', detail: 'Redis not configured — replay queue unavailable', queueDepth: 0 }
    } else if (replayQueue.error) {
      replayEngine = { status: 'ERROR', detail: `Queue check failed: ${replayQueue.error}`, queueDepth: 0 }
    } else {
      replayEngine = {
        status: 'READY',
        detail: replayQueue.depth === 0 ? 'Queue empty — no pending replays' : `${replayQueue.depth} item(s) queued`,
        queueDepth: replayQueue.depth,
      }
    }

    const response: GovernanceStatusResponse = {
      policyEngine,
      budgetGovernor,
      circuitBreakers,
      auditLog,
      replayEngine,
      computed_at: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[GET /api/control-tower/governance-status]', err, { corrId })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
