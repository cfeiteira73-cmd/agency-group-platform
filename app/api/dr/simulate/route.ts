// app/api/dr/simulate/route.ts
// GET  /api/dr/simulate — latest DR simulation results (5 most recent)
// POST /api/dr/simulate — Bearer auth required; run full DR simulation
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runAndPersistDrSimulation } from '@/lib/dr/drSimulationEngine'

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
    const { data: rows, error } = await (supabaseAdmin as any)
      .from('dr_simulation_runs')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .order('simulated_at', { ascending: false })
      .limit(5)

    if (error) {
      return NextResponse.json(
        { checked_at: new Date().toISOString(), runs: [], error: error.message },
        { status: 200 },
      )
    }

    const json = JSON.stringify(
      { checked_at: new Date().toISOString(), runs: rows ?? [] },
      bigintReplacer,
    )
    return new NextResponse(json, { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    log.warn('[api/dr/simulate] GET error', { e: String(e) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!requireBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await runAndPersistDrSimulation(TENANT_ID)
    const json = JSON.stringify(report, bigintReplacer)
    return new NextResponse(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    log.warn('[api/dr/simulate] POST error', { e: String(e) })
    return NextResponse.json({ error: 'DR simulation failed' }, { status: 500 })
  }
}
