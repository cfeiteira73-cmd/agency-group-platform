// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Memory vFINAL
// HOT:  last 1000 events per org — DB-backed (runtime_events), in-process cache
// WARM: 90-day operational history — Supabase view runtime_events_warm
// AMI: 22506 | SH-ROS Production Runtime
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { ShortTermMemoryEntry, LongTermKPI } from './types'

// ─── HOT Memory ───────────────────────────────────────────────────────────────
// In-process cache of the last 1000 events per org.
// Primary source of truth is runtime_events in Supabase.
// In-process cache is a performance layer only — survives within the process,
// re-hydrated from DB on GET /api/runtime/events queries.

const HOT_LIMIT = 1_000

class HotMemory {
  private _cache = new Map<string, ShortTermMemoryEntry[]>()

  add(org_id: string, entry: ShortTermMemoryEntry): void {
    const existing = this._cache.get(org_id) ?? []
    const updated  = [...existing, entry]
    this._cache.set(
      org_id,
      updated.length > HOT_LIMIT ? updated.slice(updated.length - HOT_LIMIT) : updated,
    )
  }

  getRecent(org_id: string, limit: number): ShortTermMemoryEntry[] {
    return (this._cache.get(org_id) ?? []).slice(-Math.min(limit, HOT_LIMIT))
  }

  has(org_id: string, event_id: string): boolean {
    return (this._cache.get(org_id) ?? []).some(e => e.event_id === event_id)
  }

  clear(org_id: string): void {
    this._cache.delete(org_id)
  }
}

// ─── WARM Memory ──────────────────────────────────────────────────────────────
// Reads from Supabase runtime_events with 90-day window.
// Also aggregates KPIs from contacts, deals, growth_metrics.

class WarmMemory {

  /** Last 1000 events for org from DB (90-day window) */
  async getRecentFromDB(org_id: string, limit = 100): Promise<ShortTermMemoryEntry[]> {
    const { data } = await supabaseAdmin
      .from('runtime_events')
      .select('event_id, org_id, type, status, priority, created_at, payload, latency_ms, economic_score')
      .eq('org_id', org_id)
      .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, HOT_LIMIT))

    return (data ?? []).map(row => ({
      event_id:        row.event_id,
      org_id:          row.org_id,
      type:            row.type as ShortTermMemoryEntry['type'],
      status:          row.status as ShortTermMemoryEntry['status'],
      priority:        row.priority as ShortTermMemoryEntry['priority'],
      timestamp:       row.created_at,
      payload_summary: JSON.stringify(row.payload).slice(0, 200),
      latency_ms:      row.latency_ms,
      economic_score:  row.economic_score,
    }))
  }

  /** KPI aggregation — 90-day window (contacts, deals, growth_metrics) */
  async getKPIs(org_id: string, periodDays = 90): Promise<LongTermKPI> {
    const since = new Date(Date.now() - periodDays * 86_400_000).toISOString()

    const [contactsRes, dealsRes, metricsRes] = await Promise.all([
      supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),

      supabaseAdmin
        .from('deals')
        .select('id, fase')
        .not('fase', 'in', '("Escritura Concluída","Perdido","Rejeitado")'),

      supabaseAdmin
        .from('growth_metrics')
        .select('viral_coefficient, cac_eur, new_leads, organic_leads, paid_leads')
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const totalLeads  = contactsRes.count ?? 0
    const activeDeals = dealsRes.data?.length ?? 0
    const metric      = metricsRes.data?.[0]
    const cac: number = typeof metric?.cac_eur === 'number' ? metric.cac_eur : 0

    return {
      org_id,
      period:             `${periodDays}d`,
      total_leads:        totalLeads,
      qualified_rate:     0, // computed externally
      conversion_rate:    0, // computed externally
      avg_deal_value_eur: 0, // valor is string — requires migration 017
      pipeline_value_eur: activeDeals * 750_000,
      revenue_eur:        cac > 0 ? totalLeads * cac : 0,
      computed_at:        new Date().toISOString(),
    }
  }

  /** Runtime event throughput metrics for the last N days */
  async getEventMetrics(org_id: string, days = 7): Promise<Record<string, unknown>> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    const { data } = await supabaseAdmin
      .from('runtime_events')
      .select('type, status, latency_ms, economic_score, created_at')
      .eq('org_id', org_id)
      .gte('created_at', since)
      .limit(500)

    if (!data || data.length === 0) return { org_id, period_days: days, total: 0 }

    const byType: Record<string, number>   = {}
    const byStatus: Record<string, number> = {}
    let totalLatency = 0
    let latencyCount = 0

    for (const row of data) {
      byType[row.type]     = (byType[row.type]     ?? 0) + 1
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
      if (row.latency_ms != null) {
        totalLatency += row.latency_ms
        latencyCount++
      }
    }

    return {
      org_id,
      period_days:     days,
      total:           data.length,
      by_type:         byType,
      by_status:       byStatus,
      avg_latency_ms:  latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
      dlq_count:       byStatus['dlq'] ?? 0,
    }
  }
}

// ─── Singletons ───────────────────────────────────────────────────────────────

export const hotMemory  = new HotMemory()
export const warmMemory = new WarmMemory()

// Legacy export alias for backward compat with existing imports
export const shortTermMemory = {
  add:              hotMemory.add.bind(hotMemory),
  getRecent:        hotMemory.getRecent.bind(hotMemory),
  has:              hotMemory.has.bind(hotMemory),
  clear:            hotMemory.clear.bind(hotMemory),

  /**
   * Returns true if the org has a recent event of the given type within the
   * specified time window. Checks HOT memory cache first (fast path).
   * If the cache is empty the result is conservative false — callers should
   * not rely on this for hard deduplication; the DB unique constraint is the
   * authoritative idempotency guard.
   */
  hasRecentEvent: (org_id: string, type: string, withinMs: number): boolean => {
    const cutoff = Date.now() - withinMs
    const entries = hotMemory.getRecent(org_id, HOT_LIMIT)
    return entries.some(
      e => e.type === type && new Date(e.timestamp).getTime() >= cutoff,
    )
  },

  get: (org_id: string) => hotMemory.getRecent(org_id, HOT_LIMIT),
}

export const longTermMemory = {
  getKPIs:              warmMemory.getKPIs.bind(warmMemory),
  getHistoricalPatterns: async (_org_id: string) => warmMemory.getEventMetrics(_org_id, 30),
}
