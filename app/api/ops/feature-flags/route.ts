// GET  /api/ops/feature-flags  — list all flags
// POST /api/ops/feature-flags  — create or upsert a flag

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }  from '@/lib/auth/auditLog'
import { getAllFlags, upsertFlag, buildFlagPayload } from '@/lib/ops/featureFlags'
import type { FlagScope }              from '@/lib/ops/featureFlags'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'system:read_alerts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url       = new URL(req.url)
  const scope     = url.searchParams.get('scope') as FlagScope | null
  const subsystem = url.searchParams.get('subsystem') ?? undefined
  const enabled   = url.searchParams.get('enabled_only') === 'true'

  try {
    const flags = await getAllFlags({ scope: scope ?? undefined, subsystem, enabledOnly: enabled })
    const killSwitches = flags.filter(f => f.is_kill_switch)
    const canaries     = flags.filter(f => f.is_canary)
    const regular      = flags.filter(f => !f.is_kill_switch && !f.is_canary)

    return NextResponse.json({ flags, kill_switches: killSwitches, canaries, regular })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  // Only ops_manager+ can create/modify flags
  if (!user || !hasPermission(user.role, 'system:resolve_alerts')) {
    return NextResponse.json({ error: 'Forbidden — requires ops_manager or higher' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { flag_key, flag_name } = body
  if (!flag_key || typeof flag_key !== 'string') {
    return NextResponse.json({ error: 'flag_key required' }, { status: 400 })
  }
  if (!flag_name || typeof flag_name !== 'string') {
    return NextResponse.json({ error: 'flag_name required' }, { status: 400 })
  }

  try {
    const payload = buildFlagPayload(flag_key, flag_name, {
      description:  body.description  as string | undefined,
      scope:        (body.flag_scope  as FlagScope) ?? 'global',
      subsystem:    body.subsystem    as string | undefined,
      isEnabled:    Boolean(body.is_enabled),
      rolloutPct:   body.rollout_pct  != null ? Number(body.rollout_pct) : 100,
      config:       (body.config      as Record<string, unknown>) ?? {},
      isKillSwitch: Boolean(body.is_kill_switch),
      isCanary:     Boolean(body.is_canary),
      expiresAt:    body.expires_at   as string | undefined,
    })

    const id = await upsertFlag(payload, user.user_email)

    await logAction(buildAuditEntry(
      user.user_email,
      'update_feature_flag',
      'feature_flag',
      flag_key,
      { newValue: { is_enabled: payload.is_enabled, action: 'upsert' } },
    ))

    return NextResponse.json({ success: true, id, flag_key })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
