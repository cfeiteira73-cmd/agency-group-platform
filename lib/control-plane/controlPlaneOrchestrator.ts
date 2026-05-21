// Agency Group — Control Plane Orchestrator
// lib/control-plane/controlPlaneOrchestrator.ts
// Master entry point: runs diagnostic → corrections → isolation → persists cycle result.
// Called by the /api/control-plane/trigger route.

import log from '@/lib/logger'
import {
  runDiagnosticCycle,
  getLatestDiagnosticCycle,
} from './autodiagnosticEngine'
import type { DiagnosticCycle } from './autodiagnosticEngine'
import { applyCorrections } from './autoCorrector'
import type { CorrectionAction } from './autoCorrector'
import {
  autoIsolateFromIssues,
  listIsolatedComponents,
} from './componentIsolator'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ControlPlaneCycleResult {
  cycle_id: string
  tenant_id: string
  executed_at: string
  diagnostic: DiagnosticCycle
  corrections: CorrectionAction[]
  isolated_components: string[]
  duration_ms: number
  next_cycle_recommended_in_ms: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeNextCycleMs(status: DiagnosticCycle['status']): number {
  if (status === 'CRITICAL') return 10_000
  if (status === 'DEGRADED') return 30_000
  return 60_000
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function runControlPlaneCycle(tenantId: string): Promise<ControlPlaneCycleResult> {
  const startedAt = Date.now()
  const executed_at = new Date().toISOString()

  log.info('[controlPlaneOrchestrator] Starting control plane cycle', { tenant_id: tenantId })

  // Step 1: Run diagnostic
  const diagnostic = await runDiagnosticCycle(tenantId)

  // Step 2: Filter auto-correctable issues
  const allIssues = diagnostic.dimensions.flatMap((d) => d.issues)
  const correctableIssues = allIssues.filter((i) => i.auto_correctable)
  const criticalIssues = allIssues.filter((i) => i.severity === 'CRITICAL')

  // Step 3: Apply corrections
  const corrections = await applyCorrections(correctableIssues, tenantId)

  // Step 4: Auto-isolate from critical issues
  await autoIsolateFromIssues(criticalIssues, tenantId)

  // Step 5: Get list of isolated components
  const isolatedRecords = await listIsolatedComponents(tenantId)
  const isolated_components = isolatedRecords.map((r) => r.component)

  // Step 6: Compute recommended next cycle interval
  const next_cycle_recommended_in_ms = computeNextCycleMs(diagnostic.status)

  const duration_ms = Date.now() - startedAt

  const result: ControlPlaneCycleResult = {
    cycle_id: diagnostic.cycle_id,
    tenant_id: tenantId,
    executed_at,
    diagnostic,
    corrections,
    isolated_components,
    duration_ms,
    next_cycle_recommended_in_ms,
  }

  log.info('[controlPlaneOrchestrator] Control plane cycle complete', {
    cycle_id: diagnostic.cycle_id,
    status: diagnostic.status,
    overall_score: diagnostic.overall_score,
    corrections_applied: corrections.length,
    isolated_components: isolated_components.length,
    duration_ms,
    next_cycle_recommended_in_ms,
    tenant_id: tenantId,
  })

  return result
}

export async function getControlPlaneStatus(tenantId: string): Promise<{
  latest_cycle: ControlPlaneCycleResult | null
  status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'
}> {
  try {
    const latestDiagnostic = await getLatestDiagnosticCycle(tenantId)

    if (!latestDiagnostic) {
      return { latest_cycle: null, status: 'UNKNOWN' }
    }

    // Reconstruct a lightweight ControlPlaneCycleResult from the stored diagnostic
    const latestCycle: ControlPlaneCycleResult = {
      cycle_id: latestDiagnostic.cycle_id,
      tenant_id: tenantId,
      executed_at: latestDiagnostic.started_at,
      diagnostic: latestDiagnostic,
      corrections: [],   // not re-fetched for status query — diagnostic is the source of truth
      isolated_components: [],
      duration_ms: 0,
      next_cycle_recommended_in_ms: computeNextCycleMs(latestDiagnostic.status),
    }

    let status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN'
    switch (latestDiagnostic.status) {
      case 'HEALTHY':
        status = 'OPERATIONAL'
        break
      case 'DEGRADED':
        status = 'DEGRADED'
        break
      case 'CRITICAL':
        status = 'CRITICAL'
        break
      default:
        status = 'UNKNOWN'
    }

    return { latest_cycle: latestCycle, status }
  } catch (err) {
    log.warn('[controlPlaneOrchestrator] getControlPlaneStatus failed', {
      error: err instanceof Error ? err.message : String(err),
      tenant_id: tenantId,
    })
    return { latest_cycle: null, status: 'UNKNOWN' }
  }
}
