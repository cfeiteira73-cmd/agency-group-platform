// =============================================================================
// Agency Group — Financial Audit Ledger API
// app/api/economics/ledger/route.ts
//
// GET  /api/economics/ledger?deal_id=<uuid>
//      Returns full deal ledger (all entries ordered by sequence_number).
//
// GET  /api/economics/ledger?from=2026-01-01&to=2026-06-30
//      Returns revenue reconciliation report for the date range.
//
// POST /api/economics/ledger/verify  (handled at /verify sub-route)
//      Runs full hash-chain integrity check for the tenant's ledger.
//
// Auth: INTERNAL_API_SECRET (Bearer token in Authorization header)
//
// AMI: 22506 | SH-ROS | TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import {
  getDealLedger,
  computeRevenueReconciliation,
  verifyLedgerIntegrity,
  type LedgerEntry,
  type RevenueReconciliation,
  type LedgerIntegrityReport,
} from '@/lib/economics/auditLedger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization') ?? ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  return safeCompare(token, secret)
}

function tenantId(): string {
  return process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dealId = searchParams.get('deal_id')
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')

  // ── Path: deal ledger ─────────────────────────────────────────────────────
  if (dealId) {
    try {
      const entries: LedgerEntry[] = await getDealLedger(dealId, tenantId())
      return NextResponse.json(
        {
          deal_id:        dealId,
          tenant_id:      tenantId(),
          entry_count:    entries.length,
          entries,
          fetched_at:     new Date().toISOString(),
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    } catch (err: unknown) {
      return NextResponse.json(
        { error: 'Failed to fetch deal ledger', detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }
  }

  // ── Path: revenue reconciliation report ───────────────────────────────────
  if (from && to) {
    // Validate ISO date format
    if (!/^\d{4}-\d{2}-\d{2}/.test(from) || !/^\d{4}-\d{2}-\d{2}/.test(to)) {
      return NextResponse.json(
        { error: 'from and to must be ISO date strings e.g. 2026-01-01' },
        { status: 400 }
      )
    }

    try {
      const report: RevenueReconciliation = await computeRevenueReconciliation(tenantId(), from, to)
      return NextResponse.json(
        {
          tenant_id:   tenantId(),
          from,
          to,
          report,
          computed_at: new Date().toISOString(),
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    } catch (err: unknown) {
      return NextResponse.json(
        { error: 'Reconciliation computation failed', detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    {
      error:   'Missing required parameters',
      options: [
        'GET ?deal_id=<uuid>           — full deal audit trail',
        'GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — revenue reconciliation',
        'POST /verify                  — hash-chain integrity check',
      ],
    },
    { status: 400 }
  )
}

// ─── POST (integrity verification) ────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    // body is optional
  }

  const fromSequence = typeof body.from_sequence === 'number' ? body.from_sequence : 1

  try {
    const report: LedgerIntegrityReport = await verifyLedgerIntegrity(tenantId(), fromSequence)

    return NextResponse.json(
      {
        tenant_id:   tenantId(),
        verified_at: new Date().toISOString(),
        ...report,
      },
      {
        status:  report.is_valid ? 200 : 409,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Integrity verification failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
