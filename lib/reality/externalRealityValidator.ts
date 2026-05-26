// Agency Group — External Reality Validator
// lib/reality/externalRealityValidator.ts
// Wave 47 GAP 1 — Reality Boundary Closure
//
// Validates that all market data sources are producing REAL, FRESH, EXTERNALLY-VERIFIED data.
// Detects simulation/stale data. Computes REALITY_SCORE (0-100) per source.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// Data freshness SLA: no source may be older than 5 minutes for REAL status
const FRESHNESS_SLA_MINUTES = 5
// Full staleness threshold: 24h = SIMULATED risk
const SIMULATION_RISK_HOURS = 24

// ── Types ──────────────────────────────────────────────────────────────────────

export type RealitySourceId =
  | 'IDEALISTA'
  | 'CASAFARI'
  | 'CITIUS_AUCTIONS'
  | 'SALTEDGE_PSD2'
  | 'BANK_NPL_FEEDS'

export type RealityStatus = 'REAL' | 'DEGRADED' | 'FALLBACK_ACTIVE' | 'SIMULATED' | 'NOT_CONFIGURED'

export interface SourceRealityScore {
  source: RealitySourceId
  status: RealityStatus
  reality_score: number          // 0–100
  configured: boolean
  last_successful_call_at: string | null
  delay_minutes: number | null   // time since last real data
  sla_breached: boolean          // delay > FRESHNESS_SLA_MINUTES
  fallback_active: boolean
  fallback_reason: string | null
  simulation_risk: boolean       // data not confirmed externally for >24h
  records_in_db: number
  data_points_last_hour: number
  heartbeat_ok: boolean
  issues: string[]
}

