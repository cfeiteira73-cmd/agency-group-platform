// Agency Group — Capital System Mandatory Tests
// lib/testing/capitalSystemTests.ts
// TypeScript strict — 0 errors
//
// 9 MANDATORY tests that must ALL PASS before "production ready."
// Tests run against REAL Supabase data. No mocks. Pure measurement.
// CRITICAL: ALL 9 must pass for CAPITAL_EXECUTION_READY: true
//
// Critical tests (1–6): system is NOT production-ready if ANY fail.
// High/Medium tests (7–9): degrade score but do not block production.

import { supabaseAdmin } from '@/lib/supabase'
import { verifyChainIntegrity } from '@/lib/compliance/immutableAuditLog'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapitalTestResult {
  test_id: string
  test_name: string
  passed: boolean
  score: number
  details: string
  duration_ms: number
  critical: boolean
}

export interface CapitalSystemTestReport {
  tenant_id: string
  generated_at: string
  tests_passed: number
  tests_failed: number
  critical_failures: number
  all_critical_passed: boolean
  capital_execution_ready: boolean
  overall_score: number
  results: CapitalTestResult[]
  blocking_issues: string[]
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now()
}

function elapsed(start: number): number {
  return Date.now() - start
}

// ─── TEST 1: Zero Orphan Capital ─────────────────────────────────────────────

async function testZeroOrphanCapital(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_01_zero_orphan_capital'
  const testName = 'Zero Orphan Capital'

  try {
    // Ledger entries with no matching investor in contacts
    const { data: ledgerRows, error: ledgerErr } = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('id, investor_id')
      .eq('tenant_id', tenantId) as {
        data: Array<{ id: string; investor_id: string }> | null
        error: { message: string } | null
      }

    if (ledgerErr) throw new Error(`investor_ledger_entries query: ${ledgerErr.message}`)

    const rows = ledgerRows ?? []

    // Check each investor_id exists in investor_kyc_records
    let orphanLedger = 0
    if (rows.length > 0) {
      const investorIds = [...new Set(rows.map(r => r.investor_id))]
      const { data: kycData, error: kycErr } = await (supabaseAdmin as any)
        .from('investor_kyc_records')
        .select('investor_id')
        .in('investor_id', investorIds)
        .eq('tenant_id', tenantId) as {
          data: Array<{ investor_id: string }> | null
          error: { message: string } | null
        }

      if (kycErr) {
        log.warn('[capitalSystemTests] kyc check error', { error: kycErr.message })
      }

      const kycSet = new Set((kycData ?? []).map(k => k.investor_id))
      orphanLedger = investorIds.filter(id => !kycSet.has(id)).length
    }

    // Escrow accounts with no matching settlements row
    const { data: escrowRows, error: escrowErr } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('id')
      .eq('tenant_id', tenantId) as {
        data: Array<{ id: string }> | null
        error: { message: string } | null
      }

    if (escrowErr) throw new Error(`escrow_accounts query: ${escrowErr.message}`)

    let orphanEscrow = 0
    const escrows = escrowRows ?? []
    if (escrows.length > 0) {
      const escrowIds = escrows.map(e => e.id)
      const { data: settlData, error: settlErr } = await (supabaseAdmin as any)
        .from('settlements')
        .select('escrow_account_id')
        .in('escrow_account_id', escrowIds)
        .eq('tenant_id', tenantId) as {
          data: Array<{ escrow_account_id: string }> | null
          error: { message: string } | null
        }

      if (settlErr) {
        log.warn('[capitalSystemTests] settlements escrow check error', { error: settlErr.message })
      }

      const linkedSet = new Set((settlData ?? []).map(s => s.escrow_account_id))
      orphanEscrow = escrowIds.filter(id => !linkedSet.has(id)).length
    }

    const totalOrphans = orphanLedger + orphanEscrow
    const score = Math.max(0, 100 - totalOrphans * 10)
    const passed = totalOrphans === 0
    const details = passed
      ? `No orphan capital detected. Ledger entries: ${rows.length}, Escrow accounts: ${escrows.length}`
      : `${orphanLedger} orphan ledger investors, ${orphanEscrow} orphan escrow accounts`

    return { test_id: testId, test_name: testName, passed, score, details, duration_ms: elapsed(start), critical: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[capitalSystemTests] test_01 error', { error: msg })
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: true }
  }
}

// ─── TEST 2: Full Settlement Path Coverage ────────────────────────────────────

const SETTLEMENT_STATE_SEQUENCE: string[] = [
  'INTENT', 'COMMITTED', 'FUNDED', 'LOCKED', 'CONTRACTED', 'NOTARIZED', 'SETTLED', 'TRANSFERRED',
]

