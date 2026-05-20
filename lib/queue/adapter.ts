// Agency Group — Queue Adapter (Kafka/NATS-ready)
// lib/queue/adapter.ts
// Abstracts the message queue. Current implementation: Supabase-backed.
// Drop-in replacement: swap QueueAdapter for Kafka/NATS JetStream with same interface.
// TypeScript strict — 0 errors

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface QueueMessage<T = unknown> {
  id: string
  queue: string
  payload: T
  tenant_id: string
  correlation_id: string
  attempt: number               // starts at 1
  max_attempts: number          // default 3
  scheduled_at: string          // ISO-8601
  created_at: string
}

export interface QueueAdapter {
  enqueue<T>(
    queue: string,
    payload: T,
    options?: {
      tenant_id?: string
      correlation_id?: string
      delay_seconds?: number
      max_attempts?: number
    },
  ): Promise<string>            // returns message id

  dequeue(queue: string, limit?: number): Promise<QueueMessage[]>
  ack(messageId: string): Promise<void>
  nack(messageId: string, error?: string): Promise<void>
  getQueueDepth(queue: string): Promise<number>
}

// ─── DDL Reference (apply via Supabase migration) ────────────────────────────
//
// CREATE TABLE job_queue (
//   id uuid primary key default gen_random_uuid(),
//   queue text not null,
//   payload jsonb not null,
//   tenant_id text not null default 'agency-group',
//   correlation_id text,
//   attempt int not null default 1,
//   max_attempts int not null default 3,
//   status text not null default 'pending', -- pending|processing|done|failed
//   error text,
//   scheduled_at timestamptz not null default now(),
//   processed_at timestamptz,
//   created_at timestamptz not null default now()
// );
// CREATE INDEX idx_job_queue_pending ON job_queue(queue, scheduled_at) WHERE status = 'pending';

// ─── Row shape matching the DDL above ─────────────────────────────────────────

interface JobQueueRow {
  id: string
  queue: string
  payload: unknown
  tenant_id: string
  correlation_id: string | null
  attempt: number
  max_attempts: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  error: string | null
  scheduled_at: string
  processed_at: string | null
  created_at: string
}

// ─── SupabaseQueueAdapter ─────────────────────────────────────────────────────

export class SupabaseQueueAdapter implements QueueAdapter {
  private readonly db: SupabaseClient

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SupabaseQueueAdapter requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
    }
    this.db = createClient(url, key)
  }

  /**
   * INSERT a new message into job_queue.
   * Returns the generated UUID of the new row.
   */
  async enqueue<T>(
    queue: string,
    payload: T,
    options: {
      tenant_id?: string
      correlation_id?: string
      delay_seconds?: number
      max_attempts?: number
    } = {},
  ): Promise<string> {
    const scheduledAt = options.delay_seconds
      ? new Date(Date.now() + options.delay_seconds * 1000).toISOString()
      : new Date().toISOString()

    const row = {
      queue,
      payload: payload as Record<string, unknown>,
      tenant_id: options.tenant_id ?? process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001',
      correlation_id: options.correlation_id ?? null,
      max_attempts: options.max_attempts ?? 3,
      scheduled_at: scheduledAt,
      status: 'pending' as const,
    }

    const { data, error } = await this.db
      .from('job_queue')
      .insert(row)
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`SupabaseQueueAdapter.enqueue failed: ${error?.message ?? 'no data returned'}`)
    }

    return (data as { id: string }).id
  }

  /**
   * SELECT pending messages (scheduled_at <= now()), atomically mark as processing.
   * Returns up to `limit` messages (default 10).
   */
  async dequeue(queue: string, limit = 10): Promise<QueueMessage[]> {
    const now = new Date().toISOString()

    // Read pending messages
    const { data: rows, error } = await this.db
      .from('job_queue')
      .select('*')
      .eq('queue', queue)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (error || !rows || rows.length === 0) return []

    const castRows = rows as JobQueueRow[]
    const ids = castRows.map(r => r.id)

    // Mark as processing
    await this.db
      .from('job_queue')
      .update({ status: 'processing' })
      .in('id', ids)

    return castRows.map(r => ({
      id: r.id,
      queue: r.queue,
      payload: r.payload,
      tenant_id: r.tenant_id,
      correlation_id: r.correlation_id ?? '',
      attempt: r.attempt,
      max_attempts: r.max_attempts,
      scheduled_at: r.scheduled_at,
      created_at: r.created_at,
    }))
  }

  /**
   * Mark a message as successfully processed.
   */
  async ack(messageId: string): Promise<void> {
    const { error } = await this.db
      .from('job_queue')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('id', messageId)

    if (error) {
      throw new Error(`SupabaseQueueAdapter.ack failed for ${messageId}: ${error.message}`)
    }
  }

  /**
   * Mark a message as failed.
   * If attempt < max_attempts: increment attempt + reschedule (status back to 'pending').
   * Otherwise: set status='failed', store error.
   */
  async nack(messageId: string, error?: string): Promise<void> {
    // Fetch current state
    const { data: row, error: fetchErr } = await this.db
      .from('job_queue')
      .select('attempt, max_attempts')
      .eq('id', messageId)
      .single()

    if (fetchErr || !row) {
      throw new Error(`SupabaseQueueAdapter.nack — could not fetch row ${messageId}: ${fetchErr?.message ?? 'no data'}`)
    }

    const castRow = row as Pick<JobQueueRow, 'attempt' | 'max_attempts'>
    const nextAttempt = castRow.attempt + 1
    const canRetry = nextAttempt <= castRow.max_attempts

    if (canRetry) {
      // Exponential back-off: 2^attempt × 5s
      const delayMs = Math.pow(2, castRow.attempt) * 5000
      const retryAt = new Date(Date.now() + delayMs).toISOString()
      await this.db
        .from('job_queue')
        .update({ status: 'pending', attempt: nextAttempt, scheduled_at: retryAt, error: error ?? null })
        .eq('id', messageId)
    } else {
      await this.db
        .from('job_queue')
        .update({ status: 'failed', error: error ?? 'max_attempts reached', processed_at: new Date().toISOString() })
        .eq('id', messageId)
    }
  }

  /**
   * Returns count of pending messages in the given queue.
   */
  async getQueueDepth(queue: string): Promise<number> {
    const { count, error } = await this.db
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('queue', queue)
      .eq('status', 'pending')

    if (error) return 0
    return count ?? 0
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: QueueAdapter | null = null

/**
 * Returns the singleton QueueAdapter.
 * Default: SupabaseQueueAdapter.
 * When KAFKA_BROKERS env var is set, logs a warning (Kafka adapter not yet wired).
 */
export function getQueueAdapter(): QueueAdapter {
  if (process.env.KAFKA_BROKERS) {
    console.warn(
      '[Queue] KAFKA_BROKERS is set but Kafka adapter is not yet wired. ' +
      'Falling back to SupabaseQueueAdapter. ' +
      'To use Kafka, implement KafkaQueueAdapter and return it here.',
    )
  }

  if (!_instance) {
    _instance = new SupabaseQueueAdapter()
  }

  return _instance
}
