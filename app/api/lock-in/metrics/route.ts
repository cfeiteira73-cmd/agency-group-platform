// Agency Group — Lock-In Metrics API
// app/api/lock-in/metrics/route.ts
// TypeScript strict — 0 errors
//
// GET modes (requireAuth):
//   default:             summary + retention + latest network snapshot
//   ?investor_id=...:    computeInvestorLockIn for specific investor
//   ?mode=churn-risk:    identifyChurnRisk
//   ?mode=cohorts:       last 6 retention cohorts
//   ?mode=network:       computeNetworkEffectSnapshot + history
//   ?mode=acceleration:  detectNetworkAcceleration
//
// POST (admin Bearer):
//   { action: 'run-lock-in-sweep' }
//   { action: 'process-interventions' }
//   { action: 'queue-intervention', investor_id, trigger }

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  computeInvestorLockIn,
  getCapitalLockInSummary,
  identifyChurnRisk,
  runLockInSweep,
} from '@/lib/lock-in/capitalLockInEngine'
import {
  computeRetentionCohort,
  getRetentionMetrics,
  processRetentionInterventions,
  queueRetentionIntervention,
  type RetentionIntervention,
} from '@/lib/lock-in/investorRetentionEngine'
import {
  computeNetworkEffectSnapshot,
  detectNetworkAcceleration,
  getNetworkStageHistory,
} from '@/lib/lock-in/networkEffectMetrics'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  const { searchParams } = new URL(req.url)
  const tenantId = auth.tenant_id
  const investorId = searchParams.get('investor_id')
  const mode = searchParams.get('mode')

  try {
    // ?investor_id=...: single investor lock-in score
    if (investorId) {
      const score = await computeInvestorLockIn(investorId, tenantId)
      return NextResponse.json({ data: score })
    }

    // ?mode=churn-risk
    if (mode === 'churn-risk') {
      const churnRiskInvestors = await identifyChurnRisk(tenantId)
      return NextResponse.json({ data: churnRiskInvestors })
    }

    // ?mode=cohorts: last 6 retention cohorts
    if (mode === 'cohorts') {
      const { data: cohortRows } = await (supabaseAdmin as any)
        .from('retention_cohorts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('cohort_period', { ascending: false })
        .limit(6)
      return NextResponse.json({ data: cohortRows ?? [] })
    }

    // ?mode=network: fresh snapshot + history
    if (mode === 'network') {
      const [snapshot, history] = await Promise.all([
        computeNetworkEffectSnapshot(tenantId),
        getNetworkStageHistory(tenantId, 10),
      ])
      return NextResponse.json({ data: { snapshot, history } })
    }

    // ?mode=acceleration
    if (mode === 'acceleration') {
      const acceleration = await detectNetworkAcceleration(tenantId)
      return NextResponse.json({ data: acceleration })
    }

    // Default: summary dashboard
    const [lockInSummary, retentionMetrics, networkHistory] = await Promise.all([
      getCapitalLockInSummary(tenantId),
      getRetentionMetrics(tenantId),
      getNetworkStageHistory(tenantId, 1),
    ])

    const latestNetworkSnapshot = networkHistory[0] ?? null

    return NextResponse.json({
      data: {
        lock_in_summary: lockInSummary,
        retention_metrics: retentionMetrics,
        latest_network_snapshot: latestNetworkSnapshot,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth as NextResponse

  // Admin-only: bearer or cron
  if (auth.method !== 'bearer' && auth.method !== 'cron') {
    return NextResponse.json({ error: 'Forbidden', reason: 'admin Bearer required' }, { status: 403 })
  }

  const tenantId = auth.tenant_id

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    // action: 'run-lock-in-sweep'
    if (action === 'run-lock-in-sweep') {
      const result = await runLockInSweep(tenantId)
      return NextResponse.json({ data: result })
    }

    // action: 'process-interventions'
    if (action === 'process-interventions') {
      const result = await processRetentionInterventions(tenantId)
      return NextResponse.json({ data: result })
    }

    // action: 'queue-intervention'
    if (action === 'queue-intervention') {
      const investorId = body.investor_id as string | undefined
      const trigger = body.trigger as RetentionIntervention['trigger'] | undefined

      if (!investorId || !trigger) {
        return NextResponse.json(
          { error: 'investor_id and trigger are required' },
          { status: 400 },
        )
      }

      const validTriggers: RetentionIntervention['trigger'][] = [
        'HIGH_CHURN_RISK',
        'NO_BID_30D',
        'NO_LOGIN_14D',
        'MISSED_OPPORTUNITY',
      ]

      if (!validTriggers.includes(trigger)) {
        return NextResponse.json(
          { error: `trigger must be one of: ${validTriggers.join(', ')}` },
          { status: 400 },
        )
      }

      const intervention = await queueRetentionIntervention(investorId, trigger, tenantId)
      return NextResponse.json({ data: intervention })
    }

    // action: 'compute-cohort'
    if (action === 'compute-cohort') {
      const period = body.period as string | undefined
      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return NextResponse.json(
          { error: 'period must be YYYY-MM format' },
          { status: 400 },
        )
      }
      const cohort = await computeRetentionCohort(period, tenantId)
      return NextResponse.json({ data: cohort })
    }

    return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 })
  }
}
