// =============================================================================
// Agency Group — Vault Hash Engine
// lib/vault/hashEngine.ts
//
// SHA-256 file hashing, change detection, and drift detection for SH-ROS Vault.
// Used by integrityChecker.ts to detect unauthorized modifications.
//
// DESIGN:
//   - Uses Node.js crypto (server-side only, never imported in edge runtime)
//   - All functions return typed results, never throw (fail-open)
//   - Hash stored in Supabase vault_file_hashes table (fire-and-forget)
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

export interface FileHash {
  path: string
  hash: string          // SHA-256 hex
  size: number          // bytes
  computed_at: string   // ISO-8601
}

export interface DriftResult {
  path: string
  status: 'ok' | 'modified' | 'missing' | 'new'
  previousHash: string | null
  currentHash: string | null
  detectedAt: string
}

// Hash a single file — returns null if file doesn't exist or read fails
export function hashFile(filePath: string): FileHash | null {
  try {
    if (!existsSync(filePath)) return null
    const content = readFileSync(filePath)
    const hash = createHash('sha256').update(content).digest('hex')
    return { path: filePath, hash, size: content.length, computed_at: new Date().toISOString() }
  } catch { return null }
}

// Hash text content (for in-memory strings — prompts, configs, etc.)
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

// Compare two hashes
export function hashesMatch(a: string, b: string): boolean {
  // Constant-time comparison to prevent timing attacks
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Detect drift: compare current file hash against stored hash
export function detectDrift(filePath: string, storedHash: string | null): DriftResult {
  const current = hashFile(filePath)
  const now = new Date().toISOString()

  if (!current) {
    return {
      path: filePath,
      status: 'missing',
      previousHash: storedHash,
      currentHash: null,
      detectedAt: now,
    }
  }

  if (!storedHash) {
    return { path: filePath, status: 'new', previousHash: null, currentHash: current.hash, detectedAt: now }
  }

  const changed = !hashesMatch(current.hash, storedHash)
  return {
    path: filePath,
    status: changed ? 'modified' : 'ok',
    previousHash: storedHash,
    currentHash: current.hash,
    detectedAt: now,
  }
}

// Persist hash record to Supabase (fire-and-forget)
export function persistHash(record: FileHash & { tenant_id?: string }): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  const db = createClient(url, key)
  void db.from('vault_file_hashes').upsert({
    path: record.path,
    hash: record.hash,
    size: record.size,
    tenant_id: record.tenant_id ?? 'agency-group',
    computed_at: record.computed_at,
  }, { onConflict: 'path,tenant_id' }).then(({ error }) => {
    if (error) console.warn('[VaultHash] persist error:', error.message)
  })
}
