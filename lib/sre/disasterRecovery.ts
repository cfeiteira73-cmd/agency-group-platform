// Agency Group — Disaster Recovery Playbooks
// lib/sre/disasterRecovery.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DRStep {
  order: number
  name: string
  automated: boolean
  action: string
  verificationQuery?: string
  timeoutMs: number
  rollbackAction?: string
}

export interface DRPlaybook {
  name: string
  trigger: string
  severity: 'P0' | 'P1' | 'P2'
  estimatedRecoveryMs: number
  steps: DRStep[]
}

// ─── DR Playbooks ─────────────────────────────────────────────────────────────

export const DR_PLAYBOOKS: DRPlaybook[] = [
  {
    name: 'db-primary-failover',
    trigger: 'Primary Supabase DB unreachable for > 30s',
    severity: 'P0',
    estimatedRecoveryMs: 5 * 60_000,
    steps: [
      {
        order: 1,
        name: 'detect-failure',
        automated: true,
        action: 'Health check detects DB failure; circuit breaker opens; alert fires',
        verificationQuery: "SELECT 1",
        timeoutMs: 30_000,
      },
      {
        order: 2,
        name: 'switch-to-read-replica',
        automated: true,
        action: 'Update SUPABASE_URL to read-replica endpoint for read-only queries',
        timeoutMs: 60_000,
        rollbackAction: 'Revert SUPABASE_URL to primary',
      },
      {
        order: 3,
        name: 'notify-ops',
        automated: true,
        action: 'Send PagerDuty P0 alert + Slack #incidents channel notification',
        timeoutMs: 30_000,
      },
      {
        order: 4,
        name: 'verify-replica-connectivity',
        automated: true,
        action: 'Run SELECT 1 against read-replica; confirm < 500ms latency',
        verificationQuery: "SELECT 1",
        timeoutMs: 30_000,
      },
      {
        order: 5,
        name: 'promote-replica',
        automated: false,
        action: 'In Supabase Dashboard: promote read-replica to primary via Point-in-Time Recovery',
        timeoutMs: 10 * 60_000,
        rollbackAction: 'Contact Supabase support for manual restore',
      },
      {
        order: 6,
        name: 'update-connection-strings',
        automated: false,
        action: 'Update NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel; redeploy',
        timeoutMs: 5 * 60_000,
      },
      {
        order: 7,
        name: 'verify-write-access',
        automated: true,
        action: 'Insert test row into health_checks table; confirm no error',
        verificationQuery: "INSERT INTO health_checks (id) VALUES (gen_random_uuid()) RETURNING id",
        timeoutMs: 30_000,
        rollbackAction: 'DELETE FROM health_checks WHERE created_at > now() - interval 10m',
      },
      {
        order: 8,
        name: 'post-mortem',
        automated: false,
        action: 'Schedule 30-min post-mortem within 24h; complete incident timeline in recovery_timelines',
        timeoutMs: 24 * 60 * 60_000,
      },
    ],
  },
  {
    name: 'redis-outage-fallback',
    trigger: 'Upstash Redis timeout > 1s for > 60s',
    severity: 'P1',
    estimatedRecoveryMs: 2 * 60_000,
    steps: [
      {
        order: 1,
        name: 'detect-redis-timeout',
        automated: true,
        action: 'Health check detects Redis latency > 1s; log warning',
        timeoutMs: 10_000,
      },
      {
        order: 2,
        name: 'activate-memory-rate-limiting',
        automated: true,
        action: 'Rate limiter falls back to in-memory Map; REDIS_FALLBACK=true env var',
        timeoutMs: 5_000,
      },
      {
        order: 3,
        name: 'log-degraded-mode',
        automated: true,
        action: 'Log degraded mode event to recovery_timelines; alert #sre-alerts Slack',
        timeoutMs: 10_000,
      },
      {
        order: 4,
        name: 'restore-redis',
        automated: false,
        action: 'Check Upstash dashboard; restart Redis instance or failover to backup',
        timeoutMs: 10 * 60_000,
      },
      {
        order: 5,
        name: 'verify-redis-health',
        automated: true,
        action: 'Run GET health:canary; confirm < 100ms latency for 3 consecutive checks',
        timeoutMs: 60_000,
      },
      {
        order: 6,
        name: 'switch-back-to-redis',
        automated: true,
        action: 'Clear REDIS_FALLBACK flag; rate limiter resumes distributed mode',
        timeoutMs: 10_000,
      },
    ],
  },
  {
    name: 'kafka-broker-failure',
    trigger: '1 of 3 Kafka/Redpanda brokers unreachable',
    severity: 'P1',
    estimatedRecoveryMs: 3 * 60_000,
    steps: [
      {
        order: 1,
        name: 'detect-broker-down',
        automated: true,
        action: 'Kafka client emits broker-disconnected event; alert fires',
        timeoutMs: 30_000,
      },
      {
        order: 2,
        name: 'verify-quorum',
        automated: true,
        action: 'Confirm 2/3 brokers healthy; partition leadership re-elected',
        timeoutMs: 60_000,
      },
      {
        order: 3,
        name: 'monitor-consumer-lag',
        automated: true,
        action: 'Watch consumer group lag in Redpanda Console; alert if lag > 1000',
        timeoutMs: 5 * 60_000,
      },
      {
        order: 4,
        name: 'check-dlq-spikes',
        automated: true,
        action: 'Monitor DLQ topic for unexpected message growth',
        timeoutMs: 5 * 60_000,
      },
      {
        order: 5,
        name: 'restore-broker',
        automated: false,
        action: 'Restart failed broker via cloud console or Kubernetes; rejoin cluster',
        timeoutMs: 10 * 60_000,
      },
      {
        order: 6,
        name: 'rebalance-consumers',
        automated: true,
        action: 'Trigger consumer group rebalance; redistribute partition assignments',
        timeoutMs: 3 * 60_000,
      },
      {
        order: 7,
        name: 'verify-lag-zero',
        automated: true,
        action: 'Confirm consumer lag = 0 for all partitions',
        verificationQuery: 'SELECT consumer_lag FROM kafka_metrics WHERE lag = 0',
        timeoutMs: 10 * 60_000,
      },
    ],
  },
  {
    name: 'ai-provider-outage',
    trigger: 'Anthropic API returning 5xx or 429 for > 60s',
    severity: 'P1',
    estimatedRecoveryMs: 10 * 60_000,
    steps: [
      {
        order: 1,
        name: 'detect-ai-errors',
        automated: true,
        action: 'Monitor Anthropic API error rate; alert when > 5% of requests fail',
        timeoutMs: 60_000,
      },
      {
        order: 2,
        name: 'activate-heuristic-fallback',
        automated: true,
        action: 'Set AI_FALLBACK_MODE=heuristic; Sofia switches to rule-based responses',
        timeoutMs: 10_000,
      },
      {
        order: 3,
        name: 'notify-users-degraded',
        automated: true,
        action: 'Show degraded-mode banner in portal; disable AI-dependent features',
        timeoutMs: 30_000,
      },
      {
        order: 4,
        name: 'monitor-anthropic-status',
        automated: false,
        action: 'Check status.anthropic.com; subscribe to incident updates',
        timeoutMs: 60 * 60_000,
      },
      {
        order: 5,
        name: 'restore-ai-provider',
        automated: true,
        action: 'Clear AI_FALLBACK_MODE when Anthropic API returns 2xx for 5 consecutive checks',
        timeoutMs: 60 * 60_000,
      },
      {
        order: 6,
        name: 'validate-ai-accuracy',
        automated: false,
        action: 'Run 10 sample queries; compare responses against golden-set benchmarks',
        timeoutMs: 30 * 60_000,
      },
    ],
  },
  {
    name: 'full-region-outage',
    trigger: 'EU-North-1 (primary) region unreachable',
    severity: 'P0',
    estimatedRecoveryMs: 15 * 60_000,
    steps: [
      {
        order: 1,
        name: 'detect-region-unreachable',
        automated: true,
        action: 'Vercel edge detects EU-North-1 endpoints returning 5xx; alert fires to all on-call',
        timeoutMs: 60_000,
      },
      {
        order: 2,
        name: 'activate-eu-west-1-standby',
        automated: false,
        action: 'Enable EU-West-1 (Ireland) standby environment in Vercel project settings',
        timeoutMs: 5 * 60_000,
        rollbackAction: 'Disable EU-West-1 standby; revert DNS to EU-North-1',
      },
      {
        order: 3,
        name: 'update-dns-cdn',
        automated: false,
        action: 'Update Cloudflare DNS A record to EU-West-1 IP; TTL 60s',
        timeoutMs: 5 * 60_000,
        rollbackAction: 'Revert DNS to EU-North-1 IP',
      },
      {
        order: 4,
        name: 'verify-database-replication',
        automated: true,
        action: 'Confirm Supabase read-replica in EU-West-1 has replication lag < 30s',
        verificationQuery: "SELECT now() - pg_last_xact_replay_timestamp() AS lag",
        timeoutMs: 5 * 60_000,
      },
      {
        order: 5,
        name: 'notify-all-users',
        automated: true,
        action: 'Send status page update; email to all active portal users; Slack announcement',
        timeoutMs: 10 * 60_000,
      },
      {
        order: 6,
        name: 'run-recovery-checks',
        automated: true,
        action: 'Execute full deep health check against EU-West-1; all services must be healthy',
        timeoutMs: 5 * 60_000,
      },
      {
        order: 7,
        name: 'full-dr-validation',
        automated: false,
        action: 'Run DR validation checklist: data integrity, auth flow, payment processing, AI features',
        timeoutMs: 30 * 60_000,
      },
    ],
  },
]

