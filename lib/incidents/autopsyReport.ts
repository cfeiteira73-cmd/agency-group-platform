// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Incident Autopsy Report Generator
// lib/incidents/autopsyReport.ts
//
// Generates a full post-incident autopsy report by orchestrating:
//   • causalReconstructor  — WHY it happened (causal chain + propagation)
//   • impactAnalyzer       — WHAT it cost (economic + operational impact)
//   • failureClassifier    — WHAT type of failure it was (signal-based)
//
// All three phases run in parallel via Promise.allSettled.
// Fail-open: partial reports are returned if any phase fails.
// Persists completed report back to the `incidents` table.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin }         from '@/lib/supabase'
import { reconstructCausalChain } from './causalReconstructor'
import { analyzeImpact }          from './impactAnalyzer'
import { classifyFailure }        from './failureClassifier'
import type { IncidentRow, IncidentSeverity } from './incidentIngestor'
import type { CausalChain }       from './causalReconstructor'
import type { IncidentImpact }    from './impactAnalyzer'
import type { ClassificationResult, FailureType } from './failureClassifier'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const incidentsTable = () => (supabaseAdmin as any).from('incidents')

// ─── Public types ─────────────────────────────────────────────────────────────

export interface IncidentAutopsyReport {
  incident_id:               string
  generated_at:              string
  severity:                  IncidentSeverity
  classification:            FailureType
  classification_confidence: number

  // Causal intelligence
  root_cause:            string      // human-readable summary
  causal_chain_summary:  string[]    // ordered narrative
  impacted_layers:       string[]
  propagation_summary:   string

  // Economics
  revenue_loss_eur:      number
  cost_impact_eur:       number
  total_economic_impact: number

  // Timeline
  detection_latency_ms:   number        // time from first signal to incident creation
  resolution_latency_ms:  number | null // null if unresolved
  mean_time_to_detect:    number        // same as detection_latency_ms (standardized field)
  mean_time_to_resolve:   number | null

  // Recommendations
  preventative_recommendations: string[]

  // Metadata
  tenant_id:         string
  region:            string
  subsystem:         string
  data_confidence:   number   // 0–1: quality of the autopsy
}

// ─── Recommendations map ──────────────────────────────────────────────────────

const RECOMMENDATIONS: Record<FailureType, string[]> = {
  LOAD_SPIKE: [
    'Enable auto-scaling in load governor',
    'Set STRESSED mode threshold lower',
  ],
  AI_COST_EXPLOSION: [
    'Lower token budget governor thresholds',
    'Enable haiku fallback at 80% budget',
  ],
  GRAPH_DEGRADATION: [
    'Increase HOT cache TTL',
    'Pre-warm adjacency cache on startup',
  ],
  REGION_PARTITION: [
    'Configure multi-region failover',
    'Add read replicas in secondary region',
  ],
  QUEUE_OVERFLOW: [
    'Increase DLQ retry capacity',
    'Add queue depth monitoring alert',
  ],
  DATA_INCONSISTENCY: [
    'Run schema drift detection more frequently',
    'Add DB health checks',
  ],
  DEPENDENCY_FAILURE: [
    'Add circuit breaker for critical dependencies',
    'Implement retry with backoff',
  ],
  UNKNOWN: [
    'Review incident manually',
    'Add more observability to affected subsystem',
  ],
}

// ─── Causal chain narrative builder ──────────────────────────────────────────

/**
 * Converts a CausalChain into a human-readable ordered narrative array.
 * Each element describes one step in the propagation.
 */