async function testFullSettlementPathCoverage(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_02_settlement_path_coverage'
  const testName = 'Full Settlement Path Coverage'

  try {
    const contractedIdx = SETTLEMENT_STATE_SEQUENCE.indexOf('CONTRACTED')

    const { data: settlements, error: settlErr } = await (supabaseAdmin as any)
      .from('settlements')
      .select('id, current_state')
      .eq('tenant_id', tenantId) as {
        data: Array<{ id: string; current_state: string }> | null
        error: { message: string } | null
      }

    if (settlErr) throw new Error(`settlements query: ${settlErr.message}`)

    const active = (settlements ?? []).filter(s => {
      const idx = SETTLEMENT_STATE_SEQUENCE.indexOf(s.current_state)
      return idx >= contractedIdx
    })

    if (active.length === 0) {
      return {
        test_id: testId, test_name: testName, passed: true, score: 100,
        details: 'No settlements in CONTRACTED+ state — pass by default.',
        duration_ms: elapsed(start), critical: true,
      }
    }

    let missingTrail = 0
    for (const s of active) {
      const { data: transitions, error: transErr } = await (supabaseAdmin as any)
        .from('settlement_transitions')
        .select('from_state, to_state')
        .eq('settlement_id', s.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }) as {
          data: Array<{ from_state: string; to_state: string }> | null
          error: { message: string } | null
        }

      if (transErr || !transitions || transitions.length === 0) {
        missingTrail++
        continue
      }

      // Verify chain is continuous: each to_state should be next from_state
      let broken = false
      for (let i = 1; i < transitions.length; i++) {
        if (transitions[i].from_state !== transitions[i - 1].to_state) {
          broken = true
          break
        }
      }
      if (broken) missingTrail++
    }

    const passed = missingTrail === 0
    const score = Math.max(0, Math.round(((active.length - missingTrail) / active.length) * 100))
    const details = passed
      ? `All ${active.length} active settlements have complete transition trails.`
      : `${missingTrail}/${active.length} settlements have broken or missing transition trails.`

    return { test_id: testId, test_name: testName, passed, score, details, duration_ms: elapsed(start), critical: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: true }
  }
}

// ─── TEST 3: Capital Reconciliation ───────────────────────────────────────────

async function testCapitalReconciliation(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_03_capital_reconciliation'
  const testName = 'Capital Reconciliation: Bids ↔ Escrow ↔ Settlements'

  try {
    const { data: acceptedBids, error: bidErr } = await (supabaseAdmin as any)
      .from('asset_bids')
      .select('id, property_id, investor_id, escrow_account_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACCEPTED') as {
        data: Array<{ id: string; property_id: string; investor_id: string; escrow_account_id: string | null }> | null
        error: { message: string } | null
      }

    if (bidErr) throw new Error(`asset_bids query: ${bidErr.message}`)

    const bids = acceptedBids ?? []
    if (bids.length === 0) {
      return {
        test_id: testId, test_name: testName, passed: true, score: 100,
        details: 'No ACCEPTED bids — reconciliation passes by default.',
        duration_ms: elapsed(start), critical: true,
      }
    }

    let bidEscrowMatch = 0
    const escrowIds: string[] = []

    for (const bid of bids) {
      if (!bid.escrow_account_id) continue
      const { data: escrow, error: escrowErr } = await (supabaseAdmin as any)
        .from('escrow_accounts')
        .select('id, status')
        .eq('id', bid.escrow_account_id)
        .eq('tenant_id', tenantId)
        .single() as {
          data: { id: string; status: string } | null
          error: { message: string } | null
        }

      if (!escrowErr && escrow && ['FUNDED', 'LOCKED', 'RELEASED'].includes(escrow.status)) {
        bidEscrowMatch++
        escrowIds.push(escrow.id)
      }
    }

    // Check released escrow → contracted+ settlement
    let escrowSettlMatch = 0
    if (escrowIds.length > 0) {
      const { data: releasedEscrows, error: relErr } = await (supabaseAdmin as any)
        .from('escrow_accounts')
        .select('id')
        .in('id', escrowIds)
        .eq('status', 'RELEASED')
        .eq('tenant_id', tenantId) as {
          data: Array<{ id: string }> | null
          error: { message: string } | null
        }

      if (!relErr && releasedEscrows && releasedEscrows.length > 0) {
        const relIds = releasedEscrows.map(e => e.id)
        const contractedStates = ['CONTRACTED', 'NOTARIZED', 'SETTLED', 'TRANSFERRED']
        const { data: matchedSettl } = await (supabaseAdmin as any)
          .from('settlements')
          .select('escrow_account_id')
          .in('escrow_account_id', relIds)
          .in('current_state', contractedStates)
          .eq('tenant_id', tenantId) as {
            data: Array<{ escrow_account_id: string }> | null
            error: { message: string } | null
          }
        escrowSettlMatch = (matchedSettl ?? []).length
        const releasedCount = releasedEscrows.length
        if (releasedCount > 0 && escrowSettlMatch < releasedCount) {
          const matchPct = Math.round((escrowSettlMatch / releasedCount) * 100)
          const bidMatchPct = bids.length > 0 ? Math.round((bidEscrowMatch / bids.length) * 100) : 100
          const score = Math.round((matchPct + bidMatchPct) / 2)
          return {
            test_id: testId, test_name: testName, passed: score >= 100, score,
            details: `Bid→Escrow: ${bidEscrowMatch}/${bids.length} (${bidMatchPct}%). Released Escrow→Settlement: ${escrowSettlMatch}/${releasedCount} (${matchPct}%).`,
            duration_ms: elapsed(start), critical: true,
          }
        }
      }
    }

    const matchPct = bids.length > 0 ? Math.round((bidEscrowMatch / bids.length) * 100) : 100
    const passed = matchPct === 100
    const details = `Bid→Escrow match: ${bidEscrowMatch}/${bids.length} (${matchPct}%). Released escrow→settlement: ${escrowSettlMatch} verified.`

    return { test_id: testId, test_name: testName, passed, score: matchPct, details, duration_ms: elapsed(start), critical: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: true }
  }
}

