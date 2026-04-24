// =============================================================================
// Agency Group — Portal Match Proxy
// POST /api/portal/match
// Portal-facing wrapper for /api/automation/match-buyer
// Auth: portal session cookie or NextAuth (no PORTAL_API_SECRET needed in client)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { portalAuthGate } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  try {
    const body = await req.json()

    const secret = process.env.PORTAL_API_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'PORTAL_API_SECRET not configured' }, { status: 503 })
    }

    // Forward to the real match-buyer route with service auth
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.agencygroup.pt'
    const res = await fetch(`${baseUrl}/api/automation/match-buyer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
        'x-agent-email': gate.email,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[portal/match] Error:', err)
    return NextResponse.json({ error: 'Matching service unavailable' }, { status: 502 })
  }
}
