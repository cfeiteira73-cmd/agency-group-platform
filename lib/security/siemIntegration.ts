// lib/security/siemIntegration.ts
// SIEM integration for Agency Group SH-ROS
// Primary: Datadog Security (https://docs.datadoghq.com/api/latest/logs/)
// Secondary: Microsoft Azure Sentinel (Log Analytics Workspace)
// Always: Supabase threat_events table (local SIEM)

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { createHmac } from 'crypto'

export type SiemSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type SiemEventType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'AUTH_BRUTE_FORCE'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'
  | 'TENANT_LEAKAGE_ATTEMPT'
  | 'REPLAY_ATTACK_DETECTED'
  | 'DATA_EXFILTRATION_ATTEMPT'
  | 'ANOMALOUS_CAPITAL_FLOW'
  | 'RATE_LIMIT_VIOLATED'
  | 'UNAUTHORIZED_API_ACCESS'
  | 'SUSPICIOUS_USER_AGENT'
  | 'SQL_INJECTION_ATTEMPT'
  | 'CSP_VIOLATION'
  | 'SCANNER_DETECTED'
  | 'ADMIN_ACTION'

export interface SiemEvent {
  event_type: SiemEventType
  severity: SiemSeverity
  source_ip?: string
  user_id?: string
  tenant_id: string
  endpoint?: string
  user_agent?: string
  description: string
  metadata?: Record<string, unknown>
  detected_at: string
}

interface DatadogLog {
  ddsource: string
  ddtags: string
  hostname: string
  message: string
  service: string
  level: string
  event_type: string
  severity: string
  [key: string]: unknown
}

const DD_API_KEY = process.env.DD_API_KEY
const DD_SITE = process.env.DD_SITE ?? 'datadoghq.eu'  // EU data residency
const DD_SERVICE = process.env.DD_SERVICE ?? 'agency-group-sros'

const AZURE_WORKSPACE_ID = process.env.AZURE_SENTINEL_WORKSPACE_ID
const AZURE_SHARED_KEY = process.env.AZURE_SENTINEL_SHARED_KEY
const AZURE_LOG_TYPE = process.env.AZURE_SENTINEL_LOG_TYPE ?? 'AgencyGroupSROS'

function isDatadogConfigured(): boolean {
  return !!DD_API_KEY
}

function isAzureSentinelConfigured(): boolean {
  return !!(AZURE_WORKSPACE_ID && AZURE_SHARED_KEY)
}

// ── Datadog ingestion ──────────────────────────────────────────────────────────

async function sendToDatadog(event: SiemEvent): Promise<void> {
  if (!DD_API_KEY) return

  const ddLog: DatadogLog = {
    ddsource: 'agency-group',
    ddtags: `env:production,service:${DD_SERVICE},severity:${event.severity},event_type:${event.event_type}`,
    hostname: process.env.VERCEL_URL ?? 'agency-group.vercel.app',
    message: event.description,
    service: DD_SERVICE,
    level: event.severity === 'CRITICAL' || event.severity === 'HIGH' ? 'error' : 'warn',
    event_type: event.event_type,
    severity: event.severity,
    tenant_id: event.tenant_id,
    source_ip: event.source_ip ?? 'unknown',
    user_id: event.user_id ?? null,
    endpoint: event.endpoint ?? null,
    user_agent: event.user_agent ?? null,
    detected_at: event.detected_at,
    ...event.metadata,
  }

  try {
    const response = await fetch(`https://http-intake.logs.${DD_SITE}/api/v2/logs`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': DD_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([ddLog]),
    })

    if (!response.ok) {
      log.warn('[siemIntegration] Datadog send failed', { status: response.status, event_type: event.event_type })
    }
  } catch (e) {
    log.warn('[siemIntegration] Datadog error', { e })
  }
}

// ── Azure Sentinel ingestion ──────────────────────────────────────────────────

