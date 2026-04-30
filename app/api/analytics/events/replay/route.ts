// =============================================================================
// Agency Group — Event Replay Endpoint
// GET /api/analytics/events/replay
//
// Replays events from the learning_events table filtered by correlation_id,
// session_id, event_type, or time range.
//
// Use cases:
//   - Debug a specific request flow: ?correlation_id=<uuid>
//   - Replay a user session: ?session_id=<uuid>
//   - Audit funnel events: ?event_type=match_created&since=2026-04-01
//   - Re-process failed events: ?since=...&source_system=n8n
//
// Auth: requirePortalAuth (admin only by default)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const url = new URL(req.url)

  // ── Query parameters ──────────────────────────────────────────────────────
  const correlationId  = url.searchParams.get('correlation_id')
  const sessionId      = url.searchParams.get('session_id')
  const eventType      = url.searchParams.get('event_type')
  const leadId         = url.searchParams.get('lead_id')
  const dealId         = url.searchParams.get('deal_id')
  const sourceSystem   = url.searchParams.get('source_system')
  const since          = url.searchParams.get('since')
  const until          = url.searchParams.get('until')
  const limitStr       = url.searchParams.get('limit') ?? '100'
  const orderBy        = (url.searchParams.get('order') ?? 'asc') === 'desc' ? false : true

  const limit = Math.min(Math.max(parseInt(limitStr, 10) || 100, 1), 1000)

  // ── Require at least one filter ───────────────────────────────────────────
  if (!correlationId && !sessionId && !eventType && !leadId && !dealId && !since) {
    return NextResponse.json({
      error: 'Provide at least one filter: correlation_id, session_id, event_type, lead_id, deal_id, or since',
      example: '/api/analytics/events/replay?correlation_id=<uuid>',
    }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin as any)
      .from('learning_events')
      .select(`
        id, event_type, created_at, agent_email, match_score,
        lead_id, deal_id, property_id, match_id, deal_pack_id,
        correlation_id, session_id, source_system, metadata
      `)
      .order('created_at', { ascending: orderBy })
      .limit(limit)

    if (correlationId)  q = q.eq('correlation_id', correlationId)
    if (sessionId)      q = q.eq('session_id', sessionId)
    if (eventType)      q = q.eq('event_type', eventType)
    if (leadId)         q = q.eq('lead_id', leadId)
    if (dealId)         q = q.eq('deal_id', dealId)
    if (sourceSystem)   q = q.eq('source_system', sourceSystem)
    if (since)          q = q.gte('created_at', since)
    if (until)          q = q.lte('created_at', until)

    const { data: events, error } = await q

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const eventsData = events as Record<string, unknown>[] ?? []

    // ── Compute replay metadata ───────────────────────────────────────────
    const byType: Record<string, number> = {}
    const agents  = new Set<string>()
    const corrIds = new Set<string>()

    for (const ev of eventsData) {
      const t = String(ev.event_type ?? 'unknown')
      byType[t] = (byType[t] ?? 0) + 1
      if (ev.agent_email) agents.add(String(ev.agent_email))
      if (ev.correlation_id) corrIds.add(String(ev.correlation_id))
    }

    const first = eventsData[0]?.created_at ?? null
    const last  = eventsData[eventsData.length - 1]?.created_at ?? null
    const spanMs = first && last
      ? new Date(String(last)).getTime() - new Date(String(first)).getTime()
      : null

    return NextResponse.json({
      events:       eventsData,
      count:        eventsData.length,
      limit_applied: limit,
      filters: {
        correlation_id: correlationId,
        session_id:     sessionId,
        event_type:     eventType,
        lead_id:        leadId,
        deal_id:        dealId,
        source_system:  sourceSystem,
        since,
        until,
        order:          orderBy ? 'asc' : 'desc',
      },
      replay_meta: {
        first_event_at:       first,
        last_event_at:        last,
        span_ms:              spanMs,
        event_types:          byType,
        unique_agents:        agents.size,
        unique_correlations:  corrIds.size,
      },
    })

  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Internal error',
    }, { status: 500 })
  }
}
