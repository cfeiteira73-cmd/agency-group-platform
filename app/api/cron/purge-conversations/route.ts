import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'
import { cronCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[Cron] CRON_SECRET env var not set — refusing to run')
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!safeCompare(authHeader ?? '', expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId = cronCorrelationId('purge-conversations')
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabaseAdmin as any)
      .from('sofia_conversations')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('count')

    if (error) throw error

    console.log(`[GDPR Purge] Deleted ${count ?? 'unknown'} conversations older than 90 days`)
    return NextResponse.json({ success: true, purged: count, cutoff: cutoffDate.toISOString(), correlation_id: corrId }, { headers: { 'x-correlation-id': corrId } })
  } catch (err) {
    console.error('[GDPR Purge] Error:', err)
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }
}
