// =============================================================================
// Agency Group — Event Archival Service
// lib/backup/eventArchivalService.ts
//
// Archives Kafka events to Supabase Storage as immutable JSONL files.
// Uses ml-training-data bucket with path prefix events/ as the S3 equivalent.
//
// Table: event_archive_log (see migration 20260522000029)
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArchivalRun {
  id: string
  tenant_id: string
  topic: string | null
  events_archived: number
  events_failed: number
  archive_path: string
  size_bytes: number
  from_timestamp: string
  to_timestamp: string
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  error_message: string | null
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 500
const EVENTS_BUCKET = 'ml-training-data'

// ---------------------------------------------------------------------------
// archiveEvents
// Archives unprocessed events from kafka_event_log to Supabase Storage.
// Partition path: /events/{YYYY}/{MM}/{DD}/{topic}/
// Format: JSONL (one JSON object per line)
// After archival: marks events as processed in kafka_event_log
// ---------------------------------------------------------------------------

export async function archiveEvents(
  tenantId: string,
  opts?: {
    topic?: string
    from?: string
    to?: string
    batch_size?: number
  },
): Promise<ArchivalRun> {
  const db = supabaseAdmin as any
  const id = randomUUID()
  const startedAt = new Date().toISOString()

  const toTs = opts?.to ?? new Date().toISOString()
  const fromTs =
    opts?.from ??
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const batchSize = opts?.batch_size ?? DEFAULT_BATCH_SIZE
  const topic = opts?.topic ?? null

  // Compute archive path from toTs date
  const dateTag = toTs.slice(0, 10).replace(/-/g, '/')
  const topicSlug = topic ?? 'all'
  const archivePath = `events/${dateTag}/${topicSlug}/events-${id}.jsonl`

  // Insert running record
  const runningRecord: ArchivalRun = {
    id,
    tenant_id: tenantId,
    topic,
    events_archived: 0,
    events_failed: 0,
    archive_path: archivePath,
    size_bytes: 0,
    from_timestamp: fromTs,
    to_timestamp: toTs,
    status: 'running',
    started_at: startedAt,
    completed_at: null,
    error_message: null,
  }

  void (db as any)
    .from('event_archive_log')
    .insert({
      id,
      tenant_id: tenantId,
      topic,
      events_archived: 0,
      events_failed: 0,
      archive_path: archivePath,
      size_bytes: 0,
      from_timestamp: fromTs,
      to_timestamp: toTs,
      status: 'running',
      started_at: startedAt,
      completed_at: null,
      error_message: null,
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.warn('[eventArchivalService] archiveEvents — insert running record failed', { id, error: e.message } as any)
    })

  let eventsArchived = 0
  let eventsFailed = 0
  let sizeBytes = 0
  let errorMessage: string | null = null
  let finalStatus: 'completed' | 'failed' = 'completed'

  try {
    // 1. Fetch unprocessed events from kafka_event_log
    let query = (db as any)
      .from('kafka_event_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', fromTs)
      .lte('created_at', toTs)
      .limit(batchSize)

    if (topic) {
      query = query.eq('topic', topic)
    }

    // Try both possible "not yet archived" patterns
    try {
      query = query.eq('archived', false)
    } catch {
      // column may not exist — fall through
    }

    const { data: events, error: fetchErr } = await query

    if (fetchErr) {
      // kafka_event_log may not exist yet — treat as 0 events
      if (
        fetchErr.message?.toLowerCase().includes('does not exist') ||
        fetchErr.message?.toLowerCase().includes('relation') ||
        fetchErr.code === '42P01'
      ) {
        log.info('[eventArchivalService] archiveEvents — kafka_event_log not found, skipping', {
          tenantId,
        } as any)
      } else {
        throw new Error(`fetch kafka_event_log: ${fetchErr.message}`)
      }
    }

    const rows: Array<Record<string, unknown>> = (events ?? []) as Array<Record<string, unknown>>

    if (rows.length > 0) {
      // 2. Serialize to JSONL
      const jsonl = rows.map(r => JSON.stringify(r)).join('\n')
      const content = new Blob([jsonl], { type: 'application/x-ndjson' })
      sizeBytes = jsonl.length

      // 3. Upload to Supabase Storage
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(EVENTS_BUCKET)
        .upload(archivePath, content, {
          contentType: 'application/x-ndjson',
          upsert: false,
        })

      if (uploadErr) {
        // If file already exists (duplicate run) treat as soft error
        if (uploadErr.message?.toLowerCase().includes('already exists') ||
            uploadErr.message?.toLowerCase().includes('duplicate')) {
          log.warn('[eventArchivalService] archiveEvents — archive file already exists', {
            archivePath,
          } as any)
        } else {
          throw new Error(`storage upload: ${uploadErr.message}`)
        }
      }

      eventsArchived = rows.length

      // 4. Mark events as archived/processed (best-effort)
      const ids = rows
        .map(r => r['id'])
        .filter((v): v is string => typeof v === 'string')

      if (ids.length > 0) {
        void (db as any)
          .from('kafka_event_log')
          .update({ archived: true, archived_at: new Date().toISOString() })
          .in('id', ids)
          .then(({ error: markErr }: { error: { message: string } | null }) => {
            if (markErr) {
              log.warn('[eventArchivalService] archiveEvents — mark-archived failed', {
                id,
                error: markErr.message,
              } as any)
            }
          })
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    finalStatus = 'failed'
    eventsFailed = 1
    log.error(
      '[eventArchivalService] archiveEvents — error',
      err instanceof Error ? err : undefined,
      { id, tenantId, error: errorMessage }
    )
  }

  const completedAt = new Date().toISOString()

  // 5. Update archive log record
  void (db as any)
    .from('event_archive_log')
    .update({
      events_archived: eventsArchived,
      events_failed: eventsFailed,
      size_bytes: sizeBytes,
      status: finalStatus,
      completed_at: completedAt,
      error_message: errorMessage,
    })
    .eq('id', id)
    .then(({ error: upErr }: { error: { message: string } | null }) => {
      if (upErr) {
        log.warn('[eventArchivalService] archiveEvents — update failed', {
          id,
          error: upErr.message,
        } as any)
      }
    })

  log.info('[eventArchivalService] archiveEvents — complete', {
    id,
    status: finalStatus,
    events_archived: eventsArchived,
    size_bytes: sizeBytes,
    archive_path: archivePath,
  } as any)

  return {
    ...runningRecord,
    events_archived: eventsArchived,
    events_failed: eventsFailed,
    size_bytes: sizeBytes,
    status: finalStatus,
    completed_at: completedAt,
    error_message: errorMessage,
  }
}

// ---------------------------------------------------------------------------
// getArchivalHistory
// ---------------------------------------------------------------------------

export async function getArchivalHistory(
  tenantId: string,
  limit = 30,
): Promise<ArchivalRun[]> {
  const db = supabaseAdmin as any

  const { data, error } = await db
    .from('event_archive_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.warn('[eventArchivalService] getArchivalHistory — query failed', {
      tenantId,
      error: error.message,
    } as any)
    return []
  }

  return (data ?? []) as ArchivalRun[]
}

// ---------------------------------------------------------------------------
// listArchiveFiles
// Lists archive files in storage for a given date (format: YYYY-MM-DD)
// ---------------------------------------------------------------------------

export async function listArchiveFiles(
  tenantId: string,
  date: string,
): Promise<string[]> {
  // path pattern: events/{YYYY}/{MM}/{DD}/
  const datePath = date.replace(/-/g, '/')
  const prefix = `events/${datePath}`

  const { data, error } = await supabaseAdmin.storage
    .from(EVENTS_BUCKET)
    .list(prefix)

  if (error) {
    log.warn('[eventArchivalService] listArchiveFiles — storage list failed', {
      tenantId,
      date,
      prefix,
      error: error.message,
    } as any)
    return []
  }

  return (data ?? []).map(f => `${prefix}/${f.name}`)
}

// ---------------------------------------------------------------------------
// replayFromArchive
// Downloads and parses JSONL events from an archive file in Supabase Storage.
// ---------------------------------------------------------------------------

export async function replayFromArchive(
  tenantId: string,
  archivePath: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabaseAdmin.storage
    .from(EVENTS_BUCKET)
    .download(archivePath)

  if (error || !data) {
    log.warn('[eventArchivalService] replayFromArchive — download failed', {
      tenantId,
      archivePath,
      error: error?.message,
    } as any)
    return []
  }

  try {
    const text = await (data as Blob).text()
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    return lines.map(line => JSON.parse(line) as Record<string, unknown>)
  } catch (parseErr) {
    log.warn('[eventArchivalService] replayFromArchive — parse failed', {
      tenantId,
      archivePath,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    } as any)
    return []
  }
}
