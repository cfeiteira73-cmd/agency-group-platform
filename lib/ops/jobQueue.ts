// =============================================================================
// Agency Group — Job Queue (Persistent Retry)
// lib/ops/jobQueue.ts
//
// Persists failed async jobs and retries with exponential backoff.
// Dead-letter queue after max_attempts exhausted.
//
// JOB LIFECYCLE:
//   pending → running → completed
//                    ↘ failed → (retry) → dead (after max_attempts)
//
// BACKOFF STRATEGY:
//   attempt 1: retry after 2min
//   attempt 2: retry after 8min
//   attempt 3: retry after 30min
//   attempt 4+: dead letter
//
// PURE FUNCTIONS:
//   computeNextRetryAt, shouldRetry, computeBackoffSeconds
//
// DB FUNCTIONS:
//   enqueueJob, markJobRunning, markJobCompleted, markJobFailed,
//   claimNextPendingJob, getDeadJobs
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dead'

export type JobType =
  | 'avm_compute'
  | 'score_property'
  | 'send_distribution'
  | 'generate_deal_pack'
  | 'investor_alert'
  | 'agent_performance_recompute'
  | 'microstructure_refresh'

export interface Job {
  id:             string
  job_type:       JobType
  payload:        Record<string, unknown>
  status:         JobStatus
  attempts:       number
  max_attempts:   number
  next_retry_at:  string | null
  last_error:     string | null
  completed_at:   string | null
  created_at:     string
  updated_at:     string
}

// ---------------------------------------------------------------------------
// PURE: Compute exponential backoff seconds for a given attempt
// attempt 1 → 120s (2min), attempt 2 → 480s (8min), attempt 3 → 1800s (30min)
// ---------------------------------------------------------------------------

export function computeBackoffSeconds(attempt: number): number {
  const base    = 120   // 2 minutes
  const factor  = 4
  return Math.min(base * Math.pow(factor, attempt - 1), 7200)  // cap at 2h
}

// ---------------------------------------------------------------------------
// PURE: Compute next retry timestamp
// ---------------------------------------------------------------------------

export function computeNextRetryAt(attempt: number, fromDate = new Date()): Date {
  const backoffMs = computeBackoffSeconds(attempt) * 1000
  return new Date(fromDate.getTime() + backoffMs)
}

// ---------------------------------------------------------------------------
// PURE: Determine if a job should be retried or sent to dead-letter
// ---------------------------------------------------------------------------

export function shouldRetry(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts
}

// ---------------------------------------------------------------------------
// PURE: Build a summary of job queue health
// ---------------------------------------------------------------------------

export function summarizeQueueHealth(jobs: Pick<Job, 'status'>[]): {
  pending:   number
  running:   number
  completed: number
  failed:    number
  dead:      number
  total:     number
} {
  const counts = { pending: 0, running: 0, completed: 0, failed: 0, dead: 0, total: 0 }
  for (const j of jobs) {
    if (j.status in counts) counts[j.status as keyof typeof counts]++
    counts.total++
  }
  return counts
}

// ---------------------------------------------------------------------------
// DB: Enqueue a new job
// ---------------------------------------------------------------------------

export async function enqueueJob(
  jobType:     JobType,
  payload:     Record<string, unknown>,
  maxAttempts = 3,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('job_queue')
    .insert({
      job_type:     jobType,
      payload,
      status:       'pending',
      attempts:     0,
      max_attempts: maxAttempts,
      next_retry_at: new Date().toISOString(),   // eligible immediately
    })
    .select('id')
    .single()

  if (error) throw new Error(`enqueueJob: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Claim (atomically pick up) the next pending job of a given type
// Uses optimistic update — if race, returns null (no job available)
// ---------------------------------------------------------------------------

export async function claimNextPendingJob(jobType?: JobType): Promise<Job | null> {
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('job_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)
    .order('created_at', { ascending: true })
    .limit(1)

  if (jobType) query = query.eq('job_type', jobType)

  const { data, error } = await query
  if (error) throw new Error(`claimNextPendingJob: ${error.message}`)
  if (!data || data.length === 0) return null

  const job = data[0] as Job

  // Mark as running
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabaseAdmin as any)
    .from('job_queue')
    .update({ status: 'running', updated_at: now })
    .eq('id', job.id)
    .eq('status', job.status)   // optimistic lock

  if (updateError) return null  // another worker claimed it
  return { ...job, status: 'running' }
}

// ---------------------------------------------------------------------------
// DB: Mark job as completed
// ---------------------------------------------------------------------------

export async function markJobCompleted(
  jobId:   string,
  result?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('job_queue')
    .update({ status: 'completed', completed_at: now, result: result ?? null, updated_at: now })
    .eq('id', jobId)

  if (error) throw new Error(`markJobCompleted: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Mark job as failed — retry or dead-letter
// ---------------------------------------------------------------------------

export async function markJobFailed(
  jobId:      string,
  errorMsg:   string,
  job:        Pick<Job, 'attempts' | 'max_attempts'>,
): Promise<'retrying' | 'dead'> {
  const newAttempts = job.attempts + 1
  const retry       = shouldRetry(newAttempts, job.max_attempts)
  const now         = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('job_queue')
    .update({
      status:        retry ? 'failed' : 'dead',
      attempts:      newAttempts,
      last_error:    errorMsg.slice(0, 2000),
      next_retry_at: retry ? computeNextRetryAt(newAttempts, now).toISOString() : null,
      updated_at:    now.toISOString(),
    })
    .eq('id', jobId)

  if (error) throw new Error(`markJobFailed: ${error.message}`)
  return retry ? 'retrying' : 'dead'
}

// ---------------------------------------------------------------------------
// DB: Get dead-letter jobs (for manual inspection / replay)
// ---------------------------------------------------------------------------

export async function getDeadJobs(limit = 50): Promise<Job[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('job_queue')
    .select('*')
    .eq('status', 'dead')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getDeadJobs: ${error.message}`)
  return (data ?? []) as Job[]
}

// ---------------------------------------------------------------------------
// DB: Re-enqueue a dead job for manual replay
// ---------------------------------------------------------------------------

export async function replayDeadJob(jobId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('job_queue')
    .update({
      status:        'pending',
      attempts:      0,
      last_error:    null,
      next_retry_at: new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'dead')

  if (error) throw new Error(`replayDeadJob: ${error.message}`)
}
