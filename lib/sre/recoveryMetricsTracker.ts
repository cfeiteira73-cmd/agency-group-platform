// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Recovery Metrics Tracker v1.0
// lib/sre/recoveryMetricsTracker.ts
//
// Tracks RTO/RPO SLO compliance per system component and provides current
// SLO posture estimation from live system state.
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── SLO Targets ──────────────────────────────────────────────────────────────

export type SystemComponent = 'database' | 'events' | 'ml' | 'app'

export interface SLOTarget {
  component: SystemComponent
  rto_minutes: number
  rpo_minutes: number
}

export const SLO_TARGETS: Record<SystemComponent, SLOTarget> = {
  database: { component: 'database', rto_minutes: 15,   rpo_minutes: 1    },
  events:   { component: 'events',   rto_minutes: 10,   rpo_minutes: 0    },
  ml:       { component: 'ml',       rto_minutes: 60,   rpo_minutes: 1440 },
  app:      { component: 'app',      rto_minutes: 2,    rpo_minutes: 0    },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoveryMetric {
  id: string
  tenant_id: string
  component: SystemComponent
  incident_type: string
  actual_rto_minutes: number | null
  actual_rpo_minutes: number | null
  rto_slo_met: boolean | null
  rpo_slo_met: boolean | null
  incident_started_at: string
  recovery_completed_at: string | null
  notes: string | null
  created_at: string
}

export interface ComponentSLOSummary {
  slo_target: SLOTarget
  incidents_count: number
  slo_breaches: number
  avg_rto_minutes: number | null
  avg_rpo_minutes: number | null
  compliance_pct: number
}

export interface SLOComplianceReport {
  tenant_id: string
  period_days: number
  components: Record<SystemComponent, ComponentSLOSummary>
  overall_availability_pct: number
  generated_at: string
}

// ─── recordRecoveryMetric ─────────────────────────────────────────────────────

export async function recordRecoveryMetric(
  tenantId: string,
  metric: Omit<RecoveryMetric, 'id' | 'tenant_id' | 'created_at'>,
): Promise<RecoveryMetric> {
  const id         = randomUUID()
  const created_at = new Date().toISOString()

  const sloTarget = SLO_TARGETS[metric.component]

  // Compute SLO flags from actuals if not provided
  const rto_slo_met: boolean | null =
    metric.rto_slo_met !== undefined && metric.rto_slo_met !== null
      ? metric.rto_slo_met
      : metric.actual_rto_minutes !== null
        ? metric.actual_rto_minutes <= sloTarget.rto_minutes
        : null

  const rpo_slo_met: boolean | null =
    metric.rpo_slo_met !== undefined && metric.rpo_slo_met !== null
      ? metric.rpo_slo_met
      : metric.actual_rpo_minutes !== null
        ? metric.actual_rpo_minutes <= sloTarget.rpo_minutes
        : null

  const row = {
    id,
    tenant_id:             tenantId,
    component:             metric.component,
    incident_type:         metric.incident_type,
    actual_rto_minutes:    metric.actual_rto_minutes,
    actual_rpo_minutes:    metric.actual_rpo_minutes,
    rto_slo_met,
    rpo_slo_met,
    incident_started_at:   metric.incident_started_at,
    recovery_completed_at: metric.recovery_completed_at ?? null,
    notes:                 metric.notes ?? null,
    created_at,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('recovery_metrics')
    .insert(row)
    .select('*')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error || !data) {
    const msg = error?.message ?? 'insert returned no data'
    log.warn('[recoveryMetricsTracker] recordRecoveryMetric failed', { tenant_id: tenantId, error: msg })
    throw new Error(`[recoveryMetricsTracker] recordRecoveryMetric: ${msg}`)
  }

  return toMetric(data)
}

// ─── computeSLOCompliance ─────────────────────────────────────────────────────

export async function computeSLOCompliance(
  tenantId: string,
  periodDays = 30,
): Promise<SLOComplianceReport> {
  const generated_at = new Date().toISOString()
  const since        = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  const components: SystemComponent[] = ['database', 'events', 'ml', 'app']
  const result = {} as Record<SystemComponent, ComponentSLOSummary>

  let totalIncidentMinutes = 0

  for (const component of components) {
    const target = SLO_TARGETS[component]
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('recovery_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('component', component)
        .gte('incident_started_at', since) as {
          data: Array<Record<string, unknown>> | null
          error: { message: string } | null
        }

      if (error) {
        log.warn('[recoveryMetricsTracker] computeSLOCompliance query failed', {
          tenant_id: tenantId, component, error: error.message,
        })
        result[component] = {
          slo_target:      target,
          incidents_count: 0,
          slo_breaches:    0,
          avg_rto_minutes: null,
          avg_rpo_minutes: null,
          compliance_pct:  100,
        }
        continue
      }

      const metrics = (data ?? []).map(toMetric)

      const incidents_count = metrics.length
      const slo_breaches    = metrics.filter(m => m.rto_slo_met === false || m.rpo_slo_met === false).length

      const rtoValues  = metrics.filter(m => m.actual_rto_minutes !== null).map(m => m.actual_rto_minutes as number)
      const rpoValues  = metrics.filter(m => m.actual_rpo_minutes !== null).map(m => m.actual_rpo_minutes as number)

      const avg_rto_minutes = rtoValues.length > 0
        ? Math.round((rtoValues.reduce((s, v) => s + v, 0) / rtoValues.length) * 100) / 100
        : null

      const avg_rpo_minutes = rpoValues.length > 0
        ? Math.round((rpoValues.reduce((s, v) => s + v, 0) / rpoValues.length) * 100) / 100
        : null

      const compliance_pct = incidents_count === 0
        ? 100
        : Math.round(((incidents_count - slo_breaches) / incidents_count) * 10000) / 100

      // Approximate incident time contribution
      totalIncidentMinutes += rtoValues.reduce((s, v) => s + v, 0)

      result[component] = {
        slo_target:      target,
        incidents_count,
        slo_breaches,
        avg_rto_minutes,
        avg_rpo_minutes,
        compliance_pct,
      }
    } catch (err) {
      log.warn('[recoveryMetricsTracker] computeSLOCompliance component error', {
        tenant_id: tenantId, component, error: String(err),
      })
      result[component] = {
        slo_target:      target,
        incidents_count: 0,
        slo_breaches:    0,
        avg_rto_minutes: null,
        avg_rpo_minutes: null,
        compliance_pct:  100,
      }
    }
  }

  // Overall availability: (period minutes - total incident minutes) / period minutes * 100
  const periodMinutes         = periodDays * 24 * 60
  const availableMinutes      = Math.max(0, periodMinutes - totalIncidentMinutes)
  const overall_availability_pct = Math.round((availableMinutes / periodMinutes) * 10000) / 100

  return {
    tenant_id:              tenantId,
    period_days:            periodDays,
    components:             result,
    overall_availability_pct,
    generated_at,
  }
}

// ─── getRecoveryMetrics ───────────────────────────────────────────────────────

export async function getRecoveryMetrics(
  tenantId: string,
  component?: SystemComponent,
): Promise<RecoveryMetric[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('recovery_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('incident_started_at', { ascending: false })
      .limit(100)

    if (component) {
      query = query.eq('component', component)
    }

    const { data, error } = await query as {
      data: Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

    if (error) {
      log.warn('[recoveryMetricsTracker] getRecoveryMetrics failed', { tenant_id: tenantId, error: error.message })
      return []
    }

    return (data ?? []).map(toMetric)
  } catch (err) {
    log.warn('[recoveryMetricsTracker] getRecoveryMetrics error', { tenant_id: tenantId, error: String(err) })
    return []
  }
}

// ─── estimateCurrentSLOPosture ────────────────────────────────────────────────

export async function estimateCurrentSLOPosture(
  tenantId: string,
): Promise<Record<SystemComponent, { estimated_rto_minutes: number; rto_slo_at_risk: boolean; evidence: string }>> {
  const components: SystemComponent[] = ['database', 'events', 'ml', 'app']
  const result = {} as Record<SystemComponent, { estimated_rto_minutes: number; rto_slo_at_risk: boolean; evidence: string }>

  await Promise.allSettled(
    components.map(async (component) => {
      try {
        const target = SLO_TARGETS[component]

        if (component === 'database') {
          // DB: check time since last backup_snapshot
          const { data: snapData } = await (supabaseAdmin as any)
            .from('backup_snapshots')
            .select('created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1) as { data: Array<{ created_at: string }> | null; error: unknown }

          if (!snapData || snapData.length === 0) {
            result[component] = {
              estimated_rto_minutes: target.rto_minutes * 2,
              rto_slo_at_risk: true,
              evidence: 'No backup snapshots found — RTO at risk',
            }
          } else {
            const ageHours = (Date.now() - new Date(snapData[0].created_at).getTime()) / (60 * 60 * 1000)
            const atRisk   = ageHours > 24
            result[component] = {
              estimated_rto_minutes: atRisk ? target.rto_minutes * 1.5 : target.rto_minutes * 0.8,
              rto_slo_at_risk: atRisk,
              evidence: `Last backup ${Math.round(ageHours)}h ago${atRisk ? ' — exceeds 24h target' : ''}`,
            }
          }
          return
        }

        if (component === 'events') {
          // Events: check unprocessed kafka_event_log
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
          const { count } = await (supabaseAdmin as any)
            .from('kafka_event_log')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .is('processed_at', null)
            .lt('emitted_at', fiveMinutesAgo) as { count: number | null; error: unknown }

          const unprocessed = count ?? 0
          const atRisk      = unprocessed >= 10

          result[component] = {
            estimated_rto_minutes: atRisk ? target.rto_minutes * 1.5 : target.rto_minutes * 0.8,
            rto_slo_at_risk: atRisk,
            evidence: unprocessed === 0
              ? 'No unprocessed events — system healthy'
              : `${unprocessed} unprocessed event(s) > 5 min old${atRisk ? ' — RTO at risk' : ''}`,
          }
          return
        }

        if (component === 'ml') {
          // ML: check time since last successful retraining_run
          const { data: retrainData } = await (supabaseAdmin as any)
            .from('retraining_runs')
            .select('completed_at')
            .eq('tenant_id', tenantId)
            .eq('status', 'success')
            .order('completed_at', { ascending: false })
            .limit(1) as { data: Array<{ completed_at: string }> | null; error: unknown }

          if (!retrainData || retrainData.length === 0) {
            result[component] = {
              estimated_rto_minutes: target.rto_minutes,
              rto_slo_at_risk: false,
              evidence: 'No retraining runs found — estimating nominal RTO',
            }
          } else {
            const ageHours = (Date.now() - new Date(retrainData[0].completed_at).getTime()) / (60 * 60 * 1000)
            const atRisk   = ageHours > 72
            result[component] = {
              estimated_rto_minutes: atRisk ? target.rto_minutes * 1.2 : target.rto_minutes * 0.9,
              rto_slo_at_risk: atRisk,
              evidence: `Last successful retrain ${Math.round(ageHours)}h ago${atRisk ? ' — stale model increases RTO' : ''}`,
            }
          }
          return
        }

        if (component === 'app') {
          // App: check latest integrity_check_results score
          const { data: checkData } = await (supabaseAdmin as any)
            .from('integrity_check_results')
            .select('overall_score, overall_status')
            .eq('tenant_id', tenantId)
            .order('generated_at', { ascending: false })
            .limit(1) as { data: Array<{ overall_score: number; overall_status: string }> | null; error: unknown }

          if (!checkData || checkData.length === 0) {
            result[component] = {
              estimated_rto_minutes: target.rto_minutes,
              rto_slo_at_risk: false,
              evidence: 'No integrity check results — estimating nominal RTO',
            }
          } else {
            const score  = Number(checkData[0].overall_score ?? 0)
            const atRisk = score < 70
            result[component] = {
              estimated_rto_minutes: atRisk ? target.rto_minutes * 1.5 : target.rto_minutes * 0.5,
              rto_slo_at_risk: atRisk,
              evidence: `Integrity score ${score}/100 (${checkData[0].overall_status})${atRisk ? ' — below 70 threshold' : ''}`,
            }
          }
          return
        }

        // component is exhausted above — fallback (satisfies all branches)
      } catch (err) {
        const target = SLO_TARGETS[component]
        result[component] = {
          estimated_rto_minutes: target.rto_minutes,
          rto_slo_at_risk: false,
          evidence: `Posture check error: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    }),
  )

  return result
}

// ─── Row → RecoveryMetric ─────────────────────────────────────────────────────

function toMetric(row: Record<string, unknown>): RecoveryMetric {
  return {
    id:                    String(row['id'] ?? ''),
    tenant_id:             String(row['tenant_id'] ?? ''),
    component:             (row['component'] as SystemComponent),
    incident_type:         String(row['incident_type'] ?? ''),
    actual_rto_minutes:    row['actual_rto_minutes'] != null ? Number(row['actual_rto_minutes']) : null,
    actual_rpo_minutes:    row['actual_rpo_minutes'] != null ? Number(row['actual_rpo_minutes']) : null,
    rto_slo_met:           row['rto_slo_met'] != null ? Boolean(row['rto_slo_met']) : null,
    rpo_slo_met:           row['rpo_slo_met'] != null ? Boolean(row['rpo_slo_met']) : null,
    incident_started_at:   String(row['incident_started_at'] ?? ''),
    recovery_completed_at: row['recovery_completed_at'] != null ? String(row['recovery_completed_at']) : null,
    notes:                 row['notes'] != null ? String(row['notes']) : null,
    created_at:            String(row['created_at'] ?? new Date().toISOString()),
  }
}
