// Agency Group — Gap Closure Orchestrator
// lib/gap-closure/gapClosureOrchestrator.ts
// TypeScript strict — 0 errors
//
// Audits every layer of the system to determine if it is operating on REAL
// external infrastructure or SIMULATION.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GapLayer =
  | 'CAPITAL'
  | 'LEGAL'
  | 'MARKET_DATA'
  | 'LIQUIDITY'
  | 'REGULATORY'
  | 'ML'
  | 'TRUST'

export type GapStatus = 'CLOSED' | 'PARTIAL' | 'OPEN' | 'UNKNOWN'

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface GapRecord {
  gap_id: string
  layer: GapLayer
  status: GapStatus
  severity: GapSeverity
  description: string
  external_integration_required: boolean
  current_state: string
  required_state: string
  remediation_steps: string[]
  estimated_effort_days: number
  blocking_production: boolean
  detected_at: string
}

export interface GapClosureReport {
  report_id: string
  tenant_id: string
  total_gaps: number
  critical_gaps: number
  closed_gaps: number
  partial_gaps: number
  open_gaps: number
  production_ready: boolean
  system_status: string
  gaps: GapRecord[]
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGap(
  overrides: Partial<GapRecord> & {
    layer: GapLayer
    description: string
    severity: GapSeverity
    status: GapStatus
  },
): GapRecord {
  return {
    gap_id: randomUUID(),
    external_integration_required: true,
    current_state: 'unknown',
    required_state: 'production integration active',
    remediation_steps: [],
    estimated_effort_days: 5,
    blocking_production: overrides.severity === 'CRITICAL' && overrides.status === 'OPEN',
    detected_at: new Date().toISOString(),
    ...overrides,
  }
}

function envPresent(key: string): boolean {
  const val = process.env[key]
  return typeof val === 'string' && val.trim().length > 0
}

// ─── auditCapitalLayer ────────────────────────────────────────────────────────

/**
 * Checks SEPA/SWIFT/PSP integration, escrow_accounts, bank_reconciliation_runs.
 */
export async function auditCapitalLayer(tenantId: string): Promise<GapRecord[]> {
  const gaps: GapRecord[] = []

  // PSP env check
  const hasPSP =
    envPresent('STRIPE_SECRET_KEY') ||
    envPresent('ADYEN_API_KEY') ||
    envPresent('WISE_API_KEY')

  gaps.push(
    makeGap({
      layer: 'CAPITAL',
      description: 'Payment Service Provider (SEPA/SWIFT/PSP) integration',
      severity: 'CRITICAL',
      status: hasPSP ? 'CLOSED' : 'OPEN',
      external_integration_required: true,
      current_state: hasPSP
        ? 'PSP env key present'
        : 'No PSP env key set (STRIPE_SECRET_KEY / ADYEN_API_KEY / WISE_API_KEY)',
      required_state: 'PSP API key active and validated',
      remediation_steps: [
        'Set STRIPE_SECRET_KEY or ADYEN_API_KEY or WISE_API_KEY in environment',
        'Validate webhook endpoint with PSP',
        'Run end-to-end payment test',
      ],
      estimated_effort_days: 3,
    }),
  )

  // escrow_accounts table check
  let escrowStatus: GapStatus = 'OPEN'
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('id')
      .limit(1)
    if (!error && data && data.length > 0) {
      escrowStatus = 'CLOSED'
    } else if (!error && data && data.length === 0) {
      escrowStatus = 'PARTIAL'
    }
  } catch {
    escrowStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'CAPITAL',
      description: 'Escrow accounts table with real entries',
      severity: 'CRITICAL',
      status: escrowStatus,
      current_state:
        escrowStatus === 'CLOSED'
          ? 'escrow_accounts table has real entries'
          : escrowStatus === 'PARTIAL'
            ? 'escrow_accounts table exists but empty'
            : 'escrow_accounts table missing or inaccessible',
      required_state: 'At least one live escrow account linked to PSP',
      remediation_steps: [
        'Run migration to create escrow_accounts table',
        'Fund at least one escrow account via PSP',
        'Verify with bank reconciliation',
      ],
      estimated_effort_days: 7,
    }),
  )

  // bank_reconciliation_runs table check
  let bankRecStatus: GapStatus = 'OPEN'
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('bank_reconciliation_runs')
      .select('id')
      .limit(1)
    if (!error && data && data.length > 0) {
      bankRecStatus = 'CLOSED'
    } else if (!error) {
      bankRecStatus = 'PARTIAL'
    }
  } catch {
    bankRecStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'CAPITAL',
      description: 'Bank reconciliation runs table with real data',
      severity: 'HIGH',
      status: bankRecStatus,
      current_state:
        bankRecStatus === 'CLOSED'
          ? 'bank_reconciliation_runs has real data'
          : bankRecStatus === 'PARTIAL'
            ? 'bank_reconciliation_runs table exists but empty'
            : 'bank_reconciliation_runs table missing',
      required_state: 'Daily bank reconciliation runs stored with external bank statements',
      remediation_steps: [
        'Create bank_reconciliation_runs table via migration',
        'Set up daily cron job to pull bank statements via PSP API',
        'Validate reconciliation logic against real transactions',
      ],
      estimated_effort_days: 5,
    }),
  )

  log.info('[gap-closure] Capital layer audit complete', {
    tenant_id: tenantId,
    gaps_found: gaps.length,
    open: gaps.filter((g) => g.status === 'OPEN').length,
  })

  return gaps
}

