// Agency Group — DR Testing Suite
// lib/dr/drTestingSuite.ts
// Monthly full restore, ransomware simulation, DB corruption recovery testing
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrTestType =
  | 'MONTHLY_FULL_RESTORE'
  | 'RANSOMWARE_SIMULATION'
  | 'DB_CORRUPTION_RECOVERY'
  | 'KAFKA_OUTAGE_SIMULATION'
  | 'REGION_FAILOVER_DRILL'
  | 'DATA_INTEGRITY_CHECK'

export type DrTestStatus = 'SCHEDULED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED'

export interface DrTestResult {
  test_id: string
  tenant_id: string
  test_type: DrTestType
  status: DrTestStatus
  rto_measured_minutes: number | null
  rpo_measured_minutes: number | null
  data_integrity_score: number | null
  issues_found: string[]
  recommendations: string[]
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  next_scheduled: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Tests that run monthly vs weekly
const MONTHLY_TESTS: DrTestType[] = ['MONTHLY_FULL_RESTORE']
const ALL_TEST_TYPES: DrTestType[] = [
  'MONTHLY_FULL_RESTORE',
  'RANSOMWARE_SIMULATION',
  'DB_CORRUPTION_RECOVERY',
  'KAFKA_OUTAGE_SIMULATION',
  'REGION_FAILOVER_DRILL',
  'DATA_INTEGRITY_CHECK',
]

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// ─── scheduleNextTests ────────────────────────────────────────────────────────

export async function scheduleNextTests(tenantId: string): Promise<DrTestResult[]> {
  // Get last run for each test type
  const { data: existing } = await (supabaseAdmin as any)
    .from('dr_test_results')
    .select('test_type, completed_at')
    .eq('tenant_id', tenantId)
    .in('status', ['PASSED', 'FAILED'])
    .order('completed_at', { ascending: false })

  const lastRunMap: Record<string, string | null> = {}
  for (const row of (existing ?? []) as Array<{ test_type: string; completed_at: string | null }>) {
    if (!(row.test_type in lastRunMap)) {
      lastRunMap[row.test_type] = row.completed_at
    }
  }

  const toSchedule: DrTestType[] = []
  const now = new Date()

  for (const testType of ALL_TEST_TYPES) {
    const lastRun = lastRunMap[testType]
    const thresholdDays = MONTHLY_TESTS.includes(testType) ? 30 : 7

    if (!lastRun) {
      toSchedule.push(testType)
    } else {
      const daysSinceLast = (now.getTime() - new Date(lastRun).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLast > thresholdDays) {
        toSchedule.push(testType)
      }
    }
  }

  if (toSchedule.length === 0) {
    log.info('[drTestingSuite] No tests need scheduling', { tenantId })
    return []
  }

  const records: DrTestResult[] = toSchedule.map((testType) => {
    const isMonthly = MONTHLY_TESTS.includes(testType)
    return {
      test_id: randomUUID(),
      tenant_id: tenantId,
      test_type: testType,
      status: 'SCHEDULED' as DrTestStatus,
      rto_measured_minutes: null,
      rpo_measured_minutes: null,
      data_integrity_score: null,
      issues_found: [],
      recommendations: [],
      scheduled_at: now.toISOString(),
      started_at: null,
      completed_at: null,
      next_scheduled: daysFromNow(isMonthly ? 30 : 7),
    }
  })

  const { error } = await (supabaseAdmin as any)
    .from('dr_test_results')
    .insert(records)

  if (error) {
    log.error('[drTestingSuite] scheduleNextTests insert error', { error, tenantId })
    throw new Error(`scheduleNextTests failed: ${error.message}`)
  }

  log.info('[drTestingSuite] Tests scheduled', { count: records.length, tenantId })
  return records
}

// ─── runDataIntegrityCheck ────────────────────────────────────────────────────

const KEY_TABLES = [
  'raw_opportunity_stream',
  'canonical_assets_v2',
  'opportunity_scores',
  'capital_execution_events',
  'feedback_signals',
] as const

export async function runDataIntegrityCheck(tenantId: string): Promise<{
  score: number
  issues: string[]
}> {
  const issues: string[] = []
  let passingChecks = 0
  const totalChecks = KEY_TABLES.length * 2 // row count + no null IDs

  for (const table of KEY_TABLES) {
    try {
      const { count, error: countErr } = await (supabaseAdmin as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)

      if (countErr) {
        issues.push(`Table ${table}: count query failed — ${countErr.message}`)
      } else if (!count || count === 0) {
        issues.push(`Table ${table}: zero rows found`)
      } else {
        passingChecks++
      }

      // Check for null IDs
      const { count: nullIdCount, error: nullErr } = await (supabaseAdmin as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .is('id', null)

      if (nullErr) {
        issues.push(`Table ${table}: null-ID check failed — ${nullErr.message}`)
      } else if (nullIdCount && nullIdCount > 0) {
        issues.push(`Table ${table}: ${nullIdCount} rows with null ID found`)
      } else {
        passingChecks++
      }
    } catch (e) {
      issues.push(`Table ${table}: unexpected error — ${String(e)}`)
    }
  }

  const score = Math.round((passingChecks / totalChecks) * 100)
  log.info('[drTestingSuite] Data integrity check complete', { score, issueCount: issues.length, tenantId })
  return { score, issues }
}

// ─── recordTestResult ─────────────────────────────────────────────────────────

export async function recordTestResult(
  testId: string,
  status: DrTestStatus,
  rtoMinutes: number | null,
  rpoMinutes: number | null,
  issues: string[],
  recommendations: string[],
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('dr_test_results')
    .update({
      status,
      rto_measured_minutes: rtoMinutes,
      rpo_measured_minutes: rpoMinutes,
      issues_found: issues,
      recommendations,
      completed_at: new Date().toISOString(),
    })
    .eq('test_id', testId)

  if (error) {
    log.error('[drTestingSuite] recordTestResult error', { error, testId })
    throw new Error(`recordTestResult failed: ${error.message}`)
  }

  log.info('[drTestingSuite] Test result recorded', { testId, status })
}

// ─── getDrTestSummary ─────────────────────────────────────────────────────────

export async function getDrTestSummary(tenantId: string): Promise<{
  last_30_days: number
  passed: number
  failed: number
  avg_data_integrity: number
  next_scheduled: string | null
}> {
  const since30 = daysAgo(30)

  const [recentRes, nextRes] = await Promise.all([
    (supabaseAdmin as any)
      .from('dr_test_results')
      .select('status, data_integrity_score')
      .eq('tenant_id', tenantId)
      .gte('scheduled_at', since30),

    (supabaseAdmin as any)
      .from('dr_test_results')
      .select('next_scheduled')
      .eq('tenant_id', tenantId)
      .eq('status', 'SCHEDULED')
      .order('next_scheduled', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const rows: Array<{ status: DrTestStatus; data_integrity_score: number | null }> = recentRes.data ?? []
  const passed = rows.filter((r) => r.status === 'PASSED').length
  const failed = rows.filter((r) => r.status === 'FAILED').length

  const integrityScores = rows
    .map((r) => r.data_integrity_score)
    .filter((s): s is number => s !== null && s !== undefined)

  const avgIntegrity =
    integrityScores.length > 0
      ? Math.round(integrityScores.reduce((a, b) => a + b, 0) / integrityScores.length)
      : 0

  const nextScheduled: string | null = nextRes.data?.next_scheduled ?? null

  return {
    last_30_days: rows.length,
    passed,
    failed,
    avg_data_integrity: avgIntegrity,
    next_scheduled: nextScheduled,
  }
}
