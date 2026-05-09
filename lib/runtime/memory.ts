// =============================================================================
// AGENCY GROUP — SH-ROS Runtime Memory v1.0
// Two-layer memory: in-process short-term + Supabase-backed long-term KPIs
// AMI: 22506 | SH-ROS Runtime Core
// =============================================================================

import type { ShortTermMemoryEntry, LongTermKPI, RuntimeEventType } from './types'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Short-Term Memory ────────────────────────────────────────────────────────
// Last 100 events per org, held in-process

class ShortTermMemory {
  private _store = new Map<string, ShortTermMemoryEntry[]>()
  private MAX_EVENTS = 100

  add(org_id: string, entry: ShortTermMemoryEntry): void {
    const existing = this._store.get(org_id) ?? []
    const updated = [...existing, entry]
    // Keep only the last MAX_EVENTS entries
    this._store.set(
      org_id,
      updated.length > this.MAX_EVENTS ? updated.slice(updated.length - this.MAX_EVENTS) : updated,
    )
  }

  get(org_id: string): ShortTermMemoryEntry[] {
    return this._store.get(org_id) ?? []
  }

  getRecent(org_id: string, limit: number): ShortTermMemoryEntry[] {
    const entries = this._store.get(org_id) ?? []
    return entries.slice(-limit)
  }

  hasRecentEvent(org_id: string, type: RuntimeEventType, withinMs: number): boolean {
    const entries = this._store.get(org_id) ?? []
    const cutoff = Date.now() - withinMs
    return entries.some(
      e => e.type === type && new Date(e.timestamp).getTime() >= cutoff,
    )
  }

  clear(org_id: string): void {
    this._store.delete(org_id)
  }
}

// ─── Long-Term Memory ─────────────────────────────────────────────────────────
// KPI aggregation against Supabase
// Note: org_id column not yet on contacts/deals/properties — queries run globally
// until migration 015 is applied and org isolation is enforced at DB layer.

class LongTermMemory {
  async getKPIs(_org_id: string, periodDays: number): Promise<LongTermKPI> {
    const since = new Date(Date.now() - periodDays * 86_400_000).toISOString()

    // Run all queries in parallel — no org_id filter until migration 015 applied
    const [contactsRes, dealsRes, metricsRes] = await Promise.all([
      // Lead count in period
      supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),

      // Active pipeline deals — valor is a formatted string (e.g. "€ 1.234.000")
      supabaseAdmin
        .from('deals')
        .select('id, fase')
        .not('fase', 'in', '("Escritura Concluída","Perdido","Rejeitado")'),

      // Last growth_metrics entry
      supabaseAdmin
        .from('growth_metrics')
        .select('viral_coefficient, cac_eur')
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const totalLeads   = contactsRes.count ?? 0
    const activeDeals  = dealsRes.data ?? []
    const pipelineSize = activeDeals.length

    const latestMetric = metricsRes.data?.[0]
    const cac: number = typeof latestMetric?.cac_eur === 'number' ? latestMetric.cac_eur : 0

    return {
      org_id:             _org_id,
      period:             `${periodDays}d`,
      total_leads:        totalLeads,
      qualified_rate:     0, // Computed from external scorer
      conversion_rate:    0, // Computed from external scorer
      avg_deal_value_eur: 0, // valor is a string — numeric AVM not available here
      pipeline_value_eur: pipelineSize * 750_000, // Rough estimate: avg deal size
      revenue_eur:        cac > 0 ? totalLeads * cac : 0,
      computed_at:        new Date().toISOString(),
    }
  }

  async getHistoricalPatterns(_org_id: string): Promise<Record<string, unknown>> {
    // growth_metrics has organization_id from migration 015 (nullable)
    const { data } = await supabaseAdmin
      .from('growth_metrics')
      .select('week_start, new_leads, new_qualified, new_clients, viral_coefficient, cac_eur')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!data || data.length === 0) return {}

    return {
      sample_count: data.length,
      latest:       data[0],
      trend:        data.slice(0, 5),
    }
  }
}

// ─── Singletons ───────────────────────────────────────────────────────────────

export const shortTermMemory = new ShortTermMemory()
export const longTermMemory  = new LongTermMemory()
