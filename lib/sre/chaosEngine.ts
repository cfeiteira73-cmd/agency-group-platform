// Agency Group — Chaos Engineering Library
// lib/sre/chaosEngine.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChaosTestType =
  | 'db_failure'
  | 'redis_outage'
  | 'ai_provider_outage'
  | 'worker_saturation'
  | 'latency_injection'
  | 'network_partition'
  | 'queue_overflow'

export interface ChaosTestDefinition {
  name: string
  type: ChaosTestType
  description: string
  durationMs: number
  expectedBehavior: string
  successCriteria: string
  riskLevel: 'low' | 'medium' | 'high'
  automatable: boolean
}

export interface ChaosTestResult {
  definition: ChaosTestDefinition
  status: 'passed' | 'failed' | 'skipped'
  systemRecovered: boolean
  recoveryTimeMs: number | null
  findings: string[]
  timestamp: string
}

// ─── Chaos Test Library ───────────────────────────────────────────────────────

export const CHAOS_TEST_LIBRARY: ChaosTestDefinition[] = [
  {
    name: 'db-connection-loss',
    type: 'db_failure',
    description: 'Simulate loss of Supabase connection for 30s',
    durationMs: 30_000,
    expectedBehavior: 'API returns 503 with retry-after header, queue continues processing, events buffered',
    successCriteria: 'All APIs recover within 60s, no data loss, incident logged',
    riskLevel: 'high',
    automatable: false,
  },
  {
    name: 'redis-timeout',
    type: 'redis_outage',
    description: 'Simulate Redis/Upstash timeout (rate limiting degraded)',
    durationMs: 60_000,
    expectedBehavior: 'System falls back to in-memory rate limiting, logs warning',
    successCriteria: 'No 5xx errors, rate limiting degraded gracefully',
    riskLevel: 'low',
    automatable: true,
  },
  {
    name: 'ai-provider-429',
    type: 'ai_provider_outage',
    description: 'Simulate Anthropic API rate limit',
    durationMs: 120_000,
    expectedBehavior: 'Sofia falls back to heuristic responses, AI scoring uses cached results',
    successCriteria: 'No crashes, user sees degraded-mode message',
    riskLevel: 'medium',
    automatable: false,
  },
  {
    name: 'worker-queue-overflow',
    type: 'worker_saturation',
    description: 'Inject 1000 jobs simultaneously to test queue backpressure',
    durationMs: 300_000,
    expectedBehavior: 'Queue processes jobs in order, no job loss, workers saturate then recover',
    successCriteria: 'All jobs processed within 10m, no duplicates',
    riskLevel: 'medium',
    automatable: true,
  },
  {
    name: 'api-latency-2s',
    type: 'latency_injection',
    description: 'Inject 2s delay on all API routes',
    durationMs: 60_000,
    expectedBehavior: 'p95 latency spike visible in SLO dashboard, no errors',
    successCriteria: 'p99 < 5s, no timeouts',
    riskLevel: 'low',
    automatable: false,
  },
  {
    name: 'kafka-broker-1-down',
    type: 'network_partition',
    description: 'Take down 1 of 3 Kafka/Redpanda brokers',
    durationMs: 120_000,
    expectedBehavior: 'Kafka client reconnects to remaining 2 brokers, no message loss',
    successCriteria: 'Consumer lag < 100, no DLQ spikes',
    riskLevel: 'high',
    automatable: false,
  },
  {
    name: 'supabase-queue-overflow',
    type: 'queue_overflow',
    description: 'Fill worker queue to capacity limit',
    durationMs: 60_000,
    expectedBehavior: 'New jobs rejected with 429, existing jobs complete',
    successCriteria: 'Queue drains within 5m, no silent drops',
    riskLevel: 'medium',
    automatable: true,
  },
]

// ─── dryRunChaosTest ──────────────────────────────────────────────────────────

export async function dryRunChaosTest(
  testName: string,
): Promise<{ valid: boolean; warnings: string[] }> {
  if (process.env.CHAOS_TESTING_ENABLED !== 'true') {
    return {
      valid: false,
      warnings: ['CHAOS_TESTING_ENABLED not set — test skipped for safety'],
    }
  }

  const def = CHAOS_TEST_LIBRARY.find(t => t.name === testName)
  if (!def) {
    return { valid: false, warnings: ['Test not found'] }
  }

  if (!def.automatable) {
    return {
      valid: true,
      warnings: ['Manual execution required — not automatable'],
    }
  }

  return { valid: true, warnings: [] }
}

// ─── persistChaosResult ───────────────────────────────────────────────────────

export async function persistChaosResult(
  tenantId: string,
  result: ChaosTestResult,
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('chaos_test_results')
      .insert({
        tenant_id:        tenantId,
        test_name:        result.definition.name,
        test_type:        result.definition.type,
        status:           result.status,
        started_at:       result.timestamp,
        completed_at:     new Date().toISOString(),
        system_recovered: result.systemRecovered,
        recovery_time_ms: result.recoveryTimeMs,
        findings:         { items: result.findings },
      })

    if (error) {
      log.error('[ChaosEngine] persistChaosResult error', undefined, { error: error.message, test_name: result.definition.name })
    }
  } catch (err) {
    log.error('[ChaosEngine] persistChaosResult threw', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err), test_name: result.definition.name })
  }
}

// ─── getChaosHistory ──────────────────────────────────────────────────────────

export async function getChaosHistory(
  tenantId: string,
  limit = 20,
): Promise<ChaosTestResult[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('chaos_test_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return (data as Array<{
      test_name: string
      test_type: ChaosTestType
      status: 'passed' | 'failed' | 'skipped'
      system_recovered: boolean | null
      recovery_time_ms: number | null
      findings: { items?: string[] } | null
      started_at: string
    }>).map(row => {
      const def = CHAOS_TEST_LIBRARY.find(t => t.name === row.test_name) ?? {
        name: row.test_name,
        type: row.test_type,
        description: '',
        durationMs: 0,
        expectedBehavior: '',
        successCriteria: '',
        riskLevel: 'medium' as const,
        automatable: false,
      }
      return {
        definition: def,
        status: row.status,
        systemRecovered: row.system_recovered ?? false,
        recoveryTimeMs: row.recovery_time_ms,
        findings: row.findings?.items ?? [],
        timestamp: row.started_at,
      }
    })
  } catch (err) {
    log.error('[ChaosEngine] getChaosHistory error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}
