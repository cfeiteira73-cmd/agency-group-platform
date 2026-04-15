// =============================================================================
// Portal Auth Helper — verifies one of:
//   1. x-cron-secret / Authorization: Bearer header (CRON_SECRET or INTERNAL_API_TOKEN)
//   2. ag-auth-token cookie (portal magic-link session, HMAC-SHA256 signed)
//
// Usage in route handlers (nodejs runtime only):
//   import { isPortalAuth } from '@/lib/portalAuth'
//   if (!(await isPortalAuth(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// =============================================================================

import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

export async function isPortalAuth(req: NextRequest): Promise<boolean> {
  // 1. CRON_SECRET or INTERNAL_API_TOKEN header (crons + n8n internal calls)
  const cronSecret     = process.env.CRON_SECRET
  const internalToken  = process.env.INTERNAL_API_TOKEN
  const incoming       = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret    && incoming === cronSecret)   return true
  if (internalToken && incoming === internalToken) return true

  // 2. ag-auth-token cookie (portal magic-link session)
  const secret = process.env.AUTH_SECRET
  if (!secret) return false

  const cookieStore  = await cookies()
  const cookieValue  = cookieStore.get('ag-auth-token')?.value
  if (!cookieValue) return false

  const dotIdx = cookieValue.lastIndexOf('.')
  if (dotIdx === -1) return false

  const payload  = cookieValue.slice(0, dotIdx)
  const sig      = cookieValue.slice(dotIdx + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  if (expected !== sig) return false

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return !!data.email && Date.now() < data.exp
  } catch {
    return false
  }
}
