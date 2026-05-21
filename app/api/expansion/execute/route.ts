// Agency Group — Expansion Execute API
// app/api/expansion/execute/route.ts
//
// GET  ?mode=network-effect        → generateNetworkEffectReport
// GET  ?mode=amplification-actions → getAmplificationActions
// GET  ?mode=active-expansions     → getActiveExpansions
// GET  ?plan_id=xxx                → getExpansionProgress
// GET  ?mode=migration-metrics     → getMigrationMetrics
//
// POST { action: 'create-expansion', country, city }      → createExpansionPlan      (admin)
// POST { action: 'execute-phase', plan_id }               → executeExpansionPhase     (admin)
// POST { action: 'launch-migration', target_market, target_segment } → launchMigrationCampaign (admin)
// POST { action: 'identify-migrants' }                    → identifyMigrationCandidates (admin)
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  safeCompare,
  extractBearerToken,
} from '@/lib/middleware/portalAuthGuard'
import log from '@/lib/logger'
import {
  generateNetworkEffectReport,
  getAmplificationActions,
} from '@/lib/expansion/networkEffectAmplifier'
import {
  createExpansionPlan,
  executeExpansionPhase,
  getActiveExpansions,
  getExpansionProgress,
} from '@/lib/expansion/expansionExecutionEngine'
import {
  identifyMigrationCandidates,
  launchMigrationCampaign,
  getMigrationMetrics,
} from '@/lib/expansion/investorMigrationEngine'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Tenant helper ─────────────────────────────────────────────────────────

const CANONICAL_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Admin Bearer check ────────────────────────────────────────────────────

function isAdminBearer(req: NextRequest): boolean {
  const token = extractBearerToken(req)
  if (!token) return false
  const adminToken = process.env.INTERNAL_API_TOKEN
  const cronSecret = process.env.CRON_SECRET
  if (adminToken && safeCompare(token, adminToken)) return true
  if (cronSecret && safeCompare(token, cronSecret)) return true
  return false
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id ?? CANONICAL_TENANT_ID

  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const planId = searchParams.get('plan_id')

    // GET ?plan_id=xxx
    if (planId) {
      const progress = await getExpansionProgress(planId, tenantId)
      return NextResponse.json({ success: true, data: progress })
    }

    // GET ?mode=network-effect
    if (mode === 'network-effect') {
      const report = await generateNetworkEffectReport(tenantId)
      return NextResponse.json({ success: true, data: report })
    }

    // GET ?mode=amplification-actions
    if (mode === 'amplification-actions') {
      const actions = await getAmplificationActions(tenantId)
      return NextResponse.json({ success: true, data: actions })
    }

    // GET ?mode=active-expansions
    if (mode === 'active-expansions') {
      const expansions = await getActiveExpansions(tenantId)
      return NextResponse.json({ success: true, data: expansions })
    }

    // GET ?mode=migration-metrics
    if (mode === 'migration-metrics') {
      const metrics = await getMigrationMetrics(tenantId)
      return NextResponse.json({ success: true, data: metrics })
    }

    return NextResponse.json(
      {
        error: 'Provide mode or plan_id query parameter',
        supported_modes: [
          'network-effect',
          'amplification-actions',
          'active-expansions',
          'migration-metrics',
        ],
      },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /expansion/execute GET] error', { error: msg, tenant_id: CANONICAL_TENANT_ID })
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Admin Bearer required for all POST actions
  if (!isAdminBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized — admin Bearer required' }, { status: 401 })
  }

  const tenantId = CANONICAL_TENANT_ID

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = body.action as string | undefined

    if (!action) {
      return NextResponse.json({ error: 'Missing action in request body' }, { status: 400 })
    }

    // POST { action: 'create-expansion', country, city }
    if (action === 'create-expansion') {
      const country = body.country as string | undefined
      const city = body.city as string | undefined
      if (!country || !city) {
        return NextResponse.json(
          { error: 'create-expansion requires country and city' },
          { status: 400 },
        )
      }
      const plan = await createExpansionPlan(country, city, tenantId)
      log.info('[API /expansion/execute POST] expansion plan created', {
        plan_id: plan.plan_id,
        country,
        city,
        tenant_id: tenantId,
      })
      return NextResponse.json({ success: true, data: plan }, { status: 201 })
    }

    // POST { action: 'execute-phase', plan_id }
    if (action === 'execute-phase') {
      const plan_id = body.plan_id as string | undefined
      if (!plan_id) {
        return NextResponse.json(
          { error: 'execute-phase requires plan_id' },
          { status: 400 },
        )
      }
      const plan = await executeExpansionPhase(plan_id, tenantId)
      log.info('[API /expansion/execute POST] expansion phase executed', {
        plan_id,
        phase: plan.phase,
        tenant_id: tenantId,
      })
      return NextResponse.json({ success: true, data: plan })
    }

    // POST { action: 'launch-migration', target_market, target_segment }
    if (action === 'launch-migration') {
      const target_market = body.target_market as string | undefined
      const target_segment = body.target_segment as string | undefined
      if (!target_market || !target_segment) {
        return NextResponse.json(
          { error: 'launch-migration requires target_market and target_segment' },
          { status: 400 },
        )
      }
      const campaign = await launchMigrationCampaign(target_market, target_segment, tenantId)
      log.info('[API /expansion/execute POST] migration campaign launched', {
        campaign_id: campaign.campaign_id,
        target_market,
        target_segment,
        tenant_id: tenantId,
      })
      return NextResponse.json({ success: true, data: campaign }, { status: 201 })
    }

    // POST { action: 'identify-migrants' }
    if (action === 'identify-migrants') {
      const opportunities = await identifyMigrationCandidates(tenantId)
      log.info('[API /expansion/execute POST] migration candidates identified', {
        count: opportunities.length,
        tenant_id: tenantId,
      })
      return NextResponse.json({ success: true, data: opportunities })
    }

    return NextResponse.json(
      {
        error: `Unknown action: ${action}`,
        supported_actions: [
          'create-expansion',
          'execute-phase',
          'launch-migration',
          'identify-migrants',
        ],
      },
      { status: 400 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[API /expansion/execute POST] error', { error: msg, tenant_id: CANONICAL_TENANT_ID })
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 500 })
  }
}
