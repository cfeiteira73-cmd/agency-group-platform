// =============================================================================
// Agency Group — Data Moat Score API
// GET /api/analytics/moat — competitive defensibility score
// Auth: requirePortalAuth (admin only check via email domain)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { computeMoatScore } from '@/lib/commercial/moat'
import log from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  try {
    const score = await computeMoatScore()

    const cachedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    log.info('[moat API] score served', {
      route: 'api/analytics/moat',
      agent_email: check.email,
    })

    return NextResponse.json(
      { ...score, cached_until: cachedUntil },
      {
        headers: {
          'Cache-Control': 'private, max-age=3600',
        },
      }
    )
  } catch (err) {
    log.error('[moat API] GET error', err instanceof Error ? err : new Error(String(err)), {
      route: 'api/analytics/moat',
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
