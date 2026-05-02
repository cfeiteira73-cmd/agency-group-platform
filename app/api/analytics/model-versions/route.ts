// GET  /api/analytics/model-versions  — list versions + production status
// POST /api/analytics/model-versions  — create new draft version | promote | archive

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }  from '@/lib/auth/auditLog'
import {
  buildModelVersion,
  createModelVersion,
  getModelVersions,
  getProductionVersion,
  promoteModelVersion,
  archiveModelVersion,
} from '@/lib/intelligence/modelVersioning'
import type { ModelStatus } from '@/lib/intelligence/modelVersioning'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url    = new URL(req.url)
  const status = url.searchParams.get('status') as ModelStatus | null

  try {
    const [versions, production] = await Promise.all([
      getModelVersions({ status: status ?? undefined, limit: 20 }),
      getProductionVersion(),
    ])

    return NextResponse.json({
      versions,
      production_version:  production,
      total:               versions.length,
      by_status: {
        draft:      versions.filter(v => v.status === 'draft').length,
        staging:    versions.filter(v => v.status === 'staging').length,
        production: versions.filter(v => v.status === 'production').length,
        archived:   versions.filter(v => v.status === 'archived').length,
      },
    })
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
  // Creating versions: commercial:write (ops_manager+)
  // Promoting/archiving: roles:grant (super_admin only)
  if (!user || !hasPermission(user.role, 'commercial:write')) {
    return NextResponse.json({ error: 'Forbidden — requires ops_manager or higher' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  // CREATE
  if (!action || action === 'create') {
    const { version_name, scorer_version, config, description } = body
    if (!version_name || !scorer_version) {
      return NextResponse.json({ error: 'version_name and scorer_version required' }, { status: 400 })
    }
    try {
      const payload = buildModelVersion(
        version_name as string,
        scorer_version as string,
        (config as Parameters<typeof buildModelVersion>[2]) ?? { version: scorer_version as string },
        { description: description as string | undefined, createdBy: user.user_email },
      )
      const id = await createModelVersion(payload)
      await logAction(buildAuditEntry(user.user_email, 'record_attribution', 'commission_record', id, {
        newValue: { action: 'create_model_version', version_name },
      }))
      return NextResponse.json({ success: true, id, version_name })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  // PROMOTE (super_admin only)
  if (action === 'promote') {
    if (!hasPermission(user.role, 'roles:grant')) {
      return NextResponse.json({ error: 'Promoting model versions requires super_admin' }, { status: 403 })
    }
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    try {
      await promoteModelVersion(id as string, user.user_email)
      await logAction(buildAuditEntry(user.user_email, 'override_score', 'commission_record', id as string, {
        newValue: { action: 'promote_model_version' },
      }))
      return NextResponse.json({ success: true, id, action: 'promoted' })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  // ARCHIVE
  if (action === 'archive') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    try {
      await archiveModelVersion(id as string, user.user_email)
      return NextResponse.json({ success: true, id, action: 'archived' })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ error: 'action must be create|promote|archive' }, { status: 400 })
}
