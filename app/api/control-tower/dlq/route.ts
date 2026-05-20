import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const corrId = getRequestCorrelationId(req)

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dlqEvents, error } = await (supabase as any)
      .from('learning_events')
      .select('id, event_type, created_at, metadata')
      .eq('metadata->>dlq', 'true')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[control-tower/dlq] DB error:', error, { corrId })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const byType: Record<string, number> = {}
    for (const ev of dlqEvents ?? []) {
      byType[ev.event_type] = (byType[ev.event_type] ?? 0) + 1
    }

    return NextResponse.json({
      total: dlqEvents?.length ?? 0,
      by_type: byType,
      events: dlqEvents ?? [],
    })
  } catch (error) {
    console.error('[control-tower/dlq] Error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Trigger manual DLQ replay
  const siteUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000'
  const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`

  try {
    const res = await fetch(`${baseUrl}/api/cron/replay-dlq`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
    })
    const result = await res.json()
    return NextResponse.json({ triggered: true, result })
  } catch (error) {
    console.error('[control-tower/dlq] Replay trigger error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
