// =============================================================================
// Agency Group — Opportunity Distribution API
// app/api/opportunities/distribute/route.ts
//
// GET  — stats, opportunity distributions, investor distributions, accuracy, performance
// POST — queue-distribution, process-queue, record-signal, record-outcome, suppress
//
// Auth: requireAuth for standard ops, admin Bearer for process-queue/record-outcome
// =============================================================================

import { NextRequest, NextResponse }   from 'next/server'
import {
  requireAuth,
  extractBearerToken,
  safeCompare,
}                                      from '@/lib/middleware/portalAuthGuard'
import {
  queueDistribution,
  processDistributionQueue,
  generateOpportunityMessage,
  suppressInvestorNotifications,
  getDistributionStats,
}                                      from '@/lib/distribution/opportunityDistributor'
import type { DistributionChannel }    from '@/lib/distribution/opportunityDistributor'
import {
  recordFeedbackSignal,
  getFeedbackSummary,
  getOpportunityPerformanceMetrics,
}                                      from '@/lib/feedback/dealFeedbackEngine'
import type { FeedbackSignalType }     from '@/lib/feedback/dealFeedbackEngine'
import {
  recordOpportunityOutcome,
  generateAccuracyReport,
  getAccuracyHistory,
}                                      from '@/lib/feedback/opportunityPerformanceTracker'
import { supabaseAdmin }               from '@/lib/supabase'
import log                             from '@/lib/logger'

export const runtime    = 'nodejs'
export const maxDuration = 120

// ---------------------------------------------------------------------------
// Admin Bearer check helper
// ---------------------------------------------------------------------------

