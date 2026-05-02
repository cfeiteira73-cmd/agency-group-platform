// GET /api/cron/health-check
// Hourly: checks platform health, creates alerts for any degradation.

import { NextRequest, NextResponse }   from 'next/server'
import { supabaseAdmin }               from '@/lib/supabase'
import { createAlert, buildAlert }     from '@/lib/ops/alertEngine'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any
  const alerts: string[] = []
  const checks: Record<string, unknown> = {}

  // 1. Check for overdue review queue items (>2h pending)
  const { data: overdueReviews } = await admin
    .from('deal_review_queue')
    .select('id')
    .eq('status', 'pending')
    .lt('queued_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

  checks.overdue_reviews = (overdueReviews ?? []).length
  if ((overdueReviews ?? []).length > 0) {
    const id = await createAlert(buildAlert(
      'review_queue_overdue',
      '⚠️ Review Queue Overdue',
      `${(overdueReviews ?? []).length} deal(s) pending review for >2 hours.`,
      { count: (overdueReviews ?? []).length },
      'review_queue_overdue',
    ))
    if (id) alerts.push(id)
  }

  // 2. Check for dead jobs
  const { data: deadJobs } = await admin
    .from('job_queue')
    .select('id, job_type')
    .eq('status', 'dead')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  checks.dead_jobs_24h = (deadJobs ?? []).length
  if ((deadJobs ?? []).length > 0) {
    const id = await createAlert(buildAlert(
      'job_dead_letter',
      '🚨 Dead-Letter Jobs Detected',
      `${(deadJobs ?? []).length} job(s) exhausted retry attempts in last 24h.`,
      { jobs: (deadJobs ?? []).map((j: { job_type: string }) => j.job_type) },
      `dead_jobs_${new Date().toISOString().split('T')[0]}`,
    ))
    if (id) alerts.push(id)
  }

  // 3. Check for critical data quality flags
  const { data: critFlags } = await admin
    .from('data_quality_flags')
    .select('id')
    .eq('status', 'open')
    .eq('severity', 'critical')

  checks.critical_quality_flags = (critFlags ?? []).length
  if ((critFlags ?? []).length >= 5) {
    const id = await createAlert(buildAlert(
      'data_quality_critical',
      '⚠️ Critical Data Quality Flags',
      `${(critFlags ?? []).length} critical quality flags remain unresolved.`,
      { count: (critFlags ?? []).length },
      'data_quality_critical',
    ))
    if (id) alerts.push(id)
  }

  // 4. Check last cron runs
  const { data: cronLogs } = await admin
    .from('automations_log')
    .select('automation_type, ran_at, outcome')
    .in('automation_type', ['cron_avm_compute', 'cron_ingest_listings', 'cron_sync_listings'])
    .gte('ran_at', new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString())

  const cronTypes = new Set((cronLogs ?? []).map((r: { automation_type: string }) => r.automation_type))
  const missingCrons = ['cron_avm_compute', 'cron_sync_listings'].filter(t => !cronTypes.has(t))

  checks.missing_crons = missingCrons
  if (missingCrons.length > 0) {
    const id = await createAlert(buildAlert(
      'cron_failure',
      '🚨 Cron Job Missing',
      `${missingCrons.join(', ')} did not run in the last 26 hours.`,
      { missing: missingCrons },
      `cron_missing_${missingCrons.join('_')}_${new Date().toISOString().split('T')[0]}`,
    ))
    if (id) alerts.push(id)
  }

  return NextResponse.json({
    checks,
    alerts_created: alerts.length,
    alert_ids:      alerts,
    checked_at:     new Date().toISOString(),
  })
}
