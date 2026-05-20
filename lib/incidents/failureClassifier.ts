// =============================================================================
// Agency Group — Failure Classifier
// lib/incidents/failureClassifier.ts
//
// Signal-based automatic classification of incident failure types.
// Each failure type accumulates a confidence score from matched signals.
// The type with the highest score wins; secondary type is included when
// two types score closely (within 0.15 of each other).
//
// Confidence = matched_signals / total_possible_signals for that type.
// If confidence < 0.3 for all types → 'UNKNOWN'.
//
// Never throws to caller.
// TypeScript strict — 0 errors
// =============================================================================

import type { IncidentRow } from '@/lib/incidents/incidentIngestor'

// ─── Public types ─────────────────────────────────────────────────────────────

export type FailureType =
  | 'LOAD_SPIKE'
  | 'AI_COST_EXPLOSION'
  | 'GRAPH_DEGRADATION'
  | 'REGION_PARTITION'
  | 'QUEUE_OVERFLOW'
  | 'DATA_INCONSISTENCY'
  | 'DEPENDENCY_FAILURE'
  | 'UNKNOWN'

export interface ClassificationResult {
  incident_id:    string
  failure_type:   FailureType
  confidence:     number           // 0–1
  signals:        string[]         // human-readable list of what triggered classification
  secondary_type?: FailureType     // present if a second type scores within 0.15
}

// ─── Signal extraction helpers ────────────────────────────────────────────────

/**
 * Safely extracts a numeric metric from the incident's metadata.
 * Returns 0 when not present or not a number.
 */
function metricNum(
  incident: IncidentRow,
  key: string,
): number {
  const meta = incident.metrics_snapshot as Record<string, unknown> | undefined
  if (!meta) return 0
  const val = meta[key]
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? 0 : n
  }
  return 0
}

/**
 * Safely extracts a string field from metadata. Returns '' when absent.
 */
function metaStr(incident: IncidentRow, key: string): string {
  const meta = incident.metrics_snapshot as Record<string, unknown> | undefined
  if (!meta) return ''
  const val = meta[key]
  return typeof val === 'string' ? val.toLowerCase() : ''
}

/**
 * Returns the raw_error string from the top-level incident column (lowercased) or ''.
 */
function rawError(incident: IncidentRow): string {
  return ((incident.raw_error ?? '') as string).toLowerCase()
}

/**
 * Returns the load_mode string from metadata (uppercased) or ''.
 */
function loadMode(incident: IncidentRow): string {
  const meta = incident.metrics_snapshot as Record<string, unknown> | undefined
  if (!meta) return ''
  const val = meta['load_mode']
  return typeof val === 'string' ? val.toUpperCase() : ''
}

/**
 * Returns the runtime_events failed count from metadata or 0.
 */
function runtimeFailedCount(incident: IncidentRow): number {
  return metricNum(incident, 'runtime_events_failed_count')
}

// ─── Signal definitions ───────────────────────────────────────────────────────

interface SignalCheck {
  label:   string    // human-readable description included in signals[]
  matched: boolean
}

/**
 * Evaluates all signals for LOAD_SPIKE.
 * Total possible signals: 3
 */
function loadSpikeSignals(
  incident: IncidentRow,
): SignalCheck[] {
  const p95 = metricNum(incident, 'p95_latency_ms')
  const mode = loadMode(incident)
  return [
    {
      label:   'p95 latency > 1000ms in metrics snapshot',
      matched: p95 > 1000,
    },
    {
      label:   'subsystem is api',
      matched: incident.subsystem === 'api',
    },
    {
      label:   'load_mode is STRESSED or CRITICAL',
      matched: mode === 'STRESSED' || mode === 'CRITICAL',
    },
  ]
}

/**
 * Evaluates all signals for AI_COST_EXPLOSION.
 * Total possible signals: 3
 */
function aiCostExplosionSignals(
  incident: IncidentRow,
): SignalCheck[] {
  const aiSpike   = metricNum(incident, 'ai_cost_spike_eur')
  const errorText = rawError(incident)
  return [
    {
      label:   'ai_cost_spike_eur > 0 in metrics snapshot',
      matched: aiSpike > 0,
    },
    {
      label:   'subsystem is ai',
      matched: incident.subsystem === 'ai',
    },
    {
      label:   'raw_error contains budget, token, or rate_limit',
      matched: /budget|token|rate_limit/.test(errorText),
    },
  ]
}

/**
 * Evaluates all signals for GRAPH_DEGRADATION.
 * Total possible signals: 3
 */
