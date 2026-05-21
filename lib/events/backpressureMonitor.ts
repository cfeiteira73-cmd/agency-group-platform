// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Backpressure Monitor v1.0
// lib/events/backpressureMonitor.ts
//
// Consumer lag monitoring and auto-scaling signals.
// When Kafka is not enabled, estimates lag from unprocessed events in
// kafka_event_log (processed_at IS NULL).
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { isKafkaEnabled } from './kafkaClient'
import type { EventTopic } from './eventRouter'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ConsumerLagMetric {
  consumer_group: string
  topic: EventTopic | string
  partition: number
  current_offset: number
  latest_offset: number
  lag: number
  lag_ms: number          // estimated time to catch up in ms
  recorded_at: string
}

export interface BackpressureStatus {
  tenant_id: string
  total_lag: number
  critical_topics: string[]     // topics with lag > 10 000
  warning_topics: string[]      // topics with lag > 1 000
  scale_up_signal: boolean      // true if critical topics exist
  estimated_catchup_ms: number
  assessed_at: string
}

// ─── recordConsumerLag ────────────────────────────────────────────────────────

/**
 * Persists a batch of ConsumerLagMetric rows to consumer_lag_metrics table.
 * Fire-and-forget safe — never throws.
 */
export async function recordConsumerLag(metrics: ConsumerLagMetric[]): Promise<void> {
  if (metrics.length === 0) return

  try {
    const rows = metrics.map(m => ({
      tenant_id:      process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001',
      consumer_group: m.consumer_group,
      topic:          m.topic,
      partition_num:  m.partition,
      current_offset: m.current_offset,
      latest_offset:  m.latest_offset,
      lag:            m.lag,
      lag_ms:         m.lag_ms,
      recorded_at:    m.recorded_at,
    }))

    const { error } = await (supabaseAdmin as any)
      .from('consumer_lag_metrics')
      .insert(rows)

    if (error) {
      log.warn('[backpressureMonitor] recordConsumerLag failed', { error: error.message })
    }
  } catch (err) {
    log.warn('[backpressureMonitor] recordConsumerLag error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── assessBackpressure ───────────────────────────────────────────────────────

/**
 * Assesses current backpressure for a tenant.
 *
 * When Kafka IS enabled: reads the most recent consumer_lag_metrics rows for
 * the tenant (last 5 minutes) and aggregates across topics.
 *
 * When Kafka IS NOT enabled: estimates lag by counting unprocessed events in
 * kafka_event_log (processed_at IS NULL) grouped by topic.
 */
export async function assessBackpressure(tenantId: string): Promise<BackpressureStatus> {
  const assessed_at = new Date().toISOString()

  try {
    if (isKafkaEnabled()) {
      return await assessFromMetricsTable(tenantId, assessed_at)
    }

    return await assessFromEventLog(tenantId, assessed_at)
  } catch (err) {
    log.warn('[backpressureMonitor] assessBackpressure error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })

    return {
      tenant_id:            tenantId,
      total_lag:            0,
      critical_topics:      [],
      warning_topics:       [],
      scale_up_signal:      false,
      estimated_catchup_ms: 0,
      assessed_at,
    }
  }
}

// ─── Internal: assess from consumer_lag_metrics table ────────────────────────

async function assessFromMetricsTable(
  tenantId: string,
  assessed_at: string,
): Promise<BackpressureStatus> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data, error } = await (supabaseAdmin as any)
    .from('consumer_lag_metrics')
    .select('topic, lag, lag_ms')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', fiveMinutesAgo) as {
      data: Array<{ topic: string; lag: number; lag_ms: number }> | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[backpressureMonitor] assessFromMetricsTable failed', { error: error.message })
    return buildStatus(tenantId, [], assessed_at)
  }

  return buildStatus(tenantId, data ?? [], assessed_at)
}

// ─── Internal: assess from kafka_event_log unprocessed events ────────────────

async function assessFromEventLog(
  tenantId: string,
  assessed_at: string,
): Promise<BackpressureStatus> {
  // Count unprocessed events grouped by topic
  const { data, error } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('topic')
    .eq('tenant_id', tenantId)
    .is('processed_at', null) as {
      data: Array<{ topic: string }> | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[backpressureMonitor] assessFromEventLog failed', { error: error.message })
    return buildStatus(tenantId, [], assessed_at)
  }

  // Aggregate counts per topic — each unprocessed event = 1 lag unit
  const topicCounts = new Map<string, number>()
  for (const row of data ?? []) {
    topicCounts.set(row.topic, (topicCounts.get(row.topic) ?? 0) + 1)
  }

  const rows = Array.from(topicCounts.entries()).map(([topic, count]) => ({
    topic,
    lag:    count,
    lag_ms: count * 100,   // rough estimate: 100ms per unprocessed event
  }))

  return buildStatus(tenantId, rows, assessed_at)
}

// ─── Internal: build BackpressureStatus from lag rows ────────────────────────

function buildStatus(
  tenantId: string,
  rows: Array<{ topic: string; lag: number; lag_ms: number }>,
  assessed_at: string,
): BackpressureStatus {
  const CRITICAL_THRESHOLD = 10_000
  const WARNING_THRESHOLD  = 1_000

  // Dedupe: per-topic max lag (metrics table may have multiple partitions)
  const topicMaxLag = new Map<string, { lag: number; lag_ms: number }>()
  for (const row of rows) {
    const existing = topicMaxLag.get(row.topic)
    if (!existing || row.lag > existing.lag) {
      topicMaxLag.set(row.topic, { lag: row.lag, lag_ms: row.lag_ms })
    }
  }

  const critical_topics: string[] = []
  const warning_topics: string[]  = []
  let total_lag = 0
  let estimated_catchup_ms = 0

  for (const [topic, { lag, lag_ms }] of topicMaxLag.entries()) {
    total_lag            += lag
    estimated_catchup_ms += lag_ms
    if (lag > CRITICAL_THRESHOLD) critical_topics.push(topic)
    else if (lag > WARNING_THRESHOLD) warning_topics.push(topic)
  }

  return {
    tenant_id:            tenantId,
    total_lag,
    critical_topics,
    warning_topics,
    scale_up_signal:      critical_topics.length > 0,
    estimated_catchup_ms,
    assessed_at,
  }
}

// ─── getRecentLagMetrics ──────────────────────────────────────────────────────

/**
 * Returns recent ConsumerLagMetric rows from consumer_lag_metrics.
 * Defaults to the last 1 hour. Optionally filters by topic.
 */
export async function getRecentLagMetrics(
  tenantId: string,
  topic?: string,
  hours: number = 1,
): Promise<ConsumerLagMetric[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('consumer_lag_metrics')
      .select('consumer_group, topic, partition_num, current_offset, latest_offset, lag, lag_ms, recorded_at')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500)

    if (topic) query = query.eq('topic', topic)

    const { data, error } = await query as {
      data: Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

    if (error) {
      log.warn('[backpressureMonitor] getRecentLagMetrics failed', { error: error.message })
      return []
    }

    return (data ?? []).map(row => ({
      consumer_group: String(row['consumer_group'] ?? ''),
      topic:          String(row['topic'] ?? ''),
      partition:      Number(row['partition_num'] ?? 0),
      current_offset: Number(row['current_offset'] ?? 0),
      latest_offset:  Number(row['latest_offset'] ?? 0),
      lag:            Number(row['lag'] ?? 0),
      lag_ms:         Number(row['lag_ms'] ?? 0),
      recorded_at:    String(row['recorded_at'] ?? new Date().toISOString()),
    }))
  } catch (err) {
    log.warn('[backpressureMonitor] getRecentLagMetrics error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
