import { NextRequest, NextResponse } from 'next/server'
import { STATIC_FALLBACK, refreshZone } from '../route'

// ─── Auth helper ──────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (secret && auth === `Bearer ${secret}`) return true
  return false
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
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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