// ─── auditLegalLayer ──────────────────────────────────────────────────────────

/**
 * Checks notary_integrations, eidas_signatures, land_registry_submissions tables.
 */
export async function auditLegalLayer(tenantId: string): Promise<GapRecord[]> {
  const gaps: GapRecord[] = []

  const legalChecks: Array<{
    table: string
    envKey: string
    description: string
    severity: GapSeverity
    remediation: string[]
    effortDays: number
  }> = [
    {
      table: 'notary_integrations',
      envKey: 'NOTARY_API_KEY',
      description: 'Notary API integration for deed signing',
      severity: 'CRITICAL',
      remediation: [
        'Set NOTARY_API_KEY in environment',
        'Create notary_integrations table via migration',
        'Test with sandbox notary provider',
        'Run live deed signing test',
      ],
      effortDays: 10,
    },
    {
      table: 'eidas_signatures',
      envKey: 'EIDAS_PROVIDER_URL',
      description: 'eIDAS qualified electronic signature provider',
      severity: 'CRITICAL',
      remediation: [
        'Set EIDAS_PROVIDER_URL in environment',
        'Create eidas_signatures table via migration',
        'Onboard with EU-qualified TSP provider',
        'Validate signature verification endpoint',
      ],
      effortDays: 14,
    },
    {
      table: 'land_registry_submissions',
      envKey: 'LAND_REGISTRY_API_KEY',
      description: 'Land registry API for property title submissions',
      severity: 'CRITICAL',
      remediation: [
        'Set LAND_REGISTRY_API_KEY in environment',
        'Create land_registry_submissions table via migration',
        'Apply for IRN (Instituto dos Registos e Notariado) API access',
        'Test submission endpoint',
      ],
      effortDays: 21,
    },
  ]

  for (const check of legalChecks) {
    const hasEnv = envPresent(check.envKey)
    let tableHasData = false
    let tableExists = false

    try {
      const { data, error } = await (supabaseAdmin as any)
        .from(check.table)
        .select('id')
        .limit(1)
      if (!error) {
        tableExists = true
        tableHasData = Array.isArray(data) && data.length > 0
      }
    } catch {
      tableExists = false
    }

    let status: GapStatus
    if (hasEnv && tableHasData) {
      status = 'CLOSED'
    } else if (hasEnv || tableExists) {
      status = 'PARTIAL'
    } else {
      status = 'OPEN'
    }

    gaps.push(
      makeGap({
        layer: 'LEGAL',
        description: check.description,
        severity: check.severity,
        status,
        current_state: `env=${hasEnv ? 'SET' : 'MISSING'}, table_exists=${tableExists}, has_data=${tableHasData}`,
        required_state: `${check.envKey} set + ${check.table} table populated with real records`,
        remediation_steps: check.remediation,
        estimated_effort_days: check.effortDays,
      }),
    )
  }

  log.info('[gap-closure] Legal layer audit complete', {
    tenant_id: tenantId,
    gaps_found: gaps.length,
    open: gaps.filter((g) => g.status === 'OPEN').length,
  })

  return gaps
}

// ─── auditMarketDataLayer ─────────────────────────────────────────────────────

/**
 * Checks external_market_feeds, external_price_benchmarks tables and sync freshness.
 */
