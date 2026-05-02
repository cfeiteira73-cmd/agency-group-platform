// GET  /api/analytics/calibration  — fetch active recommendations
// POST /api/analytics/calibration  — apply | dismiss | defer a recommendation

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }  from '@/lib/auth/auditLog'
import {
  getActiveRecommendations,
  applyRecommendation,
  dismissRecommendation,
  deferRecommendation,
  runWeeklyCalibration,
} from '@/lib/intelligence/recalibrationEngine'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url    = new URL(req.url)
  const fresh  = url.searchParams.get('recompute') === 'true'

  try {
    if (fresh && hasPermission(user.role, 'commercial:write')) {
      // Recompute + persist fresh recommendations
      const result = await runWeeklyCalibration()
      return NextResponse.json({
        source:        'recomputed',
        trigger:       result.trigger,
        urgency_score: result.urgency_score,
        persisted:     result.persisted,
        recommendations: result.report.recommendations,
        grade_performance: result.report.grade_performance,
        data_quality:  result.report.data_quality,
      })
    }

    const recs = await getActiveRecommendations()
    return NextResponse.json({ source: 'cached', recommendations: recs })
  } catch (err) {
    console.error('[calibration GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'commercial:write')) {
    return NextResponse.json({ error: 'Forbidden — requires commercial:write' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, action, notes } = body
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  if (!['apply', 'dismiss', 'defer'].includes(action as string)) {
    return NextResponse.json({ error: 'action must be apply|dismiss|defer' }, { status: 400 })
  }

  try {
    if (action === 'apply') {
      await applyRecommendation(id, user.user_email, notes as string | undefined)
    } else if (action === 'dismiss') {
      await dismissRecommendation(id, user.user_email, notes as string | undefined)
    } else {
      await deferRecommendation(id, user.user_email, notes as string | undefined)
    }

    const calibrationAction: 'apply_calibration' | 'dismiss_calibration' | 'defer_calibration' =
      action === 'apply' ? 'apply_calibration' :
      action === 'dismiss' ? 'dismiss_calibration' : 'defer_calibration'
    await logAction(buildAuditEntry(
      user.user_email,
      calibrationAction,
      'calibration_recommendation',
      id,
      { newValue: { action, notes } },
    ))

    return NextResponse.json({ success: true, id, action })
  } catch (err) {
    console.error('[calibration POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
