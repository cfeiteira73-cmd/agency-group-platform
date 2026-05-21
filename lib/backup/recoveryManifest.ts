// Agency Group — Recovery Manifest
// lib/backup/recoveryManifest.ts
// TypeScript strict — 0 errors
//
// SHA-256 chained recovery manifests. Each manifest links:
//   snapshot checksum + event offsets + Kafka replay watermark
//   + DB row counts + ML artifact hashes + audit chain hash
//
// Chain: manifest_hash = SHA256(JSON.stringify({...manifest, manifest_hash: ''}))

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecoveryManifest {
  manifest_id: string
  tenant_id: string
  version: number             // Auto-increment per tenant
  previous_manifest_hash: string | null  // SHA-256 chain
  manifest_hash: string       // SHA-256 of entire manifest minus this field

  // Snapshot state
  db_snapshot_checksum: string
  db_row_counts: Record<string, number>   // table → count

  // Event state
  kafka_replay_watermark: string     // last_event_id in kafka_event_log
  event_count_total: number

  // ML state
  ml_artifact_hashes: Record<string, string>  // model_name → sha256
  last_training_run_id: string | null

  // Audit state
  audit_chain_last_hash: string
  audit_sequence_number: number

  created_at: string
  recovery_tested: boolean
  recovery_tested_at: string | null
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TRACKED_TABLES = [
  'contacts',
  'deals',
  'properties',
  'matches',
  'audit_log_entries',
  'immutable_backups',
  'recovery_manifests',
  'credential_registry',
] as const

function computeManifestHash(manifest: Omit<RecoveryManifest, 'manifest_hash'>): string {
  // Serialize with manifest_hash = '' to produce deterministic hash
  const payload = { ...manifest, manifest_hash: '' }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function rowToManifest(row: Record<string, unknown>): RecoveryManifest {
  return {
    manifest_id: String(row['id'] ?? ''),
    tenant_id: String(row['tenant_id'] ?? ''),
    version: Number(row['version'] ?? 0),
    previous_manifest_hash: row['previous_manifest_hash'] != null
      ? String(row['previous_manifest_hash'])
      : null,
    manifest_hash: String(row['manifest_hash'] ?? ''),
    db_snapshot_checksum: String(row['db_snapshot_checksum'] ?? ''),
    db_row_counts: (row['db_row_counts'] as Record<string, number>) ?? {},
    kafka_replay_watermark: String(row['kafka_replay_watermark'] ?? ''),
    event_count_total: Number(row['event_count_total'] ?? 0),
    ml_artifact_hashes: (row['ml_artifact_hashes'] as Record<string, string>) ?? {},
    last_training_run_id: row['last_training_run_id'] != null
      ? String(row['last_training_run_id'])
      : null,
    audit_chain_last_hash: String(row['audit_chain_last_hash'] ?? ''),
    audit_sequence_number: Number(row['audit_sequence_number'] ?? 0),
    created_at: String(row['created_at'] ?? ''),
    recovery_tested: Boolean(row['recovery_tested']),
    recovery_tested_at: row['recovery_tested_at'] != null
      ? String(row['recovery_tested_at'])
      : null,
  }
}

async function getNextVersion(
  tenantId: string,
): Promise<{ version: number; prevHash: string | null }> {
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('recovery_manifests')
    .select('version, manifest_hash')
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: { version: number; manifest_hash: string } | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[recoveryManifest] getNextVersion — query failed', {
      tenant_id: tenantId,
      error: error.message,
    } as any)
    return { version: 1, prevHash: null }
  }

  if (!data) return { version: 1, prevHash: null }
  return { version: data.version + 1, prevHash: data.manifest_hash }
}

async function queryRowCounts(tenantId: string): Promise<Record<string, number>> {
  const db = supabaseAdmin as any
  const counts: Record<string, number> = {}

  for (const table of TRACKED_TABLES) {
    try {
      const { count, error } = await db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
      counts[table] = error ? 0 : (count ?? 0)
    } catch {
      counts[table] = 0
    }
  }

  return counts
}

