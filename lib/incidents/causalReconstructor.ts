// =============================================================================
// Agency Group — Causal Reconstructor
// lib/incidents/causalReconstructor.ts
//
// Rebuilds the causal chain of events that led to any incident by querying:
//   • Observability Kernel  (audit_log + runtime_events)
//   • Graph engine          (WHY_DID_DEAL_CLOSE recursive CTE)
//
// Architecture:
//   incident → time window → [forensics timeline] → [graph enrichment]
//            → root cause  → contributing factors → propagation path
//            → confidence scoring → CausalChain
//
// TypeScript strict — 0 errors
// =============================================================================

import { getSystemTimeline }       from '@/lib/observability/kernel'
import { executeGraphQuery }        from '@/lib/graph/graphQueryInterface'
import type { TimelineEntry }       from '@/lib/observability/unifiedTimeline'
import type { IncidentRow }         from './incidentIngestor'

// ─── Public types ─────────────────────────────────────────────────────────────

export type CausalFactorType = 'root_cause' | 'contributing' | 'propagation' | 'environmental'

export interface CausalFactor {
  factor_id:   string
  type:        CausalFactorType
  description: string
  subsystem:   string
  occurred_at: string
  evidence:    TimelineEntry[]   // supporting timeline entries
  confidence:  number            // 0–1
}

export interface CausalChain {
  incident_id:              string
  root_cause:               CausalFactor | null
  contributing_factors:     CausalFactor[]
  propagation_path:         string[]   // ordered subsystem names e.g. ['api', 'queue', 'database']
  system_layers_affected:   string[]   // unique architecture layers hit
  timeline_entries:         TimelineEntry[]
  confidence_score:         number     // 0–1 overall chain confidence
  reconstruction_latency_ms: number
  reconstructed_at:         string
  /** true when the realtime (unfiltered) fallback was used instead of correlated forensics */
  used_realtime_fallback?:  boolean
  evidence_window: {
    from: string
    to:   string
  }
}

// ─── Subsystem derivation ─────────────────────────────────────────────────────

/**
 * Derives a short subsystem name from a timeline event_type.
 * Maps prefixes like 'ai:execute' → 'ai', 'deal:create' → 'api', etc.
 */
function deriveSubsystem(eventType: string): string {
  const prefix = eventType.split(':')[0]?.toLowerCase() ?? ''
  const MAP: Record<string, string> = {
    ai:        'ai',
    deal:      'api',
    lead:      'api',
    agent:     'api',
    auth:      'api',
    queue:     'queue',
    event:     'queue',
    runtime:   'queue',
    db:        'database',
    database:  'database',
    sql:       'database',
    cache:     'cache',
    redis:     'cache',
    graph:     'graph',
    causal:    'graph',
    infra:     'infra',
    cron:      'infra',
    webhook:   'infra',
    stripe:    'infra',
    storage:   'infra',
    cdn:       'infra',
  }
  return MAP[prefix] ?? (prefix || 'unknown')
}

// ─── Layer mapping ────────────────────────────────────────────────────────────

const SUBSYSTEM_TO_LAYER: Record<string, string> = {
  ai:         'ai',
  api:        'api',
  queue:      'business_logic',
  database:   'data',
  cache:      'cache',
  graph:      'business_logic',
  infra:      'infra',
  unknown:    'api',
}

/**
 * identifyAffectedLayers — returns unique architecture layer names from a chain.
 * Layers: 'presentation' | 'api' | 'business_logic' | 'data' | 'cache' | 'ai' | 'infra'
 */
export function identifyAffectedLayers(chain: CausalChain): string[] {
  const layers = new Set<string>()
  const addFromSubsystem = (sub: string): void => {
    layers.add(SUBSYSTEM_TO_LAYER[sub] ?? 'api')
  }

  if (chain.root_cause) addFromSubsystem(chain.root_cause.subsystem)
  for (const f of chain.contributing_factors) addFromSubsystem(f.subsystem)
  for (const sub of chain.propagation_path) addFromSubsystem(sub)

  return Array.from(layers)
}

// ─── Propagation path ─────────────────────────────────────────────────────────

/**
 * buildPropagationPath — extracts unique subsystems from timeline in
 * chronological order (oldest first).
 */
export function buildPropagationPath(entries: TimelineEntry[]): string[] {
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const seen   = new Set<string>()
  const path: string[] = []
  for (const entry of sorted) {
    const sub = deriveSubsystem(entry.event_type)
    if (!seen.has(sub)) {
      seen.add(sub)
      path.push(sub)
    }
  }
  return path
}

// ─── Failure check ────────────────────────────────────────────────────────────

