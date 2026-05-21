// =============================================================================
// Agency Group — ML Artifact Backup Service
// lib/backup/mlArtifactBackup.ts
//
// Backs up ML models, feature snapshots, and training run logs to
// Supabase Storage.
//
// Storage layout:
//   ml-models  bucket: ml/models/{model_name}/{version}/model.json
//   ml-training-data bucket:
//     ml/features/{YYYY-MM-DD}/features.jsonl
//     ml/training_runs/{run_id}/run.json
//
// Table: ml_artifact_log (see migration 20260522000029)
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { createHash, randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MLArtifactType = 'model' | 'feature_snapshot' | 'training_run' | 'evaluation_log'

export interface MLArtifactRecord {
  id: string
  tenant_id: string
  artifact_type: MLArtifactType
  name: string
  version: string
  storage_path: string
  size_bytes: number | null
  model_id: string | null
  training_run_id: string | null
  performance_metrics: Record<string, number>
  is_active: boolean
  checksum: string | null
  backed_up_at: string
  expires_at: string | null
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODELS_BUCKET = 'ml-models'
const TRAINING_BUCKET = 'ml-training-data'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function persistArtifactLog(
  record: Omit<MLArtifactRecord, 'backed_up_at'> & { backed_up_at: string },
): Promise<void> {
  const db = supabaseAdmin as any
  const { error } = await db.from('ml_artifact_log').insert({
    id: record.id,
    tenant_id: record.tenant_id,
    artifact_type: record.artifact_type,
    name: record.name,
    version: record.version,
    storage_path: record.storage_path,
    size_bytes: record.size_bytes,
    model_id: record.model_id,
    training_run_id: record.training_run_id,
    performance_metrics: record.performance_metrics,
    is_active: record.is_active,
    checksum: record.checksum,
    backed_up_at: record.backed_up_at,
    expires_at: record.expires_at,
  })
  if (error) {
    log.warn('[mlArtifactBackup] persistArtifactLog — insert failed', {
      id: record.id,
      error: error.message,
    } as any)
  }
}

// ---------------------------------------------------------------------------
// backupActiveModels
// Reads ml_models WHERE status = 'active', serializes metadata to JSON,
// uploads to /ml/models/{model_name}/{version}/model.json in ml-models bucket.
// ---------------------------------------------------------------------------

export async function backupActiveModels(tenantId: string): Promise<MLArtifactRecord[]> {
  const db = supabaseAdmin as any

  // Fetch active models
  const { data: models, error: fetchErr } = await db
    .from('ml_models')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  if (fetchErr) {
    // Table may not exist under this exact name — try ml_model_registry
    log.warn('[mlArtifactBackup] backupActiveModels — ml_models fetch failed, trying ml_model_registry', {
      tenantId,
      error: fetchErr.message,
    } as any)
  }

  // Fall back to ml_model_registry if needed
  let rows: Array<Record<string, unknown>> = (models ?? []) as Array<Record<string, unknown>>

  if (rows.length === 0 && fetchErr) {
    const { data: regModels, error: regErr } = await db
      .from('ml_model_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (regErr) {
      log.warn('[mlArtifactBackup] backupActiveModels — ml_model_registry fetch also failed', {
        tenantId,
        error: regErr.message,
      } as any)
      return []
    }

    rows = (regModels ?? []) as Array<Record<string, unknown>>
  }

  const artifacts: MLArtifactRecord[] = []

  for (const model of rows) {
    const modelId = (model['id'] as string) ?? randomUUID()
    const modelName = (model['model_name'] as string | undefined) ?? 'unknown_model'
    const version = (model['version'] as string | undefined) ?? '1.0.0'
    const metrics = (model['metrics'] as Record<string, number> | undefined) ?? {}
    const backedUpAt = new Date().toISOString()

    const storagePath = `ml/models/${modelName}/${version}/model.json`
    const content = JSON.stringify({
      ...model,
      _backed_up_at: backedUpAt,
      _backup_version: '1',
    })
    const checksum = sha256(content)
    const sizeBytes = Buffer.byteLength(content, 'utf8')

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(MODELS_BUCKET)
      .upload(storagePath, new Blob([content], { type: 'application/json' }), {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadErr) {
      log.warn('[mlArtifactBackup] backupActiveModels — upload failed', {
        tenantId,
        modelName,
        version,
        error: uploadErr.message,
      } as any)
    }

    const artifact: MLArtifactRecord = {
      id: randomUUID(),
      tenant_id: tenantId,
      artifact_type: 'model',
      name: modelName,
      version,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      model_id: modelId,
      training_run_id: null,
      performance_metrics: metrics,
      is_active: true,
      checksum: uploadErr ? null : checksum,
      backed_up_at: backedUpAt,
      expires_at: null,   // keep forever
    }

    void persistArtifactLog(artifact).catch(e =>
      log.warn('[mlArtifactBackup] backupActiveModels — persist log failed', {
        error: e instanceof Error ? e.message : String(e),
      } as any)
    )

    artifacts.push(artifact)
  }

  log.info('[mlArtifactBackup] backupActiveModels — complete', {
    tenantId,
    models_backed_up: artifacts.length,
  } as any)

  return artifacts
}

// ---------------------------------------------------------------------------
// backupFeatureSnapshot
// Reads feature_vectors WHERE valid_to IS NULL, serializes to JSONL,
// uploads to /ml/features/{date}/features.jsonl in ml-training-data bucket.
// ---------------------------------------------------------------------------

export async function backupFeatureSnapshot(
  tenantId: string,
  date?: string,
): Promise<MLArtifactRecord> {
  const db = supabaseAdmin as any
  const dateTag = date ?? new Date().toISOString().slice(0, 10)
  const backedUpAt = new Date().toISOString()
  const storagePath = `ml/features/${dateTag}/features.jsonl`

  let jsonl = ''
  let rowCount = 0

  try {
    const { data: features, error: fetchErr } = await db
      .from('feature_vectors')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('valid_to', null)
      .limit(10_000)  // safety cap

    if (fetchErr) {
      log.warn('[mlArtifactBackup] backupFeatureSnapshot — fetch failed', {
        tenantId,
        error: fetchErr.message,
      } as any)
    } else {
      const rows = (features ?? []) as Array<Record<string, unknown>>
      rowCount = rows.length
      jsonl = rows.map(r => JSON.stringify(r)).join('\n')
    }
  } catch (err) {
    log.warn('[mlArtifactBackup] backupFeatureSnapshot — exception fetching features', {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    } as any)
  }

  const checksum = jsonl.length > 0 ? sha256(jsonl) : null
  const sizeBytes = Buffer.byteLength(jsonl, 'utf8')

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(TRAINING_BUCKET)
    .upload(storagePath, new Blob([jsonl], { type: 'application/x-ndjson' }), {
      contentType: 'application/x-ndjson',
      upsert: true,
    })

  if (uploadErr) {
    log.warn('[mlArtifactBackup] backupFeatureSnapshot — upload failed', {
      tenantId,
      storagePath,
      error: uploadErr.message,
    } as any)
  }

  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const artifact: MLArtifactRecord = {
    id: randomUUID(),
    tenant_id: tenantId,
    artifact_type: 'feature_snapshot',
    name: `feature_snapshot_${dateTag}`,
    version: dateTag,
    storage_path: storagePath,
    size_bytes: sizeBytes,
    model_id: null,
    training_run_id: null,
    performance_metrics: { row_count: rowCount },
    is_active: false,
    checksum: uploadErr ? null : checksum,
    backed_up_at: backedUpAt,
    expires_at: expiresAt,
  }

  void persistArtifactLog(artifact).catch(e =>
    log.warn('[mlArtifactBackup] backupFeatureSnapshot — persist log failed', {
      error: e instanceof Error ? e.message : String(e),
    } as any)
  )

  log.info('[mlArtifactBackup] backupFeatureSnapshot — complete', {
    tenantId,
    date: dateTag,
    row_count: rowCount,
    size_bytes: sizeBytes,
  } as any)

  return artifact
}

// ---------------------------------------------------------------------------
// backupTrainingRun
// Reads retraining_runs for runId, uploads JSON to
// /ml/training_runs/{runId}/run.json in ml-training-data bucket.
// ---------------------------------------------------------------------------

export async function backupTrainingRun(
  tenantId: string,
  runId: string,
): Promise<MLArtifactRecord> {
  const db = supabaseAdmin as any
  const backedUpAt = new Date().toISOString()
  const storagePath = `ml/training_runs/${runId}/run.json`

  let runData: Record<string, unknown> = { id: runId, tenant_id: tenantId }

  try {
    const { data, error: fetchErr } = await db
      .from('retraining_runs')
      .select('*')
      .eq('id', runId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (fetchErr) {
      log.warn('[mlArtifactBackup] backupTrainingRun — fetch failed', {
        tenantId,
        runId,
        error: fetchErr.message,
      } as any)
    } else if (data) {
      runData = data as Record<string, unknown>
    }
  } catch (err) {
    log.warn('[mlArtifactBackup] backupTrainingRun — exception', {
      tenantId,
      runId,
      error: err instanceof Error ? err.message : String(err),
    } as any)
  }

  const content = JSON.stringify({ ...runData, _backed_up_at: backedUpAt })
  const checksum = sha256(content)
  const sizeBytes = Buffer.byteLength(content, 'utf8')

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(TRAINING_BUCKET)
    .upload(storagePath, new Blob([content], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: false,
    })

  if (uploadErr) {
    log.warn('[mlArtifactBackup] backupTrainingRun — upload failed', {
      tenantId,
      runId,
      storagePath,
      error: uploadErr.message,
    } as any)
  }

  // 90-day expiry for training run logs
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const completedAt = runData['completed_at'] as string | undefined
  const version = completedAt ? completedAt.slice(0, 10) : backedUpAt.slice(0, 10)

  const artifact: MLArtifactRecord = {
    id: randomUUID(),
    tenant_id: tenantId,
    artifact_type: 'training_run',
    name: `training_run_${runId}`,
    version,
    storage_path: storagePath,
    size_bytes: sizeBytes,
    model_id: null,
    training_run_id: runId,
    performance_metrics: {},
    is_active: false,
    checksum: uploadErr ? null : checksum,
    backed_up_at: backedUpAt,
    expires_at: expiresAt,
  }

  void persistArtifactLog(artifact).catch(e =>
    log.warn('[mlArtifactBackup] backupTrainingRun — persist log failed', {
      error: e instanceof Error ? e.message : String(e),
    } as any)
  )

  log.info('[mlArtifactBackup] backupTrainingRun — complete', {
    tenantId,
    runId,
    size_bytes: sizeBytes,
  } as any)

  return artifact
}

// ---------------------------------------------------------------------------
// listBackedUpArtifacts
// ---------------------------------------------------------------------------

export async function listBackedUpArtifacts(
  tenantId: string,
  type?: MLArtifactType,
): Promise<MLArtifactRecord[]> {
  const db = supabaseAdmin as any

  let query = (db as any)
    .from('ml_artifact_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('backed_up_at', { ascending: false })
    .limit(100)

  if (type) {
    query = query.eq('artifact_type', type)
  }

  const { data, error } = await query

  if (error) {
    log.warn('[mlArtifactBackup] listBackedUpArtifacts — query failed', {
      tenantId,
      type,
      error: error.message,
    } as any)
    return []
  }

  return (data ?? []) as MLArtifactRecord[]
}

// ---------------------------------------------------------------------------
// getLatestModelBackup
// ---------------------------------------------------------------------------

export async function getLatestModelBackup(
  tenantId: string,
  modelName: string,
): Promise<MLArtifactRecord | null> {
  const db = supabaseAdmin as any

  const { data, error } = await db
    .from('ml_artifact_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('artifact_type', 'model')
    .eq('name', modelName)
    .order('backed_up_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    log.warn('[mlArtifactBackup] getLatestModelBackup — query failed', {
      tenantId,
      modelName,
      error: error.message,
    } as any)
    return null
  }

  return (data ?? null) as MLArtifactRecord | null
}

// ---------------------------------------------------------------------------
// getArtifactContent
// Returns the JSON content of a backed-up artifact from Supabase Storage.
// Determines bucket from path prefix.
// ---------------------------------------------------------------------------

export async function getArtifactContent(
  tenantId: string,
  storagePath: string,
): Promise<Record<string, unknown> | null> {
  // Determine bucket: paths starting with ml/models/ use ml-models bucket
  const bucket = storagePath.startsWith('ml/models/') ? MODELS_BUCKET : TRAINING_BUCKET

  const { data, error } = await supabaseAdmin.storage.from(bucket).download(storagePath)

  if (error || !data) {
    log.warn('[mlArtifactBackup] getArtifactContent — download failed', {
      tenantId,
      storagePath,
      bucket,
      error: error?.message,
    } as any)
    return null
  }

  try {
    const text = await (data as Blob).text()
    return JSON.parse(text) as Record<string, unknown>
  } catch (parseErr) {
    log.warn('[mlArtifactBackup] getArtifactContent — parse failed', {
      tenantId,
      storagePath,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    } as any)
    return null
  }
}