// ─── logRecoveryEvent ─────────────────────────────────────────────────────────

export async function logRecoveryEvent(
  tenantId: string,
  event: {
    incidentId: string
    eventType: 'failure_detected' | 'mitigation_started' | 'service_restored' | 'post_mortem_started'
    service: string
    description: string
    automated?: boolean
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('recovery_timelines')
      .insert({
        tenant_id:   tenantId,
        incident_id: event.incidentId,
        event_type:  event.eventType,
        service:     event.service,
        description: event.description,
        automated:   event.automated ?? false,
        metadata:    event.metadata ?? {},
        occurred_at: new Date().toISOString(),
      })

    if (error) {
      log.error('[DR] logRecoveryEvent error', undefined, { error: error.message, incident_id: event.incidentId, service: event.service })
    }
  } catch (err) {
    log.error('[DR] logRecoveryEvent threw', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), incident_id: event.incidentId, service: event.service })
  }
}

// ─── getRecoveryTimeline ──────────────────────────────────────────────────────

export interface RecoveryEvent {
  eventType: string
  service: string
  description: string
  occurred_at: string
  automated: boolean
}

export interface RecoveryTimeline {
  incidentId: string
  events: RecoveryEvent[]
  totalRecoveryMs: number | null
}

export async function getRecoveryTimeline(
  tenantId: string,
  incidentId: string,
): Promise<RecoveryTimeline> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('recovery_timelines')
      .select('event_type,service,description,occurred_at,automated')
      .eq('tenant_id', tenantId)
      .eq('incident_id', incidentId)
      .order('occurred_at', { ascending: true })

    if (error || !data) {
      return { incidentId, events: [], totalRecoveryMs: null }
    }

    const rows = data as Array<{
      event_type: string
      service: string
      description: string
      occurred_at: string
      automated: boolean
    }>

    const events: RecoveryEvent[] = rows.map(r => ({
      eventType:   r.event_type,
      service:     r.service,
      description: r.description,
      occurred_at: r.occurred_at,
      automated:   r.automated,
    }))

    // Compute totalRecoveryMs: first failure_detected → last service_restored
    const firstFailure = rows.find(r => r.event_type === 'failure_detected')
    const lastRestore  = [...rows].reverse().find(r => r.event_type === 'service_restored')

    const totalRecoveryMs =
      firstFailure && lastRestore
        ? new Date(lastRestore.occurred_at).getTime() - new Date(firstFailure.occurred_at).getTime()
        : null

    return { incidentId, events, totalRecoveryMs }
  } catch (err) {
    log.error('[DR] getRecoveryTimeline error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), incident_id: incidentId })
    return { incidentId, events: [], totalRecoveryMs: null }
  }
}
