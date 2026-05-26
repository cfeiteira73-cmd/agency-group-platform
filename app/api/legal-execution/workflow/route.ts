// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Legal Execution Workflow API
// app/api/legal-execution/workflow/route.ts
//
// GET  /api/legal-execution/workflow                    → list active workflows
// GET  /api/legal-execution/workflow?workflow_id=xxx    → get workflow + docs + sigs
// GET  /api/legal-execution/workflow?deal_id=xxx        → get all workflows for deal
// GET  /api/legal-execution/workflow?mode=costs&value=N → compute legal costs
// POST /api/legal-execution/workflow                    → actions (admin Bearer required)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, extractBearerToken, safeCompare } from '@/lib/middleware/portalAuthGuard'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import {
  initiateLegalWorkflow,
  advanceLegalStage,
  blockWorkflow,
  getLegalWorkflow,
  getWorkflowsForDeal,
  computeLegalCosts,
} from '@/lib/legal-execution/legalExecutionPipeline'
import { requestNotaryAppointment } from '@/lib/legal-execution/notaryIntegration'
import { requestSignature, type SignatureLevel } from '@/lib/legal-execution/eIdasQesEngine'
import { getNotaryDocuments } from '@/lib/legal-execution/notaryIntegration'
import { getSignaturesForWorkflow } from '@/lib/legal-execution/eIdasQesEngine'

export const runtime     = 'nodejs'
export const maxDuration = 120

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Checks Bearer token against INTERNAL_API_TOKEN for admin-only actions */
function isAdminBearer(req: Request): boolean {
  const token = extractBearerToken(req)
  const secret = process.env.INTERNAL_API_TOKEN
  if (!token || !secret) return false
  return safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id

  try {
    const { searchParams } = new URL(req.url)
    const workflowId = searchParams.get('workflow_id')
    const dealId     = searchParams.get('deal_id')
    const mode       = searchParams.get('mode')
    const valueStr   = searchParams.get('value')

    // Mode: compute costs for a property value
    if (mode === 'costs') {
      if (!valueStr) {
        return NextResponse.json({ error: 'Missing required param: value (EUR cents)' }, { status: 400 })
      }
      const value = parseInt(valueStr, 10)
      if (isNaN(value) || value <= 0) {
        return NextResponse.json({ error: 'value must be a positive integer (EUR cents)' }, { status: 400 })
      }
      const costs = computeLegalCosts(value)
      return NextResponse.json({ success: true, data: costs })
    }

    // Mode: get specific workflow with documents and signatures
    if (workflowId) {
      const workflow = await getLegalWorkflow(workflowId, tenantId)
      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      const [documents, signatures] = await Promise.all([
        getNotaryDocuments(workflowId, tenantId),
        getSignaturesForWorkflow(workflowId, tenantId),
      ])

      return NextResponse.json({ success: true, data: { workflow, documents, signatures } })
    }

    // Mode: get all workflows for a deal
    if (dealId) {
      const workflows = await getWorkflowsForDeal(dealId, tenantId)
      return NextResponse.json({ success: true, data: workflows })
    }

    // Default: list active legal workflows for tenant
    const { data, error } = await (supabaseAdmin as any)
      .from('legal_workflows')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['ACTIVE', 'PENDING_EXTERNAL'])
      .order('started_at', { ascending: false })
      .limit(100)

    if (error) {
      log.warn('[API /legal-execution/workflow GET] list query failed', { error: error.message, tenant_id: tenantId })
      return NextResponse.json({ error: 'Failed to list workflows' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('[API /legal-execution/workflow GET] unhandled error', err instanceof Error ? err : new Error(msg), { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // All POST actions require admin Bearer token
  if (!isAdminBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized — admin Bearer required' }, { status: 401 })
  }

  // We still need tenant_id — get from auth result
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse
  const tenantId = authResult.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body['action'] ?? '')

  try {
    switch (action) {
      case 'initiate': {
        const dealId = body['deal_id']
        const pipelineId = body['pipeline_id'] ?? null
        const propertyValueEurCents = body['property_value_eur_cents']

        if (!dealId || typeof dealId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: deal_id' }, { status: 400 })
        }
        if (typeof propertyValueEurCents !== 'number' || propertyValueEurCents <= 0) {
          return NextResponse.json({ error: 'Missing or invalid field: property_value_eur_cents (must be positive integer)' }, { status: 400 })
        }

        const workflow = await initiateLegalWorkflow(
          dealId,
          typeof pipelineId === 'string' ? pipelineId : null,
          propertyValueEurCents,
          tenantId,
        )
        return NextResponse.json({ success: true, data: workflow }, { status: 201 })
      }

      case 'advance': {
        const workflowId   = body['workflow_id']
        const externalRef  = body['external_ref']
        const signatureIds = body['signature_ids']

        if (!workflowId || typeof workflowId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: workflow_id' }, { status: 400 })
        }
        if (!externalRef || typeof externalRef !== 'string') {
          return NextResponse.json({ error: 'Missing required field: external_ref' }, { status: 400 })
        }

        const sigIds = Array.isArray(signatureIds) ? (signatureIds as string[]) : undefined
        const updated = await advanceLegalStage(workflowId, tenantId, externalRef, sigIds)
        return NextResponse.json({ success: true, data: updated })
      }

      case 'block': {
        const workflowId = body['workflow_id']
        const reason     = body['reason']

        if (!workflowId || typeof workflowId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: workflow_id' }, { status: 400 })
        }
        if (!reason || typeof reason !== 'string') {
          return NextResponse.json({ error: 'Missing required field: reason' }, { status: 400 })
        }

        await blockWorkflow(workflowId, tenantId, reason)
        return NextResponse.json({ success: true, message: 'Workflow blocked' })
      }

      case 'request-notary': {
        const workflowId    = body['workflow_id']
        const preferredDate = body['preferred_date']

        if (!workflowId || typeof workflowId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: workflow_id' }, { status: 400 })
        }
        if (!preferredDate || typeof preferredDate !== 'string') {
          return NextResponse.json({ error: 'Missing required field: preferred_date' }, { status: 400 })
        }

        const appointment = await requestNotaryAppointment(workflowId, tenantId, preferredDate)
        return NextResponse.json({ success: true, data: appointment }, { status: 201 })
      }

      case 'request-signature': {
        const workflowId  = body['workflow_id']
        const documentId  = body['document_id']
        const signerId    = body['signer_id']
        const signerEmail = body['signer_email']
        const level       = body['level']

        if (!workflowId || typeof workflowId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: workflow_id' }, { status: 400 })
        }
        if (!documentId || typeof documentId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: document_id' }, { status: 400 })
        }
        if (!signerId || typeof signerId !== 'string') {
          return NextResponse.json({ error: 'Missing required field: signer_id' }, { status: 400 })
        }
        if (!signerEmail || typeof signerEmail !== 'string') {
          return NextResponse.json({ error: 'Missing required field: signer_email' }, { status: 400 })
        }
        if (!level || !['SES', 'AES', 'QES'].includes(String(level))) {
          return NextResponse.json({ error: 'Missing or invalid field: level (SES | AES | QES)' }, { status: 400 })
        }

        const sigRequest = await requestSignature(
          workflowId,
          documentId,
          signerId,
          signerEmail,
          level as SignatureLevel,
          tenantId,
        )
        return NextResponse.json({ success: true, data: sigRequest }, { status: 201 })
      }

      default:
        return NextResponse.json({ error: `Unknown action: '${action}'` }, { status: 400 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('[API /legal-execution/workflow POST] unhandled error', err instanceof Error ? err : new Error(msg), { action, tenant_id: tenantId })
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}
