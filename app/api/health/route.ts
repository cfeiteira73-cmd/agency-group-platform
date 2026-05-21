// =============================================================================
// Shallow health check — load balancer probe
// GET /api/health — no auth required, fast DB ping only
// Returns 200 if DB is reachable, 503 otherwise
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const start = Date.now()
  try {
    const { error } = await (supabaseAdmin as any)
      .from('organizations')
      .select('id')
      .limit(1)
      .single()

    const latency_ms = Date.now() - start

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (ok)
      return NextResponse.json({ status: 'unhealthy', latency_ms }, { status: 503 })
    }

    return NextResponse.json({ status: 'ok', latency_ms }, { status: 200 })
  } catch {
    return NextResponse.json({ status: 'unhealthy', latency_ms: Date.now() - start }, { status: 503 })
  }
}