function graphDegradationSignals(
  incident: IncidentRow,
  causalChain?: { propagation_path: string[] },
): SignalCheck[] {
  const graphTier     = metaStr(incident, 'graph_tier')
  const chainHasGraph = causalChain?.propagation_path.some(
    (p) => p.toLowerCase().includes('graph'),
  ) ?? false

  return [
    {
      label:   'subsystem is graph',
      matched: incident.subsystem === 'graph',
    },
    {
      label:   'graph_tier is COLD in metrics snapshot',
      matched: graphTier === 'cold',
    },
    {
      label:   'causal chain propagation path contains graph',
      matched: chainHasGraph,
    },
  ]
}

/**
 * Evaluates all signals for REGION_PARTITION.
 * Total possible signals: 3
 */
function regionPartitionSignals(
  incident: IncidentRow,
  causalChain?: { propagation_path: string[] },
): SignalCheck[] {
  const mode       = loadMode(incident)
  const chainHasRegion = causalChain?.propagation_path.some(
    (p) => p.toLowerCase().includes('region'),
  ) ?? false

  return [
    {
      label:   'load_mode is EMERGENCY',
      matched: mode === 'EMERGENCY',
    },
    {
      label:   'causal chain propagation path contains region',
      matched: chainHasRegion,
    },
    {
      label:   'subsystem is region',
      matched: incident.subsystem === 'region',
    },
  ]
}

/**
 * Evaluates all signals for QUEUE_OVERFLOW.
 * Total possible signals: 3
 */
function queueOverflowSignals(incident: IncidentRow): SignalCheck[] {
  const queueDepth    = metricNum(incident, 'queue_depth')
  const runtimeFailed = runtimeFailedCount(incident)

  return [
    {
      label:   'queue_depth > 100 in metrics snapshot',
      matched: queueDepth > 100,
    },
    {
      label:   'subsystem is queue',
      matched: incident.subsystem === 'queue',
    },
    {
      label:   'runtime_events failed count > 10',
      matched: runtimeFailed > 10,
    },
  ]
}

/**
 * Evaluates all signals for DATA_INCONSISTENCY.
 * Total possible signals: 3
 *
 * Specific to data corruption: schema violations, hash/checksum mismatches,
 * unexpected nulls, duplicate records, or explicit conflict/drift errors.
 * Does NOT overlap with DEPENDENCY_FAILURE (network/connection signals).
 */
function dataInconsistencySignals(incident: IncidentRow): SignalCheck[] {
  const errorText = rawError(incident)
  return [
    {
      // Data-integrity specific: hash/checksum mismatch, schema drift, conflicts, duplicates, nulls
      label:   'raw_error contains mismatch, drift, conflict, checksum, duplicate, or unexpected_null',
      matched: /mismatch|drift|conflict|checksum|duplicate|unexpected_null/.test(errorText),
    },
    {
      label:   'subsystem is database (primary data-integrity subsystem)',
      matched: incident.subsystem === 'database',
    },
    {
      // Schema violation or unexpected null in DB is strongly correlated with data inconsistency
      label:   'raw_error contains schema_violation, constraint, or integrity',
      matched: /schema_violation|constraint|integrity/.test(errorText),
    },
  ]
}

/**
 * Evaluates all signals for DEPENDENCY_FAILURE.
 * Total possible signals: 3
 *
 * Specific to external dependency outages: network timeouts, connection refused,
 * HTTP 5xx from external services, or authentication failures to third-party services.
 * Does NOT overlap with DATA_INCONSISTENCY (data corruption signals).
 */
function dependencyFailureSignals(incident: IncidentRow): SignalCheck[] {
  const errorText = rawError(incident)
  return [
    {
      // Network/connectivity specific: timeout, refused connections, unreachable hosts
      label:   'raw_error contains timeout, connection, ECONNREFUSED, or unreachable',
      matched: /timeout|connection|econnrefused|unreachable/.test(errorText),
    },
    {
      // External service failures: HTTP 5xx, upstream errors, third-party auth failures
      label:   'raw_error contains upstream, 5xx, http_error, or auth_failure',
      matched: /upstream|5xx|http_error|auth_failure/.test(errorText),
    },
    {
      // Cache is a dependency — cache unavailability is a dependency failure
      label:   'subsystem is cache (external dependency context)',
      matched: incident.subsystem === 'cache',
    },
  ]
}

// ─── Score computation ────────────────────────────────────────────────────────

interface TypeScore {
  type:       FailureType
  confidence: number
  signals:    string[]
}

function computeScore(
  type:    FailureType,
  checks:  SignalCheck[],
): TypeScore {
  const matched = checks.filter((c) => c.matched)
  const confidence = checks.length > 0
    ? Math.round((matched.length / checks.length) * 100) / 100
    : 0
  return {
    type,
    confidence,
    signals: matched.map((c) => c.label),
  }
}