export interface ExternalRealityReport {
  report_id: string
  tenant_id: string
  validated_at: string
  overall_reality_score: number            // weighted average of all sources
  system_reality_state: 'REAL_SYSTEM' | 'PARTIALLY_REAL' | 'SIMULATION_RISK' | 'ARCHITECTURE_ONLY'
  sources: SourceRealityScore[]
  simulation_flags: string[]               // any data flagged as unconfirmed
  fallback_log: string[]                   // active fallback executions
  recommendation: string
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function getProviderSyncState(
  providerName: string,
  tenantId: string,
  now: Date,
): Promise<{ lastSync: string | null; recordCount: number; recentPoints: number }> {
  try {
    const { data: syncRows } = await (supabaseAdmin as any)
      .from('provider_sync_logs')
      .select('synced_at, status, records_synced')
      .eq('tenant_id', tenantId)
      .eq('provider_name', providerName)
      .order('synced_at', { ascending: false })
      .limit(1)

    const lastRow = (syncRows as Array<{ synced_at: string; status: string; records_synced: number | null }> | null)?.[0]

    const { count: total } = await (supabaseAdmin as any)
      .from('external_property_listings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('provider_name', providerName)
      .eq('is_active', true)

    const oneHourAgo = new Date(now.getTime() - 3_600_000).toISOString()
    const { count: recent } = await (supabaseAdmin as any)
      .from('external_property_listings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('provider_name', providerName)
      .gte('synced_at', oneHourAgo)

    return {
      lastSync: lastRow?.synced_at ?? null,
      recordCount: total ?? 0,
      recentPoints: recent ?? 0,
    }
  } catch {
    return { lastSync: null, recordCount: 0, recentPoints: 0 }
  }
}

function computeSourceScore(
  configured: boolean,
  delayMinutes: number | null,
  recordCount: number,
  recentPoints: number,
  fallbackActive: boolean,
): number {
  if (!configured) return 0

  let score = 100

  // Freshness penalty
  if (delayMinutes === null) {
    score -= 50 // no sync data at all
  } else if (delayMinutes > SIMULATION_RISK_HOURS * 60) {
    score -= 60 // very stale
  } else if (delayMinutes > 60) {
    score -= 30
  } else if (delayMinutes > FRESHNESS_SLA_MINUTES) {
    score -= 15
  }

  // Data volume
  if (recordCount === 0) score -= 20
  else if (recordCount < 10) score -= 10

  // Recent activity
  if (recentPoints === 0 && recordCount > 0) score -= 10

  // Fallback penalty
  if (fallbackActive) score -= 15

  return Math.max(0, Math.min(100, score))
}

async function validateSource(
  source: RealitySourceId,
  envKey: string,
  tenantId: string,
  now: Date,
): Promise<SourceRealityScore> {
  const configured = !!(process.env[envKey])
  const issues: string[] = []
  const fallbackLog: string[] = []

  const { lastSync, recordCount, recentPoints } = await getProviderSyncState(
    source,
    tenantId,
    now,
  )

  const delayMinutes = lastSync
    ? (now.getTime() - new Date(lastSync).getTime()) / 60_000
    : null

  const slaBreached = delayMinutes !== null && delayMinutes > FRESHNESS_SLA_MINUTES
  const simulationRisk = delayMinutes === null || delayMinutes > SIMULATION_RISK_HOURS * 60
  const fallbackActive = slaBreached && recordCount > 0 // serving cached data

  if (!configured) {
    issues.push(`${envKey} not configured — set env var to activate real data ingestion`)
  }
  if (slaBreached && delayMinutes !== null) {
    issues.push(`SLA BREACH: last sync ${delayMinutes.toFixed(0)}min ago (SLA: <${FRESHNESS_SLA_MINUTES}min)`)
  }
  if (simulationRisk) {
    issues.push(`SIMULATION RISK: data not externally confirmed in >${SIMULATION_RISK_HOURS}h`)
  }
  if (fallbackActive) {
    fallbackLog.push(`${source}: serving cached data (age: ${delayMinutes?.toFixed(0) ?? 'unknown'}min)`)
  }
  if (recordCount === 0 && configured) {
    issues.push('No records in external_property_listings — initial sync has not run')
  }

  const realityScore = computeSourceScore(configured, delayMinutes, recordCount, recentPoints, fallbackActive)

  const status: RealityStatus =
    !configured ? 'NOT_CONFIGURED' :
    realityScore >= 85 ? 'REAL' :
    realityScore >= 60 ? 'DEGRADED' :
    fallbackActive ? 'FALLBACK_ACTIVE' :
    simulationRisk ? 'SIMULATED' :
    'DEGRADED'

  return {
    source,
    status,
    reality_score: realityScore,
    configured,
    last_successful_call_at: lastSync,
    delay_minutes: delayMinutes !== null ? Math.round(delayMinutes) : null,
    sla_breached: slaBreached,
    fallback_active: fallbackActive,
    fallback_reason: fallbackActive ? `Primary API stale — cached data from ${delayMinutes?.toFixed(0) ?? '?'}min ago` : null,
    simulation_risk: simulationRisk,
    records_in_db: recordCount,
    data_points_last_hour: recentPoints,
    heartbeat_ok: configured && !slaBreached && recordCount > 0,
    issues,
  }
}

async function validateSaltEdgePsd2(tenantId: string, now: Date): Promise<SourceRealityScore> {
  const configured = !!(process.env.SALTEDGE_APP_ID && process.env.SALTEDGE_SECRET)
  const issues: string[] = []

  // Check bank statement lines as proxy for PSD2 data freshness
  let lastBankSync: string | null = null
  let bankLineCount = 0
  try {
    const { data: lines } = await (supabaseAdmin as any)
      .from('bank_statement_lines')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    const line = (lines as Array<{ created_at: string }> | null)?.[0]
    lastBankSync = line?.created_at ?? null

    const { count } = await (supabaseAdmin as any)
      .from('bank_statement_lines')
      .select('id', { count: 'exact', head: true })
    bankLineCount = count ?? 0
  } catch {
    issues.push('bank_statement_lines table not accessible')
  }

  const delayMinutes = lastBankSync
    ? (now.getTime() - new Date(lastBankSync).getTime()) / 60_000
    : null

  const slaBreached = delayMinutes !== null && delayMinutes > FRESHNESS_SLA_MINUTES * 60 // bank data SLA: 5h
  const simulationRisk = delayMinutes === null || delayMinutes > SIMULATION_RISK_HOURS * 60

  if (!configured) issues.push('SALTEDGE_APP_ID + SALTEDGE_SECRET not configured')
  if (bankLineCount === 0 && configured) issues.push('No bank statement lines ingested')

  const score = computeSourceScore(configured, delayMinutes, bankLineCount, 0, false)

  return {
    source: 'SALTEDGE_PSD2',
    status: !configured ? 'NOT_CONFIGURED' : score >= 70 ? 'REAL' : simulationRisk ? 'SIMULATED' : 'DEGRADED',
    reality_score: score,
    configured,
    last_successful_call_at: lastBankSync,
    delay_minutes: delayMinutes !== null ? Math.round(delayMinutes) : null,
    sla_breached: slaBreached,
    fallback_active: false,
    fallback_reason: null,
    simulation_risk: simulationRisk,
    records_in_db: bankLineCount,
    data_points_last_hour: 0,
    heartbeat_ok: configured && !slaBreached && bankLineCount > 0,
    issues,
  }
}

// ── Main validator ─────────────────────────────────────────────────────────────

export async function runExternalRealityValidation(
  tenantId: string = TENANT_ID,
): Promise<ExternalRealityReport> {
  const now = new Date()
  const reportId = randomUUID()

  log.info('[externalRealityValidator] Starting reality validation', { report_id: reportId, tenantId })

  const [idealista, casafari, citius, bankNpl, saltedge] = await Promise.all([
    validateSource('IDEALISTA', 'IDEALISTA_API_KEY', tenantId, now),
    validateSource('CASAFARI', 'CASAFARI_API_KEY', tenantId, now),
    validateSource('CITIUS_AUCTIONS', 'CITIUS_PARTNER_KEY', tenantId, now),
    validateSource('BANK_NPL_FEEDS', 'NOVOBANCO_NPL_API_KEY', tenantId, now),
    validateSaltEdgePsd2(tenantId, now),
  ])

  const sources = [idealista, casafari, citius, bankNpl, saltedge]

  // Weighted overall score — market data sources are 2x weight vs auxiliary
  const weights: Record<RealitySourceId, number> = {
    IDEALISTA: 3,
    CASAFARI: 2,
    CITIUS_AUCTIONS: 2,
    SALTEDGE_PSD2: 2,
    BANK_NPL_FEEDS: 1,
  }

  let totalWeight = 0
  let weightedSum = 0
  for (const s of sources) {
    const w = weights[s.source]
    weightedSum += s.reality_score * w
    totalWeight += w
  }
  const overallScore = Math.round(weightedSum / totalWeight)

  // Simulation flags — any source with simulationRisk
  const simulationFlags = sources
    .filter(s => s.simulation_risk)
    .map(s => `${s.source}: DATA UNCONFIRMED EXTERNALLY — last sync ${s.delay_minutes !== null ? `${s.delay_minutes}min ago` : 'NEVER'}`)

  // Fallback log
  const fallbackLog = sources
    .filter(s => s.fallback_active)
    .map(s => s.fallback_reason ?? `${s.source}: fallback active`)

  const systemRealityState:ExternalRealityReport['system_reality_state'] =
    overallScore >= 80 ? 'REAL_SYSTEM' :
    overallScore >= 50 ? 'PARTIALLY_REAL' :
    simulationFlags.length >= 3 ? 'SIMULATION_RISK' :
    'ARCHITECTURE_ONLY'

  const configured = sources.filter(s => s.configured).length
  const recommendation =
    configured === 0
      ? 'Configure provider credentials to enable real data ingestion. See INSTITUTIONAL_CERTIFICATION_REPORT.md for required env vars.'
      : configured < 3
        ? `${configured}/5 sources configured. Priority: configure IDEALISTA_API_KEY and SALTEDGE_APP_ID for core market + financial reality.`
        : simulationFlags.length > 0
          ? `${simulationFlags.length} sources serving stale/simulated data. Trigger manual sync via /api/providers/status.`
          : 'Reality system nominal. Monitor SLA via /api/reality/validate for ongoing freshness.'

  const report: ExternalRealityReport = {
    report_id: reportId,
    tenant_id: tenantId,
    validated_at: now.toISOString(),
    overall_reality_score: overallScore,
    system_reality_state: systemRealityState,
    sources,
    simulation_flags: simulationFlags,
    fallback_log: fallbackLog,
    recommendation,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('reality_validation_runs')
    .insert({
      report_id: reportId,
      tenant_id: tenantId,
      validated_at: now.toISOString(),
      overall_reality_score: overallScore,
      system_reality_state: systemRealityState,
      simulation_flags: simulationFlags,
      fallback_log: fallbackLog,
      sources: sources as unknown as Record<string, unknown>[],
    })
    .catch((e: unknown) => log.warn('[externalRealityValidator] persist failed', { e: String(e) }))

  log.info('[externalRealityValidator] Complete', {
    report_id: reportId,
    overall_score: String(overallScore),
    state: systemRealityState,
  })

  return report
}
