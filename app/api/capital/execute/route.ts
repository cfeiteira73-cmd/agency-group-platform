// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Capital Execute API
// app/api/capital/execute/route.ts
//
// GET  /api/capital/execute?transaction_id=xxx  → getTransaction
// GET  /api/capital/execute?property_id=xxx     → getTransactionsByProperty
// POST /api/capital/execute                     → initiateCapitalExecution (portal auth)
// PUT  /api/capital/execute?transaction_id=xxx  → advance stage or update status (service auth)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import {
  initiateCapitalExecution,
  getTransaction,
  getTransactionsByProperty,
  updateTransactionStatus,
  type TransactionStatus,
} from '@/lib/capital/transactionPipeline'
import { advanceSettlementStage, getSettlement, type SettlementStage } from '@/lib/capital/settlementTracker'
import { safeCompare } from '@/lib/safeCompare'
import log from '@/lib/logger'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const transactionId    = searchParams.get('transaction_id')
    const propertyId       = searchParams.get('property_id')

    const tenantId = await getTenantId(req)

    if (transactionId) {
      const tx = await getTransaction(tenantId, transactionId)
      if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      return NextResponse.json({ success: true, data: tx })
    }

    if (propertyId) {
      const txs = await getTransactionsByProperty(tenantId, propertyId)
      return NextResponse.json({ success: true, data: txs })
    }

    return NextResponse.json(
      { error: 'Provide transaction_id or property_id' },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /capital/execute GET] error', { error: msg })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as {
      property_id:        string
      investor_id:        string
      amount_eur:         number
      escrow_provider?:   'manual' | 'stripe_escrow' | 'bank_transfer'
      target_close_date?: string
      notes?:             string
    }

    const { property_id, investor_id, amount_eur } = body

    if (!property_id || !investor_id || !amount_eur) {
      return NextResponse.json(
        { error: 'Missing required fields: property_id, investor_id, amount_eur' },
        { status: 400 },
      )
    }

    if (typeof amount_eur !== 'number' || amount_eur <= 0) {
      return NextResponse.json({ error: 'amount_eur must be a positive number' }, { status: 400 })
    }

    const tenantId = await getTenantId(req)

    const tx = await initiateCapitalExecution(tenantId, {
      property_id,
      investor_id,
      amount_eur,
      escrow_provider:   body.escrow_provider,
      target_close_date: body.target_close_date,
      notes:             body.notes,
    })

    return NextResponse.json({ success: true, data: tx }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /capital/execute POST] error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest): Promise<NextResponse> {
  // Service auth via x-service-auth header
  const incomingToken   = req.headers.get('x-service-auth') ?? ''
  const internalSecret  = process.env.INTERNAL_API_SECRET ?? ''

  if (!internalSecret || !safeCompare(incomingToken, internalSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const transactionId    = searchParams.get('transaction_id')

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction_id param' }, { status: 400 })
    }

    const tenantId = process.env.DEFAULT_TENANT_ID
      ?? process.env.SYSTEM_ORG_ID
      ?? '00000000-0000-0000-0000-000000000001'

    const body = (await req.json()) as {
      stage?:  string
      status?: string
      notes?:  string
    }

    // Dispatch to settlement stage advance or transaction status update
    if (body.stage) {
      const settlement = await getSettlement(tenantId, transactionId)
      if (!settlement) {
        return NextResponse.json({ error: 'Settlement not found for transaction' }, { status: 404 })
      }

      const updated = await advanceSettlementStage(
        tenantId,
        settlement.id,
        body.stage as SettlementStage,
        body.notes,
      )
      return NextResponse.json({ success: true, data: updated })
    }

    if (body.status) {
      await updateTransactionStatus(
        tenantId,
        transactionId,
        body.status as TransactionStatus,
        body.notes,
      )
      const tx = await getTransaction(tenantId, transactionId)
      return NextResponse.json({ success: true, data: tx })
    }

    return NextResponse.json({ error: 'Provide stage or status to update' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /capital/execute PUT] error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
