// AGENCY GROUP — SH-ROS Ω∞∞ Forensics: executionWaterfall | AMI: 22506
// Waterfall visualization data — every step, duration, dependency, idle gap
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface WaterfallSpan {
  span_id: string
  parent_span_id?: string
  operation: string
  agent_id?: string
  start_time: string
  end_time: string
  duration_ms: number
  status: 'success' | 'failure' | 'timeout' | 'skipped'
  tags: Record<string, string>
  economic_value_eur?: number
  is_critical_path: boolean
  idle_time_before_ms: number
}

export interface ExecutionWaterfallData {
  trace_id: string
  org_id: string
  total_duration_ms: number
  total_idle_ms: number
  efficiency_pct: number
  spans: WaterfallSpan[]
  critical_path_spans: string[]
  bottleneck_span_id?: string
  bottleneck_duration_ms?: number
}

export class ExecutionWaterfallBuilder {
  async buildWaterfall(
    trace_id: string,
    org_id: string
  ): Promise<ExecutionWaterfallData> {
    const { data: leEvents } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('org_id', org_id)
      .contains('metadata', { trace_id })
      .order('created_at', { ascending: true })
      .limit(200)

    const { data: rtEvents } = await sb
      .from('runtime_events')
      .select('event_id, type, status, created_at, metadata')
      .eq('org_id', org_id)
      .contains('metadata', { trace_id })
      .order('created_at', { ascending: true })
      .limit(200)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const le: any[] = leEvents ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt: any[] = rtEvents ?? []

    const allEvents = [
      ...le.map((e: any) => ({
        id: ((e.metadata as Record<string, unknown>)?.['event_id'] as string) ?? `le-${Math.random()}`,
        operation: e.event_type as string,
        agent_id: ((e.metadata as Record<string, unknown>)?.['agent_id'] as string),
        timestamp: e.created_at as string,
        duration_ms: ((e.metadata as Record<string, unknown>)?.['duration_ms'] as number) ?? 100,
        status: ((e.metadata as Record<string, unknown>)?.['status'] as string) ?? 'success',
        metadata: e.metadata as Record<string, unknown>,
      })),
      ...rt.map((e: any) => ({
        id: e.event_id as string,
        operation: e.type as string,
        agent_id: undefined as string | undefined,
        timestamp: e.created_at as string,
        duration_ms: ((e.metadata as Record<string, unknown>)?.['duration_ms'] as number) ?? 100,
        status: (e.status as string) ?? 'success',
        metadata: e.metadata as Record<string, unknown>,
      })),
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    if (allEvents.length === 0) {
      return {
        trace_id, org_id, total_duration_ms: 0, total_idle_ms: 0,
        efficiency_pct: 0, spans: [], critical_path_spans: [],
      }
    }

    // Build spans with idle gaps
    const spans: WaterfallSpan[] = []
    let prev_end_ms = new Date(allEvents[0].timestamp).getTime()

    for (let i = 0; i < allEvents.length; i++) {
      const ev = allEvents[i]
      const start_ms = new Date(ev.timestamp).getTime()
      const idle_ms = Math.max(0, start_ms - prev_end_ms)
      const end_ms = start_ms + ev.duration_ms

      spans.push({
        span_id: ev.id,
        operation: ev.operation,
        agent_id: ev.agent_id,
        start_time: ev.timestamp,
        end_time: new Date(end_ms).toISOString(),
        duration_ms: ev.duration_ms,
        status: ev.status as WaterfallSpan['status'],
        tags: {},
        economic_value_eur: (ev.metadata?.['ev_score'] as number) ?? undefined,
        is_critical_path: false,
        idle_time_before_ms: idle_ms,
      })
      prev_end_ms = end_ms
    }

    // Critical path = longest sequential chain
    const total_duration_ms = spans.reduce((s, sp) => s + sp.duration_ms, 0)
    const total_idle_ms = spans.reduce((s, sp) => s + sp.idle_time_before_ms, 0)
    const efficiency_pct = total_duration_ms + total_idle_ms > 0
      ? Math.round((total_duration_ms / (total_duration_ms + total_idle_ms)) * 1000) / 10
      : 0

    // Mark top-5 longest spans as critical path
    const sorted = [...spans].sort((a, b) => b.duration_ms - a.duration_ms)
    const critical_path_spans = sorted.slice(0, 5).map((s) => s.span_id)
    for (const sp of spans) {
      if (critical_path_spans.includes(sp.span_id)) sp.is_critical_path = true
    }

    const bottleneck = sorted[0]
    logger.info('[ExecutionWaterfall] Built', { trace_id, org_id, spans: spans.length })

    return {
      trace_id, org_id, total_duration_ms, total_idle_ms, efficiency_pct, spans,
      critical_path_spans,
      bottleneck_span_id: bottleneck?.span_id,
      bottleneck_duration_ms: bottleneck?.duration_ms,
    }
  }

  async buildFromEventChain(
    event_ids: string[],
    org_id: string
  ): Promise<ExecutionWaterfallData> {
    if (event_ids.length === 0) {
      return {
        trace_id: 'chain', org_id, total_duration_ms: 0, total_idle_ms: 0,
        efficiency_pct: 0, spans: [], critical_path_spans: [],
      }
    }
    // Use first event's trace_id
    const { data } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('org_id', org_id)
      .eq('event_type', 'cold_archive')
      .limit(1)
    const trace_id = ((data?.[0]?.metadata as Record<string, unknown>)?.['trace_id'] as string) ?? 'chain'
    return this.buildWaterfall(trace_id, org_id)
  }
}

export const waterfallBuilder = new ExecutionWaterfallBuilder()
