// =============================================================================
// Agency Group — Graph Recursive CTE Engine
// lib/graph/recursiveCTE.ts
//
// Deep causal chain and revenue attribution queries using Postgres recursive CTEs.
// Requires stored functions in Supabase (see DDL comments below).
// Called via Supabase REST /rpc endpoint.
//
// DDL (run once in Supabase SQL editor — enables recursive queries):
//
// -- CREATE OR REPLACE FUNCTION get_causal_chain(
// --   p_correlation_id text,
// --   p_tenant_id text,
// --   p_max_depth int DEFAULT 20
// -- )
// -- RETURNS TABLE(
// --   step_id text, parent_id text, depth int,
// --   step_type text, action text, agent_id text,
// --   revenue_delta numeric, success boolean, created_at timestamptz
// -- )
// -- LANGUAGE sql STABLE AS $$
// --   WITH RECURSIVE causal_chain AS (
// --     SELECT id::text AS step_id, NULL::text AS parent_id, 0 AS depth,
// --            step_type, action, agent_id, revenue_delta, success, created_at
// --     FROM causal_trace
// --     WHERE correlation_id = p_correlation_id AND tenant_id = p_tenant_id
// --       AND created_at = (SELECT MIN(created_at) FROM causal_trace
// --                         WHERE correlation_id = p_correlation_id AND tenant_id = p_tenant_id)
// --     UNION ALL
// --     SELECT ct.id::text, cc.step_id, cc.depth + 1,
// --            ct.step_type, ct.action, ct.agent_id, ct.revenue_delta, ct.success, ct.created_at
// --     FROM causal_trace ct
// --     JOIN causal_chain cc ON ct.correlation_id = p_correlation_id
// --       AND ct.tenant_id = p_tenant_id
// --       AND ct.created_at > cc.created_at
// --     WHERE cc.depth < p_max_depth
// --   )
// --   SELECT DISTINCT ON (step_id) * FROM causal_chain ORDER BY step_id, depth;
// -- $$;
//
// -- CREATE OR REPLACE FUNCTION get_revenue_attribution(
// --   p_tenant_id text,
// --   p_from_date timestamptz DEFAULT NOW() - INTERVAL '30 days',
// --   p_to_date timestamptz DEFAULT NOW()
// -- )
// -- RETURNS TABLE(
// --   agent_id text, total_revenue numeric, deal_count bigint,
// --   avg_revenue_per_deal numeric, success_rate numeric
// -- )
// -- LANGUAGE sql STABLE AS $$
// --   SELECT
// --     agent_id,
// --     SUM(COALESCE(revenue_delta, 0)) AS total_revenue,
// --     COUNT(DISTINCT correlation_id) AS deal_count,
// --     AVG(COALESCE(revenue_delta, 0)) AS avg_revenue_per_deal,
// --     AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) AS success_rate
// --   FROM causal_trace
// --   WHERE tenant_id = p_tenant_id
// --     AND created_at BETWEEN p_from_date AND p_to_date
// --     AND agent_id IS NOT NULL
// --     AND revenue_delta IS NOT NULL
// --   GROUP BY agent_id
// --   ORDER BY total_revenue DESC;
// -- $$;
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CausalChainStep {
  step_id:       string
  parent_id:     string | null
  depth:         number
  step_type:     string
  action:        string | null
  agent_id:      string | null
  revenue_delta: number | null
  success:       boolean | null
  created_at:    string
}

export interface RevenueAttribution {
  agent_id:              string
  total_revenue:         number
  deal_count:            number
  avg_revenue_per_deal:  number
  success_rate:          number
}

export interface CausalChainResult {
  correlation_id: string
  steps:          CausalChainStep[]
  total_revenue:  number
  depth:          number
  agents:         string[]
  summary:        string
}

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── Recursive causal chain ──────────────────────────────────────────────────

/**
 * Traverses the full causal chain for a correlation_id using a recursive CTE.
 * Returns ordered steps with parent-child relationships (tree structure).
 *
 * Requires: get_causal_chain() stored function (see DDL above).
 */
