import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    return NextResponse.json({ success: true, purged: count, cutoff: cutoffDate.toISOString() })
  } catch (err) {
    console.error('[GDPR Purge] Error:', err)
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
  }
}
