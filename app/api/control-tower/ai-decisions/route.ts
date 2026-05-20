import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const agentId   = searchParams.get('agent_id')
  const since     = searchParams.get('since')  // ISO timestamp
  const modelFilter = searchParams.get('model')

  try {
    // Use dynamic import to lazy-load Supabase (same pattern as other routes)
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('ai_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (agentId) query = query.eq('circuit_name', agentId)
    if (since) query = query.gte('created_at', since)
    if (modelFilter) query = query.eq('model', modelFilter)

    const { data, error } = await query
    if (error) {
      console.error('[control-tower/ai-decisions] DB error:', error, { corrId })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const summary = {
      total: data?.length ?? 0,
      fallback_count: data?.filter((d: { fallback_used: boolean }) => d.fallback_used).length ?? 0,
      error_count: data?.filter((d: { success: boolean }) => !d.success).length ?? 0,
      avg_latency_ms: data?.length
        ? Math.round(data.reduce((s: number, d: { latency_ms: number }) => s + (d.latency_ms ?? 0), 0) / data.length)
        : 0,
    }

    return NextResponse.json({ decisions: data, summary })
  } catch (error) {
    console.error('[control-tower/ai-decisions] Error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