function buildCausalChainSummary(chain: CausalChain): string[] {
  const lines: string[] = []

  // Root cause first
  if (chain.root_cause) {
    const rc = chain.root_cause
    const tier = rc.subsystem === 'graph' ? ' (COLD tier)' : ''
    lines.push(`${rc.description}${tier} [${rc.subsystem}]`)
  } else if (chain.propagation_path.length > 0) {
    lines.push(`Failure detected in ${chain.propagation_path[0] ?? 'unknown'} subsystem`)
  }

  // Contributing factors
  for (const factor of chain.contributing_factors) {
    lines.push(`→ ${factor.description} [${factor.subsystem}]`)
  }

  // Propagation path (subsystem hops not already represented above)
  const coveredSubs = new Set<string>([
    chain.root_cause?.subsystem ?? '',
    ...chain.contributing_factors.map((f) => f.subsystem),
  ])
  for (const sub of chain.propagation_path) {
    if (!coveredSubs.has(sub)) {
      lines.push(`→ Propagated to ${sub} layer`)
      coveredSubs.add(sub)
    }
  }

  // Timeline-based entries (sample up to 3 notable events)
  const failureEntries = chain.timeline_entries
    .filter((e) => /fail|error|timeout/i.test(e.status ?? ''))
    .slice(0, 3)
  for (const entry of failureEntries) {
    if (!lines.some((l) => l.includes(entry.summary))) {
      lines.push(`→ ${entry.summary}`)
    }
  }

  return lines.length > 0 ? lines : ['No causal chain data available — manual review required']
}

// ─── Latency helpers ──────────────────────────────────────────────────────────

/**
 * Returns detection_latency_ms: time from created_at → detected_at (or 0).
 * Represents time from when the row was written vs when the signal first fired.
 */
function computeDetectionLatencyMs(incident: IncidentRow): number {
  try {
    const created  = incident.created_at ? new Date(incident.created_at).getTime() : null
    const detected = new Date(incident.detected_at).getTime()
    if (created === null) return 0
    return Math.max(0, detected - created)
  } catch {
    return 0
  }
}

/**
 * Returns resolution_latency_ms: time from detected_at → resolved_at, or null.
 */
function computeResolutionLatencyMs(incident: IncidentRow): number | null {
  if (!incident.resolved_at) return null
  try {
    const detected  = new Date(incident.detected_at).getTime()
    const resolved  = new Date(incident.resolved_at).getTime()
    return Math.max(0, resolved - detected)
  } catch {
    return null
  }
}

// ─── Data confidence aggregator ───────────────────────────────────────────────

function aggregateDataConfidence(
  chain:          CausalChain | null,
  impact:         IncidentImpact | null,
  classification: ClassificationResult | null,
): number {
  const scores: number[] = []
  if (chain)          scores.push(chain.confidence_score)
  if (impact)         scores.push(impact.confidence)
  if (classification) scores.push(classification.confidence)

  if (scores.length === 0) return 0.1
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length
  return Math.round(avg * 100) / 100
}

// ─── generateAutopsyReport ────────────────────────────────────────────────────

/**
 * Generates a full post-incident autopsy report for the given incident ID.
 *
 * Phases:
 *  1. Read incident from DB
 *  2. Run causal reconstruction, impact analysis, and failure classification in parallel
 *  3. Assemble report
 *  4. Persist report back to the incidents table
 *  5. Return report
 *
 * Fail-open: any phase failure produces a partial report with null/zero fields.
 * Never throws to caller.
 */
