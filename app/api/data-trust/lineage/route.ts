// Agency Group — Data Trust API Route
// app/api/data-trust/lineage/route.ts
// Unified endpoint for all Data Trust Engine operations.

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getEntityLineage, getLineageSummary } from '@/lib/data-trust/lineageTracker'
import { computeSourceTrust } from '@/lib/data-trust/trustScorer'
import { checkDataStaleness } from '@/lib/data-trust/staleDetector'
import { runReconciliation } from '@/lib/data-trust/reconciliationEngine'

export const runtime = 'nodejs'
export const maxDuration = 60

const CANONICAL_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const VALID_ENTITY_TYPES = [
  'property',
  'contact',
  'deal',
  'match',
  'ml_score',
] as const
type ValidEntityType = (typeof VALID_ENTITY_TYPES)[number]

export async function GET(req: NextRequest): Promise<Response> {
  // Auth guard
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const tenantId = CANONICAL_TENANT_ID

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  try {
    // ── mode=summary: overall lineage summary ────────────────────────────────
    if (mode === 'summary') {
      const summary = await getLineageSummary(tenantId)
      return NextResponse.json({ ok: true, data: summary })
    }

    // ── mode=trust: per-source trust report ──────────────────────────────────
    if (mode === 'trust') {
      const report = await computeSourceTrust(tenantId)
      return NextResponse.json({ ok: true, data: report })
    }

    // ── mode=stale: table staleness report ───────────────────────────────────
    if (mode === 'stale') {
      const report = await checkDataStaleness(tenantId)
      return NextResponse.json({ ok: true, data: report })
    }

    // ── mode=reconcile: cross-source reconciliation ──────────────────────────
    // Note: reconciliation can be heavy — callers should allow longer timeout
    if (mode === 'reconcile') {
      const report = await runReconciliation(tenantId)
      return NextResponse.json({ ok: true, data: report })
    }

    // ── entity_type + entity_id: entity lineage chain ────────────────────────
    const entity_type = searchParams.get('entity_type')
    const entity_id = searchParams.get('entity_id')

    if (
      entity_type &&
      entity_id &&
      (VALID_ENTITY_TYPES as readonly string[]).includes(entity_type)
    ) {
      const chain = await getEntityLineage(
        entity_type as ValidEntityType,
        entity_id,
        tenantId,
      )
      return NextResponse.json({ ok: true, data: chain })
    }

    // ── Fallback: usage instructions ─────────────────────────────────────────
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid request. Use ?mode=summary|trust|stale|reconcile or ?entity_type=<type>&entity_id=<id>',
        valid_modes: ['summary', 'trust', 'stale', 'reconcile'],
        valid_entity_types: VALID_ENTITY_TYPES,
      },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', detail: message },
      { status: 500 },
    )
  }
}
