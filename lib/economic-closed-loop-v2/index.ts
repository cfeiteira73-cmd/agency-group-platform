// AGENCY GROUP — SH-ROS | AMI: 22506
// Economic Closed Loop v2 — Real-time funnel journey tracking as a live event graph
// Tracks every economic event from first listing view to commission collected.
// Pure TypeScript — no DB writes, no external dependencies. Caller handles persistence.
// =============================================================================

import { randomUUID } from 'crypto'

// ─── Funnel Stage ─────────────────────────────────────────────────────────────

export type FunnelStage =
  | 'listing_view'
  | 'intent_signal'
  | 'inquiry'
  | 'agent_contact'
  | 'visit_scheduled'
  | 'visit_completed'
  | 'offer_created'
  | 'negotiation'
  | 'deal_closure'
  | 'commission_collected'

// ─── Stage Weights (Portugal 2026, 5% commission model) ──────────────────────

const STAGE_WEIGHTS: Record<FunnelStage, number> = {
  listing_view: 0.002,
  intent_signal: 0.02,
  inquiry: 0.08,
  agent_contact: 0.18,
  visit_scheduled: 0.28,
  visit_completed: 0.42,
  offer_created: 0.62,
  negotiation: 0.78,
  deal_closure: 0.95,
  commission_collected: 1.0,
}

// Ordered stage list for velocity / health computations
const STAGE_ORDER: FunnelStage[] = [
  'listing_view',
  'intent_signal',
  'inquiry',
  'agent_contact',
  'visit_scheduled',
  'visit_completed',
  'offer_created',
  'negotiation',
  'deal_closure',
  'commission_collected',
]

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface EconomicEvent {
  event_id: string
  session_id: string
  property_id: string
  stage: FunnelStage
  timestamp: Date
  /** Direct or probabilistic economic value in EUR */
  economic_value_eur: number
  /** Stage-based probability to close (0–1) */
  probability_to_close: number
  agent_id?: string
  metadata: Record<string, unknown>
}

export interface EconomicEventGraph {
  property_id: string
  events: EconomicEvent[]
  current_stage: FunnelStage
  /** Sum of probabilistic values across all events */
  total_economic_value_eur: number
  /** Days spent in the current stage */
  time_in_stage_days: number
  /** Events per day across the full journey */
  stage_transition_velocity: number
  /** Commission estimate at 5% of expected close value */
  estimated_commission_eur: number
  funnel_health: 'accelerating' | 'on_track' | 'stalling' | 'at_risk'
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new EconomicEvent with a generated UUID.
 * economic_value_eur and probability_to_close are derived from stage weights
 * and the provided property_value_eur (optional — pass 0 if unknown at event time).
 */
export function createEconomicEvent(params: {
  session_id: string
  property_id: string
  stage: FunnelStage
  property_value_eur?: number
  agent_id?: string
  timestamp?: Date
  metadata?: Record<string, unknown>
}): EconomicEvent {
  const probability_to_close = STAGE_WEIGHTS[params.stage]
  const property_value = params.property_value_eur ?? 0
  const commission_rate = 0.05

  return {
    event_id: randomUUID(),
    session_id: params.session_id,
    property_id: params.property_id,
    stage: params.stage,
    timestamp: params.timestamp ?? new Date(),
    economic_value_eur: property_value * commission_rate * probability_to_close,
    probability_to_close,
    agent_id: params.agent_id,
    metadata: params.metadata ?? {},
  }
}

// ─── Stage Weight Accessor ────────────────────────────────────────────────────

/** Returns the probability-to-close weight for a given funnel stage. */
export function getStageWeight(stage: FunnelStage): number {
  return STAGE_WEIGHTS[stage]
}

// ─── Funnel Health Detection ──────────────────────────────────────────────────

/**
 * Classify funnel health from a built graph.
 *
 * Rules:
 * - accelerating : velocity > 0.5 events/day
 * - at_risk      : stalling > 14 days in the same stage
 * - stalling     : velocity < 0.1 events/day
 * - on_track     : everything else
 */
export function detectFunnelHealth(
  graph: EconomicEventGraph,
): EconomicEventGraph['funnel_health'] {
  if (graph.stage_transition_velocity > 0.5) return 'accelerating'
  if (graph.time_in_stage_days > 14) return 'at_risk'
  if (graph.stage_transition_velocity < 0.1) return 'stalling'
  return 'on_track'
}

// ─── Graph Builder ────────────────────────────────────────────────────────────

/**
 * Build an EconomicEventGraph from a flat array of events for a property.
 * Events may arrive out of order — they are sorted by timestamp internally.
 */
export function buildEventGraph(
  events: EconomicEvent[],
  property_value_eur: number,
): EconomicEventGraph {
  if (events.length === 0) {
    const emptyGraph: EconomicEventGraph = {
      property_id: '',
      events: [],
      current_stage: 'listing_view',
      total_economic_value_eur: 0,
      time_in_stage_days: 0,
      stage_transition_velocity: 0,
      estimated_commission_eur: 0,
      funnel_health: 'on_track',
    }
    return emptyGraph
  }

  // Sort ascending by timestamp
  const sorted = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  )

