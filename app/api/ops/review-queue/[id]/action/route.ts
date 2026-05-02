// POST /api/ops/review-queue/[id]/action
// Execute a review action: approve / reject / override

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction }                 from '@/lib/auth/auditLog'

export const runtime = 'nodejs'

type ReviewAction = 'approve' | 'reject' | 'override'

interface ActionBody {
  action:           ReviewAction
  review_notes?:    string
  override_score?:  number
  override_routing?: Record<string, unknown>
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin) return NextResponse.json({ error: 'Forbidden — no admin role' }, { status: 403 })

  const reviewId = params.id

  let body: ActionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body
  if (!['approve', 'reject', 'override'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve | reject | override' }, { status: 400 })
  }

  // Permission checks
  const actionPermMap: Record<ReviewAction, Parameters<typeof hasPermission>[1]> = {
    approve:  'review:approve',
    reject:   'review:reject',
    override: 'review:override_score',
  }
  if (!hasPermission(admin.role, actionPermMap[action])) {
    return NextResponse.json({ error: `Role ${admin.role} cannot perform ${action}` }, { status: 403 })
  }

  try {
    // Fetch current record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current, error: fetchErr } = await (supabaseAdmin as any)
      .from('deal_review_queue')
      .select('id, status, opportunity_score, opportunity_grade')
      .eq('id', reviewId)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 })
    }
    if (current.status !== 'pending') {
      return NextResponse.json({ error: `Item already ${current.status}` }, { status: 409 })
    }

    const newStatus = action === 'override' ? 'overridden' : action === 'approve' ? 'approved' : 'rejected'
    const now       = new Date().toISOString()

    const updatePayload: Record<string, unknown> = {
      status:         newStatus,
      reviewer_email: token.email,
      reviewed_at:    now,
      review_notes:   body.review_notes ?? null,
    }

    if (action === 'override') {
      if (body.override_score != null)   updatePayload.override_score   = body.override_score
      if (body.override_routing != null) updatePayload.override_routing = body.override_routing
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabaseAdmin as any)
      .from('deal_review_queue')
      .update(updatePayload)
      .eq('id', reviewId)

    if (updateErr) throw new Error(updateErr.message)

    // Audit trail
    await logAction({
      actor_email:   token.email as string,
      actor_role:    admin.role,
      action_type:   action === 'approve' ? 'approve_deal'
                   : action === 'reject'  ? 'reject_deal'
                   : 'override_score',
      resource_type: 'deal_review',
      resource_id:   reviewId,
      old_value:     { status: 'pending', score: current.opportunity_score },
      new_value:     { status: newStatus, ...updatePayload },
    })

    return NextResponse.json({ id: reviewId, status: newStatus, reviewed_by: token.email, reviewed_at: now })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
