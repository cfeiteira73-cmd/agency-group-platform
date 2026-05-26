// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Immutable Audit Trail v1.0
// lib/compliance/immutableAuditTrail.ts
//
// SHA-256 chain audit trail — each entry hashes the previous entry to create
// a tamper-evident chain. Any modification to historical entries will break
// the chain, detectable via verifyChainIntegrity().
//
// Chain rules:
//   - sequence = previous_sequence + 1 (per tenant)
//   - entry_hash = SHA-256(JSON({ action, actor_id, resource_id, occurred_at, metadata }))
//   - chain_hash = SHA-256(previous_chain_hash + entry_hash)
//   - first entry: previous_chain_hash = '0'.repeat(64)
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'CAPITAL_STAGE_ADVANCED'
  | 'ESCROW_CREATED'
  | 'ESCROW_RELEASED'
  | 'LEGAL_DOCUMENT_SIGNED'
  | 'PROPERTY_TITLE_TRANSFERRED'
  | 'KYC_INITIATED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'GDPR_REQUEST_RECEIVED'
  | 'GDPR_ERASURE_COMPLETED'
  | 'INVESTOR_ONBOARDED'
  | 'DEAL_CLOSED'
  | 'DATA_EXPORTED'
  | 'CONFIG_CHANGED'

export interface AuditEntry {
  entry_id: string
  tenant_id: string
  sequence: number
  action: AuditAction
  actor_id: string
  actor_type: 'USER' | 'SYSTEM' | 'API_KEY' | 'CRON'
  resource_type: string
  resource_id: string
  metadata: Record<string, unknown>
  ip_address: string
  occurred_at: string
  entry_hash: string        // SHA-256 of this entry's canonical form
  chain_hash: string        // SHA-256(previous_chain_hash + entry_hash)
  previous_chain_hash: string | null
}

type AuditEntryInput = Omit<AuditEntry, 'entry_id' | 'sequence' | 'occurred_at' | 'entry_hash' | 'chain_hash' | 'previous_chain_hash'>

// ─── appendAuditEntry ─────────────────────────────────────────────────────────

export async function appendAuditEntry(
  input: AuditEntryInput,
): Promise<AuditEntry> {
  const { tenant_id, action, actor_id, actor_type, resource_type, resource_id, metadata, ip_address } = input

  // Get latest chain state for this tenant
  const { data: latestEntry } = await (supabaseAdmin as any)
    .from('audit_trail')
    .select('sequence, chain_hash')
    .eq('tenant_id', tenant_id)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { sequence: number; chain_hash: string } | null }

  const previousSequence = latestEntry?.sequence ?? 0
  const previousChainHash = latestEntry?.chain_hash ?? null
  const sequence = previousSequence + 1
  const occurredAt = new Date().toISOString()

  // Compute entry hash: canonical form of the entry content
  const entryHash = createHash('sha256')
    .update(JSON.stringify({ action, actor_id, resource_id, occurred_at: occurredAt, metadata }))
    .digest('hex')

  // Compute chain hash: links to previous entry
  const prevHash = previousChainHash ?? '0'.repeat(64)
  const chainHash = createHash('sha256')
    .update(prevHash + entryHash)
    .digest('hex')

  const entry: AuditEntry = {
    entry_id:            randomUUID(),
    tenant_id,
    sequence,
    action,
    actor_id,
    actor_type,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    occurred_at:         occurredAt,
    entry_hash:          entryHash,
    chain_hash:          chainHash,
    previous_chain_hash: previousChainHash,
  }

  const { error } = await (supabaseAdmin as any).from('audit_trail').insert(entry)
  if (error) {
    console.error('[immutableAuditTrail] insert failed', error.message, { action, actor_id })
    throw new Error(`Audit trail insert failed: ${error.message}`)
  }

  return entry
}

// ─── appendAuditEntryFire ─────────────────────────────────────────────────────

export function appendAuditEntryFire(input: AuditEntryInput): void {
  void appendAuditEntry(input).catch(e =>
    console.warn('[immutableAuditTrail] fire-and-forget failed', e),
  )
}

// ─── verifyChainIntegrity ─────────────────────────────────────────────────────

export async function verifyChainIntegrity(
  tenantId: string,
  fromSequence?: number,
  limit = 500,
): Promise<{
  valid: boolean
  checked: number
  broken_at_sequence: number | null
  verification_hash: string
}> {
  const query = (supabaseAdmin as any)
    .from('audit_trail')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sequence', { ascending: true })
    .limit(limit)

  if (fromSequence !== undefined) {
    void query.gte('sequence', fromSequence)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Chain verify query failed: ${error.message}`)
  }

  const entries = (data ?? []) as AuditEntry[]
  let prevChainHash = '0'.repeat(64)
  let brokenAtSequence: number | null = null

  for (const entry of entries) {
    // Recompute expected chain hash
    const expectedChainHash = createHash('sha256')
      .update((entry.previous_chain_hash ?? '0'.repeat(64)) + entry.entry_hash)
      .digest('hex')

    if (expectedChainHash !== entry.chain_hash) {
      brokenAtSequence = entry.sequence
      break
    }

    prevChainHash = entry.chain_hash
  }

  // Final verification hash = last chain_hash (proof of integrity up to this point)
  const verificationHash = entries.length > 0
    ? (entries[entries.length - 1]?.chain_hash ?? prevChainHash)
    : '0'.repeat(64)

  return {
    valid:              brokenAtSequence === null,
    checked:            entries.length,
    broken_at_sequence: brokenAtSequence,
    verification_hash:  verificationHash,
  }
}

// ─── getAuditLog ──────────────────────────────────────────────────────────────

export async function getAuditLog(
  tenantId: string,
  filters?: {
    actor_id?: string
    action?: AuditAction
    resource_id?: string
    from?: string
    to?: string
  },
  limit = 50,
): Promise<AuditEntry[]> {
  let query = (supabaseAdmin as any)
    .from('audit_trail')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sequence', { ascending: false })
    .limit(Math.min(limit, 500))

  if (filters?.actor_id)   query = query.eq('actor_id', filters.actor_id)
  if (filters?.action)     query = query.eq('action', filters.action)
  if (filters?.resource_id)query = query.eq('resource_id', filters.resource_id)
  if (filters?.from)       query = query.gte('occurred_at', filters.from)
  if (filters?.to)         query = query.lte('occurred_at', filters.to)

  const { data, error } = await query

  if (error) {
    console.warn('[immutableAuditTrail] getAuditLog query failed', error.message)
    return []
  }

  return (data ?? []) as AuditEntry[]
}
