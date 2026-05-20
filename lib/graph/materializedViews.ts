// =============================================================================
// Agency Group — Graph Materialized Views Engine
// lib/graph/materializedViews.ts
//
// Queries pre-computed materialized views for fast graph intelligence.
// Views are refreshed every 30 min via /api/cron/refresh-graph-views.
//
// Materialized views (DDL run separately):
//   mv_agent_revenue     — pre-aggregated agent → revenue by tenant
//   mv_deal_flow_paths   — correlation_id → step sequence → duration
//   mv_tenant_graph_stats — tenant-level KPIs
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentRevenueMV {
  tenant_id:        string
  agent_id:         string
  deal_count:       number
  total_revenue:    number
  avg_revenue:      number
  success_rate:     number
  last_activity:    string
}

export interface DealFlowPathMV {
  tenant_id:          string
  correlation_id:     string
  flow_path:          string    // e.g. 'lead_created → match_created → deal_closed'
  step_count:         number
  total_revenue:      number
  fully_successful:   boolean
  started_at:         string
  completed_at:       string
  duration_seconds:   number
}

export interface TenantGraphStatsMV {
  tenant_id:             string
  total_deals:           number
  active_agents:         number
  total_revenue:         number
  avg_deal_revenue:      number
  overall_success_rate:  number
  last_activity:         string
}

export interface GraphIntelligenceReport {
  tenant_id:         string
  generated_at:      string
  agent_revenue:     AgentRevenueMV[]
  top_deal_paths:    DealFlowPathMV[]
  tenant_stats:      TenantGraphStatsMV | null
  insights:          string[]
}

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── Query functions ──────────────────────────────────────────────────────────

