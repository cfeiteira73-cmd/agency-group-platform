// Agency Group — Ledger Status API Route
// app/api/ledger/status/route.ts
// Exposes double-entry ledger, escrow, reconciliation, and velocity endpoints.
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, safeCompare } from '@/lib/middleware/portalAuthGuard'
import {
  getLedgerHealth,
  getTrialBalance,
  postJournalEntry,
} from '@/lib/ledger/doubleEntryLedger'
import type { JournalEntryStatus } from '@/lib/ledger/doubleEntryLedger'
import { getEscrowSummary, confirmBankDeposit } from '@/lib/ledger/escrowReconciliationEngine'
import {
  getReconciliationReport,
  autoMatchStatementLines,
} from '@/lib/ledger/bankStatementMatchingEngine'
import { computeCapitalVelocity } from '@/lib/ledger/capitalVelocityTracker'
import { computeFeeBreakdown, serializeFeeBreakdown } from '@/lib/ledger/transactionFeeEngine'

export const runtime = 'nodejs'
export const maxDuration = 60

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = extractBearerToken(req)
  if (!token) return false
  return safeCompare(token, secret)
}

// ── BigInt-safe JSON serializer ───────────────────────────────────────────────

function jsonBigInt(obj: unknown): string {
  return JSON.stringify(obj, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}

function okBigInt(data: unknown, status = 200): Response {
  return new Response(jsonBigInt(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const tenantId = searchParams.get('tenant_id') ?? TENANT_ID

    if (mode === 'trial-balance') {
      const tb = await getTrialBalance(tenantId)
      return okBigInt({ trial_balance: tb, mode: 'trial-balance' })
    }

    if (mode === 'escrow-summary') {
      const summary = await getEscrowSummary(tenantId)
      return okBigInt({ escrow_summary: summary, mode: 'escrow-summary' })
    }

    if (mode === 'reconciliation') {
      const report = await getReconciliationReport(tenantId)
      return okBigInt({ reconciliation: report, mode: 'reconciliation' })
    }

    if (mode === 'velocity') {
      const snapshot = await computeCapitalVelocity(tenantId)
      return okBigInt({ velocity: snapshot, mode: 'velocity' })
    }

    // Default: health + escrow summary
    const [health, escrow] = await Promise.all([
      getLedgerHealth(tenantId),
      getEscrowSummary(tenantId),
    ])

    return okBigInt({
      status: 'ok',
      ledger_health: health,
      escrow_summary: escrow,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[ledger/status] GET error', err)
    return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = body.action as string | undefined
    const tenantId = (body.tenant_id as string | undefined) ?? TENANT_ID

    // ── post-entry ────────────────────────────────────────────────────────────
    if (action === 'post-entry') {
      const entry = await postJournalEntry({
        tenant_id: tenantId,
        transaction_id: body.transaction_id as string,
        description: (body.description as string | undefined) ?? '',
        status: (body.status as JournalEntryStatus | undefined) ?? 'POSTED',
        debit_account_code: body.debit_account_code as string,
        credit_account_code: body.credit_account_code as string,
        amount_cents: BigInt(String(body.amount_cents ?? 0)),
        currency: 'EUR',
        idempotency_key: body.idempotency_key as string,
        metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
      })
      return okBigInt({ entry })
    }

    // ── confirm-deposit ───────────────────────────────────────────────────────
    if (action === 'confirm-deposit') {
      const result = await confirmBankDeposit(
        body.escrow_id as string,
        BigInt(String(body.actual_amount_cents ?? 0)),
        body.bank_reference as string
      )
      return okBigInt({ result })
    }

    // ── compute-fees ──────────────────────────────────────────────────────────
    if (action === 'compute-fees') {
      const salePriceCents = BigInt(String(body.sale_price_cents ?? 0))
      const country = (body.country as 'PT' | 'ES' | undefined) ?? 'PT'
      const breakdown = computeFeeBreakdown(salePriceCents, country)
      return NextResponse.json({ breakdown: serializeFeeBreakdown(breakdown) })
    }

    // ── auto-match ────────────────────────────────────────────────────────────
    if (action === 'auto-match') {
      const result = await autoMatchStatementLines(tenantId)
      return NextResponse.json({ result })
    }

    return NextResponse.json(
      { error: `Unknown action: ${action ?? '(none)'}` },
      { status: 400 }
    )
  } catch (err) {
    console.error('[ledger/status] POST error', err)
    return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
  }
}
