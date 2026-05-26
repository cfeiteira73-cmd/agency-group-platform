// app/api/validation/reconciliation/route.ts
// GET  /api/validation/reconciliation — latest test runs + bank reconciliation status
// POST /api/validation/reconciliation — Bearer auth required; run 1000-tx test suite
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runAndPersistReconciliationTests } from '@/lib/validation/reconciliationTestSuite'
import { runReconciliationValidation } from '@/lib/financial-integrity/reconciliationValidator'

export const runtime = 'nodejs'
export const maxDuration = 60

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

function requireBearer(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.CRON_SECRET ?? ''
  if (!expected) return false
  return safeCompare(token, expected)
}

export async function GET(): Promise<NextResponse> {
  try {
    const [runsResult, reconResult] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('reconciliation_test_runs')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .order('executed_at', { ascending: false })
        .limit(5),
      runReconciliationValidation(TENANT_ID),
    ])

    const runs = runsResult.status === 'fulfilled' ? (runsResult.value.data ?? []) : []
    const bankReconciliation = reconResult.status === 'fulfilled' ? reconResult.value : null

    const json = JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        recent_test_runs: runs,
        bank_reconciliation: bankReconciliation,
        latest_status: runs[0]?.overall_status ?? 'NO_RUNS_YET',
      },
      bigintReplacer,
    )
    return new NextResponse(json, { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    log.warn('[api/validation/reconciliation] GET error', { e: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!requireBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAndPersistReconciliationTests(TENANT_ID)
    const json = JSON.stringify(result, bigintReplacer)
    return new NextResponse(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    log.warn('[api/validation/reconciliation] POST error', { e: String(e) })
    return NextResponse.json({ error: 'Test suite failed' }, { status: 500 })
  }
}
