// =============================================================================
// Agency Group — KPI: Off-Market + Institutional Partners
// GET /api/kpi/offmarket
// Returns aggregated KPIs for the Portal Dashboard
// =============================================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      r_total,
      r_week,
      r_highscore,
      r_pending,
      r_active,
      r_top,
      r_p_total,
      r_p_week,
      r_p_active,
      r_p_top,
      r_byStatus,
      r_bySource,
      r_scores,
    ] = await Promise.all([
      s.from('offmarket_leads').select('*', { count: 'exact', head: true }),
      s.from('offmarket_leads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      s.from('offmarket_leads').select('*', { count: 'exact', head: true }).gte('score', 70),
      s.from('offmarket_leads').select('*', { count: 'exact', head: true }).eq('score_status', 'pending_score'),
      s.from('offmarket_leads').select('*', { count: 'exact', head: true }).not('status', 'in', '("closed_won","closed_lost")'),
      s.from('offmarket_leads').select('id,nome,cidade,score,score_status,status,urgency,assigned_to,created_at').order('score', { ascending: false }).limit(10),
      s.from('institutional_partners').select('*', { count: 'exact', head: true }),
      s.from('institutional_partners').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      s.from('institutional_partners').select('*', { count: 'exact', head: true }).eq('estado', 'parceiro_activo'),
      s.from('institutional_partners').select('id,nome,empresa,tipo,cidade,nivel_prioridade,estado,last_contact_at').order('nivel_prioridade', { ascending: true }).limit(10),
      s.from('offmarket_leads').select('status').not('status', 'in', '("closed_won","closed_lost")'),
      s.from('offmarket_leads').select('source').gte('created_at', monthAgo),
      s.from('offmarket_leads').select('score').eq('score_status', 'scored'),
    ])

    // --- Status breakdown ---
    const byStatus: Record<string, number> = {}
    if (Array.isArray(r_byStatus.data)) {
      for (const row of r_byStatus.data as { status: string }[]) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1
      }
    }

    // --- Source breakdown ---
    const bySource: Record<string, number> = {}
    if (Array.isArray(r_bySource.data)) {
      for (const row of r_bySource.data as { source: string }[]) {
        const src = row.source || 'manual'
        bySource[src] = (bySource[src] || 0) + 1
      }
    }

    // --- Avg score ---
    let avgScore = 0
    if (Array.isArray(r_scores.data) && r_scores.data.length > 0) {
      const scores = (r_scores.data as { score: number | null }[])
        .filter(r => r.score !== null)
        .map(r => r.score as number)
      if (scores.length > 0) avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }

    return NextResponse.json({
      offmarket: {
        total:         r_total.count    ?? 0,
        new_this_week: r_week.count     ?? 0,
        high_score:    r_highscore.count ?? 0,
        pending_score: r_pending.count  ?? 0,
        active:        r_active.count   ?? 0,
        avg_score:     avgScore,
        top_leads:     r_top.data       ?? [],
        by_status:     byStatus,
        by_source:     bySource,
      },
      partners: {
        total:          r_p_total.count  ?? 0,
        new_this_week:  r_p_week.count   ?? 0,
        active:         r_p_active.count ?? 0,
        top_partners:   r_p_top.data     ?? [],
      },
      generated_at: now.toISOString(),
      period: { week_ago: weekAgo, month_ago: monthAgo },
    })
  } catch (err) {
    console.error('[kpi/offmarket]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
