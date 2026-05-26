// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Threat Detection Engine — SIEM Event Logging + Intrusion Detection
// Wave 44 Agent 1 — Production Lock
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

let log: { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logger } = require('@/lib/observability/logger')
  log = logger
} catch {
  log = {
    info: (m: string, c?: Record<string, unknown>) => console.log('[security]', m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => console.warn('[security]', m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => console.error('[security]', m, c ?? {}),
  }
}

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────

export type ThreatEventType =
  | 'AUTH_FAILURE'
  | 'UNUSUAL_ACCESS_PATTERN'
  | 'CAPITAL_ANOMALY'
  | 'DATA_EXFILTRATION_ATTEMPT'
  | 'BRUTE_FORCE'
  | 'PRIVILEGE_ESCALATION'
  | 'SUSPICIOUS_IP'
  | 'SESSION_HIJACK_SUSPECTED'
  | 'API_ABUSE'
  | 'INJECTION_ATTEMPT'

export type ThreatSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ThreatEvent {
  event_id: string
  tenant_id: string
  event_type: ThreatEventType
  severity: ThreatSeverity
  source_ip: string
  user_id: string | null
  session_id: string | null
  endpoint: string | null
  description: string
  metadata: Record<string, unknown>
  detected_at: string
  auto_blocked: boolean
}

// ── SQL Injection Patterns ─────────────────────────────────────────────

const SQL_INJECTION_PATTERNS = [
  /(\bunion\b.*\bselect\b)/i,
  /(\bselect\b.*\bfrom\b.*\bwhere\b)/i,
  /(\bdrop\b.*\btable\b)/i,
  /(\binsert\b.*\binto\b)/i,
  /(\bdelete\b.*\bfrom\b)/i,
  /(\bexec\b|\bexecute\b).*\(/i,
  /('.*--)/,
  /(;.*--)/,
  /(\bxp_\w+)/i,
  /(\/\*.*\*\/)/,
]

const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /burpsuite/i,
  /nessus/i,
  /openvas/i,
  /acunetix/i,
]

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Log a security/threat event to the SIEM table.
 * Fire-and-forget — never blocks the request path.
 */
export function logThreatEvent(event: Omit<ThreatEvent, 'event_id' | 'detected_at'>): void {
  const fullEvent: ThreatEvent = {
    ...event,
    event_id: randomUUID(),
    detected_at: new Date().toISOString(),
  }

  if (event.severity === 'CRITICAL') {
    console.error('[SIEM] CRITICAL threat event detected', {
      event_type: fullEvent.event_type,
      source_ip: fullEvent.source_ip,
      user_id: fullEvent.user_id,
      endpoint: fullEvent.endpoint,
      description: fullEvent.description,
    })
  }

  void (supabaseAdmin as any)
    .from('threat_events')
    .insert({
      event_id: fullEvent.event_id,
      tenant_id: fullEvent.tenant_id ?? TENANT_ID,
      event_type: fullEvent.event_type,
      severity: fullEvent.severity,
      source_ip: fullEvent.source_ip ?? '',
      user_id: fullEvent.user_id ?? null,
      session_id: fullEvent.session_id ?? null,
      endpoint: fullEvent.endpoint ?? null,
      description: fullEvent.description ?? '',
      metadata: fullEvent.metadata ?? {},
      detected_at: fullEvent.detected_at,
      auto_blocked: fullEvent.auto_blocked ?? false,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[threatDetection] Failed to insert threat event', { event_id: fullEvent.event_id, error })
    })
    .catch((e: unknown) => console.warn('[threatDetectionEngine] logThreatEvent', e))
}

/**
 * Check if an identifier (IP, user_id, email) has hit brute force threshold.
 */
export async function checkBruteForce(
  identifier: string,
  windowMinutes = 15,
): Promise<{ blocked: boolean; attempt_count: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('threat_events')
      .select('id', { count: 'exact' })
      .eq('event_type', 'AUTH_FAILURE')
      .or(`source_ip.eq.${identifier},user_id.eq.${identifier}`)
      .gte('detected_at', windowStart)

    if (error) {
      log.warn('[threatDetection] checkBruteForce query failed', { identifier, error })
      return { blocked: false, attempt_count: 0 }
    }

    const count = Array.isArray(data) ? data.length : 0
    return {
      blocked: count >= 5,
      attempt_count: count,
    }
  } catch (e) {
    console.warn('[threatDetectionEngine] checkBruteForce', e)
    return { blocked: false, attempt_count: 0 }
  }
}

/**
 * Detect anomalous capital activity for a user.
 * Compares current transaction amount against 30-day historical average.
 */
export async function detectAnomalousCapitalActivity(
  userId: string,
  amountCents: bigint,
): Promise<{ anomalous: boolean; reason?: string }> {
  const LARGE_FIRST_TRANSACTION_CENTS = BigInt(50_000_000) // €500,000

  try {
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('threat_events')
      .select('metadata')
      .eq('event_type', 'CAPITAL_ANOMALY')
      .eq('user_id', userId)
      .gte('detected_at', windowStart)

    if (error) {
      log.warn('[threatDetection] detectAnomalous query failed', { user_id: userId, error })
      return { anomalous: false }
    }

    const priorTransactions: bigint[] = []
    for (const row of data ?? []) {
      const meta = row.metadata as Record<string, unknown>
      if (meta?.amount_cents != null) {
        try {
          priorTransactions.push(BigInt(meta.amount_cents as string | number))
        } catch {
          // ignore malformed
        }
      }
    }

    // First transaction check
    if (priorTransactions.length === 0 && amountCents > LARGE_FIRST_TRANSACTION_CENTS) {
      return {
        anomalous: true,
        reason: `First capital transaction exceeds €500,000 threshold (amount: €${Number(amountCents) / 100})`,
      }
    }

    // 3× average check
    if (priorTransactions.length > 0) {
      const total = priorTransactions.reduce((a, b) => a + b, BigInt(0))
      const average = total / BigInt(priorTransactions.length)
      if (amountCents > average * BigInt(3)) {
        return {
          anomalous: true,
          reason: `Capital amount (€${Number(amountCents) / 100}) exceeds 3× 30-day average (€${Number(average) / 100})`,
        }
      }
    }

    return { anomalous: false }
  } catch (e) {
    console.warn('[threatDetectionEngine] detectAnomalousCapitalActivity', e)
    return { anomalous: false }
  }
}

/**
 * Aggregate threat events for the last 24 hours for a tenant.
 */
export async function getActiveThreatsSummary(tenantId: string): Promise<{
  total_24h: number
  critical_count: number
  high_count: number
  top_event_types: Array<{ type: ThreatEventType; count: number }>
}> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('threat_events')
      .select('event_type, severity')
      .eq('tenant_id', tenantId)
      .gte('detected_at', windowStart)

    if (error) {
      log.warn('[threatDetection] getActiveThreatsSummary failed', { tenant_id: tenantId, error })
      return { total_24h: 0, critical_count: 0, high_count: 0, top_event_types: [] }
    }

    const rows = (data ?? []) as Array<{ event_type: string; severity: string }>
    const total_24h = rows.length
    const critical_count = rows.filter(r => r.severity === 'CRITICAL').length
    const high_count = rows.filter(r => r.severity === 'HIGH').length

    // Count by event type
    const typeCounts = new Map<string, number>()
    for (const row of rows) {
      typeCounts.set(row.event_type, (typeCounts.get(row.event_type) ?? 0) + 1)
    }

    const top_event_types = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type: type as ThreatEventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return { total_24h, critical_count, high_count, top_event_types }
  } catch (e) {
    console.warn('[threatDetectionEngine] getActiveThreatsSummary', e)
    return { total_24h: 0, critical_count: 0, high_count: 0, top_event_types: [] }
  }
}

