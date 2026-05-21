// Agency Group — Portal Auth Guard
// lib/middleware/portalAuthGuard.ts
// TypeScript strict — 0 errors
//
// Middleware utility for portal API routes requiring authentication.
// Supports: INTERNAL_API_SECRET (Bearer), CRON_SECRET, NextAuth session.
// Returns standardized auth result — not an Express middleware, a helper function.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { auth } from '@/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthMethod = 'bearer' | 'cron' | 'nextauth' | 'public'

export interface AuthResult {
  authenticated: boolean
  method: AuthMethod
  tenant_id: string
  user_id: string | null
  role: string | null
  denial_reason: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// ─── safeCompare ──────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison using crypto.timingSafeEqual.
 * Returns false when lengths differ — prevents length-leak timing oracle.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// ─── extractBearerToken ───────────────────────────────────────────────────────

/**
 * Extracts the token from Authorization: Bearer <token> header.
 * Also checks x-cron-secret header for cron routes.
 * Returns null if no token found.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    return token.length > 0 ? token : null
  }
  const cronHeader = req.headers.get('x-cron-secret')
  return cronHeader && cronHeader.trim().length > 0 ? cronHeader.trim() : null
}

// ─── authenticatePortalRequest ────────────────────────────────────────────────

/**
 * Authenticates a portal API request.
 * Tries in order: Bearer (INTERNAL_API_TOKEN or CRON_SECRET) → NextAuth → deny.
 */
export async function authenticatePortalRequest(req: Request): Promise<AuthResult> {
  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret = process.env.CRON_SECRET

  // 1. Bearer / cron secret
  const token = extractBearerToken(req)
  if (token) {
    if (cronSecret && safeCompare(token, cronSecret)) {
      return {
        authenticated: true,
        method: 'cron',
        tenant_id: DEFAULT_TENANT_ID,
        user_id: 'cron_service',
        role: 'cron_service',
        denial_reason: null,
      }
    }

    if (internalToken && safeCompare(token, internalToken)) {
      return {
        authenticated: true,
        method: 'bearer',
        tenant_id: DEFAULT_TENANT_ID,
        user_id: 'internal_service',
        role: 'tenant_admin',
        denial_reason: null,
      }
    }

    // Token present but invalid
    return {
      authenticated: false,
      method: 'bearer',
      tenant_id: DEFAULT_TENANT_ID,
      user_id: null,
      role: null,
      denial_reason: 'invalid_bearer_token',
    }
  }

  // 2. NextAuth session
  try {
    const session = await auth()
    if (session?.user?.email) {
      return {
        authenticated: true,
        method: 'nextauth',
        tenant_id: DEFAULT_TENANT_ID,
        user_id: session.user.id ?? session.user.email,
        role: session.user.role ?? 'agent',
        denial_reason: null,
      }
    }
  } catch {
    // auth() can throw outside request context — fall through to deny
  }

  // 3. Deny
  return {
    authenticated: false,
    method: 'public',
    tenant_id: DEFAULT_TENANT_ID,
    user_id: null,
    role: null,
    denial_reason: 'no_valid_auth',
  }
}

// ─── requireAuth ──────────────────────────────────────────────────────────────

/**
 * Returns AuthResult if authenticated, or a 401 NextResponse.
 *
 * Usage:
 *   const authResult = await requireAuth(req)
 *   if (authResult instanceof Response) return authResult
 */
export async function requireAuth(req: Request): Promise<AuthResult | Response> {
  const result = await authenticatePortalRequest(req)

  if (!result.authenticated) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        reason: result.denial_reason ?? 'unauthenticated',
      },
      { status: 401 },
    )
  }

  return result
}

// ─── requireRole ─────────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  agent: 1,
  manager: 2,
  tenant_admin: 3,
  admin: 3,
  super_admin: 4,
  cron_service: 2,
  compliance_officer: 2,
  data_analyst: 2,
  webhook_receiver: 1,
  investor_portal: 1,
}

/**
 * Returns AuthResult if authenticated AND role meets required level, or a 401/403 NextResponse.
 *
 * Usage:
 *   const authResult = await requireRole(req, 'manager')
 *   if (authResult instanceof Response) return authResult
 */
export async function requireRole(
  req: Request,
  requiredRole: string,
): Promise<AuthResult | Response> {
  const authResult = await requireAuth(req)

  // If requireAuth returned a Response (401), pass it through
  if (authResult instanceof Response) return authResult

  const actorLevel = ROLE_HIERARCHY[authResult.role ?? 'agent'] ?? 1
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 1

  if (actorLevel < requiredLevel) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        reason: `role '${authResult.role}' does not meet required role '${requiredRole}'`,
      },
      { status: 403 },
    )
  }

  return authResult
}