async function queryKafkaWatermark(tenantId: string): Promise<{ watermark: string; count: number }> {
  const db = supabaseAdmin as any
  try {
    const { data } = await db
      .from('kafka_event_log')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { id: string } | null }

    if (!data) return { watermark: '', count: 0 }

    const { count } = await db
      .from('kafka_event_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    return { watermark: String(data.id), count: count ?? 0 }
  } catch {
    return { watermark: '', count: 0 }
  }
}

async function queryAuditChainState(tenantId: string): Promise<{ lastHash: string; seqNumber: number }> {
  const db = supabaseAdmin as any
  try {
    const { data } = await db
      .from('audit_log_entries')
      .select('entry_hash, sequence_number')
      .eq('tenant_id', tenantId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { entry_hash: string; sequence_number: number } | null }

    if (!data) return { lastHash: '', seqNumber: 0 }
    return { lastHash: data.entry_hash, seqNumber: data.sequence_number }
  } catch {
    return { lastHash: '', seqNumber: 0 }
  }
}

async function queryLatestSnapshotChecksum(tenantId: string): Promise<string> {
  const db = supabaseAdmin as any
  try {
    const { data } = await db
      .from('backup_snapshots')
      .select('checksum')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { checksum: string | null } | null }

    return data?.checksum ?? ''
  } catch {
    return ''
  }
}

async function queryMLArtifacts(tenantId: string): Promise<{
  hashes: Record<string, string>
  lastRunId: string | null
}> {
  const db = supabaseAdmin as any
  try {
    const { data } = await db
      .from('ml_training_runs')
      .select('id, model_name, artifact_hash')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20) as { data: Array<{ id: string; model_name: string; artifact_hash: string }> | null }

    if (!data || data.length === 0) return { hashes: {}, lastRunId: null }

    const hashes: Record<string, string> = {}
    for (const run of data) {
      if (!hashes[run.model_name]) {
        hashes[run.model_name] = run.artifact_hash ?? ''
      }
    }
    return { hashes, lastRunId: data[0]?.id ?? null }
  } catch {
    return { hashes: {}, lastRunId: null }
  }
}

// ---------------------------------------------------------------------------
// generateManifest
// ---------------------------------------------------------------------------

export async function generateManifest(tenantId: string): Promise<RecoveryManifest> {
  const db = supabaseAdmin as any
  const manifestId = randomUUID()
  const now = new Date().toISOString()

  // Gather all state in parallel
  const [
    { version, prevHash },
    dbRowCounts,
    { watermark, count: eventCount },
    { lastHash: auditLastHash, seqNumber: auditSeq },
    dbSnapshotChecksum,
    { hashes: mlHashes, lastRunId },
  ] = await Promise.all([
    getNextVersion(tenantId),
    queryRowCounts(tenantId),
    queryKafkaWatermark(tenantId),
    queryAuditChainState(tenantId),
    queryLatestSnapshotChecksum(tenantId),
    queryMLArtifacts(tenantId),
  ])

  const manifestWithoutHash: Omit<RecoveryManifest, 'manifest_hash'> = {
    manifest_id: manifestId,
    tenant_id: tenantId,
    version,
    previous_manifest_hash: prevHash,
    db_snapshot_checksum: dbSnapshotChecksum,
    db_row_counts: dbRowCounts,
    kafka_replay_watermark: watermark,
    event_count_total: eventCount,
    ml_artifact_hashes: mlHashes,
    last_training_run_id: lastRunId,
    audit_chain_last_hash: auditLastHash,
    audit_sequence_number: auditSeq,
    created_at: now,
    recovery_tested: false,
    recovery_tested_at: null,
  }

  const manifestHash = computeManifestHash(manifestWithoutHash)

  const fullManifest: RecoveryManifest = { ...manifestWithoutHash, manifest_hash: manifestHash }

  const row = {
    id: manifestId,
    tenant_id: tenantId,
    version,
    previous_manifest_hash: prevHash,
    manifest_hash: manifestHash,
    db_snapshot_checksum: dbSnapshotChecksum,
    db_row_counts: dbRowCounts,
    kafka_replay_watermark: watermark,
    event_count_total: eventCount,
    ml_artifact_hashes: mlHashes,
    last_training_run_id: lastRunId,
    audit_chain_last_hash: auditLastHash,
    audit_sequence_number: auditSeq,
    recovery_tested: false,
    recovery_tested_at: null,
    created_at: now,
  }

  const { error } = await db.from('recovery_manifests').insert(row)
  if (error) {
    log.warn('[recoveryManifest] generateManifest — insert failed', {
      manifest_id: manifestId,
      tenant_id: tenantId,
      error: error.message,
    } as any)
  }

  log.info('[recoveryManifest] generateManifest — complete', {
    manifest_id: manifestId,
    version,
    tenant_id: tenantId,
  } as any)

  return fullManifest
}

