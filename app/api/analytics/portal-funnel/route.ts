// GET /api/analytics/portal-funnel
// Portal-auth-compatible funnel + attribution endpoint.
// Uses email Bearer token (same pattern as all other portal API routes).
// Extends /api/analytics/funnel with source attribution from contacts table.

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole }                from '@/lib/auth/adminAuth'
import {
  fetchFunnelCounts,
  computeFunnelConversions,
  computeGradeConversions,
}                                      from '@/lib/analytics/funnelMetrics'
import { supabaseAdmin }               from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Portal magic-link auth: Authorization: Bearer <email>
  const email = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(email)
  if (!admin)  return NextResponse.json({ error: 'Forbidden'    }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const days  = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30'), 1), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  try {
    const [counts, gradeRes, sourceRes, campaignRes] = await Promise.allSettled([
      fetchFunnelCounts(since),

      // Grade-level distribution vs close (revenue_attribution table)
      db.from('revenue_attribution')
        .select('attributed_score_grade, close_status, commission_total')
        .gte('created_at', since.toISOString()),

      // Lead source attribution from contacts
      db.from('contacts')
        .select('source, status, lead_score, created_at')
        .gte('created_at', since.toISOString()),

      // Campaign performance
      db.from('campanhas')
        .select('name, status, type, metrics, sent_at, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    // ── Funnel ─────────────────────────────────────────────────────────────────
    const funnelCounts = counts.status === 'fulfilled' ? counts.value : {
      ingested: 0, scored: 0, distributed: 0, opened: 0,
      replied: 0, meetings: 0, offers: 0, closed: 0,
    }
    const funnel = computeFunnelConversions(funnelCounts)

    // ── Grade conversions ──────────────────────────────────────────────────────
    const gradeData = gradeRes.status === 'fulfilled' ? (gradeRes.value.data ?? []) : []
    const gradeCounts: Record<string, { distributed: number; closed: number; commission: number }> = {}
    for (const row of gradeData as Array<{
      attributed_score_grade: string | null
      close_status: string
      commission_total: number | null
    }>) {
      const g = row.attributed_score_grade ?? 'unknown'
      if (!gradeCounts[g]) gradeCounts[g] = { distributed: 0, closed: 0, commission: 0 }
      gradeCounts[g].distributed++
      if (row.close_status === 'won') {
        gradeCounts[g].closed++
        gradeCounts[g].commission += row.commission_total ?? 0
      }
    }
    const gradeConversions = computeGradeConversions(
      Object.entries(gradeCounts).map(([grade, v]) => ({
        grade,
        distributed:    v.distributed,
        closed:         v.closed,
        avg_commission: v.closed > 0 ? parseFloat((v.commission / v.closed).toFixed(2)) : null,
      })),
    )

    // ── Source attribution ─────────────────────────────────────────────────────
    const sourceData = sourceRes.status === 'fulfilled' ? (sourceRes.value.data ?? []) : []
    const sourceMap: Record<string, { leads: number; active: number; score_sum: number }> = {}
    for (const row of sourceData as Array<{
      source: string | null
      status: string | null
      lead_score: number | null
    }>) {
      const s = row.source ?? 'direct'
      if (!sourceMap[s]) sourceMap[s] = { leads: 0, active: 0, score_sum: 0 }
      sourceMap[s].leads++
      if (row.status && !['inactive', 'lost'].includes(row.status)) sourceMap[s].active++
      sourceMap[s].score_sum += row.lead_score ?? 0
    }
    const sourceAttribution = Object.entries(sourceMap)
      .map(([source, v]) => ({
        source,
        leads:               v.leads,
        active:              v.active,
        conversion_rate_pct: v.leads > 0
          ? parseFloat((v.active / v.leads * 100).toFixed(1))
          : 0,
        avg_score: v.leads > 0
          ? parseFloat((v.score_sum / v.leads).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.leads - a.leads)

    // ── Campaign summary ───────────────────────────────────────────────────────
    type CampMetrics = { opens?: number; clicks?: number; bounces?: number } | null
    const campaignData = campaignRes.status === 'fulfilled'
      ? (campaignRes.value.data ?? []) as Array<{
          name: string
          status: string
          type: string
          metrics: CampMetrics
          sent_at: string | null
          created_at: string
        }>
      : []

    const campaignSummary = campaignData.map(c => {
      const m = c.metrics ?? {}
      return {
        name:       c.name,
        status:     c.status,
        type:       c.type,
        opens:      (m as Record<string, number>).opens      ?? 0,
        clicks:     (m as Record<string, number>).clicks     ?? 0,
        bounces:    (m as Record<string, number>).bounces    ?? 0,
        sent_at:    c.sent_at,
        created_at: c.created_at,
      }
    })
    const totalSent  = campaignSummary.filter(c => c.status === 'sent').length
    const totalOpens = campaignSummary.reduce((s, c) => s + c.opens, 0)
    const totalSentEmails = campaignSummary.reduce((s, c) => s + c.opens + c.bounces, 0)
    const avgOpenRate = totalSentEmails > 0
      ? parseFloat((totalOpens / totalSentEmails * 100).toFixed(1))
      : null

    return NextResponse.json({
      period_days:        days,
      since:              since.toISOString(),
      funnel,
      grade_conversions:  gradeConversions,
      source_attribution: sourceAttribution,
      campaigns: {
        total:          campaignData.length,
        sent:           totalSent,
        avg_open_rate:  avgOpenRate,
        recent:         campaignSummary.slice(0, 10),
      },
      raw_counts:   funnelCounts,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[portal-funnel] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
