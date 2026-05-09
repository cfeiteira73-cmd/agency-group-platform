// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Types vFINAL
// Single source of truth for all runtime type contracts
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

import type { AgentId } from '@/lib/agents/types'

// ─── Core event types ─────────────────────────────────────────────────────────

export type RuntimeEventType =
  | 'LEAD_CREATED'
  | 'LEAD_SCORED'
  | 'PIPELINE_STALLED'
  | 'FOLLOW_UP_OVERDUE'
  | 'REVENUE_RISK_DETECTED'
  | 'DEAL_WON'
  | 'DEAL_LOST'
  | 'SYSTEM_ALERT'
  | 'USER_ACTION'
  | 'DATA_INTEGRITY_FAIL'
  | 'AGENT_COMPLETED'
  | 'WORKFLOW_TRIGGERED'
  | 'KPI_ANOMALY'
  | 'CONVERSION_DROP'

// ─── Unified Event Contract (§3 — vFINAL) ───────────────────────────────────
// IMMUTABLE. Persisted to runtime_events BEFORE execution. Never mutated.

export interface RuntimeEvent {
  /** UUID — global idempotency key */
  event_id: string
  /** Tenant isolation — MANDATORY */
  org_id: string
  /** Event type */
  type: RuntimeEventType
  /** ISO8601 — server-generated at ingestion */
  timestamp: string
  /** Cross-service correlation chain */
  correlation_id: string
  /** Execution priority */
  priority: 'low' | 'medium' | 'high' | 'critical'
  /** Current retry attempt (0 = first attempt) */
  retry_count: number
  /** Typed payload */
  payload: RuntimeEventPayload
  /** Metadata block */
  metadata: {
    schema_version: 'vFINAL'
    trace_id: string
    /** Originating system */
    source_system: 'api' | 'n8n' | 'cron' | 'agent' | 'engine' | 'portal'
  }
}

// ─── Typed payloads ───────────────────────────────────────────────────────────

export type RuntimeEventPayload =
  | LeadCreatedPayload
  | LeadScoredPayload
  | PipelineStalledPayload
  | FollowUpOverduePayload
  | RevenueRiskPayload
  | DealWonPayload
  | DealLostPayload
  | SystemAlertPayload
  | UserActionPayload
  | DataIntegrityFailPayload
  | AgentCompletedPayload
  | GenericPayload

export interface LeadCreatedPayload {
  lead_id: string
  lead_name?: string
  source?: string
  assigned_to?: string
}

export interface LeadScoredPayload {
  lead_id: string
  score: number
  grade: string
  previous_score?: number
}

export interface PipelineStalledPayload {
  deal_id: string
  deal_ref: string
  stage: string
  days_stalled: number
  value_eur?: number
}

export interface FollowUpOverduePayload {
  contact_id: string
  contact_name?: string
  hours_overdue: number
  lead_score?: number
}

export interface RevenueRiskPayload {
  entity_type: 'lead' | 'deal' | 'contact'
  entity_id: string
  risk_type: string
  estimated_loss_eur: number
}

export interface DealWonPayload {
  deal_id: string
  deal_ref: string
  value_eur: number
  agent_email?: string
  stage_reached: string
}

export interface DealLostPayload {
  deal_id: string
  deal_ref: string
  value_eur?: number
  reason?: string
}

export interface SystemAlertPayload {
  severity: 'info' | 'warning' | 'critical'
  message: string
  component: string
  error?: string
}

export interface UserActionPayload {
  user_email: string
  action: string
  entity_type?: string
  entity_id?: string
}

export interface DataIntegrityFailPayload {
  table: string
  issue: string
  affected_rows?: number
}

export interface AgentCompletedPayload {
  agent_id: AgentId
  status: string
  insights_count: number
  actions_count: number
  duration_ms: number
}

export interface GenericPayload {
  [key: string]: unknown
}

// ─── Event → Agent routing matrix ────────────────────────────────────────────

export const EVENT_AGENT_ROUTING: Record<RuntimeEventType, AgentId[]> = {
  LEAD_CREATED:          ['follow-up', 'revenue-leak'],
  LEAD_SCORED:           ['follow-up', 'conversion-optimization', 'lead-qualification'],
  PIPELINE_STALLED:      ['pipeline-stall', 'deal-closing'],
  FOLLOW_UP_OVERDUE:     ['follow-up'],
  REVENUE_RISK_DETECTED: ['revenue-leak', 'pricing-strategy'],
  DEAL_WON:              ['kpi-intelligence'],
  DEAL_LOST:             ['kpi-intelligence', 'conversion-optimization'],
  SYSTEM_ALERT:          ['system-health'],
  USER_ACTION:           ['workflow-automation'],
  DATA_INTEGRITY_FAIL:   ['data-integrity'],
  AGENT_COMPLETED:       ['kpi-intelligence', 'agent-supervisor'],
  WORKFLOW_TRIGGERED:    ['workflow-automation'],
  KPI_ANOMALY:           ['kpi-intelligence', 'growth-strategy', 'risk-governance'],
  CONVERSION_DROP:       ['conversion-optimization', 'revenue-leak', 'forecasting'],
}

// ─── Memory contracts ─────────────────────────────────────────────────────────

/** Entry shape in HOT memory (DB-backed, 1000 events per org) */
export interface ShortTermMemoryEntry {
  event_id: string
  org_id: string
  type: RuntimeEventType
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'
  priority: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  payload_summary: string
  latency_ms: number | null
  economic_score: number | null
}

/** 90-day KPI aggregate (WARM memory) */
export interface LongTermKPI {
  org_id: string
  period: string
  total_leads: number
  qualified_rate: number
  conversion_rate: number
  avg_deal_value_eur: number
  pipeline_value_eur: number
  revenue_eur: number
  computed_at: string
}

// ─── Execution trace (persisted to runtime_events.result) ────────────────────

export interface RuntimeExecutionTrace {
  /** DB event_id */
  event_id: string
  /** Event type */
  event_type: RuntimeEventType
  /** Tenant */
  org_id: string
  /** Chain ID */
  correlation_id: string
  /** OpenTelemetry-compatible trace */
  trace_id: string
  /** All agents routed to this event */
  agents_triggered: AgentId[]
  /** Agents that completed successfully */
  agents_completed: AgentId[]
  /** Agents that failed */
  agents_failed: AgentId[]
  /** Total wall-clock from ingestion to completion */
  total_duration_ms: number
  /** ISO8601 — when orchestrator started */
  started_at: string
  /** ISO8601 — when all agents completed */
  completed_at: string
  /** Ordered list of event_ids this execution spawned */
  event_chain: string[]
  /** Composite economic score from Decision Engine */
  economic_score: number
  /** Error if top-level failure */
  error?: string
}

// ─── Queue retry constants ────────────────────────────────────────────────────

export const BACKOFF_MS = [1_000, 2_000, 5_000] as const
export const MAX_RETRIES = 3