// ---------------------------------------------------------------------------
// getLatestManifest
// ---------------------------------------------------------------------------

export async function getLatestManifest(tenantId: string): Promise<RecoveryManifest | null> {
  const db = supabaseAdmin as any

  const { data, error } = await db
    .from('recovery_manifests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: Record<string, unknown> | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[recoveryManifest] getLatestManifest — query failed', {
      tenant_id: tenantId,
      error: error.message,
    } as any)
    return null
  }

  return data ? rowToManifest(data) : null
}

// ---------------------------------------------------------------------------
// verifyManifestChain
// ---------------------------------------------------------------------------

export async function verifyManifestChain(
  tenantId: string,
  limit = 100,
): Promise<{ valid: boolean; broken_at: number | null; chain_length: number }> {
  const db = supabaseAdmin as any
  const cap = Math.min(limit, 1000)

  const { data, error } = await db
    .from('recovery_manifests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('version', { ascending: true })
    .limit(cap) as {
      data: Array<Record<string, unknown>> | null
      error: { message: string } | null
    }

  if (error) {
    log.warn('[recoveryManifest] verifyManifestChain — query failed', {
      tenant_id: tenantId,
      error: error.message,
    } as any)
    return { valid: false, broken_at: null, chain_length: 0 }
  }

  const manifests = (data ?? []).map(rowToManifest)
  let chainLength = 0

  for (const manifest of manifests) {
    // Recompute hash from manifest data with manifest_hash blanked
    const withoutHash: Omit<RecoveryManifest, 'manifest_hash'> = {
      manifest_id: manifest.manifest_id,
      tenant_id: manifest.tenant_id,
      version: manifest.version,
      previous_manifest_hash: manifest.previous_manifest_hash,
      db_snapshot_checksum: manifest.db_snapshot_checksum,
      db_row_counts: manifest.db_row_counts,
      kafka_replay_watermark: manifest.kafka_replay_watermark,
      event_count_total: manifest.event_count_total,
      ml_artifact_hashes: manifest.ml_artifact_hashes,
      last_training_run_id: manifest.last_training_run_id,
      audit_chain_last_hash: manifest.audit_chain_last_hash,
      audit_sequence_number: manifest.audit_sequence_number,
      created_at: manifest.created_at,
      recovery_tested: manifest.recovery_tested,
      recovery_tested_at: manifest.recovery_tested_at,
    }

    const expectedHash = computeManifestHash(withoutHash)
    if (expectedHash !== manifest.manifest_hash) {
      log.warn('[recoveryManifest] verifyManifestChain — broken at version', {
        tenant_id: tenantId,
        version: manifest.version,
        expected: expectedHash,
        stored: manifest.manifest_hash,
      } as any)
      return { valid: false, broken_at: manifest.version, chain_length: chainLength }
    }
    chainLength++
  }

  return { valid: true, broken_at: null, chain_length: chainLength }
}

// ---------------------------------------------------------------------------
// markManifestRecoveryTested
// ---------------------------------------------------------------------------

export async function markManifestRecoveryTested(manifestId: string): Promise<void> {
  const db = supabaseAdmin as any

  void (db as any)
    .from('recovery_manifests')
    .update({
      recovery_tested: true,
      recovery_tested_at: new Date().toISOString(),
    })
    .eq('id', manifestId)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[recoveryManifest] markManifestRecoveryTested — update failed', {
          manifest_id: manifestId,
          error: error.message,
        } as any)
      }
    })

  log.info('[recoveryManifest] markManifestRecoveryTested', {
    manifest_id: manifestId,
  } as any)
}
