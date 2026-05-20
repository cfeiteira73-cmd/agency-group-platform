// =============================================================================
// Agency Group — SOC2 Audit Types
// lib/audit/auditTypes.ts
// TypeScript strict — 0 errors
// =============================================================================

// ─── Action taxonomy ─────────────────────────────────────────────────────────

export type AuditDomain =
  | 'auth'           // login, logout, token issuance
  | 'tenant'         // tenant create/update/suspend
  | 'contact'        // CRM contact CRUD
  | 'deal'           // deal create/update/close
  | 'property'       // property publish/archive
  | 'ai'             // AI agent execution, policy decisions
  | 'billing'        // quota, plan changes, billing events
  | 'security'       // RBAC changes, secret access, anomaly
  | 'vault'          // vault reads/writes, integrity checks
  | 'system'         // cron runs, health checks, config changes
  | 'automation'     // n8n webhook, workflow trigger
  | 'data'           // bulk operations, imports, exports

export type AuditVerb =
  | 'create' | 'read' | 'update' | 'delete'
  | 'execute' | 'deny' | 'escalate' | 'approve'
  | 'login' | 'logout' | 'refresh'
  | 'trigger' | 'complete' | 'fail'
  | 'suspend' | 'activate' | 'cancel'

// Full action string = domain:verb (e.g., 'deal:create', 'ai:deny')
export type AuditAction = `${AuditDomain}:${AuditVerb}`

export type AuditActorType = 'user' | 'ai_agent' | 'system' | 'cron' | 'webhook'
export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AuditResult    = 'success' | 'denied' | 'error' | 'timeout'

// ─── Core record ─────────────────────────────────────────────────────────────

export interface AuditRecord {
  id?:             string    // assigned by DB
  tenant_id:       string
  actor_id?:       string    // user_id, agent_id, or 'system'
  actor_type:      AuditActorType
  actor_email?:    string
  action:          AuditAction
  resource_type?:  string    // 'deal', 'contact', 'property', etc.
  resource_id?:    string
  result:          AuditResult
  risk_level:      AuditRiskLevel
  correlation_id?: string
  ip_address?:     string
  user_agent?:     string
  metadata?:       Record<string, unknown>
  created_at?:     string
}

// ─── Input type (no id or created_at — assigned by DB) ──────────────────────

export type AuditInput = Omit<AuditRecord, 'id' | 'created_at'>

// ─── Query filters ────────────────────────────────────────────────────────────

export interface AuditQueryFilter {
  tenant_id:    string
  actor_id?:    string
  action?:      AuditAction | string
  resource_type?: string
  resource_id?: string
  result?:      AuditResult
  risk_level?:  AuditRiskLevel
  from_date?:   string    // ISO-8601
  to_date?:     string
  limit?:       number    // default 50
  offset?:      number    // default 0
}