export async function getCausalChainRecursive(
  correlationId: string,
  tenantId: string,
  maxDepth = 20,
): Promise<CausalChainResult> {
  try {
    const db = getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc('get_causal_chain', {
      p_correlation_id: correlationId,
      p_tenant_id:      tenantId,
      p_max_depth:      maxDepth,
    })

    if (error || !data) {
      // Fallback: plain sequential query without recursion
      return await getCausalChainFallback(correlationId, tenantId)
    }

    const steps = data as CausalChainStep[]
    const totalRevenue = steps.reduce((s, st) => s + (st.revenue_delta ?? 0), 0)
    const agents = [...new Set(steps.map(s => s.agent_id).filter(Boolean) as string[])]

    return {
      correlation_id: correlationId,
      steps,
      total_revenue:  totalRevenue,
      depth:          Math.max(...steps.map(s => s.depth), 0),
      agents,
      summary:        `${steps.length} steps · ${agents.length} agents · €${totalRevenue.toFixed(2)} revenue`,
    }
  } catch (err) {
    return {
      correlation_id: correlationId,
      steps:          [],
      total_revenue:  0,
      depth:          0,
      agents:         [],
      summary:        `Error: ${String(err)}`,
    }
  }
}

// Fallback: sequential order (no recursion) for environments without the stored function
async function getCausalChainFallback(correlationId: string, tenantId: string): Promise<CausalChainResult> {
  const db = getDb()
  const { data } = await db
    .from('causal_trace')
    .select('id, step_type, action, agent_id, revenue_delta, success, created_at')
    .eq('correlation_id', correlationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(50)

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const steps: CausalChainStep[] = rows.map((r, i) => ({
    step_id:       String(r['id']),
    parent_id:     i > 0 ? String(rows[i - 1]['id']) : null,
    depth:         i,
    step_type:     String(r['step_type'] ?? ''),
    action:        r['action'] != null ? String(r['action']) : null,
    agent_id:      r['agent_id'] != null ? String(r['agent_id']) : null,
    revenue_delta: typeof r['revenue_delta'] === 'number' ? r['revenue_delta'] : null,
    success:       typeof r['success'] === 'boolean' ? r['success'] : null,
    created_at:    String(r['created_at']),
  }))

  const totalRevenue = steps.reduce((s, st) => s + (st.revenue_delta ?? 0), 0)
  const agents = [...new Set(steps.map(s => s.agent_id).filter(Boolean) as string[])]

  return {
    correlation_id: correlationId,
    steps,
    total_revenue:  totalRevenue,
    depth:          steps.length,
    agents,
    summary:        `${steps.length} steps (fallback) · ${agents.length} agents · €${totalRevenue.toFixed(2)} revenue`,
  }
}

// ─── Revenue attribution ──────────────────────────────────────────────────────

/**
 * Returns per-agent revenue attribution for a date range.
 * Uses get_revenue_attribution() stored function (see DDL).
 * Fallback: manual aggregation from causal_trace.
 */
export async function getRevenueAttribution(
  tenantId: string,
  fromDate?: string,
  toDate?: string,
): Promise<RevenueAttribution[]> {
  try {
    const db = getDb()
    const from = fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to   = toDate   ?? new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc('get_revenue_attribution', {
      p_tenant_id: tenantId,
      p_from_date: from,
      p_to_date:   to,
    })

    if (!error && data) {
      return data as RevenueAttribution[]
    }

    // Fallback: manual aggregation
    const { data: rows } = await db
      .from('causal_trace')
      .select('agent_id, correlation_id, revenue_delta, success')
      .eq('tenant_id', tenantId)
      .not('agent_id', 'is', null)
      .not('revenue_delta', 'is', null)
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(1000)

    const agentMap = new Map<string, { revenue: number; deals: Set<string>; successes: number; total: number }>()
    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      const aid = String(row['agent_id'])
      if (!agentMap.has(aid)) agentMap.set(aid, { revenue: 0, deals: new Set(), successes: 0, total: 0 })
      const entry = agentMap.get(aid)!
      entry.revenue += typeof row['revenue_delta'] === 'number' ? row['revenue_delta'] : 0
      if (row['correlation_id']) entry.deals.add(String(row['correlation_id']))
      if (row['success'] === true) entry.successes++
      entry.total++
    }

    return Array.from(agentMap.entries()).map(([agent_id, v]) => ({
      agent_id,
      total_revenue:        v.revenue,
      deal_count:           v.deals.size,
      avg_revenue_per_deal: v.deals.size > 0 ? v.revenue / v.deals.size : 0,
      success_rate:         v.total > 0 ? v.successes / v.total : 0,
    })).sort((a, b) => b.total_revenue - a.total_revenue)
  } catch { return [] }
}
