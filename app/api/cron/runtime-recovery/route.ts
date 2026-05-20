// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Recovery Cron
// Detects and re-queues events stuck in 'processing' status > 5 minutes
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { orchestrator } from '@/lib/runtime'
import type { RuntimeEvent } from '@/lib/runtime'
import { withCronLock } from '@/lib/ops/withCronLock'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'

// Events stuck in 'processing' for > 5 minutes are considered orphaned
const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000

// Maximum number of recovery re-dispatches before an event is moved to DLQ
const MAX_RETRIES = 5

export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET or INTERNAL_API_TOKEN
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!safeCompare(secret ?? '', process.env.CRON_SECRET ?? '') && !safeCompare(secret ?? '', process.env.INTERNAL_API_TOKEN ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lockResult = await withCronLock('runtime-recovery', 2, async () => {
  const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS).toISOString()

  // Find orphaned events
  const { data: orphans, error } = await supabaseAdmin
    .from('runtime_events')
    .select('event_id, org_id, type, priority, retry_count, correlation_id, trace_id, source_system, schema_version, payload, created_at')
    .eq('status', 'processing')
    .lt('updated_at', cutoff)
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orphans || orphans.length === 0) {
    return NextResponse.json({ recovered: 0, message: 'No orphaned events found' })
  }

  const results: Array<{ event_id: string; status: string }> = []

  for (const orphan of orphans) {
    try {
      // Retry cap: events that have already been re-dispatched MAX_RETRIES times
      // are moved to DLQ instead of being re-dispatched again.
      if ((orphan.retry_count ?? 0) >= MAX_RETRIES) {
        console.warn(`[runtime-recovery] event ${orphan.event_id} exceeded MAX_RETRIES, moving to DLQ`)
        await supabaseAdmin
          .from('runtime_events')
          .update({ status: 'dlq', result: { error: 'max_retries_exceeded', moved_to_dlq_at: new Date().toISOString() } })
          .eq('event_id', orphan.event_id)
        results.push({ event_id: orphan.event_id, status: 'dlq' })
        continue
      }

      // Mark original as failed before re-queuing
      await supabaseAdmin
        .from('runtime_events')
        .update({ status: 'failed', result: { error: 'orphaned: recovered by cron', recovered_at: new Date().toISOString() } })
        .eq('event_id', orphan.event_id)

      // Re-dispatch as a new event (preserves correlation_id)
      const recoveryEvent: RuntimeEvent = {
        event_id:       crypto.randomUUID(),
        org_id:         orphan.org_id,
        type:           orphan.type as RuntimeEvent['type'],
        timestamp:      new Date().toISOString(),
        correlation_id: orphan.correlation_id,
        priority:       (orphan.priority as RuntimeEvent['priority']) ?? 'medium',
        retry_count:    (orphan.retry_count ?? 0) + 1,
        payload:        (orphan.payload ?? {}) as RuntimeEvent['payload'],
        metadata: {
          schema_version: 'vFINAL',
          trace_id:       orphan.trace_id ?? crypto.randomUUID(),
          source_system:  'engine',
        },
      }

      await orchestrator.dispatch(recoveryEvent)
      results.push({ event_id: orphan.event_id, status: 'recovered' })
    } catch (err) {
      results.push({
        event_id: orphan.event_id,
        status: `recovery_failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  return NextResponse.json({
    recovered:    results.filter(r => r.status === 'recovered').length,
    failed:       results.filter(r => r.status !== 'recovered').length,
    total_orphans: orphans.length,
    results,
    cutoff,
  })
  }) // end withCronLock

  if (lockResult === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }
  return lockResult
}
