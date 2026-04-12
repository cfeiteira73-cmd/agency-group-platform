// =============================================================================
// Agency Group — KPI: Off-Market + Institutional Partners
// GET /api/kpi/offmarket
// Returns aggregated KPIs for the Portal Dashboard
// HARDENED: per-section try/catch — one failing table never kills the response
// =============================================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

// Safe query wrapper — returns default on any Supabase error
async function safeQuery<T>(
  fn: () => Promise<{ data: T | null; error: unknown; count?: number | null }>,
  defaultData: T
): Promise<{ data: T; count: number; ok: boolean }> {
  try {
    const r = await fn()
    if (r.error) return { data: defaultData, count: 0, ok: false }
    return { data: r.data ?? defaultData, count: r.count ?? 0, ok: true }
  } catch {
    return { data: defaultData, count: 0, ok: false }
  }
}

async function safeCount(fn: () => Promise<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const r = await fn()
    if (r.error) return 0
    return r.count ?? 0
  } catch {
    return 0
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Section A: Core offmarket counts ────────────────────────────────────
    const [
      totalCount,
      weekCount,
      highScoreCount,
      pendingCount,
      activeCount,
    ] = await Promise.all([
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true })),
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo)),
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true }).gte('score', 70)),
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true }).eq('score_status', 'pending_score')),
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true }).not('status', 'in', '("closed_won","closed_lost")')),
    ])

    // ── Section B: Advanced offmarket counts (migrations 004+005 fields) ────
    const [
      precloseCount,
      outreachCount,
    ] = await Promise.all([
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true }).eq('preclose_candidate', true)),
      safeCount(() => s.from('offmarket_leads').select('*', { count: 'exact', head: true }).eq('outreach_ready', true).not('status', 'in', '("closed_won","closed_lost","not_interested")')),
    ])

    // ── Section C: Top leads ─────────────────────────────────────────────────
    const topLeadsResult = await safeQuery(
      () => s.from('offmarket_leads')
        .select('id,nome,cidade,score,score_status,score_reason,status,urgency,assigned_to,preclose_candidate,outreach_ready,created_at')
        .order('score', { ascending: false })
        .limit(10),
      []
    )

    // ── Section D: Status + source breakdown ────────────────────────────────
    const [byStatusResult, bySourceResult, scoresResult] = await Promise.all([
      safeQuery(
        () => s.from('offmarket_leads').select('status').not('status', 'in', '("closed_won","closed_lost")'),
        [] as { status: string }[]
      ),
      safeQuery(
        () => s.from('offmarket_leads').select('source').gte('created_at', monthAgo),
        [] as { source: string }[]
      ),
      safeQuery(
        () => s.from('offmarket_leads').select('score').eq('score_status', 'scored'),
        [] as { score: number | null }[]
      ),
    ])

    const byStatus: Record<string, number> = {}
    for (const row of byStatusResult.data as { status: string }[]) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1
    }

    const bySource: Record<string, number> = {}
    for (const row of bySourceResult.data as { source: string }[]) {
      const src = row.source || 'manual'
      bySource[src] = (bySource[src] || 0) + 1
    }

    let avgScore = 0
    const scores = (scoresResult.data as { score: number | null }[])
      .filter(r => r.score !== null).map(r => r.score as number)
    if (scores.length > 0) avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    // ── Section E: Institutional partners (separate table — isolated failure) ─
    let partnersData = { total: 0, new_this_week: 0, active: 0, top_partners: [] as unknown[] }
    let partnersOk = false
    try {
      const [pTotal, pWeek, pActive, pTop] = await Promise.all([
        safeCount(() => s.from('institutional_partners').select('*', { count: 'exact', head: true })),
        safeCount(() => s.from('institutional_partners').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo)),
        safeCount(() => s.from('institutional_partners').select('*', { count: 'exact', head: true }).eq('estado', 'parceiro_activo')),
        safeQuery(
          () => s.from('institutional_partners').select('id,nome,empresa,tipo,cidade,nivel_prioridade,estado,last_contact_at').order('nivel_prioridade', { ascending: true }).limit(10),
          []
        ),
      ])
      partnersData = { total: pTotal, new_this_week: pWeek, active: pActive, top_partners: pTop.data as unknown[] }
      partnersOk = true
    } catch {
      console.warn('[kpi/offmarket] institutional_partners unavailable')
    }

    // ── Section F: Buyer Pool KPIs (migration 007 — isolated failure) ─────────
    let buyerPoolData = {
      total: 0, tier_a: 0, tier_b: 0, tier_c: 0,
      with_budget: 0, avg_buyer_score: 0, immediate_liquidity: 0,
    }
    let buyerPoolOk = false
    try {
      const ACTIVE = ['active', 'prospect', 'lead', 'qualified', 'negotiating', 'client', 'vip']
      const [bTotal, bTierA, bTierB, bTierC, bBudget, bImmediate] = await Promise.all([
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE)),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE).eq('lead_tier', 'A')),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE).eq('lead_tier', 'B')),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE).eq('lead_tier', 'C')),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE).not('budget_max', 'is', null)),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE).eq('liquidity_profile', 'immediate')),
      ])
      // avg buyer_score — graceful if column missing
      let avgBuyerScore = 0
      try {
        const { data: bScores } = await s.from('contacts').select('buyer_score').in('status', ACTIVE).not('buyer_score', 'is', null)
        const scores = (bScores ?? []).map((r: { buyer_score: number }) => r.buyer_score)
        if (scores.length > 0) avgBuyerScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      } catch { /* buyer_score col missing — ignored */ }

      buyerPoolData = { total: bTotal, tier_a: bTierA, tier_b: bTierB, tier_c: bTierC, with_budget: bBudget, avg_buyer_score: avgBuyerScore, immediate_liquidity: bImmediate }
      buyerPoolOk = true
    } catch {
      console.warn('[kpi/offmarket] buyer pool query failed')
    }

    return NextResponse.json({
      offmarket: {
        total:               totalCount,
        new_this_week:       weekCount,
        high_score:          highScoreCount,
        pending_score:       pendingCount,
        active:              activeCount,
        preclose_candidates: precloseCount,
        outreach_ready:      outreachCount,
        avg_score:           avgScore,
        top_leads:           topLeadsResult.data,
        by_status:           Object.entries(byStatus).map(([status, count]) => ({ status, count })),
        by_source:           Object.entries(bySource).map(([source, count]) => ({ source, count })),
      },
      institutional_partners: partnersData,
      buyer_pool:             buyerPoolData,
      // keep legacy key for backward compat
      partners: partnersData,
      partial: !topLeadsResult.ok || !partnersOk || !buyerPoolOk,
      generated_at: now.toISOString(),
      period: { week_ago: weekAgo, month_ago: monthAgo },
    })
  } catch (err) {
    console.error('[kpi/offmarket]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