  const property_id = sorted[0].property_id

  // Current stage = highest-weight stage seen across events
  const current_stage = sorted.reduce<FunnelStage>((best, ev) => {
    return STAGE_WEIGHTS[ev.stage] > STAGE_WEIGHTS[best] ? ev.stage : best
  }, sorted[0].stage)

  // Time in current stage: from last event in that stage to now
  const eventsInCurrentStage = sorted.filter((e) => e.stage === current_stage)
  const lastCurrentStageEvent = eventsInCurrentStage[eventsInCurrentStage.length - 1]
  const now = new Date()
  const time_in_stage_days =
    (now.getTime() - lastCurrentStageEvent.timestamp.getTime()) / 86_400_000

  // Velocity: unique stage transitions / total elapsed days
  const uniqueStagesVisited = new Set(sorted.map((e) => e.stage)).size
  const firstEvent = sorted[0]
  const lastEvent = sorted[sorted.length - 1]
  const totalElapsedDays =
    Math.max(
      1,
      (lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime()) / 86_400_000,
    )
  const stage_transition_velocity = uniqueStagesVisited / totalElapsedDays

  // Commission estimate at 5% on the highest-probability close value seen
  const close_probability = STAGE_WEIGHTS[current_stage]
  const estimated_commission_eur = property_value_eur * 0.05 * close_probability

  // Total probabilistic economic value = sum of all event values
  const total_economic_value_eur = sorted.reduce(
    (sum, ev) => sum + ev.economic_value_eur,
    0,
  )

  const partialGraph: EconomicEventGraph = {
    property_id,
    events: sorted,
    current_stage,
    total_economic_value_eur,
    time_in_stage_days,
    stage_transition_velocity,
    estimated_commission_eur,
    funnel_health: 'on_track', // placeholder — overwritten below
  }

  return {
    ...partialGraph,
    funnel_health: detectFunnelHealth(partialGraph),
  }
}

// ─── Stage Advance ────────────────────────────────────────────────────────────

/**
 * Add a new event to an existing graph and return the updated graph.
 * Re-computes all derived fields from the full event list.
 */
export function advanceStage(
  graph: EconomicEventGraph,
  newEvent: EconomicEvent,
): EconomicEventGraph {
  // Validate the event belongs to this property
  if (
    graph.events.length > 0 &&
    newEvent.property_id !== graph.property_id
  ) {
    throw new Error(
      `Event property_id "${newEvent.property_id}" does not match graph property_id "${graph.property_id}"`,
    )
  }

  const updatedEvents = [...graph.events, newEvent]

  // We need property_value_eur to rebuild — back-derive from estimated_commission_eur / close_probability / 0.05
  const current_prob = STAGE_WEIGHTS[graph.current_stage]
  const implied_property_value =
    current_prob > 0
      ? graph.estimated_commission_eur / (0.05 * current_prob)
      : 0

  return buildEventGraph(updatedEvents, implied_property_value)
}

// ─── Class API ────────────────────────────────────────────────────────────────

export class EconomicClosedLoopV2 {
  /**
   * Process a single event, merging it into an optional existing graph.
   * Returns a freshly computed EconomicEventGraph.
   *
   * @param event             - The new EconomicEvent to integrate
   * @param property_value_eur - Market value of the property in EUR
   * @param existingGraph      - Pass the previously returned graph for incremental updates
   */
  processEvent(
    event: EconomicEvent,
    property_value_eur: number,
    existingGraph?: EconomicEventGraph,
  ): EconomicEventGraph {
    const existingEvents = existingGraph?.events ?? []

    // Avoid duplicate event_ids
    const isDuplicate = existingEvents.some((e) => e.event_id === event.event_id)
    if (isDuplicate) {
      if (!existingGraph) {
        return buildEventGraph([], property_value_eur)
      }
      return existingGraph
    }

    const allEvents = [...existingEvents, event]
    return buildEventGraph(allEvents, property_value_eur)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const economicClosedLoopV2 = new EconomicClosedLoopV2()

// ─── Re-export stage order for consumers ─────────────────────────────────────

export { STAGE_ORDER, STAGE_WEIGHTS }
