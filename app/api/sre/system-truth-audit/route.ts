// Agency Group — System Truth Audit API
// app/api/sre/system-truth-audit/route.ts
// TypeScript strict — 0 errors
//
// Runs the full 6-dimension system truth audit, then:
//   1. Classifies issues via selfHealingEngine
//   2. Runs self-healing (non-destructive)
//   3. Generates SystemTruthReport
//
// GET  — Latest cached system truth report
// POST — Fresh full audit (all 6 dimensions + gap detection + truth report)
//
// Auth: x-service-auth: INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import log from '@/lib/logger'
import {
  generateSystemTruthReport,
  getLatestSystemTruthReport,
  type SystemTruthReport,
} from '@/lib/validation/systemTruthReport'
import {
  classifyIssue,
  runSelfHealing,
  type DetectedIssue,
} from '@/lib/validation/selfHealingEngine'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'

export const runtime     = 'nodejs'
export const maxDuration = 300

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

// ─── Shared types (avoids compile-time circular imports) ──────────────────────

interface LayerScore {
  layer: string
  score: number
  passed: boolean
  critical_issues: string[]
  details: Record<string, unknown>
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

function extractScore(result: unknown): number {
  if (result === null || result === undefined) return 0
  const r = result as Record<string, unknown>
  const raw =
    r['health_score']  ??
    r['overall_score'] ??
    r['score']         ??
    0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n))
}

function extractCriticalIssues(result: unknown): string[] {
  if (result === null || result === undefined) return []
  const r = result as Record<string, unknown>
  if (Array.isArray(r['violations'])) {
    return (r['violations'] as Array<{ severity: string; description: string }>)
      .filter(v => v.severity === 'critical')
      .map(v => v.description)
  }
  if (Array.isArray(r['critical_issues'])) {
    return r['critical_issues'] as string[]
  }
  return []
}

function extractPassed(result: unknown, score: number): boolean {
  if (result === null || result === undefined) return false
  const r = result as Record<string, unknown>
  if (typeof r['passed'] === 'boolean') return r['passed']
  return score >= 60
}

function extractDetails(result: unknown): Record<string, unknown> {
  if (result === null || result === undefined) return {}
  const r = result as Record<string, unknown>
  if (typeof r['details'] === 'object' && r['details'] !== null) {
    return r['details'] as Record<string, unknown>
  }
  const out: Record<string, unknown> = {}
  for (const key of [
    'topic_coverage_pct', 'replay_match', 'psi_score',
    'estimated_rto_seconds', 'no_cross_tenant_leakage', 'high_issues',
  ]) {
    if (key in r) out[key] = r[key]
  }
  return out
}

function toLayerScore(layer: string, result: unknown): LayerScore {
  const score          = extractScore(result)
  const criticalIssues = extractCriticalIssues(result)
  const passed         = extractPassed(result, score)
  const details        = extractDetails(result)
  return { layer, score, passed, critical_issues: criticalIssues, details }
}

