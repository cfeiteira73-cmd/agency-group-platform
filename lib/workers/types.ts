// Agency Group — Worker Types
// lib/workers/types.ts
// Shared types for all background workers.
// TypeScript strict — 0 errors

// ─── Worker Identifiers ───────────────────────────────────────────────────────

export type WorkerName =
  | 'ai-execution'
  | 'replay'
  | 'dlq-processor'
  | 'enrichment'
  | 'analytics'
  | 'followup'
  | 'scoring'

// ─── Configuration ────────────────────────────────────────────────────────────

export interface WorkerConfig {
  name: WorkerName
  queue: string
  concurrency: number           // max parallel jobs
  retryDelayMs: number
  timeoutMs: number
  enabled: boolean
}

// ─── Job Lifecycle ────────────────────────────────────────────────────────────

export interface WorkerJob<T = unknown> {
  jobId: string
  workerName: WorkerName
  payload: T
  tenant_id: string
  correlation_id: string
  startedAt: string
}

export interface WorkerResult {
  jobId: string
  success: boolean
  durationMs: number
  output?: unknown
  error?: string
}

export type WorkerHandler<T = unknown> = (job: WorkerJob<T>) => Promise<WorkerResult>

// ─── Registry ─────────────────────────────────────────────────────────────────

export const WORKER_REGISTRY: Record<WorkerName, WorkerConfig> = {
  'ai-execution':  { name: 'ai-execution',  queue: 'ai_jobs',         concurrency: 3,  retryDelayMs: 5000,  timeoutMs: 120000, enabled: true  },
  'replay':        { name: 'replay',        queue: 'replay_jobs',     concurrency: 1,  retryDelayMs: 10000, timeoutMs: 60000,  enabled: true  },
  'dlq-processor': { name: 'dlq-processor', queue: 'dlq',             concurrency: 2,  retryDelayMs: 30000, timeoutMs: 30000,  enabled: true  },
  'enrichment':    { name: 'enrichment',    queue: 'enrichment_jobs', concurrency: 5,  retryDelayMs: 5000,  timeoutMs: 30000,  enabled: true  },
  'analytics':     { name: 'analytics',     queue: 'analytics_jobs',  concurrency: 2,  retryDelayMs: 5000,  timeoutMs: 60000,  enabled: false },
  'followup':      { name: 'followup',      queue: 'followup_jobs',   concurrency: 3,  retryDelayMs: 5000,  timeoutMs: 30000,  enabled: true  },
  'scoring':       { name: 'scoring',       queue: 'scoring_jobs',    concurrency: 5,  retryDelayMs: 3000,  timeoutMs: 20000,  enabled: true  },
}
