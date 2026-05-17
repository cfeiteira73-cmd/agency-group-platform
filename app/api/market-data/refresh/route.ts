import { NextRequest, NextResponse } from 'next/server'
import { STATIC_FALLBACK, refreshZone } from '../route'

// ─── Auth helper ──────────────────────────────────────────────────────────────
// SECURITY: x-vercel-cron header removed — not proof of authenticity.
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || req.headers.get('x-cron-secret') || ''
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return token === secret
}

// ─── GET /api/market-data/refresh (Vercel cron weekly) ───────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runRefresh()
}

// ─── POST /api/market-data/refresh (manual trigger) ──────────────────────────
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runRefresh()
}

// ─── Core refresh logic ───────────────────────────────────────────────────────
async function runRefresh(): Promise<NextResponse> {
  const allZones = Object.keys(STATIC_FALLBACK)
  const start = Date.now()

  const results = await Promise.allSettled(allZones.map(z => refreshZone(z)))

  const succeeded = results.filter(r => r.status === 'fulfilled').map((r, i) => ({
    zona: allZones[i],
    status: 'ok',
  }))
  const failed = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === 'rejected')
    .map(({ i }) => ({ zona: allZones[i], status: 'error' }))

  return NextResponse.json({
    success: true,
    zones_updated: succeeded.length,
    zones_failed: failed.length,
    zones: [...succeeded, ...failed],
    duration_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
  })
}
