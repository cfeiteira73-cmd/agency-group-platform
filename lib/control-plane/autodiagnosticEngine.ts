// Agency Group — Autonomous Diagnostic Engine
// lib/control-plane/autodiagnosticEngine.ts
// Continuous multi-dimension health scanning. Called every cycle by control plane.
// NEVER auto-corrects financial data. Only reports + flags.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Issue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  component: string
  message: string
  auto_correctable: boolean
}

export interface DimensionResult {
  name: string
  score: number
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  issues: Issue[]
  checked_at: string
}

export interface DiagnosticCycle {
  cycle_id: string
  tenant_id: string
  started_at: string
  completed_at: string
  dimensions: DimensionResult[]
  overall_score: number
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  issues_found: number
  auto_corrections_applied: number
  persisted_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreFromIssues(issues: Issue[]): number {
  if (issues.length === 0) return 100
  const penalty = issues.reduce((acc, i) => {
    if (i.severity === 'CRITICAL') return acc + 40
    if (i.severity === 'HIGH') return acc + 20
    if (i.severity === 'MEDIUM') return acc + 10
    return acc + 5
  }, 0)
  return Math.max(0, 100 - penalty)
}

function statusFromScore(score: number): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
  if (score < 30) return 'CRITICAL'
  if (score < 60) return 'DEGRADED'
  return 'HEALTHY'
}

// ─── Dimension Checks ─────────────────────────────────────────────────────────

async function checkApiHealth(_tenantId: string): Promise<DimensionResult> {
  const checked_at = new Date().toISOString()
  const issues: Issue[] = []

  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data, error } = await (supabaseAdmin as any)
      .from('performance_metrics')
      .select('avg_latency_ms, error_rate')
      .gte('created_at', fiveMinAgo)
      .limit(100)

    if (error) {
      issues.push({
        severity: 'MEDIUM',
        component: 'api_health',
        message: `performance_metrics query failed: ${error.message}`,
        auto_correctable: false,
      })
    } else if (data && data.length > 0) {
      const avgLatency =
        data.reduce((sum: number, r: any) => sum + (r.avg_latency_ms ?? 0), 0) / data.length
      const avgErrorRate =
        data.reduce((sum: number, r: any) => sum + (r.error_rate ?? 0), 0) / data.length

      if (avgLatency > 2000) {
        issues.push({
          severity: 'HIGH',
          component: 'api_health',
          message: `High average latency: ${avgLatency.toFixed(0)}ms (threshold 2000ms)`,
          auto_correctable: true,
        })
      }
      if (avgErrorRate > 0.1) {
        issues.push({
          severity: 'CRITICAL',
          component: 'api_health',
          message: `High error rate: ${(avgErrorRate * 100).toFixed(1)}% (threshold 10%)`,
          auto_correctable: false,
        })
      }
    }
  } catch (err) {
    issues.push({
      severity: 'MEDIUM',
      component: 'api_health',
      message: `API health check exception: ${err instanceof Error ? err.message : String(err)}`,
      auto_correctable: false,
    })
  }

  const score = scoreFromIssues(issues)
  return { name: 'API Health', score, status: statusFromScore(score), issues, checked_at }
}

async function checkQueueHealth(_tenantId: string): Promise<DimensionResult> {
  const checked_at = new Date().toISOString()
  const issues: Issue[] = []

  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    // Try job_queue first, fallback to supabase_queue
    let failedCount = 0
    let queryError: string | null = null

    const { count: jqCount, error: jqError } = await (supabaseAdmin as any)
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', fifteenMinAgo)

    if (jqError) {
      // Try alternate table
      const { count: sqCount, error: sqError } = await (supabaseAdmin as any)
        .from('supabase_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', fifteenMinAgo)

      if (sqError) {
        queryError = `job_queue: ${jqError.message} | supabase_queue: ${sqError.message}`
      } else {
        failedCount = sqCount ?? 0
      }
    } else {
      failedCount = jqCount ?? 0
    }

    if (queryError) {
      issues.push({
        severity: 'LOW',
        component: 'queue_health',
        message: `Queue tables not accessible: ${queryError}`,
        auto_correctable: false,
      })
    } else if (failedCount > 10) {
      issues.push({
        severity: 'CRITICAL',
        component: 'queue_health',
        message: `${failedCount} failed jobs in last 15 minutes (threshold 10)`,
        auto_correctable: true,
      })
    }
  } catch (err) {
    issues.push({
      severity: 'MEDIUM',
      component: 'queue_health',
      message: `Queue health check exception: ${err instanceof Error ? err.message : String(err)}`,
      auto_correctable: false,
    })
  }

  const score = scoreFromIssues(issues)
  return { name: 'Queue Health', score, status: statusFromScore(score), issues, checked_at }
}

