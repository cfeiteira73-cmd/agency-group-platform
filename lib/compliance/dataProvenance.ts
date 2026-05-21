// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Data Provenance Chain v1.0
// lib/compliance/dataProvenance.ts
//
// Full data provenance chain from external source to settlement.
// Each record is SHA-256 hash-chained to the previous record for the same
// asset, enabling tamper detection and regulatory audit trail.
//
// Stage flow:
//   external_source → ingested → canonical_asset → priced → matched →
//   bid_received → capital_committed → legally_executed →
//   notarially_closed → settled
//
// TypeScript strict — 0 errors
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ProvenanceStage =
  | 'external_source'    // Casafari/Idealista/broker
  | 'ingested'           // normalized + deduped
  | 'canonical_asset'    // added to canonical ledger
  | 'priced'             // AVM/price discovery applied
  | 'matched'            // matched to investors
  | 'bid_received'       // investor bid placed
  | 'capital_committed'  // capital execution initiated
  | 'legally_executed'   // signed docs
  | 'notarially_closed'  // escritura
  | 'settled'            // bank confirmed + registry updated

export interface ProvenanceRecord {
  id: string
  tenant_id: string
  asset_id: string                       // canonical_assets.id or property.id
  external_id: string | null
  source: string
  stage: ProvenanceStage
  stage_data: Record<string, unknown>    // relevant data at this stage
  actor: string                          // 'casafari_ingest' | 'user:{id}' | 'system'
  hash: string                           // SHA-256(asset_id + stage + stage_data + prev_hash)
  previous_record_id: string | null
  recorded_at: string
}

// ─── Hash computation ─────────────────────────────────────────────────────────

function computeProvenanceHash(
  assetId: string,
  stage: ProvenanceStage,
  stageData: Record<string, unknown>,
  previousHash: string | null,
): string {
  return createHash('sha256')
    .update(JSON.stringify({
      asset_id:    assetId,
      stage,
      stage_data:  stageData,
      previous:    previousHash,
    }))
    .digest('hex')
}

// ─── DB row → ProvenanceRecord ────────────────────────────────────────────────

function toRecord(row: Record<string, unknown>): ProvenanceRecord {
  return {
    id:                 String(row['id'] ?? ''),
    tenant_id:          String(row['tenant_id'] ?? ''),
    asset_id:           String(row['asset_id'] ?? ''),
    external_id:        row['external_id'] != null ? String(row['external_id']) : null,
    source:             String(row['source'] ?? 'unknown'),
    stage:              (row['stage'] as ProvenanceStage),
    stage_data:         (row['stage_data'] as Record<string, unknown>) ?? {},
    actor:              String(row['actor'] ?? 'system'),
    hash:               String(row['hash'] ?? ''),
    previous_record_id: row['previous_record_id'] != null ? String(row['previous_record_id']) : null,
    recorded_at:        String(row['recorded_at'] ?? new Date().toISOString()),
  }
}

// ─── recordProvenance ─────────────────────────────────────────────────────────

/**
 * Records a provenance stage transition for an asset.
 * Automatically chains to the previous record for the same asset.
 * Returns the created ProvenanceRecord.
 */
export async function recordProvenance(
  tenantId: string,
  assetId: string,
  stage: ProvenanceStage,
  stageData: Record<string, unknown>,
  actor: string,
  externalId?: string,
  source: string = 'system',
): Promise<ProvenanceRecord> {
  // Fetch the most recent record for this asset to get the chain hash
  const { data: prevRows, error: prevError } = await (supabaseAdmin as any)
    .from('data_provenance_records')
    .select('id, hash')
    .eq('tenant_id', tenantId)
    .eq('asset_id', assetId)
    .order('recorded_at', { ascending: false })
    .limit(1) as {
      data: Array<{ id: string; hash: string }> | null
      error: { message: string } | null
    }

  if (prevError) {
    log.warn('[dataProvenance] failed to fetch previous record', {
      tenant_id: tenantId,
      asset_id:  assetId,
      error:     prevError.message,
    })
  }

  const prevRecord = prevRows?.[0] ?? null
  const prevHash   = prevRecord?.hash ?? null
  const prevId     = prevRecord?.id ?? null

  const hash = computeProvenanceHash(assetId, stage, stageData, prevHash)
  const id   = randomUUID()
  const now  = new Date().toISOString()

  const row = {
    id,
    tenant_id:          tenantId,
    asset_id:           assetId,
    external_id:        externalId ?? null,
    source,
    stage,
    stage_data:         stageData,
    actor,
    hash,
    previous_record_id: prevId,
    recorded_at:        now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('data_provenance_records')
    .insert(row)
    .select('*')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error || !data) {
    const msg = error?.message ?? 'insert returned no data'
    log.warn('[dataProvenance] recordProvenance failed', {
      tenant_id: tenantId,
      asset_id:  assetId,
      stage,
      error:     msg,
    })
    throw new Error(`[dataProvenance] recordProvenance: ${msg}`)
  }

  return toRecord(data)
}

// ─── getProvenanceChain ───────────────────────────────────────────────────────

/**
 * Returns the full provenance chain for an asset, sorted by recorded_at ASC.
 */
export async function getProvenanceChain(
  tenantId: string,
  assetId: string,
): Promise<ProvenanceRecord[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('data_provenance_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('asset_id', assetId)
      .order('recorded_at', { ascending: true }) as {
        data: Array<Record<string, unknown>> | null
        error: { message: string } | null
      }

    if (error) {
      log.warn('[dataProvenance] getProvenanceChain failed', {
        tenant_id: tenantId,
        asset_id:  assetId,
        error:     error.message,
      })
      return []
    }

    return (data ?? []).map(toRecord)
  } catch (err) {
    log.warn('[dataProvenance] getProvenanceChain error', {
      tenant_id: tenantId,
      asset_id:  assetId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── verifyProvenanceChain ────────────────────────────────────────────────────

/**
 * Verifies the hash chain integrity for an asset's provenance records.
 * Reads records in order and recomputes each hash, checking against stored hash.
 *
 * Returns:
 *   - valid: true if all hashes match
 *   - chain_length: number of records in the chain
 *   - first_broken_link: id of the first record with a hash mismatch, or null
 */
export async function verifyProvenanceChain(
  tenantId: string,
  assetId: string,
): Promise<{
  valid: boolean
  chain_length: number
  first_broken_link: string | null
}> {
  try {
    const chain = await getProvenanceChain(tenantId, assetId)

    if (chain.length === 0) {
      return { valid: true, chain_length: 0, first_broken_link: null }
    }

    let previousHash: string | null = null

    for (const record of chain) {
      const expected = computeProvenanceHash(
        record.asset_id,
        record.stage,
        record.stage_data,
        previousHash,
      )

      if (expected !== record.hash) {
        log.warn('[dataProvenance] chain integrity broken', {
          tenant_id: tenantId,
          asset_id:  assetId,
          record_id: record.id,
          stage:     record.stage,
          expected,
          stored:    record.hash,
        })
        return {
          valid:              false,
          chain_length:       chain.length,
          first_broken_link:  record.id,
        }
      }

      previousHash = record.hash
    }

    return { valid: true, chain_length: chain.length, first_broken_link: null }
  } catch (err) {
    log.warn('[dataProvenance] verifyProvenanceChain error', {
      tenant_id: tenantId,
      asset_id:  assetId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return { valid: false, chain_length: 0, first_broken_link: null }
  }
}
