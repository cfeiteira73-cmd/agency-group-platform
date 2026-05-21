// =============================================================================
// Agency Group — AI Usage Dashboard API
// app/api/ai/usage/route.ts
//
// GET /api/ai/usage?days=7
// Returns a usage summary for the last N days (default: 7, max: 90).
//
// Response shape:
// {
//   total_cost_usd: number,
//   calls_count: number,
//   by_feature: Record<string, { calls: number; cost_usd: number }>,
//   by_model:   Record<string, { calls: number; cost_usd: number }>,
//   daily_breakdown: Array<{ date: string; calls: number; cost_usd: number }>,
//   budget_status: TenantBudget,
// }
//
// Auth: portal auth (NextAuth session, magic-link cookie, or CRON_SECRET).
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth }              from '@/lib/portalAuth'
import { supabaseAdmin }             from '@/lib/supabase'
import { getBudgetStatus }           from '@/lib/ai/budgetEnforcer'
import log                           from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageRow {
  feature:       string
  model:         string
  total_cost_usd: number | string
  called_at:     string
  success:       boolean
}

interface FeatureStat {
  calls:    number
  cost_usd: number
}

interface DailyBreakdown {
  date:     string
  calls:    number
  cost_usd: number
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Query params ──────────────────────────────────────────────────────────
  const daysParam = req.nextUrl.searchParams.get('days')
  const days      = Math.min(90, Math.max(1, parseInt(daysParam ?? '7', 10) || 7))

  // Tenant: from query param or fall back to system org
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
    ?? process.env.SYSTEM_ORG_ID
    ?? 'agency-group'

  // From date: N days ago
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // ── Fetch usage rows ──────────────────────────────────────────────────────
  let rows: UsageRow[] = []
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ai_usage_log')
      .select('feature, model, total_cost_usd, called_at, success')
      .eq('tenant_id', tenantId)
      .gte('called_at', from)
      .order('called_at', { ascending: true })
      .limit(10_000)

    if (error) {
      log.error('[ai/usage] Failed to query ai_usage_log', error, {
        route: 'GET /api/ai/usage',
        tenant_id: tenantId,
      })
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
    }

    rows = (data ?? []) as UsageRow[]
  } catch (err) {
    log.error('[ai/usage] Unexpected error querying ai_usage_log', err, {
      route: 'GET /api/ai/usage',
      tenant_id: tenantId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  let total_cost_usd = 0
  let calls_count    = 0

  const by_feature: Record<string, FeatureStat>    = {}
  const by_model:   Record<string, FeatureStat>    = {}
  const by_date:    Record<string, DailyBreakdown> = {}

  for (const row of rows) {
    const cost = Number(row.total_cost_usd ?? 0)
    const date = row.called_at.slice(0, 10) // YYYY-MM-DD

    total_cost_usd += cost
    calls_count    += 1

    // By feature
    if (!by_feature[row.feature]) {
      by_feature[row.feature] = { calls: 0, cost_usd: 0 }
    }
    by_feature[row.feature]!.calls    += 1
    by_feature[row.feature]!.cost_usd += cost

    // By model
    if (!by_model[row.model]) {
      by_model[row.model] = { calls: 0, cost_usd: 0 }
    }
    by_model[row.model]!.calls    += 1
    by_model[row.model]!.cost_usd += cost

    // Daily breakdown
    if (!by_date[date]) {
      by_date[date] = { date, calls: 0, cost_usd: 0 }
    }
    by_date[date]!.calls    += 1
    by_date[date]!.cost_usd += cost
  }

  // Round all cost figures to 6 decimal places
  total_cost_usd = Math.round(total_cost_usd * 1_000_000) / 1_000_000

  for (const stat of Object.values(by_feature)) {
    stat.cost_usd = Math.round(stat.cost_usd * 1_000_000) / 1_000_000
  }
  for (const stat of Object.values(by_model)) {
    stat.cost_usd = Math.round(stat.cost_usd * 1_000_000) / 1_000_000
  }

  const daily_breakdown: DailyBreakdown[] = Object.values(by_date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, cost_usd: Math.round(d.cost_usd * 1_000_000) / 1_000_000 }))

  // ── Budget status ─────────────────────────────────────────────────────────
  let budget_status = null
  try {
    budget_status = await getBudgetStatus(tenantId)
  } catch (err) {
    log.warn('[ai/usage] Failed to fetch budget status', {
      route: 'GET /api/ai/usage',
      tenant_id: tenantId,
      error: err instanceof Error ? err.message : String(err),
    })
    // Non-fatal — return null in this field
  }

  return NextResponse.json({
    tenant_id: tenantId,
    days,
    total_cost_usd,
    calls_count,
    by_feature,
    by_model,
    daily_breakdown,
    budget_status,
  })
}
