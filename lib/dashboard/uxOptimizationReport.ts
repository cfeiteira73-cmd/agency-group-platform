// Agency Group — UX Optimization Report
// lib/dashboard/uxOptimizationReport.ts
// TypeScript strict — 0 errors
//
// Analyzes UX friction points in the portal.
// Sources: component coverage (dead sections), performance metrics (slow sections),
//          access patterns (unused sections), CRM funnel analysis.
// Output: friction points, conversion bottlenecks, recommended simplifications.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FrictionType = 'slow_load' | 'no_data' | 'complex_flow' | 'unused' | 'error_prone'

export interface UXFrictionPoint {
  section: string
  friction_type: FrictionType
  severity: 'high' | 'medium' | 'low'
  description: string
  recommended_fix: string
}

export interface ConversionBottleneck {
  funnel_stage: string        // lead → qualified → visit → offer → deal
  drop_off_indicator: string  // what signals drop-off at this stage
  improvement: string
}

export interface UISimplification {
  current: string
  proposed: string
  effort: 'trivial' | 'small' | 'medium'
  expected_impact: 'low' | 'medium' | 'high'
}

export interface UXOptimizationReport {
  report_id: string
  tenant_id: string

  friction_points: UXFrictionPoint[]

  conversion_bottlenecks: ConversionBottleneck[]

  ui_simplifications: UISimplification[]

  dead_sections: string[]       // sections with <1% usage
  hot_sections: string[]        // top 5 most-used sections

  ux_score: number              // 0–100

  generated_at: string
}

// ─── Funnel stage definitions ─────────────────────────────────────────────────

const FUNNEL_STAGES = ['lead', 'qualified', 'visit', 'offer', 'deal'] as const
type FunnelStage = typeof FUNNEL_STAGES[number]

// ─── Internal types ───────────────────────────────────────────────────────────

interface RawCoverageReport {
  dead_sections: string[]
  hot_sections: string[]
  coverage_score: number
  sections: {
    section: string
    avg_response_ms: number | null
    error_rate_pct: number
    data_present: boolean
    record_count: number | null
  }[]
}

interface RawDealRow {
  stage: string
}

// ─── Friction point identification ────────────────────────────────────────────

/**
 * Identifies friction points from slow/unused/error-prone sections.
 */
export async function identifyFrictionPoints(
  tenantId: string,
): Promise<UXFrictionPoint[]> {
  const frictions: UXFrictionPoint[] = []

  // Pull latest component coverage report
  const { data: coverageRows } = await (supabaseAdmin as any)
    .from('component_coverage_reports')
    .select('sections, dead_sections, coverage_score')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (coverageRows && coverageRows.length > 0) {
    const report = coverageRows[0] as RawCoverageReport
    const sections = report.sections ?? []
    const dead = report.dead_sections ?? []

    for (const sec of sections) {
      // Slow load friction
      if (sec.avg_response_ms !== null && sec.avg_response_ms > 1500) {
        frictions.push({
          section:          sec.section,
          friction_type:    'slow_load',
          severity:         sec.avg_response_ms > 3000 ? 'high' : 'medium',
          description:      `Section "${sec.section}" avg API response: ${sec.avg_response_ms.toFixed(0)} ms (target <1000 ms)`,
          recommended_fix:  'Add Redis cache or optimize underlying query',
        })
      }

      // No data friction
      if (!sec.data_present || sec.record_count === 0) {
        frictions.push({
          section:          sec.section,
          friction_type:    'no_data',
          severity:         'medium',
          description:      `Section "${sec.section}" renders without data — shows empty/skeleton state permanently`,
          recommended_fix:  'Seed demo data or implement guided onboarding for empty state',
        })
      }

      // Error-prone friction
      if (sec.error_rate_pct > 5) {
        frictions.push({
          section:          sec.section,
          friction_type:    'error_prone',
          severity:         sec.error_rate_pct > 20 ? 'high' : 'medium',
          description:      `Section "${sec.section}" has ${sec.error_rate_pct.toFixed(1)}% error rate`,
          recommended_fix:  'Investigate API failures and add retry logic with exponential back-off',
        })
      }
    }

    // Unused sections friction
    for (const section of dead) {
      frictions.push({
        section,
        friction_type:   'unused',
        severity:        'low',
        description:     `Section "${section}" has <1% usage — may confuse or clutter the portal`,
        recommended_fix: 'Hide behind feature flag or move to secondary navigation',
      })
    }
  }

  // Pull performance_metrics for sections not covered by component report
  const { data: perfRows } = await (supabaseAdmin as any)
    .from('performance_metrics')
    .select('endpoint, response_time_ms')
    .eq('tenant_id', tenantId)
    .gt('response_time_ms', 2000)
    .order('response_time_ms', { ascending: false })
    .limit(10)

  if (perfRows) {
    const existingSections = new Set(frictions.map(f => f.section))
    for (const row of perfRows as { endpoint: string; response_time_ms: number }[]) {
      const section = row.endpoint.replace('/api/', '').split('/')[0] ?? row.endpoint
      if (!existingSections.has(section)) {
        existingSections.add(section)
        frictions.push({
          section,
          friction_type:   'slow_load',
          severity:        'medium',
          description:     `API "${row.endpoint}" recorded ${row.response_time_ms} ms latency`,
          recommended_fix: 'Profile query plan and add covering index',
        })
      }
    }
  }

  return frictions
}

