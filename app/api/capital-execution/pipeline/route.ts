// Agency Group — Capital Execution Pipeline API Route
// app/api/capital-execution/pipeline/route.ts
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import { extractBearerToken, safeCompare } from '@/lib/middleware/portalAuthGuard'
import {
  initiatePipeline,
  advanceStage,
  rollbackPipeline,
  getPipeline,
  getActivePipelines,
  validatePipelineIntegrity,
} from '@/lib/capital-execution/realCapitalExecutionEngine'
import { getAvailablePSPs } from '@/lib/capital-execution/pspOrchestrator'
import {
  runReconciliation,
  importBankStatement,
  getReconciliationHistory,
} from '@/lib/capital-execution/bankReconciliationEngine'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = extractBearerToken(req)
  if (!token) return false
  return safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const pipelineId = searchParams.get('pipeline_id')
    const tenantId = searchParams.get('tenant_id') ?? DEFAULT_TENANT

    // ?pipeline_id=... → getPipeline + validateIntegrity
    if (pipelineId) {
      const pipeline = await getPipeline(pipelineId, tenantId)
      if (!pipeline) {
        return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
      }
      const valid = validatePipelineIntegrity(pipeline)
      return NextResponse.json({ pipeline, integrity_valid: valid })
    }

    // ?mode=reconciliation → latest reconciliation run
    if (mode === 'reconciliation') {
      const history = await getReconciliationHistory(tenantId, 1)
      return NextResponse.json({ latest_run: history[0] ?? null, history })
    }

    // ?mode=psp-status → available PSPs + latest reconciliation runs
    if (mode === 'psp-status') {
      const available = getAvailablePSPs()
      const { data: latestRuns } = await (supabaseAdmin as any)
        .from('psp_reconciliation_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('run_at', { ascending: false })
        .limit(5)

      return NextResponse.json({ available_psps: available, latest_reconciliation_runs: latestRuns ?? [] })
    }

    // Default: active pipelines
    const pipelines = await getActivePipelines(tenantId)
    return NextResponse.json({ pipelines, count: pipelines.length })
  } catch (e) {
    log.error('[capital-execution/pipeline] GET error', e instanceof Error ? e : new Error(String(e)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Admin Bearer required
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined
  const tenantId = (body.tenant_id as string | undefined) ?? DEFAULT_TENANT

  try {
    // ── initiate ──────────────────────────────────────────────────────────────
    if (action === 'initiate') {
      const deal_id = body.deal_id as string | undefined
      const investor_id = body.investor_id as string | undefined
      const amount_eur_cents = body.amount_eur_cents as number | undefined
      const idempotency_key = body.idempotency_key as string | undefined

      if (!deal_id || !investor_id || amount_eur_cents == null || !idempotency_key) {
        return NextResponse.json(
          { error: 'Missing required fields: deal_id, investor_id, amount_eur_cents, idempotency_key' },
          { status: 400 },
        )
      }

      if (!Number.isInteger(amount_eur_cents) || amount_eur_cents <= 0) {
        return NextResponse.json({ error: 'amount_eur_cents must be a positive integer' }, { status: 400 })
      }

      const pipeline = await initiatePipeline(deal_id, investor_id, amount_eur_cents, tenantId, idempotency_key)
      return NextResponse.json({ pipeline }, { status: 201 })
    }

    // ── advance ───────────────────────────────────────────────────────────────
    if (action === 'advance') {
      const pipeline_id = body.pipeline_id as string | undefined
      const external_ref = body.external_ref as string | undefined
      const metadata = (body.metadata as Record<string, unknown> | undefined) ?? {}

      if (!pipeline_id || !external_ref) {
        return NextResponse.json({ error: 'Missing required fields: pipeline_id, external_ref' }, { status: 400 })
      }

      const pipeline = await advanceStage(pipeline_id, tenantId, external_ref, metadata)
      return NextResponse.json({ pipeline })
    }

    // ── rollback ──────────────────────────────────────────────────────────────
    if (action === 'rollback') {
      const pipeline_id = body.pipeline_id as string | undefined
      const reason = body.reason as string | undefined

      if (!pipeline_id || !reason) {
        return NextResponse.json({ error: 'Missing required fields: pipeline_id, reason' }, { status: 400 })
      }

      await rollbackPipeline(pipeline_id, tenantId, reason)
      return NextResponse.json({ success: true, pipeline_id, reason })
    }

    // ── reconcile ─────────────────────────────────────────────────────────────
    if (action === 'reconcile') {
      const period_start = body.period_start as string | undefined
      const period_end = body.period_end as string | undefined

      if (!period_start || !period_end) {
        return NextResponse.json({ error: 'Missing required fields: period_start, period_end' }, { status: 400 })
      }

      const start = new Date(period_start)
      const end = new Date(period_end)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid date format for period_start or period_end' }, { status: 400 })
      }

      const run = await runReconciliation(tenantId, start, end)
      return NextResponse.json({ run })
    }

    // ── import-bank-statement ─────────────────────────────────────────────────
    if (action === 'import-bank-statement') {
      const entries = body.entries as Array<{
        ref: string
        amount_eur_cents: number
        date: string
        description: string
      }> | undefined

      if (!Array.isArray(entries) || entries.length === 0) {
        return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 400 })
      }

      // Validate entries
      for (const entry of entries) {
        if (!entry.ref || !Number.isInteger(entry.amount_eur_cents) || !entry.date) {
          return NextResponse.json(
            { error: 'Each entry must have ref (string), amount_eur_cents (integer), date (string)' },
            { status: 400 },
          )
        }
      }

      const result = await importBankStatement(tenantId, entries)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: `Unknown action: ${action ?? '(none)'}` }, { status: 400 })
  } catch (e) {
    log.error('[capital-execution/pipeline] POST error', e instanceof Error ? e : new Error(String(e)), { action })
    return NextResponse.json({ error: 'Internal server error', detail: (e as Error).message }, { status: 500 })
  }
}
