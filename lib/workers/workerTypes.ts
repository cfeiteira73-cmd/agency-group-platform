// Agency Group — Named Worker Shared Types
// lib/workers/workerTypes.ts
// Shared interfaces for all named background workers.
// TypeScript strict — 0 errors

// ─── Config ───────────────────────────────────────────────────────────────────

export interface NamedWorkerConfig {
  name: string
  queue_name: string
  batch_size: number
  poll_interval_ms: number
  max_retries: number
  tenant_id: string
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface WorkerHealth {
  worker_name: string
  tenant_id: string
  status: 'running' | 'idle' | 'error' | 'stopped'
  jobs_processed: number
  jobs_failed: number
  jobs_retried: number
  last_job_at: string | null
  last_error: string | null
  started_at: string
  updated_at: string
}
