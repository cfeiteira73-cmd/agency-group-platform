// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Security Audit API Route — Zero Trust Administration Endpoint
// Wave 44 Agent 1 — Production Lock
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revokeSession, grantJitAccess } from '@/lib/security/zeroTrustEngine'
import type { Permission } from '@/lib/security/zeroTrustEngine'
import { checkSecretsHealth } from '@/lib/security/secretsManagementEngine'
import { getActiveThreatsSummary, logThreatEvent } from '@/lib/security/threatDetectionEngine'
import type { ThreatEventType, ThreatSeverity } from '@/lib/security/threatDetectionEngine'

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ── Helpers ────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function authorizeBearerToken(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const expected = process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? ''
  if (!expected) return false
  return safeCompare(token, expected)
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'status'

  try {
    switch (mode) {
      case 'sessions': {
        const { data, error } = await (supabaseAdmin as any)
          .from('security_sessions')
          .select('id', { count: 'exact' })
          .eq('revoked', false)
          .gt('expires_at', new Date().toISOString())

        const active_sessions = Array.isArray(data) ? data.length : 0
        return NextResponse.json({
          success: true,
          mode: 'sessions',
          active_sessions,
          error: error ? String(error) : null,
          generated_at: new Date().toISOString(),
        })
      }

      case 'threats': {
        const hoursParam = searchParams.get('hours')
        const hours = hoursParam ? parseInt(hoursParam, 10) : 24
        // Use the standard 24h summary; hours param is for context
        const summary = await getActiveThreatsSummary(TENANT_ID)
        return NextResponse.json({
          success: true,
          mode: 'threats',
          hours_window: hours,
          ...summary,
          generated_at: new Date().toISOString(),
        })
      }

      case 'secrets-health': {
        const health = await checkSecretsHealth()
        return NextResponse.json({
          success: true,
          mode: 'secrets-health',
          ...health,
          generated_at: new Date().toISOString(),
        })
      }

      default: {
        // Combined security status
        const [sessionsResult, threatsResult, healthResult] = await Promise.allSettled([
          (supabaseAdmin as any)
            .from('security_sessions')
            .select('id', { count: 'exact' })
            .eq('revoked', false)
            .gt('expires_at', new Date().toISOString()),
          getActiveThreatsSummary(TENANT_ID),
          checkSecretsHealth(),
        ])

        const sessionsData = sessionsResult.status === 'fulfilled' ? sessionsResult.value : null
        const activeSessions = Array.isArray(sessionsData?.data) ? sessionsData.data.length : 0
        const threats = threatsResult.status === 'fulfilled' ? threatsResult.value : null
        const health = healthResult.status === 'fulfilled' ? healthResult.value : null

        return NextResponse.json({
          success: true,
          mode: 'status',
          tenant_id: TENANT_ID,
          sessions: { active: activeSessions },
          threats: threats ?? { total_24h: 0, critical_count: 0, high_count: 0, top_event_types: [] },
          secrets: health ?? { healthy: false, missing: [], expiring_soon: [] },
          generated_at: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.error('[security/audit] GET error', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── POST Handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authorizeBearerToken(req)) {
    return errorResponse('Unauthorized', 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const action = body.action as string | undefined
  if (!action) {
    return errorResponse('Missing action field', 400)
  }

  try {
    switch (action) {
      case 'revoke-session': {
        const session_id = body.session_id as string | undefined
        if (!session_id) return errorResponse('Missing session_id', 400)

        await revokeSession(session_id, 'Manual revocation via admin API')
        return NextResponse.json({ success: true, action, session_id })
      }

      case 'grant-jit': {
        const user_id = body.user_id as string | undefined
        const permission = body.permission as Permission | undefined
        const duration_minutes = body.duration_minutes as number | undefined
        const approved_by = body.approved_by as string | undefined

        if (!user_id) return errorResponse('Missing user_id', 400)
        if (!permission) return errorResponse('Missing permission', 400)
        if (!duration_minutes || typeof duration_minutes !== 'number') return errorResponse('Missing duration_minutes', 400)
        if (!approved_by) return errorResponse('Missing approved_by', 400)

        const session_id = (body.session_id as string | undefined) ?? ''

        await grantJitAccess(user_id, session_id, permission, duration_minutes, approved_by)
        return NextResponse.json({ success: true, action, user_id, permission, duration_minutes })
      }

      case 'log-threat': {
        const event_type = body.event_type as ThreatEventType | undefined
        const severity = body.severity as ThreatSeverity | undefined
        const source_ip = (body.source_ip as string | undefined) ?? ''
        const description = (body.description as string | undefined) ?? ''

        if (!event_type) return errorResponse('Missing event_type', 400)
        if (!severity) return errorResponse('Missing severity', 400)

        logThreatEvent({
          tenant_id: (body.tenant_id as string | undefined) ?? TENANT_ID,
          event_type,
          severity,
          source_ip,
          user_id: (body.user_id as string | null | undefined) ?? null,
          session_id: (body.session_id as string | null | undefined) ?? null,
          endpoint: (body.endpoint as string | null | undefined) ?? null,
          description,
          metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
          auto_blocked: (body.auto_blocked as boolean | undefined) ?? false,
        })

        return NextResponse.json({ success: true, action, event_type, severity })
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    console.error('[security/audit] POST error', { action, err })
    return errorResponse('Internal server error', 500)
  }
}