function isFailureEntry(entry: TimelineEntry): boolean {
  const s = (entry.status ?? '').toLowerCase()
  return s === 'failed' || s === 'error' || s === 'failure'
}

// ─── Unique factor ID ─────────────────────────────────────────────────────────

let _factorSeq = 0
function nextFactorId(prefix: string): string {
  _factorSeq++
  return `${prefix}_factor_${_factorSeq}_${Date.now()}`
}

// ─── Graph enrichment ─────────────────────────────────────────────────────────

/**
 * Attempts to call executeGraphQuery for WHY_DID_DEAL_CLOSE.
 * Returns enriched contributing factors derived from graph insights.
 * Fail-open — returns [] on any error.
 */
async function fetchGraphFactors(
  tenantId: string,
  correlationId: string,
  allEntries: TimelineEntry[],
): Promise<CausalFactor[]> {
  try {
    const graphResponse = await executeGraphQuery({
      type:           'WHY_DID_DEAL_CLOSE',
      tenant_id:      tenantId,
      correlation_id: correlationId,
    })

    if (graphResponse.error || !graphResponse.data) return []

    const factors: CausalFactor[] = graphResponse.insights
      .filter((insight) => insight.trim().length > 0)
      .map((insight, i) => ({
        factor_id:   `graph_${i}_${Date.now()}`,
        type:        'contributing' as CausalFactorType,
        description: insight,
        subsystem:   'graph',
        occurred_at: graphResponse.executed_at,
        evidence:    allEntries.filter((e) => deriveSubsystem(e.event_type) === 'graph'),
        confidence:  0.7,
      }))

    return factors
  } catch {
    return []
  }
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function computeConfidence(
  rootCause:          CausalFactor | null,
  allEntries:         TimelineEntry[],
  usedRealtimeFallback = false,
): number {
  let score: number
  if (allEntries.length === 0)  score = 0.1
  else if (!rootCause)          score = 0.3
  else if (allEntries.length > 5) score = 0.9
  else                          score = 0.6

  // Safety guard: cap confidence at 0.5 when using the unfiltered realtime fallback.
  // The fallback returns any recent events (not correlated to this incident) so a
  // high confidence score here would be a false signal — risk of wrong-root-cause@0.9.
  if (usedRealtimeFallback) {
    score = Math.min(score * 0.5, 0.5)
  }

  return score
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * reconstructCausalChain — rebuilds the causal chain for an incident.
 *
 * Phase 1  Timeline reconstruction via Observability Kernel (forensics → realtime fallback)
 * Phase 2  Graph causal lookup (WHY_DID_DEAL_CLOSE) when subsystem is 'graph'
 *          or a correlation_id is present
 * Phase 3  Root cause + contributing factors + propagation path identification
 * Phase 4  Confidence scoring
 *
 * Fail-open: never throws. Returns a zero-evidence chain on total failure.
 *
 * @param incident      — IncidentRow from the `incidents` table
 * @param windowMinutes — minutes BEFORE detected_at to look back (default 15).
 *                        5 extra minutes after detected_at are always included.
 */
export async function reconstructCausalChain(
  incident: IncidentRow,
  windowMinutes = 15,
): Promise<CausalChain> {
  const startMs = Date.now()

  // ── Compute evidence window ────────────────────────────────────────────────

  const detectedAt  = new Date(incident.detected_at)
  const windowStart = new Date(detectedAt.getTime() - windowMinutes * 60 * 1000).toISOString()
  const windowEnd   = new Date(detectedAt.getTime() + 5 * 60 * 1000).toISOString()

  // ── Phase 1: Timeline reconstruction ──────────────────────────────────────

  let timelineEntries: TimelineEntry[] = []
  let usedRealtimeFallback             = false

  try {
    // Use source_correlation_id (the runtime event that triggered detection) as
    // the correlation handle — incident_id is never written to audit_log so using
    // it directly produces zero matches and falls back to unrelated events.
    // Fall back to incident_id only when source_correlation_id is absent.
    const correlationHandle = incident.source_correlation_id ?? incident.incident_id

    // Primary: forensics mode using the correct correlation handle
    const forensicsResponse = await getSystemTimeline({
      tenant_id:      incident.tenant_id,
      mode:           'forensics',
      correlation_id: correlationHandle,
      time_range:     { from: windowStart, to: windowEnd },
    })
    timelineEntries = forensicsResponse.entries

    // Fallback: realtime if forensics returned 0 entries.
    // NOTE: realtime returns unfiltered recent events — these are NOT necessarily
    // correlated to this incident. We set usedRealtimeFallback=true so that:
    //   1. confidence is capped at 0.5 (wrong-root-cause@0.9 prevention)
    //   2. we filter fallback entries to the incident's subsystem before picking
    //      a root cause, reducing the chance of a false root cause selection.
    if (timelineEntries.length === 0) {
      console.warn(
        '[causalReconstructor] no correlated events found for incident',
        incident.incident_id,
        '— falling back to recency',
      )
      const realtimeResponse = await getSystemTimeline({
        tenant_id:  incident.tenant_id,
        mode:       'realtime',
        time_range: { from: windowStart, to: windowEnd },
        limit:      500,
      })
      usedRealtimeFallback = true

      // Safety guard: prefer entries matching the incident subsystem to avoid
      // picking a root cause from an unrelated concurrent operation.
      const subsystemMatch = incident.subsystem
        ? realtimeResponse.entries.filter(
            (e) => deriveSubsystem(e.event_type) === incident.subsystem,
          )
        : []

      // Use subsystem-filtered set if it has entries; otherwise fall back to full set
      timelineEntries = subsystemMatch.length > 0
        ? subsystemMatch
        : realtimeResponse.entries
    }
  } catch (err) {
    console.error(
      '[CausalReconstructor] Phase 1 (timeline) failed — continuing with empty set:',
      err instanceof Error ? err.message : err,
    )
    timelineEntries = []
  }

  // Sort ASC (oldest first) for causal analysis
  const sorted = timelineEntries
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // ── Phase 2: Graph causal lookup ───────────────────────────────────────────

  let graphFactors: CausalFactor[] = []

  const shouldQueryGraph = incident.subsystem === 'graph'

  if (shouldQueryGraph) {
    graphFactors = await fetchGraphFactors(
      incident.tenant_id,
      incident.incident_id,
      sorted,
    )
  }

  // ── Phase 3: Root cause & contributing factors ────────────────────────────

  let rootCause: CausalFactor | null = null
  const contributingFactors: CausalFactor[]  = []
  const propagationEntries:  TimelineEntry[]  = []

  if (sorted.length > 0) {
    // Find the FIRST failure entry
    const firstFailureIdx = sorted.findIndex(isFailureEntry)

    if (firstFailureIdx !== -1) {
      const rootEntry = sorted[firstFailureIdx]!
      const rootTs    = new Date(rootEntry.timestamp).getTime()
      const twoMinsMs = 2 * 60 * 1000

      rootCause = {
        factor_id:   nextFactorId('root'),
        type:        'root_cause',
        description: rootEntry.summary,
        subsystem:   deriveSubsystem(rootEntry.event_type),
        occurred_at: rootEntry.timestamp,
        evidence:    [rootEntry],
        confidence:  0.85,
      }

      // Contributing: subsequent failures within 2 minutes of root cause
      // Propagation: entries after that
      for (let i = firstFailureIdx + 1; i < sorted.length; i++) {
        const entry   = sorted[i]!
        const entryTs = new Date(entry.timestamp).getTime()

        if (isFailureEntry(entry) && entryTs - rootTs <= twoMinsMs) {
          contributingFactors.push({
            factor_id:   nextFactorId('contrib'),
            type:        'contributing',
            description: entry.summary,
            subsystem:   deriveSubsystem(entry.event_type),
            occurred_at: entry.timestamp,
            evidence:    [entry],
            confidence:  0.65,
          })
        } else if (entryTs > rootTs) {
          propagationEntries.push(entry)
        }
      }
    }
    // No failure found → treat all entries as environmental context
    // (root_cause stays null, propagation covers everything)
    else {
      propagationEntries.push(...sorted)
    }
  }

  // Merge graph factors into contributing factors
  const allContributing = [...contributingFactors, ...graphFactors]

  // ── Phase 4: Confidence scoring ────────────────────────────────────────────

  const confidenceScore = computeConfidence(rootCause, sorted, usedRealtimeFallback)

  // ── Assemble chain ─────────────────────────────────────────────────────────

  const propagationPath   = buildPropagationPath(propagationEntries.length > 0 ? propagationEntries : sorted)

  const chain: CausalChain = {
    incident_id:               incident.incident_id,
    root_cause:                rootCause,
    contributing_factors:      allContributing,
    propagation_path:          propagationPath,
    system_layers_affected:    [],      // filled below
    timeline_entries:          sorted,
    confidence_score:          confidenceScore,
    reconstruction_latency_ms: Date.now() - startMs,
    reconstructed_at:          new Date().toISOString(),
    ...(usedRealtimeFallback ? { used_realtime_fallback: true } : {}),
    evidence_window: {
      from: windowStart,
      to:   windowEnd,
    },
  }

  chain.system_layers_affected = identifyAffectedLayers(chain)

  return chain
}

// ─── Re-export for consumers ──────────────────────────────────────────────────

export type { TimelineEntry }
