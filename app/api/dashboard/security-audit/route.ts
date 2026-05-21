// app/api/dashboard/security-audit/route.ts
// Full portal security audit
// GET = latest cached; POST = fresh audit
// runtime = 'nodejs', maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { runPortalSecurityAudit } from '@/lib/dashboard/portalSecurityAudit'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // 1. Bearer: INTERNAL_API_TOKEN or INTERNAL_API_SECRET
  const incoming = (req.headers.get('authorization') ?? '')
    .replace('Bearer ', '')
    .trim()
  if (incoming.length > 0) {
    const t1 = process.env.INTERNAL_API_TOKEN
    const t2 = process.env.INTERNAL_API_SECRET
    if ((t1 && safeCompare(incoming, t1)) || (t2 && safeCompare(incoming, t2))) {
      return true
    }
    // Token present but invalid — fail fast without checking session
    return false
  }

  // 2. NextAuth session
  try {
    const session = await auth()
    return !!session?.user?.email
  } catch {
    return false
  }
}

// ─── GET /api/dashboard/security-audit ───────────────────────────────────────
// Returns the most recent cached audit for the tenant.

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId =
    req.nextUrl.searchParams.get('tenant_id') ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    'agency-group'

  const { data: cached, error } = await (supabaseAdmin as any)
    .from('portal_security_audits')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !cached) {
    return NextResponse.json(
      { error: 'No cached audit found. POST to /api/dashboard/security-audit to run a fresh audit.' },
      { status: 404 },
    )
  }

  return NextResponse.json(cached, { status: 200 })
}

// ─── POST /api/dashboard/security-audit ──────────────────────────────────────
// Runs a fresh security audit and saves the result to portal_security_audits.

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tenantId: string = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? 'agency-group'

  // Allow tenant_id override via JSON body
  try {
    const body: unknown = await req.json()
    if (
      body !== null &&
      typeof body === 'object' &&
      'tenant_id' in body &&
      typeof (body as Record<string, unknown>).tenant_id === 'string'
    ) {
      tenantId = (body as Record<string, string>).tenant_id
    }
  } catch {
    // No body or invalid JSON — use default tenant
  }

  const audit = await runPortalSecurityAudit(tenantId)

  // Persist to portal_security_audits
  const { error: insertError } = await (supabaseAdmin as any)
    .from('portal_security_audits')
    .insert({
      id: audit.audit_id,
      tenant_id: audit.tenant_id,
      auth_enforcement: audit.auth_enforcement,
      tenant_isolation: audit.tenant_isolation,
      api_exposure: audit.api_exposure,
      audit_trail: audit.audit_trail,
      vulnerabilities: audit.vulnerabilities,
      security_score: audit.security_score,
      generated_at: audit.generated_at,
    })

  if (insertError) {
    // Non-fatal: return audit even if save fails
    return NextResponse.json(
      {
        ...audit,
        _warning: 'Audit completed but could not be saved to database',
        _db_error: insertError.message,
      },
      { status: 200 },
    )
  }

  return NextResponse.json(audit, { status: 200 })
}
