// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Types v1.0
// Event-driven runtime — all system activity is event-first
// AMI: 22506 | SH-ROS Runtime Core
// =============================================================================

import type { AgentId } from '@/lib/agents/types'

// ─── Core event types (per spec §2.A) ────────────────────────────────────────

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

// ─── Runtime event contract (immutable, tenant-isolated) ─────────────────────

export interface RuntimeEvent {
  /** UUID — idempotency key */
  event_id: string
  /** Tenant isolation — MANDATORY */
  org_id: string
  /** Event type */
  type: RuntimeEventType
  /** ISO8601 */
  timestamp: string
  /** Cross-service correlation chain */
  correlation_id: string
  /** Originating system */
  source_system: 'api' | 'n8n' | 'cron' | 'agent' | 'engine' | 'portal'
  /** Typed payload */
  payload: RuntimeEventPayload
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

// ─── Event → Agent routing matrix (per spec §6) ──────────────────────────────

export const EVENT_AGENT_ROUTING: Record<RuntimeEventType, AgentId[]> = {
  LEAD_CREATED:          ['follow-up', 'revenue-leak'],
  LEAD_SCORED:           ['follow-up', 'conversion-optimization'],
  PIPELINE_STALLED:      ['pipeline-stall', 'deal-closing'],
  FOLLOW_UP_OVERDUE:     ['follow-up'],
  REVENUE_RISK_DETECTED: ['revenue-leak', 'pricing-strategy'],
  DEAL_WON:              ['kpi-intelligence'],
  DEAL_LOST:             ['kpi-intelligence', 'conversion-optimization'],
  SYSTEM_ALERT:          ['system-health'],
  USER_ACTION:           ['workflow-automation'],
  DATA_INTEGRITY_FAIL:   ['data-integrity'],
  AGENT_COMPLETED:       ['kpi-intelligence'],
  WORKFLOW_TRIGGERED:    ['workflow-automation'],
  KPI_ANOMALY:           ['kpi-intelligence', 'growth-strategy'],
  CONVERSION_DROP:       ['conversion-optimization', 'revenue-leak'],
}

// ─── Memory snapshot ──────────────────────────────────────────────────────────

export interface ShortTermMemoryEntry {
  event_id: string
  type: RuntimeEventType
  timestamp: string
  payload_summary: string
}

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

// ─── Runtime execution trace ─────────────────────────────────────────────────

export interface RuntimeExecutionTrace {
  event_id: string
  event_type: RuntimeEventType
  org_id: string
  correlation_id: string
  agents_triggered: AgentId[]
  agents_completed: AgentId[]
  agents_failed: AgentId[]
  total_duration_ms: number
  started_at: string
  completed_at: string
  error?: string
}