async function sendToAzureSentinel(event: SiemEvent): Promise<void> {
  if (!AZURE_WORKSPACE_ID || !AZURE_SHARED_KEY) return

  const body = JSON.stringify([{
    TimeGenerated: event.detected_at,
    EventType: event.event_type,
    Severity: event.severity,
    TenantId: event.tenant_id,
    SourceIP: event.source_ip ?? '',
    UserId: event.user_id ?? '',
    Endpoint: event.endpoint ?? '',
    UserAgent: event.user_agent ?? '',
    Description: event.description,
    Metadata: JSON.stringify(event.metadata ?? {}),
  }])

  const now = new Date().toUTCString()
  const contentLength = Buffer.byteLength(body, 'utf8')
  const stringToSign = `POST\n${contentLength}\napplication/json\nx-ms-date:${now}\n/api/logs`
  const signature = createHmac('sha256', Buffer.from(AZURE_SHARED_KEY, 'base64'))
    .update(stringToSign, 'utf8')
    .digest('base64')

  try {
    const response = await fetch(
      `https://${AZURE_WORKSPACE_ID}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Log-Type': AZURE_LOG_TYPE,
          'x-ms-date': now,
          'Authorization': `SharedKey ${AZURE_WORKSPACE_ID}:${signature}`,
        },
        body,
      },
    )

    if (!response.ok && response.status !== 200) {
      log.warn('[siemIntegration] Azure Sentinel send failed', { status: response.status })
    }
  } catch (e) {
    log.warn('[siemIntegration] Azure Sentinel error', { e })
  }
}

// ── Local DB (always) ─────────────────────────────────────────────────────────

async function persistToLocalDb(event: SiemEvent): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('threat_events')
      .insert({
        tenant_id: event.tenant_id,
        event_type: event.event_type,
        severity: event.severity,
        source_ip: event.source_ip ?? null,
        user_id: event.user_id ?? null,
        endpoint: event.endpoint ?? null,
        user_agent: event.user_agent ?? null,
        description: event.description,
        metadata: event.metadata ?? {},
        detected_at: event.detected_at,
      })
  } catch (e) {
    log.warn('[siemIntegration] local DB persist error', { e })
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Emit a SIEM event to ALL configured sinks simultaneously.
 * Fire-and-forget — never blocks request handling.
 */
export function emitSiemEvent(event: SiemEvent): void {
  // Normalize detected_at
  const normalizedEvent: SiemEvent = {
    ...event,
    detected_at: event.detected_at ?? new Date().toISOString(),
  }

  // Always write to local DB
  void persistToLocalDb(normalizedEvent)

  // Write to external SIEMs in parallel (fire-and-forget)
  if (isDatadogConfigured()) {
    void sendToDatadog(normalizedEvent)
  }
  if (isAzureSentinelConfigured()) {
    void sendToAzureSentinel(normalizedEvent)
  }

  // Always log locally too
  const logLevel = normalizedEvent.severity === 'CRITICAL' || normalizedEvent.severity === 'HIGH' ? 'error' : 'warn'
  if (logLevel === 'error') {
    log.error('[SIEM]', new Error(normalizedEvent.description), {
      event_type: normalizedEvent.event_type,
      severity: normalizedEvent.severity,
      tenant_id: normalizedEvent.tenant_id,
      source_ip: normalizedEvent.source_ip,
    })
  } else {
    log.warn('[SIEM]', {
      event_type: normalizedEvent.event_type,
      severity: normalizedEvent.severity,
      tenant_id: normalizedEvent.tenant_id,
      description: normalizedEvent.description,
    })
  }
}

export function getSiemStatus(): {
  local_db: boolean
  datadog: { configured: boolean; site: string }
  azure_sentinel: { configured: boolean }
} {
  return {
    local_db: true,  // always
    datadog: { configured: isDatadogConfigured(), site: DD_SITE },
    azure_sentinel: { configured: isAzureSentinelConfigured() },
  }
}
