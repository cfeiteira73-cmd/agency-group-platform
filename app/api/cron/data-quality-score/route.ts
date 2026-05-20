// =============================================================================
// Agency Group — Data Quality Scoring Cron
// GET /api/cron/data-quality-score — runs quality scoring + logs events
// Auth: CRON_SECRET
// Cadence: Daily at 06:00 UTC (add to vercel.json)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withCronLock } from '@/lib/ops/withCronLock'
import { safeCompare } from '@/lib/safeCompare'
import { supabaseAdmin } from '@/lib/supabase'
import { scoreContact, generateDataQualityReport } from '@/lib/commercial/dataQuality'
import { cronCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret   = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
    ?? ''

  if (!secret || !safeCompare(incoming, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lockResult = await withCronLock('data-quality-score', 2, async () => {
  const corrId    = cronCorrelationId('data-quality-score')
  const startedAt = new Date().toISOString()

  log.info('[cron:data-quality-score] Starting', { route: 'api/cron/data-quality-score', correlation_id: corrId })

  try {
    // Generate aggregate report
    const report = await generateDataQualityReport()

    // Fetch active contacts for per-record event logging
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id,full_name,email,phone,status,budget_min,budget_max,preferred_locations,typologies_wanted,language,nationality,gdpr_consent,assigned_to,last_contact_at')
      .in('status', ['lead', 'prospect', 'qualified', 'active', 'negotiating', 'client', 'vip', 'dormant', 'referrer'])
      .limit(300)

    let events_logged = 0

    if (contacts) {
      for (const contact of contacts) {
        const scored = scoreContact(contact as Record<string, unknown>)

        if (scored.missing_fields.length === 0 && scored.anomalies.length === 0) continue

        // Cap at 3 issues per contact to reduce noise
        const issues = [
          ...scored.missing_fields.map(f => ({ field: f, type: 'missing' as const, sev: 'medium' as const })),
          ...scored.anomalies.map(f => ({ field: f, type: 'anomaly' as const, sev: 'high' as const })),
        ].slice(0, 3)

        for (const issue of issues) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          try {
            await supabaseAdmin
              .from('data_quality_events')
              .upsert({
                resource_type: 'contact',
                resource_id:   contact.id,
                field_name:    issue.field,
                issue_type:    issue.type,
                severity:      issue.sev,
                detected_at:   new Date().toISOString(),
              }, { onConflict: 'resource_type,resource_id,field_name,issue_type' })
          } catch {
            // Non-fatal: upsert failures are tolerated to keep cron running
          }
          events_logged++
        }
      }
    }

    // Log run to automations_log
    try {
      await supabaseAdmin
        .from('automations_log')
        .insert({
          workflow_name: 'data-quality-score',
          trigger_type:  'cron',
          status:        'success',
          started_at:    startedAt,
          completed_at:  new Date().toISOString(),
          outcome: {
            avg_score:       report.avg_contact_score,
            critical_issues: report.critical_issues,
            events_logged,
            correlation_id:  corrId,
          },
        })
    } catch {
      // Non-fatal: automation log write failure should not fail the cron
    }

    log.info('[cron:data-quality-score] Complete', {
      route:          'api/cron/data-quality-score',
      correlation_id: corrId,
      avg_score:      report.avg_contact_score,
      critical:       report.critical_issues,
      events_logged,
    })

    return NextResponse.json({
      success: true,
      report: {
        avg_score:          report.avg_contact_score,
        critical_issues:    report.critical_issues,
        grade_distribution: report.grade_distribution,
      },
      events_logged,
      correlation_id: corrId,
    })
  } catch (err) {
    log.error(
      '[cron:data-quality-score] Error',
      err instanceof Error ? err : new Error(String(err)),
      { route: 'api/cron/data-quality-score', correlation_id: corrId },
    )
    return NextResponse.json({ error: 'Scoring failed', correlation_id: corrId }, { status: 500 })
  }
  }) // end withCronLock

  if (lockResult === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }
  return lockResult
}
