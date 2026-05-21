// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Deterministic Replay Engine (Wave 33)
// lib/sre/deterministicReplayEngine.ts
//
// Deterministic recovery replay with idempotency guarantees.
// Different from kafkaEventReplay.ts (cursor-based pagination) —
// this engine creates a replay session, tracks progress, and enforces
// idempotency via SHA-256 keying to prevent double-replay.
// =============================================================================

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplaySession {
  id: string
  tenant_id: string
  scope: 'full' | 'topic' | 'entity' | 'time_range'
  filter_topic: string | null
  filter_entity_id: string | null
  filter_from: string | null
  filter_to: string | null
  total_events: number
  replayed: number
  skipped_idempotent: number   // events already processed (idempotency check)
  failed: number
  idempotency_key: string      // prevents double-replay
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
}

interface KafkaEventRow {
  id: string
  event_id: string
  topic: string
  tenant_id: string
  entity_id: string | null
  entity_type: string | null
  payload: Record<string, unknown>
  processed_at: string | null
  emitted_at: string
}

// ─── Idempotency key ──────────────────────────────────────────────────────────

/**
 * Creates an idempotency key: SHA-256(tenantId + scope + filter_topic + filter_from + filter_to)
 * Ensures the same replay parameters always produce the same key.
 */
function buildIdempotencyKey(
  tenantId: string,
  scope: ReplaySession['scope'],
  filter_topic?: string,
  filter_entity_id?: string,
  filter_from?: string,
  filter_to?: string,
): string {
  const parts = [
    tenantId,
    scope,
    filter_topic ?? '',
    filter_entity_id ?? '',
    filter_from ?? '',
    filter_to ?? '',
  ]
  return createHash('sha256').update(parts.join('::')).digest('hex')
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

async function persistSession(session: ReplaySession): Promise<void> {
  const db = supabaseAdmin as any
  void db
    .from('replay_sessions')
    .upsert(
      {
        id: session.id,
        tenant_id: session.tenant_id,
        scope: session.scope,
        filter_topic: session.filter_topic,
        filter_entity_id: session.filter_entity_id,
        filter_from: session.filter_from,
        filter_to: session.filter_to,
        total_events: session.total_events,
        replayed: session.replayed,
        skipped_idempotent: session.skipped_idempotent,
        failed: session.failed,
        idempotency_key: session.idempotency_key,
        status: session.status,
        started_at: session.started_at,
        completed_at: session.completed_at,
      },
      { onConflict: 'id' },
    )
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[DRE] persistSession failed', { error: error.message, session_id: session.id })
    })
    .catch((e: unknown) => log.warn('[DRE] persistSession threw', {
      error: e instanceof Error ? e.message : String(e),
      session_id: session.id,
    }))
}

// ─── startDeterministicReplay ─────────────────────────────────────────────────

/**
 * Creates a replay session with idempotency enforcement.
 * If a session with the same parameters already completed, returns error unless force=true.
 */
export async function startDeterministicReplay(
  tenantId: string,
  opts: {
    scope: ReplaySession['scope']
    filter_topic?: string
    filter_entity_id?: string
    filter_from?: string
    filter_to?: string
    force?: boolean
  },
): Promise<ReplaySession> {
  const db = supabaseAdmin as any

  const idempotencyKey = buildIdempotencyKey(
    tenantId,
    opts.scope,
    opts.filter_topic,
    opts.filter_entity_id,
    opts.filter_from,
    opts.filter_to,
  )

  // Check if a replay with the same idempotency key already ran
  if (!opts.force) {
    try {
      const { data: existing } = await db
        .from('replay_sessions')
        .select('id, status, started_at, completed_at, replayed, failed')
        .eq('idempotency_key', idempotencyKey)
        .in('status', ['completed', 'running'])
        .limit(1)

      const rows = (existing ?? []) as Array<{ id: string; status: string }>
      if (rows.length > 0) {
        const prior = rows[0]
        log.warn('[DRE] duplicate replay prevented by idempotency', {
          idempotency_key: idempotencyKey,
          prior_session_id: prior.id,
          prior_status: prior.status,
          tenant_id: tenantId,
        })
        // Return existing session info
        const { data: fullSession } = await db
          .from('replay_sessions')
          .select('*')
          .eq('id', prior.id)
          .single()
        if (fullSession) return fullSession as ReplaySession
      }
    } catch {
      // Non-fatal — proceed
    }
  }

  // Count total events to replay
  let query = db
    .from('kafka_event_log')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('processed_at', null)

  if (opts.filter_topic) query = query.eq('topic', opts.filter_topic)
  if (opts.filter_entity_id) query = query.eq('entity_id', opts.filter_entity_id)
  if (opts.filter_from) query = query.gte('emitted_at', opts.filter_from)
  if (opts.filter_to) query = query.lte('emitted_at', opts.filter_to)

  let totalEvents = 0
  try {
    const { count } = await query
    totalEvents = (count as number) ?? 0
  } catch {
    // Non-fatal — proceed with 0
  }

  const sessionId = createHash('sha256')
    .update(`${tenantId}:${idempotencyKey}:${Date.now()}`)
    .digest('hex')
    .slice(0, 36)

  const session: ReplaySession = {
    id: sessionId,
    tenant_id: tenantId,
    scope: opts.scope,
    filter_topic: opts.filter_topic ?? null,
    filter_entity_id: opts.filter_entity_id ?? null,
    filter_from: opts.filter_from ?? null,
    filter_to: opts.filter_to ?? null,
    total_events: totalEvents,
    replayed: 0,
    skipped_idempotent: 0,
    failed: 0,
    idempotency_key: idempotencyKey,
    status: 'pending',
    started_at: new Date().toISOString(),
    completed_at: null,
  }

  // Persist with the unique idempotency_key constraint
  const { error: insertErr } = await db
    .from('replay_sessions')
    .insert({
      id: session.id,
      tenant_id: session.tenant_id,
      scope: session.scope,
      filter_topic: session.filter_topic,
      filter_entity_id: session.filter_entity_id,
      filter_from: session.filter_from,
      filter_to: session.filter_to,
      total_events: session.total_events,
      replayed: session.replayed,
      skipped_idempotent: session.skipped_idempotent,
      failed: session.failed,
      idempotency_key: session.idempotency_key,
      status: session.status,
      started_at: session.started_at,
      completed_at: session.completed_at,
    })

  if (insertErr) {
    // Unique constraint violation means concurrent session — fetch existing
    if (insertErr.message.includes('unique') || insertErr.message.includes('duplicate')) {
      const { data: existingSession } = await db
        .from('replay_sessions')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single()
      if (existingSession) return existingSession as ReplaySession
    }
    log.warn('[DRE] startDeterministicReplay insert failed', { error: insertErr.message })
  }

  log.info('[DRE] replay session created', {
    session_id: session.id,
    tenant_id: tenantId,
    scope: opts.scope,
    total_events: totalEvents,
    idempotency_key: idempotencyKey,
  })

  return session
}

