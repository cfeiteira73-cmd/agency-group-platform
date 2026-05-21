// =============================================================================
// AGENCY GROUP — Typed Event Contracts v1.0
// Replay-safe, idempotent, correlation-ID-bearing event payloads
// All events extend BaseEvent. Consumers MUST be idempotent.
// AMI: 22506 | SH-ROS Event Bus
// =============================================================================

export interface BaseEvent {
  /** Globally unique event ID (UUID v4) */
  event_id: string
  /** Event type discriminator */
  event_type: EventType
  /** ISO timestamp of when the event occurred */
  occurred_at: string
  /** Request correlation ID for distributed tracing */
  correlation_id: string | null
  /** Tenant identifier for multi-tenant event isolation */
  tenant_id: string
  /** Source system that emitted the event */
  source_system: 'api' | 'n8n' | 'cron' | 'engine' | 'agent'
  /** Schema version for replay compatibility */
  schema_version: '1.0'
  /** Optional idempotency key — same key = same effect */
  idempotency_key?: string
  /** Kafka-style partition key: '{tenant_id}:{event_type}' for ordered processing */
  partition_key?: string
  /** Global monotonic sequence number — assigned by DB BIGSERIAL after persist */
  global_seq?: number
  /** SHA-256(event_id + tenant_id) — used for idempotent replay dedup */
  replay_token?: string
  /** Originating region: 'eu-west' | 'eu-north' | 'us-east' | 'ap-southeast' */
  region?: string
  /**
   * Lamport logical clock — monotonically increasing per tenant, region-independent.
   * Enables causal ordering without global wall-clock coordination.
   * Assigned by enrichEvent() via Redis INCR on 'lamport:{tenant_id}'.
   */
  logical_timestamp?: number
}

export type EventType =
  | 'lead_created'
  | 'deal_created'
  | 'deal_stage_advanced'
  | 'match_created'
  | 'distribution_sent'
  | 'distribution_accepted'
  | 'distribution_rejected'
  | 'model_promoted'
  | 'rollback_triggered'
  | 'governance_override'
  | 'leakage_detected'
  | 'client_milestone_reached'
  | 'referral_created'
  | 'anomaly_detected'
  | 'proposal_sent'
  | 'cpcv_signed'
  | 'deal_closed'
  | 'deal_rejected'
  | 'call_booked'
  | 'lead_scored'
  // Wave 19 — Compass-level event backbone (9 new event types)
  | 'property_ingested'
  | 'property_scored'
  | 'lead_qualified'
  | 'deal_updated'
  | 'revenue_recognized'
  | 'ai_requested'
  | 'ai_executed'
  | 'ai_billed'
  | 'system_failure'
  | 'system_recovery'
  // Wave 22 — European Intelligence Infrastructure
  | 'commission_calculated'
  | 'investor_created'
  | 'property_normalized'
  | 'property_enriched'
  | 'market_snapshot_generated'
  | 'deal_lineage_traced'

// ─── Typed payloads ───────────────────────────────────────────────────────────

export interface LeadCreatedEvent extends BaseEvent {
  event_type: 'lead_created'
  payload: {
    lead_id: string
    nome: string
    source: string | null
    assigned_to: string | null
    score: number | null
    cidade: string | null
  }
}

export interface DealCreatedEvent extends BaseEvent {
  event_type: 'deal_created'
  payload: {
    deal_id: string | null
    agent_email: string | null
    fase: string | null
    ref: string | null
    imovel: string | null
    valor: number | null
  }
}

export interface DealStageAdvancedEvent extends BaseEvent {
  event_type: 'deal_stage_advanced'
  payload: {
    deal_id: string
    from_stage: string | null
    to_stage: string
    agent_email: string | null
    deal_value: number | null
  }
}

export interface MatchCreatedEvent extends BaseEvent {
  event_type: 'match_created'
  payload: {
    lead_id: string
    match_score: number
    matched_buyers_count: number
    deal_priority_score: number | null
    attack_recommendation: string | null
  }
}

export interface DistributionSentEvent extends BaseEvent {
  event_type: 'distribution_sent'
  payload: {
    property_id: string
    distribution_tier: string | null
    recipient_count: number
    opportunity_grade: string | null
    opportunity_score: number | null
  }
}

export interface DistributionAcceptedEvent extends BaseEvent {
  event_type: 'distribution_accepted'
  payload: {
    distribution_event_id: string
    property_id: string
    recipient_email: string
    recipient_type: string
    response_time_hours: number | null
  }
}

export interface DistributionRejectedEvent extends BaseEvent {
  event_type: 'distribution_rejected'
  payload: {
    distribution_event_id: string
    property_id: string
    recipient_email: string | null
    rejection_category: string
    rejection_reason: string | null
  }
}

export interface ModelPromotedEvent extends BaseEvent {
  event_type: 'model_promoted'
  payload: {
    model_name: string
    old_version: string | null
    new_version: string
    accuracy_before: number | null
    accuracy_after: number | null
    promoted_by: string | null
  }
}

