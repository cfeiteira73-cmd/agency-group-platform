// =============================================================================
// Agency Group — Platform Adoption Analytics API
// GET  /api/analytics/adoption — adoption metrics by user/feature
// POST /api/analytics/adoption — record adoption event
// Auth: portal auth required
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'

// Features tracked for adoption scoring
const CORE_FEATURES = [
  'sofia_chat', 'deal_pack', 'match_engine', 'lead_score',
  'calendar', 'bulk_whatsapp', 'export', 'avm', 'market_intel',
  'pipeline_view', 'contact_notes', 'property_search',
] as const

interface AdoptionEvent {
  user_email: string
  user_role: string | null
  feature_name: string
  action: string
  occurred_at: string
}

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') || '30'), 90)
  const userEmail = searchParams.get('user') || undefined

  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('adoption_events')
      .select('user_email,user_role,feature_name,action,occurred_at')
      .gte('occurred_at', since)

    if (userEmail) query = query.eq('user_email', userEmail)

    const { data: rawEvents = [], error } = await query as { data: AdoptionEvent[]; error: { message: string } | null }

    if (error) {
      log.warn('[adoption] query error', { route: 'api/analytics/adoption', error: error.message })
    }

    const events = rawEvents ?? []

    // Feature adoption rates
    const feature_usage: Record<string, { uses: number; unique_users: Set<string>; last_used: string }> = {}
    const user_features: Record<string, Set<string>> = {}

    for (const e of events) {
      const feat = e.feature_name
      const user = e.user_email

      if (!feature_usage[feat]) feature_usage[feat] = { uses: 0, unique_users: new Set(), last_used: '' }
      feature_usage[feat].uses++
      feature_usage[feat].unique_users.add(user)
      if (!feature_usage[feat].last_used || e.occurred_at > feature_usage[feat].last_used) {
        feature_usage[feat].last_used = e.occurred_at
      }

      if (!user_features[user]) user_features[user] = new Set()
      user_features[user].add(feat)
    }

    const totalUsers = Object.keys(user_features).length

    const features = Object.entries(feature_usage).map(([name, data]) => ({
      feature: name,
      uses: data.uses,
      unique_users: data.unique_users.size,
      last_used: data.last_used,
      adoption_rate: Math.round((data.unique_users.size / Math.max(totalUsers, 1)) * 100),
    })).sort((a, b) => b.uses - a.uses)

    // User adoption scores (% of CORE_FEATURES used in period)
    const user_scores = Object.entries(user_features).map(([email, feats]) => {
      const coreUsed = CORE_FEATURES.filter(f => feats.has(f)).length
      return {
        user: email,
        features_used: feats.size,
        core_features_used: coreUsed,
        adoption_score: Math.round((coreUsed / CORE_FEATURES.length) * 100),
        feature_list: Array.from(feats),
      }
    }).sort((a, b) => b.adoption_score - a.adoption_score)

    // Unused core features
    const unused_core = userEmail
      ? CORE_FEATURES.filter(f => !(user_features[userEmail]?.has(f)))
      : CORE_FEATURES.filter(f => !feature_usage[f])

    // Daily active usage trend (capped at 30 days regardless of query period)
    const trendDays = Math.min(days, 30)
    const trend = Array.from({ length: trendDays }, (_, i) => {
      const d = new Date(Date.now() - (trendDays - 1 - i) * 86_400_000)
      const dateStr = d.toISOString().slice(0, 10)
      const dayEvents = events.filter(e => e.occurred_at?.slice(0, 10) === dateStr)
      return {
        date: dateStr,
        events: dayEvents.length,
        unique_users: new Set(dayEvents.map(e => e.user_email)).size,
      }
    })

    const overall_adoption = user_scores.length
      ? Math.round(user_scores.reduce((s, u) => s + u.adoption_score, 0) / user_scores.length)
      : 0

    return NextResponse.json({
      period_days: days,
      total_events: events.length,
      active_users: user_scores.length,
      overall_adoption_score: overall_adoption,
      core_features_tracked: CORE_FEATURES.length,
      features,
      user_scores: user_scores.slice(0, 20),
      unused_core,
      trend,
    }, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[adoption] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/adoption' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface AdoptionPostBody {
  user_email: string
  user_role?: string
  feature_name: string
  action?: string
  session_id?: string
  metadata?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)

  try {
    const body = await req.json() as AdoptionPostBody

    if (!body.user_email || !body.feature_name) {
      return NextResponse.json(
        { error: 'user_email and feature_name required' },
        { status: 400 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from('adoption_events').insert({
      user_email:   body.user_email,
      user_role:    body.user_role ?? null,
      feature_name: body.feature_name,
      action:       body.action ?? 'used',
      session_id:   body.session_id ?? null,
      metadata:     body.metadata ?? null,
    })

    if (error) {
      log.error('[adoption] INSERT error', new Error((error as { message: string }).message), { route: 'api/analytics/adoption' })
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, {
      status: 201,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.error('[adoption] POST error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/adoption' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
