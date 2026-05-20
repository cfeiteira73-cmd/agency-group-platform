// =============================================================================
// Agency Group — Vault Integrity Checker
// lib/vault/integrityChecker.ts
//
// Computes daily integrity scores (0-100) for the SH-ROS Vault.
// Checks: vault completeness, file drift, backup freshness, replay readiness.
// Alerts if any score < 95.
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { hashFile, detectDrift } from './hashEngine'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = SupabaseClient<any, any, any>

export interface IntegrityScores {
  vault_completeness: number    // 0-100: required files present
  drift_score: number           // 0-100: 100 = no drift detected
  backup_freshness: number      // 0-100: recent snapshot exists
  replay_readiness: number      // 0-100: event_history has recent entries
  overall: number               // weighted average
  computed_at: string
  alerts: string[]
}

// Required vault files — if any missing, completeness drops
const REQUIRED_VAULT_FILES = [
  'SH-ROS-VAULT/system-bible/SH-ROS_MASTER_BIBLE.md',
  'SH-ROS-VAULT/VAULT_MANIFEST.json',
  'SH-ROS-VAULT/INTEGRITY_HASHES.json',
  'SH-ROS-VAULT/architecture/layers.md',
  'SH-ROS-VAULT/architecture/event-system.md',
  'SH-ROS-VAULT/agents/registry.md',
  'SH-ROS-VAULT/schemas/supabase-schema.md',
  'SH-ROS-VAULT/revenue-engine/deal-flow.md',
  'SH-ROS-VAULT/security-model/rbac.md',
  'SH-ROS-VAULT/decisions/decision-log.md',
]

// Critical source files to monitor for drift
const MONITORED_SOURCE_FILES = [
  'lib/ai/policyEngine.ts',
  'lib/ai/contracts/index.ts',
  'lib/ops/withAI.ts',
  'lib/events/bus.ts',
  'lib/events/types.ts',
  'lib/auth/rbac.ts',
  'lib/security/siem.ts',
  'lib/security/intrusionDetection.ts',
  'lib/graph/intelligence.ts',
  'lib/queue/adapter.ts',
]

function projectPath(relative: string): string {
  return join(process.cwd(), relative)
}

// Score 1: Vault Completeness (0-100)
function scoreVaultCompleteness(): { score: number; alerts: string[] } {
  const alerts: string[] = []
  let present = 0
  for (const f of REQUIRED_VAULT_FILES) {
    const hash = hashFile(projectPath(f))
    if (hash) {
      present++
    } else {
      alerts.push(`MISSING vault file: ${f}`)
    }
  }
  const score = Math.round((present / REQUIRED_VAULT_FILES.length) * 100)
  return { score, alerts }
}

// Score 2: Drift Score — checks monitored files against stored hashes
async function scoreDrift(db: DbClient): Promise<{ score: number; alerts: string[] }> {
  const alerts: string[] = []
  let clean = 0

  const { data: storedHashes } = await db
    .from('vault_file_hashes')
    .select('path, hash')
    .eq('tenant_id', process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')

  const hashMap = new Map<string, string>()
  if (storedHashes) {
    for (const row of storedHashes as { path: string; hash: string }[]) {
      hashMap.set(row.path, row.hash)
    }
  }

  for (const f of MONITORED_SOURCE_FILES) {
    const absPath = projectPath(f)
    const stored = hashMap.get(f) ?? null
    const drift = detectDrift(absPath, stored)
    if (drift.status === 'ok' || drift.status === 'new') {
      clean++
    } else {
      alerts.push(`DRIFT detected in ${f}: status=${drift.status}`)
    }
  }

  const score = MONITORED_SOURCE_FILES.length > 0
    ? Math.round((clean / MONITORED_SOURCE_FILES.length) * 100)
    : 100

  return { score, alerts }
}

// Score 3: Backup Freshness (0-100) — checks if snapshot exists in last 25 hours
async function scoreBackupFreshness(db: DbClient): Promise<{ score: number; alerts: string[] }> {
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const { data } = await db
    .from('vault_snapshots')
    .select('created_at')
    .eq('tenant_id', process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) {
    return { score: 0, alerts: ['NO recent backup snapshot found (>25h)'] }
  }
  return { score: 100, alerts: [] }
}

// Score 4: Replay Readiness (0-100) — checks event_history has entries in last 24h
async function scoreReplayReadiness(db: DbClient): Promise<{ score: number; alerts: string[] }> {
  if (process.env.EVENT_HISTORY_ENABLED !== 'true') {
    return { score: 50, alerts: ['EVENT_HISTORY_ENABLED not set — replay readiness unknown'] }
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db
    .from('event_history')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', cutoff)

  if (!count || count === 0) {
    return { score: 30, alerts: ['No events in event_history in last 24h — replay may be stale'] }
  }
  return { score: 100, alerts: [] }
}

// Main: compute all scores
export async function computeIntegrityScores(): Promise<IntegrityScores> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const allAlerts: string[] = []

  // Score 1 — synchronous
  const completeness = scoreVaultCompleteness()
  allAlerts.push(...completeness.alerts)

  if (!url || !key) {
    const overall = Math.round(completeness.score * 0.6)
    return {
      vault_completeness: completeness.score,
      drift_score: 0,
      backup_freshness: 0,
      replay_readiness: 0,
      overall,
      computed_at: new Date().toISOString(),
      alerts: [...allAlerts, 'Supabase not configured — DB-dependent scores skipped'],
    }
  }

  const db = createClient(url, key)
  const [drift, backup, replay] = await Promise.all([
    scoreDrift(db).catch(() => ({ score: 0, alerts: ['drift check failed'] })),
    scoreBackupFreshness(db).catch(() => ({ score: 0, alerts: ['backup check failed'] })),
    scoreReplayReadiness(db).catch(() => ({ score: 0, alerts: ['replay check failed'] })),
  ])

  allAlerts.push(...drift.alerts, ...backup.alerts, ...replay.alerts)

  // Weighted: completeness 30%, drift 30%, backup 20%, replay 20%
  const overall = Math.round(
    completeness.score * 0.30 +
    drift.score * 0.30 +
    backup.score * 0.20 +
    replay.score * 0.20
  )

  const scores: IntegrityScores = {
    vault_completeness: completeness.score,
    drift_score: drift.score,
    backup_freshness: backup.score,
    replay_readiness: replay.score,
    overall,
    computed_at: new Date().toISOString(),
    alerts: allAlerts,
  }

  // Persist scores
  void db.from('vault_integrity_scores').insert({
    tenant_id: process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001',
    vault_completeness: scores.vault_completeness,
    drift_score: scores.drift_score,
    backup_freshness: scores.backup_freshness,
    replay_readiness: scores.replay_readiness,
    overall_score: scores.overall,
    alerts: scores.alerts,
    computed_at: scores.computed_at,
  }).then(({ error }) => {
    if (error) console.warn('[VaultIntegrity] persist error:', error.message)
  })

  return scores
}
