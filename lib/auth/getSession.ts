import { auth } from '@/auth'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export interface SessionUser {
  id: string
  email: string
  role: string
  name: string
}

export interface AnySession {
  user: SessionUser
  expires: string
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Returns a session from either NextAuth (JWT cookie) or the portal magic-link
 * (ag-auth-token cookie). API routes that need to work with both auth systems
 * should call this instead of auth() directly.
 */
export async function getAnySession(): Promise<AnySession | null> {
  // 1. Try NextAuth first
  const nextAuthSession = await auth()
  if (nextAuthSession?.user?.id) {
    return {
      user: {
        id: nextAuthSession.user.id,
        email: nextAuthSession.user.email ?? '',
        role: nextAuthSession.user.role ?? 'user',
        name: nextAuthSession.user.name ?? '',
      },
      expires: nextAuthSession.expires,
    }
  }

  // 2. Fall back to portal magic-link ag-auth-token cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('ag-auth-token')?.value
  if (!token) return null

  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  // Verify HMAC signature
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return null
  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  if (sig !== expected) return null

  // Decode payload
  let data: { email: string; exp: number }
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch { return null }

  if (Date.now() > data.exp) return null
  if (!data.email) return null

  // Look up user by email (service role bypasses RLS)
  const supabase = getAdminClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, email, role, name')
    .eq('email', data.email)
    .single()

  if (!user) return null

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role ?? 'user',
      name: user.name ?? data.email,
    },
    expires: new Date(data.exp).toISOString(),
  }
}
