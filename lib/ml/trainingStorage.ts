// Agency Group — ML Training Storage
// lib/ml/trainingStorage.ts
// TypeScript strict — 0 errors
//
// Saves training JSONL exports to Supabase Storage bucket 'ml-training-data'.
// Chunks files > 10 MB to stay within per-upload limits.
// Persists a manifest row to training_export_manifests for traceability.

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET          = 'ml-training-data'
const CHUNK_SIZE_BYTES = 10 * 1024 * 1024   // 10 MB per chunk
const MAX_SIZE_BYTES   = 50 * 1024 * 1024   // 50 MB hard cap

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrainingExportManifest {
  export_id:     string
  tenant_id:     string
  exported_at:   string
  records_total: number
  entity_types:  string[]
  from_date:     string
  to_date:       string
  storage_paths: string[]   // list of bucket paths (one per chunk)
  bucket:        string
  checksum:      string     // SHA-256 of full JSONL content
  size_bytes:    number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkString(str: string, chunkSizeBytes: number): string[] {
  const encoder = new TextEncoder()
  const bytes   = encoder.encode(str)

  if (bytes.length <= chunkSizeBytes) return [str]

  const chunks: string[] = []
  const decoder = new TextDecoder()
  let offset = 0

  while (offset < bytes.length) {
    // Grab a byte slice up to chunkSizeBytes, then back up to a newline boundary
    // so we never split a JSON line mid-character.
    let end = Math.min(offset + chunkSizeBytes, bytes.length)

    if (end < bytes.length) {
      // Walk backwards to last newline within this slice
      let boundary = end - 1
      while (boundary > offset && bytes[boundary] !== 0x0a /* '\n' */) {
        boundary--
      }
      // If no newline found, cut at original end (worst case: one huge line)
      if (boundary > offset) end = boundary + 1
    }

    chunks.push(decoder.decode(bytes.slice(offset, end)))
    offset = end
  }

  return chunks
}

// ---------------------------------------------------------------------------
// saveTrainingExport
// ---------------------------------------------------------------------------

export async function saveTrainingExport(
  tenantId: string,
  jsonl: string,
  metadata: {
    from_date:    string
    to_date:      string
    entity_types: string[]
    records:      number
  },
): Promise<TrainingExportManifest> {
  const exportId  = randomUUID()
  const exportedAt = new Date().toISOString()
  const dateStr    = exportedAt.slice(0, 10)  // YYYY-MM-DD

  // Validate size
  const encoder  = new TextEncoder()
  const sizeBytes = encoder.encode(jsonl).length

  if (sizeBytes > MAX_SIZE_BYTES) {
    log.error('[trainingStorage] saveTrainingExport — export exceeds 50 MB limit', undefined, {
      size_bytes: sizeBytes,
      export_id:  exportId,
    })
    throw new Error(`Training export too large: ${sizeBytes} bytes (max ${MAX_SIZE_BYTES})`)
  }

  // Compute SHA-256 checksum of full JSONL
  const checksum = createHash('sha256').update(jsonl).digest('hex')

  // Chunk JSONL
  const chunks = chunkString(jsonl, CHUNK_SIZE_BYTES)
  const storagePaths: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const suffix = chunks.length === 1 ? '' : `.part${String(i).padStart(3, '0')}`
    const path   = `training/${tenantId}/${dateStr}/${exportId}${suffix}.jsonl`

    const chunkBytes = encoder.encode(chunks[i])
    const { error }  = await (supabaseAdmin as any).storage
      .from(BUCKET)
      .upload(path, chunkBytes, {
        contentType:  'application/x-ndjson',
        cacheControl: '3600',
        upsert:       false,
      })

    if (error) {
      log.error('[trainingStorage] saveTrainingExport — chunk upload failed', undefined, {
        path,
        chunk:      i,
        error:      error.message,
        export_id:  exportId,
      })
      throw new Error(`Storage upload failed for chunk ${i}: ${error.message}`)
    }

    storagePaths.push(path)
  }

  // Insert manifest into DB
  const { error: dbError } = await (supabaseAdmin as any)
    .from('training_export_manifests')
    .insert({
      export_id:     exportId,
      tenant_id:     tenantId,
      exported_at:   exportedAt,
      records_total: metadata.records,
      entity_types:  metadata.entity_types,
      from_date:     metadata.from_date || null,
      to_date:       metadata.to_date   || null,
      storage_paths: storagePaths,
      bucket:        BUCKET,
      checksum,
      size_bytes:    sizeBytes,
      status:        'complete',
    })

  if (dbError) {
    log.error('[trainingStorage] saveTrainingExport — manifest insert failed', undefined, {
      export_id: exportId,
      error:     dbError.message,
    })
    throw new Error(`Manifest insert failed: ${dbError.message}`)
  }

  log.info('[trainingStorage] saveTrainingExport — complete', {
    export_id:     exportId,
    size_bytes:    sizeBytes,
    chunks:        storagePaths.length,
    records_total: metadata.records,
  } as any)

  return {
    export_id:     exportId,
    tenant_id:     tenantId,
    exported_at:   exportedAt,
    records_total: metadata.records,
    entity_types:  metadata.entity_types,
    from_date:     metadata.from_date,
    to_date:       metadata.to_date,
    storage_paths: storagePaths,
    bucket:        BUCKET,
    checksum,
    size_bytes:    sizeBytes,
  }
}

// ---------------------------------------------------------------------------
// getLatestManifest
// ---------------------------------------------------------------------------

export async function getLatestManifest(tenantId: string): Promise<TrainingExportManifest | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('training_export_manifests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'complete')
      .order('exported_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.error('[trainingStorage] getLatestManifest — query failed', undefined, { error: error.message })
      return null
    }

    if (!data) return null

    return {
      export_id:     data.export_id,
      tenant_id:     data.tenant_id,
      exported_at:   data.exported_at,
      records_total: data.records_total,
      entity_types:  data.entity_types ?? [],
      from_date:     data.from_date ?? '',
      to_date:       data.to_date   ?? '',
      storage_paths: data.storage_paths ?? [],
      bucket:        data.bucket,
      checksum:      data.checksum ?? '',
      size_bytes:    data.size_bytes ?? 0,
    }
  } catch (err) {
    log.error('[trainingStorage] getLatestManifest — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// downloadTrainingExport
// ---------------------------------------------------------------------------

export async function downloadTrainingExport(manifestId: string): Promise<string> {
  // Fetch manifest by export_id
  const { data: manifest, error: mErr } = await (supabaseAdmin as any)
    .from('training_export_manifests')
    .select('*')
    .eq('export_id', manifestId)
    .maybeSingle()

  if (mErr || !manifest) {
    throw new Error(`Manifest not found: ${manifestId}`)
  }

  const paths: string[] = manifest.storage_paths ?? []

  if (paths.length === 0) {
    throw new Error(`Manifest ${manifestId} has no storage paths`)
  }

  const parts: string[] = []
  const decoder = new TextDecoder()

  for (const path of paths) {
    const { data, error } = await (supabaseAdmin as any).storage
      .from(manifest.bucket)
      .download(path)

    if (error || !data) {
      throw new Error(`Failed to download chunk ${path}: ${error?.message ?? 'no data'}`)
    }

    const arrayBuffer = await (data as Blob).arrayBuffer()
    parts.push(decoder.decode(arrayBuffer))
  }

  return parts.join('')
}