function isAdminBearer(req: NextRequest): boolean {
  const token         = extractBearerToken(req)
  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret    = process.env.CRON_SECRET
  if (!token) return false
  if (internalToken && safeCompare(token, internalToken)) return true
  if (cronSecret    && safeCompare(token, cronSecret))    return true
  return false
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const { searchParams } = new URL(req.url)
  const tenantId         = authResult.tenant_id
  const mode             = searchParams.get('mode')
  const opportunityId    = searchParams.get('opportunity_id')
  const investorId       = searchParams.get('investor_id')

  try {
    // ?mode=accuracy → generate accuracy report
    if (mode === 'accuracy') {
      const report = await generateAccuracyReport(tenantId)
      return NextResponse.json({ report })
    }

    // ?mode=performance → get performance metrics
    if (mode === 'performance') {
      const metrics = await getOpportunityPerformanceMetrics(tenantId)
      return NextResponse.json({ metrics })
    }

    // ?mode=accuracy-history → historical reports
    if (mode === 'accuracy-history') {
      const limitParam = searchParams.get('limit')
      const limit      = limitParam ? parseInt(limitParam, 10) : 10
      const history    = await getAccuracyHistory(tenantId, limit)
      return NextResponse.json({ history })
    }

    // ?opportunity_id=... → distribution jobs for opportunity
    if (opportunityId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin as any)
        .from('distribution_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('opportunity_id', opportunityId)
        .order('queued_at', { ascending: false })
        .limit(100)

      if (error) throw new Error(error.message)

      const summary = await getFeedbackSummary(opportunityId, tenantId)

      return NextResponse.json({ jobs: data ?? [], feedback_summary: summary })
    }

    // ?investor_id=... → investor's received distributions
    if (investorId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin as any)
        .from('distribution_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('investor_id', investorId)
        .order('queued_at', { ascending: false })
        .limit(100)

      if (error) throw new Error(error.message)
      return NextResponse.json({ jobs: data ?? [] })
    }

    // Default: overall stats
    const stats = await getDistributionStats(tenantId)
    return NextResponse.json(stats)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error('[distribute/route] GET error', e instanceof Error ? e : new Error(msg))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body['action'] as string | undefined

  if (!action) {
    return NextResponse.json({ error: 'Missing action field' }, { status: 400 })
  }

  // ── Admin-only actions ────────────────────────────────────────────────────

  if (action === 'process-queue' || action === 'record-outcome') {
    if (!isAdminBearer(req)) {
      return NextResponse.json({ error: 'Unauthorized — admin Bearer required' }, { status: 401 })
    }

    try {
      if (action === 'process-queue') {
        const limitVal = body['limit']
        const limit    = typeof limitVal === 'number' ? limitVal : 50
        const batch    = await processDistributionQueue(
          process.env.DEFAULT_TENANT_ID ?? 'agency-group',
          limit,
        )
        return NextResponse.json({ ok: true, batch })
      }

      if (action === 'record-outcome') {
        const opportunityId     = body['opportunity_id'] as string | undefined
        const outcome           = body['outcome']        as string | undefined
        const actualPrice       = body['actual_price']   as number | undefined
        const actualRoi         = body['actual_roi']     as number | undefined
        const tenantId          = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

        if (!opportunityId) {
          return NextResponse.json({ error: 'Missing opportunity_id' }, { status: 400 })
        }
        if (!outcome || !['CLOSED', 'FAILED', 'EXPIRED', 'ONGOING'].includes(outcome)) {
          return NextResponse.json({ error: 'Invalid outcome value' }, { status: 400 })
        }

        const result = await recordOpportunityOutcome(
          opportunityId,
          outcome as 'CLOSED' | 'FAILED' | 'EXPIRED' | 'ONGOING',
          tenantId,
          actualPrice,
          actualRoi,
        )

        return NextResponse.json({ ok: true, outcome: result })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log.error(`[distribute/route] POST ${action} error`, e instanceof Error ? e : new Error(msg))
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // ── Authenticated actions ─────────────────────────────────────────────────

  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id

  try {
    // queue-distribution
    if (action === 'queue-distribution') {
      const opportunityId = body['opportunity_id'] as string | undefined
      const investorId    = body['investor_id']    as string | undefined
      const channel       = body['channel']        as DistributionChannel | undefined
      const priority      = body['priority']       as DistributionJob['priority'] | undefined

      if (!opportunityId) return NextResponse.json({ error: 'Missing opportunity_id' }, { status: 400 })
      if (!investorId)    return NextResponse.json({ error: 'Missing investor_id' },    { status: 400 })
      if (!channel)       return NextResponse.json({ error: 'Missing channel' },        { status: 400 })

      const validChannels: DistributionChannel[] = ['EMAIL', 'WHATSAPP', 'DASHBOARD', 'API', 'SMS']
      if (!validChannels.includes(channel)) {
        return NextResponse.json({ error: `Invalid channel: ${channel}` }, { status: 400 })
      }

      const job = await queueDistribution(
        opportunityId,
        investorId,
        channel,
        priority ?? 'MEDIUM',
        tenantId,
      )
      return NextResponse.json({ ok: true, job }, { status: 201 })
    }

    // record-signal
    if (action === 'record-signal') {
      const opportunityId   = body['opportunity_id'] as string | undefined
      const assetId         = body['asset_id']       as string | undefined
      const signalType      = body['signal_type']    as FeedbackSignalType | undefined
      const investorId      = body['investor_id']    as string | undefined
      const actualPrice     = body['actual_price']   as number | undefined
      const actualDays      = body['actual_days']    as number | undefined

      if (!opportunityId) return NextResponse.json({ error: 'Missing opportunity_id' }, { status: 400 })
      if (!assetId)       return NextResponse.json({ error: 'Missing asset_id' },       { status: 400 })
      if (!signalType)    return NextResponse.json({ error: 'Missing signal_type' },    { status: 400 })

      const validSignalTypes: FeedbackSignalType[] = [
        'OPPORTUNITY_VIEWED', 'BID_SUBMITTED', 'BID_ACCEPTED', 'DEAL_CLOSED',
        'DEAL_FAILED', 'OPPORTUNITY_PASSED', 'PRICE_REDUCED', 'DELISTED', 'TIME_EXPIRED',
      ]

      if (!validSignalTypes.includes(signalType)) {
        return NextResponse.json({ error: `Invalid signal_type: ${signalType}` }, { status: 400 })
      }

      const signal = await recordFeedbackSignal({
        tenant_id:               tenantId,
        opportunity_id:          opportunityId,
        asset_id:                assetId,
        investor_id:             investorId ?? null,
        signal_type:             signalType,
        metadata:                {},
        is_truth_label:          signalType === 'DEAL_CLOSED' || signalType === 'DEAL_FAILED',
        actual_price_eur_cents:  actualPrice ?? null,
        actual_days_to_close:    actualDays ?? null,
        occurred_at:             new Date().toISOString(),
      })

      return NextResponse.json({ ok: true, signal }, { status: 201 })
    }

    // suppress
    if (action === 'suppress') {
      const investorId    = body['investor_id']    as string | undefined
      const opportunityId = body['opportunity_id'] as string | undefined

      if (!investorId)    return NextResponse.json({ error: 'Missing investor_id' },    { status: 400 })
      if (!opportunityId) return NextResponse.json({ error: 'Missing opportunity_id' }, { status: 400 })

      await suppressInvestorNotifications(investorId, opportunityId, tenantId)
      return NextResponse.json({ ok: true })
    }

    // generate-message (utility)
    if (action === 'generate-message') {
      const opportunityId = body['opportunity_id'] as string | undefined
      const investorId    = body['investor_id']    as string | undefined
      const channel       = body['channel']        as DistributionChannel | undefined

      if (!opportunityId || !investorId || !channel) {
        return NextResponse.json({ error: 'Missing opportunity_id, investor_id, or channel' }, { status: 400 })
      }

      const message = await generateOpportunityMessage(opportunityId, investorId, channel, tenantId)
      return NextResponse.json({ ok: true, message })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error(`[distribute/route] POST ${action} error`, e instanceof Error ? e : new Error(msg))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Type import for DistributionJob priority
// ---------------------------------------------------------------------------

type DistributionJob = import('@/lib/distribution/opportunityDistributor').DistributionJob
