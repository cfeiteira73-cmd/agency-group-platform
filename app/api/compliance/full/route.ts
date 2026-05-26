// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Compliance Full API Route v1.0
// app/api/compliance/full/route.ts
//
// Unified endpoint for GDPR, AML/KYC, Tax Engine, and Audit Trail operations.
// GET:  mode query param to fetch dashboards and logs
// POST: Bearer-authenticated actions for compliance operations
//
// TypeScript strict — 0 errors
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import {
  getGdprDashboard,
  submitGdprRequest,
  processErasureRequest,
  exportPersonalData,
  runRetentionPurge,
  type GdprRequestType,
} from '@/lib/compliance/gdprFullEngine'
import {
  getKycSummary,
  initiateKyc,
  type KycRecord,
} from '@/lib/compliance/amlKycEngine'
import {
  computeTotalAcquisitionCost,
  recordTaxAssessment,
  type PropertyCategory,
  type AcquisitionType,
} from '@/lib/compliance/taxEnginePtEs'
import {
  getAuditLog,
  verifyChainIntegrity,
  appendAuditEntryFire,
  type AuditAction,
} from '@/lib/compliance/immutableAuditTrail'

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(req: NextRequest): boolean {
  const token = extractBearer(req)
  if (!token) return false
  const expected = process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET
  if (!expected) return false
  return safeCompare(token, expected)
}