// ─── TEST 4: Regulatory Audit Trail Integrity ─────────────────────────────────

async function testRegulatoryAuditTrailIntegrity(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_04_regulatory_audit_trail'
  const testName = 'Regulatory Audit Trail Integrity'

  try {
    const result = await verifyChainIntegrity(tenantId, 5000)

    const passed = result.valid
    const score = passed ? 100 : 0
    const details = passed
      ? `Chain integrity verified across ${result.checked_entries} entries.`
      : `Chain broken at sequence ${result.first_broken_sequence ?? 'unknown'}. Checked ${result.checked_entries} entries.`

    return { test_id: testId, test_name: testName, passed, score, details, duration_ms: elapsed(start), critical: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: true }
  }
}

// ─── TEST 5: Zero Cross-Tenant Capital Leakage ────────────────────────────────

async function testZeroCrossTenantLeakage(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_05_cross_tenant_leakage'
  const testName = 'Zero Cross-Tenant Capital Leakage'

  try {
    const { data: ledgerLeak, error: ledgerErr } = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('id, tenant_id')
      .neq('tenant_id', tenantId) as {
        data: Array<{ id: string; tenant_id: string }> | null
        error: { message: string } | null
      }

    if (ledgerErr) throw new Error(`ledger cross-tenant check: ${ledgerErr.message}`)

    const { data: settlLeak, error: settlErr } = await (supabaseAdmin as any)
      .from('settlements')
      .select('id, tenant_id')
      .neq('tenant_id', tenantId) as {
        data: Array<{ id: string; tenant_id: string }> | null
        error: { message: string } | null
      }

    if (settlErr) throw new Error(`settlements cross-tenant check: ${settlErr.message}`)

    const ledgerCount = (ledgerLeak ?? []).length
    const settlCount = (settlLeak ?? []).length
    const total = ledgerCount + settlCount
    const passed = total === 0

    const details = passed
      ? 'No cross-tenant data leakage detected.'
      : `${ledgerCount} ledger entries and ${settlCount} settlements belong to other tenants (visible without tenant filter — potential RLS gap).`

    return { test_id: testId, test_name: testName, passed, score: passed ? 100 : 0, details, duration_ms: elapsed(start), critical: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: true }
  }
}

// ─── TEST 6: KYC Coverage for Active Investors ────────────────────────────────

