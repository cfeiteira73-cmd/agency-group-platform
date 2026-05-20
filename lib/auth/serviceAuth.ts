// =============================================================================
// Agency Group — requireServiceAuth
// lib/auth/serviceAuth.ts
//
// Validates that the request is from a trusted internal service.
// ONLY accepts CRON_SECRET or INTERNAL_API_TOKEN.
// Does NOT accept user sessions (use requirePortalAuth for user routes).
//
// Usage:
//   import { requireServiceAuth } from '@/lib/auth/serviceAuth'
//   const check = await requireServiceAuth(req)
//   if (!check.ok) return check.response
//   // check.identity — 'cron' | 'internal'
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'

export interface ServiceAuthResult {
  ok: true
  identity: 'cron' | 'internal'
}

export interface ServiceAuthFailure {
  ok: false
  response: NextResponse
}

export type ServiceAuthCheck = ServiceAuthResult | ServiceAuthFailure

export async function requireServiceAuth(req: NextRequest): Promise<ServiceAuthCheck> {
  const cronSecret    = process.env.CRON_SECRET
  const internalToken = process.env.INTERNAL_API_TOKEN

  if (!cronSecret && !internalToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Service auth not configured' }, { status: 503 }),
    }
  }

  // Accept x-cron-secret header or Authorization: Bearer <token>
  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''

  if (cronSecret && safeCompare(incoming, cronSecret)) {
    return { ok: true, identity: 'cron' }
  }

  if (internalToken && safeCompare(incoming, internalToken)) {
    return { ok: true, identity: 'internal' }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}
