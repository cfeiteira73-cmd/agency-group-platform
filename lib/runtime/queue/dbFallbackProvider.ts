// AGENCY GROUP — SH-ROS Queue: dbFallbackProvider | AMI: 22506
// DB-backed queue using the runtime_events Supabase table.
// Default/fallback provider — always available, fully functional.

import { supabaseAdmin } from '@/lib/supabase'
import type { RuntimeEvent } from '@/lib/runtime/types'
import { MAX_RETRIES } from '@/lib/runtime/types'
import type {
  IQueueProvider,
  QueueHealth,
  QueueMetrics,
  ReplayOptions,
} from './queueProvider'

// ─── Priority map ─────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

// ─── Internal row shape ───────────────────────────────────────────────────────

interface RuntimeEventRow {
  event_id: string
  org_id: string
  type: string
  timestamp: string
  correlation_id: string
  priority: string
  retry_count: number
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function rowToEvent(row: RuntimeEventRow): RuntimeEvent {
  return {
    event_id: row.event_id,
    org_id: row.org_id,
    type: row.type as RuntimeEvent['type'],
    timestamp: row.timestamp,
    correlation_id: row.correlation_id,
    priority: row.priority as RuntimeEvent['priority'],
    retry_count: row.retry_count,
    payload: row.payload as RuntimeEvent['payload'],
    metadata: row.metadata as RuntimeEvent['metadata'],
  }
}

// ─── DBFallbackProvider ───────────────────────────────────────────────────────

export class DBFallbackProvider implements IQueueProvider {
  private readonly PROVIDER = 'db-fallback'

  // ── enqueue ────────────────────────────────────────────────────────────────

  async enqueue(event: RuntimeEvent): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabaseAdmin as any
      const { error } = await sb.from('runtime_events').insert({
        event_id: event.event_id,
        org_id: event.org_id,
        type: event.type,
        timestamp: event.timestamp,
        correlation_id: event.correlation_id,
        priority: event.priority,
        priority_weight: PRIORITY_WEIGHT[event.priority] ?? 1,
        retry_count: event.retry_count,
        payload: event.payload,
        metadata: event.metadata,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      return event.event_id
    } catch (err) {
      console.error('[DBFallbackProvider] enqueue error:', err)
      throw err
    }
  }

  // ── dequeue ────────────────────────────────────────────────────────────────

  async dequeue(org_id: string, count = 10): Promise<RuntimeEvent[]> {
    try {
      // Fetch pending events ordered by priority weight DESC then created_at ASC
      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('*')
        .eq('org_id', org_id)
        .eq('status', 'pending')
        .order('priority_weight', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(count)

      if (error) throw error
      if (!data || data.length === 0) return []

      const ids = (data as unknown as RuntimeEventRow[]).map((r) => r.event_id)

      // Mark as processing (optimistic — best-effort, not a hard transaction)
      const { error: updateErr } = await supabaseAdmin
        .from('runtime_events')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .in('event_id', ids)
        .eq('org_id', org_id)
        .eq('status', 'pending') // guard against race

      if (updateErr) {
        console.error('[DBFallbackProvider] dequeue update error:', updateErr)
      }

      return (data as unknown as RuntimeEventRow[]).map(rowToEvent)
    } catch (err) {
      console.error('[DBFallbackProvider] dequeue error:', err)
      return []
    }
  }

  // ── ack ────────────────────────────────────────────────────────────────────

  async ack(messageId: string, org_id: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('runtime_events')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('event_id', messageId)
        .eq('org_id', org_id)

      if (error) throw error
    } catch (err) {
      console.error('[DBFallbackProvider] ack error:', err)
      throw err
    }
  }

  // ── nack ───────────────────────────────────────────────────────────────────

  async nack(messageId: string, org_id: string, reason: string): Promise<void> {
    try {
      // Fetch current retry count
      const { data, error: fetchErr } = await supabaseAdmin
        .from('runtime_events')
        .select('retry_count')
        .eq('event_id', messageId)
        .eq('org_id', org_id)
        .single()

      if (fetchErr) throw fetchErr

      const currentRetries: number = (data as { retry_count: number } | null)?.retry_count ?? 0
      const newRetryCount = currentRetries + 1
      const nextStatus = newRetryCount >= MAX_RETRIES ? 'dlq' : 'failed'

      const { error } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status: nextStatus,
          retry_count: newRetryCount,
          last_error: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', messageId)
        .eq('org_id', org_id)

      if (error) throw error
    } catch (err) {
      console.error('[DBFallbackProvider] nack error:', err)
      throw err
    }
  }

  // ── getHealth ──────────────────────────────────────────────────────────────

