// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Canonical Asset Ingestion Cron (Wave 32)
// POST /api/cron/asset-ingestion
//
// Hourly cron that runs the full canonical asset ingestion pipeline:
//   1. Fetch from Casafari + Idealista (parallel)
//   2. Normalize both batches
//   3. Merge → probabilistic dedup
//   4. Fraud detection → filter suspicious
//   5. Decay model
//   6. Upsert to canonical_assets
//   7. Log run to asset_ingestion_log
//
// Auth: CRON_SECRET via x-cron-secret or Authorization: Bearer header
// Returns: { ingested, deduplicated, flagged, errors, duration_ms }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import log                           from '@/lib/logger'
import { fetchCasafariListings }     from '@/lib/ingestion/casafariClient'
import { fetchIdealistaListings }    from '@/lib/ingestion/idealistaClient'
import { normalizeCasafari, normalizeIdealista } from '@/lib/ingestion/normalizationPipeline'
import type { CanonicalPropertyInput }           from '@/lib/ingestion/normalizationPipeline'
import { deduplicateBatch }          from '@/lib/ingestion/probabilisticDedup'
import { filterSuspicious }          from '@/lib/ingestion/fraudDetection'
import type { FraudCheckResult }     from '@/lib/ingestion/fraudDetection'
import { computeDecay }              from '@/lib/ingestion/decayModel'
import type { AssetDecayResult }     from '@/lib/ingestion/decayModel'
import { upsertCanonicalAsset }      from '@/lib/assets/canonicalAssetLedger'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  return !!token && safeCompare(token, secret)
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

function defaultTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start    = Date.now()
  const tenantId = defaultTenantId()
  const errors: string[] = []

  // ── 1. Fetch from both sources in parallel ────────────────────────────────
  const [casafariRaw, idealistaRaw] = await Promise.all([
    fetchCasafariListings({ limit: 100 }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`casafari_fetch: ${msg}`)
      log.warn('[asset-ingestion] casafari fetch failed', { error: msg })
      return []
    }),
    fetchIdealistaListings({ limit: 50 }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`idealista_fetch: ${msg}`)
      log.warn('[asset-ingestion] idealista fetch failed', { error: msg })
      return []
    }),
  ])

  const fetchedCount = casafariRaw.length + idealistaRaw.length
  log.info('[asset-ingestion] fetched listings', {
    casafari: casafariRaw.length,
    idealista: idealistaRaw.length,
  })

  // ── 2. Normalize ──────────────────────────────────────────────────────────
  const normalized: CanonicalPropertyInput[] = [
    ...casafariRaw.map(normalizeCasafari),
    ...idealistaRaw.map(normalizeIdealista),
  ]

  // ── 3. Dedup ──────────────────────────────────────────────────────────────
  const { unique, duplicates } = deduplicateBatch(normalized)
  const deduplicatedCount = duplicates.length
  log.info('[asset-ingestion] dedup complete', {
    unique: unique.length,
    duplicates: deduplicatedCount,
  })

  // ── 4. Fraud detection ────────────────────────────────────────────────────
  const { clean, flagged } = filterSuspicious(unique)
  log.info('[asset-ingestion] fraud check', {
    clean: clean.length,
    flagged: flagged.length,
  })

  // ── 5 + 6. Decay + Upsert ────────────────────────────────────────────────
  let upsertedCount = 0
  const now = new Date()

  for (const item of clean) {
    const decay = computeDecay(item, now)
    // detectFraud already ran in step 4 — items in `clean` have no signals
    const fraud: FraudCheckResult = {
      is_suspicious: false,
      signals: [],
      confidence: 0,
    }
    try {
      await upsertCanonicalAsset(tenantId, { ...item, decay, fraud })
      upsertedCount++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`upsert:${item.external_id}:${msg}`)
      log.warn('[asset-ingestion] upsert error', { external_id: item.external_id, error: msg })
    }
  }

  // Also upsert flagged items — mark them is_suspicious in the ledger
  for (const { item, result } of flagged) {
    const decay: AssetDecayResult = computeDecay(item, now)
    try {
      await upsertCanonicalAsset(tenantId, { ...item, decay, fraud: result })
      upsertedCount++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`upsert_flagged:${item.external_id}:${msg}`)
    }
  }

  const durationMs = Date.now() - start

  // ── 7. Audit log ──────────────────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('asset_ingestion_log')
    .insert({
      tenant_id:          tenantId,
      source:             'asset-ingestion-cron',
      fetched_count:      fetchedCount,
      normalized_count:   normalized.length,
      deduplicated_count: deduplicatedCount,
      flagged_count:      flagged.length,
      upserted_count:     upsertedCount,
      duration_ms:        durationMs,
      errors,
    })
    .catch((e: Error) => log.warn('[asset-ingestion] audit log insert failed', { error: e.message }))

  log.info('[asset-ingestion] run complete', {
    fetched:      fetchedCount,
    deduplicated: deduplicatedCount,
    flagged:      flagged.length,
    upserted:     upsertedCount,
    duration_ms:  durationMs,
    errors:       errors.length,
  })

  return NextResponse.json({
    ingested:     fetchedCount,
    deduplicated: deduplicatedCount,
    flagged:      flagged.length,
    upserted:     upsertedCount,
    errors,
    duration_ms:  durationMs,
  })
}
