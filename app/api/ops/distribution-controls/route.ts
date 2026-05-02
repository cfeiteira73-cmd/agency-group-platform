// GET  /api/ops/distribution-controls  — list all controls
// POST /api/ops/distribution-controls  — pause or resume distribution

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { getActiveControls, pauseDistribution, resumeDistribution } from '@/lib/ops/distributionControl'
import { logAction }                 from '@/lib/auth/auditLog'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin || !hasPermission(admin.role, 'distribution:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const controls = await getActiveControls()
    const paused   = controls.filter(c => c.status === 'paused')
    return NextResponse.json({
      controls,
      paused_count:  paused.length,
      is_any_paused: paused.length > 0,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    op:           'pause' | 'resume'
    control_id?:  string    // for resume
    control_type?: 'global' | 'zone' | 'asset_type' | 'tier'
    zone_key?:    string
    asset_type?:  string
    tier?:        string
    reason?:      string
  }

  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!['pause', 'resume'].includes(body.op)) {
    return NextResponse.json({ error: 'op must be pause | resume' }, { status: 400 })
  }

  const requiredPerm = body.op === 'pause' ? 'distribution:pause' : 'distribution:resume'
  if (!hasPermission(admin.role, requiredPerm)) {
    return NextResponse.json({ error: `Role ${admin.role} cannot ${body.op} distribution` }, { status: 403 })
  }

  try {
    if (body.op === 'pause') {
      if (!body.control_type) {
        return NextResponse.json({ error: 'control_type required for pause' }, { status: 400 })
      }
      const id = await pauseDistribution({
        control_type:  body.control_type,
        zone_key:      body.zone_key,
        asset_type:    body.asset_type,
        tier:          body.tier,
        reason:        body.reason,
        controlled_by: token.email as string,
      })
      await logAction({
        actor_email:   token.email as string,
        actor_role:    admin.role,
        action_type:   'pause_distribution',
        resource_type: 'distribution_control',
        resource_id:   id,
        new_value:     { control_type: body.control_type, zone_key: body.zone_key ?? null, reason: body.reason },
      })
      return NextResponse.json({ id, op: 'paused' })
    } else {
      if (!body.control_id) {
        return NextResponse.json({ error: 'control_id required for resume' }, { status: 400 })
      }
      await resumeDistribution(body.control_id, token.email as string)
      await logAction({
        actor_email:   token.email as string,
        actor_role:    admin.role,
        action_type:   'resume_distribution',
        resource_type: 'distribution_control',
        resource_id:   body.control_id,
      })
      return NextResponse.json({ id: body.control_id, op: 'resumed' })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
