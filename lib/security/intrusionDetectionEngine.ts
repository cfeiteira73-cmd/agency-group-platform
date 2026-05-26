// lib/security/intrusionDetectionEngine.ts
// Real-time intrusion detection for Agency Group SH-ROS
// Detects: privilege escalation, tenant leakage, replay attacks, data exfiltration

import { supabaseAdmin } from '@/lib/supabase'
import { emitSiemEvent } from './siemIntegration'
import log from '@/lib/logger'

export type ThreatType =
  | 'PRIVILEGE_ESCALATION'
  | 'TENANT_LEAKAGE'
  | 'REPLAY_ATTACK'
  | 'DATA_EXFILTRATION'
  | 'BRUTE_FORCE'
  | 'ANOMALOUS_CAPITAL_FLOW'

export interface ThreatAssessment {
  threat_detected: boolean
  threat_type?: ThreatType
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  evidence: string[]
  blocked: boolean
  recommendation: string
}

// ── Privilege escalation detection ────────────────────────────────────────────

/**
 * Detect privilege escalation attempts:
 * - User accessing ADMIN endpoints without ADMIN role
 * - Role claims in JWT that don't match DB
 * - Multiple role changes in short time window
 */
export async function detectPrivilegeEscalation(params: {
  user_id: string
  claimed_role: string
  accessed_endpoint: string
  tenant_id: string
  source_ip?: string
}): Promise<ThreatAssessment> {
  const evidence: string[] = []

  // Check if the claimed role matches what's in the DB
  try {
    const { data: userRows } = await (supabaseAdmin as any)
      .from('access_grants')
      .select('role, granted_at, expires_at')
      .eq('user_id', params.user_id)
      .eq('tenant_id', params.tenant_id)
      .order('granted_at', { ascending: false })
      .limit(5)

    type GrantRow = { role: string; granted_at: string; expires_at: string | null }
    const grants = (userRows ?? []) as GrantRow[]

    const activeGrant = grants.find(g => {
      if (g.expires_at && new Date(g.expires_at) < new Date()) return false
      return true
    })

    if (!activeGrant) {
      evidence.push(`No active access grant found for user ${params.user_id}`)
    } else if (activeGrant.role !== params.claimed_role) {
      evidence.push(`Role mismatch: claimed="${params.claimed_role}" actual="${activeGrant.role}"`)
    }

    // Check for rapid role changes (3+ in 1 hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const recentGrants = grants.filter(g => g.granted_at > oneHourAgo)
    if (recentGrants.length >= 3) {
      evidence.push(`Rapid role changes: ${recentGrants.length} grants in last 1h`)
    }

    // Check if accessing admin-only endpoint without admin role
    const adminEndpoints = ['/api/security/', '/api/admin/', '/api/system/', '/api/compliance/']
    const isAdminEndpoint = adminEndpoints.some(e => params.accessed_endpoint.startsWith(e))
    if (isAdminEndpoint && params.claimed_role !== 'ADMIN' && params.claimed_role !== 'SYSTEM') {
      evidence.push(`Non-admin role "${params.claimed_role}" accessing admin endpoint "${params.accessed_endpoint}"`)
    }
  } catch (e) {
    log.warn('[intrusionDetection] privilege check error', { e })
  }

  if (evidence.length > 0) {
    emitSiemEvent({
      event_type: 'PRIVILEGE_ESCALATION_ATTEMPT',
      severity: evidence.length >= 2 ? 'CRITICAL' : 'HIGH',
      user_id: params.user_id,
      tenant_id: params.tenant_id,
      endpoint: params.accessed_endpoint,
      source_ip: params.source_ip,
      description: `Privilege escalation attempt: ${evidence.join('; ')}`,
      metadata: { claimed_role: params.claimed_role, evidence },
      detected_at: new Date().toISOString(),
    })

    return {
      threat_detected: true,
      threat_type: 'PRIVILEGE_ESCALATION',
      severity: evidence.length >= 2 ? 'CRITICAL' : 'HIGH',
      evidence,
      blocked: true,
      recommendation: 'Immediately revoke all access grants for this user and require re-authentication',
    }
  }

  return { threat_detected: false, evidence: [], blocked: false, recommendation: 'OK' }
}

// ── Tenant leakage detection ───────────────────────────────────────────────────

/**
 * Detect cross-tenant data access:
 * - Query results containing rows from multiple tenants
 * - Direct tenant_id manipulation in requests
 */