// ─── GET — latest cached report ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()

  try {
    const report: SystemTruthReport | null = await getLatestSystemTruthReport(tenantId)

    if (!report) {
      return NextResponse.json(
        {
          error: 'No system truth report found — run POST /api/sre/system-truth-audit first',
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { ok: true, report },
      {
        headers: {
          'Cache-Control':      'no-store',
          'X-Overall-Score':    String(report.overall_score),
          'X-System-Validated': String(report.system_validated),
          'X-Critical-Issues':  String(report.critical_issues.length),
        },
      },
    )
  } catch (err) {
    log.error(
      '[GET /api/sre/system-truth-audit] error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST — fresh full audit ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()

  log.info('[POST /api/sre/system-truth-audit] starting 6-dimension audit', {
    tenant_id: tenantId,
  })

  // ── Run all 6 validation layers concurrently via dynamic imports ───────────
  const [
    archSettled,
    eventsSettled,
    econSettled,
    mlSettled,
    secSettled,
    resilienceSettled,
  ] = await Promise.allSettled([
    (await import('@/lib/validation/architectureScanner')).runArchitectureScan(tenantId),
    (await import('@/lib/validation/eventIntegrityTester')).runEventIntegrityTests(tenantId),
    (await import('@/lib/validation/economicConsistencyEngine')).runEconomicConsistencyTests(tenantId),
    (await import('@/lib/validation/mlValidationEngine')).runMLValidationAudit(tenantId),
    (await import('@/lib/validation/securityIsolationTester')).runSecurityIsolationTests(tenantId),
    (await import('@/lib/validation/distributedResilienceTester')).runResilienceValidation(tenantId),
  ])

  // Extract values from settled results
  const archValue       = archSettled.status       === 'fulfilled' ? archSettled.value       : null
  const eventsValue     = eventsSettled.status      === 'fulfilled' ? eventsSettled.value      : null
  const econValue       = econSettled.status        === 'fulfilled' ? econSettled.value        : null
  const mlValue         = mlSettled.status          === 'fulfilled' ? mlSettled.value          : null
  const secValue        = secSettled.status         === 'fulfilled' ? secSettled.value         : null
  const resilienceValue = resilienceSettled.status  === 'fulfilled' ? resilienceSettled.value  : null

  // Log any failures
  if (archSettled.status       === 'rejected') log.warn('[system-truth-audit] architectureScanner failed',  { reason: String(archSettled.reason) })
  if (eventsSettled.status     === 'rejected') log.warn('[system-truth-audit] eventIntegrityTester failed', { reason: String(eventsSettled.reason) })
  if (econSettled.status       === 'rejected') log.warn('[system-truth-audit] economicConsistency failed',  { reason: String(econSettled.reason) })
  if (mlSettled.status         === 'rejected') log.warn('[system-truth-audit] mlValidationEngine failed',   { reason: String(mlSettled.reason) })
  if (secSettled.status        === 'rejected') log.warn('[system-truth-audit] securityIsolation failed',    { reason: String(secSettled.reason) })
  if (resilienceSettled.status === 'rejected') log.warn('[system-truth-audit] resilienceTester failed',     { reason: String(resilienceSettled.reason) })

  // Build LayerScore objects
  const archLayer       = toLayerScore('architecture', archValue)
  const eventsLayer     = toLayerScore('events',       eventsValue)
  const econLayer       = toLayerScore('economic',     econValue)
  const mlLayer         = toLayerScore('ml',           mlValue)
  const secLayer        = toLayerScore('security',     secValue)
  const resilienceLayer = toLayerScore('resilience',   resilienceValue)

  // Collect and classify issues for self-healing
  const allIssues: DetectedIssue[] = []

  const layers: Array<{ name: string; layer: LayerScore }> = [
    { name: 'architecture', layer: archLayer },
    { name: 'events',       layer: eventsLayer },
    { name: 'economic',     layer: econLayer },
    { name: 'ml',           layer: mlLayer },
    { name: 'security',     layer: secLayer },
    { name: 'resilience',   layer: resilienceLayer },
  ]

  for (const { name, layer } of layers) {
    for (const ci of layer.critical_issues) {
      allIssues.push(classifyIssue(name, ci, layer.score))
    }
    if (!layer.passed && layer.critical_issues.length === 0 && layer.score < 70) {
      allIssues.push(
        classifyIssue(name, `Layer ${name} did not pass (score: ${layer.score})`, layer.score),
      )
    }
  }

  // Run self-healing on collected issues
  const healingReport = await runSelfHealing(tenantId, allIssues)

  // Generate System Truth Report
  const report = await generateSystemTruthReport(
    tenantId,
    {
      architecture: archLayer,
      events:       eventsLayer,
      economic:     econLayer,
      ml:           mlLayer,
      security:     secLayer,
      resilience:   resilienceLayer,
    },
    healingReport,
  )

  log.info('[POST /api/sre/system-truth-audit] audit complete', {
    tenant_id:        tenantId,
    overall_score:    report.overall_score,
    system_validated: report.system_validated,
    critical_issues:  report.critical_issues.length,
  })

  return NextResponse.json(
    {
      ok:     true,
      report,
      healing_summary: {
        id:                    healingReport.id,
        auto_fixed:            healingReport.auto_fixed_count,
        manual_required:       healingReport.manual_required_count,
        critical_count:        healingReport.critical_count,
        high_count:            healingReport.high_count,
      },
      layer_scores: {
        architecture: archLayer.score,
        events:       eventsLayer.score,
        economic:     econLayer.score,
        ml:           mlLayer.score,
        security:     secLayer.score,
        resilience:   resilienceLayer.score,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control':      'no-store',
        'X-Overall-Score':    String(report.overall_score),
        'X-System-Validated': String(report.system_validated),
        'X-Critical-Issues':  String(report.critical_issues.length),
      },
    },
  )
}
