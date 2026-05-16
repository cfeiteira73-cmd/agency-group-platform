// AGENCY GROUP — SH-ROS | Dashboard Layout
// Server-side auth guard for all /dashboard/* routes.
// Uses the same ag-auth-token cookie + identical verify logic as lib/portalAuth.ts.
// NO changes to middleware.ts required.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHmac } from 'crypto'
import type { ReactNode } from 'react'

async function verifyPortalCookie(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return false
    const payload = token.slice(0, dotIdx)
    const sig     = token.slice(dotIdx + 1)
    // Must match lib/portalAuth.ts exactly — Node.js HMAC, base64url decode
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    if (expected !== sig) return false
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return !!data.email && Date.now() < data.exp
  } catch {
    return false
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  // Accept both production (__Secure-) and development cookie names (same as /api/auth/me)
  const token =
    cookieStore.get('__Secure-ag-auth-token')?.value ??
    cookieStore.get('ag-auth-token')?.value

  if (!token || !(await verifyPortalCookie(token))) {
    redirect('/portal/login')
  }

  return <>{children}</>
}
