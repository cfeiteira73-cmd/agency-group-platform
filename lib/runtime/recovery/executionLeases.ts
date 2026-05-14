// AGENCY GROUP — SH-ROS Recovery: executionLeases | AMI: 22506
// Execution lease system — prevents duplicate execution of the same event
// by multiple workers. Stored in operator_tasks with task_type='execution_lease'.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionLease {
  lease_id: string
  event_id: string
  agent_id: string
  org_id: string
  acquired_at: string
  expires_at: string
  renewed_count: number
}

// ─── ExecutionLeaseManager ────────────────────────────────────────────────────

const LEASE_TASK_TYPE = 'execution_lease'
const DEFAULT_TTL_MS = 60_000 // 1 minute per execution attempt

export class ExecutionLeaseManager {
  /**
   * Acquire an execution lease for event_id+agent_id pair.
   * Returns null if another worker already holds the lease.
   * Uses INSERT on unique (title, task_type) for atomicity.
   */
  async acquireLease(
    event_id: string,
    agent_id: string,
    ttl_ms = DEFAULT_TTL_MS
  ): Promise<ExecutionLease | null> {
    try {
      // Evict expired leases for this event first
      await this._evictExpiredForEvent(event_id)

      const lease_id = randomUUID()
      const now = new Date()
      const acquired_at = now.toISOString()
      const expires_at = new Date(now.getTime() + ttl_ms).toISOString()
      const lease_key = `${event_id}:${agent_id}`

      // Fetch org_id from runtime_events
      const org_id = await this._getOrgId(event_id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any).from('operator_tasks').insert({
        task_type: LEASE_TASK_TYPE,
        title: lease_key,
        status: 'in_progress',
        priority: 'high',
        metadata: {
          lease_id,
          event_id,
          agent_id,
          org_id,
          acquired_at,
          expires_at,
          renewed_count: 0,
        },
      } as Record<string, unknown>)

      if (error) {
        // Unique constraint = lease already held
        if (error.code === '23505') return null
        throw error
      }

      return { lease_id, event_id, agent_id, org_id, acquired_at, expires_at, renewed_count: 0 }
    } catch (err) {
      const errMsg = String(err)
      if (errMsg.includes('23505') || errMsg.toLowerCase().includes('unique')) return null
      console.warn('[ExecutionLeaseManager] acquireLease error:', err)
      return null
    }
  }

  /**
   * Renew a lease TTL (extend expiry by another DEFAULT_TTL_MS).
   * Only succeeds if the lease_id still matches in the DB.
   */
  async renewLease(lease: ExecutionLease, ttl_ms = DEFAULT_TTL_MS): Promise<boolean> {
    try {
      const lease_key = `${lease.event_id}:${lease.agent_id}`
      const new_expires_at = new Date(Date.now() + ttl_ms).toISOString()

      const { data, error: fetchErr } = await supabaseAdmin
        .from('operator_tasks')
        .select('id, metadata')
        .eq('task_type', LEASE_TASK_TYPE)
        .eq('title', lease_key)
        .single()

      if (fetchErr || !data) return false

      const meta = (data as Record<string, unknown>).metadata as Record<string, unknown>
      if (meta.lease_id !== lease.lease_id) return false

      const renewed_count = ((meta.renewed_count as number) ?? 0) + 1

      const { error } = await supabaseAdmin
        .from('operator_tasks')
        .update({
          metadata: { ...meta, expires_at: new_expires_at, renewed_count },
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', (data as Record<string, unknown>).id as string)

      if (error) throw error
      return true
    } catch (err) {
      console.warn('[ExecutionLeaseManager] renewLease error:', err)
      return false
    }
  }

  /**
   * Release a lease after execution completes (success or failure).
   */
  async releaseLease(lease: ExecutionLease): Promise<void> {
    try {
      const lease_key = `${lease.event_id}:${lease.agent_id}`

      await supabaseAdmin
        .from('operator_tasks')
        .delete()
        .eq('task_type', LEASE_TASK_TYPE)
        .eq('title', lease_key)
        .contains('metadata', { lease_id: lease.lease_id } as Record<string, unknown>)
    } catch (err) {
      console.warn('[ExecutionLeaseManager] releaseLease error:', err)
    }
  }

  /**
   * List all active (non-expired) execution leases, optionally filtered by org.
   */
  async getActiveleases(org_id?: string): Promise<ExecutionLease[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('operator_tasks')
        .select('metadata')
        .eq('task_type', LEASE_TASK_TYPE)
        .order('created_at', { ascending: false })

      if (error) throw error

      const now = new Date()

      return (data ?? [])
        .map((row) => (row as Record<string, unknown>).metadata as ExecutionLease)
        .filter((m) => {
          if (!m) return false
          if (new Date(m.expires_at) < now) return false
          if (org_id && m.org_id !== org_id) return false
          return true
        })
    } catch (err) {
      console.warn('[ExecutionLeaseManager] getActiveleases error:', err)
      return []
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _evictExpiredForEvent(event_id: string): Promise<void> {
    try {
      const { data, error } = await supabaseAdmin
        .from('operator_tasks')
        .select('id, metadata')
        .eq('task_type', LEASE_TASK_TYPE)
        .like('title', `${event_id}:%`)

      if (error || !data) return

      const now = new Date()
      const expiredIds: string[] = []

      for (const row of data) {
        const meta = (row as Record<string, unknown>).metadata as Record<string, unknown>
        if (meta?.expires_at && new Date(meta.expires_at as string) < now) {
          expiredIds.push((row as Record<string, unknown>).id as string)
        }
      }

      if (expiredIds.length > 0) {
        await supabaseAdmin.from('operator_tasks').delete().in('id', expiredIds)
      }
    } catch (err) {
      console.warn('[ExecutionLeaseManager] _evictExpiredForEvent error:', err)
    }
  }

  private async _getOrgId(event_id: string): Promise<string> {
    try {
      const { data, error } = await supabaseAdmin
        .from('runtime_events')
        .select('org_id')
        .eq('event_id', event_id)
        .single()

      if (error || !data) return 'unknown'
      return ((data as Record<string, unknown>).org_id as string) ?? 'unknown'
    } catch {
      return 'unknown'
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const executionLeaseManager = new ExecutionLeaseManager()