// ─── Conversion bottleneck analysis ──────────────────────────────────────────

/**
 * Analyzes deals table for funnel stage progression gaps.
 */
export async function identifyConversionBottlenecks(
  tenantId: string,
): Promise<ConversionBottleneck[]> {
  const bottlenecks: ConversionBottleneck[] = []

  // Count deals at each stage
  const stageCounts: Record<string, number> = {}

  for (const stage of FUNNEL_STAGES) {
    const { count } = await (supabaseAdmin as any)
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('stage', stage)

    stageCounts[stage] = typeof count === 'number' ? count : 0
  }

  // Identify drop-off between stages
  const stages: FunnelStage[] = [...FUNNEL_STAGES]
  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i]
    const nextStage    = stages[i + 1]
    const currentCount = stageCounts[currentStage] ?? 0
    const nextCount    = stageCounts[nextStage]    ?? 0

    if (currentCount > 0) {
      const conversionRate = Math.round((nextCount / currentCount) * 100)
      if (conversionRate < 30 && currentCount >= 3) {
        bottlenecks.push({
          funnel_stage:       `${currentStage} → ${nextStage}`,
          drop_off_indicator: `Only ${conversionRate}% of ${currentStage}s advance to ${nextStage} (${currentCount} → ${nextCount})`,
          improvement:        getStageImprovement(currentStage),
        })
      }
    }
  }

  // Stale deals check (no update in >30 days)
  const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: staleCount } = await (supabaseAdmin as any)
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('stage', 'eq', 'deal')  // exclude closed deals
    .lt('updated_at', staleThreshold)

  if (typeof staleCount === 'number' && staleCount > 0) {
    bottlenecks.push({
      funnel_stage:       'pipeline health',
      drop_off_indicator: `${staleCount} deal(s) stale for >30 days — no activity recorded`,
      improvement:        'Trigger automated follow-up sequence via CRM automation engine',
    })
  }

  // If no data found, return structural analysis
  if (bottlenecks.length === 0) {
    bottlenecks.push({
      funnel_stage:       'lead → qualified',
      drop_off_indicator: 'Insufficient deal data — funnel health cannot be measured yet',
      improvement:        'Ensure leads are being entered into PortalCRM with stage tracking enabled',
    })
  }

  return bottlenecks
}

function getStageImprovement(stage: FunnelStage): string {
  const improvements: Record<FunnelStage, string> = {
    lead:      'Enable lead scoring automation — auto-qualify leads with match score ≥60',
    qualified: 'Automate visit scheduling via PortalCRM follow-up sequences',
    visit:     'Send deal pack automatically after visit via revenue engine (match ≥80)',
    offer:     'Enable 1-click counter-offer template in PortalDealDesk',
    deal:      'Automate CPCV generation and deadline tracking',
  }
  return improvements[stage] ?? 'Review stage criteria and optimize qualification flow'
}

// ─── UI simplifications ───────────────────────────────────────────────────────

/**
 * Generates simplification recommendations from observed friction points.
 */
