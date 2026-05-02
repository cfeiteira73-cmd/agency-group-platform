// GET  /api/ops/alerts         — list active alerts
// POST /api/ops/alerts/[id]    — acknowledge or resolve an alert

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { getActiveAlerts, acknowledgeAlert, resolveAlert } from '@/lib/ops/alertEngine'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin || !hasPermission(admin.role, 'system:read_alerts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const severity = searchParams.get('severity') as 'info' | 'warning' | 'critical' | undefined

  try {
    const alerts = await getActiveAlerts(severity)
    return NextResponse.json({
      alerts,
      total:      alerts.length,
      critical:   alerts.filter(a => a.severity === 'critical').length,
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

  let body: { alert_id: string; op: 'acknowledge' | 'resolve' }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const requiredPerm = body.op === 'acknowledge'
    ? 'system:acknowledge_alerts'
    : 'system:resolve_alerts'

  if (!hasPermission(admin.role, requiredPerm)) {
    return NextResponse.json({ error: `Role ${admin.role} cannot ${body.op} alerts` }, { status: 403 })
  }

  try {
    if (body.op === 'acknowledge') {
      await acknowledgeAlert(body.alert_id, token.email as string)
    } else {
      await resolveAlert(body.alert_id)
    }
    return NextResponse.json({ alert_id: body.alert_id, op: body.op })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
