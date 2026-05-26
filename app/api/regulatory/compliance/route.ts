// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Regulatory Compliance API Route v1.0
// app/api/regulatory/compliance/route.ts
//
// GET: compliance reports, assessments, audit engagements, evidence packages
// POST: record evidence, classify investor, create engagement, generate packages
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, extractBearerToken, safeCompare } from '@/lib/middleware/portalAuthGuard'
import {
  getLatestComplianceReport,
  runFullComplianceAssessment,
  assessMiFIDCompliance,
  assessAMLCompliance,
  assessGDPRCompliance,
  recordComplianceEvidence,
} from '@/lib/regulatory/regulatoryComplianceCore'
import {
  classifyInvestor,
  generateBestExecutionReport,
} from '@/lib/regulatory/mifidAlignmentEngine'
import {
  createAuditEngagement,
  getActiveEngagements,
  type AuditorFirm,
  type AuditEngagement,
} from '@/lib/regulatory/externalAuditHooks'
import {
  generateAMLEvidencePackage,
  generateMiFIDEvidencePackage,
  getLatestEvidencePackage,
  type ComplianceEvidencePackage,
} from '@/lib/regulatory/complianceEvidenceGenerator'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Admin Bearer check ───────────────────────────────────────────────────────

function isAdminBearer(req: NextRequest): boolean {
  const token = extractBearerToken(req)
  if (!token) return false
  const secret = process.env.INTERNAL_API_TOKEN ?? process.env.INTERNAL_API_SECRET
  if (!secret) return false
  return safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id
  const mode = req.nextUrl.searchParams.get('mode') ?? 'default'

  try {
    switch (mode) {
      case 'full-assessment': {
        const report = await runFullComplianceAssessment(tenantId)
        return NextResponse.json({ report })
      }

      case 'mifid': {
        const periodStart = req.nextUrl.searchParams.get('period_start')
          ? new Date(req.nextUrl.searchParams.get('period_start')!)
          : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        const periodEnd = req.nextUrl.searchParams.get('period_end')
          ? new Date(req.nextUrl.searchParams.get('period_end')!)
          : new Date()

        const [checks, bestExecution] = await Promise.all([
          assessMiFIDCompliance(tenantId),
          generateBestExecutionReport(tenantId, periodStart, periodEnd),
        ])
        return NextResponse.json({ checks, best_execution: bestExecution })
      }

      case 'aml': {
        const checks = await assessAMLCompliance(tenantId)
        return NextResponse.json({ checks })
      }

      case 'gdpr': {
        const checks = await assessGDPRCompliance(tenantId)
        return NextResponse.json({ checks })
      }

      case 'audit-engagements': {
        const engagements = await getActiveEngagements(tenantId)
        return NextResponse.json({ engagements })
      }

      case 'evidence': {
        const packageType = (req.nextUrl.searchParams.get('type') ?? 'AML_ANNUAL') as ComplianceEvidencePackage['package_type']
        const pkg = await getLatestEvidencePackage(tenantId, packageType)
        return NextResponse.json({ package: pkg })
      }

      default: {
        const report = await getLatestComplianceReport(tenantId)
        return NextResponse.json({ report })
      }
    }
  } catch (err) {
    log.error('[regulatory/compliance GET] error', err as Error, { mode, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse
  const tenantId = authResult.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined
  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 })
  }

  try {
    switch (action) {
      case 'record-evidence': {
        const { control_id, evidence_type, evidence_ref, description } = body as {
          control_id: string
          evidence_type: string
          evidence_ref: string
          description: string
        }
        if (!control_id || !evidence_type || !evidence_ref || !description) {
          return NextResponse.json({ error: 'Missing required fields: control_id, evidence_type, evidence_ref, description' }, { status: 400 })
        }
        await recordComplianceEvidence(tenantId, control_id, evidence_type, evidence_ref, description)
        return NextResponse.json({ ok: true })
      }

      case 'classify-investor': {
        const { investor_id, portfolio_value_eur_cents, professional_experience_years } = body as {
          investor_id: string
          portfolio_value_eur_cents: number
          professional_experience_years?: number
        }
        if (!investor_id || portfolio_value_eur_cents == null) {
          return NextResponse.json({ error: 'Missing required fields: investor_id, portfolio_value_eur_cents' }, { status: 400 })
        }
        const classification = await classifyInvestor(
          investor_id,
          tenantId,
          portfolio_value_eur_cents,
          professional_experience_years,
        )
        return NextResponse.json({ classification })
      }

      case 'create-engagement': {
        const { firm, audit_type, scope } = body as {
          firm: AuditorFirm
          audit_type: AuditEngagement['audit_type']
          scope: string[]
        }
        if (!firm || !audit_type || !Array.isArray(scope)) {
          return NextResponse.json({ error: 'Missing required fields: firm, audit_type, scope' }, { status: 400 })
        }
        const engagement = await createAuditEngagement(tenantId, firm, audit_type, scope)
        return NextResponse.json({ engagement })
      }

      case 'generate-aml-package': {
        const { period_start, period_end } = body as {
          period_start: string
          period_end: string
        }
        if (!period_start || !period_end) {
          return NextResponse.json({ error: 'Missing required fields: period_start, period_end' }, { status: 400 })
        }
        const pkg = await generateAMLEvidencePackage(
          tenantId,
          new Date(period_start),
          new Date(period_end),
        )
        return NextResponse.json({ package: pkg })
      }

      case 'generate-mifid-package': {
        const { period_start, period_end } = body as {
          period_start: string
          period_end: string
        }
        if (!period_start || !period_end) {
          return NextResponse.json({ error: 'Missing required fields: period_start, period_end' }, { status: 400 })
        }
        const pkg = await generateMiFIDEvidencePackage(
          tenantId,
          new Date(period_start),
          new Date(period_end),
        )
        return NextResponse.json({ package: pkg })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    log.error('[regulatory/compliance POST] error', err as Error, { action, tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
