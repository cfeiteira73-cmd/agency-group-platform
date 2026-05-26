// Agency Group — Event Replay Engine
// lib/dr/eventReplayEngine.ts
// RPO=0 write-ahead log — every state change is a replayable event
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReplayableEventType =
  | 'OPPORTUNITY_SCORED'
  | 'INVESTOR_MATCHED'
  | 'DEAL_PACK_SENT'
  | 'CAPITAL_STAGE_ADVANCED'
  | 'LEGAL_SIGNED'
  | 'SETTLEMENT_CONFIRMED'
  | 'FEEDBACK_RECORDED'
  | 'ML_WEIGHTS_UPDATED'

export interface ReplayableEvent {
  event_id: string
  sequence_number: bigint
  tenant_id: string
  event_type: ReplayableEventType
  aggregate_id: string
  aggregate_type: string
  payload: Record<string, unknown>
  metadata: { correlation_id: string; source: string; version: string }
  occurred_at: string
  replayed: boolean
  replay_count: number
}

// ─── appendEvent ──────────────────────────────────────────────────────────────

/**
 * Core write-ahead log — append an event to `replayable_events`.
 * sequence_number is assigned by DB via DEFAULT nextval('replayable_events_seq').
 * Returns the event_id of the inserted record.
 */
export async function appendEvent(
  type: ReplayableEventType,
  aggregateId: string,
  aggregateType: string,
  payload: Record<string, unknown>,
  correlationId: string,
): Promise<string> {
  const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
  const eventId = randomUUID()

  const record = {
    event_id: eventId,
    tenant_id: TENANT_ID,
    event_type: type,
    aggregate_id: aggregateId,
    aggregate_type: aggregateType,
    payload,
    metadata: {
      correlation_id: correlationId,
      source: 'agency-group-platform',
      version: '1.0',
    },
    occurred_at: new Date().toISOString(),
    replayed: false,
    replay_count: 0,
    // sequence_number is omitted — DB assigns via nextval('replayable_events_seq')
  }

  const { error } = await (supabaseAdmin as any)
    .from('replayable_events')
    .insert(record)

  if (error) {
    log.error('[eventReplayEngine] appendEvent error', { error, type, aggregateId })
    throw new Error(`appendEvent failed: ${error.message}`)
  }

  log.info('[eventReplayEngine] Event appended', { eventId, type, aggregateId })
  return eventId
}

// ─── replayEventsFrom ─────────────────────────────────────────────────────────

/**
 * Replay events starting from a given sequence number.
 * Marks replayed events as replayed=true (fire-and-forget).
 */
export async function replayEventsFrom(
  fromSequence: bigint,
  tenantId: string,
  limit = 1000,
): Promise<ReplayableEvent[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('replayable_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('sequence_number', fromSequence.toString())
    .order('sequence_number', { ascending: true })
    .limit(limit)

  if (error) {
    log.error('[eventReplayEngine] replayEventsFrom error', { error, fromSequence: fromSequence.toString(), tenantId })
    throw new Error(`replayEventsFrom failed: ${error.message}`)
  }

  const rows: Array<Record<string, unknown>> = data ?? []

  if (rows.length === 0) return []

  // Cast sequence_number from DB string to bigint
  const events: ReplayableEvent[] = rows.map((row) => ({
    event_id: String(row.event_id ?? ''),
    sequence_number: BigInt(String(row.sequence_number ?? '0')),
    tenant_id: String(row.tenant_id ?? ''),
    event_type: row.event_type as ReplayableEventType,
    aggregate_id: String(row.aggregate_id ?? ''),
    aggregate_type: String(row.aggregate_type ?? ''),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    metadata: (row.metadata ?? {
      correlation_id: '',
      source: '',
      version: '',
    }) as { correlation_id: string; source: string; version: string },
    occurred_at: String(row.occurred_at ?? ''),
    replayed: Boolean(row.replayed),
    replay_count: Number(row.replay_count ?? 0),
  }))

  const eventIds = events.map((e) => e.event_id)

  // Fire-and-forget: mark as replayed and increment replay_count
  void (supabaseAdmin as any)
    .from('replayable_events')
    .select('event_id, replay_count')
    .in('event_id', eventIds)
    .then(
      async ({
        data: fetchedRows,
        error: fetchErr,
      }: {
        data: Array<{ event_id: string; replay_count: number }> | null
        error: unknown
      }) => {
        if (fetchErr || !fetchedRows) return
        for (const row of fetchedRows) {
          void (supabaseAdmin as any)
            .from('replayable_events')
            .update({ replayed: true, replay_count: (row.replay_count ?? 0) + 1 })
            .eq('event_id', row.event_id)
            .catch((e: unknown) => log.warn('[eventReplayEngine] replay_count update failed', { e }))
        }
      },
    )
    .catch((e: unknown) => log.warn('[eventReplayEngine] replay mark fetch failed', { e }))

  log.info('[eventReplayEngine] Events replayed', {
    count: events.length,
    fromSequence: fromSequence.toString(),
    tenantId,
  })
  return events
}

// ─── getReplayPosition ────────────────────────────────────────────────────────

export async function getReplayPosition(tenantId: string): Promise<{
  last_sequence: bigint
  total_events: bigint
  oldest_event: string
  newest_event: string
}> {
  const { data, error } = await (supabaseAdmin as any)
    .from('replayable_events')
    .select('sequence_number, occurred_at')
    .eq('tenant_id', tenantId)
    .order('sequence_number', { ascending: true })

  if (error) {
    log.warn('[eventReplayEngine] getReplayPosition error', { error, tenantId })
    return {
      last_sequence: BigInt(0),
      total_events: BigInt(0),
      oldest_event: new Date().toISOString(),
      newest_event: new Date().toISOString(),
    }
  }

  const rows: Array<{ sequence_number: unknown; occurred_at: string }> = data ?? []
  if (rows.length === 0) {
    return {
      last_sequence: BigInt(0),
      total_events: BigInt(0),
      oldest_event: new Date().toISOString(),
      newest_event: new Date().toISOString(),
    }
  }

  const lastRow = rows[rows.length - 1]
  const firstRow = rows[0]

  return {
    last_sequence: BigInt(String(lastRow.sequence_number ?? '0')),
    total_events: BigInt(rows.length),
    oldest_event: firstRow.occurred_at,
    newest_event: lastRow.occurred_at,
  }
}

// ─── computeRpo ───────────────────────────────────────────────────────────────

export async function computeRpo(tenantId: string): Promise<{
  rpo_minutes: number
  last_event_at: string
  events_in_last_hour: number
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [latestRes, countRes] = await Promise.all([
    (supabaseAdmin as any)
      .from('replayable_events')
      .select('occurred_at')
      .eq('tenant_id', tenantId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle(),

    (supabaseAdmin as any)
      .from('replayable_events')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('occurred_at', oneHourAgo),
  ])

  const lastEventAt: string = latestRes.data?.occurred_at ?? new Date().toISOString()
  const lagMs = Date.now() - new Date(lastEventAt).getTime()
  const lagMinutes = lagMs / 60_000

  // RPO = 0 if last event is within 1 minute
  const rpoMinutes = lagMinutes <= 1 ? 0 : Math.round(lagMinutes)
  const eventsInLastHour: number = countRes.count ?? 0

  return {
    rpo_minutes: rpoMinutes,
    last_event_at: lastEventAt,
    events_in_last_hour: eventsInLastHour,
  }
}
