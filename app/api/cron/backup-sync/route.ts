// Agency Group — Backup Sync Cron
// app/api/cron/backup-sync/route.ts
// POST /api/cron/backup-sync
// Auth: CRON_SECRET Bearer
// Schedule: daily (02:00 UTC)
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { createDailySnapshot } from '@/lib/backup/databaseBackupService'
import { archiveEvents } from '@/lib/backup/eventArchivalService'
import { backupActiveModels, backupFeatureSnapshot } from '@/lib/backup/mlArtifactBackup'

export const runtime = 'nodejs'
export const maxDuration = 60

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
// POST /api/cron/backup-sync
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  const startMs = Date.now()

  // 1. DB snapshot (PITR marker)
  let snapshot = null
  try {
    snapshot = await createDailySnapshot(tenantId)
    console.log('[backup-sync] DB snapshot:', snapshot.id, 'status:', snapshot.status)
  } catch (err) {
    console.warn('[backup-sync] createDailySnapshot failed:', err instanceof Error ? err.message : String(err))
  }

  // 2. Event archival — last 24h
  let eventArchive = null
  try {
    eventArchive = await archiveEvents(tenantId)
    console.log('[backup-sync] event archive:', eventArchive.id, 'events:', eventArchive.events_archived)
  } catch (err) {
    console.warn('[backup-sync] archiveEvents failed:', err instanceof Error ? err.message : String(err))
  }

  // 3. ML model backups
  let modelBackups: Awaited<ReturnType<typeof backupActiveModels>> = []
  try {
    modelBackups = await backupActiveModels(tenantId)
    console.log('[backup-sync] model backups:', modelBackups.length, 'models')
  } catch (err) {
    console.warn('[backup-sync] backupActiveModels failed:', err instanceof Error ? err.message : String(err))
  }

  // 4. Feature snapshot
  let featureSnapshot = null
  try {
    featureSnapshot = await backupFeatureSnapshot(tenantId)
    console.log('[backup-sync] feature snapshot:', featureSnapshot.id, 'size:', featureSnapshot.size_bytes)
  } catch (err) {
    console.warn('[backup-sync] backupFeatureSnapshot failed:', err instanceof Error ? err.message : String(err))
  }

  const durationMs = Date.now() - startMs

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    duration_ms: durationMs,
    snapshot: snapshot
      ? {
          id: snapshot.id,
          status: snapshot.status,
          table_count: snapshot.table_count,
          pitr_timestamp: snapshot.pitr_timestamp,
        }
      : null,
    event_archive: eventArchive
      ? {
          id: eventArchive.id,
          status: eventArchive.status,
          events_archived: eventArchive.events_archived,
          archive_path: eventArchive.archive_path,
          size_bytes: eventArchive.size_bytes,
        }
      : null,
    model_backups: modelBackups.map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      storage_path: m.storage_path,
      size_bytes: m.size_bytes,
    })),
    feature_snapshot: featureSnapshot
      ? {
          id: featureSnapshot.id,
          storage_path: featureSnapshot.storage_path,
          size_bytes: featureSnapshot.size_bytes,
          expires_at: featureSnapshot.expires_at,
        }
      : null,
  })
}