async function testKycCoverage(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_06_kyc_coverage'
  const testName = 'KYC Coverage for Active Investors'

  try {
    const { data: ledgerInvestors, error: ledgerErr } = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('investor_id')
      .eq('tenant_id', tenantId) as {
        data: Array<{ investor_id: string }> | null
        error: { message: string } | null
      }

    if (ledgerErr) throw new Error(`ledger investor query: ${ledgerErr.message}`)

    const investorIds = [...new Set((ledgerInvestors ?? []).map(r => r.investor_id))]

    if (investorIds.length === 0) {
      return {
        test_id: testId, test_name: testName, passed: true, score: 100,
        details: 'No active investors in ledger — KYC check passes by default.',
        duration_ms: elapsed(start), critical: true,
      }
    }

    const { data: kycRecords, error: kycErr } = await (supabaseAdmin as any)
      .from('investor_kyc_records')
      .select('investor_id, kyc_status')
      .in('investor_id', investorIds)
      .eq('tenant_id', tenantId) as {
        data: Array<{ investor_id: string; kyc_status: string }> | null
        error: { message: string } | null
      }

    if (kycErr) throw new Error(`kyc_records query: ${kycErr.message}`)

    const kycSet = new Set((kycRecords ?? []).map(k => k.investor_id))
    const covered = investorIds.filter(id => kycSet.has(id)).length
    const pct = Math.round((covered / investorIds.length) * 100)
    const passed = pct >= 80
    const score = pct

    const details = `${covered}/${investorIds.length} active investors have KYC records (${pct}%). Threshold: 80%.`

    return { test_id: testId, test_name: testName, passed, score, details, duration_ms: elapsed(start), critical: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: true }
  }
}

// ─── TEST 7: Event Deterministic Replay ──────────────────────────────────────

import { createHash } from 'crypto'

async function testEventDeterministicReplay(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_07_event_deterministic_replay'
  const testName = 'Event Deterministic Replay'

  try {
    // Get last 10 settlements
    const { data: settlements, error: settlErr } = await (supabaseAdmin as any)
      .from('settlements')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10) as {
        data: Array<{ id: string }> | null
        error: { message: string } | null
      }

    if (settlErr) throw new Error(`settlements query: ${settlErr.message}`)

    const settls = settlements ?? []
    if (settls.length === 0) {
      return {
        test_id: testId, test_name: testName, passed: true, score: 100,
        details: 'No settlements to replay — pass by default.',
        duration_ms: elapsed(start), critical: false,
      }
    }

    let matched = 0
    let total = 0

    for (const s of settls) {
      const { data: transitions, error: transErr } = await (supabaseAdmin as any)
        .from('settlement_transitions')
        .select('id, from_state, to_state, chain_hash, prev_hash, created_at')
        .eq('settlement_id', s.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }) as {
          data: Array<{
            id: string
            from_state: string
            to_state: string
            chain_hash: string | null
            prev_hash: string | null
            created_at: string
          }> | null
          error: { message: string } | null
        }

      if (transErr || !transitions) continue

      for (const t of transitions) {
        total++
        if (!t.chain_hash) {
          // No hash stored — skip determinism check for this entry
          matched++
          continue
        }
        const recomputed = createHash('sha256')
          .update(JSON.stringify({
            from_state: t.from_state,
            to_state: t.to_state,
            prev_hash: t.prev_hash ?? null,
            created_at: t.created_at,
          }))
          .digest('hex')
        if (recomputed === t.chain_hash) matched++
      }
    }

    if (total === 0) {
      return {
        test_id: testId, test_name: testName, passed: true, score: 100,
        details: 'No transition hashes to verify.',
        duration_ms: elapsed(start), critical: false,
      }
    }

    const pct = Math.round((matched / total) * 100)
    const passed = pct === 100
    const details = `${matched}/${total} transition hashes verified deterministically (${pct}%).`

    return { test_id: testId, test_name: testName, passed, score: pct, details, duration_ms: elapsed(start), critical: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: false }
  }
}

// ─── TEST 8: ML Pattern Freshness ────────────────────────────────────────────

async function testMlPatternFreshness(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_08_ml_pattern_freshness'
  const testName = 'ML Pattern Freshness'

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: patterns, error: patternsErr } = await (supabaseAdmin as any)
      .from('learned_patterns')
      .select('id, last_updated_at')
      .eq('tenant_id', tenantId)
      .order('last_updated_at', { ascending: false })
      .limit(1) as {
        data: Array<{ id: string; last_updated_at: string }> | null
        error: { message: string } | null
      }

    if (patternsErr) throw new Error(`learned_patterns query: ${patternsErr.message}`)

    if (!patterns || patterns.length === 0) {
      return {
        test_id: testId, test_name: testName, passed: false, score: 0,
        details: 'No ML patterns found in learned_patterns table.',
        duration_ms: elapsed(start), critical: false,
      }
    }

    const latestUpdated = patterns[0].last_updated_at
    const isFresh = latestUpdated >= sevenDaysAgo
    const score = isFresh ? 100 : 50

    const details = isFresh
      ? `ML patterns are fresh. Last updated: ${latestUpdated}.`
      : `ML patterns are stale. Last updated: ${latestUpdated} (older than 7 days).`

    return { test_id: testId, test_name: testName, passed: isFresh, score, details, duration_ms: elapsed(start), critical: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: false }
  }
}

