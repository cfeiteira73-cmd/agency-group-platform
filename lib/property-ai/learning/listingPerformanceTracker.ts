// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { DistributionChannel, ListingPerformance } from '@/lib/property-ai/types'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

export interface PerformanceEvent {
  event_id: string
  submission_id: string
  org_id: string
  event_type:
    | 'click'
    | 'save'
    | 'share'
    | 'inquiry'
    | 'viewing_booked'
    | 'scroll_50'
    | 'scroll_90'
    | 'time_30s'
    | 'time_120s'
  channel: DistributionChannel
  session_id?: string
  occurred_at: Date
}

const IMPRESSIONS_PER_RECORD = 10

class ListingPerformanceTracker {
  private static instance: ListingPerformanceTracker

  private constructor() {}

  static getInstance(): ListingPerformanceTracker {
    if (!ListingPerformanceTracker.instance) {
      ListingPerformanceTracker.instance = new ListingPerformanceTracker()
    }
    return ListingPerformanceTracker.instance
  }

  recordEvent(event: Omit<PerformanceEvent, 'event_id'>): Promise<void> {
    const record: PerformanceEvent = {
      ...event,
      event_id: crypto.randomUUID(),
    }

    // Fire-and-forget
    const table = sb.from('property_ai_performance_events') as {
      insert: (row: unknown) => Promise<{ error: unknown }>
    }
    table.insert(record).then(({ error }) => {
      if (error) {
        logger.error('[ListingPerformanceTracker] insert error', {
          submission_id: event.submission_id,
          event_type: event.event_type,
          error,
        })
      }
    }).catch((err) => {
      logger.error('[ListingPerformanceTracker] unexpected error', { err })
    })

    logger.info('[ListingPerformanceTracker] recorded', {
      submission_id: event.submission_id,
      event_type: event.event_type,
    })

    return Promise.resolve()
  }

  async getPerformanceSummary(
    submissionId: string,
    orgId: string,
    daysBack: number
  ): Promise<ListingPerformance> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

    const query = (sb.from('property_ai_performance_events') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => Promise<{ data: PerformanceEvent[] | null; error: unknown }>
          }
        }
      }
    })
      .select('event_type, occurred_at')
      .eq('submission_id', submissionId)
      .eq('org_id', orgId)
      .gte('occurred_at', since)

    const { data, error } = await query
    if (error) {
      logger.error('[ListingPerformanceTracker] query error', { submissionId, orgId, error })
    }

    const events: PerformanceEvent[] = (data as PerformanceEvent[]) ?? []

    const clicks = events.filter((e) => e.event_type === 'click').length
    const saves = events.filter((e) => e.event_type === 'save').length
    const shares = events.filter((e) => e.event_type === 'share').length
    const inquiries = events.filter((e) => e.event_type === 'inquiry').length
    const viewingsBooked = events.filter((e) => e.event_type === 'viewing_booked').length

    const time30s = events.filter((e) => e.event_type === 'time_30s').length
    const time120s = events.filter((e) => e.event_type === 'time_120s').length
    const avgTimeSec = events.length > 0 ? (time30s * 30 + time120s * 120) / Math.max(1, clicks) : 0

    const impressions = events.length * IMPRESSIONS_PER_RECORD
    const ctr = impressions > 0 ? clicks / impressions : 0
    const leadQuality = inquiries > 0 ? Math.min(1, (viewingsBooked / inquiries) * 10) : 0

    const periodStart = new Date(since)
    const periodEnd = new Date()

    return {
      perf_id: crypto.randomUUID(),
      submission_id: submissionId,
      org_id: orgId,
      clicks,
      saves,
      shares,
      inquiries,
      viewings_booked: viewingsBooked,
      avg_time_on_listing_s: Math.round(avgTimeSec),
      ctr: Math.round(ctr * 10000) / 10000,
      lead_quality_score: Math.round(leadQuality * 100) / 100,
      period_start: periodStart,
      period_end: periodEnd,
    }
  }
}

export const listingPerformanceTracker = ListingPerformanceTracker.getInstance()
