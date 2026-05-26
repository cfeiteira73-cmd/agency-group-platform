// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Production Operating System — Apex aggregator for Wave 44
// Combines security, DR, ledger, observability, compliance, source validation
// Wave 44 Agent 6 — Production Lock
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { runProductionReadinessGate, getLatestAssessment } from '@/lib/validation/productionReadinessGate'

let log: { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logger } = require('@/lib/observability/logger')
  log = logger
} catch {
  log = {
    info: (m: string, c?: Record<string, unknown>) => console.log('[prod-os]', m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => console.warn('[prod-os]', m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => console.error('[prod-os]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Identity ───────────────────────────────────────────────────────────────────

export const PRODUCTION_OS_IDENTITY = {
  name: 'Real Estate Capital Operating System',
  codename: 'REAL_ESTATE_CAPITAL_OS_PORTUGAL_PRODUCTION',
  version: '44.0.0',
  waves_completed: [40, 41, 42, 43, 44] as const,
  build_date: '2026-05-26',
} as const

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProductionOsGrade =
  | 'FULL_PRODUCTION_LOCK'
  | 'PRODUCTION_CAPABLE'
  | 'NEAR_PRODUCTION'
  | 'DEVELOPMENT'
  | 'INITIALIZING'

export interface SystemModuleStatus {
  module: string
  operational: boolean
  table_exists: boolean
  record_count: number | null
  last_activity: string | null
  health_score: number
}

export interface ProductionOsSnapshot {
  snapshot_id: string
  tenant_id: string
  captured_at: string
  grade: ProductionOsGrade
  composite_score: number

  security: SystemModuleStatus
  disaster_recovery: SystemModuleStatus
  ledger: SystemModuleStatus
  observability: SystemModuleStatus
  compliance: SystemModuleStatus
  source_validation: SystemModuleStatus

  production_gate_status: 'PRODUCTION_READY' | 'NOT_READY' | 'PARTIALLY_READY' | 'NOT_ASSESSED'
  production_gate_pass_count: number

  market_authority_active: boolean
  supply_dominance_active: boolean
  capital_execution_active: boolean
  flywheel_active: boolean

  total_kyc_approved: number
  total_escrow_positions: number
  active_threat_events: number
  ledger_balanced: boolean
  dr_last_test_days_ago: number | null

  security_score: number
  compliance_score: number
  capital_execution_score: number
  data_quality_score: number

  integrity_hash: string
}

// ── Module status check ────────────────────────────────────────────────────────

export async function checkModuleStatus(
  moduleName: string,
  primaryTable: string,
  tenantId: string,
): Promise<SystemModuleStatus> {
  try {
    const { count, error } = await (supabaseAdmin as any)
      .from(primaryTable)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (error) {
      return {
        module: moduleName,
        operational: false,
        table_exists: false,
        record_count: null,
        last_activity: null,
        health_score: 25,
      }
    }

    const recordCount = count ?? 0
    const table_exists = true
    const operational = true

    // Check for recent activity (last 24h)
    let lastActivity: string | null = null
    try {
      const { data: latestRow } = await (supabaseAdmin as any)
        .from(primaryTable)
        .select('created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestRow?.created_at) {
        lastActivity = latestRow.created_at as string
      }
    } catch {
      // no created_at column or other issue — ignore
    }

    const hasRecentActivity = lastActivity
      ? Date.now() - new Date(lastActivity).getTime() < 24 * 60 * 60 * 1000
      : false

    let health_score: number
    if (operational && hasRecentActivity) {
      health_score = 100
    } else if (operational) {
      health_score = 50
    } else {
      health_score = 25
    }

    return {
      module: moduleName,
      operational,
      table_exists,
      record_count: recordCount,
      last_activity: lastActivity,
      health_score,
    }
  } catch (e) {
    log.warn('checkModuleStatus exception', { module: moduleName, error: String(e) })
    return {
      module: moduleName,
      operational: false,
      table_exists: false,
      record_count: null,
      last_activity: null,
      health_score: 25,
    }
  }
}

// ── Helpers for prior wave indicators ─────────────────────────────────────────

async function safeBooleanCheck(table: string, tenantId: string): Promise<boolean> {
  try {
    const { count } = await (supabaseAdmin as any)
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

async function safeCount(table: string, tenantId: string, filters?: Record<string, unknown>): Promise<number> {
  try {
    let query = (supabaseAdmin as any)
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (key === 'gte') {
          const [col, val] = value as [string, string]
          query = query.gte(col, val)
        } else {
          query = query.eq(key, value)
        }
      }
    }

    const { count } = await query
    return count ?? 0
  } catch {
    return 0
  }
}

// ── Capture production OS snapshot ─────────────────────────────────────────────

export async function captureProductionOsSnapshot(
  tenantId: string = TENANT_ID,
): Promise<ProductionOsSnapshot> {
  const capturedAt = new Date().toISOString()
  const snapshotId = randomUUID()

  // Check all 6 Wave 44 modules in parallel
  const [secResult, drResult, ledgerResult, obsResult, compResult, srcResult] = await Promise.allSettled([
    checkModuleStatus('security', 'security_sessions', tenantId),
    checkModuleStatus('disaster_recovery', 'backup_records', tenantId),
    checkModuleStatus('ledger', 'journal_entries', tenantId),
    checkModuleStatus('observability', 'trace_spans', tenantId),
    checkModuleStatus('compliance', 'kyc_records', tenantId),
    checkModuleStatus('source_validation', 'validated_data_points', tenantId),
  ])

  const getModule = (r: PromiseSettledResult<SystemModuleStatus>, name: string): SystemModuleStatus =>
    r.status === 'fulfilled'
      ? r.value
      : { module: name, operational: false, table_exists: false, record_count: null, last_activity: null, health_score: 25 }

  const securityModule = getModule(secResult, 'security')
  const drModule = getModule(drResult, 'disaster_recovery')
  const ledgerModule = getModule(ledgerResult, 'ledger')
  const obsModule = getModule(obsResult, 'observability')
  const compModule = getModule(compResult, 'compliance')
  const srcModule = getModule(srcResult, 'source_validation')

  // Prior wave indicators
  const [
    marketAuthorityActive,
    supplyDominanceActive,
    capitalExecutionActive,
    flywheelActive,
  ] = await Promise.all([
    safeBooleanCheck('official_liquidity_index', tenantId),
    safeBooleanCheck('supply_dominance_snapshots', tenantId),
    // Try capital_execution_events first, then capital_execution_pipelines
    (async () => {
      const a = await safeBooleanCheck('capital_execution_events', tenantId)
      if (a) return true
      return safeBooleanCheck('capital_execution_pipelines', tenantId)
    })(),
    safeBooleanCheck('flywheel_metrics', tenantId),
  ])

  // Key metrics
  const [
    totalKycApproved,
    totalEscrowPositions,
    activeThreatsRaw,
    ledgerBalanced,
    drLastTestDaysAgo,
    dataQualityScore,
  ] = await Promise.all([
    safeCount('kyc_records', tenantId, { status: 'APPROVED' }),
    safeCount('escrow_positions', tenantId),
    // Active threats in last 24h HIGH or CRITICAL
    (async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count } = await (supabaseAdmin as any)
          .from('threat_events')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('severity', ['HIGH', 'CRITICAL'])
          .gte('detected_at', since)
        return count ?? 0
      } catch { return 0 }
    })(),
    // Ledger balanced check
    (async () => {
      try {
        const { data } = await (supabaseAdmin as any)
          .from('journal_entries')
          .select('debit_cents, credit_cents')
          .eq('tenant_id', tenantId)
        if (!data || (data as unknown[]).length === 0) return false
        const rows = data as Array<{ debit_cents: number; credit_cents: number }>
        let d = BigInt(0)
        let c = BigInt(0)
        for (const row of rows) { d += BigInt(row.debit_cents ?? 0); c += BigInt(row.credit_cents ?? 0) }
        const diff = d > c ? d - c : c - d
        return diff <= BigInt(100)
      } catch { return false }
    })(),
    // DR last test days ago
    (async () => {
      try {
        const { data } = await (supabaseAdmin as any)
          .from('dr_test_results')
          .select('completed_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'PASSED')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!data?.completed_at) return null
        const days = Math.floor((Date.now() - new Date(data.completed_at as string).getTime()) / (24 * 60 * 60 * 1000))
        return days
      } catch { return null }
    })(),
    // Data quality score
    (async () => {
      try {
        const { count: total } = await (supabaseAdmin as any)
          .from('validated_data_points')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        const { count: rejected } = await (supabaseAdmin as any)
          .from('validated_data_points')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('validation_status', 'REJECTED')
        if ((total ?? 0) === 0) return 100
        const rejRate = ((rejected ?? 0) / (total ?? 1)) * 100
        return Math.max(0, 100 - rejRate)
      } catch { return 0 }
    })(),
  ])

  // Get production gate status
  let gateStatus: ProductionOsSnapshot['production_gate_status'] = 'NOT_ASSESSED'
  let gatePassCount = 0
  try {
    const latestAssessment = await getLatestAssessment(tenantId)
    if (latestAssessment) {
      gateStatus = latestAssessment.overall_status
      gatePassCount = latestAssessment.pass_count
    }
  } catch {
    gateStatus = 'NOT_ASSESSED'
  }

  // Scores
  const securityScore = Math.max(0, 100 - activeThreatsRaw * 10)
  const complianceScore = (totalKycApproved > 0 ? 80 : 0) + (gateStatus !== 'NOT_ASSESSED' ? 20 : 0)
  const capitalExecutionScore = capitalExecutionActive ? 100 : 0

  // Composite score (each module equally weighted)
  const moduleScores = [
    securityModule.health_score,
    drModule.health_score,
    ledgerModule.health_score,
    obsModule.health_score,
    compModule.health_score,
    srcModule.health_score,
  ]
  const compositeScore = moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length

  // Grade
  const operationalCount = [
    securityModule,
    drModule,
    ledgerModule,
    obsModule,
    compModule,
    srcModule,
  ].filter(m => m.operational).length

  let grade: ProductionOsGrade
  if (operationalCount === 6 && gateStatus === 'PRODUCTION_READY') {
    grade = 'FULL_PRODUCTION_LOCK'
  } else if (operationalCount >= 5) {
    grade = 'PRODUCTION_CAPABLE'
  } else if (operationalCount >= 4) {
    grade = 'NEAR_PRODUCTION'
  } else if (operationalCount > 0) {
    grade = 'DEVELOPMENT'
  } else {
    grade = 'INITIALIZING'
  }

  const integrityHash = createHash('sha256')
    .update(JSON.stringify({ grade, composite_score: compositeScore, captured_at: capturedAt, tenant_id: tenantId }))
    .digest('hex')

  const snapshot: ProductionOsSnapshot = {
    snapshot_id: snapshotId,
    tenant_id: tenantId,
    captured_at: capturedAt,
    grade,
    composite_score: Math.round(compositeScore * 100) / 100,

    security: securityModule,
    disaster_recovery: drModule,
    ledger: ledgerModule,
    observability: obsModule,
    compliance: compModule,
    source_validation: srcModule,

    production_gate_status: gateStatus,
    production_gate_pass_count: gatePassCount,

    market_authority_active: marketAuthorityActive,
    supply_dominance_active: supplyDominanceActive,
    capital_execution_active: capitalExecutionActive,
    flywheel_active: flywheelActive,

    total_kyc_approved: totalKycApproved,
    total_escrow_positions: totalEscrowPositions,
    active_threat_events: activeThreatsRaw,
    ledger_balanced: ledgerBalanced,
    dr_last_test_days_ago: drLastTestDaysAgo,

    security_score: securityScore,
    compliance_score: complianceScore,
    capital_execution_score: capitalExecutionScore,
    data_quality_score: Math.round(dataQualityScore * 100) / 100,

    integrity_hash: integrityHash,
  }

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('production_os_snapshots')
    .insert({
      snapshot_id: snapshot.snapshot_id,
      tenant_id: snapshot.tenant_id,
      captured_at: snapshot.captured_at,
      grade: snapshot.grade,
      composite_score: snapshot.composite_score,
      security_operational: snapshot.security.operational,
      dr_operational: snapshot.disaster_recovery.operational,
      ledger_operational: snapshot.ledger.operational,
      observability_operational: snapshot.observability.operational,
      compliance_operational: snapshot.compliance.operational,
      source_validation_operational: snapshot.source_validation.operational,
      production_gate_status: snapshot.production_gate_status,
      production_gate_pass_count: snapshot.production_gate_pass_count,
      market_authority_active: snapshot.market_authority_active,
      supply_dominance_active: snapshot.supply_dominance_active,
      capital_execution_active: snapshot.capital_execution_active,
      flywheel_active: snapshot.flywheel_active,
      total_kyc_approved: snapshot.total_kyc_approved,
      total_escrow_positions: snapshot.total_escrow_positions,
      active_threat_events: snapshot.active_threat_events,
      ledger_balanced: snapshot.ledger_balanced,
      dr_last_test_days_ago: snapshot.dr_last_test_days_ago,
      security_score: snapshot.security_score,
      compliance_score: snapshot.compliance_score,
      capital_execution_score: snapshot.capital_execution_score,
      data_quality_score: snapshot.data_quality_score,
      payload: snapshot,
      integrity_hash: snapshot.integrity_hash,
    })
    .catch((e: unknown) => console.warn('[prod-os] persist snapshot error', e))

  log.info('Production OS snapshot captured', {
    grade,
    composite_score: compositeScore,
    operational_modules: operationalCount,
    gate_status: gateStatus,
  })

  return snapshot
}

// ── Query helpers ──────────────────────────────────────────────────────────────

export async function getLatestSnapshot(
  tenantId: string = TENANT_ID,
): Promise<ProductionOsSnapshot | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_os_snapshots')
      .select('payload')
      .eq('tenant_id', tenantId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    return data.payload as ProductionOsSnapshot
  } catch (e) {
    log.error('getLatestSnapshot exception', { error: String(e) })
    return null
  }
}

export async function getSnapshotHistory(
  tenantId: string = TENANT_ID,
  limit = 10,
): Promise<ProductionOsSnapshot[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('production_os_snapshots')
      .select('payload')
      .eq('tenant_id', tenantId)
      .order('captured_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as Array<{ payload: ProductionOsSnapshot }>).map(row => row.payload)
  } catch (e) {
    log.error('getSnapshotHistory exception', { error: String(e) })
    return []
  }
}

// Re-export gate function for convenience
export { runProductionReadinessGate, getLatestAssessment as getLatestGateAssessment }
