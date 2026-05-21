// =============================================================================
// Agency Group — Storage Bucket Bootstrap
// lib/storage/buckets.ts
//
// Idempotently ensures required Supabase Storage buckets exist.
// Called from ml-training-sync cron (weekly) so buckets are auto-created
// on first deployment without manual dashboard steps.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Bucket definitions
// ---------------------------------------------------------------------------

interface BucketSpec {
  id:               string
  public:           boolean
  fileSizeLimit:    number                // bytes
  allowedMimeTypes: string[]
}

const REQUIRED_BUCKETS: BucketSpec[] = [
  {
    id:               'ml-training-data',
    public:           false,
    fileSizeLimit:    104_857_600,        // 100 MB
    allowedMimeTypes: ['application/json', 'text/csv', 'application/octet-stream', 'text/plain'],
  },
  {
    id:               'ml-models',
    public:           false,
    fileSizeLimit:    524_288_000,        // 500 MB
    allowedMimeTypes: ['application/json', 'application/octet-stream'],
  },
]

// ---------------------------------------------------------------------------
// ensureStorageBuckets
// ---------------------------------------------------------------------------

export interface BucketBootstrapResult {
  created:  string[]
  existing: string[]
  errors:   string[]
}

/**
 * Idempotently creates all required storage buckets.
 * Safe to call on every startup — no-ops for already-existing buckets.
 * Never throws — errors are returned in the `errors` array.
 */
export async function ensureStorageBuckets(): Promise<BucketBootstrapResult> {
  const created:  string[] = []
  const existing: string[] = []
  const errors:   string[] = []

  for (const spec of REQUIRED_BUCKETS) {
    try {
      const { error } = await supabaseAdmin.storage.createBucket(spec.id, {
        public:           spec.public,
        fileSizeLimit:    spec.fileSizeLimit,
        allowedMimeTypes: spec.allowedMimeTypes,
      })

      if (error) {
        // "already exists" is success — not an error
        if (
          error.message.toLowerCase().includes('already exists') ||
          error.message.toLowerCase().includes('duplicate') ||
          (error as unknown as Record<string, unknown>)['statusCode'] === '409'
        ) {
          existing.push(spec.id)
          log.info('[ensureStorageBuckets] bucket already exists', { bucket_id: spec.id })
        } else {
          errors.push(`${spec.id}: ${error.message}`)
          log.warn('[ensureStorageBuckets] bucket creation failed', {
            bucket_id: spec.id,
            error:     error.message,
          })
        }
      } else {
        created.push(spec.id)
        log.info('[ensureStorageBuckets] bucket created', { bucket_id: spec.id })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${spec.id}: ${msg}`)
      log.warn('[ensureStorageBuckets] bucket setup exception', {
        bucket_id: spec.id,
        error:     msg,
      })
    }
  }

  return { created, existing, errors }
}
