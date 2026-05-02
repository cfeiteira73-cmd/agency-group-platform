// GET  /api/ops/review-queue   — list pending deals awaiting review
// POST /api/ops/review-queue   — queue a deal for manual review

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction }                 from '@/lib/auth/auditLog'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// GET — list pending review queue, priority-sorted
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin || !hasPermission(admin.role, 'review:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status') ?? 'pending'
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('v_review_queue_pending')
      .select('*')
      .limit(limit)

    if (error) throw new Error(error.message)

    // If a different status was requested, query directly
    if (status !== 'pending') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: filtered, error: fe } = await (supabaseAdmin as any)
        .from('deal_review_queue')
        .select('*')
        .eq('status', status)
        .order('queued_at', { ascending: false })
        .limit(limit)
      if (fe) throw new Error(fe.message)
      return NextResponse.json({ items: filtered ?? [], total: (filtered ?? []).length })
    }

    return NextResponse.json({
      items:         data ?? [],
      total:         (data ?? []).length,
      generated_at:  new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — queue a deal for manual review
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const internalToken = req.headers.get('x-internal-token')
  const isInternal    = internalToken === process.env.CRON_SECRET

  let actorEmail = 'system'
  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    actorEmail = token.email as string
  }

  let body: {
    property_id:       string
    opportunity_score: number
    opportunity_grade: string
    distribution_tier: string
    routing_decision?: Record<string, unknown>
    queued_reason?:    string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.property_id || body.opportunity_score == null) {
    return NextResponse.json({ error: 'property_id and opportunity_score required' }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('deal_review_queue')
      .insert({
        property_id:       body.property_id,
        opportunity_score: body.opportunity_score,
        opportunity_grade: body.opportunity_grade,
        distribution_tier: body.distribution_tier,
        routing_decision:  body.routing_decision ?? null,
        queued_reason:     body.queued_reason ?? 'manual',
        auto_queued:       isInternal,
        status:            'pending',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    await logAction({
      actor_email:   actorEmail,
      action_type:   'approve_deal',
      resource_type: 'deal_review',
      resource_id:   data.id,
      new_value:     { property_id: body.property_id, grade: body.opportunity_grade },
    })

    return NextResponse.json({ id: data.id, status: 'queued' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
