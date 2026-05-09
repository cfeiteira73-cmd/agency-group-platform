// =============================================================================
// Agency Group — Data Quality Analytics API
// GET /api/analytics/data-quality — data quality scores and issues
// Auth: portal auth required
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { generateDataQualityReport, scoreContact } from '@/lib/commercial/dataQuality'
import log from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const includeContacts = searchParams.get('contacts') !== 'false'
  const severity = searchParams.get('severity') ?? undefined

  try {
    // Generate quality report from lib
    const report = await generateDataQualityReport()

    // Get recent unfixed quality events from DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let eventsQuery = supabaseAdmin
      .from('data_quality_events')
      .select('*')
      .eq('auto_fixed', false)
      .order('detected_at', { ascending: false })
      .limit(100)

    if (severity) eventsQuery = eventsQuery.eq('severity', severity as 'low' | 'medium' | 'high' | 'critical')

    const { data: events = [] } = await eventsQuery as { data: unknown[] }

    // Grade breakdown as percentages
    const total_graded = Object.values(report.grade_distribution).reduce((s, v) => s + (v as number), 0)
    const grade_pct = Object.fromEntries(
      Object.entries(report.grade_distribution).map(([g, count]) => [
        g,
        total_graded ? Math.round(((count as number) / total_graded) * 100) : 0,
      ]),
    )

    // Contacts needing immediate attention (score < 60)
    type CriticalContact = { id: string; full_name: string; score: number; issues: string[] }
    let critical_contacts: CriticalContact[] = []

    if (includeContacts) {
      const { data: contacts } = await supabaseAdmin
        .from('contacts')
        .select('id,full_name,email,phone,status,budget_min,budget_max,preferred_locations,typologies_wanted,language,nationality,gdpr_consent,assigned_to,last_contact_at')
        .in('status', ['lead', 'prospect', 'qualified', 'active', 'negotiating', 'client', 'vip', 'dormant', 'referrer'])
        .limit(200)

      if (contacts) {
        critical_contacts = contacts
          .map(c => {
            const s = scoreContact(c as Record<string, unknown>)
            return {
              id: String(c.id),
              full_name: String((c as Record<string, unknown>).full_name ?? ''),
              score: s.score,
              issues: [...s.missing_fields, ...s.anomalies],
            }
          })
          .filter(c => c.score < 60)
          .sort((a, b) => a.score - b.score)
          .slice(0, 20)
      }
    }

    return NextResponse.json({
      report: {
        ...report,
        grade_pct,
      },
      critical_contacts,
      recent_events: events,
      summary: {
        health_status: report.avg_contact_score >= 80
          ? 'healthy'
          : report.avg_contact_score >= 65
            ? 'needs_attention'
            : 'critical',
        action_required: report.critical_issues > 0 || report.avg_contact_score < 65,
      },
    }, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[data-quality] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/analytics/data-quality' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
