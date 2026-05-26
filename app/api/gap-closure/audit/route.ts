// Agency Group — Gap Closure Audit API
// app/api/gap-closure/audit/route.ts
// TypeScript strict — 0 errors
//
// GET  /api/gap-closure/audit                         → latest gap report
// GET  /api/gap-closure/audit?mode=full-audit         → fresh full audit
// GET  /api/gap-closure/audit?mode=capital-reality    → capital reality summary
// GET  /api/gap-closure/audit?mode=layer&layer=X      → specific layer audit
//
// POST /api/gap-closure/audit  { action: 'confirm-capital', ... }
// POST /api/gap-closure/audit  { action: 'run-full-audit' }

export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  extractBearerToken,
  safeCompare,
} from '@/lib/middleware/portalAuthGuard'
import {
  runFullGapAudit,
  getLatestGapReport,
  auditCapitalLayer,
  auditLegalLayer,
  auditMarketDataLayer,
  auditMLLayer,
  auditRegulatoryLayer,
  type GapLayer,
} from '@/lib/gap-closure/gapClosureOrchestrator'
import {
  getCapitalRealitySummary,
  confirmCapitalReal,
} from '@/lib/gap-closure/capitalRealityEngine'
import log from '@/lib/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const VALID_LAYERS = new Set<GapLayer>([
  'CAPITAL',
  'LEGAL',
  'MARKET_DATA',
  'LIQUIDITY',
  'REGULATORY',
  'ML',
  'TRUST',
])

function isValidLayer(layer: string): layer is GapLayer {
  return VALID_LAYERS.has(layer as GapLayer)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id ?? CANONICAL_TENANT
  const mode = req.nextUrl.searchParams.get('mode') ?? 'latest'
  const layer = req.nextUrl.searchParams.get('layer') ?? ''

  log.info('[gap-closure/audit] GET request', { mode, tenant_id: tenantId, layer })

  try {
    // ── mode: full-audit ────────────────────────────────────────────────────
    if (mode === 'full-audit') {
      const report = await runFullGapAudit(tenantId)
      return NextResponse.json(
        {
          mode: 'full-audit',
          tenant_id: tenantId,
          report,
        },
        { status: 200 },
      )
    }

    // ── mode: capital-reality ───────────────────────────────────────────────
    if (mode === 'capital-reality') {
      const summary = await getCapitalRealitySummary(tenantId)
      return NextResponse.json(
        {
          mode: 'capital-reality',
          tenant_id: tenantId,
          summary,
        },
        { status: 200 },
      )
    }

    // ── mode: layer ─────────────────────────────────────────────────────────
    if (mode === 'layer') {
      if (!layer || !isValidLayer(layer)) {
        return NextResponse.json(
          {
            error: 'Invalid layer',
            valid_layers: Array.from(VALID_LAYERS),
          },
          { status: 400 },
        )
      }

      let gaps: Awaited<ReturnType<typeof auditCapitalLayer>>

      switch (layer) {
        case 'CAPITAL':
          gaps = await auditCapitalLayer(tenantId)
          break
        case 'LEGAL':
          gaps = await auditLegalLayer(tenantId)
          break
        case 'MARKET_DATA':
          gaps = await auditMarketDataLayer(tenantId)
          break
        case 'ML':
          gaps = await auditMLLayer(tenantId)
          break
        case 'REGULATORY':
          gaps = await auditRegulatoryLayer(tenantId)
          break
        default:
          return NextResponse.json(
            {
              error: `Layer '${layer}' audit not yet implemented`,
            },
            { status: 501 },
          )
      }

      return NextResponse.json(
        {
          mode: 'layer',
          layer,
          tenant_id: tenantId,
          gaps_found: gaps.length,
          open_gaps: gaps.filter((g) => g.status === 'OPEN').length,
          gaps,
        },
        { status: 200 },
      )
    }

    // ── default: latest ─────────────────────────────────────────────────────
    const latest = await getLatestGapReport(tenantId)
    if (!latest) {
      return NextResponse.json(
        {
          mode: 'latest',
          tenant_id: tenantId,
          report: null,
          message: 'No gap report found. Run ?mode=full-audit to generate one.',
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        mode: 'latest',
        tenant_id: tenantId,
        report: latest,
      },
      { status: 200 },
    )
  } catch (e) {
    log.error('[gap-closure/audit] GET failed', e, { mode, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(e) },
      { status: 500 },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Admin-only — require INTERNAL_API_SECRET Bearer
  const token = extractBearerToken(req)
  const internalSecret = process.env.INTERNAL_API_SECRET

  if (!token || !internalSecret || !safeCompare(token, internalSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized', reason: 'invalid_admin_bearer' },
      { status: 401 },
    )
  }

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  log.info('[gap-closure/audit] POST request', { action, tenant_id: tenantId })

  try {
    // ── action: confirm-capital ─────────────────────────────────────────────
    if (action === 'confirm-capital') {
      const entryId = body.entry_id as string | undefined
      const bankRef = body.bank_ref as string | undefined
      const externalProofUrl = body.external_proof_url as string | undefined

      if (!entryId || typeof entryId !== 'string' || entryId.trim().length === 0) {
        return NextResponse.json(
          { error: 'entry_id is required' },
          { status: 400 },
        )
      }

      if (!bankRef || typeof bankRef !== 'string' || bankRef.trim().length === 0) {
        return NextResponse.json(
          { error: 'bank_ref is required' },
          { status: 400 },
        )
      }

      await confirmCapitalReal(
        entryId.trim(),
        bankRef.trim(),
        tenantId,
        typeof externalProofUrl === 'string' && externalProofUrl.trim().length > 0
          ? externalProofUrl.trim()
          : undefined,
      )

      return NextResponse.json(
        {
          action: 'confirm-capital',
          entry_id: entryId,
          bank_ref: bankRef,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        },
        { status: 200 },
      )
    }

    // ── action: run-full-audit ──────────────────────────────────────────────
    if (action === 'run-full-audit') {
      const report = await runFullGapAudit(tenantId)
      return NextResponse.json(
        {
          action: 'run-full-audit',
          tenant_id: tenantId,
          report,
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        error: 'Unknown action',
        valid_actions: ['confirm-capital', 'run-full-audit'],
      },
      { status: 400 },
    )
  } catch (e) {
    log.error('[gap-closure/audit] POST failed', e, { action, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(e) },
      { status: 500 },
    )
  }
}
