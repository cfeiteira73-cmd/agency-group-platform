// AGENCY GROUP — SH-ROS | Dashboard Layout
// Server-side auth guard for all /dashboard/* routes.
// Uses the same ag-auth-token cookie as the portal — NO changes to middleware.ts.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

// Mirror of verifyToken in middleware.ts — Web Crypto API, works in Node 18+ Server Components
async function verifyAgToken(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  try {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return false
    const payload = token.slice(0, dotIdx)
    const sig     = token.slice(dotIdx + 1)

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBuf  = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const sigHex  = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (sigHex !== sig) return false

    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return Date.now() < data.exp && (data.type === 'magic' || typeof data.email === 'string')
  } catch {
    return false
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('ag-auth-token')?.value

  if (!token || !(await verifyAgToken(token))) {
    redirect('/portal/login')
  }

  return <>{children}</>
}
