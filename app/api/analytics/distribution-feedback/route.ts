// GET  /api/analytics/distribution-feedback — network feedback scores + weights
// POST /api/analytics/distribution-feedback — compute + persist feedback for recipient

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { supabaseAdmin }               from '@/lib/supabase'
import {
  buildFeedbackWeightAdjustment,
  computeNetworkFeedbackScore,
  persistFeedbackWeights,
  getFeedbackWeightsForRecipient,
} from '@/lib/intelligence/distributionFeedback'
import type { DistributionOutcomeSummary } from '@/lib/intelligence/distributionFeedback'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const recipientEmail = searchParams.get('email')
  const view           = searchParams.get('view') ?? 'network'

  try {
    if (view === 'recipient' && recipientEmail) {
      const weights = await getFeedbackWeightsForRecipient(recipientEmail)
      return NextResponse.json({ email: recipientEmail, weights })
    }

    if (view === 'weights') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin as any)
        .from('distribution_feedback_weights')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) throw new Error(error.message)
      return NextResponse.json({ weights: data ?? [] })
    }

    // Network-level summary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: outcomes, error } = await (supabaseAdmin as any)
      .from('distribution_outcomes')
      .select('recipient_email, response_received, converted, response_time_hours')
      .limit(500)
    if (error) throw new Error(error.message)

    type OutcomeRow = {
      recipient_email:    string
      response_received:  boolean
      converted:          boolean
      response_time_hours: number | null
    }

    const byRecipient = new Map<string, OutcomeRow[]>()
    for (const row of (outcomes ?? []) as OutcomeRow[]) {
      if (!byRecipient.has(row.recipient_email)) byRecipient.set(row.recipient_email, [])
      byRecipient.get(row.recipient_email)!.push(row)
    }

    const summaries: DistributionOutcomeSummary[] = []
    for (const [em, rows] of byRecipient) {
      const accepted = rows.filter(r => r.response_received).length
      const converted = rows.filter(r => r.converted).length
      const responseRows = rows.filter(r => r.response_time_hours != null)
      const avgResp = responseRows.length > 0
        ? responseRows.reduce((a, r) => a + (r.response_time_hours ?? 0), 0) / responseRows.length
        : null
      summaries.push({
        recipient_email:    em,
        total_sent:         rows.length,
        total_accepted:     accepted,
        total_converted:    converted,
        total_rejected:     rows.length - accepted,
        avg_response_hours: avgResp,
        distributions_7d:   0,
        distributions_30d:  rows.length,
        is_fatigued:        false,
      })
    }

    const networkScore = computeNetworkFeedbackScore(summaries)
    return NextResponse.json({ network_score: networkScore, recipient_count: summaries.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'commercial:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body    = await req.json()
    const summary = body.summary as DistributionOutcomeSummary
    const current = (body.current_weights as { acceptance: number; conversion: number; speed: number }) ?? { acceptance: 1.0, conversion: 1.0, speed: 1.0 }

    const reinforcement = buildFeedbackWeightAdjustment(summary, current)
    await persistFeedbackWeights(reinforcement)
    return NextResponse.json({ ok: true, reinforcement })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