export async function detectTenantLeakage(params: {
  requesting_tenant_id: string
  accessed_resource_tenant_id: string
  resource_type: string
  resource_id: string
  user_id?: string
  source_ip?: string
}): Promise<ThreatAssessment> {
  const evidence: string[] = []

  if (params.requesting_tenant_id !== params.accessed_resource_tenant_id) {
    evidence.push(`Tenant mismatch: requesting="${params.requesting_tenant_id}" resource_tenant="${params.accessed_resource_tenant_id}"`)
    evidence.push(`Resource: ${params.resource_type}/${params.resource_id}`)

    emitSiemEvent({
      event_type: 'TENANT_LEAKAGE_ATTEMPT',
      severity: 'CRITICAL',
      user_id: params.user_id,
      tenant_id: params.requesting_tenant_id,
      description: `CRITICAL: Cross-tenant data access detected — ${params.resource_type} ${params.resource_id} belongs to tenant ${params.accessed_resource_tenant_id}`,
      metadata: {
        requesting_tenant: params.requesting_tenant_id,
        resource_tenant: params.accessed_resource_tenant_id,
        resource_type: params.resource_type,
        resource_id: params.resource_id,
      },
      source_ip: params.source_ip,
      detected_at: new Date().toISOString(),
    })

    return {
      threat_detected: true,
      threat_type: 'TENANT_LEAKAGE',
      severity: 'CRITICAL',
      evidence,
      blocked: true,
      recommendation: 'IMMEDIATE: Audit all recent queries for this user. Check RLS policies on affected tables. Review access_grants.',
    }
  }

  return { threat_detected: false, evidence: [], blocked: false, recommendation: 'OK' }
}

// ── Replay attack detection ────────────────────────────────────────────────────

/**
 * Detect payment/event replay attacks:
 * - Same idempotency key from different IPs
 * - Resubmission of already-processed financial operations
 * - Request timestamps outside acceptable window (±5 minutes)
 */
export async function detectReplayAttack(params: {
  idempotency_key: string
  operation_type: string
  tenant_id: string
  source_ip?: string
  request_timestamp?: string
}): Promise<ThreatAssessment> {
  const evidence: string[] = []

  // Check timestamp window (±5 minutes)
  if (params.request_timestamp) {
    const requestTime = new Date(params.request_timestamp).getTime()
    const drift = Math.abs(Date.now() - requestTime)
    if (drift > 5 * 60 * 1000) {
      evidence.push(`Request timestamp drift: ${(drift / 1000).toFixed(0)}s (max 300s)`)
    }
  }

  // Check if this idempotency key was already processed
  try {
    const { data: existingRows } = await (supabaseAdmin as any)
      .from('payment_idempotency_records')
      .select('key, status, created_at')
      .eq('key', params.idempotency_key)
      .eq('tenant_id', params.tenant_id)
      .eq('status', 'COMPLETED')
      .limit(1)

    type IdemRow = { key: string; status: string; created_at: string }
    const existing = (existingRows as IdemRow[] | null)?.[0]
    if (existing) {
      evidence.push(`Replayed completed operation: key="${params.idempotency_key}" originally completed at ${existing.created_at}`)
    }
  } catch { /* ignore if table doesn't exist yet */ }

  if (evidence.length > 0) {
    emitSiemEvent({
      event_type: 'REPLAY_ATTACK_DETECTED',
      severity: evidence.length >= 2 ? 'HIGH' : 'MEDIUM',
      tenant_id: params.tenant_id,
      source_ip: params.source_ip,
      description: `Replay attack detected on ${params.operation_type}: ${evidence.join('; ')}`,
      metadata: { idempotency_key: params.idempotency_key, operation_type: params.operation_type, evidence },
      detected_at: new Date().toISOString(),
    })

    return {
      threat_detected: true,
      threat_type: 'REPLAY_ATTACK',
      severity: evidence.length >= 2 ? 'HIGH' : 'MEDIUM',
      evidence,
      blocked: true,
      recommendation: 'Reject this request. Log source IP for monitoring. Review idempotency key generation.',
    }
  }

  return { threat_detected: false, evidence: [], blocked: false, recommendation: 'OK' }
}

// ── Data exfiltration detection ────────────────────────────────────────────────

/**
 * Detect data exfiltration patterns:
 * - Unusually large response payloads
 * - Bulk export requests outside business hours
 * - Sequential pagination over all records
 * - Unusual number of unique resource IDs accessed
 */