  async getHealth(): Promise<QueueHealth> {
    try {
      const start = Date.now()

      const { count: pendingCount, error: pendingErr } = await supabaseAdmin
        .from('runtime_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (pendingErr) throw pendingErr

      const { count: dlqCount, error: dlqErr } = await supabaseAdmin
        .from('runtime_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dlq')

      if (dlqErr) throw dlqErr

      const latency = Date.now() - start
      const lag = pendingCount ?? 0
      const dlq = dlqCount ?? 0

      let status: QueueHealth['status'] = 'healthy'
      if (lag > 1000 || latency > 2000) status = 'degraded'
      if (latency > 5000) status = 'unavailable'

      return {
        provider: this.PROVIDER,
        status,
        lag,
        dlq_count: dlq,
        latency_p50: latency,
        latency_p95: latency * 1.5,
        latency_p99: latency * 2,
      }
    } catch (err) {
      console.error('[DBFallbackProvider] getHealth error:', err)
      return {
        provider: this.PROVIDER,
        status: 'unavailable',
        lag: 0,
        dlq_count: 0,
        latency_p50: 0,
        latency_p95: 0,
        latency_p99: 0,
      }
    }
  }

  // ── getMetrics ─────────────────────────────────────────────────────────────

  async getMetrics(org_id?: string): Promise<QueueMetrics> {
    try {
      let query = supabaseAdmin.from('runtime_events').select('status', { count: 'exact' })

      if (org_id) {
        query = query.eq('org_id', org_id)
      }

      // Aggregate by status
      const statusCounts: Record<string, number> = {}
      const statuses = ['pending', 'processing', 'completed', 'failed', 'dlq'] as const

      await Promise.all(
        statuses.map(async (s) => {
          const q = org_id
            ? supabaseAdmin
                .from('runtime_events')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', org_id)
                .eq('status', s)
            : supabaseAdmin
                .from('runtime_events')
                .select('*', { count: 'exact', head: true })
                .eq('status', s)

          const { count } = await q
          statusCounts[s] = count ?? 0
        })
      )

      // Throughput: completed in last minute
      const oneMinAgo = new Date(Date.now() - 60_000).toISOString()
      const tpQuery = org_id
        ? supabaseAdmin
            .from('runtime_events')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', org_id)
            .eq('status', 'completed')
            .gte('updated_at', oneMinAgo)
        : supabaseAdmin
            .from('runtime_events')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('updated_at', oneMinAgo)

      const { count: throughput } = await tpQuery

      return {
        provider: this.PROVIDER,
        org_id,
        enqueued_total:
          (statusCounts['pending'] ?? 0) +
          (statusCounts['processing'] ?? 0) +
          (statusCounts['completed'] ?? 0) +
          (statusCounts['failed'] ?? 0) +
          (statusCounts['dlq'] ?? 0),
        dequeued_total: (statusCounts['processing'] ?? 0) + (statusCounts['completed'] ?? 0),
        ack_total: statusCounts['completed'] ?? 0,
        nack_total: (statusCounts['failed'] ?? 0) + (statusCounts['dlq'] ?? 0),
        dlq_total: statusCounts['dlq'] ?? 0,
        replay_total: 0, // tracked in-process by QueueMetricsCollector
        lag: statusCounts['pending'] ?? 0,
        throughput_per_min: throughput ?? 0,
        partition_count: 1,
        consumer_count: 1,
      }
    } catch (err) {
      console.error('[DBFallbackProvider] getMetrics error:', err)
      return {
        provider: this.PROVIDER,
        org_id,
        enqueued_total: 0,
        dequeued_total: 0,
        ack_total: 0,
        nack_total: 0,
        dlq_total: 0,
        replay_total: 0,
        lag: 0,
        throughput_per_min: 0,
        partition_count: 1,
        consumer_count: 1,
      }
    }
  }

  // ── replay ─────────────────────────────────────────────────────────────────

  async replay(opts: ReplayOptions): Promise<number> {
    try {
      if (opts.dry_run) {
        // Count without mutating
        let q = supabaseAdmin
          .from('runtime_events')
          .select('*', { count: 'exact', head: true })
          .in('status', ['failed', 'dlq'])

        if (opts.org_id) q = q.eq('org_id', opts.org_id)
        if (opts.from_timestamp) q = q.gte('timestamp', opts.from_timestamp)
        if (opts.to_timestamp) q = q.lte('timestamp', opts.to_timestamp)
        if (opts.event_types?.length) q = q.in('type', opts.event_types)

        const { count } = await q
        return count ?? 0
      }

      let q = supabaseAdmin
        .from('runtime_events')
        .select('event_id')
        .in('status', ['failed', 'dlq'])

      if (opts.org_id) q = q.eq('org_id', opts.org_id)
      if (opts.trace_id) q = q.eq('metadata->>trace_id', opts.trace_id)
      if (opts.from_timestamp) q = q.gte('timestamp', opts.from_timestamp)
      if (opts.to_timestamp) q = q.lte('timestamp', opts.to_timestamp)
      if (opts.event_types?.length) q = q.in('type', opts.event_types)
      if (opts.event_chain?.length) q = q.in('event_id', opts.event_chain)
      if (opts.limit) q = q.limit(opts.limit)

      const { data, error } = await q
      if (error) throw error
      if (!data || data.length === 0) return 0

      const ids = (data as { event_id: string }[]).map((r) => r.event_id)

      const { error: updateErr } = await supabaseAdmin
        .from('runtime_events')
        .update({
          status: 'pending',
          retry_count: 0,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .in('event_id', ids)

      if (updateErr) throw updateErr
      return ids.length
    } catch (err) {
      console.error('[DBFallbackProvider] replay error:', err)
      return 0
    }
  }

  // ── close ──────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    // Supabase client is shared — nothing to close
  }
}
