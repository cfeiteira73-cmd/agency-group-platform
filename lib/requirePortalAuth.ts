// =============================================================================
// Agency Group — requirePortalAuth
// Unified portal auth helper accepting BOTH:
//   1. NextAuth v5 session (Google OAuth / credentials)
//   2. ag-auth-token cookie (magic-link HMAC-SHA256)
//   3. CRON_SECRET / INTERNAL_API_TOKEN header (crons + n8n)
//
// Usage:
//   import { requirePortalAuth } from '@/lib/requirePortalAuth'
//   const check = await requirePortalAuth(req)
//   if (!check.ok) return NextResponse.json({ error: check.error }, { status: 401 })
//   // check.email — authenticated user email
//   // check.via   — 'nextauth' | 'magic_link' | 'service_token'
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

export interface PortalAuthResult {
  ok: true
  email: string
  via: 'nextauth' | 'magic_link' | 'service_token'
}

export interface PortalAuthFailure {
  ok: false
  error: string
  response: NextResponse
}

export type PortalAuthCheck = PortalAuthResult | PortalAuthFailure

// ---------------------------------------------------------------------------
// Main helper
// ---------------------------------------------------------------------------

export async function requirePortalAuth(req: NextRequest): Promise<PortalAuthCheck> {
  // 1. ── Service tokens (crons + n8n internal calls) ─────────────────────────
  const cronSecret    = process.env.CRON_SECRET
  const internalToken = process.env.INTERNAL_API_TOKEN
  const incoming      = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')

  if (cronSecret    && incoming === cronSecret)    return { ok: true, email: 'cron@agencygroup.pt',     via: 'service_token' }
  if (internalToken && incoming === internalToken) return { ok: true, email: 'internal@agencygroup.pt', via: 'service_token' }

  // 2. ── NextAuth v5 session (Google OAuth / credentials) ────────────────────
  try {
    const session = await auth()
    if (session?.user?.email) {
      return { ok: true, email: session.user.email, via: 'nextauth' }
    }
  } catch {
    // auth() throws if called outside request context — fall through
  }

  // 3. ── Magic-link ag-auth-token cookie ─────────────────────────────────────
  const secret = process.env.AUTH_SECRET
  if (secret) {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get('ag-auth-token')?.value

    if (cookieValue) {
      const dotIdx = cookieValue.lastIndexOf('.')
      if (dotIdx !== -1) {
        const payload  = cookieValue.slice(0, dotIdx)
        const sig      = cookieValue.slice(dotIdx + 1)
        const expected = createHmac('sha256', secret).update(payload).digest('hex')

        if (expected === sig) {
          try {
            const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email?: string; exp?: number }
            if (data.email && data.exp && Date.now() < data.exp) {
              return { ok: true, email: data.email, via: 'magic_link' }
            }
          } catch {
            // Invalid JSON — fall through
          }
        }
      }
    }
  }

  // 4. ── Unauthenticated ──────────────────────────────────────────────────────
  const failure: PortalAuthFailure = {
    ok: false,
    error: 'Unauthorized — valid session or service token required',
    response: NextResponse.json(
      { error: 'Unauthorized — valid session or service token required' },
      { status: 401 }
    ),
  }
  return failure
}

// ---------------------------------------------------------------------------
// Convenience wrapper for simple gate (returns response or null)
// ---------------------------------------------------------------------------

export async function portalAuthGate(
  req: NextRequest
): Promise<{ authed: false; response: NextResponse } | { authed: true; email: string; via: string }> {
  const check = await requirePortalAuth(req)
  if (!check.ok) return { authed: false, response: check.response }
  return { authed: true, email: check.email, via: check.via }
}