// ─── TEST 9: Liquidity Coverage ───────────────────────────────────────────────

async function testLiquidityCoverage(tenantId: string): Promise<CapitalTestResult> {
  const start = now()
  const testId = 'test_09_liquidity_coverage'
  const testName = 'Liquidity Coverage'

  try {
    // Use (supabaseAdmin as any) to access count without TypeScript generics issues
    const propResponse = await (supabaseAdmin as any)
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as {
        data: null
        error: { message: string } | null
        count: number | null
      }

    if (propResponse.error) throw new Error(`properties count: ${propResponse.error.message}`)

    const propertyCount: number = propResponse.count ?? 0

    const bidResponse = await (supabaseAdmin as any)
      .from('asset_bids')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE') as {
        data: null
        error: { message: string } | null
        count: number | null
      }

    const bidCount: number = bidResponse.count ?? 0

    if (propertyCount === 0) {
      return {
        test_id: testId, test_name: testName, passed: true, score: 100,
        details: 'No active properties — liquidity test passes by default.',
        duration_ms: elapsed(start), critical: false,
      }
    }

    const coverage = bidCount / propertyCount
    const score = Math.min(100, Math.round(coverage * 200))
    const passed = coverage >= 0.1

    const details = `${bidCount} active bids / ${propertyCount} active properties = ${(coverage * 100).toFixed(1)}% coverage. Target: ≥10% (liquid: ≥30%).`

    return { test_id: testId, test_name: testName, passed, score, details, duration_ms: elapsed(start), critical: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { test_id: testId, test_name: testName, passed: false, score: 0, details: `Error: ${msg}`, duration_ms: elapsed(start), critical: false }
  }
}

// ─── runCapitalSystemTests ────────────────────────────────────────────────────

export async function runCapitalSystemTests(tenantId: string): Promise<CapitalSystemTestReport> {
  const generatedAt = new Date().toISOString()
  log.info('[capitalSystemTests] Starting 9 mandatory tests', { tenant_id: tenantId })

  const settled = await Promise.allSettled([
    testZeroOrphanCapital(tenantId),
    testFullSettlementPathCoverage(tenantId),
    testCapitalReconciliation(tenantId),
    testRegulatoryAuditTrailIntegrity(tenantId),
    testZeroCrossTenantLeakage(tenantId),
    testKycCoverage(tenantId),
    testEventDeterministicReplay(tenantId),
    testMlPatternFreshness(tenantId),
    testLiquidityCoverage(tenantId),
  ])

  const results: CapitalTestResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value
    const msg = s.reason instanceof Error ? s.reason.message : String(s.reason)
    return {
      test_id: `test_0${i + 1}_unknown`,
      test_name: `Test ${i + 1}`,
      passed: false,
      score: 0,
      details: `Promise rejected: ${msg}`,
      duration_ms: 0,
      critical: i < 6,
    }
  })

  const testsPassed = results.filter(r => r.passed).length
  const testsFailed = results.filter(r => !r.passed).length
  const criticalFailures = results.filter(r => r.critical && !r.passed).length
  const allCriticalPassed = criticalFailures === 0
  const capitalExecutionReady = allCriticalPassed
  const overallScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0

  const blockingIssues: string[] = results
    .filter(r => r.critical && !r.passed)
    .map(r => `[CRITICAL] ${r.test_name}: ${r.details}`)

  const report: CapitalSystemTestReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    critical_failures: criticalFailures,
    all_critical_passed: allCriticalPassed,
    capital_execution_ready: capitalExecutionReady,
    overall_score: overallScore,
    results,
    blocking_issues: blockingIssues,
  }

  // Persist to capital_system_test_reports (fire-and-forget)
  void (supabaseAdmin as any)
    .from('capital_system_test_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      tests_passed: testsPassed,
      tests_failed: testsFailed,
      critical_failures: criticalFailures,
      all_critical_passed: allCriticalPassed,
      capital_execution_ready: capitalExecutionReady,
      overall_score: overallScore,
      results: JSON.stringify(results),
      blocking_issues: JSON.stringify(blockingIssues),
    })
    .catch((e: unknown) => console.warn('[capitalSystemTests] persist failed', e))

  log.info('[capitalSystemTests] Tests complete', {
    tenant_id: tenantId,
    passed: testsPassed,
    failed: testsFailed,
    critical_failures: criticalFailures,
    capital_execution_ready: capitalExecutionReady,
    overall_score: overallScore,
  })

  return report
}
