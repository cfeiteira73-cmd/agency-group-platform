// =============================================================================
// AGENCY GROUP — AI Agent Framework Types v1.0
// Observable, rate-limited, dry-run capable, governance-aware agents
// AMI: 22506 | SH-ROS Agent Layer
// =============================================================================

export type AgentId =
  | 'revenue-leak'
  | 'buyer-qualification'
  | 'seller-retention'
  | 'follow-up'
  | 'listing-intelligence'
  | 'risk-detection'
  | 'compliance'
  | 'referral-expansion'
  | 'negotiation-insight'
  | 'pipeline-stall'

export type AgentStatus = 'idle' | 'running' | 'success' | 'failed' | 'dry_run_complete'

export interface AgentConfig {
  /** Maximum executions per hour */
  rate_limit_per_hour: number
  /** Maximum retry attempts on failure */
  max_retries: number
  /** Timeout in milliseconds */
  timeout_ms: number
  /** Whether to require human approval before destructive actions */
  require_human_approval: boolean
  /** Whether this agent can auto-send communications */
  can_send_comms: boolean
}

export interface AgentContext {
  /** Correlation ID for this execution */
  correlation_id: string
  /** Agent calling context */
  triggered_by: 'cron' | 'api' | 'agent' | 'manual'
  /** ISO timestamp */
  triggered_at: string
  /** Optional entity scope */
  entity_type?: string
  entity_id?: string
  /** Dry run — analyse only, no side effects */
  dry_run: boolean
  /** Agent email for audit trail */
  agent_email?: string | null
}

export interface AgentAction {
  /** Action type */
  type: 'send_notification' | 'update_record' | 'trigger_workflow' | 'escalate_human' | 'create_task' | 'log_insight'
  /** Human-readable description */
  description: string
  /** Entity this action targets */
  entity_type: string
  entity_id: string | null
  /** Structured payload */
  payload: Record<string, unknown>
  /** Risk level */
  risk: 'low' | 'medium' | 'high'
  /** Requires explicit human approval */
  requires_approval: boolean
}

export interface AgentResult {
  agent_id: AgentId
  status: AgentStatus
  correlation_id: string
  started_at: string
  completed_at: string
  duration_ms: number
  dry_run: boolean
  /** Key findings */
  insights: AgentInsight[]
  /** Actions taken (or would-take in dry_run) */
  actions: AgentAction[]
  /** Actions blocked pending human approval */
  pending_approval: AgentAction[]
  /** Error if failed */
  error: string | null
  /** Structured metadata */
  metadata: Record<string, unknown>
}

export interface AgentInsight {
  /** Insight type */
  type: string
  /** Human-readable summary */
  summary: string
  /** Severity */
  severity: 'info' | 'warning' | 'critical'
  /** Confidence score 0–1 */
  confidence: number
  /** Revenue impact estimate in EUR */
  revenue_impact_eur: number | null
  /** Entity this insight is about */
  entity_type: string
  entity_id: string | null
  /** Supporting data */
  evidence: Record<string, unknown>
}

export interface AgentRegistration {
  id: AgentId
  name: string
  description: string
  config: AgentConfig
  tags: string[]
}
