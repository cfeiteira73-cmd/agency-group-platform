// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// POST /api/property-ai/track — fire-and-forget performance event tracking
// Events: click, save, share, inquiry, viewing_booked, scroll_50, scroll_90, time_30s, time_120s
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'
import { listingPerformanceTracker } from '@/lib/property-ai/learning'
import type { DistributionChannel } from '@/lib/property-ai/types'
import { z } from 'zod'

export const runtime = 'nodejs'

const sb = supabase as unknown as { from: (t: string) => unknown }

const VALID_CHANNELS: DistributionChannel[] = [
  'homepage','crm','email','instagram','facebook','tiktok','whatsapp','idealista','imovirtual','kyero'
]

const TrackSchema = z.object({
  submission_id: z.string().min(1),
  org_id:        z.string().min(1),
  event_type:    z.enum(['click','save','share','inquiry','viewing_booked','scroll_50','scroll_90','time_30s','time_120s']),
  channel:       z.string().refine((c) => VALID_CHANNELS.includes(c as DistributionChannel), {
    message: `channel must be one of: ${VALID_CHANNELS.join(', ')}`,
  }).default('homepage'),
  session_id:    z.string().optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = TrackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { submission_id, org_id, event_type, channel, session_id } = parsed.data

  // Persist via learning tracker (fire-and-forget — non-blocking)
  void listingPerformanceTracker.recordEvent({
    submission_id,
    org_id,
    event_type,
    channel: channel as DistributionChannel,
    session_id,
    occurred_at: new Date(),
  })

  // Also write raw event row for analytics aggregation
  void (async () => {
    try {
      const table = sb.from('property_ai_performance_events') as {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
      }
      await table.insert({
        event_id:      crypto.randomUUID(),
        submission_id,
        org_id,
        event_type,
        channel,
        session_id:    session_id ?? null,
        occurred_at:   new Date().toISOString(),
      })
    } catch (err) {
      logger.warn('[property-ai/track] raw event persist error', { submission_id, err })
    }
  })()

  logger.info('[property-ai/track] event received', { submission_id, event_type, channel })

  // Always 202 — caller is fire-and-forget
  return NextResponse.json({ ok: true, event_type, submission_id }, { status: 202 })
}
