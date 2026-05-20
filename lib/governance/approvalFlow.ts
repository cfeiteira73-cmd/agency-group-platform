// =============================================================================
// Agency Group — Human-in-the-loop Approval Flow
// lib/governance/approvalFlow.ts
//
// Manages explicit human authorization for critical / high-risk actions before
// they are executed by the SH-ROS automation layer.
//
// Critical actions that require approval:
//   - AI model changes           → risk_level: 'critical'
//   - Tenant plan downgrades     → risk_level: 'critical'
//   - System-wide policy overrides → risk_level: 'critical'
//   - Data exports > 10 K rows   → risk_level: 'high'
//
// DDL (run once in Supabase):
// -- CREATE TABLE governance_approvals (
// --   approval_id   text        primary key,
// --   tenant_id     text        not null,
// --   actor_id      text        not null,
// --   action_type   text        not null,
// --   resource_type text        not null,
// --   resource_id   text,
// --   risk_level    text        not null,
// --   description   text        not null,
// --   context       jsonb       not null default '{}',
// --   status        text        not null default 'pending',
// --   requested_at  timestamptz not null default now(),
// --   expires_at    timestamptz not null,
// --   reviewed_by   text,
// --   reviewed_at   timestamptz,
// --   review_note   text
// -- );
// -- CREATE INDEX idx_governance_approvals_tenant_status
// --   ON governance_approvals(tenant_id, status, requested_at DESC);
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit/auditLogger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type ApprovalRisk   = 'critical' | 'high'

export interface ApprovalRequest {
  approval_id:  string
  tenant_id:    string
  actor_id:     string           // who requested the action
  action_type:  string           // what action requires approval
  resource_type: string
  resource_id:  string | null
  risk_level:   ApprovalRisk
  description:  string
  context:      Record<string, unknown>
  status:       ApprovalStatus
  requested_at: string
  expires_at:   string           // 24 h TTL
  reviewed_by:  string | null
  reviewed_at:  string | null
  review_note:  string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Typed accessor that bypasses the generated Database types so we can use
 * the `governance_approvals` table which may not be present in database.types.ts.
 * The cast is isolated here — nowhere else in this module uses `any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const approvalsTable = () => (supabaseAdmin as any).from('governance_approvals')

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new approval request and persists it to `governance_approvals`.
 *
 * Fail-open: if the DB insert fails a warning is logged and the generated
 * approval_id is still returned so the caller can surface a reference ID to
 * the operator.
 *
 * @returns approval_id  e.g. "appr_550e8400-..."
 */
export async function requestApproval(
  req: Omit<
    ApprovalRequest,
    'approval_id' | 'status' | 'requested_at' | 'expires_at' | 'reviewed_by' | 'reviewed_at' | 'review_note'
  >
): Promise<string> {
  const approval_id  = `appr_${randomUUID()}`
  const now          = new Date()
  const expires_at   = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const requested_at = now.toISOString()

  const record: ApprovalRequest = {
    ...req,
    approval_id,
    status:      'pending',
    requested_at,
    expires_at:  expires_at.toISOString(),
    reviewed_by:  null,
    reviewed_at:  null,
    review_note:  null,
  }

  try {
    const { error } = await approvalsTable().insert(record)
    if (error) {
      console.warn('[ApprovalFlow] DB insert failed — fail-open:', error.message)
    }
  } catch (err) {
    console.warn('[ApprovalFlow] requestApproval threw — fail-open:', err)
  }

  logAudit({
    tenant_id:     req.tenant_id,
    actor_id:      req.actor_id,
    actor_type:    'system',
    action:        'system:create',
    resource_type: req.resource_type,
    resource_id:   req.resource_id ?? undefined,
    result:        'success',
    risk_level:    req.risk_level,
    metadata:      { approval_id, action_type: req.action_type, description: req.description },
  })

  return approval_id
}

/**
 * Returns the current status of an approval request.
 *
 * Returns `'expired'` when:
 *   - The record is not found, or
 *   - `expires_at` is in the past.
 *
 * Fail-open: returns `'pending'` on any unexpected error so callers don't
 * accidentally block execution on a transient DB outage.
 */
export async function checkApproval(approvalId: string): Promise<ApprovalStatus> {
  try {
    const { data, error } = await approvalsTable()
      .select('status, expires_at')
      .eq('approval_id', approvalId)
      .maybeSingle()

    if (error || !data) return 'expired'

    const row = data as { status: ApprovalStatus; expires_at: string }

    // Treat as expired if past TTL regardless of stored status
    if (new Date(row.expires_at) < new Date()) return 'expired'

    return row.status
  } catch {
    return 'pending'
  }
}

/**
 * Returns all non-expired pending approvals for a tenant, newest first.
 *
 * Fail-open: returns `[]` on any error.
 *
 * @param tenantId  Tenant identifier (e.g. 'agency-group')
 * @param limit     Maximum rows to return (default 50)
 */
export async function listPendingApprovals(
  tenantId: string,
  limit = 50
): Promise<ApprovalRequest[]> {
  try {
    const now = new Date().toISOString()

    const { data, error } = await approvalsTable()
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gt('expires_at', now)                          // exclude expired
      .order('requested_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data as ApprovalRequest[]
  } catch {
    return []
  }
}

/**
 * Approval gate — executes `fn` only when the request is approved.
 *
 * | Status      | Behaviour                          |
 * |-------------|-------------------------------------|
 * | `approved`  | Executes `fn()`, returns result    |
 * | `pending`   | Returns without executing          |
 * | `rejected`  | Returns without executing          |
 * | `expired`   | Returns without executing          |
 *
 * Never throws — all errors are fail-open (returns current status).
 */
export async function withApprovalGate<T>(
  approvalId: string,
  fn: () => Promise<T>
): Promise<{ result?: T; status: ApprovalStatus }> {
  let status: ApprovalStatus

  try {
    status = await checkApproval(approvalId)
  } catch {
    status = 'pending'
  }

  if (status !== 'approved') {
    return { status }
  }

  try {
    const result = await fn()
    return { result, status: 'approved' }
  } catch (err) {
    console.warn('[ApprovalFlow] withApprovalGate fn() threw — fail-open:', err)
    return { status: 'approved' }
  }
}