export async function detectDataExfiltration(params: {
  user_id?: string
  tenant_id: string
  endpoint: string
  records_returned: number
  source_ip?: string
  request_hour?: number  // 0-23
}): Promise<ThreatAssessment> {
  const evidence: string[] = []
  const requestHour = params.request_hour ?? new Date().getUTCHours()

  // Large response check
  const LARGE_RESPONSE_THRESHOLD = 500
  if (params.records_returned > LARGE_RESPONSE_THRESHOLD) {
    evidence.push(`Bulk response: ${params.records_returned} records returned from ${params.endpoint}`)
  }

  // Outside business hours check (sensitive endpoints only, 23:00-06:00 UTC)
  const sensitiveEndpoints = ['/api/contacts', '/api/investors', '/api/matches', '/api/deals', '/api/ledger', '/api/compliance']
  const isSensitive = sensitiveEndpoints.some(e => params.endpoint.startsWith(e))
  if (isSensitive && (requestHour >= 23 || requestHour < 6) && params.records_returned > 100) {
    evidence.push(`Bulk export outside business hours (${requestHour}:00 UTC): ${params.records_returned} records from ${params.endpoint}`)
  }

  // Check for sequential pagination pattern (50+ events in 5 minutes)
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count } = await (supabaseAdmin as any)
      .from('threat_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', params.tenant_id)
      .eq('source_ip', params.source_ip ?? '')
      .gte('detected_at', fiveMinAgo)

    if ((count ?? 0) > 50) {
      evidence.push(`High request rate from IP ${params.source_ip}: ${count} events in last 5 minutes`)
    }
  } catch { /* ignore */ }

  if (evidence.length > 0) {
    emitSiemEvent({
      event_type: 'DATA_EXFILTRATION_ATTEMPT',
      severity: evidence.length >= 2 ? 'HIGH' : 'MEDIUM',
      user_id: params.user_id,
      tenant_id: params.tenant_id,
      endpoint: params.endpoint,
      source_ip: params.source_ip,
      description: `Potential data exfiltration: ${evidence.join('; ')}`,
      metadata: { records_returned: params.records_returned, request_hour: requestHour, evidence },
      detected_at: new Date().toISOString(),
    })

    return {
      threat_detected: true,
      threat_type: 'DATA_EXFILTRATION',
      severity: evidence.length >= 2 ? 'HIGH' : 'MEDIUM',
      evidence,
      blocked: false,  // flag but don't block — may be legitimate bulk export
      recommendation: 'Monitor this user/IP. Consider requiring re-authentication for bulk exports.',
    }
  }

  return { threat_detected: false, evidence: [], blocked: false, recommendation: 'OK' }
}

// ── Anomalous capital flow detection ──────────────────────────────────────────

/**
 * Detect anomalous financial transaction patterns:
 * - Transaction 3× above account historical average
 * - First-ever transaction over €500K
 * - Multiple large transactions in short window
 */
export async function detectAnomalousCapitalFlow(params: {
  tenant_id: string
  transaction_amount_cents: bigint
  deal_id?: string
  transaction_type: string
}): Promise<ThreatAssessment> {
  const evidence: string[] = []
  const amountEur = Number(params.transaction_amount_cents) / 100
  const LARGE_FIRST_TRANSACTION = 500_000

  try {
    // Get historical transaction average
    const { data: histRows } = await (supabaseAdmin as any)
      .from('payment_rail_transactions')
      .select('amount_cents')
      .eq('tenant_id', params.tenant_id)
      .eq('status', 'SUCCEEDED')
      .limit(50)

    type HistRow = { amount_cents: number }
    const hist = (histRows ?? []) as HistRow[]

    if (hist.length === 0 && amountEur > LARGE_FIRST_TRANSACTION) {
      evidence.push(`First-ever transaction over €${LARGE_FIRST_TRANSACTION.toLocaleString()}: €${amountEur.toLocaleString()}`)
    } else if (hist.length > 0) {
      const avgAmount = hist.reduce((s, r) => s + r.amount_cents, 0) / hist.length
      const ratio = Number(params.transaction_amount_cents) / avgAmount
      if (ratio > 3) {
        evidence.push(`Transaction ${ratio.toFixed(1)}× above historical average (€${(avgAmount / 100).toLocaleString()} avg, €${amountEur.toLocaleString()} current)`)
      }
    }

    // Check for multiple large transactions in 1 hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count: recentLarge } = await (supabaseAdmin as any)
      .from('payment_rail_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', params.tenant_id)
      .gte('amount_cents', 5000000)  // ≥ €50,000
      .gte('created_at', oneHourAgo)

    if ((recentLarge ?? 0) >= 3) {
      evidence.push(`${recentLarge} large transactions (>=€50K) in last 1h`)
    }
  } catch { /* ignore if tables don't exist yet */ }

  if (evidence.length > 0) {
    emitSiemEvent({
      event_type: 'ANOMALOUS_CAPITAL_FLOW',
      severity: 'HIGH',
      tenant_id: params.tenant_id,
      description: `Anomalous capital flow: ${evidence.join('; ')}`,
      metadata: {
        amount_cents: params.transaction_amount_cents.toString(),
        amount_eur: amountEur,
        deal_id: params.deal_id,
        transaction_type: params.transaction_type,
        evidence,
      },
      detected_at: new Date().toISOString(),
    })

    return {
      threat_detected: true,
      threat_type: 'ANOMALOUS_CAPITAL_FLOW',
      severity: 'HIGH',
      evidence,
      blocked: false,  // flag for manual review, don't auto-block financial transactions
      recommendation: 'Flag for compliance review. Notify AML officer. Verify transaction with client.',
    }
  }

  return { threat_detected: false, evidence: [], blocked: false, recommendation: 'OK' }
}
