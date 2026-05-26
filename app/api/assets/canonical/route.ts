// =============================================================================
// Agency Group — Canonical Assets API v1.0
// Wave 42 | app/api/assets/canonical/route.ts
// TypeScript strict — 0 errors
//
// GET: search canonical assets or fetch single asset with lineage
// POST: record views/bids, run dedup operations, normalize batches
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  getCanonicalAsset,
  searchCanonicalAssets,
} from '@/lib/normalization/assetNormalizationEngine'
import {
  getAssetLineage,
  recordAssetView,
  recordAssetBid,
  mergeAssets,
  getAssetRelationships,
} from '@/lib/normalization/canonicalAssetGraph'
import {
  runDeduplicationSweep,
} from '@/lib/normalization/deduplicationEngine'
import { normalizeRawBatch } from '@/lib/normalization/assetNormalizationEngine'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Admin Bearer check ───────────────────────────────────────────────────────

function isAdminBearer(req: Request): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret || !authHeader.startsWith('Bearer ')) return false
  return authHeader.slice(7) === secret
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  try {
    const url = new URL(req.url)
    const assetId = url.searchParams.get('asset_id')
    const mode = url.searchParams.get('mode')
    const tenantId = authResult.tenant_id

    // ── Mode: single asset with lineage and relationships ─────────────────
    if (assetId) {
      const [asset, lineage, relationships] = await Promise.all([
        getCanonicalAsset(assetId, tenantId),
        getAssetLineage(assetId, tenantId),
        getAssetRelationships(assetId, tenantId),
      ])

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
      }

      return NextResponse.json({ asset, lineage, relationships })
    }

    // ── Mode: dedup candidates needing review ─────────────────────────────
    if (mode === 'dedup-candidates') {
      const { data, error } = await (supabaseAdmin as any)
        .from('deduplication_candidates')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['PENDING', 'NEEDS_REVIEW'])
        .order('similarity_score', { ascending: false })
        .limit(50)

      if (error) {
        log.warn('[canonical/route] dedup-candidates error', { error })
        return NextResponse.json({ error: 'Failed to fetch dedup candidates' }, { status: 500 })
      }

      return NextResponse.json({ candidates: data ?? [], count: (data ?? []).length })
    }

    // ── Mode: search ──────────────────────────────────────────────────────
    const market = url.searchParams.get('market') ?? undefined
    const city = url.searchParams.get('city') ?? undefined
    const property_type = url.searchParams.get('property_type') ?? undefined
    const min_price = url.searchParams.get('min_price') ? Number(url.searchParams.get('min_price')) : undefined
    const max_price = url.searchParams.get('max_price') ? Number(url.searchParams.get('max_price')) : undefined
    const min_opportunity_score = url.searchParams.get('min_opportunity_score')
      ? Number(url.searchParams.get('min_opportunity_score'))
      : undefined
    const is_distressed_param = url.searchParams.get('is_distressed')
    const is_distressed =
      is_distressed_param === 'true' ? true :
      is_distressed_param === 'false' ? false :
      undefined
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50

    const assets = await searchCanonicalAssets(tenantId, {
      market,
      city,
      property_type,
      min_price,
      max_price,
      min_opportunity_score,
      is_distressed,
      limit,
    })

    return NextResponse.json({ assets, count: assets.length })
  } catch (err) {
    log.warn('[canonical/route] GET error', { err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body['action']

  // ── Admin-only actions ────────────────────────────────────────────────────
  if (action === 'run-dedup' || action === 'merge-assets' || action === 'normalize-batch') {
    if (!isAdminBearer(req)) {
      return NextResponse.json({ error: 'Unauthorized — admin Bearer required' }, { status: 401 })
    }

    const tenantId = String(body['tenant_id'] ?? process.env.DEFAULT_TENANT_ID ?? 'agency-group')

    if (action === 'run-dedup') {
      try {
        const limit = body['limit'] ? Number(body['limit']) : 200
        const result = await runDeduplicationSweep(tenantId, limit)
        return NextResponse.json({ ok: true, ...result })
      } catch (err) {
        log.warn('[canonical/route] run-dedup error', { err })
        return NextResponse.json({ error: 'Dedup sweep failed' }, { status: 500 })
      }
    }

    if (action === 'merge-assets') {
      const primaryId = body['primary_id']
      const duplicateId = body['duplicate_id']
      if (typeof primaryId !== 'string' || typeof duplicateId !== 'string') {
        return NextResponse.json({ error: 'primary_id and duplicate_id are required' }, { status: 400 })
      }
      try {
        await mergeAssets(primaryId, duplicateId, tenantId)
        return NextResponse.json({ ok: true, primary_id: primaryId, duplicate_id: duplicateId })
      } catch (err) {
        log.warn('[canonical/route] merge-assets error', { err })
        return NextResponse.json({ error: 'Merge failed' }, { status: 500 })
      }
    }

    if (action === 'normalize-batch') {
      try {
        const limit = body['limit'] ? Number(body['limit']) : 100
        const result = await normalizeRawBatch(tenantId, limit)
        return NextResponse.json({ ok: true, ...result })
      } catch (err) {
        log.warn('[canonical/route] normalize-batch error', { err })
        return NextResponse.json({ error: 'Batch normalization failed' }, { status: 500 })
      }
    }
  }

  // ── Authenticated user actions ────────────────────────────────────────────
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult
  const tenantId = authResult.tenant_id

  if (action === 'record-view') {
    const assetId = body['asset_id']
    if (typeof assetId !== 'string') {
      return NextResponse.json({ error: 'asset_id is required' }, { status: 400 })
    }
    const investorId = body['investor_id'] ? String(body['investor_id']) : undefined
    try {
      await recordAssetView(assetId, tenantId, investorId)
      return NextResponse.json({ ok: true })
    } catch (err) {
      log.warn('[canonical/route] record-view error', { err })
      return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
    }
  }

  if (action === 'record-bid') {
    const assetId = body['asset_id']
    const investorId = body['investor_id']
    const amountEurCents = body['amount_eur_cents']
    if (typeof assetId !== 'string' || typeof investorId !== 'string') {
      return NextResponse.json({ error: 'asset_id and investor_id are required' }, { status: 400 })
    }
    if (typeof amountEurCents !== 'number' || amountEurCents <= 0) {
      return NextResponse.json({ error: 'amount_eur_cents must be a positive integer' }, { status: 400 })
    }
    try {
      await recordAssetBid(assetId, tenantId, investorId, Math.round(amountEurCents))
      return NextResponse.json({ ok: true })
    } catch (err) {
      log.warn('[canonical/route] record-bid error', { err })
      return NextResponse.json({ error: 'Failed to record bid' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 })
}
