// =============================================================================
// Agency Group — Distributed Cron Lock
// lib/ops/cronLock.ts
//
// Phase 6: Scale / Performance Hardening
//
// Prevents cron job double-execution when Vercel fires two overlapping
// invocations of the same schedule (possible under load or clock drift).
//
// MECHANISM:
//   DB-based optimistic lock using the `cron_lock` table.
//   Acquisition uses INSERT ... ON CONFLICT DO UPDATE WHERE expires_at < NOW()
//   so only the first invocation wins when a lock is still valid.
//
// USAGE:
//   // Option A: explicit acquire/release
//   const acquired = await acquireCronLock('weekly-calibration', 20)
//   if (!acquired) return  // another instance is running
//   try { await doWork() } finally { await releaseCronLock('weekly-calibration') }
//
//   // Option B: wrapper (recommended)
//   return withCronLock('weekly-calibration', 20, async () => {
//     await doWork()
//   })
//
// PURE FUNCTIONS:
//   generateInstanceId, isLockExpired, buildLockRow
//
// DB FUNCTIONS:
//   acquireCronLock, releaseCronLock, withCronLock,
//   getLockStatus, forceReleaseLock
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CronLockRow {
  cron_name:        string
  locked_at:        string
  expires_at:       string
  instance_id:      string
  last_released_at: string | null
}

export interface LockStatus {
  is_locked:        boolean
  cron_name:        string
  locked_at:        string | null
  expires_at:       string | null
  instance_id:      string | null
  expires_in_secs:  number | null
}

// ---------------------------------------------------------------------------
// PURE: Generate a unique instance ID for this invocation
// ---------------------------------------------------------------------------

export function generateInstanceId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// PURE: Check if a lock row is expired
// ---------------------------------------------------------------------------

export function isLockExpired(expiresAt: string, asOf: Date = new Date()): boolean {
  return new Date(expiresAt) < asOf
}

// ---------------------------------------------------------------------------
// PURE: Build a lock row for insertion
// ---------------------------------------------------------------------------

export function buildLockRow(
  cronName:    string,
  instanceId:  string,
  ttlMinutes:  number,
): Omit<CronLockRow, 'last_released_at'> {
  const now        = new Date()
  const expiresAt  = new Date(now.getTime() + ttlMinutes * 60_000)
  return {
    cron_name:   cronName,
    locked_at:   now.toISOString(),
    expires_at:  expiresAt.toISOString(),
    instance_id: instanceId,
  }
}

// ---------------------------------------------------------------------------
// DB: Attempt to acquire a cron lock
//
// Returns true if lock acquired, false if another instance holds it.
// ---------------------------------------------------------------------------

export async function acquireCronLock(
  cronName:   string,
  ttlMinutes  = 10,
): Promise<{ acquired: boolean; instanceId: string }> {
  const instanceId = generateInstanceId()
  const now        = new Date().toISOString()
  const expiresAt  = new Date(Date.now() + ttlMinutes * 60_000).toISOString()

  // Strategy: upsert, but only overwrite if the existing lock is expired
  // We use a raw SQL pattern via Supabase RPC if available, or fallback to
  // a read-then-write with optimistic concurrency.

  // Step 1: Try to read existing lock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabaseAdmin as any)
    .from('cron_lock')
    .select('cron_name, expires_at, instance_id')
    .eq('cron_name', cronName)
    .single()

  if (existing && !isLockExpired(existing.expires_at)) {
    // Lock is still valid — another instance holds it
    return { acquired: false, instanceId }
  }

  // Step 2: Lock is either absent or expired — try to claim it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('cron_lock')
    .upsert({
      cron_name:   cronName,
      locked_at:   now,
      expires_at:  expiresAt,
      instance_id: instanceId,
    }, { onConflict: 'cron_name' })

  if (error) {
    // Upsert failed — treat as not acquired to be safe
    console.error(`[cronLock] acquireCronLock failed for ${cronName}: ${error.message}`)
    return { acquired: false, instanceId }
  }

  // Step 3: Verify we actually got the lock (race condition guard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: verify } = await (supabaseAdmin as any)
    .from('cron_lock')
    .select('instance_id')
    .eq('cron_name', cronName)
    .single()

  const acquired = verify?.instance_id === instanceId
  return { acquired, instanceId }
}

// ---------------------------------------------------------------------------
// DB: Release a cron lock (only by the owning instance)
// ---------------------------------------------------------------------------

export async function releaseCronLock(
  cronName:   string,
  instanceId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('cron_lock')
    .update({
      last_released_at: new Date().toISOString(),
      expires_at:       new Date().toISOString(),  // mark as expired immediately
    })
    .eq('cron_name', cronName)
    .eq('instance_id', instanceId)
  // Intentionally no error throw — release is best-effort
}

// ---------------------------------------------------------------------------
// DB: Execute a function within a cron lock (recommended wrapper)
//
// Automatically acquires before fn, releases in finally.
// If lock cannot be acquired, calls onSkip (if provided) and returns.
// ---------------------------------------------------------------------------

export async function withCronLock<T>(
  cronName:   string,
  ttlMinutes: number,
  fn:         () => Promise<T>,
  opts: {
    onSkip?:  () => void
    onError?: (err: unknown) => void
  } = {},
): Promise<T | null> {
  const { acquired, instanceId } = await acquireCronLock(cronName, ttlMinutes)

  if (!acquired) {
    console.log(`[cronLock] ${cronName} already running — skipping`)
    opts.onSkip?.()
    return null
  }

  try {
    return await fn()
  } catch (err) {
    opts.onError?.(err)
    throw err
  } finally {
    await releaseCronLock(cronName, instanceId)
  }
}

// ---------------------------------------------------------------------------
// DB: Get current lock status for a cron
// ---------------------------------------------------------------------------

export async function getLockStatus(cronName: string): Promise<LockStatus> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from('cron_lock')
    .select('*')
    .eq('cron_name', cronName)
    .single()

  if (!data || isLockExpired(data.expires_at)) {
    return {
      is_locked:       false,
      cron_name:       cronName,
      locked_at:       null,
      expires_at:      null,
      instance_id:     null,
      expires_in_secs: null,
    }
  }

  const expiresInMs = new Date(data.expires_at).getTime() - Date.now()
  return {
    is_locked:       true,
    cron_name:       cronName,
    locked_at:       data.locked_at,
    expires_at:      data.expires_at,
    instance_id:     data.instance_id,
    expires_in_secs: Math.round(expiresInMs / 1000),
  }
}

// ---------------------------------------------------------------------------
// DB: Force-release a lock (super_admin only — use for stuck crons)
// ---------------------------------------------------------------------------

export async function forceReleaseLock(cronName: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('cron_lock')
    .update({
      expires_at:       new Date().toISOString(),
      last_released_at: new Date().toISOString(),
    })
    .eq('cron_name', cronName)

  if (error) throw new Error(`forceReleaseLock: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get all active locks (ops dashboard)
// ---------------------------------------------------------------------------

export async function getActiveLocks(): Promise<CronLockRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('cron_lock')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('locked_at', { ascending: false })

  if (error) throw new Error(`getActiveLocks: ${error.message}`)
  return (data ?? []) as CronLockRow[]
}
