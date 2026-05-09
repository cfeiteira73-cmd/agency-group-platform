// =============================================================================
// AGENCY GROUP — AI Agent Framework Types v2.0
// SH-ROS Runtime Core — Observable, multi-tenant, event-driven agents
// AMI: 22506 | SH-ROS Agent Layer
// =============================================================================

// ─── Agent identity ───────────────────────────────────────────────────────────

export type AgentId =
  // Revenue Intelligence Layer
  | 'revenue-leak'
  | 'conversion-optimization'
  | 'pricing-strategy'
  // Sales Execution Layer
  | 'follow-up'
  | 'pipeline-stall'
  | 'deal-closing'
  // System Automation Layer
  | 'workflow-automation'
  | 'system-health'
  | 'data-integrity'
  // Strategy & Analytics Layer
  | 'kpi-intelligence'
  | 'growth-strategy'
  // Legacy / Domain-specific
  | 'buyer-qualification'
  | 'seller-retention'
  | 'listing-intelligence'
  | 'risk-detection'
  | 'compliance'
  | 'referral-expansion'
  | 'negotiation-insight'

export type AgentStatus = 'idle' | 'running' | 'success' | 'failed' | 'dry_run_complete'

// ─── Agent layer classification ───────────────────────────────────────────────

export type AgentLayer =
  | 'revenue_intelligence'
  | 'sales_execution'
  | 'system_automation'
  | 'strategy_analytics'

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AgentConfig {
  /** Maximum executions per hour */
  rate_limit_per_hour: number
  /** Maximum retry attempts on failure */
  max_retries: number
  /** Timeout in milliseconds — max 2000ms per spec */
  timeout_ms: number
  /** Whether to require human approval before destructive actions */
  require_human_approval: boolean
  /** Whether this agent can auto-send communications */
  can_send_comms: boolean
  /** Agent classification layer */
  layer?: AgentLayer
}

// ─── Execution context ────────────────────────────────────────────────────────

export interface AgentContext {
  /** Tenant isolation — MANDATORY for all agent executions */
  org_id: string
  /** Correlation ID for this execution — chains to triggering event */
  correlation_id: string
  /** Triggering event ID for idempotency */
  event_id?: string
  /** Event type that triggered this agent */
  trigger_event?: string
  /** Agent calling context */
  triggered_by: 'cron' | 'api' | 'agent' | 'manual' | 'event'
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

// ─── Actions ──────────────────────────────────────────────────────────────────

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

// ─── Insights ─────────────────────────────────────────────────────────────────

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

// ─── Internal result (rich) ───────────────────────────────────────────────────

export interface AgentResult {
  agent_id: AgentId
  org_id: string
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
  /** Standardised output contract (derived from insights) */
  output: AgentOutputContract
}

// ─── OUTPUT CONTRACT (per spec §5) ───────────────────────────────────────────
// Mandatory shape returned by every agent execution

export interface AgentOutputContract {
  agent: string
  org_id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  /** Estimated EUR revenue impact */
  financial_impact: number
  /** Top-level insight summary */
  insight: string
  /** Ordered action recommendations */
  actions: string[]
  /** Overall confidence 0–1 */
  confidence: number
  /** Risk score 0–1 */
  risk_score: number
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface AgentRegistration {
  id: AgentId
  name: string
  description: string
  config: AgentConfig
  tags: string[]
}
