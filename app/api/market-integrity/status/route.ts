// app/api/market-integrity/status/route.ts
// GET /api/market-integrity/status — runs live market integrity validation
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import log from '@/lib/logger'
import { runMarketIntegrityValidation } from '@/lib/market-integrity/priceValidationEngine'

export const runtime = 'nodejs'
export const maxDuration = 30

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

export async function GET(): Promise<NextResponse> {
  try {
    const report = await runMarketIntegrityValidation(TENANT_ID)
    const json = JSON.stringify(report, bigintReplacer)
    return new NextResponse(json, { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    log.warn('[api/market-integrity/status] GET error', { e: String(e) })
    return NextResponse.json({ error: 'Market integrity check failed' }, { status: 500 })
  }
}
