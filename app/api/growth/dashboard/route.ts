// Agency Group — Master Growth Dashboard API
// app/api/growth/dashboard/route.ts
// Single endpoint for all growth + expansion status.
// TypeScript strict — 0 errors

export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import { getMasterGrowthStatus } from '@/lib/growth/masterGrowthStatus'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  // Auth
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id || CANONICAL_TENANT

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'cached'

  try {
    // ── mode=full: fresh assembly ─────────────────────────────────────────
    if (mode === 'full') {
      const status = await getMasterGrowthStatus(tenantId)

      return NextResponse.json(
        { ok: true, mode: 'full', data: status },
        {
          status: 200,
          headers: buildStatusHeaders(
            status.system_status,
            status.network_effect.stage,
            status.ready_for_institutional,
          ),
        },
      )
    }

    // ── mode=graph-snapshot: economic growth graph ────────────────────────
    if (mode === 'graph-snapshot') {
      const { getGraphSnapshot } = await import(
        '@/lib/growth/economicGrowthGraph'
      )
      const snapshot = await getGraphSnapshot(tenantId)

      return NextResponse.json(
        { ok: true, mode: 'graph-snapshot', data: snapshot },
        { status: 200 },
      )
    }

    // ── mode=segmentation: capital segmentation report ────────────────────
    if (mode === 'segmentation') {
      const { generateSegmentationReport } = await import(
        '@/lib/growth/capitalSegmentationEngine'
      )
      const report = await generateSegmentationReport(tenantId)

      return NextResponse.json(
        { ok: true, mode: 'segmentation', data: report },
        { status: 200 },
      )
    }

    // ── default: cached (latest row from master_growth_status_history) ────
    const { data: rows, error } = await (supabaseAdmin as any)
      .from('master_growth_status_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (error || !Array.isArray(rows) || rows.length === 0) {
      // No cached row yet — generate fresh
      log.info('[growth/dashboard] no cached row, generating fresh status', {
        tenant_id: tenantId,
      })
      const status = await getMasterGrowthStatus(tenantId)

      return NextResponse.json(
        { ok: true, mode: 'cached', data: status },
        {
          status: 200,
          headers: buildStatusHeaders(
            status.system_status,
            status.network_effect.stage,
            status.ready_for_institutional,
          ),
        },
      )
    }

    const cached = rows[0] as Record<string, unknown>

    const systemStatus = (cached['system_status'] as string) ?? 'EARLY_STAGE'
    const networkEffectData = (cached['network_effect'] as Record<string, unknown>) ?? {}
    const networkStage = (networkEffectData['stage'] as string) ?? 'SPARK'
    const readyForInstitutional = Boolean(cached['ready_for_institutional'])

    return NextResponse.json(
      { ok: true, mode: 'cached', data: cached },
      {
        status: 200,
        headers: buildStatusHeaders(systemStatus, networkStage, readyForInstitutional),
      },
    )
  } catch (e) {
    log.warn('[growth/dashboard] GET failed', { error: String(e) })
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: String(e) },
      { status: 500 },
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStatusHeaders(
  systemStatus: string,
  networkStage: string,
  readyForInstitutional: boolean,
): Record<string, string> {
  const validSystemStatuses = new Set([
    'MARKET_ORGANISM',
    'SELF_GROWING',
    'SCALING',
    'BUILDING',
    'EARLY_STAGE',
  ])
  const validNetworkStages = new Set([
    'SPARK',
    'IGNITION',
    'MOMENTUM',
    'FLYWHEEL',
    'COMPOUNDING',
  ])

  return {
    'X-System-Status': validSystemStatuses.has(systemStatus)
      ? systemStatus
      : 'EARLY_STAGE',
    'X-Network-Effect-Stage': validNetworkStages.has(networkStage)
      ? networkStage
      : 'SPARK',
    'X-Ready-For-Institutional': readyForInstitutional ? 'true' : 'false',
  }
}