export function generateSimplifications(
  frictions: UXFrictionPoint[],
): UISimplification[] {
  const simplifications: UISimplification[] = []

  const hasSlowLoad   = frictions.some(f => f.friction_type === 'slow_load')
  const hasNoData     = frictions.some(f => f.friction_type === 'no_data')
  const hasUnused     = frictions.some(f => f.friction_type === 'unused')
  const hasErrorProne = frictions.some(f => f.friction_type === 'error_prone')

  if (hasSlowLoad) {
    simplifications.push({
      current:         'Section renders full skeleton on every page visit',
      proposed:        'Cache last-known data in localStorage, show stale-while-revalidate pattern',
      effort:          'small',
      expected_impact: 'high',
    })
  }

  if (hasNoData) {
    simplifications.push({
      current:         'Empty sections show generic skeleton indefinitely',
      proposed:        'Show guided onboarding prompt ("Add your first deal") in empty state',
      effort:          'trivial',
      expected_impact: 'medium',
    })
  }

  if (hasUnused) {
    simplifications.push({
      current:         'All portal sections visible in navigation regardless of usage',
      proposed:        'Move low-usage sections to collapsible "More" drawer — show top-5 by default',
      effort:          'small',
      expected_impact: 'medium',
    })
  }

  if (hasErrorProne) {
    simplifications.push({
      current:         'Error states show raw error messages or blank sections',
      proposed:        'Standardize via PortalEmptyState component with retry CTA',
      effort:          'trivial',
      expected_impact: 'medium',
    })
  }

  // Always recommend progressive disclosure for complex flows
  simplifications.push({
    current:         'Complex multi-step flows (deal creation, investor report) shown in full',
    proposed:        'Progressive disclosure — step 1 visible, next steps unlock on completion',
    effort:          'medium',
    expected_impact: 'high',
  })

  // Mobile optimization
  simplifications.push({
    current:         'Sidebar navigation visible by default on mobile',
    proposed:        'Collapse sidebar on mobile by default, swipe-to-reveal gesture',
    effort:          'small',
    expected_impact: 'medium',
  })

  return simplifications
}

// ─── UX score computation ─────────────────────────────────────────────────────

function computeUXScore(
  frictions: UXFrictionPoint[],
  bottlenecks: ConversionBottleneck[],
  deadSections: string[],
): number {
  let score = 100
  for (const f of frictions) {
    if (f.severity === 'high')   score -= 8
    else if (f.severity === 'medium') score -= 4
    else                         score -= 1
  }
  score -= bottlenecks.length * 5
  score -= deadSections.length * 2
  return Math.max(0, Math.min(100, score))
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generates and persists a full UX Optimization Report.
 */
export async function generateUXReport(
  tenantId: string,
): Promise<UXOptimizationReport> {
  log.info('[uxReport] start', { tenant_id: tenantId })

  const [frictionPoints, conversionBottlenecks] = await Promise.all([
    identifyFrictionPoints(tenantId),
    identifyConversionBottlenecks(tenantId),
  ])

  const uiSimplifications = generateSimplifications(frictionPoints)

  // Dead / hot sections from latest coverage report
  let deadSections: string[] = []
  let hotSections: string[]  = []

  const { data: coverageRows } = await (supabaseAdmin as any)
    .from('component_coverage_reports')
    .select('dead_sections, hot_sections')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (coverageRows && coverageRows.length > 0) {
    const r = coverageRows[0] as RawCoverageReport
    deadSections = r.dead_sections ?? []
    hotSections  = r.hot_sections  ?? []
  }

  const uxScore = computeUXScore(frictionPoints, conversionBottlenecks, deadSections)

  const report: UXOptimizationReport = {
    report_id:             randomUUID(),
    tenant_id:             tenantId,
    friction_points:       frictionPoints,
    conversion_bottlenecks: conversionBottlenecks,
    ui_simplifications:    uiSimplifications,
    dead_sections:         deadSections,
    hot_sections:          hotSections.slice(0, 5),
    ux_score:              uxScore,
    generated_at:          new Date().toISOString(),
  }

  // Persist to ux_optimization_reports
  const { error } = await (supabaseAdmin as any)
    .from('ux_optimization_reports')
    .insert({
      id:                     report.report_id,
      tenant_id:              report.tenant_id,
      friction_points:        report.friction_points,
      conversion_bottlenecks: report.conversion_bottlenecks,
      ui_simplifications:     report.ui_simplifications,
      dead_sections:          report.dead_sections,
      hot_sections:           report.hot_sections,
      ux_score:               report.ux_score,
      generated_at:           report.generated_at,
    })

  if (error) {
    log.warn('[uxReport] persist_failed', { error: error.message })
  }

  log.info('[uxReport] complete', {
    tenant_id:        tenantId,
    ux_score:         uxScore,
    friction_count:   frictionPoints.length,
    bottleneck_count: conversionBottlenecks.length,
  })

  return report
}
