import { auth } from '@/auth'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export interface SessionUser {
  id: string
  email: string
  role: string
  name: string
  /** Identifies the authentication mechanism used to establish this session. */
  authSource: 'nextauth' | 'magic_link'
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
 * Returns the effective authorization role for mandate route operations.
 *
 * NextAuth sessions pass their DB role unchanged — a NextAuth admin retains
 * full admin scope across all mandate and contact access checks.
 *
 * Magic-link sessions are capped at non-admin scope regardless of DB role.
 * This prevents a compromised magic-link token from granting admin-level
 * CRM enumeration (all contacts, all mandates belonging to other agents).
 * The session still carries the real DB role in user.role for audit/context.
 *
 * Design: magic-link admin users can access only their OWN mandates
 * (owner_id === session.user.id), which is the intended portal workflow.
 * Cross-agent admin enumeration via magic-link is explicitly disallowed.
 */
export function mandateAuthRole(session: AnySession): string {
  if (session.user.authSource === 'magic_link' && session.user.role === 'admin') {
    // Cap to agent: verifyMandateAccess falls through to owner_id check,
    // granting access to the user's own mandates only.
    return 'agent'
  }
  return session.user.role
}

/**
 * Returns a session from either NextAuth (JWT cookie) or the portal magic-link
 * (ag-auth-token cookie). API routes that need to work with both auth systems
 * should call this instead of auth() directly.
 *
 * Security invariants:
 *   - Both paths resolve user identity against public.users via service role
 *   - Both paths enforce is_active (NULL treated as active — canonical semantics)
 *   - authSource field records the mechanism for downstream authorization decisions
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
        authSource: 'nextauth',
      },
      expires: nextAuthSession.expires,
    }
  }

  // 2. Fall back to portal magic-link ag-auth-token cookie
  // cookies() throws outside a Next.js request context (e.g. test runners,
  // cron jobs, server actions called without a request store). Return null
  // gracefully — no request context means no ag-auth-token to read.
  let cookieStore: Awaited<ReturnType<typeof cookies>>
  try {
    cookieStore = await cookies()
  } catch {
    return null
  }
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
    .select('id, email, role, name, is_active')
    .eq('email', data.email)
    .single()

  // Reject unknown email or explicitly deactivated account.
  // NULL is_active is treated as active — mirrors auth.ts authorize() semantics
  // where only `is_active === false` (not null) denies access.
  if (!user || user.is_active === false) return null

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role ?? 'user',
      name: user.name ?? data.email,
      authSource: 'magic_link',
    },
    expires: new Date(data.exp).toISOString(),
  }
}
