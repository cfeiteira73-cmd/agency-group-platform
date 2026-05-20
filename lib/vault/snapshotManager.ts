// =============================================================================
// Agency Group — Vault Snapshot Manager
// lib/vault/snapshotManager.ts
//
// Creates daily snapshots of system state for reconstruction guarantee.
// Captures: vault file hashes, Supabase table counts, event history stats.
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { hashFile } from './hashEngine'
import { join } from 'path'

export interface SnapshotManifest {
  snapshot_id: string
  tenant_id: string
  created_at: string
  vault_files: Record<string, string | null>  // path → SHA-256 hash
  db_table_counts: Record<string, number>
  event_history_count: number
  ai_audit_count: number
  causal_trace_count: number
  schema_version: string
}

const SNAPSHOT_FILES = [
  'SH-ROS-VAULT/system-bible/SH-ROS_MASTER_BIBLE.md',
  'SH-ROS-VAULT/VAULT_MANIFEST.json',
  'lib/ai/policyEngine.ts',
  'lib/ai/contracts/index.ts',
  'lib/ops/withAI.ts',
  'lib/events/bus.ts',
  'lib/auth/rbac.ts',
  'lib/billing/tenantQuota.ts',
  'lib/billing/usageMeter.ts',
  'lib/security/siem.ts',
  'lib/security/intrusionDetection.ts',
  'lib/security/secretsRotation.ts',
  'lib/graph/intelligence.ts',
  'lib/queue/adapter.ts',
  'lib/workers/processor.ts',
  'lib/causal/queryEngine.ts',
  'middleware.ts',
  'vercel.json',
]

const TRACKED_TABLES = [
  'contacts', 'deals', 'properties', 'matches', 'deal_packs',
  'event_history', 'ai_audit_log', 'causal_trace', 'usage_events',
  'ai_feedback', 'agent_memory', 'job_queue', 'security_events',
]

export async function createSnapshot(tenantId = 'agency-group'): Promise<SnapshotManifest> {
  const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  // Hash all tracked files
  const vaultFiles: Record<string, string | null> = {}
  for (const f of SNAPSHOT_FILES) {
    const h = hashFile(join(process.cwd(), f))
    vaultFiles[f] = h?.hash ?? null
  }

  // Query Supabase for table counts
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const dbCounts: Record<string, number> = {}
  let eventCount = 0, auditCount = 0, causalCount = 0

  if (url && key) {
    const db = createClient(url, key)

    const countQueries = TRACKED_TABLES.map(async table => {
      const { count } = await Promise.resolve(db.from(table).select('*', { count: 'exact', head: true })).catch(() => ({ count: 0 }))
      dbCounts[table] = count ?? 0
    })
    await Promise.allSettled(countQueries)

    // Recent event counts (last 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [evRes, aiRes, causalRes] = await Promise.allSettled([
      db.from('event_history').select('*', { count: 'exact', head: true }).gte('created_at', cutoff),
      db.from('ai_audit_log').select('*', { count: 'exact', head: true }).gte('created_at', cutoff),
      db.from('causal_trace').select('*', { count: 'exact', head: true }).gte('created_at', cutoff),
    ])
    if (evRes.status === 'fulfilled') eventCount = evRes.value.count ?? 0
    if (aiRes.status === 'fulfilled') auditCount = aiRes.value.count ?? 0
    if (causalRes.status === 'fulfilled') causalCount = causalRes.value.count ?? 0

    // Persist snapshot record
    const manifest: SnapshotManifest = {
      snapshot_id: snapshotId,
      tenant_id: tenantId,
      created_at: now,
      vault_files: vaultFiles,
      db_table_counts: dbCounts,
      event_history_count: eventCount,
      ai_audit_count: auditCount,
      causal_trace_count: causalCount,
      schema_version: '1.0.0',
    }

    void db.from('vault_snapshots').insert({
      snapshot_id: snapshotId,
      tenant_id: tenantId,
      manifest: manifest as unknown as Record<string, unknown>,
      vault_file_count: Object.keys(vaultFiles).length,
      files_present: Object.values(vaultFiles).filter(Boolean).length,
      created_at: now,
    }).then(({ error }) => {
      if (error) console.warn('[Snapshot] persist error:', error.message)
    })

    return manifest
  }

  return {
    snapshot_id: snapshotId,
    tenant_id: tenantId,
    created_at: now,
    vault_files: vaultFiles,
    db_table_counts: dbCounts,
    event_history_count: eventCount,
    ai_audit_count: auditCount,
    causal_trace_count: causalCount,
    schema_version: '1.0.0',
  }
}
