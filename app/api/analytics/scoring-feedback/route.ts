// POST /api/analytics/scoring-feedback
// Records a deal outcome back into the learning loop.
// Called by agents/CRM when a deal is closed, lost, or goes stale.

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime = 'nodejs'

interface FeedbackBody {
  property_id:       string
  opportunity_score: number
  opportunity_grade: string
  score_breakdown?:  Record<string, unknown>
  agent_email?:      string
  deal_pack_id?:     string
  // Outcome fields (optional — filled as deal progresses)
  close_status?:     'won' | 'lost' | 'stale' | 'withdrawn'
  asking_price?:     number
  realized_price?:   number
  realized_dom?:     number
  buyer_type?:       'investor' | 'owner_occupier' | 'developer'
  avm_value?:        number
}

export async function POST(req: NextRequest) {
  // Auth: session token or internal service token
  const internalToken = req.headers.get('x-internal-token')
  const isInternal    = safeCompare(internalToken ?? '', process.env.CRON_SECRET ?? '')

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: FeedbackBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { property_id, opportunity_score, opportunity_grade } = body
  if (!property_id || opportunity_score == null || !opportunity_grade) {
    return NextResponse.json(
      { error: 'property_id, opportunity_score, opportunity_grade are required' },
      { status: 400 },
    )
  }

  // Compute negotiation delta if we have both prices
  let negotiation_delta_pct: number | null = null
  if (body.realized_price != null && body.asking_price != null && body.asking_price > 0) {
    negotiation_delta_pct = parseFloat(
      (((body.realized_price - body.asking_price) / body.asking_price) * 100).toFixed(3),
    )
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).rpc('record_scoring_feedback', {
      p_property_id:    body.property_id,
      p_score:          body.opportunity_score,
      p_grade:          body.opportunity_grade,
      p_breakdown:      body.score_breakdown ?? {},
      p_contact_id:     null,
      p_deal_pack_id:   body.deal_pack_id ?? null,
      p_agent_email:    body.agent_email ?? null,
      p_avm_value:      body.avm_value ?? null,
      p_asking_price:   body.asking_price ?? null,
      p_close_status:   body.close_status ?? null,
      p_buyer_type:     body.buyer_type ?? null,
      p_realized_price: body.realized_price ?? null,
      p_realized_dom:   body.realized_dom ?? null,
    })

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      event_id: data,
      negotiation_delta_pct,
    })
  } catch (err) {
    console.error('[scoring-feedback] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