function ip(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'summary'

  try {
    switch (mode) {
      case 'gdpr-dashboard': {
        const dashboard = await getGdprDashboard(TENANT_ID)
        return NextResponse.json({ ok: true, gdpr_dashboard: dashboard })
      }

      case 'kyc-summary': {
        const summary = await getKycSummary(TENANT_ID)
        return NextResponse.json({ ok: true, kyc_summary: summary })
      }

      case 'audit-log': {
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
        const actorId = searchParams.get('actor_id') ?? undefined
        const action = searchParams.get('action') as AuditAction | undefined
        const resourceId = searchParams.get('resource_id') ?? undefined
        const from = searchParams.get('from') ?? undefined
        const to = searchParams.get('to') ?? undefined

        const entries = await getAuditLog(
          TENANT_ID,
          { actor_id: actorId, action, resource_id: resourceId, from, to },
          limit,
        )
        return NextResponse.json({ ok: true, entries, count: entries.length })
      }

      case 'chain-verify': {
        const fromSeq = searchParams.get('from_sequence')
          ? parseInt(searchParams.get('from_sequence')!, 10)
          : undefined
        const limit = parseInt(searchParams.get('limit') ?? '500', 10)
        const result = await verifyChainIntegrity(TENANT_ID, fromSeq, limit)
        return NextResponse.json({ ok: true, integrity: result })
      }

      case 'summary':
      default: {
        const [gdpr, kyc] = await Promise.all([
          getGdprDashboard(TENANT_ID),
          getKycSummary(TENANT_ID),
        ])
        return NextResponse.json({
          ok: true,
          summary: {
            gdpr,
            kyc,
            generated_at: new Date().toISOString(),
          },
        })
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compliance/full] GET error', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body['action'] as string | undefined
  if (!action) {
    return NextResponse.json({ ok: false, error: 'Missing action' }, { status: 400 })
  }

  const clientIp = ip(req)

  try {
    // ── GDPR: submit-gdpr ─────────────────────────────────────────────────────
    if (action === 'submit-gdpr') {
      const subjectId    = String(body['subject_id'] ?? '')
      const subjectEmail = String(body['subject_email'] ?? '')
      const type         = String(body['type'] ?? 'ACCESS') as GdprRequestType
      const legalBasis   = String(body['legal_basis'] ?? 'GDPR Art 17')

      if (!subjectId || !subjectEmail) {
        return NextResponse.json({ ok: false, error: 'subject_id and subject_email required' }, { status: 400 })
      }

      const request = await submitGdprRequest(subjectId, subjectEmail, type, legalBasis, TENANT_ID)

      appendAuditEntryFire({
        tenant_id:    TENANT_ID,
        action:       'GDPR_REQUEST_RECEIVED',
        actor_id:     subjectId,
        actor_type:   'USER',
        resource_type:'gdpr_request',
        resource_id:  request.request_id,
        metadata:     { type, subjectEmail },
        ip_address:   clientIp,
      })

      return NextResponse.json({ ok: true, request })
    }

    // ── GDPR: process-erasure ─────────────────────────────────────────────────
    if (action === 'process-erasure') {
      const requestId = String(body['request_id'] ?? '')
      if (!requestId) {
        return NextResponse.json({ ok: false, error: 'request_id required' }, { status: 400 })
      }

      const result = await processErasureRequest(requestId)

      appendAuditEntryFire({
        tenant_id:    TENANT_ID,
        action:       'GDPR_ERASURE_COMPLETED',
        actor_id:     'system',
        actor_type:   'SYSTEM',
        resource_type:'gdpr_request',
        resource_id:  requestId,
        metadata:     result,
        ip_address:   clientIp,
      })

      return NextResponse.json({ ok: true, result })
    }

    // ── GDPR: export-data ─────────────────────────────────────────────────────
    if (action === 'export-data') {
      const subjectId = String(body['subject_id'] ?? '')
      if (!subjectId) {
        return NextResponse.json({ ok: false, error: 'subject_id required' }, { status: 400 })
      }

      const exportMeta = await exportPersonalData(subjectId, TENANT_ID)

      appendAuditEntryFire({
        tenant_id:    TENANT_ID,
        action:       'DATA_EXPORTED',
        actor_id:     subjectId,
        actor_type:   'USER',
        resource_type:'gdpr_portability_export',
        resource_id:  exportMeta.export_id,
        metadata:     exportMeta,
        ip_address:   clientIp,
      })

      return NextResponse.json({ ok: true, export: exportMeta })
    }

    // ── GDPR: run-retention-purge ─────────────────────────────────────────────
    if (action === 'run-retention-purge') {
      const result = await runRetentionPurge(TENANT_ID)

      appendAuditEntryFire({
        tenant_id:    TENANT_ID,
        action:       'CONFIG_CHANGED',
        actor_id:     'cron',
        actor_type:   'CRON',
        resource_type:'retention_purge',
        resource_id:  TENANT_ID,
        metadata:     result,
        ip_address:   clientIp,
      })

      return NextResponse.json({ ok: true, result })
    }

    // ── KYC: initiate-kyc ─────────────────────────────────────────────────────
    if (action === 'initiate-kyc') {
      const subjectId          = String(body['subject_id'] ?? '')
      const subjectType        = String(body['subject_type'] ?? 'BUYER') as KycRecord['subject_type']
      const nationality        = String(body['nationality'] ?? '')
      const countryOfResidence = String(body['country_of_residence'] ?? '')

      if (!subjectId || !nationality) {
        return NextResponse.json({ ok: false, error: 'subject_id and nationality required' }, { status: 400 })
      }

      const record = await initiateKyc(subjectId, subjectType, nationality, countryOfResidence, TENANT_ID)

      appendAuditEntryFire({
        tenant_id:    TENANT_ID,
        action:       'KYC_INITIATED',
        actor_id:     subjectId,
        actor_type:   'USER',
        resource_type:'kyc_record',
        resource_id:  record.kyc_id,
        metadata:     { subjectType, nationality, provider: record.provider },
        ip_address:   clientIp,
      })

      return NextResponse.json({ ok: true, record })
    }

    // ── Tax: compute-tax ──────────────────────────────────────────────────────
    if (action === 'compute-tax') {
      const salePriceCentsRaw = body['sale_price_cents']
      if (!salePriceCentsRaw) {
        return NextResponse.json({ ok: false, error: 'sale_price_cents required' }, { status: 400 })
      }

      const salePriceCents    = BigInt(String(salePriceCentsRaw))
      const country           = String(body['country'] ?? 'PT') as 'PT' | 'ES'
      const category          = String(body['category'] ?? 'RESIDENTIAL') as PropertyCategory
      const acquisitionType   = String(body['acquisition_type'] ?? 'RESALE') as AcquisitionType
      const region            = String(body['region'] ?? 'DEFAULT')
      const isHabitacaoPropria = body['is_habitacao_propria'] !== false

      const result = computeTotalAcquisitionCost(salePriceCents, country, {
        category,
        acquisitionType,
        region,
        isHabitacaoPropria,
      })

      // Serialize bigints for JSON
      const serialized = JSON.parse(JSON.stringify(result, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      )) as Record<string, unknown>

      // Optionally record assessment
      const transactionId = String(body['transaction_id'] ?? '')
      if (transactionId) {
        void recordTaxAssessment(transactionId, result.tax_breakdown, TENANT_ID)
      }

      return NextResponse.json({ ok: true, tax_analysis: serialized })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compliance/full] POST error', { action, error: msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
