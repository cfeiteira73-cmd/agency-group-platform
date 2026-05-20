// Agency Group — SIEM Integration
// lib/security/siem.ts
// Security event forwarding to external SIEM (Sentry, Datadog, Elastic).
// Fire-and-forget. TypeScript strict — 0 errors
//
// TABLE DDL (run once in Supabase):
// -- CREATE TABLE security_events (
// --   id uuid primary key default gen_random_uuid(),
// --   event_type text not null,
// --   severity text not null,
// --   tenant_id text,
// --   correlation_id text,
// --   source text not null,
// --   description text not null,
// --   metadata jsonb,
// --   created_at timestamptz not null default now()
// -- );
// -- CREATE INDEX idx_security_events_tenant ON security_events(tenant_id, created_at DESC);
// -- CREATE INDEX idx_security_events_type ON security_events(event_type, created_at DESC);

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiemEventSeverity = 'info' | 'warning' | 'error' | 'critical'

export type SiemEventType =
  | 'auth_anomaly'
  | 'replay_abuse'
  | 'dlq_spike'
  | 'policy_violation'
  | 'suspicious_tenant_activity'
  | 'ai_abuse_attempt'
  | 'privilege_escalation'
  | 'prompt_injection_detected'
  | 'rate_limit_exceeded'
  | 'secret_expired'
  | 'unusual_ai_spend'
  | 'intrusion_detected'

export interface SiemEvent {
  event_type: SiemEventType
  severity: SiemEventSeverity
  tenant_id?: string
  correlation_id?: string
  source: string         // e.g. 'whatsapp-webhook', 'automation-agent'
  description: string
  metadata?: Record<string, unknown>
  timestamp: string
}

// ─── Supabase client ──────────────────────────────────────────────────────────

function getSiemClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Core emitter ─────────────────────────────────────────────────────────────

/**
 * Emit a security event to all configured SIEM backends.
 * Fire-and-forget — never throws.
 *
 * Destinations (run in parallel):
 *   1. Console structured log (always)
 *   2. Sentry (if SENTRY_DSN is set)
 *   3. Datadog (if DATADOG_API_KEY is set)
 *   4. Supabase `security_events` table (if Supabase is configured)
 */
export function emitSiemEvent(event: Omit<SiemEvent, 'timestamp'>): void {
  const fullEvent: SiemEvent = { ...event, timestamp: new Date().toISOString() }
  const { severity, event_type, description, tenant_id, correlation_id, source, metadata } = fullEvent

  // 1. Structured console log — always
  console.log(`[SIEM] ${severity.toUpperCase()} ${event_type} — ${description}`, {
    source,
    tenant_id,
    correlation_id,
    metadata,
    timestamp: fullEvent.timestamp,
  })

  // 2–4: All non-blocking outputs in parallel
  void Promise.all([
    // 2. Sentry
    (async () => {
      if (!process.env.SENTRY_DSN) return
      try {
        const Sentry = await import('@sentry/nextjs').catch(() => null)
        if (!Sentry) return
        if (severity === 'error' || severity === 'critical') {
          Sentry.captureEvent({
            message: description,
            level: severity as 'error' | 'fatal',
            tags: { event_type, source, tenant_id: tenant_id ?? 'unknown' },
            extra: { correlation_id, metadata },
          })
        } else {
          Sentry.addBreadcrumb({
            message: description,
            level: severity,
            category: 'siem',
            data: { event_type, source, tenant_id, correlation_id, metadata },
          })
        }
      } catch { /* non-critical */ }
    })(),

    // 3. Datadog
    (async () => {
      const ddKey = process.env.DATADOG_API_KEY
      if (!ddKey) return
      try {
        await fetch('https://http-intake.logs.datadoghq.eu/api/v2/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': ddKey,
          },
          body: JSON.stringify([{
            ddsource:  'agency-group',
            ddtags:    `env:production,event_type:${event_type},severity:${severity}`,
            hostname:  'agency-group-api',
            service:   'siem',
            message:   description,
            event_type,
            severity,
            tenant_id:      tenant_id ?? null,
            correlation_id: correlation_id ?? null,
            source,
            metadata:       metadata ?? null,
            timestamp:      fullEvent.timestamp,
          }]),
        })
      } catch { /* non-critical */ }
    })(),

    // 4. Supabase
    (async () => {
      const client = getSiemClient()
      if (!client) return
      try {
        const { error } = await client.from('security_events').insert({
          event_type,
          severity,
          tenant_id:      tenant_id ?? null,
          correlation_id: correlation_id ?? null,
          source,
          description,
          metadata:       metadata ?? null,
        })
        if (error) {
          console.warn('[siem] Supabase insert failed:', (error as { message: string }).message)
        }
      } catch { /* non-critical */ }
    })(),
  ])
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function emitAuthAnomaly(tenantId: string, source: string, details: string): void {
  emitSiemEvent({
    event_type:  'auth_anomaly',
    severity:    'error',
    tenant_id:   tenantId,
    source,
    description: details,
  })
}

export function emitAIAbuse(tenantId: string, source: string, details: string): void {
  emitSiemEvent({
    event_type:  'ai_abuse_attempt',
    severity:    'warning',
    tenant_id:   tenantId,
    source,
    description: details,
  })
}

export function emitPolicyViolation(tenantId: string, agentId: string, reason: string): void {
  emitSiemEvent({
    event_type:  'policy_violation',
    severity:    'warning',
    tenant_id:   tenantId,
    source:      agentId,
    description: reason,
  })
}

export function emitPromptInjection(source: string, filteredContent: string): void {
  emitSiemEvent({
    event_type:  'prompt_injection_detected',
    severity:    'critical',
    source,
    description: 'Prompt injection pattern detected and filtered',
    metadata:    { filtered_content: filteredContent.slice(0, 500) },
  })
}
