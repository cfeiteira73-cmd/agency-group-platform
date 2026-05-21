// Agency Group — KYC/AML Compliance API Route
// app/api/compliance/kyc/route.ts
// TypeScript strict — 0 errors

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import log from '@/lib/logger'
import {
  requireAuth,
  safeCompare,
  extractBearerToken,
} from '@/lib/middleware/portalAuthGuard'
import {
  initializeKyc,
  updateKycStatus,
  getKycRecord,
  listPendingKyc,
  type KycStatus,
  type InvestorType,
} from '@/lib/compliance/investorKyc'
import {
  runAmlScreening,
  getLatestScreening,
} from '@/lib/compliance/amlScreening'
import {
  validateBidEligibility,
} from '@/lib/compliance/investorSegmentation'
import {
  generateComplianceReport,
  verifyChainIntegrity,
} from '@/lib/compliance/regulatoryAuditTrail'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Admin Bearer check ───────────────────────────────────────────────────────

function isAdminBearer(req: NextRequest): boolean {
  const token = extractBearerToken(req as unknown as Request)
  if (!token) return false
  const internalToken = process.env.INTERNAL_API_TOKEN
  if (!internalToken) return false
  return safeCompare(token, internalToken)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req as unknown as Request)
  if (authResult instanceof Response) return authResult as unknown as NextResponse

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')
  const investorId = searchParams.get('investor_id')

  try {
    // GET ?mode=pending — pending KYC queue + HIGH AML results
    if (mode === 'pending') {
      const pendingKyc = await listPendingKyc(tenantId)

      // Fetch HIGH-risk AML screenings
      const { data: amlHighData } = await (supabaseAdmin as any)
        .from('aml_screening_results')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('risk_level', ['HIGH', 'PROHIBITED'])
        .order('screened_at', { ascending: false })

      return NextResponse.json({
        pending_kyc: pendingKyc,
        high_risk_aml: amlHighData ?? [],
      })
    }

    // GET ?mode=audit-report&from=YYYY-MM-DD&to=YYYY-MM-DD
    if (mode === 'audit-report') {
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      if (!from || !to) {
        return NextResponse.json(
          { error: 'Missing from/to query params' },
          { status: 400 },
        )
      }
      const report = await generateComplianceReport(tenantId, from, to)
      return NextResponse.json({ report })
    }

    // GET ?mode=chain-integrity
    if (mode === 'chain-integrity') {
      const result = await verifyChainIntegrity(tenantId, 100)
      return NextResponse.json({ chain_integrity: result })
    }

    // GET ?investor_id=xxx — KYC record + latest AML + eligibility summary
    if (investorId) {
      const [kycRecord, amlScreening] = await Promise.all([
        getKycRecord(investorId, tenantId),
        getLatestScreening(investorId, tenantId),
      ])

      const eligibilitySummary = kycRecord
        ? {
            kyc_status: kycRecord.status,
            aml_cleared: kycRecord.aml_cleared,
            risk_score: kycRecord.risk_score,
            is_pep: kycRecord.is_pep,
            investor_type: kycRecord.investor_type,
            aml_risk_level: amlScreening?.risk_level ?? null,
            aml_recommended_action: amlScreening?.recommended_action ?? null,
          }
        : null

      return NextResponse.json({
        kyc_record: kycRecord,
        aml_screening: amlScreening,
        eligibility_summary: eligibilitySummary,
      })
    }

    return NextResponse.json(
      { error: 'Provide investor_id or mode parameter' },
      { status: 400 },
    )
  } catch (err) {
    log.error('[api/compliance/kyc] GET error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body['action'] ?? '')
  const tenantId = DEFAULT_TENANT_ID

  try {
    // ── initialize-kyc ──────────────────────────────────────────────────────
    if (action === 'initialize-kyc') {
      const authResult = await requireAuth(req as unknown as Request)
      if (authResult instanceof Response) return authResult as unknown as NextResponse

      const investor_id = String(body['investor_id'] ?? '')
      const investor_type = String(body['investor_type'] ?? 'RETAIL') as InvestorType
      const jurisdiction = String(body['jurisdiction'] ?? '')
      const country_of_residence = String(body['country_of_residence'] ?? '')

      if (!investor_id || !jurisdiction || !country_of_residence) {
        return NextResponse.json(
          { error: 'investor_id, jurisdiction, country_of_residence are required' },
          { status: 400 },
        )
      }

      const record = await initializeKyc(
        investor_id,
        tenantId,
        investor_type,
        jurisdiction,
        country_of_residence,
      )

      return NextResponse.json({ kyc_record: record }, { status: 201 })
    }

    // ── update-kyc ──────────────────────────────────────────────────────────
    if (action === 'update-kyc') {
      if (!isAdminBearer(req)) {
        return NextResponse.json({ error: 'Admin Bearer required' }, { status: 403 })
      }

      const investor_id = String(body['investor_id'] ?? '')
      const status = String(body['status'] ?? '') as KycStatus
      const provider_ref = body['provider_ref'] != null ? String(body['provider_ref']) : null
      const notes = String(body['notes'] ?? '')

      if (!investor_id || !status) {
        return NextResponse.json(
          { error: 'investor_id and status are required' },
          { status: 400 },
        )
      }

      const record = await updateKycStatus(
        investor_id,
        tenantId,
        status,
        provider_ref,
        notes,
      )

      return NextResponse.json({ kyc_record: record })
    }

    // ── run-aml ─────────────────────────────────────────────────────────────
    if (action === 'run-aml') {
      if (!isAdminBearer(req)) {
        return NextResponse.json({ error: 'Admin Bearer required' }, { status: 403 })
      }

      const investor_id = String(body['investor_id'] ?? '')
      const jurisdiction = String(body['jurisdiction'] ?? '')
      const country_of_residence = String(body['country_of_residence'] ?? '')
      const investor_name = String(body['investor_name'] ?? '')

      if (!investor_id || !jurisdiction || !country_of_residence || !investor_name) {
        return NextResponse.json(
          { error: 'investor_id, jurisdiction, country_of_residence, investor_name are required' },
          { status: 400 },
        )
      }

      const result = await runAmlScreening(
        investor_id,
        tenantId,
        jurisdiction,
        country_of_residence,
        investor_name,
      )

      return NextResponse.json({ aml_screening: result }, { status: 201 })
    }

    // ── check-eligibility ───────────────────────────────────────────────────
    if (action === 'check-eligibility') {
      const authResult = await requireAuth(req as unknown as Request)
      if (authResult instanceof Response) return authResult as unknown as NextResponse

      const investor_id = String(body['investor_id'] ?? '')
      const bid_amount_eur_cents = Number(body['bid_amount_eur_cents'] ?? 0)
      const asset_class = String(body['asset_class'] ?? 'residential')
      const is_cross_border = Boolean(body['is_cross_border'])

      if (!investor_id || bid_amount_eur_cents <= 0) {
        return NextResponse.json(
          { error: 'investor_id and bid_amount_eur_cents > 0 are required' },
          { status: 400 },
        )
      }

      const result = await validateBidEligibility(
        investor_id,
        tenantId,
        bid_amount_eur_cents,
        asset_class,
        is_cross_border,
      )

      return NextResponse.json({ eligibility: result })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    log.error('[api/compliance/kyc] POST error', err, { action })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
