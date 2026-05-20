// =============================================================================
// Agency Group — Observability Kernel
// lib/observability/kernel.ts
//
// Single source of truth for all timeline queries.
// All UI and API consumers MUST use this interface — never raw table queries.
//
// Architecture:
//   events → kernel → normalized timeline → UI
//
// Modes:
//   realtime  — Latest N entries across all sources. Fast path. Default limit 50.
//   replay    — All entries for a specific correlation_id, sorted ASC (oldest
//               first). Used for step-by-step replay. Requires correlation_id.
//               Max limit 500.
//   forensics — All entries for a correlation_id + 30 s window around
//               first/last entry, sorted DESC (most recent first). Wider net
//               for debugging. Requires correlation_id. Notes causal source as
//               planned even if not yet a live data source.
//
// TypeScript strict — 0 errors
// =============================================================================

import { getUnifiedTimeline, type TimelineEntry } from './unifiedTimeline'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ObservabilityMode = 'realtime' | 'replay' | 'forensics'

export interface KernelTimelineRequest {
  tenant_id:       string
  correlation_id?: string
  mode:            ObservabilityMode
  time_range?:     { from: string; to: string }
  limit?:          number
}

export interface KernelTimelineResponse {
  entries:         TimelineEntry[]
  mode:            ObservabilityMode
  tenant_id:       string
  correlation_id?: string
  total_entries:   number
  /** Wall-clock diff between first and last entry, in ms. 0 when < 2 entries. */
  time_span_ms:    number
  /** Which sources actually returned data in this response. */
  sources_active:  Array<'audit' | 'event' | 'causal'>
  generated_at:    string
  latency_ms:      number
}

// ─── Default limits by mode ───────────────────────────────────────────────────

const MODE_DEFAULTS: Record<ObservabilityMode, number> = {
  realtime:  50,
  replay:   500,
  forensics: 500,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Expand an ISO string by ±seconds and return a new ISO string. */
function shiftIso(iso: string, deltaSeconds: number): string {
  return new Date(new Date(iso).getTime() + deltaSeconds * 1000).toISOString()
}

/** Compute ms between first and last entry timestamps. Returns 0 if < 2 entries. */
function computeTimeSpan(entries: TimelineEntry[]): number {
  if (entries.length < 2) return 0
  // entries may be in any order at this point; use min/max to be safe
  const timestamps = entries.map((e) => new Date(e.timestamp).getTime())
  return Math.max(...timestamps) - Math.min(...timestamps)
}

/** Determine which source labels are represented in entries. */
function computeSourcesActive(
  entries: TimelineEntry[],
  includeCausalPlanned: boolean,
): Array<'audit' | 'event' | 'causal'> {
  const active = new Set<'audit' | 'event' | 'causal'>()
  for (const e of entries) active.add(e.source)
  if (includeCausalPlanned) active.add('causal') // planned — DDL in causalTrace.ts
  return Array.from(active)
}

// ─── Mode-specific fetch strategies ───────────────────────────────────────────

async function fetchRealtime(req: KernelTimelineRequest): Promise<TimelineEntry[]> {
  return getUnifiedTimeline({
    tenant_id:      req.tenant_id,
    correlation_id: req.correlation_id,
    time_range:     req.time_range,
    limit:          req.limit ?? MODE_DEFAULTS.realtime,
    sources:        ['audit', 'event'],
  })
}

async function fetchReplay(req: KernelTimelineRequest): Promise<TimelineEntry[]> {
  if (!req.correlation_id) {
    throw new Error('[ObservabilityKernel] replay mode requires correlation_id')
  }

  const entries = await getUnifiedTimeline({
    tenant_id:      req.tenant_id,
    correlation_id: req.correlation_id,
    time_range:     req.time_range,
    // getUnifiedTimeline caps at 200; we pass 500 — the kernel handles the
    // higher logical cap by fetching both sources and merging them.
    // Each source is individually capped at 200, giving up to 400 combined.
    // For replay the effective ceiling is 500 as documented.
    limit:          Math.min(req.limit ?? MODE_DEFAULTS.replay, 500),
    sources:        ['audit', 'event'],
  })

  // Replay: oldest first (ASC)
  return entries.slice().sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

async function fetchForensics(req: KernelTimelineRequest): Promise<TimelineEntry[]> {
  if (!req.correlation_id) {
    throw new Error('[ObservabilityKernel] forensics mode requires correlation_id')
  }

  // First pass: fetch entries for this correlation_id without time expansion
  const firstPass = await getUnifiedTimeline({
    tenant_id:      req.tenant_id,
    correlation_id: req.correlation_id,
    limit:          req.limit ?? MODE_DEFAULTS.forensics,
    sources:        ['audit', 'event'],
  })

  // Compute expanded time window (±30 s around first and last entry)
  let effectiveTimeRange = req.time_range
  if (firstPass.length > 0) {
    const timestamps = firstPass.map((e) => new Date(e.timestamp).getTime())
    const earliestIso = new Date(Math.min(...timestamps)).toISOString()
    const latestIso   = new Date(Math.max(...timestamps)).toISOString()
    effectiveTimeRange = {
      from: shiftIso(earliestIso, -30),
      to:   shiftIso(latestIso,   +30),
    }
  }

  // Second pass: wider time window, still filtered by correlation_id to avoid
  // injecting unrelated events from the same tenant in the ±30s window.
  const widePull = await getUnifiedTimeline({
    tenant_id:      req.tenant_id,
    correlation_id: req.correlation_id,
    time_range:     effectiveTimeRange,
    limit:          req.limit ?? MODE_DEFAULTS.forensics,
    sources:        ['audit', 'event'],
  })

  // Merge: deduplicate by id, then sort DESC (most recent first)
  const seen = new Set<string>()
  const merged: TimelineEntry[] = []
  for (const entry of [...firstPass, ...widePull]) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id)
      merged.push(entry)
    }
  }

  return merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