async function checkEventStream(_tenantId: string): Promise<DimensionResult> {
  const checked_at = new Date().toISOString()
  const issues: Issue[] = []

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      issues.push({
        severity: 'LOW',
        component: 'event_stream',
        message: `kafka_event_log not accessible: ${error.message}`,
        auto_correctable: false,
      })
    } else if (!data || data.length === 0) {
      issues.push({
        severity: 'MEDIUM',
        component: 'event_stream',
        message: 'No events found in kafka_event_log',
        auto_correctable: false,
      })
    } else {
      const lastEventTime = new Date(data[0].created_at).getTime()
      const gapSeconds = (Date.now() - lastEventTime) / 1000

      if (gapSeconds > 60) {
        issues.push({
          severity: 'HIGH',
          component: 'event_stream',
          message: `Event stream gap: ${gapSeconds.toFixed(0)}s since last event (threshold 60s)`,
          auto_correctable: false,
        })
      }
    }
  } catch (err) {
    issues.push({
      severity: 'MEDIUM',
      component: 'event_stream',
      message: `Event stream check exception: ${err instanceof Error ? err.message : String(err)}`,
      auto_correctable: false,
    })
  }

  const score = scoreFromIssues(issues)
  return { name: 'Event Stream', score, status: statusFromScore(score), issues, checked_at }
}

async function checkDataFreshness(_tenantId: string): Promise<DimensionResult> {
  const checked_at = new Date().toISOString()
  const issues: Issue[] = []

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('properties')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) {
      issues.push({
        severity: 'MEDIUM',
        component: 'data_freshness',
        message: `properties table query failed: ${error.message}`,
        auto_correctable: false,
      })
    } else if (!data || data.length === 0) {
      issues.push({
        severity: 'LOW',
        component: 'data_freshness',
        message: 'No properties found',
        auto_correctable: false,
      })
    } else {
      const lastUpdated = new Date(data[0].updated_at).getTime()
      const ageHours = (Date.now() - lastUpdated) / (1000 * 60 * 60)

      if (ageHours > 24) {
        issues.push({
          severity: 'MEDIUM',
          component: 'data_freshness',
          message: `Properties data stale: last updated ${ageHours.toFixed(1)}h ago (threshold 24h)`,
          auto_correctable: true,
        })
      }
    }
  } catch (err) {
    issues.push({
      severity: 'MEDIUM',
      component: 'data_freshness',
      message: `Data freshness check exception: ${err instanceof Error ? err.message : String(err)}`,
      auto_correctable: false,
    })
  }

  const score = scoreFromIssues(issues)
  return { name: 'Data Freshness', score, status: statusFromScore(score), issues, checked_at }
}

async function checkCrmPipeline(_tenantId: string): Promise<DimensionResult> {
  const checked_at = new Date().toISOString()
  const issues: Issue[] = []

  try {
    const { count, error } = await (supabaseAdmin as any)
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'stalled')

    if (error) {
      issues.push({
        severity: 'LOW',
        component: 'crm_pipeline',
        message: `deals query failed: ${error.message}`,
        auto_correctable: false,
      })
    } else {
      const stalledCount = count ?? 0
      if (stalledCount > 5) {
        issues.push({
          severity: 'HIGH',
          component: 'crm_pipeline',
          message: `${stalledCount} stalled deals in pipeline (threshold 5)`,
          auto_correctable: false,
        })
      }
    }
  } catch (err) {
    issues.push({
      severity: 'MEDIUM',
      component: 'crm_pipeline',
      message: `CRM pipeline check exception: ${err instanceof Error ? err.message : String(err)}`,
      auto_correctable: false,
    })
  }

  const score = scoreFromIssues(issues)
  return { name: 'CRM Pipeline', score, status: statusFromScore(score), issues, checked_at }
}

