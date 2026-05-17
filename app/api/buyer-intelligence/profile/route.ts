// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// GET /api/buyer-intelligence/profile
// Public endpoint — no auth required.

import { NextRequest, NextResponse } from 'next/server'
import { buyerIntentProfiler } from '@/lib/buyer-intelligence/buyerIntentProfiler'
import type { BuyerIntentProfile } from '@/lib/buyer-intelligence/types'

export const runtime = 'nodejs'
export const maxDuration = 10

// ---------------------------------------------------------------------------
// Sanitize profile — strip raw events array from the response
// ---------------------------------------------------------------------------

function sanitizeProfile(profile: BuyerIntentProfile): Omit<BuyerIntentProfile, 'events'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { events: _events, ...safe } = profile
  return safe
}

// ---------------------------------------------------------------------------
// GET /api/buyer-intelligence/profile?session_id=X
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = req.nextUrl.searchParams.get('session_id')?.trim() ?? ''

  if (!sessionId) {
    return NextResponse.json({ profile: null }, { status: 200 })
  }

  try {
    const profile = buyerIntentProfiler.getProfile(sessionId)
    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 200 })
    }
    return NextResponse.json({ profile: sanitizeProfile(profile) }, { status: 200 })
  } catch {
    return NextResponse.json({ profile: null }, { status: 200 })
  }
}
