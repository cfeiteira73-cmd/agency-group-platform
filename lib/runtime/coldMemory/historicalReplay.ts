// AGENCY GROUP — SH-ROS Cold Memory: historicalReplay | AMI: 22506
import { supabaseAdmin } from '@/lib/supabase'

export interface SimulationResult {
  events_count: number
  agents_would_trigger: number
  estimated_revenue_impact_eur: number
  dry_run: boolean
  period: { from: string; to: string }
}

export interface ReplayPeriodResult {
  replayed: number
  errors: number
  skipped_duplicates: number
  duration_ms: number
}

export class HistoricalReplayEngine {
  async simulate(org_id: string, from: string, to: string, dry_run = true): Promise<SimulationResult> {
    try {
      const { data: events } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, type, agents_triggered, economic_score')
        .eq('org_id', org_id)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(500)

      const evts = events ?? []
      const agentsWouldTrigger = evts.reduce(
        (s, e) => s + ((e.agents_triggered as string[] | null)?.length ?? 0), 0,
      )
      const estimatedRevenue = evts.reduce(
        (s, e) => s + (typeof e.economic_score === 'number' ? Math.max(0, e.economic_score) : 0), 0,
      )

      if (!dry_run) {
        await supabaseAdmin.from('learning_events').insert({
          event_type:    'historical_simulation',
          source_system: 'agent',
          metadata:      { org_id, from, to, events_count: evts.length, dry_run },
        })
      }

      return {
        events_count:                  evts.length,
        agents_would_trigger:          agentsWouldTrigger,
        estimated_revenue_impact_eur:  Math.round(estimatedRevenue),
        dry_run,
        period: { from, to },
      }
    } catch (err) {
      console.warn('[HistoricalReplayEngine] simulate failed:', err instanceof Error ? err.message : String(err))
      return { events_count: 0, agents_would_trigger: 0, estimated_revenue_impact_eur: 0, dry_run, period: { from, to } }
    }
  }

  async replayPeriod(org_id: string, from: string, to: string): Promise<ReplayPeriodResult> {
    const startMs = Date.now()
    let replayed = 0, errors = 0, skippedDuplicates = 0

    try {
      const { data: events } = await supabaseAdmin
        .from('runtime_events')
        .select('event_id, type, status')
        .eq('org_id', org_id)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(200)

      for (const evt of events ?? []) {
        try {
          if (evt.status === 'completed') { skippedDuplicates++; continue }
          await supabaseAdmin
            .from('runtime_events')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('event_id', evt.event_id)
          replayed++
        } catch { errors++ }
      }
    } catch (err) {
      console.warn('[HistoricalReplayEngine] replayPeriod failed:', err instanceof Error ? err.message : String(err))
    }

    return { replayed, errors, skipped_duplicates: skippedDuplicates, duration_ms: Date.now() - startMs }
  }
}

export const historicalReplayEngine = new HistoricalReplayEngine()
