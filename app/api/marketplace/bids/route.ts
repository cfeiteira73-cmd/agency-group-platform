// Agency Group — Marketplace Bids API
// app/api/marketplace/bids/route.ts
// TypeScript strict — 0 errors

export const runtime     = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  submitBid,
  acceptBid,
  withdrawBid,
  getAssetBidCompetition,
  getInvestorActiveBids,
} from '@/lib/marketplace/bidEngine'
import {
  computeMarketPrice,
  getZoneMarketPressure,
} from '@/lib/marketplace/priceDiscoveryEngine'
import {
  computeAssetLiquidity,
  generateMarketLiquidityReport,
} from '@/lib/marketplace/liquidityFormation'
import log from '@/lib/logger'

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Internal row shape for properties ───────────────────────────────────────

interface PropertyPriceRow {
  preco:   number | null
  zona:    string | null
  zone:    string | null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  try {
    const { searchParams } = new URL(req.url)
    const assetId    = searchParams.get('asset_id')
    const investorId = searchParams.get('investor_id')
    const zone       = searchParams.get('zone')
    const mode       = searchParams.get('mode')

    // GET ?mode=liquidity-report → full market liquidity report
    if (mode === 'liquidity-report') {
      const report = await generateMarketLiquidityReport(tenantId)
      return NextResponse.json({ ok: true, data: report })
    }

    // GET ?zone=xxx&mode=pressure → zone market pressure
    if (zone && mode === 'pressure') {
      const pressure = await getZoneMarketPressure(zone, tenantId)
      return NextResponse.json({ ok: true, data: pressure })
    }

    // GET ?asset_id=xxx&mode=liquidity → asset liquidity score
    if (assetId && mode === 'liquidity') {
      const listedPriceParam = searchParams.get('listed_price')
      let listedPrice = listedPriceParam ? parseInt(listedPriceParam, 10) : 0

      // If no price provided, resolve from properties table
      if (!listedPrice) {
        const { supabaseAdmin } = await import('@/lib/supabase')
        const db = supabaseAdmin as any
        const { data: propRow } = await (db
          .from('properties')
          .select('preco')
          .eq('id', assetId)
          .eq('tenant_id', tenantId)
          .single() as Promise<{ data: { preco: number | null } | null; error: unknown }>)
        listedPrice = propRow?.preco ?? 0
      }

      const liquidity = await computeAssetLiquidity(assetId, tenantId, listedPrice)
      return NextResponse.json({ ok: true, data: liquidity })
    }

    // GET ?investor_id=xxx → investor active bids
    if (investorId) {
      const bids = await getInvestorActiveBids(investorId, tenantId)
      return NextResponse.json({ ok: true, data: bids })
    }

    // GET ?asset_id=xxx → bid competition + market price
    if (assetId) {
      const competition = await getAssetBidCompetition(assetId, tenantId)

      // Resolve listed price and zone from properties table
      const { supabaseAdmin } = await import('@/lib/supabase')
      const db = supabaseAdmin as any
      const { data: propRow } = await (db
        .from('properties')
        .select('preco, zona, zone')
        .eq('id', assetId)
        .eq('tenant_id', tenantId)
        .single() as Promise<{ data: PropertyPriceRow | null; error: unknown }>)

      const listedPriceParam = searchParams.get('listed_price')
      const listedPrice = listedPriceParam
        ? parseInt(listedPriceParam, 10)
        : (propRow?.preco ?? 0)

      const zone = propRow?.zona ?? propRow?.zone ?? 'unknown'

      const marketPrice = await computeMarketPrice({
        asset_id:               assetId,
        tenant_id:              tenantId,
        listed_price_eur_cents: listedPrice,
        zone,
      })

      return NextResponse.json({
        ok:           true,
        competition,
        market_price: marketPrice,
      })
    }

    return NextResponse.json(
      { ok: false, error: 'Provide asset_id, investor_id, zone, or mode=liquidity-report' },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /marketplace/bids GET] error', { error: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = body['action'] as string | undefined

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'Missing action field (submit | accept | withdraw)' },
        { status: 400 },
      )
    }

    // ── action: submit ──────────────────────────────────────────────────────
    if (action === 'submit') {
      const assetId    = body['asset_id'] as string | undefined
      const investorId = body['investor_id'] as string | undefined
      const amount     = body['amount_eur_cents'] as number | undefined
      const maxAmount  = body['max_amount_eur_cents'] as number | undefined

      if (!assetId || !investorId || amount == null || maxAmount == null) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: asset_id, investor_id, amount_eur_cents, max_amount_eur_cents' },
          { status: 400 },
        )
      }

      if (typeof amount !== 'number' || typeof maxAmount !== 'number') {
        return NextResponse.json(
          { ok: false, error: 'amount_eur_cents and max_amount_eur_cents must be numbers' },
          { status: 400 },
        )
      }

      const bid = await submitBid({
        asset_id:             assetId,
        investor_id:          investorId,
        amount_eur_cents:     amount,
        max_amount_eur_cents: maxAmount,
        expires_hours:        body['expires_hours'] as number | undefined,
        notes:                body['notes'] as string | undefined,
        tenant_id:            tenantId,
      })

      return NextResponse.json({ ok: true, data: bid }, { status: 201 })
    }

    // ── action: accept (admin Bearer required) ──────────────────────────────
    if (action === 'accept') {
      // Require admin/tenant_admin role
      if (
        authResult.role !== 'tenant_admin' &&
        authResult.role !== 'admin' &&
        authResult.role !== 'super_admin'
      ) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden: admin Bearer required to accept bids' },
          { status: 403 },
        )
      }

      const bidId      = body['bid_id'] as string | undefined
      const acceptedBy = body['accepted_by'] as string | undefined

      if (!bidId || !acceptedBy) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: bid_id, accepted_by' },
          { status: 400 },
        )
      }

      const accepted = await acceptBid(bidId, acceptedBy, tenantId)
      return NextResponse.json({ ok: true, data: accepted })
    }

    // ── action: withdraw ────────────────────────────────────────────────────
    if (action === 'withdraw') {
      const bidId      = body['bid_id'] as string | undefined
      const investorId = body['investor_id'] as string | undefined

      if (!bidId || !investorId) {
        return NextResponse.json(
          { ok: false, error: 'Missing required fields: bid_id, investor_id' },
          { status: 400 },
        )
      }

      await withdrawBid(bidId, investorId, tenantId)
      return NextResponse.json({ ok: true, message: 'Bid withdrawn' })
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}. Use submit | accept | withdraw` },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /marketplace/bids POST] error', { error: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
