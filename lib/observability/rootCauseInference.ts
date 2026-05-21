// Agency Group — Root Cause Inference Engine
// lib/observability/rootCauseInference.ts
// Builds causality chains from events. "DB slow → API timeout → user error" not just "user error".
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CausalityChain {
  chain_id: string
  root_cause: string
  root_cause_component: string
  propagation_path: string[]
  terminal_effect: string
  confidence: number
  evidence: string[]
  suggested_fix: string
}

export interface RootCauseReport {
  tenant_id: string
  generated_at: string
  analysis_window_minutes: number
  chains_found: number
  chains: CausalityChain[]
  top_root_cause: string | null
}

// ─── inferRootCauses ──────────────────────────────────────────────────────────

export async function inferRootCauses(
  tenantId: string,
  windowMinutes = 30
): Promise<RootCauseReport> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const generatedAt = now.toISOString()

  // Parallel data fetch
  const [siemResult, spanResult, perfResult, controlResult] = await Promise.all([
    sb
      .from('siem_events')
      .select('action, details, created_at, component, severity')
      .eq('tenant_id', tenantId)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(500),

    sb
      .from('trace_spans')
      .select('operation, service, status, duration_ms, error_message, started_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'error')
      .gte('started_at', windowStart)
      .limit(500),

    sb
      .from('performance_metrics')
      .select('metric_name, value, component, recorded_at')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', windowStart)
      .limit(500),

    sb
      .from('control_plane_cycles')
      .select('cycle_id, status, actions_taken, completed_at')
      .eq('tenant_id', tenantId)
      .gte('completed_at', windowStart)
      .limit(100),
  ])

  const siemEvents: Record<string, unknown>[] = siemResult.data ?? []
  const spanErrors: Record<string, unknown>[] = spanResult.data ?? []
  const perfMetrics: Record<string, unknown>[] = perfResult.data ?? []
  const controlCycles: Record<string, unknown>[] = controlResult.data ?? []

  const chains: CausalityChain[] = []

  // ── Rule 1: DB latency → API timeout → user error ──────────────────────────
  const dbLatencyMetrics = perfMetrics.filter(
    m =>
      typeof m.metric_name === 'string' &&
      (m.metric_name.includes('db_latency') || m.metric_name.includes('query_time')) &&
      typeof m.value === 'number' &&
      (m.value as number) > 1000
  )
  const apiTimeoutSpans = spanErrors.filter(
    s =>
      typeof s.service === 'string' &&
      s.service === 'api' &&
      typeof s.operation === 'string' &&
      (s.operation.includes('timeout') ||
        (typeof s.error_message === 'string' && s.error_message.includes('timeout')))
  )
  const userFacingErrors = siemEvents.filter(
    e =>
      typeof e.action === 'string' &&
      (e.action === 'api_error' || e.action === 'system_error')
  )

  if (dbLatencyMetrics.length > 0 && apiTimeoutSpans.length > 0) {
    const evidence: string[] = []
    evidence.push(`DB latency exceeded 1000ms in ${dbLatencyMetrics.length} metric(s)`)
    if (apiTimeoutSpans.length > 0)
      evidence.push(`${apiTimeoutSpans.length} API timeout span(s) detected`)
    if (userFacingErrors.length > 0)
      evidence.push(`${userFacingErrors.length} user-facing error event(s) in SIEM`)

    const confidence = Math.min(evidence.length * 0.2 + (dbLatencyMetrics.length > 5 ? 0.2 : 0), 1.0)

    chains.push({
      chain_id: `chain_db_latency_${Date.now()}`,
      root_cause: 'DB_LATENCY',
      root_cause_component: 'database',
      propagation_path: ['DB_LATENCY', 'API_TIMEOUT', 'USER_FACING_ERROR'],
      terminal_effect: 'User-facing API errors due to database slowness',
      confidence,
      evidence,
      suggested_fix:
        'Check slow query logs, add/tune indexes, consider read replica or connection pooling.',
    })
  }

  // ── Rule 2: Queue overflow → job failures → pipeline stall ────────────────
  const queueMetrics = perfMetrics.filter(
    m =>
      typeof m.metric_name === 'string' &&
      m.metric_name.includes('queue_depth') &&
      typeof m.value === 'number' &&
      (m.value as number) > 100
  )
  const queueSpanErrors = spanErrors.filter(
    s => typeof s.service === 'string' && s.service === 'queue'
  )
  const failedCycles = controlCycles.filter(c => c.status === 'failed')

  if (queueMetrics.length > 0 && queueSpanErrors.length > 10) {
    const evidence: string[] = []
    evidence.push(`Queue depth exceeded 100 in ${queueMetrics.length} observation(s)`)
    evidence.push(`${queueSpanErrors.length} queue job failure(s) in trace spans`)
    if (failedCycles.length > 0)
      evidence.push(`${failedCycles.length} control plane cycle(s) failed`)

    const confidence = Math.min(evidence.length * 0.2 + (queueSpanErrors.length > 20 ? 0.2 : 0), 1.0)

    chains.push({
      chain_id: `chain_queue_overflow_${Date.now() + 1}`,
      root_cause: 'QUEUE_OVERFLOW',
      root_cause_component: 'queue',
      propagation_path: ['QUEUE_OVERFLOW', 'JOB_FAILURE', 'PIPELINE_STALL'],
      terminal_effect: 'Pipeline stall — jobs not processing, data lag accumulating',
      confidence,
      evidence,
      suggested_fix:
        'Scale queue workers, increase consumer concurrency, or reduce producer rate. Check DLQ for poison messages.',
    })
  }

  // ── Rule 3: Auth anomaly → potential attack → session invalidation ─────────
  const authErrors = siemEvents.filter(
    e =>
      typeof e.action === 'string' &&
      (e.action === 'auth_failure' || e.action === 'auth_anomaly') &&
      typeof e.created_at === 'string' &&
      e.created_at >= fiveMinAgo
  )

  if (authErrors.length > 20) {
    const evidence: string[] = []
    evidence.push(`${authErrors.length} auth failure(s) in last 5 minutes`)
    const uniqueDetails = [...new Set(authErrors.map(e => {
      const d = e.details as Record<string, unknown> | null
      return (d?.ip_address as string) ?? (d?.user_agent as string) ?? 'unknown'
    }))].slice(0, 3)
    if (uniqueDetails.length > 0)
      evidence.push(`Suspicious sources: ${uniqueDetails.join(', ')}`)
    const sessionInvalidations = siemEvents.filter(
      e => typeof e.action === 'string' && e.action === 'session_invalidated'
    )
    if (sessionInvalidations.length > 0)
      evidence.push(`${sessionInvalidations.length} session invalidation(s) triggered`)

    const confidence = Math.min(evidence.length * 0.2 + (authErrors.length > 50 ? 0.4 : 0.2), 1.0)

    chains.push({
      chain_id: `chain_auth_anomaly_${Date.now() + 2}`,
      root_cause: 'AUTH_ANOMALY',
      root_cause_component: 'auth',
      propagation_path: ['AUTH_ANOMALY', 'POTENTIAL_ATTACK', 'SESSION_INVALIDATION'],
      terminal_effect: 'Active attack pattern — sessions being invalidated defensively',
      confidence,
      evidence,
      suggested_fix:
        'Enable IP rate limiting, activate WAF rules, review SIEM for attack patterns, consider temporary lockdown.',
    })
  }

  // ── Rule 4: ML model stale → score degradation → match quality drop ────────
  const mlMetrics = perfMetrics.filter(
    m =>
      typeof m.metric_name === 'string' &&
      m.metric_name.includes('ml_score') &&
      typeof m.value === 'number' &&
      (m.value as number) === 0
  )
  const mlSpanErrors = spanErrors.filter(
    s => typeof s.service === 'string' && s.service === 'ml'
  )

  if (mlMetrics.length > 3 || mlSpanErrors.length > 5) {
    const evidence: string[] = []
    if (mlMetrics.length > 0)
      evidence.push(`${mlMetrics.length} ML score metric(s) returned 0`)
    if (mlSpanErrors.length > 0)
      evidence.push(`${mlSpanErrors.length} ML service span error(s)`)

    const matchMetrics = perfMetrics.filter(
      m =>
        typeof m.metric_name === 'string' &&
        m.metric_name.includes('match_score') &&
        typeof m.value === 'number' &&
        (m.value as number) < 0.3
    )
    if (matchMetrics.length > 0)
      evidence.push(`${matchMetrics.length} degraded match score observation(s)`)

    const confidence = Math.min(evidence.length * 0.2, 1.0)

    chains.push({
      chain_id: `chain_ml_stale_${Date.now() + 3}`,
      root_cause: 'ML_MODEL_STALE',
      root_cause_component: 'ml',
      propagation_path: ['ML_MODEL_STALE', 'SCORE_DEGRADATION', 'MATCH_QUALITY_DROP'],
      terminal_effect: 'Match recommendations degraded — buyers receiving low-quality matches',
      confidence,
      evidence,
      suggested_fix:
        'Retrain or reload ML model, check feature pipeline for data freshness, verify model serving endpoint.',
    })
  }

  // Sort by confidence descending
  chains.sort((a, b) => b.confidence - a.confidence)

  const topRootCause = chains.length > 0 ? chains[0].root_cause : null

  const report: RootCauseReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    analysis_window_minutes: windowMinutes,
    chains_found: chains.length,
    chains,
    top_root_cause: topRootCause,
  }

  // Persist (fire-and-forget)
  void sb
    .from('root_cause_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      analysis_window_minutes: windowMinutes,
      chains_found: chains.length,
      chains,
      top_root_cause: topRootCause,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.info('[rootCauseInference] persist warn', { error })
    })
    .catch((e: unknown) => console.warn('[rootCauseInference]', e))

  return report
}
