// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Full Validation Scan API v1.0
// app/api/validation/full-scan/route.ts
//
// Orchestrates a complete 7-layer validation scan:
//   Layer 1: Architecture Consistency
//   Layer 2: Event Integrity
//   Layer 3: Economic Consistency
//   Layer 4: ML Validation
//   Layer 5: Security Isolation
//   Layer 6: Distributed Resilience
//   Layer 7: Self-Healing + System Truth Report
//
// POST /api/validation/full-scan  — run all layers + healing + truth report
//   Auth: x-service-auth: INTERNAL_API_SECRET
// GET  /api/validation/full-scan  — latest SystemTruthReport
//   Auth: isPortalAuth
// GET  /api/validation/full-scan?mode=history — history
//   Auth: isPortalAuth
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { safeCompare } from '@/lib/safeCompare'
import log from '@/lib/logger'
import {
  classifyIssue,
  runSelfHealing,
  type DetectedIssue,
} from '@/lib/validation/selfHealingEngine'
import {
  generateSystemTruthReport,
  getLatestSystemTruthReport,
  getSystemTruthHistory,
  type SystemTruthReport,
} from '@/lib/validation/systemTruthReport'

export const runtime    = 'nodejs'
export const maxDuration = 300  // 5 min for full scan

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isServiceAuth(req: NextRequest): boolean {
  const secret  = process.env.INTERNAL_API_SECRET
  const incoming = req.headers.get('x-service-auth') ?? ''
  if (!secret || !incoming) return false
  return safeCompare(incoming, secret)
}

// ─── Layer result shape (local — avoids compile-time deps on other agents) ────

interface LayerScore {
  layer: string
  score: number
  passed: boolean
  critical_issues: string[]
  details: Record<string, unknown>
}

interface ArchScanResult {
  health_score: number
  violations: Array<{ severity: string; description: string }>
}

interface EventResult {
  overall_score?: number
  score?: number
  passed?: boolean
  critical_issues?: string[]
  topic_coverage_pct?: number
  replay_match?: boolean
  details?: Record<string, unknown>
}

interface EconResult {
  overall_score?: number
  score?: number
  passed?: boolean
  critical_issues?: string[]
  details?: Record<string, unknown>
}

interface MLResult {
  overall_score?: number
  score?: number
  passed?: boolean
  critical_issues?: string[]
  psi_score?: number
  details?: Record<string, unknown>
}

interface SecResult {
  overall_score?: number
  score?: number
  passed?: boolean
  critical_issues?: string[]
  no_cross_tenant_leakage?: boolean
  details?: Record<string, unknown>
}

interface ResilienceResult {
  overall_score?: number
  score?: number
  passed?: boolean
  critical_issues?: string[]
  estimated_rto_seconds?: number
  details?: Record<string, unknown>
}

// ─── Score extraction helpers ─────────────────────────────────────────────────

function extractScore(result: unknown): number {
  if (result === null || result === undefined) return 0
  const r = result as Record<string, unknown>
  const raw =
    r['health_score']   ??
    r['overall_score']  ??
    r['score']          ??
    0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n))
}

function extractCriticalIssues(result: unknown): string[] {
  if (result === null || result === undefined) return []
  const r = result as Record<string, unknown>

  // Architecture scanner uses violations array
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
  // Return a selection of top-level keys as details
  const out: Record<string, unknown> = {}
  for (const key of [
    'topic_coverage_pct', 'replay_match', 'psi_score',
    'estimated_rto_seconds', 'no_cross_tenant_leakage',
    'high_issues',
  ]) {
    if (key in r) out[key] = r[key]
  }
  return out
}

function toLayerScore(layer: string, result: unknown): LayerScore {
  const score           = extractScore(result)
  const criticalIssues  = extractCriticalIssues(result)
  const passed          = extractPassed(result, score)
  const details         = extractDetails(result)

  return { layer, score, passed, critical_issues: criticalIssues, details }
}