export async function generateAutopsyReport(
  incidentId: string,
): Promise<IncidentAutopsyReport> {
  // ── Phase 1: Read incident ──────────────────────────────────────────────────

  let incident: IncidentRow | null = null

  try {
    const { data, error } = await incidentsTable()
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()

    if (error || !data) {
      console.warn(
        '[autopsyReport] Failed to load incident:',
        error?.message ?? 'not found',
      )
    } else {
      incident = data as IncidentRow
    }
  } catch (err) {
    console.warn('[autopsyReport] DB read threw (fail-open):', err)
  }

  // Minimal stub when the incident row is unavailable
  if (!incident) {
    const stub: IncidentAutopsyReport = {
      incident_id:               incidentId,
      generated_at:              new Date().toISOString(),
      severity:                  'P2',
      classification:            'UNKNOWN',
      classification_confidence: 0,
      root_cause:                'Incident not found in database',
      causal_chain_summary:      ['No incident data available'],
      impacted_layers:           [],
      propagation_summary:       '',
      revenue_loss_eur:          0,
      cost_impact_eur:           0,
      total_economic_impact:     0,
      detection_latency_ms:      0,
      resolution_latency_ms:     null,
      mean_time_to_detect:       0,
      mean_time_to_resolve:      null,
      preventative_recommendations: RECOMMENDATIONS.UNKNOWN,
      tenant_id:                 'unknown',
      region:                    process.env.CURRENT_REGION ?? 'eu-west-1',
      subsystem:                 'unknown',
      data_confidence:           0,
    }
    return stub
  }

  // ── Phase 2: Parallel analysis ─────────────────────────────────────────────

  const [chainResult, impactResult, classificationResult] = await Promise.allSettled([
    reconstructCausalChain(incident),
    analyzeImpact(incident),
    classifyFailure(incident),
  ])

  const chain:          CausalChain | null          = chainResult.status          === 'fulfilled' ? chainResult.value          : null
  const impact:         IncidentImpact | null        = impactResult.status         === 'fulfilled' ? impactResult.value         : null
  const classification: ClassificationResult | null  = classificationResult.status === 'fulfilled' ? classificationResult.value : null

  if (chainResult.status === 'rejected') {
    console.warn('[autopsyReport] causalReconstructor failed (fail-open):', chainResult.reason)
  }
  if (impactResult.status === 'rejected') {
    console.warn('[autopsyReport] impactAnalyzer failed (fail-open):', impactResult.reason)
  }
  if (classificationResult.status === 'rejected') {
    console.warn('[autopsyReport] failureClassifier failed (fail-open):', classificationResult.reason)
  }

  // ── Phase 3: Assemble report ───────────────────────────────────────────────

  const failureType: FailureType = classification?.failure_type ?? 'UNKNOWN'

  const causalChainSummary = chain
    ? buildCausalChainSummary(chain)
    : ['Causal chain reconstruction unavailable — manual review required']

  const rootCauseText = chain?.root_cause?.description
    ?? incident.raw_error
    ?? 'Root cause could not be determined'

  const impactedLayers = chain?.system_layers_affected ?? (incident.subsystem ? [incident.subsystem] : [])

  const propagationSummary = chain
    ? (chain.propagation_path.length >= 2
        ? `Failure originated in ${chain.propagation_path[0]} and propagated through ${chain.propagation_path.join(' → ')}.`
        : `Single-subsystem failure in ${chain.propagation_path[0] ?? incident.subsystem ?? 'unknown'}.`)
    : ''

  const revenueLossEur    = impact?.revenue_loss_eur ?? 0
  const costImpactEur     = impact?.cost_overrun_eur ?? 0
  const totalEconomicImpact = impact?.total_economic_impact_eur ?? 0

  const detectionLatencyMs   = computeDetectionLatencyMs(incident)
  const resolutionLatencyMs  = computeResolutionLatencyMs(incident)

  const dataConfidence = aggregateDataConfidence(chain, impact, classification)

  const report: IncidentAutopsyReport = {
    incident_id:               incidentId,
    generated_at:              new Date().toISOString(),
    severity:                  incident.severity,
    classification:            failureType,
    classification_confidence: classification?.confidence ?? 0,

    root_cause:           rootCauseText,
    causal_chain_summary: causalChainSummary,
    impacted_layers:      impactedLayers,
    propagation_summary:  propagationSummary,

    revenue_loss_eur:      revenueLossEur,
    cost_impact_eur:       costImpactEur,
    total_economic_impact: totalEconomicImpact,

    detection_latency_ms:  detectionLatencyMs,
    resolution_latency_ms: resolutionLatencyMs,
    mean_time_to_detect:   detectionLatencyMs,
    mean_time_to_resolve:  resolutionLatencyMs,

    preventative_recommendations: RECOMMENDATIONS[failureType] ?? RECOMMENDATIONS.UNKNOWN,

    tenant_id:       incident.tenant_id,
    region:          incident.region ?? process.env.CURRENT_REGION ?? 'eu-west-1',
    subsystem:       incident.subsystem ?? 'unknown',
    data_confidence: dataConfidence,
  }

  // ── Phase 4: Persist report ────────────────────────────────────────────────

  try {
    const { error: updateError } = await incidentsTable()
      .update({
        autopsy_report:  report,
        status:          'autopsy_complete',
        classification:  failureType,
        updated_at:      new Date().toISOString(),
      })
      .eq('incident_id', incidentId)

    if (updateError) {
      console.warn('[autopsyReport] Failed to persist report (fail-open):', updateError.message)
    }
  } catch (err) {
    console.warn('[autopsyReport] Persist threw (fail-open):', err)
  }

  return report
}