// ─── classifyFailure ──────────────────────────────────────────────────────────

/**
 * Classifies the failure type of an incident using signal-based scoring.
 *
 * Rules evaluated:
 *   LOAD_SPIKE          p95>1000ms | subsystem=api | load_mode=STRESSED|CRITICAL
 *   AI_COST_EXPLOSION   ai_spike>0 | subsystem=ai  | error contains budget|token|rate_limit
 *   GRAPH_DEGRADATION   subsystem=graph | graph_tier=COLD | causal path has 'graph'
 *   REGION_PARTITION    load_mode=EMERGENCY | causal path has 'region' | subsystem=region
 *   QUEUE_OVERFLOW      queue_depth>100 | subsystem=queue | runtime_failed>10
 *   DATA_INCONSISTENCY  subsystem=database|cache | error has mismatch|drift|conflict
 *   DEPENDENCY_FAILURE  subsystem=database|cache | error has timeout|connection|ECONNREFUSED
 *
 * Scoring: confidence = matched / total signals per type.
 * Winner: highest confidence type.
 * Secondary: if second-place within 0.15 of winner.
 * UNKNOWN: if all confidences < 0.45 (raised from 0.3 to prevent single-signal classification).
 *
 * Never throws.
 */
export async function classifyFailure(
  incident:    IncidentRow,
  causalChain?: { propagation_path: string[] },
): Promise<ClassificationResult> {
  try {
    const scores: TypeScore[] = [
      computeScore('LOAD_SPIKE',         loadSpikeSignals(incident)),
      computeScore('AI_COST_EXPLOSION',  aiCostExplosionSignals(incident)),
      computeScore('GRAPH_DEGRADATION',  graphDegradationSignals(incident, causalChain)),
      computeScore('REGION_PARTITION',   regionPartitionSignals(incident, causalChain)),
      computeScore('QUEUE_OVERFLOW',     queueOverflowSignals(incident)),
      computeScore('DATA_INCONSISTENCY', dataInconsistencySignals(incident)),
      computeScore('DEPENDENCY_FAILURE', dependencyFailureSignals(incident)),
    ]

    // Sort descending by confidence
    scores.sort((a, b) => b.confidence - a.confidence)

    const best   = scores[0]!
    const second = scores[1]

    // UNKNOWN if all below minimum threshold.
    // 0.45 prevents single-signal classification (1/3 signals = 0.33 < threshold).
    if (best.confidence < 0.45) {
      return {
        incident_id:  incident.incident_id,
        failure_type: 'UNKNOWN',
        confidence:   best.confidence,
        signals:      [],
      }
    }

    const result: ClassificationResult = {
      incident_id:  incident.incident_id,
      failure_type: best.type,
      confidence:   best.confidence,
      signals:      best.signals,
    }

    // Attach secondary type when second place is within 0.15 of winner
    if (
      second &&
      second.confidence >= 0.45 &&
      best.confidence - second.confidence <= 0.15
    ) {
      result.secondary_type = second.type
    }

    return result
  } catch {
    // Fail-open: return UNKNOWN on any unexpected error
    return {
      incident_id:  incident.incident_id,
      failure_type: 'UNKNOWN',
      confidence:   0,
      signals:      [],
    }
  }
}

// ─── getFailureTypeDescription ────────────────────────────────────────────────

/**
 * Returns a human-readable description for a given FailureType.
 */
export function getFailureTypeDescription(type: FailureType): string {
  switch (type) {
    case 'LOAD_SPIKE':
      return 'Traffic volume exceeded system capacity, causing latency degradation and potential request failures'
    case 'AI_COST_EXPLOSION':
      return 'AI model usage cost spiked beyond expected bounds, indicating token budget exhaustion or runaway inference loops'
    case 'GRAPH_DEGRADATION':
      return 'Graph query layer experienced cold-start or performance degradation, affecting causal and relational lookups'
    case 'REGION_PARTITION':
      return 'Network partition or regional failure isolated one or more regions, triggering emergency load mode'
    case 'QUEUE_OVERFLOW':
      return 'Event or job queue depth exceeded capacity, causing delayed or dropped tasks and downstream failures'
    case 'DATA_INCONSISTENCY':
      return 'Database or cache state drift, mismatch, or conflict detected, resulting in data integrity concerns'
    case 'DEPENDENCY_FAILURE':
      return 'External dependency (database, cache, or third-party service) failed due to connection timeout or refused connections'
    case 'UNKNOWN':
      return 'Failure type could not be determined from available signals — manual investigation required'
  }
}
