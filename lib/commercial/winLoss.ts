// =============================================================================
// Agency Group — Win/Loss Analytics Engine
// lib/commercial/winLoss.ts
// Analyzes deal outcomes, loss reasons, conversion rates by variable
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

export interface WinLossEvent {
  id: string
  deal_id: string | null
  contact_id: string | null
  agent_id: string
  outcome: 'won' | 'lost' | 'stalled' | 'withdrawn'
  reason_category: string
  reason_detail: string | null
  objection_type: string | null
  deal_value: number | null
  commission_lost: number | null
  days_in_pipeline: number | null
  stage_lost: string | null
  notes: string | null
  recorded_at: string
}

export interface WinLossAnalytics {
  total_events: number
  win_rate: number
  loss_rate: number
  avg_deal_value: number
  commission_at_risk: number
  by_reason: Record<string, { count: number; win_rate: number; avg_value: number }>
  by_agent: Record<string, { wins: number; losses: number; win_rate: number; gci: number }>
  by_stage: Record<string, { count: number; pct: number }>
  by_objection: Record<string, { count: number; win_rate: number }>
  trend_30d: { date: string; wins: number; losses: number }[]
}

export async function recordWinLoss(event: Omit<WinLossEvent, 'id' | 'recorded_at'>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabaseAdmin.from('win_loss_events').insert(event)
  if (error) {
    const { default: log } = await import('@/lib/logger')
    log.error('[winLoss] Failed to record event', new Error(error.message), { route: 'lib/commercial/winLoss' })
  }
}

export async function getWinLossAnalytics(
  days = 90,
  agentEmail?: string
): Promise<WinLossAnalytics> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabaseAdmin
    .from('win_loss_events')
    .select('*')
    .gte('recorded_at', since)

  if (agentEmail) query = query.eq('agent_id', agentEmail)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events = [], error } = await query as { data: any[]; error: any }

  if (error || !events.length) {
    return {
      total_events: 0, win_rate: 0, loss_rate: 0, avg_deal_value: 0,
      commission_at_risk: 0, by_reason: {}, by_agent: {}, by_stage: {},
      by_objection: {}, trend_30d: [],
    }
  }

  const wins = events.filter(e => e.outcome === 'won')
  const losses = events.filter(e => e.outcome === 'lost')
  const total = events.length

  // By reason
  const by_reason: WinLossAnalytics['by_reason'] = {}
  for (const e of events) {
    const cat = e.reason_category ?? 'other'
    if (!by_reason[cat]) by_reason[cat] = { count: 0, win_rate: 0, avg_value: 0 }
    by_reason[cat].count++
  }
  for (const cat of Object.keys(by_reason)) {
    const catEvents = events.filter(e => e.reason_category === cat)
    const catWins = catEvents.filter(e => e.outcome === 'won')
    by_reason[cat].win_rate = catEvents.length ? Math.round((catWins.length / catEvents.length) * 100) : 0
    by_reason[cat].avg_value = catEvents.length
      ? Math.round(catEvents.reduce((s, e) => s + (e.deal_value ?? 0), 0) / catEvents.length)
      : 0
  }

  // By agent
  const by_agent: WinLossAnalytics['by_agent'] = {}
  for (const e of events) {
    if (!by_agent[e.agent_id]) by_agent[e.agent_id] = { wins: 0, losses: 0, win_rate: 0, gci: 0 }
    if (e.outcome === 'won') { by_agent[e.agent_id].wins++; by_agent[e.agent_id].gci += e.commission_lost ?? 0 }
    if (e.outcome === 'lost') by_agent[e.agent_id].losses++
  }
  for (const agent of Object.keys(by_agent)) {
    const a = by_agent[agent]
    const t = a.wins + a.losses
    a.win_rate = t ? Math.round((a.wins / t) * 100) : 0
  }

  // By stage lost
  const by_stage: WinLossAnalytics['by_stage'] = {}
  for (const e of losses) {
    const st = e.stage_lost ?? 'unknown'
    if (!by_stage[st]) by_stage[st] = { count: 0, pct: 0 }
    by_stage[st].count++
  }
  for (const st of Object.keys(by_stage)) {
    by_stage[st].pct = losses.length ? Math.round((by_stage[st].count / losses.length) * 100) : 0
  }

  // By objection
  const by_objection: WinLossAnalytics['by_objection'] = {}
  for (const e of events.filter(e => e.objection_type)) {
    const obj = e.objection_type!
    if (!by_objection[obj]) by_objection[obj] = { count: 0, win_rate: 0 }
    by_objection[obj].count++
  }
  for (const obj of Object.keys(by_objection)) {
    const objEvents = events.filter(e => e.objection_type === obj)
    const objWins = objEvents.filter(e => e.outcome === 'won')
    by_objection[obj].win_rate = objEvents.length ? Math.round((objWins.length / objEvents.length) * 100) : 0
  }

  // Trend last 30 days
  const trend_30d: WinLossAnalytics['trend_30d'] = []
  const since30 = new Date(Date.now() - 30 * 86_400_000)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const dateStr = d.toISOString().slice(0, 10)
    const dayEvents = events.filter(e => e.recorded_at?.slice(0, 10) === dateStr)
    trend_30d.push({
      date: dateStr,
      wins: dayEvents.filter(e => e.outcome === 'won').length,
      losses: dayEvents.filter(e => e.outcome === 'lost').length,
    })
  }
  void since30

  return {
    total_events: total,
    win_rate: total ? Math.round((wins.length / total) * 100) : 0,
    loss_rate: total ? Math.round((losses.length / total) * 100) : 0,
    avg_deal_value: wins.length
      ? Math.round(wins.reduce((s, e) => s + (e.deal_value ?? 0), 0) / wins.length)
      : 0,
    commission_at_risk: losses.reduce((s, e) => s + (e.commission_lost ?? 0), 0),
    by_reason,
    by_agent,
    by_stage,
    by_objection,
    trend_30d,
  }
}

export async function getTopObjections(limit = 10): Promise<Array<{
  objection: string
  category: string
  frequency: number
  best_response: string | null
  win_rate: number | null
}>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabaseAdmin
    .from('objection_taxonomy')
    .select('objection,category,frequency,best_response,win_rate_when_encountered')
    .order('frequency', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({
    objection: r.objection,
    category: r.category,
    frequency: r.frequency ?? 0,
    best_response: r.best_response,
    win_rate: r.win_rate_when_encountered,
  }))
}
