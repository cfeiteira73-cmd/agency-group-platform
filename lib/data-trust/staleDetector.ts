// Agency Group — Data Staleness Detector
// lib/data-trust/staleDetector.ts
// Per-table staleness thresholds. Alerts when data hasn't been updated as expected.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StalenessThreshold {
  table_name: string
  max_age_hours: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
}

export interface StalenessCheck {
  table_name: string
  last_updated_at: string | null
  age_hours: number
  threshold_hours: number
  stale: boolean
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK'
  row_count: number
}

export interface StalenessReport {
  tenant_id: string
  generated_at: string
  checks: StalenessCheck[]
  stale_tables: number
  critical_stale: number
  overall_freshness_score: number
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const STALENESS_THRESHOLDS: StalenessThreshold[] = [
  { table_name: 'properties', max_age_hours: 24, severity: 'CRITICAL' },
  { table_name: 'contacts', max_age_hours: 72, severity: 'HIGH' },
  { table_name: 'deals', max_age_hours: 48, severity: 'HIGH' },
  { table_name: 'matches', max_age_hours: 24, severity: 'CRITICAL' },
  { table_name: 'ml_model_registry', max_age_hours: 168, severity: 'CRITICAL' },
  { table_name: 'performance_metrics', max_age_hours: 1, severity: 'HIGH' },
  { table_name: 'kafka_event_log', max_age_hours: 0.5, severity: 'CRITICAL' },
  { table_name: 'siem_events', max_age_hours: 4, severity: 'MEDIUM' },
]

// ─── checkDataStaleness ───────────────────────────────────────────────────────

/**
 * Checks each table in STALENESS_THRESHOLDS for freshness.
 * Graceful if table doesn't exist (skips with stale=true, severity from threshold).
 * Persists to staleness_reports. Returns report.
 */
export async function checkDataStaleness(tenantId: string): Promise<StalenessReport> {
  const generatedAt = new Date().toISOString()
  const nowMs = Date.now()

  const checks: StalenessCheck[] = await Promise.all(
    STALENESS_THRESHOLDS.map(async (threshold): Promise<StalenessCheck> => {
      const { table_name, max_age_hours, severity } = threshold

      try {
        // Try MAX(updated_at) first, fall back to MAX(created_at)
        const { data: updatedData, error: updatedError } = await (supabaseAdmin as any)
          .from(table_name)
          .select('updated_at')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()

        let last_updated_at: string | null = null
        let usedCreatedAt = false

        if (updatedError || !updatedData?.updated_at) {
          // Try created_at fallback
          const { data: createdData, error: createdError } = await (
            supabaseAdmin as any
          )
            .from(table_name)
            .select('created_at')
            .order('created_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle()

          if (!createdError && createdData?.created_at) {
            last_updated_at = (createdData as { created_at: string }).created_at
            usedCreatedAt = true
          }
        } else {
          last_updated_at = (updatedData as { updated_at: string }).updated_at
        }

        // Count rows (best-effort)
        let row_count = 0
        try {
          const { count } = await (supabaseAdmin as any)
            .from(table_name)
            .select('*', { count: 'exact', head: true })
          row_count = count ?? 0
        } catch {
          row_count = 0
        }

        const age_hours = last_updated_at
          ? (nowMs - new Date(last_updated_at).getTime()) / (1000 * 60 * 60)
          : Infinity

        const stale = age_hours > max_age_hours

        const checkSeverity: StalenessCheck['severity'] = stale ? severity : 'OK'

        if (usedCreatedAt) {
          log.warn('[staleDetector] table missing updated_at, used created_at', {
            table_name,
          })
        }

        return {
          table_name,
          last_updated_at,
          age_hours: isFinite(age_hours) ? Math.round(age_hours * 100) / 100 : -1,
          threshold_hours: max_age_hours,
          stale,
          severity: checkSeverity,
          row_count,
        }
      } catch (err) {
        // Table does not exist or inaccessible — flag as stale
        log.warn('[staleDetector] table check failed', { table_name, err })
        return {
          table_name,
          last_updated_at: null,
          age_hours: -1,
          threshold_hours: max_age_hours,
          stale: true,
          severity,
          row_count: 0,
        }
      }
    }),
  )

  const stale_tables = checks.filter((c) => c.stale).length
  const critical_stale = checks.filter(
    (c) => c.stale && c.severity === 'CRITICAL',
  ).length
  const overall_freshness_score =
    checks.length > 0
      ? Math.round(((checks.length - stale_tables) / checks.length) * 100)
      : 100

  const report: StalenessReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    checks,
    stale_tables,
    critical_stale,
    overall_freshness_score,
  }

  // Persist to staleness_reports (fire-and-forget)
  void (supabaseAdmin as any)
    .from('staleness_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      stale_tables,
      critical_stale,
      overall_freshness_score,
      checks,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[staleDetector] persist failed', { error })
    })
    .catch((e: unknown) => console.warn('[staleDetector]', e))

  return report
}
