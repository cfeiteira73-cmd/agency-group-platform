// AGENCY GROUP — SH-ROS Recovery: distributedLocks | AMI: 22506
// Distributed lock management using optimistic locking on operator_tasks table.
// Prevents concurrent execution of critical recovery/reconciliation sections.
// TTL-based expiry: locks older than ttl_ms are considered released.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DistributedLock {
  lock_key: string
  owner_id: string
  acquired_at: string
  expires_at: string
  token: string
}

// ─── DistributedLockManager ───────────────────────────────────────────────────

const LOCK_TASK_TYPE = 'distributed_lock'
const DEFAULT_TTL_MS = 30_000 // 30 seconds

export class DistributedLockManager {
  /**
   * Attempt to acquire a distributed lock.
   * Uses INSERT with unique constraint on (title, task_type) for atomicity.
   * Returns null if lock is already held by another owner.
   */
  async acquire(
    lock_key: string,
    owner_id: string,
    ttl_ms = DEFAULT_TTL_MS
  ): Promise<DistributedLock | null> {
    try {
      // First, evict expired locks for this key
      await this._evictExpired(lock_key)

      const now = new Date()
      const expires_at = new Date(now.getTime() + ttl_ms).toISOString()
      const acquired_at = now.toISOString()
      const token = randomUUID()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any).from('operator_tasks').insert({
        task_type: LOCK_TASK_TYPE,
        title: lock_key,
        status: 'pending',
        priority: 'high',
        metadata: {
          owner_id,
          expires_at,
          token,
          acquired_at,
          lock_key,
        },
      } as Record<string, unknown>)

      if (error) {
        // Unique constraint violation = lock already held
        if (error.code === '23505') return null
        throw error
      }

      return { lock_key, owner_id, acquired_at, expires_at, token }
    } catch (err) {
      // If it's a unique constraint violation propagated differently
      const errMsg = String(err)
      if (errMsg.includes('23505') || errMsg.toLowerCase().includes('unique')) return null
      console.warn('[DistributedLockManager] acquire error:', err)
      return null
    }
  }

  /**
   * Release a lock. Only the token holder can release.
   */
  async release(lock: DistributedLock): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('operator_tasks')
        .delete()
        .eq('task_type', LOCK_TASK_TYPE)
        .eq('title', lock.lock_key)
        .contains('metadata', { token: lock.token } as Record<string, unknown>)
        .select('id')

      if (error) throw error
      return (data?.length ?? 0) > 0
    } catch (err) {
      console.warn('[DistributedLockManager] release error:', err)
      return false
    }
  }

  /**
   * Extend the TTL of an existing lock (renew lease).
   * Only succeeds if the token still matches.
   */
  async extend(lock: DistributedLock, ttl_ms: number): Promise<boolean> {
    try {
      const new_expires_at = new Date(Date.now() + ttl_ms).toISOString()

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('operator_tasks')
        .select('id, metadata')
        .eq('task_type', LOCK_TASK_TYPE)
        .eq('title', lock.lock_key)
        .single()

      if (fetchErr || !existing) return false

      const meta = (existing as Record<string, unknown>).metadata as Record<string, unknown>
      if (meta.token !== lock.token) return false

      const { error } = await supabaseAdmin
        .from('operator_tasks')
        .update({
          metadata: { ...meta, expires_at: new_expires_at },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', (existing as Record<string, unknown>).id as string)

      if (error) throw error
      return true
    } catch (err) {
      console.warn('[DistributedLockManager] extend error:', err)
      return false
    }
  }

  /**
   * Check if a lock key is currently held (non-expired).
   */
  async isLocked(lock_key: string): Promise<boolean> {
    try {
      await this._evictExpired(lock_key)

      const { data, error } = await supabaseAdmin
        .from('operator_tasks')
        .select('id')
        .eq('task_type', LOCK_TASK_TYPE)
        .eq('title', lock_key)
        .limit(1)

      if (error) throw error
      return (data?.length ?? 0) > 0
    } catch (err) {
      console.warn('[DistributedLockManager] isLocked error:', err)
      return false
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Delete expired locks for a key so new acquisitions can succeed.
   */
  private async _evictExpired(lock_key: string): Promise<void> {
    try {
      const { data, error: fetchErr } = await supabaseAdmin
        .from('operator_tasks')
        .select('id, metadata')
        .eq('task_type', LOCK_TASK_TYPE)
        .eq('title', lock_key)

      if (fetchErr || !data) return

      const now = new Date()
      const expiredIds: string[] = []

      for (const row of data) {
        const meta = (row as Record<string, unknown>).metadata as Record<string, unknown>
        if (meta?.expires_at && new Date(meta.expires_at as string) < now) {
          expiredIds.push((row as Record<string, unknown>).id as string)
        }
      }

      if (expiredIds.length > 0) {
        await supabaseAdmin
          .from('operator_tasks')
          .delete()
          .in('id', expiredIds)
      }
    } catch (err) {
      console.warn('[DistributedLockManager] _evictExpired error:', err)
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const distributedLockManager = new DistributedLockManager()