export async function getAgentRevenueMV(
  tenantId: string,
  limit = 20,
): Promise<AgentRevenueMV[]> {
  try {
    const db = getDb()
    const { data, error } = await db
      .from('mv_agent_revenue')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('total_revenue', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as unknown as AgentRevenueMV[]
  } catch { return [] }
}

export async function getDealFlowPathsMV(
  tenantId: string,
  limit = 10,
  minRevenue = 0,
): Promise<DealFlowPathMV[]> {
  try {
    const db = getDb()
    let q = db
      .from('mv_deal_flow_paths')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('total_revenue', { ascending: false })
      .limit(limit)

    if (minRevenue > 0) {
      q = q.gte('total_revenue', minRevenue)
    }

    const { data, error } = await q
    if (error || !data) return []
    return data as unknown as DealFlowPathMV[]
  } catch { return [] }
}

export async function getTenantGraphStatsMV(tenantId: string): Promise<TenantGraphStatsMV | null> {
  try {
    const db = getDb()
    const { data, error } = await db
      .from('mv_tenant_graph_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) return null
    return data as unknown as TenantGraphStatsMV
  } catch { return null }
}

// Top N deal paths by frequency (not revenue) — for pattern detection
export async function getTopDealPatterns(
  tenantId: string,
  topN = 5,
): Promise<{ flow_path: string; count: number; total_revenue: number }[]> {
  try {
    const db = getDb()
    const { data } = await db
      .from('mv_deal_flow_paths')
      .select('flow_path, total_revenue')
      .eq('tenant_id', tenantId)
      .not('flow_path', 'is', null)
      .limit(200)

    if (!data) return []

    // Group by flow_path
    const pathMap = new Map<string, { count: number; revenue: number }>()
    for (const row of data as { flow_path: string; total_revenue: number }[]) {
      const existing = pathMap.get(row.flow_path) ?? { count: 0, revenue: 0 }
      pathMap.set(row.flow_path, {
        count:   existing.count + 1,
        revenue: existing.revenue + (row.total_revenue ?? 0),
      })
    }

    return Array.from(pathMap.entries())
      .map(([flow_path, v]) => ({ flow_path, count: v.count, total_revenue: v.revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
  } catch { return [] }
}

// ─── Full intelligence report ─────────────────────────────────────────────────

export async function getGraphIntelligenceReport(tenantId: string): Promise<GraphIntelligenceReport> {
  const [agentRevenue, dealPaths, tenantStats, topPatterns] = await Promise.all([
    getAgentRevenueMV(tenantId, 10),
    getDealFlowPathsMV(tenantId, 10),
    getTenantGraphStatsMV(tenantId),
    getTopDealPatterns(tenantId, 5),
  ])

  const insights: string[] = []

  if (tenantStats) {
    insights.push(
      `${tenantStats.total_deals} total deals · ${tenantStats.active_agents} agents · €${tenantStats.total_revenue.toLocaleString()} revenue`,
      `Overall success rate: ${(tenantStats.overall_success_rate * 100).toFixed(1)}%`
    )
  }

  if (agentRevenue.length > 0) {
    const top = agentRevenue[0]
    insights.push(`Top agent: ${top.agent_id} · €${top.total_revenue.toLocaleString()} (${top.deal_count} deals)`)
  }

  if (topPatterns.length > 0) {
    insights.push(`Most common deal path: ${topPatterns[0].flow_path} (${topPatterns[0].count}x)`)
  }

  return {
    tenant_id:      tenantId,
    generated_at:   new Date().toISOString(),
    agent_revenue:  agentRevenue,
    top_deal_paths: dealPaths,
    tenant_stats:   tenantStats,
    insights,
  }
}

// ─── Refresh trigger ──────────────────────────────────────────────────────────

/**
 * Triggers REFRESH MATERIALIZED VIEW CONCURRENTLY for all graph views.
 * Called by the /api/cron/refresh-graph-views route every 30 min.
 *
 * Primary path: calls db.rpc('refresh_graph_views') — SECURITY DEFINER function,
 *   runs as postgres owner, no extra env vars required beyond SUPABASE_SERVICE_ROLE_KEY.
 *
 * Fallback: Supabase Management API (requires SUPABASE_MANAGEMENT_TOKEN if RPC fails).
 */
export async function refreshMaterializedViews(tenantId = 'agency-group'): Promise<{
  ok: boolean
  views_refreshed: string[]
  duration_ms: number
}> {
  const start = Date.now()
  const views = ['mv_agent_revenue', 'mv_deal_flow_paths', 'mv_tenant_graph_stats']

  void tenantId  // used for future per-tenant refresh scoping

  // ── Primary: SECURITY DEFINER RPC (no extra token needed) ────────────────
  try {
    const db = getDb()
    const { data, error } = await db.rpc('refresh_graph_views')

    if (!error && data) {
      const result = data as { ok: boolean; views_refreshed: string[]; duration_ms: number }
      if (result.ok) {
        return {
          ok:             true,
          views_refreshed: result.views_refreshed ?? views,
          duration_ms:    Date.now() - start,
        }
      }
      console.warn('[GraphMV] rpc refresh_graph_views returned ok=false:', data)
    } else if (error) {
      console.warn('[GraphMV] rpc refresh_graph_views error:', error.message)
    }
  } catch (err) {
    console.warn('[GraphMV] rpc refresh_graph_views threw:', err)
  }

  // ── Fallback: Management API ──────────────────────────────────────────────
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'isbfiofwpxqqpgxoftph'
  const mgmtToken  = process.env.SUPABASE_MANAGEMENT_TOKEN

  if (!mgmtToken) {
    console.warn('[GraphMV] No SUPABASE_MANAGEMENT_TOKEN and RPC failed — refresh skipped')
    return { ok: false, views_refreshed: [], duration_ms: Date.now() - start }
  }

  const refreshed: string[] = []
  for (const view of views) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};` }),
        signal:  AbortSignal.timeout(30000),
      })
      if (res.ok) refreshed.push(view)
      else console.warn(`[GraphMV] mgmt refresh ${view} failed: ${res.status}`)
    } catch (err) {
      console.warn(`[GraphMV] mgmt refresh ${view} error:`, err)
    }
  }

  return { ok: refreshed.length === views.length, views_refreshed: refreshed, duration_ms: Date.now() - start }
}
