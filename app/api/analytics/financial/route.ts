// =============================================================================
// Agency Group — Financial Intelligence API
// GET /api/analytics/financial — P&L, pipeline, win rate, forecast
// Auth: requirePortalAuth
//
// Query params:
//   period = 'month' | 'quarter' | 'year' (default: 'month')
//
// Returns:
//   { period, revenue_eur, deals_closed, avg_deal_value, win_rate,
//     pipeline_value, forecast_next_period }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime = 'nodejs'

// ── Date window helpers ────────────────────────────────────────────────────────

function getPeriodWindow(period: string): { since: string; until: string } {
  const now = new Date()
  let since: Date
  switch (period) {
    case 'quarter':
      since = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      break
    case 'year':
      since = new Date(now.getFullYear(), 0, 1)
      break
    default: // month
      since = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return {
    since: since.toISOString(),
    until: now.toISOString(),
  }
}

// ── Parse numeric values from mixed DB column types ───────────────────────────

function parseNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/[^0-9.]/g, '')) || 0
  return 0
}

// ── Closed stage detection ────────────────────────────────────────────────────

const CLOSED_STAGES = new Set(['escritura', 'post_sale', 'postsale', 'posvenda', 'fechado'])

function isClosed(stage: unknown): boolean {
  const s = String(stage ?? '').toLowerCase().replace(/[\s\-_]+/g, '')
  for (const cs of CLOSED_STAGES) {
    if (s.includes(cs)) return true
  }
  return false
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const { searchParams } = new URL(req.url)
  const period = (searchParams.get('period') ?? 'month') as 'month' | 'quarter' | 'year'
  const { since, until } = getPeriodWindow(period)

  const sb = supabaseAdmin as any // eslint-disable-line @typescript-eslint/no-explicit-any

  try {
    // ── 1. Closed deals: revenue + count + avg deal value ────────────────────
    let dealsData: Record<string, unknown>[] = []
    try {
      // Try with gci_net + sale_price first
      const { data, error } = await sb
        .from('deals')
        .select('id, stage, gci_net, sale_price, asking_price, deal_value, fase, valor, created_at')
        .gte('created_at', since)
        .lte('created_at', until)

      if (error && String(error.code) === '42703') {
        // Fallback with minimum cols
        const { data: fallback } = await sb
          .from('deals')
          .select('id, fase, valor, created_at')
          .gte('created_at', since)
          .lte('created_at', until)
        dealsData = fallback ?? []
      } else {
        dealsData = data ?? []
      }
    } catch {
      dealsData = []
    }

    const closedDeals = dealsData.filter(d => isClosed(d.stage ?? d.fase))
    const openDeals   = dealsData.filter(d => !isClosed(d.stage ?? d.fase))

    // GCI from gci_net → expected_fee → valor × 5%
    const gciForDeal = (d: Record<string, unknown>): number =>
      parseNum(d.gci_net) ||
      parseNum(d.realized_fee) ||
      parseNum(d.expected_fee) ||
      parseNum(d.sale_price) * 0.05 ||
      parseNum(d.valor) * 0.05

    const dealValue = (d: Record<string, unknown>): number =>
      parseNum(d.sale_price) ||
      parseNum(d.deal_value) ||
      parseNum(d.asking_price) ||
      parseNum(d.valor)

    const revenue_eur   = closedDeals.reduce((s, d) => s + gciForDeal(d), 0)
    const deals_closed  = closedDeals.length
    const total_closed_value = closedDeals.reduce((s, d) => s + dealValue(d), 0)
    const avg_deal_value = deals_closed > 0 ? total_closed_value / deals_closed : 0

    // ── 2. Pipeline value: open deals × asking_price × 5% × 0.5 probability ──
    const pipeline_value = openDeals.reduce((s, d) => {
      const price = dealValue(d)
      return s + price * 0.05 * 0.5
    }, 0)

    // ── 3. Win/loss → win rate ────────────────────────────────────────────────
    let wins = 0
    let losses = 0
    try {
      const { data: wlData } = await sb
        .from('win_loss_events')
        .select('outcome')
        .gte('recorded_at', since)
        .lte('recorded_at', until)

      if (wlData && wlData.length > 0) {
        wins   = wlData.filter((r: { outcome: string }) => r.outcome === 'won').length
        losses = wlData.filter((r: { outcome: string }) => r.outcome === 'lost').length
      }
    } catch {
      // win_loss_events may not be populated — derive from deals
      wins   = deals_closed
      losses = 0
    }

    const total_wl = wins + losses
    const win_rate = total_wl > 0 ? Math.round((wins / total_wl) * 100) : null

    // ── 4. Forecast next period: revenue × 1.1 (10% growth assumption) ────────
    const forecast_next_period = Math.round(revenue_eur * 1.1)

    log.info('[financial API] served', {
      route: 'api/analytics/financial',
      agent_email: check.email,
      period,
      revenue_eur: Math.round(revenue_eur),
      deals_closed,
    })

    return NextResponse.json({
      period,
      since,
      until,
      revenue_eur:           Math.round(revenue_eur),
      deals_closed,
      avg_deal_value:        Math.round(avg_deal_value),
      win_rate,
      pipeline_value:        Math.round(pipeline_value),
      forecast_next_period,
      forecast_basis:        'Estimativa: receita actual × 1.1 (crescimento 10%)',
      wins,
      losses,
      generated:             new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })

  } catch (err) {
    log.error('[financial API] GET error', err instanceof Error ? err : new Error(String(err)), {
      route: 'api/analytics/financial',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
