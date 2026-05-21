// Agency Group — Capital Ledger API Route
// app/api/capital/ledger/route.ts
// GET/POST endpoint for investor ledger, settlement state machine, and capital intake.
// TypeScript strict — 0 errors

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  getInvestorBalance,
  getLedgerHistory,
  getTotalCapitalUnderManagement,
} from '@/lib/capital/investorLedger'
import {
  transitionSettlement,
  getSettlementAuditTrail,
  type SettlementTransition,
} from '@/lib/capital/settlementStateMachine'
import {
  processCapitalIntake,
  confirmManualIntake,
  getPendingIntakes,
  type IntakeRequest,
} from '@/lib/capital/capitalIntake'
import log from '@/lib/logger'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ─── Admin Bearer auth helper ─────────────────────────────────────────────────

function isAdminBearer(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (!token) return false
  try {
    const bufA = Buffer.from(token)
    const bufB = Buffer.from(secret)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id || CANONICAL_TENANT
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')
  const investorId = url.searchParams.get('investor_id')
  const settlementId = url.searchParams.get('settlement_id')

  try {
    // ── mode=total: aggregate capital under management ─────────────────────────
    if (mode === 'total') {
      const totals = await getTotalCapitalUnderManagement(tenantId)
      return NextResponse.json({ ok: true, data: totals })
    }

    // ── mode=pending-intakes: list PENDING_CONFIRMATION intakes ───────────────
    if (mode === 'pending-intakes') {
      const pending = await getPendingIntakes(tenantId)
      return NextResponse.json({ ok: true, data: pending })
    }

    // ── settlement_id + mode=trail: settlement audit trail ────────────────────
    if (settlementId && mode === 'trail') {
      const trail = await getSettlementAuditTrail(settlementId, tenantId)
      return NextResponse.json({ ok: true, data: trail })
    }

    // ── investor_id: investor balance + recent history ────────────────────────
    if (investorId) {
      const [balance, history] = await Promise.all([
        getInvestorBalance(investorId, tenantId),
        getLedgerHistory(investorId, tenantId, 20),
      ])
      return NextResponse.json({ ok: true, data: { balance, history } })
    }

    return NextResponse.json(
      {
        error: 'Missing parameter. Provide investor_id, mode=total, mode=pending-intakes, or settlement_id+mode=trail',
      },
      { status: 400 },
    )
  } catch (err) {
    log.info('[capital/ledger GET] error', { error: String(err) })
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

  const action = body.action as string | undefined
  if (!action) {
    return NextResponse.json({ error: 'Missing action field' }, { status: 400 })
  }

  // ── action=transition — requires admin Bearer ─────────────────────────────
  if (action === 'transition') {
    if (!isAdminBearer(req)) {
      return NextResponse.json({ error: 'Unauthorized — admin Bearer required for transition' }, { status: 401 })
    }

    const settlementId = body.settlement_id as string | undefined
    const transition   = body.transition   as SettlementTransition | undefined
    const actor        = body.actor        as string | undefined
    const notes        = (body.notes as string | undefined) ?? ''
    const tenantId     = (body.tenant_id as string | undefined) ?? CANONICAL_TENANT

    if (!settlementId || !transition || !actor) {
      return NextResponse.json(
        { error: 'Missing required fields: settlement_id, transition, actor' },
        { status: 400 },
      )
    }

    try {
      const result = await transitionSettlement(settlementId, transition, actor, notes, tenantId)
      log.info('[capital/ledger POST] transition applied', {
        settlement_id: settlementId,
        transition,
        actor,
      })
      return NextResponse.json({ ok: true, data: result })
    } catch (err) {
      log.info('[capital/ledger POST] transition error', { error: String(err) })
      return NextResponse.json({ error: String(err) }, { status: 422 })
    }
  }

  // ── action=intake / action=confirm-intake — require portal auth ───────────
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id || CANONICAL_TENANT

  // ── action=intake ─────────────────────────────────────────────────────────
  if (action === 'intake') {
    const investor_id       = body.investor_id       as string | undefined
    const amount_eur_cents  = body.amount_eur_cents  as number | undefined
    const provider          = body.provider          as string | undefined
    const reference         = body.reference         as string | undefined
    const idempotency_key   = body.idempotency_key   as string | undefined

    if (!investor_id || amount_eur_cents === undefined || !provider || !reference || !idempotency_key) {
      return NextResponse.json(
        { error: 'Missing required fields: investor_id, amount_eur_cents, provider, reference, idempotency_key' },
        { status: 400 },
      )
    }

    if (!Number.isInteger(amount_eur_cents) || amount_eur_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_eur_cents must be a positive integer (EUR cents)' },
        { status: 400 },
      )
    }

    const intakeReq: IntakeRequest = {
      investor_id,
      tenant_id:        tenantId,
      amount_eur_cents,
      provider:         provider as IntakeRequest['provider'],
      reference,
      idempotency_key,
      metadata:         (body.metadata as Record<string, unknown> | undefined) ?? {},
    }

    try {
      const result = await processCapitalIntake(intakeReq)
      return NextResponse.json({ ok: true, data: result })
    } catch (err) {
      log.info('[capital/ledger POST] intake error', { error: String(err) })
      return NextResponse.json({ error: String(err) }, { status: 422 })
    }
  }

  // ── action=confirm-intake ─────────────────────────────────────────────────
  if (action === 'confirm-intake') {
    const intake_id    = body.intake_id    as string | undefined
    const confirmed_by = body.confirmed_by as string | undefined

    if (!intake_id || !confirmed_by) {
      return NextResponse.json(
        { error: 'Missing required fields: intake_id, confirmed_by' },
        { status: 400 },
      )
    }

    try {
      const result = await confirmManualIntake(intake_id, confirmed_by, tenantId)
      return NextResponse.json({ ok: true, data: result })
    } catch (err) {
      log.info('[capital/ledger POST] confirm-intake error', { error: String(err) })
      return NextResponse.json({ error: String(err) }, { status: 422 })
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
