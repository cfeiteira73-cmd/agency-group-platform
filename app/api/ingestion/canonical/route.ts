// =============================================================================
// Agency Group — Canonical Property API
// app/api/ingestion/canonical/route.ts
//
// POST /api/ingestion/canonical
//   Body: { source, source_id, data }
//   Runs: resolveOrCreateCanonical → enrichment → fraud assessment
//   Returns: { canonical_id, was_merged, freshness_score, fraud_risk_score }
//   Auth: requireServiceAuth
//
// GET /api/ingestion/canonical?canonical_id=<uuid>
//   Returns full canonical property with enrichment data
//   Auth: requireServiceAuth
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import { resolveOrCreateCanonical }  from '@/lib/ingestion/canonicalProperty'
import { enrichProperty }            from '@/lib/ingestion/enrichmentPipeline'
import { assessFraudRisk }           from '@/lib/ingestion/fraudDetector'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── Allowed sources ─────────────────────────────────────────────────────────

const VALID_SOURCES = ['casafari', 'idealista', 'manual', 'broker'] as const
type Source = typeof VALID_SOURCES[number]

function isValidSource(v: unknown): v is Source {
  return typeof v === 'string' && (VALID_SOURCES as readonly string[]).includes(v)
}

// ─── POST /api/ingestion/canonical ────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { source?: unknown; source_id?: unknown; data?: unknown; tenant_id?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Validate ─────────────────────────────────────────────────────────────────
  if (!isValidSource(body.source)) {
    return NextResponse.json(
      { error: 'Invalid source', valid_sources: VALID_SOURCES, received: body.source },
      { status: 400 },
    )
  }

  if (typeof body.source_id !== 'string' || body.source_id.trim() === '') {
    return NextResponse.json({ error: 'source_id is required (string)' }, { status: 400 })
  }

  if (typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
    return NextResponse.json({ error: 'data must be a non-null object' }, { status: 400 })
  }

  const source:   Source                   = body.source
  const sourceId: string                   = body.source_id.trim()
  const rawData:  Record<string, unknown>  = body.data as Record<string, unknown>
  const tenantId: string =
    typeof body.tenant_id === 'string' && body.tenant_id.trim() !== ''
      ? body.tenant_id.trim()
      : process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

  // ── Resolve or create canonical ───────────────────────────────────────────────
  let resolveResult: { canonical_id: string; was_merged: boolean; confidence: number }
  try {
    resolveResult = await resolveOrCreateCanonical(tenantId, sourceId, source, rawData)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ingestion/canonical] resolveOrCreateCanonical error:', msg)
    return NextResponse.json({ error: 'Failed to resolve canonical', detail: msg }, { status: 500 })
  }

  const { canonical_id, was_merged, confidence } = resolveResult

  // ── Enrich (non-blocking — errors are logged, not fatal) ─────────────────────
  let freshnessScore = 100
  let fraudRiskScore = 0

  try {
    const [enrichment, fraud] = await Promise.allSettled([
      enrichProperty(canonical_id, tenantId),
      assessFraudRisk(canonical_id, tenantId),
    ])

    if (enrichment.status === 'rejected') {
      console.warn('[ingestion/canonical] enrichment error:', enrichment.reason)
    }

    if (fraud.status === 'fulfilled') {
      fraudRiskScore = fraud.value.fraud_risk_score
    } else {
      console.warn('[ingestion/canonical] fraud assessment error:', fraud.reason)
    }

    // Fetch updated freshness_score from canonical record
    const { data: updated } = await supabaseAdmin
      .from('canonical_properties')
      .select('freshness_score')
      .eq('canonical_id', canonical_id)
      .eq('tenant_id', tenantId)
      .single()

    if (updated) freshnessScore = Number(updated.freshness_score)
  } catch (err) {
    console.warn('[ingestion/canonical] post-resolve pipeline error:', err)
  }

  return NextResponse.json(
    {
      canonical_id,
      was_merged,
      confidence,
      freshness_score: freshnessScore,
      fraud_risk_score: fraudRiskScore,
    },
    { status: was_merged ? 200 : 201 },
  )
}

// ─── GET /api/ingestion/canonical?canonical_id=<uuid> ────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  // ── Parse params ─────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const canonicalId = searchParams.get('canonical_id')

  if (!canonicalId) {
    return NextResponse.json({ error: 'canonical_id query param required' }, { status: 400 })
  }

  const tenantId =
    searchParams.get('tenant_id') ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  // ── Fetch canonical ───────────────────────────────────────────────────────────
  const { data: canonical, error: canonErr } = await supabaseAdmin
    .from('canonical_properties')
    .select('*')
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .single()

  if (canonErr || !canonical) {
    return NextResponse.json(
      { error: 'Canonical property not found', canonical_id: canonicalId },
      { status: 404 },
    )
  }

  // ── Fetch enrichment ──────────────────────────────────────────────────────────
  const { data: enrichment } = await supabaseAdmin
    .from('property_enrichments')
    .select('*')
    .eq('canonical_id', canonicalId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return NextResponse.json({
    ...canonical,
    enrichment: enrichment ?? null,
  })
}