export async function auditMarketDataLayer(tenantId: string): Promise<GapRecord[]> {
  const gaps: GapRecord[] = []
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // external_market_feeds
  let feedsStatus: GapStatus = 'OPEN'
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('external_market_feeds')
      .select('id, synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const lastSync = data[0].synced_at as string | null
      feedsStatus = lastSync && lastSync > oneDayAgo ? 'CLOSED' : 'PARTIAL'
    } else if (!error) {
      feedsStatus = 'PARTIAL'
    }
  } catch {
    feedsStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'MARKET_DATA',
      description: 'External market feeds with fresh data (< 24h)',
      severity: 'HIGH',
      status: feedsStatus,
      current_state:
        feedsStatus === 'CLOSED'
          ? 'external_market_feeds synced within 24h'
          : feedsStatus === 'PARTIAL'
            ? 'external_market_feeds exists but stale or empty'
            : 'external_market_feeds table missing',
      required_state: 'external_market_feeds synced < 24h with verified external source',
      remediation_steps: [
        'Create external_market_feeds table via migration',
        'Set up cron job to pull INE/Idealista/Confidencial Imobiliário feeds',
        'Add synced_at timestamp to every feed row',
        'Alert if feed is > 24h stale',
      ],
      estimated_effort_days: 7,
    }),
  )

  // external_price_benchmarks
  let benchmarkStatus: GapStatus = 'OPEN'
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('external_price_benchmarks')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const lastUpdate = data[0].updated_at as string | null
      benchmarkStatus = lastUpdate && lastUpdate > oneDayAgo ? 'CLOSED' : 'PARTIAL'
    } else if (!error) {
      benchmarkStatus = 'PARTIAL'
    }
  } catch {
    benchmarkStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'MARKET_DATA',
      description: 'External price benchmarks with fresh data (< 24h)',
      severity: 'MEDIUM',
      status: benchmarkStatus,
      current_state:
        benchmarkStatus === 'CLOSED'
          ? 'external_price_benchmarks updated within 24h'
          : benchmarkStatus === 'PARTIAL'
            ? 'external_price_benchmarks exists but stale or empty'
            : 'external_price_benchmarks table missing',
      required_state: 'external_price_benchmarks updated < 24h from INE/Confidencial sources',
      remediation_steps: [
        'Create external_price_benchmarks table via migration',
        'Integrate Confidencial Imobiliário or INE API for benchmark prices',
        'Schedule daily benchmark refresh',
      ],
      estimated_effort_days: 5,
    }),
  )

  log.info('[gap-closure] Market data layer audit complete', {
    tenant_id: tenantId,
    gaps_found: gaps.length,
    open: gaps.filter((g) => g.status === 'OPEN').length,
  })

  return gaps
}

// ─── auditMLLayer ─────────────────────────────────────────────────────────────

/**
 * Checks ml_reality_alignments table and training data quality.
 */
export async function auditMLLayer(tenantId: string): Promise<GapRecord[]> {
  const gaps: GapRecord[] = []

  // ml_reality_alignments
  let alignmentStatus: GapStatus = 'OPEN'
  let driftScore: number | null = null

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_reality_alignments')
      .select('id, drift_score, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      driftScore = typeof data[0].drift_score === 'number' ? data[0].drift_score : null
      alignmentStatus = driftScore !== null && driftScore < 0.15 ? 'CLOSED' : 'PARTIAL'
    } else if (!error) {
      alignmentStatus = 'PARTIAL'
    }
  } catch {
    alignmentStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'ML',
      description: 'ML reality alignment — drift score < 0.15 on real deal data',
      severity: 'HIGH',
      status: alignmentStatus,
      current_state:
        alignmentStatus === 'CLOSED'
          ? `ml_reality_alignments present, drift_score=${driftScore}`
          : alignmentStatus === 'PARTIAL'
            ? `ml_reality_alignments exists but drift_score=${driftScore} >= 0.15 or missing`
            : 'ml_reality_alignments table missing',
      required_state: 'ml_reality_alignments populated, drift_score < 0.15',
      remediation_steps: [
        'Create ml_reality_alignments table via migration',
        'Run drift detection after each model retrain',
        'Retrain model with recent real closed deals',
        'Alert if drift_score >= 0.15',
      ],
      estimated_effort_days: 10,
    }),
  )

  // execution_outcomes with real closed deals
  let trainingDataStatus: GapStatus = 'OPEN'
  let completedCount = 0

  try {
    const { count, error } = await (supabaseAdmin as any)
      .from('execution_outcomes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')

    if (!error && typeof count === 'number') {
      completedCount = count
      trainingDataStatus = count >= 10 ? 'CLOSED' : count > 0 ? 'PARTIAL' : 'OPEN'
    } else if (!error) {
      trainingDataStatus = 'PARTIAL'
    }
  } catch {
    trainingDataStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'ML',
      description: 'ML training data — real closed deals (execution_outcomes COMPLETED >= 10)',
      severity: 'HIGH',
      status: trainingDataStatus,
      current_state: `execution_outcomes with status=COMPLETED: ${completedCount}`,
      required_state: 'At least 10 real COMPLETED execution_outcomes for reliable ML training',
      remediation_steps: [
        'Complete at least 10 real capital execution deals',
        'Mark each as status=COMPLETED in execution_outcomes',
        'Retrain ML model after 10 closed deals',
        'Run drift validation',
      ],
      estimated_effort_days: 30,
    }),
  )

  log.info('[gap-closure] ML layer audit complete', {
    tenant_id: tenantId,
    gaps_found: gaps.length,
    open: gaps.filter((g) => g.status === 'OPEN').length,
  })

  return gaps
}

