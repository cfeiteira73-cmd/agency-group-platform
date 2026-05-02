// PATCH /api/ops/feature-flags/[key]  — enable | disable a specific flag
// GET   /api/ops/feature-flags/[key]  — get flag state

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }  from '@/lib/auth/auditLog'
import { getFlag, enableFlag, disableFlag } from '@/lib/ops/featureFlags'

export const runtime = 'nodejs'

type Params = { params: Promise<{ key: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { key } = await params

  const authHeader = _req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'system:read_alerts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const flag = await getFlag(key)
  if (!flag) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
  return NextResponse.json({ flag })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { key } = await params

  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  // Kill switches require ops_manager+; regular flags require ops_manager+
  if (!user || !hasPermission(user.role, 'system:resolve_alerts')) {
    return NextResponse.json({ error: 'Forbidden — requires ops_manager or higher' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body
  if (!['enable', 'disable'].includes(action as string)) {
    return NextResponse.json({ error: 'action must be enable|disable' }, { status: 400 })
  }

  // Extra safety: kill switches require super_admin
  const flag = await getFlag(key)
  if (!flag) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })

  if (flag.is_kill_switch && !hasPermission(user.role, 'roles:grant')) {
    return NextResponse.json(
      { error: 'Kill switches require super_admin role' },
      { status: 403 },
    )
  }

  try {
    if (action === 'enable') {
      await enableFlag(key, user.user_email, {
        rolloutPct: body.rollout_pct != null ? Number(body.rollout_pct) : undefined,
        expiresAt:  body.expires_at  as string | undefined,
      })
    } else {
      await disableFlag(key, user.user_email)
    }

    await logAction(buildAuditEntry(
      user.user_email,
      'update_feature_flag',
      'feature_flag',
      key,
      { newValue: { action, flag_key: key } },
    ))

    const updated = await getFlag(key)
    return NextResponse.json({ success: true, flag: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
