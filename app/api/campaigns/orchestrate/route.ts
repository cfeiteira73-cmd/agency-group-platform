// Agency Group — Campaign Orchestration API Route
// app/api/campaigns/orchestrate/route.ts
// GET: stats, active campaigns, deliverability
// POST: create, enroll, enroll-segment, run-triggers, process-sends, pause

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import {
  requireAuth,
  safeCompare,
  extractBearerToken,
} from '@/lib/middleware/portalAuthGuard'
import {
  createCampaign,
  enrollInvestor,
  bulkEnrollSegment,
  getCampaignStats,
  pauseCampaign,
  getActiveCampaigns,
  type CampaignStatus,
  type CampaignTriggerType,
  type CampaignStep,
} from '@/lib/campaigns/campaignOrchestrator'
import { runAllTriggers } from '@/lib/campaigns/triggerEngine'
import {
  processPendingJobs,
  getDeliverabilityStats,
} from '@/lib/campaigns/channelRouter'
import log from '@/lib/logger'

// ─── Tenant resolution ────────────────────────────────────────────────────────

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const campaignId = url.searchParams.get('campaign_id')
  const mode = url.searchParams.get('mode')
  const windowDays = parseInt(url.searchParams.get('window_days') ?? '30', 10)

  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  try {
    // GET ?campaign_id=xxx
    if (campaignId) {
      const stats = await getCampaignStats(campaignId, tenantId)
      return NextResponse.json({ ok: true, data: stats })
    }

    // GET ?mode=active
    if (mode === 'active') {
      const campaigns = await getActiveCampaigns(tenantId)
      return NextResponse.json({ ok: true, data: campaigns, count: campaigns.length })
    }

    // GET ?mode=deliverability
    if (mode === 'deliverability') {
      const stats = await getDeliverabilityStats(tenantId, windowDays)
      return NextResponse.json({ ok: true, data: stats })
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Provide campaign_id or mode=active|deliverability',
      },
      { status: 400 },
    )
  } catch (e: unknown) {
    log.error('[campaigns/orchestrate] GET error', e, { mode, campaign_id: campaignId })
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  // Admin Bearer check for mutation operations
  const token = extractBearerToken(req)
  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret = process.env.CRON_SECRET

  const isAdmin =
    (internalToken && token && safeCompare(token, internalToken)) ||
    (cronSecret && token && safeCompare(token, cronSecret)) ||
    authResult.role === 'tenant_admin' ||
    authResult.role === 'admin' ||
    authResult.role === 'super_admin'

  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: admin Bearer required' },
      { status: 403 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string | undefined

  try {
    // ── create ──────────────────────────────────────────────────────────────
    if (action === 'create') {
      const campaign = await createCampaign(
        {
          tenant_id: tenantId,
          name: body.name as string,
          status: (body.status as CampaignStatus) ?? 'DRAFT',
          trigger_type: body.trigger_type as CampaignTriggerType,
          target_segments: (body.target_segments as string[]) ?? [],
          channels: (body.channels as string[]) ?? [],
          message_template_id: (body.message_template_id as string | null) ?? null,
          trigger_conditions:
            (body.trigger_conditions as Record<string, unknown>) ?? {},
          sequence_steps: (body.sequence_steps as CampaignStep[]) ?? [],
          start_at: (body.start_at as string | null) ?? null,
          end_at: (body.end_at as string | null) ?? null,
          budget_eur_cents: (body.budget_eur_cents as number | null) ?? null,
        },
        tenantId,
      )
      return NextResponse.json({ ok: true, data: campaign }, { status: 201 })
    }

    // ── enroll ───────────────────────────────────────────────────────────────
    if (action === 'enroll') {
      if (!body.campaign_id || !body.investor_id) {
        return NextResponse.json(
          { ok: false, error: 'campaign_id and investor_id required' },
          { status: 400 },
        )
      }
      const execution = await enrollInvestor(
        body.campaign_id as string,
        body.investor_id as string,
        tenantId,
      )
      return NextResponse.json({ ok: true, data: execution }, { status: 201 })
    }

    // ── enroll-segment ────────────────────────────────────────────────────────
    if (action === 'enroll-segment') {
      if (!body.campaign_id || !body.segment) {
        return NextResponse.json(
          { ok: false, error: 'campaign_id and segment required' },
          { status: 400 },
        )
      }
      const result = await bulkEnrollSegment(
        body.campaign_id as string,
        body.segment as string,
        tenantId,
      )
      return NextResponse.json({ ok: true, data: result })
    }

    // ── run-triggers ──────────────────────────────────────────────────────────
    if (action === 'run-triggers') {
      const results = await runAllTriggers(tenantId)
      return NextResponse.json({
        ok: true,
        data: results,
        total_triggers: results.length,
        total_activations: results.reduce((s, r) => s + r.campaigns_activated, 0),
      })
    }

    // ── process-sends ─────────────────────────────────────────────────────────
    if (action === 'process-sends') {
      const limit =
        typeof body.limit === 'number' ? body.limit : 50
      const result = await processPendingJobs(tenantId, limit)
      return NextResponse.json({ ok: true, data: result })
    }

    // ── pause ─────────────────────────────────────────────────────────────────
    if (action === 'pause') {
      if (!body.campaign_id) {
        return NextResponse.json(
          { ok: false, error: 'campaign_id required' },
          { status: 400 },
        )
      }
      await pauseCampaign(body.campaign_id as string, tenantId)
      return NextResponse.json({
        ok: true,
        data: { campaign_id: body.campaign_id, status: 'PAUSED' },
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Unknown action: ${action}. Valid: create|enroll|enroll-segment|run-triggers|process-sends|pause`,
      },
      { status: 400 },
    )
  } catch (e: unknown) {
    log.error('[campaigns/orchestrate] POST error', e, { action, tenant_id: tenantId })
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
