// Agency Group — Event Stream Healer
// lib/healing/eventStreamHealer.ts
// TypeScript strict — 0 errors
//
// Detects and heals orphan events, lost events, and replay gaps.
// SAFE: Only archives/reprocesses events — never deletes financial records
// Healing actions: archive orphans, trigger replay for gaps, flag for human review

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventHealingReport {
  healing_id: string
  tenant_id: string

  diagnosis: {
    orphan_events: number           // events with no consumer acknowledgment > 30min
    replay_gaps: number             // gaps in event sequence
    stale_pending_replays: number   // replay jobs pending > 1 hour
    duplicate_events: number        // same event_id appearing twice
  }

  actions_taken: {
    action: 'archive_orphan' | 'trigger_replay' | 'flag_for_review' | 'deduplicate'
    count: number
    details: string
    audit_entry_created: boolean
  }[]

  healing_status: 'healed' | 'partial' | 'manual_required'
  requires_human_review: string[]  // financial state issues — never auto-fixed

  executed_at: string
}

// ─── detectEventAnomalies ─────────────────────────────────────────────────────

/**
 * Queries kafka_event_log and event_replay_log to detect anomalies.
 */
export async function detectEventAnomalies(
  tenantId: string,
): Promise<EventHealingReport['diagnosis']> {
  const cutoff30m = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const cutoff1h  = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Orphan events: unprocessed for > 30 minutes
  const { count: orphanCount } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('processed_at', null)
    .lt('emitted_at', cutoff30m)

  // Stale pending replays: still pending after 1 hour
  const { count: staleReplayCount } = await (supabaseAdmin as any)
    .from('event_replay_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .lt('created_at', cutoff1h)

  // Replay gaps: failed replay jobs
  const { count: gapCount } = await (supabaseAdmin as any)
    .from('event_replay_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'failed')

  // Duplicate events: event_ids appearing more than once
  // We approximate by counting total rows vs distinct event_ids
  const { count: totalEvents } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { data: distinctData } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('event_id')
    .eq('tenant_id', tenantId)
    .limit(5000)

  const distinctCount = distinctData
    ? new Set((distinctData as { event_id: string }[]).map(r => r.event_id)).size
    : 0

  const totalEventsNum  = typeof totalEvents === 'number' ? totalEvents : 0
  const duplicateEvents = Math.max(0, totalEventsNum - distinctCount)

  return {
    orphan_events:          typeof orphanCount === 'number' ? orphanCount : 0,
    replay_gaps:            typeof gapCount === 'number' ? gapCount : 0,
    stale_pending_replays:  typeof staleReplayCount === 'number' ? staleReplayCount : 0,
    duplicate_events:       duplicateEvents,
  }
}

// ─── healOrphanEvents ─────────────────────────────────────────────────────────

/**
 * Archives orphan events (unprocessed > 30 min) by marking processed_at.
 * SAFE: Never deletes — only marks events as processed.
 * RULE: Events related to capital_execution or settlement_completed → flag_for_review only.
 */
export async function healOrphanEvents(
  tenantId: string,
  dryRun = false,
): Promise<{ archived: number; skipped: number }> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  // Fetch orphan events
  const { data: orphans, error: fetchError } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .select('id, event_id, topic, emitted_at')
    .eq('tenant_id', tenantId)
    .is('processed_at', null)
    .lt('emitted_at', cutoff)
    .limit(500)

  if (fetchError || !orphans) {
    log.warn('[eventStreamHealer] healOrphanEvents fetch error', {
      error: fetchError?.message,
      tenant_id: tenantId,
    })
    return { archived: 0, skipped: 0 }
  }

  const financialTopics = ['capital_execution', 'settlement_completed']

  const safeToArchive = (orphans as { id: string; topic: string }[]).filter(
    e => !financialTopics.some(t => e.topic?.includes(t)),
  )
  const skipped = orphans.length - safeToArchive.length

  if (dryRun || safeToArchive.length === 0) {
    return { archived: 0, skipped }
  }

  const ids = safeToArchive.map((e: { id: string }) => e.id)
  const { count, error: updateError } = await (supabaseAdmin as any)
    .from('kafka_event_log')
    .update({ processed_at: new Date().toISOString() })
    .in('id', ids)
    .select('*', { count: 'exact', head: true })

  if (updateError) {
    log.warn('[eventStreamHealer] healOrphanEvents update error', {
      error: updateError.message,
      tenant_id: tenantId,
    })
    return { archived: 0, skipped }
  }

  const archived = typeof count === 'number' ? count : safeToArchive.length

  log.info('[eventStreamHealer] archived orphan events', {
    archived,
    skipped,
    tenant_id: tenantId,
  })

  return { archived, skipped }
}

// ─── triggerReplayForGaps ─────────────────────────────────────────────────────

/**
 * Detects failed/stale replay jobs and re-triggers them by inserting new entries
 * into event_replay_log.
 */
export async function triggerReplayForGaps(
  tenantId: string,
): Promise<{ gaps_found: number; replays_triggered: number }> {
  const { data: failedReplays, error } = await (supabaseAdmin as any)
    .from('event_replay_log')
    .select('id, topic, entity_id, filter_from, filter_to')
    .eq('tenant_id', tenantId)
    .in('status', ['failed'])
    .limit(50)

  if (error || !failedReplays) {
    log.warn('[eventStreamHealer] triggerReplayForGaps fetch error', {
      error: error?.message,
      tenant_id: tenantId,
    })
    return { gaps_found: 0, replays_triggered: 0 }
  }

  const gapsFound = failedReplays.length
  if (gapsFound === 0) return { gaps_found: 0, replays_triggered: 0 }

  type ReplayRow = {
    topic: string | null
    entity_id: string | null
    filter_from: string | null
    filter_to: string | null
  }

  const newEntries = (failedReplays as ReplayRow[]).map(r => ({
    id:          randomUUID(),
    tenant_id:   tenantId,
    topic:       r.topic,
    entity_id:   r.entity_id,
    filter_from: r.filter_from,
    filter_to:   r.filter_to,
    status:      'pending',
    triggered_by: 'event_stream_healer',
    created_at:  new Date().toISOString(),
  }))

  const { count: insertedCount, error: insertError } = await (supabaseAdmin as any)
    .from('event_replay_log')
    .insert(newEntries)
    .select('*', { count: 'exact', head: true })

  if (insertError) {
    log.warn('[eventStreamHealer] triggerReplayForGaps insert error', {
      error: insertError.message,
      tenant_id: tenantId,
    })
    return { gaps_found: gapsFound, replays_triggered: 0 }
  }

  const triggered = typeof insertedCount === 'number' ? insertedCount : newEntries.length

  log.info('[eventStreamHealer] replay gaps triggered', {
    gaps_found: gapsFound,
    replays_triggered: triggered,
    tenant_id: tenantId,
  })

  return { gaps_found: gapsFound, replays_triggered: triggered }
}

// ─── runEventStreamHealing ────────────────────────────────────────────────────

/**
 * Master event stream healing run.
 * RULE: capital_execution / settlement_completed events → flag_for_review only.
 */
export async function runEventStreamHealing(
  tenantId: string,
  dryRun = false,
): Promise<EventHealingReport> {
  const healingId  = randomUUID()
  const executedAt = new Date().toISOString()

  log.info('[eventStreamHealer] starting healing run', { tenant_id: tenantId, dry_run: dryRun })

  const diagnosis = await detectEventAnomalies(tenantId)

  const actionsTaken: EventHealingReport['actions_taken'] = []
  const requiresHumanReview: string[] = []

  // 1. Archive orphan events
  if (diagnosis.orphan_events > 0) {
    const { archived, skipped } = await healOrphanEvents(tenantId, dryRun)

    actionsTaken.push({
      action:               'archive_orphan',
      count:                archived,
      details:              dryRun
        ? `dry_run: would archive up to ${diagnosis.orphan_events} orphans (skipped ${skipped} financial)`
        : `archived ${archived} orphan events, skipped ${skipped} financial events`,
      audit_entry_created:  false,
    })

    if (skipped > 0) {
      requiresHumanReview.push(
        `${skipped} orphan financial events (capital_execution/settlement_completed) require manual review`,
      )
    }
  }

  // 2. Trigger replays for gaps
  if (diagnosis.replay_gaps > 0) {
    const { gaps_found, replays_triggered } = await triggerReplayForGaps(tenantId)

    actionsTaken.push({
      action:               'trigger_replay',
      count:                replays_triggered,
      details:              `found ${gaps_found} replay gaps, triggered ${replays_triggered} new replays`,
      audit_entry_created:  false,
    })
  }

  // 3. Flag stale pending replays for review
  if (diagnosis.stale_pending_replays > 0) {
    requiresHumanReview.push(
      `${diagnosis.stale_pending_replays} replay jobs pending > 1 hour require investigation`,
    )

    actionsTaken.push({
      action:               'flag_for_review',
      count:                diagnosis.stale_pending_replays,
      details:              'stale replay jobs flagged for human review',
      audit_entry_created:  false,
    })
  }

  // 4. Flag duplicates
  if (diagnosis.duplicate_events > 0) {
    requiresHumanReview.push(
      `${diagnosis.duplicate_events} duplicate event_ids detected — deduplicate manually`,
    )

    actionsTaken.push({
      action:               'deduplicate',
      count:                diagnosis.duplicate_events,
      details:              'duplicate events flagged for human deduplication',
      audit_entry_created:  false,
    })
  }

  const healingStatus: EventHealingReport['healing_status'] =
    requiresHumanReview.length > 0 && actionsTaken.some(a => a.count > 0)
      ? 'partial'
      : requiresHumanReview.length > 0
      ? 'manual_required'
      : 'healed'

  const report: EventHealingReport = {
    healing_id:           healingId,
    tenant_id:            tenantId,
    diagnosis,
    actions_taken:        actionsTaken,
    healing_status:       healingStatus,
    requires_human_review: requiresHumanReview,
    executed_at:          executedAt,
  }

  // Persist run
  void (supabaseAdmin as any)
    .from('event_healing_runs')
    .insert({
      id:                    healingId,
      tenant_id:             tenantId,
      diagnosis,
      actions_taken:         actionsTaken,
      healing_status:        healingStatus,
      requires_human_review: requiresHumanReview,
      executed_at:           executedAt,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[eventStreamHealer] persist error', { error: error.message })
    })

  log.info('[eventStreamHealer] healing run complete', {
    healing_id:    healingId,
    status:        healingStatus,
    human_review:  requiresHumanReview.length,
    tenant_id:     tenantId,
  })

  return report
}