export interface RollbackTriggeredEvent extends BaseEvent {
  event_type: 'rollback_triggered'
  payload: {
    model_name: string
    from_version: string
    to_version: string
    reason: string
    accuracy_drop_pct: number | null
  }
}

export interface GovernanceOverrideEvent extends BaseEvent {
  event_type: 'governance_override'
  payload: {
    override_id: string
    user_email: string
    user_role: string
    action_type: string
    resource_id: string | null
    reason: string
  }
}

export interface LeakageDetectedEvent extends BaseEvent {
  event_type: 'leakage_detected'
  payload: {
    lead_id: string | null
    deal_id: string | null
    leakage_type: string
    revenue_at_risk: number | null
    severity: 'P0' | 'P1' | 'P2' | 'P3'
  }
}

export interface ClientMilestoneReachedEvent extends BaseEvent {
  event_type: 'client_milestone_reached'
  payload: {
    milestone_type: string
    deal_id: string | null
    contact_id: string | null
    title: string
  }
}

export interface ReferralCreatedEvent extends BaseEvent {
  event_type: 'referral_created'
  payload: {
    referrer_email: string | null
    referred_email: string | null
    source: string
    deal_id: string | null
  }
}

export interface AnomalyDetectedEvent extends BaseEvent {
  event_type: 'anomaly_detected'
  payload: {
    anomaly_type: string
    entity_type: string
    entity_id: string | null
    severity: 'P0' | 'P1' | 'P2' | 'P3'
    description: string
    metric_value: number | null
  }
}

export interface ProposalSentEvent extends BaseEvent {
  event_type: 'proposal_sent'
  payload: {
    deal_id: string | null
    agent_email: string | null
    deal_ref: string | null
    fase: string | null
  }
}

export interface CpcvSignedEvent extends BaseEvent {
  event_type: 'cpcv_signed'
  payload: {
    deal_id: string | null
    agent_email: string | null
    deal_ref: string | null
    deal_value: number | null
  }
}

export interface DealClosedEvent extends BaseEvent {
  event_type: 'deal_closed'
  payload: {
    deal_id: string | null
    agent_email: string | null
    deal_ref: string | null
    deal_value: number | null
  }
}

export interface DealRejectedEvent extends BaseEvent {
  event_type: 'deal_rejected'
  payload: {
    deal_id: string | null
    agent_email: string | null
    deal_ref: string | null
    reason: string | null
  }
}

export interface CallBookedEvent extends BaseEvent {
  event_type: 'call_booked'
  payload: {
    deal_id: string | null
    agent_email: string | null
    deal_ref: string | null
    fase: string | null
  }
}

export interface LeadScoredEvent extends BaseEvent {
  event_type: 'lead_scored'
  payload: {
    lead_id: string
    score: number
    score_breakdown: Record<string, unknown> | null
    previous_score: number | null
    scored_by: 'engine' | 'agent' | 'manual'
  }
}

// ─── Wave 19 event interfaces ─────────────────────────────────────────────────

export interface PropertyIngestedEvent extends BaseEvent {
  event_type: 'property_ingested'
  payload: {
    property_id: string
    source: string | null
    listing_url: string | null
    price_eur: number | null
    zona: string | null
    type: string | null
  }
}

export interface PropertyScoredEvent extends BaseEvent {
  event_type: 'property_scored'
  payload: {
    property_id: string
    opportunity_score: number
    previous_score: number | null
    score_reason: string | null
    investor_suitable: boolean
  }
}

export interface LeadQualifiedEvent extends BaseEvent {
  event_type: 'lead_qualified'
  payload: {
    lead_id: string
    qualified_by: 'agent' | 'engine' | 'ai'
    score: number | null
    budget_min: number | null
    budget_max: number | null
    zona: string | null
  }
}

export interface DealUpdatedEvent extends BaseEvent {
  event_type: 'deal_updated'
  payload: {
    deal_id: string
    field_changed: string
    old_value: unknown
    new_value: unknown
    updated_by: string | null
  }
}

export interface RevenueRecognizedEvent extends BaseEvent {
  event_type: 'revenue_recognized'
  payload: {
    deal_id: string | null
    amount_eur: number
    commission_eur: number | null  // null = deferred to commissionEngine (authoritative tier-based source)
    agent_email: string | null
    zona: string | null
    recognized_at: string
  }
}

export interface AIRequestedEvent extends BaseEvent {
  event_type: 'ai_requested'
  payload: {
    correlation_id: string
    component: string
    model: string | null
    estimated_tokens: number | null
    revenue_context: string | null
  }
}

export interface AIExecutedEvent extends BaseEvent {
  event_type: 'ai_executed'
  payload: {
    correlation_id: string
    component: string
    model: string
    input_tokens: number
    output_tokens: number
    latency_ms: number
    success: boolean
    fallback_used: boolean
  }
}