async function checkMlModels(_tenantId: string): Promise<DimensionResult> {
  const checked_at = new Date().toISOString()
  const issues: Issue[] = []

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('model_name, last_trained_at')
      .lt('last_trained_at', sevenDaysAgo)
      .limit(10)

    if (error) {
      // Table may not exist — graceful skip
      log.info('[autodiagnosticEngine] ml_model_registry not accessible — skipping', {
        error: error.message,
      })
    } else if (data && data.length > 0) {
      for (const model of data) {
        issues.push({
          severity: 'LOW',
          component: 'ml_models',
          message: `Model "${model.model_name}" not trained in >7 days (last: ${model.last_trained_at ?? 'never'})`,
          auto_correctable: false,
        })
      }
    }
  } catch (err) {
    // Graceful skip — table may not exist
    log.info('[autodiagnosticEngine] ML model check skipped', {
      reason: err instanceof Error ? err.message : String(err),
    })
  }

  const score = scoreFromIssues(issues)
  return { name: 'ML Models', score, status: statusFromScore(score), issues, checked_at }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function runDiagnosticCycle(tenantId: string): Promise<DiagnosticCycle> {
  const cycle_id = `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const started_at = new Date().toISOString()

  log.info('[autodiagnosticEngine] Starting diagnostic cycle', { cycle_id, tenant_id: tenantId })

  const results = await Promise.allSettled([
    checkApiHealth(tenantId),
    checkQueueHealth(tenantId),
    checkEventStream(tenantId),
    checkDataFreshness(tenantId),
    checkCrmPipeline(tenantId),
    checkMlModels(tenantId),
  ])

  const dimensions: DimensionResult[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const fallbackNames = ['API Health', 'Queue Health', 'Event Stream', 'Data Freshness', 'CRM Pipeline', 'ML Models']
    return {
      name: fallbackNames[i] ?? `Dimension ${i}`,
      score: 0,
      status: 'CRITICAL' as const,
      issues: [
        {
          severity: 'CRITICAL' as const,
          component: `dimension_${i}`,
          message: `Dimension check threw: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
          auto_correctable: false,
        },
      ],
      checked_at: new Date().toISOString(),
    }
  })

  const overall_score =
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length

  const allIssues = dimensions.flatMap((d) => d.issues)
  const issues_found = allIssues.length

  let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY'
  if (dimensions.some((d) => d.score < 30)) status = 'CRITICAL'
  else if (dimensions.some((d) => d.score < 60)) status = 'DEGRADED'

  const completed_at = new Date().toISOString()
  const persisted_at = completed_at

  const cycle: DiagnosticCycle = {
    cycle_id,
    tenant_id: tenantId,
    started_at,
    completed_at,
    dimensions,
    overall_score,
    status,
    issues_found,
    auto_corrections_applied: 0,
    persisted_at,
  }

  // Persist to control_plane_cycles
  void (supabaseAdmin as any)
    .from('control_plane_cycles')
    .insert({
      tenant_id: tenantId,
      cycle_id,
      started_at,
      completed_at,
      overall_score,
      status,
      issues_found,
      auto_corrections_applied: 0,
      dimensions: JSON.stringify(dimensions),
    })
    .then(({ error }: { error: any }) => {
      if (error) {
        log.warn('[autodiagnosticEngine] Failed to persist cycle', { cycle_id, error: error.message })
      }
    })
    .catch((e: unknown) => console.warn('[autodiagnosticEngine] persist error', e))

  log.info('[autodiagnosticEngine] Diagnostic cycle complete', {
    cycle_id,
    status,
    overall_score,
    issues_found,
  })

  return cycle
}

export async function getLatestDiagnosticCycle(tenantId: string): Promise<DiagnosticCycle | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('control_plane_cycles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return {
      cycle_id: data.cycle_id,
      tenant_id: data.tenant_id,
      started_at: data.started_at,
      completed_at: data.completed_at ?? data.created_at,
      dimensions: typeof data.dimensions === 'string'
        ? JSON.parse(data.dimensions)
        : (data.dimensions ?? []),
      overall_score: data.overall_score ?? 0,
      status: data.status ?? 'UNKNOWN',
      issues_found: data.issues_found ?? 0,
      auto_corrections_applied: data.auto_corrections_applied ?? 0,
      persisted_at: data.created_at,
    } as DiagnosticCycle
  } catch (err) {
    log.warn('[autodiagnosticEngine] getLatestDiagnosticCycle failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
