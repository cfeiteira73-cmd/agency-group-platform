// =============================================================================
// Agency Group — Agent Memory Layer
// lib/ai/memory/index.ts
//
// Persistent, replay-safe, tenant-isolated memory for AI agents.
// Supabase-backed. Supports TTL-based expiry, versioning, and scoped recall.
//
// DESIGN:
//   - All functions are async and return typed Promises
//   - All Supabase calls are wrapped in try/catch — fail-open
//   - No module-level side effects or instantiation
//   - createClient<any> with eslint-disable for untyped table
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// -- CREATE TABLE agent_memory (
// --   id uuid primary key default gen_random_uuid(),
// --   tenant_id text not null,
// --   scope text not null,
// --   entity_id text not null,
// --   key text not null,
// --   value jsonb not null,
// --   ttl_days int,
// --   version int not null default 1,
// --   created_at timestamptz not null default now(),
// --   updated_at timestamptz not null default now(),
// --   UNIQUE (tenant_id, scope, entity_id, key)
// -- );
// -- CREATE INDEX idx_agent_memory_entity ON agent_memory(tenant_id, scope, entity_id);

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryScope = 'tenant' | 'deal' | 'buyer' | 'agent_session'

export interface MemoryEntry {
  id?: string
  tenant_id: string
  scope: MemoryScope
  entity_id: string
  key: string
  value: Record<string, unknown>
  ttl_days?: number
  version: number
  created_at?: string
  updated_at?: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── rememberContext ──────────────────────────────────────────────────────────

/**
 * Upsert a memory entry into Supabase 'agent_memory' on the unique constraint
 * (tenant_id, scope, entity_id, key). Increments version on conflict.
 * Fails open — never throws.
 */
export async function rememberContext(
  entry: Omit<MemoryEntry, 'id' | 'version' | 'created_at' | 'updated_at'>,
): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('[agent-memory] Supabase not configured — skipping rememberContext')
    return
  }

  try {
    // First try an upsert. Supabase upsert with onConflict increments via a
    // raw expression workaround: we do a select + conditional insert/update.
    const { data: existing, error: selectError } = await client
      .from('agent_memory')
      .select('id, version')
      .eq('tenant_id', entry.tenant_id)
      .eq('scope', entry.scope)
      .eq('entity_id', entry.entity_id)
      .eq('key', entry.key)
      .maybeSingle()

    if (selectError) {
      console.warn('[agent-memory] rememberContext select error:', selectError.message)
      return
    }

    if (existing) {
      // Update — increment version
      const { error: updateError } = await client
        .from('agent_memory')
        .update({
          value: entry.value,
          ttl_days: entry.ttl_days ?? null,
          version: (existing.version as number) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.warn('[agent-memory] rememberContext update error:', updateError.message)
      }
    } else {
      // Insert new entry
      const { error: insertError } = await client.from('agent_memory').insert({
        tenant_id: entry.tenant_id,
        scope: entry.scope,
        entity_id: entry.entity_id,
        key: entry.key,
        value: entry.value,
        ttl_days: entry.ttl_days ?? null,
        version: 1,
      })

      if (insertError) {
        console.warn('[agent-memory] rememberContext insert error:', insertError.message)
      }
    }
  } catch (err) {
    console.warn('[agent-memory] rememberContext unexpected error:', err)
  }
}

// ─── recallContext ────────────────────────────────────────────────────────────

/**
 * Fetches memory entries for a given entity.
 * If key is provided, returns a single-element array (or empty if not found).
 * Filters out expired entries based on ttl_days from created_at.
 * Fails open — returns [] on error.
 */
export async function recallContext(
  tenantId: string,
  scope: MemoryScope,
  entityId: string,
  key?: string,
): Promise<MemoryEntry[]> {
  const client = getClient()
  if (!client) {
    console.warn('[agent-memory] Supabase not configured — skipping recallContext')
    return []
  }

  try {
    let query = client
      .from('agent_memory')
      .select('id, tenant_id, scope, entity_id, key, value, ttl_days, version, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('scope', scope)
      .eq('entity_id', entityId)

    if (key !== undefined) {
      query = query.eq('key', key)
    }

    const { data, error } = await query.order('updated_at', { ascending: false })

    if (error) {
      console.warn('[agent-memory] recallContext query error:', error.message)
      return []
    }

    const now = Date.now()

    const entries: MemoryEntry[] = []
    for (const row of data ?? []) {
      const r = row as {
        id: string
        tenant_id: string
        scope: MemoryScope
        entity_id: string
        key: string
        value: Record<string, unknown>
        ttl_days: number | null
        version: number
        created_at: string
        updated_at: string
      }

      // Filter out expired entries
      if (r.ttl_days !== null) {
        const createdAt = new Date(r.created_at).getTime()
        const expiresAt = createdAt + r.ttl_days * 24 * 60 * 60 * 1000
        if (now > expiresAt) continue
      }

      entries.push({
        id: r.id,
        tenant_id: r.tenant_id,
        scope: r.scope,
        entity_id: r.entity_id,
        key: r.key,
        value: r.value,
        ttl_days: r.ttl_days ?? undefined,
        version: r.version,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })
    }

    return entries
  } catch (err) {
    console.warn('[agent-memory] recallContext unexpected error:', err)
    return []
  }
}

// ─── forgetContext ────────────────────────────────────────────────────────────

/**
 * Deletes memory entries for an entity.
 * If key is provided, deletes only that specific entry.
 * Fails open — never throws.
 */
export async function forgetContext(
  tenantId: string,
  scope: MemoryScope,
  entityId: string,
  key?: string,
): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('[agent-memory] Supabase not configured — skipping forgetContext')
    return
  }

  try {
    let query = client
      .from('agent_memory')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('scope', scope)
      .eq('entity_id', entityId)

    if (key !== undefined) {
      query = query.eq('key', key)
    }

    const { error } = await query

    if (error) {
      console.warn('[agent-memory] forgetContext delete error:', error.message)
    }
  } catch (err) {
    console.warn('[agent-memory] forgetContext unexpected error:', err)
  }
}

// ─── snapshotMemory ───────────────────────────────────────────────────────────

/**
 * Returns all memory for an entity as a flat key→value map, merging all scopes.
 * Used before AI calls to inject persistent context.
 * Later scopes overwrite earlier ones if keys collide (last-write wins by updated_at).
 * Fails open — returns {} on error.
 */
export async function snapshotMemory(
  tenantId: string,
  entityId: string,
): Promise<Record<string, unknown>> {
  const client = getClient()
  if (!client) {
    console.warn('[agent-memory] Supabase not configured — skipping snapshotMemory')
    return {}
  }

  try {
    const { data, error } = await client
      .from('agent_memory')
      .select('key, value, ttl_days, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('entity_id', entityId)
      .order('updated_at', { ascending: true }) // ascending so later writes win on merge

    if (error) {
      console.warn('[agent-memory] snapshotMemory query error:', error.message)
      return {}
    }

    const now = Date.now()
    const snapshot: Record<string, unknown> = {}

    for (const row of data ?? []) {
      const r = row as {
        key: string
        value: Record<string, unknown>
        ttl_days: number | null
        created_at: string
        updated_at: string
      }

      // Skip expired entries
      if (r.ttl_days !== null) {
        const createdAt = new Date(r.created_at).getTime()
        const expiresAt = createdAt + r.ttl_days * 24 * 60 * 60 * 1000
        if (now > expiresAt) continue
      }

      snapshot[r.key] = r.value
    }

    return snapshot
  } catch (err) {
    console.warn('[agent-memory] snapshotMemory unexpected error:', err)
    return {}
  }
}
