// Agency Group — Self-Healing Engine API (Validation Layer)
// app/api/sre/self-healing/route.ts
// TypeScript strict — 0 errors
//
// Triggers the self-healing engine assessment against the current system state.
// Uses the validation-layer selfHealingEngine (lib/validation/selfHealingEngine.ts)
// which applies safe, reversible auto-corrections for LOW/MEDIUM issues.
// CRITICAL issues are NEVER auto-fixed — human intervention is required.
//
// GET  ?dry_run=true (default)  — healing assessment, no changes applied
// POST { "dry_run": false }     — apply healing actions + full audit log
//
// Auth: x-service-auth: INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import log from '@/lib/logger'
import {
  runSelfHealing,
  type SelfHealingReport,
} from '@/lib/validation/selfHealingEngine'
import {
  loadDimensionScores,
  checkStopConditions,
  generateActionItems,
} from '@/lib/validation/productionReadinessScorer'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'

export const runtime     = 'nodejs'
export const maxDuration = 120

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get('x-service-auth') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''
  return safeCompare(incoming, secret)
}

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET — dry-run healing assessment ────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dry_run') !== 'false'  // default: true

  log.info('[GET /api/sre/self-healing] dry-run healing assessment', {
    tenant_id: tenantId,
    dry_run:   dryRun,
  })

  try {
    // Collect current system issues by inspecting dimension scores
    const dimensions   = await loadDimensionScores(tenantId)
    const stopConditions = await checkStopConditions(tenantId, dimensions)
    const { critical, recommended } = generateActionItems(stopConditions, dimensions)

    // Derive issues list from critical actions (dry-run: no healing applied)
    const issueCount = critical.length
    const triggered  = stopConditions.filter(sc => sc.triggered)

    return NextResponse.json(
      {
        dry_run:              dryRun,
        issues_detected:      issueCount,
        critical_issues:      critical,
        recommended_actions:  recommended,
        stop_conditions_triggered: triggered.map(sc => sc.condition),
        dimensions: {
          integrity: dimensions.integrity.score,
          financial: dimensions.financial.score,
          events:    dimensions.events.score,
          ml:        dimensions.ml.score,
          security:  dimensions.security.score,
        },
        healing_applied: false,
        assessed_at:     new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control':       'no-store',
          'X-Dry-Run':           String(dryRun),
          'X-Issues-Detected':   String(issueCount),
          'X-Healing-Applied':   'false',
        },
      },
    )
  } catch (err) {
    log.error(
      '[GET /api/sre/self-healing] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST — apply healing actions ────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()

  // Parse body — default dry_run = true (safety first)
  let dryRun = true
  try {
    const body = await req.json() as { dry_run?: boolean }
    dryRun = body.dry_run !== false
  } catch {
    // empty body — default to dry_run
  }

  log.info('[POST /api/sre/self-healing] healing engine triggered', {
    tenant_id: tenantId,
    dry_run:   dryRun,
  })

  try {
    // Collect current dimension issues to classify
    const dimensions     = await loadDimensionScores(tenantId)
    const stopConditions = await checkStopConditions(tenantId, dimensions)
    const { critical }   = generateActionItems(stopConditions, dimensions)

    // Build issue list from detected stop conditions for healing classification
    const { classifyIssue } = await import('@/lib/validation/selfHealingEngine')
    const issues = stopConditions
      .filter(sc => sc.triggered)
      .map(sc =>
        classifyIssue(
          'production_readiness',
          `Stop condition ${sc.condition}: value=${sc.value} threshold=${sc.threshold}`,
          0,  // worst case score — triggers critical classification
        )
      )

    let healingReport: SelfHealingReport | null = null

    if (!dryRun) {
      // Apply healing on eligible (non-critical) issues
      healingReport = await runSelfHealing(tenantId, issues)
      log.info('[POST /api/sre/self-healing] healing applied', {
        tenant_id:         tenantId,
        auto_fixed:        healingReport.auto_fixed_count,
        manual_required:   healingReport.manual_required_count,
        critical_count:    healingReport.critical_count,
      })
    }

    return NextResponse.json(
      {
        dry_run:              dryRun,
        issues_detected:      issues.length,
        critical_issues:      critical,
        healing_applied:      !dryRun,
        healing_report:       healingReport
          ? {
              id:               healingReport.id,
              auto_fixed_count:     healingReport.auto_fixed_count,
              manual_required_count: healingReport.manual_required_count,
              critical_count:       healingReport.critical_count,
              high_count:           healingReport.high_count,
              ran_at:               healingReport.ran_at,
            }
          : null,
        dimensions: {
          integrity: dimensions.integrity.score,
          financial: dimensions.financial.score,
          events:    dimensions.events.score,
          ml:        dimensions.ml.score,
          security:  dimensions.security.score,
        },
        processed_at: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control':       'no-store',
          'X-Dry-Run':           String(dryRun),
          'X-Issues-Detected':   String(issues.length),
          'X-Healing-Applied':   String(!dryRun),
        },
      },
    )
  } catch (err) {
    log.error(
      '[POST /api/sre/self-healing] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
