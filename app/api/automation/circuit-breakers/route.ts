// Agency Group — Circuit Breakers & Automation Health API
// app/api/automation/circuit-breakers/route.ts
// GET  — all circuit states (portal auth)
// GET  ?mode=provider-health — provider health statuses
// GET  ?mode=ml-health — ML pipeline healing report
// POST { action: 'reset', circuit_name: string } — admin override (INTERNAL_API_SECRET)

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/middleware/portalAuthGuard'
import { getAllCircuits, resetCircuit } from '@/lib/automation/circuitBreaker'
import { getProviderHealth } from '@/lib/automation/providerFallback'
import { checkMLPipelineHealth } from '@/lib/automation/mlPipelineHealer'
import { timingSafeEqual } from 'crypto'
import log from '@/lib/logger'

// ─── Tenant helper ─────────────────────────────────────────────────────────────

function getTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ─── Admin Bearer check ───────────────────────────────────────────────────────

function isAdminBearer(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (token.length === 0) return false
  const bufA = Buffer.from(token)
  const bufB = Buffer.from(secret)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await authenticatePortalRequest(req)

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.denial_reason ?? 'Unauthorized' },
      { status: 401 },
    )
  }

  const tenantId = getTenantId()
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')

  try {
    // Provider health
    if (mode === 'provider-health') {
      const health = await getProviderHealth(tenantId)
      return NextResponse.json({
        ok: true,
        tenant_id: tenantId,
        provider_health: health,
        generated_at: new Date().toISOString(),
      })
    }

    // ML pipeline health
    if (mode === 'ml-health') {
      const report = await checkMLPipelineHealth(tenantId)
      return NextResponse.json({
        ok: true,
        ...report,
      })
    }

    // Default: all circuit states
    const circuits = await getAllCircuits(tenantId)
    return NextResponse.json({
      ok: true,
      tenant_id: tenantId,
      circuits,
      total: circuits.length,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.info('[circuit-breakers GET] error', { error: message, mode })
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 })
  }
}

// ─── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  // Admin-only: requires INTERNAL_API_SECRET Bearer
  if (!isAdminBearer(req)) {
    return NextResponse.json({ error: 'Forbidden — admin Bearer required' }, { status: 403 })
  }

  let body: { action?: string; circuit_name?: string }

  try {
    body = (await req.json()) as { action?: string; circuit_name?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action !== 'reset') {
    return NextResponse.json({ error: 'Unsupported action — only "reset" is allowed' }, { status: 400 })
  }

  if (!body.circuit_name || typeof body.circuit_name !== 'string') {
    return NextResponse.json({ error: 'circuit_name is required' }, { status: 400 })
  }

  const tenantId = getTenantId()

  try {
    await resetCircuit(body.circuit_name, tenantId)

    log.info('[circuit-breakers POST] circuit reset', {
      circuit_name: body.circuit_name,
      tenant_id: tenantId,
    })

    return NextResponse.json({
      ok: true,
      message: `Circuit '${body.circuit_name}' reset to CLOSED`,
      circuit_name: body.circuit_name,
      tenant_id: tenantId,
      reset_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.info('[circuit-breakers POST] reset error', { error: message, circuit_name: body.circuit_name })
    return NextResponse.json({ error: 'Reset failed', detail: message }, { status: 500 })
  }
}
