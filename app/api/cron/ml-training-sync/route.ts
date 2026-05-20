// Agency Group — ML Training Sync Cron
// app/api/cron/ml-training-sync/route.ts
// POST /api/cron/ml-training-sync
// Auth: CRON_SECRET Bearer
// Schedule: weekly (Sundays 01:00 UTC)
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { getExportStats, exportTrainingData } from '@/lib/ml/trainingDataExporter'
import { runDriftCheck } from '@/lib/ml/driftDetector'

export const runtime     = 'nodejs'
export const maxDuration = 45

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')
  return !!incoming && safeCompare(incoming, cronSecret)
}

// ---------------------------------------------------------------------------
// POST /api/cron/ml-training-sync
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
  const startedAt  = Date.now()
  const exportedAt = new Date().toISOString()

  // 1. Get export stats
  const stats = await getExportStats(tenantId)
  console.log('[ml-training-sync] export stats:', JSON.stringify(stats))

  // 2. Export training data if enough labeled records exist
  let exportResult = null
  if (stats.ready_for_training) {
    exportResult = await exportTrainingData(tenantId)
    console.log('[ml-training-sync] exported training records:', exportResult.records_exported, 'entity types:', exportResult.entity_types)
  } else {
    console.log(
      `[ml-training-sync] not ready for training — labeled=${stats.labeled_records} / min=${stats.min_records_needed}`,
    )
  }

  // 3. Run drift check across all active prediction types
  const driftResults = await runDriftCheck(tenantId)
  const driftedTypes = driftResults.filter(r => r.drift_detected).map(r => r.prediction_type)

  if (driftedTypes.length > 0) {
    console.warn('[ml-training-sync] drift detected for prediction types:', driftedTypes.join(', '))
    for (const r of driftResults.filter(d => d.drift_detected)) {
      console.warn(`[ml-training-sync] drift — type=${r.prediction_type} psi=${r.psi} severity=${r.drift_severity} — ${r.recommendation}`)
    }
  } else {
    console.log('[ml-training-sync] no drift detected across', driftResults.length, 'prediction type(s)')
  }

  const durationMs = Date.now() - startedAt

  return NextResponse.json({
    success:           true,
    tenant_id:         tenantId,
    exported_at:       exportedAt,
    duration_ms:       durationMs,
    export_stats: {
      labeled_records:    stats.labeled_records,
      unlabeled_records:  stats.unlabeled_records,
      ready_for_training: stats.ready_for_training,
      min_records_needed: stats.min_records_needed,
      entity_breakdown:   stats.entity_breakdown,
    },
    training_export: exportResult !== null
      ? {
          records_exported: exportResult.records_exported,
          entity_types:     exportResult.entity_types,
          from_date:        exportResult.from_date,
          to_date:          exportResult.to_date,
        }
      : null,
    drift_check: {
      prediction_types_checked: driftResults.length,
      drift_detected:           driftedTypes.length > 0,
      drifted_types:            driftedTypes,
      results:                  driftResults.map(r => ({
        prediction_type: r.prediction_type,
        psi:             r.psi,
        drift_detected:  r.drift_detected,
        drift_severity:  r.drift_severity,
        recommendation:  r.recommendation,
      })),
    },
  })
}
