// =============================================================================
// Agency Group — NPS (Net Promoter Score) API
// GET  /api/portal/nps — NPS metrics and responses
// POST /api/portal/nps — submit NPS response (public endpoint)
// Auth: GET requires portal auth; POST is public (client facing)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'

interface NpsResponse {
  score: number
  feedback: string | null
  trigger_event: string | null
  agent_email: string | null
  responded_at: string
}

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '90'), 365)

  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: responses = [], error } = await supabaseAdmin
      .from('nps_responses')
      .select('*')
      .gte('responded_at', since)
      .order('responded_at', { ascending: false }) as { data: NpsResponse[]; error: { message: string } | null }

    if (error) {
      log.warn('[nps] query error', { route: 'api/portal/nps', error: error.message })
    }

    const promoters  = responses.filter(r => r.score >= 9).length
    const passives   = responses.filter(r => r.score >= 7 && r.score < 9).length
    const detractors = responses.filter(r => r.score < 7).length
    const total      = responses.length

    const nps_score = total
      ? Math.round(((promoters - detractors) / total) * 100)
      : 0

    const by_trigger: Record<string, { count: number; avg_score: number }> = {}
    const by_agent:   Record<string, { count: number; avg_score: number; nps: number }> = {}

    for (const r of responses) {
      const trigger = r.trigger_event ?? 'unknown'
      if (!by_trigger[trigger]) by_trigger[trigger] = { count: 0, avg_score: 0 }
      const tc = by_trigger[trigger]
      tc.avg_score = parseFloat(((tc.avg_score * tc.count + r.score) / (tc.count + 1)).toFixed(1))
      tc.count++

      const agent = r.agent_email ?? 'unknown'
      if (!by_agent[agent]) by_agent[agent] = { count: 0, avg_score: 0, nps: 0 }
      const ac = by_agent[agent]
      ac.avg_score = parseFloat(((ac.avg_score * ac.count + r.score) / (ac.count + 1)).toFixed(1))
      ac.count++
    }

    // Calculate per-agent NPS
    for (const agent of Object.keys(by_agent)) {
      const agentResponses = responses.filter(r => (r.agent_email ?? 'unknown') === agent)
      const ap = agentResponses.filter(r => r.score >= 9).length
      const ad = agentResponses.filter(r => r.score < 7).length
      by_agent[agent].nps = agentResponses.length
        ? Math.round(((ap - ad) / agentResponses.length) * 100)
        : 0
    }

    const avg_score = total
      ? parseFloat((responses.reduce((s, r) => s + r.score, 0) / total).toFixed(1))
      : 0

    return NextResponse.json({
      nps_score,
      total_responses: total,
      promoters,
      passives,
      detractors,
      promoter_pct: total ? Math.round((promoters / total) * 100) : 0,
      avg_score,
      by_trigger,
      by_agent,
      recent_feedback: responses
        .filter(r => r.feedback)
        .slice(0, 10)
        .map(r => ({
          score:    r.score,
          feedback: r.feedback,
          trigger:  r.trigger_event,
          date:     r.responded_at,
        })),
    }, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[nps] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/portal/nps' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface NpsPostBody {
  contact_id?: string
  deal_id?: string
  agent_email?: string
  score: number
  feedback?: string
  trigger_event?: string
  channel?: string
}

export async function POST(req: NextRequest) {
  // POST is intentionally public (client-facing survey endpoint)
  const corrId = getRequestCorrelationId(req)

  try {
    const body = await req.json() as NpsPostBody

    if (body.score === undefined || body.score === null || body.score < 0 || body.score > 10) {
      return NextResponse.json({ error: 'score must be 0–10' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin.from('nps_responses').insert({
      contact_id:    body.contact_id    ?? null,
      deal_id:       body.deal_id       ?? null,
      agent_email:   body.agent_email   ?? null,
      score:         body.score,
      feedback:      body.feedback      ?? null,
      trigger_event: body.trigger_event ?? null,
      channel:       body.channel       ?? 'email',
    })

    if (error) {
      log.error('[nps] INSERT error', new Error((error as { message: string }).message), { route: 'api/portal/nps' })
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
    }

    log.info('[nps] Response recorded', {
      route:   'api/portal/nps',
      score:   body.score,
      trigger: body.trigger_event,
    } as Record<string, unknown>)

    return NextResponse.json({
      success: true,
      message: body.score >= 9
        ? 'Obrigado! A sua avaliação significa muito para nós.'
        : 'Obrigado pelo seu feedback. Iremos melhorar.',
    }, {
      status: 201,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.error('[nps] POST error', err instanceof Error ? err : new Error(String(err)), { route: 'api/portal/nps' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