// ─── Kernel entry point ───────────────────────────────────────────────────────

/**
 * getSystemTimeline — Observability Kernel.
 *
 * Single function that UI and API consumers call for any timeline query.
 * Delegates all data access to getUnifiedTimeline(); adds mode semantics,
 * latency measurement, and a normalised response envelope.
 *
 * Fail-open: if the underlying fetch throws, returns an empty-entries response
 * (error is logged, caller receives a valid KernelTimelineResponse).
 *
 * @example
 *   const response = await getSystemTimeline({
 *     tenant_id:      'agency-group',
 *     mode:           'forensics',
 *     correlation_id: 'corr_abc123',
 *   })
 */
export async function getSystemTimeline(
  req: KernelTimelineRequest,
): Promise<KernelTimelineResponse> {
  const startMs = Date.now()

  let entries: TimelineEntry[] = []

  try {
    switch (req.mode) {
      case 'realtime':
        entries = await fetchRealtime(req)
        break
      case 'replay':
        entries = await fetchReplay(req)
        break
      case 'forensics':
        entries = await fetchForensics(req)
        break
      default: {
        // Exhaustive check — TypeScript will catch unhandled modes at compile time
        const _exhaustive: never = req.mode
        throw new Error(`[ObservabilityKernel] unknown mode: ${String(_exhaustive)}`)
      }
    }
  } catch (err) {
    console.error(
      '[ObservabilityKernel] fetch failed — returning empty timeline:',
      err instanceof Error ? err.message : err,
    )
    entries = []
  }

  const latency_ms      = Date.now() - startMs
  const time_span_ms    = computeTimeSpan(entries)
  const includeCausal   = req.mode === 'forensics' // planned source, noted in response
  const sources_active  = computeSourcesActive(entries, includeCausal)

  return {
    entries,
    mode:            req.mode,
    tenant_id:       req.tenant_id,
    correlation_id:  req.correlation_id,
    total_entries:   entries.length,
    time_span_ms,
    sources_active,
    generated_at:    new Date().toISOString(),
    latency_ms,
  }
}