/**
 * Synchronous intrusion detection rule evaluation.
 * Returns the highest severity threat detected, or null if clean.
 */
export function runIntrusionDetectionRules(request: {
  ip: string
  endpoint: string
  headers: Record<string, string>
  body_preview: string
}): ThreatSeverity | null {
  const { headers, body_preview } = request

  // Check for SQL injection in body
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(body_preview)) {
      return 'HIGH'
    }
  }

  // Check user-agent for known scanner signatures
  const userAgent = headers['user-agent'] ?? headers['User-Agent'] ?? ''
  for (const pattern of SUSPICIOUS_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      return 'MEDIUM'
    }
  }

  // Check for suspicious header combinations (e.g., X-Forwarded-For spoofing attempts)
  const hasForwardedFor = 'x-forwarded-for' in headers || 'X-Forwarded-For' in headers
  const hasRealIp = 'x-real-ip' in headers || 'X-Real-IP' in headers
  const hasCustomForwardChain = 'x-original-forwarded-for' in headers
  if (hasForwardedFor && hasRealIp && hasCustomForwardChain) {
    return 'LOW'
  }

  // Check for path traversal attempts
  if (body_preview.includes('../') || body_preview.includes('..\\')) {
    return 'MEDIUM'
  }

  // Check for script injection attempts
  if (/<script[\s>]/i.test(body_preview) || /javascript:/i.test(body_preview)) {
    return 'MEDIUM'
  }

  return null
}