// ─── auditRegulatoryLayer ─────────────────────────────────────────────────────

/**
 * Checks investor_kyc_records completeness, aml_screening_results, mifid_classifications.
 */
export async function auditRegulatoryLayer(tenantId: string): Promise<GapRecord[]> {
  const gaps: GapRecord[] = []

  // investor_kyc_records — verified count
  let kycStatus: GapStatus = 'OPEN'
  let verifiedCount = 0

  try {
    const { count, error } = await (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'VERIFIED')

    if (!error && typeof count === 'number') {
      verifiedCount = count
      kycStatus = count > 0 ? 'CLOSED' : 'PARTIAL'
    } else if (!error) {
      kycStatus = 'PARTIAL'
    }
  } catch {
    kycStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'REGULATORY',
      description: 'Investor KYC records — verified investors',
      severity: 'CRITICAL',
      status: kycStatus,
      current_state: `investor_kyc_records with status=VERIFIED: ${verifiedCount}`,
      required_state: 'All active investors have VERIFIED KYC records (AML/CDD compliance)',
      remediation_steps: [
        'Create investor_kyc_records table via migration',
        'Integrate KYC provider (Onfido, Jumio, or similar)',
        'Complete KYC for all existing investors',
        'Set up automatic KYC refresh reminders',
      ],
      estimated_effort_days: 14,
    }),
  )

  // aml_screening_results
  let amlStatus: GapStatus = 'OPEN'

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('aml_screening_results')
      .select('id')
      .limit(1)

    if (!error && data && data.length > 0) {
      amlStatus = 'CLOSED'
    } else if (!error) {
      amlStatus = 'PARTIAL'
    }
  } catch {
    amlStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'REGULATORY',
      description: 'AML screening results table with real screening data',
      severity: 'CRITICAL',
      status: amlStatus,
      current_state:
        amlStatus === 'CLOSED'
          ? 'aml_screening_results has real data'
          : amlStatus === 'PARTIAL'
            ? 'aml_screening_results table exists but empty'
            : 'aml_screening_results table missing',
      required_state: 'All investors screened via ComplyAdvantage or equivalent AML provider',
      remediation_steps: [
        'Create aml_screening_results table via migration',
        'Integrate ComplyAdvantage or Refinitiv World-Check',
        'Screen all existing investors against sanctions/PEP lists',
        'Set up ongoing monitoring for active investors',
      ],
      estimated_effort_days: 10,
    }),
  )

  // mifid_classifications
  let mifidStatus: GapStatus = 'OPEN'

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('mifid_classifications')
      .select('id')
      .limit(1)

    if (!error && data && data.length > 0) {
      mifidStatus = 'CLOSED'
    } else if (!error) {
      mifidStatus = 'PARTIAL'
    }
  } catch {
    mifidStatus = 'OPEN'
  }

  gaps.push(
    makeGap({
      layer: 'REGULATORY',
      description: 'MiFID II investor classifications table with real data',
      severity: 'HIGH',
      status: mifidStatus,
      current_state:
        mifidStatus === 'CLOSED'
          ? 'mifid_classifications has real data'
          : mifidStatus === 'PARTIAL'
            ? 'mifid_classifications table exists but empty'
            : 'mifid_classifications table missing',
      required_state: 'All investors classified under MiFID II (Retail / Professional / Eligible Counterparty)',
      remediation_steps: [
        'Create mifid_classifications table via migration',
        'Build investor classification questionnaire per MiFID II Article 4',
        'Classify all existing investors',
        'Schedule annual MiFID II review for all investors',
      ],
      estimated_effort_days: 7,
    }),
  )

  log.info('[gap-closure] Regulatory layer audit complete', {
    tenant_id: tenantId,
    gaps_found: gaps.length,
    open: gaps.filter((g) => g.status === 'OPEN').length,
  })

  return gaps
}