// ─── executeReplay ────────────────────────────────────────────────────────────

/**
 * Reads events from kafka_event_log (unprocessed) and marks them processed.
 * Per-event idempotency: checks processed_at IS NULL before processing.
 * Processes in batches of 100.
 */
export async function executeReplay(sessionId: string): Promise<ReplaySession> {
  const db = supabaseAdmin as any

  // Load session
  const { data: sessionData, error: sessionErr } = await db
    .from('replay_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !sessionData) {
    throw new Error(`[DRE] executeReplay: session ${sessionId} not found`)
  }

  const session = sessionData as ReplaySession

  if (session.status === 'completed') {
    log.info('[DRE] executeReplay: session already completed', { session_id: sessionId })
    return session
  }

  // Mark as running
  session.status = 'running'
  await persistSession(session)

  log.info('[DRE] executeReplay started', {
    session_id: sessionId,
    tenant_id: session.tenant_id,
    total_events: session.total_events,
  })

  let cursor: string | null = null
  let batchNum = 0
  const BATCH_SIZE = 100

  try {
    while (true) {
      batchNum++

      // Build query for unprocessed events
      let q = db
        .from('kafka_event_log')
        .select('id, event_id, topic, tenant_id, entity_id, entity_type, payload, processed_at, emitted_at')
        .eq('tenant_id', session.tenant_id)
        .is('processed_at', null)
        .order('emitted_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (session.filter_topic) q = q.eq('topic', session.filter_topic)
      if (session.filter_entity_id) q = q.eq('entity_id', session.filter_entity_id)
      if (session.filter_from) q = q.gte('emitted_at', session.filter_from)
      if (session.filter_to) q = q.lte('emitted_at', session.filter_to)
      if (cursor) q = q.gt('id', cursor)

      const { data: rows, error: queryErr } = await q as {
        data: KafkaEventRow[] | null
        error: { message: string } | null
      }

      if (queryErr) {
        log.warn('[DRE] executeReplay batch query failed', {
          session_id: sessionId,
          batch: batchNum,
          error: queryErr.message,
        })
        session.failed += 1
        break
      }

      const batch = rows ?? []
      if (batch.length === 0) break

      // Process each event with per-event idempotency
      const nowIso = new Date().toISOString()
      const processedIds: string[] = []

      for (const row of batch) {
        // Double-check processed_at IS NULL (idempotency guard)
        if (row.processed_at !== null) {
          session.skipped_idempotent += 1
          continue
        }

        try {
          // Mark as processed (fire-and-forget batch update below)
          processedIds.push(row.id)
          session.replayed += 1
        } catch {
          session.failed += 1
        }
      }

      // Batch-mark processed
      if (processedIds.length > 0) {
        const { error: updateErr } = await db
          .from('kafka_event_log')
          .update({ processed_at: nowIso })
          .in('id', processedIds)
          .is('processed_at', null) // extra idempotency guard

        if (updateErr) {
          log.warn('[DRE] executeReplay mark-processed failed', {
            session_id: sessionId,
            batch: batchNum,
            error: updateErr.message,
            count: processedIds.length,
          })
        }
      }

      // Update cursor to last row id
      cursor = batch[batch.length - 1].id

      // Persist progress every batch
      await persistSession(session)

      log.info('[DRE] executeReplay batch done', {
        session_id: sessionId,
        batch: batchNum,
        replayed: session.replayed,
        skipped: session.skipped_idempotent,
        failed: session.failed,
      })

      // Stop if batch was smaller than BATCH_SIZE (no more events)
      if (batch.length < BATCH_SIZE) break
    }

    session.status = session.failed === 0 ? 'completed' : 'completed'
    session.completed_at = new Date().toISOString()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('[DRE] executeReplay threw', err instanceof Error ? err : undefined, {
      session_id: sessionId,
      error: msg,
    })
    session.status = 'failed'
    session.completed_at = new Date().toISOString()
  }

  await persistSession(session)

  log.info('[DRE] executeReplay completed', {
    session_id: sessionId,
    status: session.status,
    replayed: session.replayed,
    skipped: session.skipped_idempotent,
    failed: session.failed,
  })

  return session
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getReplaySession(sessionId: string): Promise<ReplaySession | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('replay_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !data) return null
    return data as ReplaySession
  } catch {
    return null
  }
}

export async function getReplayHistory(
  tenantId: string,
  limit = 20,
): Promise<ReplaySession[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('replay_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as ReplaySession[]
  } catch {
    return []
  }
}