// ─── POST handler — run full scan ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isServiceAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  log.info('[full-scan] starting full system validation scan', { tenant_id: tenantId })

  // ── 1. Run all 6 validation layers concurrently via dynamic imports ────────
  const [archSettled, eventsSettled, econSettled, mlSettled, secSettled, resilienceSettled] =
    await Promise.allSettled([
      (await import('@/lib/validation/architectureScanner')).runArchitectureScan(tenantId),
      (await import('@/lib/validation/eventIntegrityTester')).runEventIntegrityTests(tenantId),
      (await import('@/lib/validation/economicConsistencyEngine')).runEconomicConsistencyTests(tenantId),
      (await import('@/lib/validation/mlValidationEngine')).runMLValidationAudit(tenantId),
      (await import('@/lib/validation/securityIsolationTester')).runSecurityIsolationTests(tenantId),
      (await import('@/lib/validation/distributedResilienceTester')).runResilienceValidation(tenantId),
    ])

  // ── 2. Extract values from settled results (handle rejections gracefully) ──
  const archValue      = archSettled.status      === 'fulfilled' ? archSettled.value      : null
  const eventsValue    = eventsSettled.status     === 'fulfilled' ? eventsSettled.value     : null
  const econValue      = econSettled.status       === 'fulfilled' ? econSettled.value       : null
  const mlValue        = mlSettled.status         === 'fulfilled' ? mlSettled.value         : null
  const secValue       = secSettled.status        === 'fulfilled' ? secSettled.value        : null
  const resilienceValue = resilienceSettled.status === 'fulfilled' ? resilienceSettled.value : null

  // Log any failures
  if (archSettled.status      === 'rejected') log.warn('[full-scan] architectureScanner failed',    { reason: String(archSettled.reason) })
  if (eventsSettled.status    === 'rejected') log.warn('[full-scan] eventIntegrityTester failed',   { reason: String(eventsSettled.reason) })
  if (econSettled.status      === 'rejected') log.warn('[full-scan] economicConsistency failed',    { reason: String(econSettled.reason) })
  if (mlSettled.status        === 'rejected') log.warn('[full-scan] mlValidationEngine failed',     { reason: String(mlSettled.reason) })
  if (secSettled.status       === 'rejected') log.warn('[full-scan] securityIsolation failed',      { reason: String(secSettled.reason) })
  if (resilienceSettled.status === 'rejected') log.warn('[full-scan] resilienceTester failed',       { reason: String(resilienceSettled.reason) })

  // ── 3. Build LayerScore objects ────────────────────────────────────────────
  const archLayer      = toLayerScore('architecture', archValue)
  const eventsLayer    = toLayerScore('events',       eventsValue)
  const econLayer      = toLayerScore('economic',     econValue)
  const mlLayer        = toLayerScore('ml',           mlValue)
  const secLayer       = toLayerScore('security',     secValue)
  const resilienceLayer = toLayerScore('resilience',   resilienceValue)

  // ── 4. Collect all issues and classify for self-healing ───────────────────
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
    // If layer failed but score is non-zero, also add a layer-level issue
    if (!layer.passed && layer.critical_issues.length === 0 && layer.score < 70) {
      allIssues.push(
        classifyIssue(name, `Layer ${name} did not pass (score: ${layer.score})`, layer.score)
      )
    }
  }

  // ── 5. Run self-healing on collected issues ───────────────────────────────
  const healingReport = await runSelfHealing(tenantId, allIssues)

  // ── 6. Generate System Truth Report ───────────────────────────────────────
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

  log.info('[full-scan] full scan complete', {
    tenant_id:        tenantId,
    overall_score:    report.overall_score,
    system_validated: report.system_validated,
    healing_report:   healingReport.id,
  })

  return NextResponse.json({
    ok:              true,
    report,
    healing_summary: {
      id:                 healingReport.id,
      auto_fixed:         healingReport.auto_fixed_count,
      manual_required:    healingReport.manual_required_count,
      critical_count:     healingReport.critical_count,
      high_count:         healingReport.high_count,
    },
    layer_scores: {
      architecture:    archLayer.score,
      events:          eventsLayer.score,
      economic:        econLayer.score,
      ml:              mlLayer.score,
      security:        secLayer.score,
      resilience:      resilienceLayer.score,
    },
  })
}

// ─── GET handler — latest report or history ───────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  const mode = req.nextUrl.searchParams.get('mode')

  if (mode === 'history') {
    const limitParam = req.nextUrl.searchParams.get('limit')
    const limit      = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20

    const history = await getSystemTruthHistory(tenantId, limit)
    return NextResponse.json({ ok: true, reports: history, count: history.length })
  }

  const latest: SystemTruthReport | null = await getLatestSystemTruthReport(tenantId)

  if (!latest) {
    return NextResponse.json(
      { ok: false, error: 'No system truth report found — run POST /api/validation/full-scan first' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, report: latest })
}