// ─── runFullGapAudit ──────────────────────────────────────────────────────────

/**
 * Runs all layer audits in parallel via Promise.allSettled.
 * Assembles a GapClosureReport and persists it fire-and-forget.
 */
export async function runFullGapAudit(tenantId: string): Promise<GapClosureReport> {
  log.info('[gap-closure] Starting full gap audit', { tenant_id: tenantId })

  const [capitalResult, legalResult, marketResult, mlResult, regulatoryResult] =
    await Promise.allSettled([
      auditCapitalLayer(tenantId),
      auditLegalLayer(tenantId),
      auditMarketDataLayer(tenantId),
      auditMLLayer(tenantId),
      auditRegulatoryLayer(tenantId),
    ])

  const allGaps: GapRecord[] = []

  for (const result of [capitalResult, legalResult, marketResult, mlResult, regulatoryResult]) {
    if (result.status === 'fulfilled') {
      allGaps.push(...result.value)
    }
  }

  const criticalOpenGaps = allGaps.filter(
    (g) => g.severity === 'CRITICAL' && g.status === 'OPEN',
  )
  const criticalGaps = allGaps.filter((g) => g.severity === 'CRITICAL')
  const closedGaps = allGaps.filter((g) => g.status === 'CLOSED')
  const partialGaps = allGaps.filter((g) => g.status === 'PARTIAL')
  const openGaps = allGaps.filter((g) => g.status === 'OPEN')

  let systemStatus: string
  if (criticalOpenGaps.length === 0) {
    systemStatus = 'REAL_EUROPEAN_CAPITAL_MARKET_INFRASTRUCTURE'
  } else if (criticalGaps.length > criticalOpenGaps.length) {
    systemStatus = 'PARTIAL_REAL'
  } else {
    systemStatus = 'SIMULATION_ONLY'
  }

  const report: GapClosureReport = {
    report_id: randomUUID(),
    tenant_id: tenantId,
    total_gaps: allGaps.length,
    critical_gaps: criticalGaps.length,
    closed_gaps: closedGaps.length,
    partial_gaps: partialGaps.length,
    open_gaps: openGaps.length,
    production_ready: criticalOpenGaps.length === 0,
    system_status: systemStatus,
    gaps: allGaps,
    generated_at: new Date().toISOString(),
  }

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('gap_closure_reports')
    .insert({
      tenant_id: tenantId,
      report_id: report.report_id,
      total_gaps: report.total_gaps,
      critical_gaps: report.critical_gaps,
      closed_gaps: report.closed_gaps,
      partial_gaps: report.partial_gaps,
      open_gaps: report.open_gaps,
      production_ready: report.production_ready,
      system_status: report.system_status,
      gaps: report.gaps,
      generated_at: report.generated_at,
    })
    .catch((e: unknown) => log.warn('[gap-closure] Failed to persist gap report', { error: String(e) }))

  log.info('[gap-closure] Full gap audit complete', {
    tenant_id: tenantId,
    system_status: systemStatus,
    total_gaps: allGaps.length,
    critical_open: criticalOpenGaps.length,
    production_ready: report.production_ready,
  })

  return report
}

// ─── getLatestGapReport ───────────────────────────────────────────────────────

/**
 * Returns the most recent GapClosureReport for a tenant, or null if none exists.
 */
export async function getLatestGapReport(tenantId: string): Promise<GapClosureReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('gap_closure_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return null

    const row = data[0] as Record<string, unknown>
    return {
      report_id: row.report_id as string,
      tenant_id: row.tenant_id as string,
      total_gaps: row.total_gaps as number,
      critical_gaps: row.critical_gaps as number,
      closed_gaps: row.closed_gaps as number,
      partial_gaps: row.partial_gaps as number,
      open_gaps: row.open_gaps as number,
      production_ready: row.production_ready as boolean,
      system_status: row.system_status as string,
      gaps: (row.gaps as GapRecord[]) ?? [],
      generated_at: row.generated_at as string,
    }
  } catch (e) {
    log.warn('[gap-closure] Failed to read latest gap report', { error: String(e) })
    return null
  }
}
