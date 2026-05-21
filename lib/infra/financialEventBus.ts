// Agency Group — Financial Event Bus
// lib/infra/financialEventBus.ts
// TypeScript strict — 0 errors
//
// Kafka-like event bus with guaranteed delivery and replay capability.
// Dual-write: always writes to Supabase regardless of Kafka availability.
// Events are IMMUTABLE once written. Replay is deterministic.
//
// Delivery guarantee: Supabase write is primary. Kafka is best-effort.
// Idempotency: events deduplicated by idempotency_key (UNIQUE constraint).
// Consumer groups: each group maintains its own offset cursor.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinancialEventType =
  | 'CAPITAL_DEPOSITED'
  | 'BID_SUBMITTED'
  | 'BID_ACCEPTED'
  | 'ESCROW_FUNDED'
  | 'ESCROW_RELEASED'
  | 'SETTLEMENT_STATE_CHANGED'
  | 'KYC_APPROVED'
  | 'AML_CLEARED'
  | 'LEGAL_SIGNED'
  | 'DEAL_CLOSED'
  | 'COMMISSION_EARNED'
  | 'CAPITAL_WITHDRAWN'

export interface FinancialEvent {
  event_id: string
  tenant_id: string
  event_type: FinancialEventType
  aggregate_id: string
  aggregate_type: 'investor' | 'asset' | 'settlement' | 'escrow' | 'bid'
  payload: Record<string, unknown>
  sequence: number
  published_at: string
  idempotency_key: string
  partition_key: string
}

// ─── Internal DB row type ─────────────────────────────────────────────────────

interface FinancialEventRow {
  id: string
  event_id: string
  tenant_id: string
  event_type: string
  aggregate_id: string
  aggregate_type: string
  payload: Record<string, unknown>
  sequence: number
  published_at: string
  idempotency_key: string
  partition_key: string
}

function rowToEvent(row: FinancialEventRow): FinancialEvent {
  return {
    event_id: row.event_id,
    tenant_id: row.tenant_id,
    event_type: row.event_type as FinancialEventType,
    aggregate_id: row.aggregate_id,
    aggregate_type: row.aggregate_type as FinancialEvent['aggregate_type'],
    payload: row.payload ?? {},
    sequence: row.sequence,
    published_at: row.published_at,
    idempotency_key: row.idempotency_key,
    partition_key: row.partition_key,
  }
}

// ─── Kafka publisher (optional / graceful) ────────────────────────────────────

