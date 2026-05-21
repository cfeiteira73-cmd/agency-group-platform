// Agency Group — Execution Commit API
// app/api/execution/commit/route.ts
// Execution Engine + Escrow Orchestration endpoints.
// Admin Bearer required for all POST actions.
// TypeScript strict — 0 errors

export const runtime    = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  safeCompare,
  extractBearerToken,
} from '@/lib/middleware/portalAuthGuard'
import {
  createExecutionPlan,
  executeStep,
  executeFullPlan,
  getExecutionPlan,
  getActiveExecutions,
} from '@/lib/execution/executionEngine'
import {
  getEscrowBySettlement,
} from '@/lib/execution/escrowOrchestrator'
import {
  getCPCVWorkflow,
  getBlockingIssues,
  recordLegalEvent,
  initiateCPCVWorkflow,
  type LegalEventType,
} from '@/lib/execution/legalExecutionFramework'
import log from '@/lib/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function getTenantId(): string {
  return CANONICAL_TENANT
}

/**
 * Validates that the request carries a valid INTERNAL_API_SECRET Bearer token.
 */
function requireAdminBearer(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET ?? ''
  if (!secret) return false
  const token = extractBearerToken(req)
  if (!token) return false
  return safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  try {
    const { searchParams } = new URL(req.url)
    const tenantId   = getTenantId()
    const planId     = searchParams.get('plan_id')
    const mode       = searchParams.get('mode')
    const settlementId = searchParams.get('settlement_id')

    // GET ?plan_id=xxx → get a specific execution plan
    if (planId) {
      const plan = await getExecutionPlan(planId, tenantId)
      if (!plan) {
        return NextResponse.json({ error: 'Execution plan not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: plan })
    }

    // GET ?mode=active → list all EXECUTING plans
    if (mode === 'active') {
      const plans = await getActiveExecutions(tenantId)
      return NextResponse.json({ success: true, data: plans })
    }

    // GET ?settlement_id=xxx&mode=legal → CPCV workflow + blocking issues
    if (settlementId && mode === 'legal') {
      const [workflow, issues] = await Promise.all([
        getCPCVWorkflow(settlementId, tenantId),
        getBlockingIssues(settlementId, tenantId),
      ])
      return NextResponse.json({
        success: true,
        data: {
          workflow,
          blocking_issues: issues,
          is_blocked: issues.length > 0,
        },
      })
    }

    // GET ?settlement_id=xxx&mode=escrow → escrow account
    if (settlementId && mode === 'escrow') {
      const escrow = await getEscrowBySettlement(settlementId, tenantId)
      if (!escrow) {
        return NextResponse.json({ error: 'Escrow not found for settlement' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: escrow })
    }

    return NextResponse.json(
      {
        error: 'Provide plan_id, mode=active, settlement_id+mode=legal, or settlement_id+mode=escrow',
      },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.info('[API /execution/commit GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // All POST actions require Admin Bearer
  if (!requireAdminBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized — admin Bearer required' }, { status: 401 })
  }

  const tenantId = getTenantId()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body['action'] as string | undefined

  if (!action) {
    return NextResponse.json({ error: 'Missing action field' }, { status: 400 })
  }

  try {
    // ── create-plan ──────────────────────────────────────────────────────────
    if (action === 'create-plan') {
      const settlement_id    = body['settlement_id'] as string | undefined
      const asset_id         = body['asset_id'] as string | undefined
      const investor_id      = body['investor_id'] as string | undefined
      const bid_id           = body['bid_id'] as string | undefined
      const amount_eur_cents = body['amount_eur_cents'] as number | undefined

      if (!settlement_id || !asset_id || !investor_id || !bid_id || amount_eur_cents === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: settlement_id, asset_id, investor_id, bid_id, amount_eur_cents' },
          { status: 400 },
        )
      }

      if (typeof amount_eur_cents !== 'number' || !Number.isInteger(amount_eur_cents) || amount_eur_cents <= 0) {
        return NextResponse.json(
          { error: 'amount_eur_cents must be a positive integer (EUR cents)' },
          { status: 400 },
        )
      }

      const plan = await createExecutionPlan({
        settlement_id,
        asset_id,
        investor_id,
        bid_id,
        amount_eur_cents,
        tenant_id: tenantId,
      })

      return NextResponse.json({ success: true, data: plan }, { status: 201 })
    }

    // ── execute-step ─────────────────────────────────────────────────────────
    if (action === 'execute-step') {
      const plan_id = body['plan_id'] as string | undefined
      if (!plan_id) {
        return NextResponse.json({ error: 'Missing plan_id' }, { status: 400 })
      }

      // Determine which step to run
      let stepToRun: number

      if (body['step'] !== undefined) {
        stepToRun = body['step'] as number
      } else {
        // Auto-detect: find first PENDING step
        const plan = await getExecutionPlan(plan_id, tenantId)
        if (!plan) {
          return NextResponse.json({ error: 'Execution plan not found' }, { status: 404 })
        }
        const nextStep = plan.steps.find((s) => s.status === 'PENDING')
        if (!nextStep) {
          return NextResponse.json(
            { error: 'No PENDING steps remaining', data: plan },
            { status: 400 },
          )
        }
        stepToRun = nextStep.step
      }

      const updated = await executeStep(plan_id, stepToRun, tenantId)
      return NextResponse.json({ success: true, data: updated })
    }

    // ── execute-full ─────────────────────────────────────────────────────────
    if (action === 'execute-full') {
      const plan_id = body['plan_id'] as string | undefined
      if (!plan_id) {
        return NextResponse.json({ error: 'Missing plan_id' }, { status: 400 })
      }

      const result = await executeFullPlan(plan_id, tenantId)
      return NextResponse.json({
        success: result.status === 'COMPLETED',
        data: result,
      })
    }

    // ── legal-event ──────────────────────────────────────────────────────────
    if (action === 'legal-event') {
      const doc_id    = body['doc_id'] as string | undefined
      const event     = body['event'] as LegalEventType | undefined
      const signed_by = (body['signed_by'] as string | undefined) ?? null
      const notary_ref = (body['notary_ref'] as string | undefined) ?? null

      if (!doc_id || !event) {
        return NextResponse.json({ error: 'Missing required fields: doc_id, event' }, { status: 400 })
      }

      const validEvents: LegalEventType[] = [
        'DOCUMENT_GENERATED',
        'SENT_FOR_SIGNATURE',
        'PARTIALLY_SIGNED',
        'FULLY_SIGNED',
        'NOTARY_SUBMITTED',
        'NOTARY_CONFIRMED',
        'REGISTERED',
        'REJECTED',
      ]

      if (!validEvents.includes(event)) {
        return NextResponse.json(
          { error: `Invalid event type. Valid: ${validEvents.join(', ')}` },
          { status: 400 },
        )
      }

      const updatedDoc = await recordLegalEvent(doc_id, event, signed_by, notary_ref, tenantId)
      return NextResponse.json({ success: true, data: updatedDoc })
    }

    // ── initiate-cpcv ─────────────────────────────────────────────────────────
    if (action === 'initiate-cpcv') {
      const settlement_id = body['settlement_id'] as string | undefined
      const parties       = body['parties'] as string[] | undefined

      if (!settlement_id || !parties || !Array.isArray(parties) || parties.length === 0) {
        return NextResponse.json(
          { error: 'Missing required fields: settlement_id, parties (non-empty array)' },
          { status: 400 },
        )
      }

      const workflow = await initiateCPCVWorkflow(settlement_id, parties, tenantId)
      return NextResponse.json({ success: true, data: workflow }, { status: 201 })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.info('[API /execution/commit POST] error', { action, error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
