// Agency Group — Financial Integrity Certification API
// app/api/financial-integrity/certify/route.ts
// GET  ?mode=summary|ledger|synthetic|reconciliation
// POST { action: 'run-full-certification' } (requires Bearer token)
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { runLedgerCertification } from '@/lib/financial-integrity/ledgerCertifier'
import { runSyntheticTests } from '@/lib/financial-integrity/syntheticTransactionEngine'
import { runReconciliationValidation } from '@/lib/financial-integrity/reconciliationValidator'

export const runtime = 'nodejs'
export const maxDuration = 120

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Replacer for JSON.stringify to handle BigInt
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'summary'

  if (mode === 'ledger') {
    const cert = await runLedgerCertification(TENANT_ID)
    return new NextResponse(JSON.stringify(cert, bigintReplacer), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (mode === 'synthetic') {
    const tests = runSyntheticTests()
    return new NextResponse(JSON.stringify(tests, bigintReplacer), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (mode === 'reconciliation') {
    const report = await runReconciliationValidation(TENANT_ID)
    return NextResponse.json(report)
  }

  // Default: full certification summary
  const [ledger, synthetic, reconciliation] = await Promise.allSettled([
    runLedgerCertification(TENANT_ID),
    Promise.resolve(runSyntheticTests()),
    runReconciliationValidation(TENANT_ID),
  ])

  const ledgerStatus =
    ledger.status === 'fulfilled' ? ledger.value.overall_status : 'ERROR'
  const syntheticResult =
    synthetic.status === 'fulfilled'
      ? { passed: synthetic.value.pass_count, failed: synthetic.value.fail_count, all_passed: synthetic.value.all_passed }
      : null
  const reconciliationStatus =
    reconciliation.status === 'fulfilled'
      ? reconciliation.value.overall_reconciliation_status
      : 'ERROR'

  const isCertified =
    ledger.status === 'fulfilled' &&
    ledger.value.overall_status === 'PASS' &&
    synthetic.status === 'fulfilled' &&
    synthetic.value.all_passed &&
    reconciliation.status === 'fulfilled' &&
    reconciliation.value.overall_reconciliation_status === 'CLEAN'

  const summary = {
    certified_at: new Date().toISOString(),
    ledger_status: ledgerStatus,
    synthetic_tests: syntheticResult,
    reconciliation_status: reconciliationStatus,
    financial_integrity_grade: isCertified ? 'CERTIFIED' : 'CERTIFICATION_PENDING',
  }

  return new NextResponse(JSON.stringify(summary, bigintReplacer), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const expected = process.env.API_SECRET_KEY ?? process.env.INTERNAL_API_KEY ?? ''

  if (!token || !expected || !safeCompare(token, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
  const action = body.action as string

  if (action === 'run-full-certification') {
    const [ledger, reconciliation] = await Promise.allSettled([
      runLedgerCertification(TENANT_ID),
      runReconciliationValidation(TENANT_ID),
    ])
    const synthetic = runSyntheticTests()

    return new NextResponse(
      JSON.stringify(
        {
          ledger: ledger.status === 'fulfilled' ? ledger.value : null,
          synthetic,
          reconciliation: reconciliation.status === 'fulfilled' ? reconciliation.value : null,
        },
        bigintReplacer
      ),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
