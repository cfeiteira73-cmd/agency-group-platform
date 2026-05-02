// GET  /api/ops/incidents  — list open incidents
// POST /api/ops/incidents  — create | update | resolve an incident

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }  from '@/lib/auth/auditLog'
import {
  buildIncident,
  createIncident,
  updateIncidentStatus,
  mitigateIncident,
  resolveIncident,
  getOpenIncidents,
} from '@/lib/ops/incidentLog'
import type { IncidentSeverity, IncidentStatus, RootCauseCategory } from '@/lib/ops/incidentLog'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'system:read_alerts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url      = new URL(req.url)
  const severity = url.searchParams.get('severity') as IncidentSeverity | null

  try {
    const incidents = await getOpenIncidents(severity ?? undefined)
    return NextResponse.json({ incidents, count: incidents.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const isService  = authHeader === process.env.CRON_SECRET
  let actorEmail   = 'service'

  if (!isService) {
    const user = await getAdminRole(authHeader ?? '')
    if (!user || !hasPermission(user.role, 'system:acknowledge_alerts')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    actorEmail = user.user_email
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  // CREATE
  if (!action || action === 'create') {
    const { incident_type, title } = body
    if (!incident_type || !title) {
      return NextResponse.json({ error: 'incident_type and title required' }, { status: 400 })
    }

    try {
      const payload = buildIncident(incident_type as string, title as string, {
        description:     body.description     as string | undefined,
        severity:        body.severity        as IncidentSeverity | undefined,
        affectedSystems: body.affected_systems as string[] | undefined,
        affectedCount:   body.affected_count  != null ? Number(body.affected_count) : undefined,
        startedAt:       body.started_at      as string | undefined,
        detectedBy:      actorEmail,
        ownedBy:         body.owned_by        as string | undefined,
        alertId:         body.alert_id        as string | undefined,
      })

      const id = await createIncident(payload)
      await logAction(buildAuditEntry(actorEmail, 'create_incident', 'incident', id, { newValue: { title, severity: payload.severity } }))
      return NextResponse.json({ success: true, id })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  // UPDATE STATUS
  if (action === 'update') {
    const { id, status } = body
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 })
    }
    try {
      await updateIncidentStatus(id as string, status as IncidentStatus, {
        rootCause:        body.root_cause         as string | undefined,
        rootCauseCategory: body.root_cause_category as RootCauseCategory | undefined,
        ownedBy:          actorEmail,
      })
      return NextResponse.json({ success: true, id, status })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  // MITIGATE
  if (action === 'mitigate') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    try {
      await mitigateIncident(id as string, actorEmail, body.root_cause as string | undefined)
      return NextResponse.json({ success: true, id, status: 'mitigated' })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  // RESOLVE
  if (action === 'resolve') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    try {
      await resolveIncident(id as string, actorEmail, {
        rootCause:         body.root_cause          as string | undefined,
        rootCauseCategory: body.root_cause_category as RootCauseCategory | undefined,
        postMortem:        body.post_mortem         as string | undefined,
      })
      await logAction(buildAuditEntry(actorEmail, 'resolve_incident', 'incident', id as string, {
        newValue: { status: 'resolved', root_cause_category: body.root_cause_category },
      }))
      return NextResponse.json({ success: true, id, status: 'resolved' })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ error: 'Unknown action — use create|update|mitigate|resolve' }, { status: 400 })
}