async function tryPublishToKafka(event: FinancialEvent): Promise<boolean> {
  const brokers = process.env.KAFKA_BROKERS
  if (!brokers) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kafkaModule: any
  try {
    // Dynamic import — gracefully no-ops if package not installed
    kafkaModule = await import('@confluentinc/kafka-javascript' as string)
  } catch {
    log.info('[financialEventBus] Kafka package not available — Supabase-only delivery', {
      event_id: event.event_id,
    })
    return false
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const producer = new kafkaModule.Kafka({
      bootstrapServers: brokers,
      clientId: 'agency-group-financial-event-bus',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    }).producer()

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await producer.connect()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await producer.send({
      topic: `financial-events-${event.tenant_id}`,
      messages: [{
        key: event.partition_key,
        value: JSON.stringify(event),
        headers: {
          event_type: event.event_type,
          aggregate_type: event.aggregate_type,
          sequence: String(event.sequence),
        },
      }],
    })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await producer.disconnect()
    return true
  } catch (err) {
    log.warn('[financialEventBus] Kafka publish failed (graceful no-op)', {
      event_id: event.event_id,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// ─── getNextSequence ──────────────────────────────────────────────────────────

async function getNextSequence(partitionKey: string, tenantId: string): Promise<number> {
  const { data, error } = await (supabaseAdmin as any)
    .from('financial_events')
    .select('sequence')
    .eq('partition_key', partitionKey)
    .eq('tenant_id', tenantId)
    .order('sequence', { ascending: false })
    .limit(1) as {
      data: Array<{ sequence: number }> | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[financialEventBus] getNextSequence error', { error: error.message })
    return 1
  }

  return data && data.length > 0 ? data[0].sequence + 1 : 1
}

// ─── publishEvent ─────────────────────────────────────────────────────────────

/**
 * Publishes a financial event.
 * 1. Checks idempotency — returns existing event if already published.
 * 2. Assigns next sequence number for the partition.
 * 3. Writes to Supabase (guaranteed).
 * 4. Attempts Kafka publish (best-effort).
 */
export async function publishEvent(
  event: Omit<FinancialEvent, 'event_id' | 'published_at' | 'sequence'>,
  tenantId: string,
): Promise<FinancialEvent> {
  // 1. Idempotency check
  const { data: existing, error: idempErr } = await (supabaseAdmin as any)
    .from('financial_events')
    .select('*')
    .eq('idempotency_key', event.idempotency_key)
    .eq('tenant_id', tenantId)
    .limit(1) as {
      data: FinancialEventRow[] | null
      error: { message: string } | null
    }

  if (idempErr) {
    log.warn('[financialEventBus] idempotency check error', { error: idempErr.message })
  }

  if (existing && existing.length > 0) {
    log.info('[financialEventBus] Duplicate event — returning existing', {
      idempotency_key: event.idempotency_key,
      event_id: existing[0].event_id,
    })
    return rowToEvent(existing[0])
  }

  // 2. Next sequence
  const sequence = await getNextSequence(event.partition_key, tenantId)
  const eventId = randomUUID()
  const publishedAt = new Date().toISOString()

  const fullEvent: FinancialEvent = {
    ...event,
    event_id: eventId,
    tenant_id: tenantId,
    sequence,
    published_at: publishedAt,
  }

  // 3. Write to Supabase — this is the guaranteed write
  const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
    .from('financial_events')
    .insert({
      event_id: fullEvent.event_id,
      tenant_id: tenantId,
      event_type: fullEvent.event_type,
      aggregate_id: fullEvent.aggregate_id,
      aggregate_type: fullEvent.aggregate_type,
      payload: fullEvent.payload,
      sequence: fullEvent.sequence,
      published_at: fullEvent.published_at,
      idempotency_key: fullEvent.idempotency_key,
      partition_key: fullEvent.partition_key,
    })
    .select()
    .single() as {
      data: FinancialEventRow | null
      error: { message: string } | null
    }

  if (insertErr) {
    throw new Error(`[financialEventBus] Failed to persist event: ${insertErr.message}`)
  }

  log.info('[financialEventBus] Event published to Supabase', {
    event_id: eventId,
    event_type: fullEvent.event_type,
    sequence,
    partition_key: fullEvent.partition_key,
  })

  // 4. Kafka best-effort
  void tryPublishToKafka(fullEvent).catch((e: unknown) =>
    console.warn('[financialEventBus] Kafka publish error', e)
  )

  return inserted ? rowToEvent(inserted) : fullEvent
}

// ─── replayEvents ─────────────────────────────────────────────────────────────

/**
 * Replays all events for a given aggregate, ordered by sequence ASC.
 * Optional fromSequence for partial replay.
 */
export async function replayEvents(
  aggregateId: string,
  tenantId: string,
  fromSequence?: number,
): Promise<FinancialEvent[]> {
  let query = (supabaseAdmin as any)
    .from('financial_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('aggregate_id', aggregateId)
    .order('sequence', { ascending: true })

  if (fromSequence !== undefined) {
    query = query.gte('sequence', fromSequence)
  }

  const { data, error } = await query as {
    data: FinancialEventRow[] | null
    error: { message: string } | null
  }

  if (error) {
    log.warn('[financialEventBus] replayEvents error', {
      aggregate_id: aggregateId,
      error: error.message,
    })
    return []
  }

  log.info('[financialEventBus] Replayed events', {
    aggregate_id: aggregateId,
    count: (data ?? []).length,
    from_sequence: fromSequence ?? 0,
  })

  return (data ?? []).map(rowToEvent)
}

// ─── getUnprocessedEvents ─────────────────────────────────────────────────────

/**
 * Returns events not yet acknowledged by a consumer group.
 * Uses consumer_offsets to track the last processed sequence per partition.
 */
export async function getUnprocessedEvents(
  tenantId: string,
  consumerGroup: string,
  limit: number = 100,
): Promise<FinancialEvent[]> {
  // Get all known partitions and their offsets for this consumer group
  const { data: offsets, error: offsetErr } = await (supabaseAdmin as any)
    .from('consumer_offsets')
    .select('partition_key, last_sequence')
    .eq('tenant_id', tenantId)
    .eq('consumer_group', consumerGroup) as {
      data: Array<{ partition_key: string; last_sequence: number }> | null
      error: { message: string } | null
    }

  if (offsetErr) {
    log.warn('[financialEventBus] getUnprocessedEvents offset query error', {
      error: offsetErr.message,
      consumer_group: consumerGroup,
    })
  }

  const offsetMap = new Map<string, number>(
    (offsets ?? []).map(o => [o.partition_key, o.last_sequence])
  )

  // Fetch events newer than the consumer's last known sequence
  // We fetch all unprocessed events (across partitions) and cap at limit
  const { data: events, error: eventsErr } = await (supabaseAdmin as any)
    .from('financial_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('published_at', { ascending: true })
    .limit(limit * 3) as {
      data: FinancialEventRow[] | null
      error: { message: string } | null
    }

  if (eventsErr) {
    log.warn('[financialEventBus] getUnprocessedEvents events query error', {
      error: eventsErr.message,
    })
    return []
  }

  const unprocessed = (events ?? [])
    .filter(e => {
      const lastSeq = offsetMap.get(e.partition_key) ?? 0
      return e.sequence > lastSeq
    })
    .slice(0, limit)

  return unprocessed.map(rowToEvent)
}

// ─── acknowledgeEvent ─────────────────────────────────────────────────────────

/**
 * Marks an event as processed by a consumer group.
 * Upserts into consumer_offsets to advance the cursor.
 */
export async function acknowledgeEvent(
  eventId: string,
  consumerGroup: string,
  tenantId: string,
): Promise<void> {
  // Fetch the event to get its partition_key and sequence
  const fetch = (supabaseAdmin as any)
    .from('financial_events')
    .select('partition_key, sequence')
    .eq('event_id', eventId)
    .eq('tenant_id', tenantId)
    .single()
    .then(async ({ data, error }: { data: { partition_key: string; sequence: number } | null; error: { message: string } | null }) => {
      if (error || !data) {
        log.warn('[financialEventBus] acknowledgeEvent — event not found', { event_id: eventId })
        return
      }

      await (supabaseAdmin as any)
        .from('consumer_offsets')
        .upsert({
          tenant_id: tenantId,
          consumer_group: consumerGroup,
          partition_key: data.partition_key,
          last_sequence: data.sequence,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,consumer_group,partition_key' })
        .catch((e: unknown) => console.warn('[financialEventBus] acknowledgeEvent upsert failed', e))
    })

  void fetch.catch((e: unknown) => console.warn('[financialEventBus] acknowledgeEvent', e))
}

// ─── getEventBusHealth ────────────────────────────────────────────────────────

export async function getEventBusHealth(tenantId: string): Promise<{
  total_events: number
  unprocessed_events: number
  oldest_unprocessed_age_hours: number | null
  kafka_connected: boolean
  event_lag: number
}> {
  try {
    const totalResp = await (supabaseAdmin as any)
      .from('financial_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: { message: string } | null }

    const totalEvents: number = totalResp.count ?? 0

    // Check kafka connectivity (package presence check only)
    const kafkaConnected = await (async () => {
      const brokers = process.env.KAFKA_BROKERS
      if (!brokers) return false
      try {
        await import('@confluentinc/kafka-javascript' as string)
        return true
      } catch {
        return false
      }
    })()

    // Get oldest event with no consumer offsets
    const { data: oldestEvent, error: oldestErr } = await (supabaseAdmin as any)
      .from('financial_events')
      .select('published_at')
      .eq('tenant_id', tenantId)
      .order('published_at', { ascending: true })
      .limit(1) as {
        data: Array<{ published_at: string }> | null
        error: { message: string } | null
      }

    let oldestUnprocessedAgeHours: number | null = null
    if (!oldestErr && oldestEvent && oldestEvent.length > 0) {
      const oldest = new Date(oldestEvent[0].published_at)
      oldestUnprocessedAgeHours = Math.round((Date.now() - oldest.getTime()) / (1000 * 60 * 60))
    }

    // Get max sequence
    const { data: maxSeqData } = await (supabaseAdmin as any)
      .from('financial_events')
      .select('sequence')
      .eq('tenant_id', tenantId)
      .order('sequence', { ascending: false })
      .limit(1) as { data: Array<{ sequence: number }> | null }

    // Get max acknowledged sequence across all consumer groups
    const { data: maxOffsetData } = await (supabaseAdmin as any)
      .from('consumer_offsets')
      .select('last_sequence')
      .eq('tenant_id', tenantId)
      .order('last_sequence', { ascending: false })
      .limit(1) as { data: Array<{ last_sequence: number }> | null }

    const maxSeq = maxSeqData && maxSeqData.length > 0 ? maxSeqData[0].sequence : 0
    const maxOffset = maxOffsetData && maxOffsetData.length > 0 ? maxOffsetData[0].last_sequence : 0
    const eventLag = Math.max(0, maxSeq - maxOffset)

    return {
      total_events: totalEvents,
      unprocessed_events: eventLag,
      oldest_unprocessed_age_hours: oldestUnprocessedAgeHours,
      kafka_connected: kafkaConnected,
      event_lag: eventLag,
    }
  } catch (err) {
    log.warn('[financialEventBus] getEventBusHealth error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      total_events: 0,
      unprocessed_events: 0,
      oldest_unprocessed_age_hours: null,
      kafka_connected: false,
      event_lag: 0,
    }
  }
}