export interface AIBilledEvent extends BaseEvent {
  event_type: 'ai_billed'
  payload: {
    correlation_id: string
    component: string
    cost_usd: number
    input_tokens: number
    output_tokens: number
    billing_period: string  // ISO date YYYY-MM
  }
}

export interface SystemFailureEvent extends BaseEvent {
  event_type: 'system_failure'
  payload: {
    failure_type: string
    component: string
    severity: 'P0' | 'P1' | 'P2' | 'P3'
    error_message: string
    error_code: string | null
    auto_recovery_attempted: boolean
  }
}

export interface SystemRecoveryEvent extends BaseEvent {
  event_type: 'system_recovery'
  payload: {
    failure_event_id: string | null
    component: string
    recovery_type: 'auto' | 'manual' | 'circuit_reset'
    recovery_time_ms: number | null
    recovered_at: string
  }
}

export interface CommissionCalculatedEvent extends BaseEvent {
  event_type: 'commission_calculated'
  payload: {
    deal_id: string | null
    commission_id: string
    gross_eur: number
    net_eur: number
    agency_split_eur: number
    agent_split_eur: number
    rate: number
    tier: 'standard' | 'premium' | 'institutional'
    agent_email: string | null
  }
}

export interface InvestorCreatedEvent extends BaseEvent {
  event_type: 'investor_created'
  payload: {
    investor_id: string
    investor_type: string
    capital_min_eur: number | null
    capital_max_eur: number | null
    geography: string[]
    risk_tolerance: string
    tenant_id: string
  }
}

export interface PropertyNormalizedEvent extends BaseEvent {
  event_type: 'property_normalized'
  payload: {
    property_id: string
    provider: string
    price: number
    city: string | null
    area_m2: number | null
    normalized_at: string
  }
}

export interface PropertyEnrichedEvent extends BaseEvent {
  event_type: 'property_enriched'
  payload: {
    property_id: string
    price_per_m2: number | null
    investment_tier: string | null
    geo_tier: string | null
    enriched_at: string
  }
}

export interface MarketSnapshotGeneratedEvent extends BaseEvent {
  event_type: 'market_snapshot_generated'
  payload: {
    snapshot_id: string
    active_properties: number
    total_investors: number
    liquidity_ratio: number
    avg_match_score: number
    snapshot_date: string
    tenant_id: string
  }
}

export interface DealLineageTracedEvent extends BaseEvent {
  event_type: 'deal_lineage_traced'
  payload: {
    deal_id: string
    lead_id: string | null
    property_id: string | null
    investor_id: string | null
    revenue_event_id: string | null
    chain_complete: boolean
  }
}

// ─── Union type ───────────────────────────────────────────────────────────────

export type AnyPlatformEvent =
  | LeadCreatedEvent
  | DealCreatedEvent
  | DealStageAdvancedEvent
  | MatchCreatedEvent
  | DistributionSentEvent
  | DistributionAcceptedEvent
  | DistributionRejectedEvent
  | ModelPromotedEvent
  | RollbackTriggeredEvent
  | GovernanceOverrideEvent
  | LeakageDetectedEvent
  | ClientMilestoneReachedEvent
  | ReferralCreatedEvent
  | AnomalyDetectedEvent
  | ProposalSentEvent
  | CpcvSignedEvent
  | DealClosedEvent
  | DealRejectedEvent
  | CallBookedEvent
  | LeadScoredEvent
  // Wave 19 additions
  | PropertyIngestedEvent
  | PropertyScoredEvent
  | LeadQualifiedEvent
  | DealUpdatedEvent
  | RevenueRecognizedEvent
  | AIRequestedEvent
  | AIExecutedEvent
  | AIBilledEvent
  | SystemFailureEvent
  | SystemRecoveryEvent
  | CommissionCalculatedEvent
  | InvestorCreatedEvent
  | PropertyNormalizedEvent
  | PropertyEnrichedEvent
  | MarketSnapshotGeneratedEvent
  | DealLineageTracedEvent

// ─── Event schema versioning ──────────────────────────────────────────────────

/** Bump when making breaking changes to the event payload shape. */
export const CURRENT_EVENT_SCHEMA_VERSION = 1 as const
export type EventSchemaVersion = 1 | 2

/**
 * Validate that an unknown value is a parseable event at a supported schema
 * version. Returns `valid: false` for anything above CURRENT_EVENT_SCHEMA_VERSION
 * so callers can quarantine or upgrade-migrate before processing.
 *
 * Backward-compatible: events with no `schema_version` field are treated as v1.
 *
 * Usage:
 *   const { valid, version } = ensureEventVersion(rawPayload)
 *   if (!valid) throw new Error(`Unsupported event schema v${version}`)
 */
export function ensureEventVersion(event: unknown): { valid: boolean; version: number } {
  if (!event || typeof event !== 'object') return { valid: false, version: 0 }
  const ev = event as Record<string, unknown>
  const version = typeof ev.schema_version === 'number' ? ev.schema_version : 1
  return { valid: version <= CURRENT_EVENT_SCHEMA_VERSION, version }
}
