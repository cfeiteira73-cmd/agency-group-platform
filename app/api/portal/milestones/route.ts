// =============================================================================
// Agency Group — Client Milestones API
// GET   /api/portal/milestones — fetch milestones by contact_id or deal_id
// POST  /api/portal/milestones — create a new milestone
// PATCH /api/portal/milestones — mark milestone complete / update notes
// Auth: portal auth required
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import log from '@/lib/logger'

export const runtime = 'nodejs'

// ─── GET /api/portal/milestones ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contact_id')
  const dealId    = searchParams.get('deal_id')

  if (!contactId && !dealId) {
    return NextResponse.json(
      { error: 'contact_id or deal_id query param required' },
      { status: 400, headers: { 'x-correlation-id': corrId } },
    )
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('client_milestones')
      .select('*')
      .order('milestone_date', { ascending: true })

    if (contactId) query = query.eq('contact_id', contactId)
    if (dealId)    query = query.eq('deal_id', dealId)

    const { data, error } = await query

    if (error) {
      log.warn('[milestones] GET query error', { route: 'api/portal/milestones', error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500, headers: { 'x-correlation-id': corrId } })
    }

    return NextResponse.json({ milestones: data ?? [] }, {
      headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[milestones] GET error', err instanceof Error ? err : new Error(String(err)), { route: 'api/portal/milestones' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/portal/milestones ─────────────────────────────────────────────

interface CreateMilestoneBody {
  contact_id: string
  deal_id?: string
  milestone_type: string
  milestone_date: string
  notes?: string
  agent_email: string
}

export async function POST(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)

  try {
    const body = (await req.json()) as Partial<CreateMilestoneBody>

    if (!body.contact_id || !body.milestone_type || !body.milestone_date || !body.agent_email) {
      return NextResponse.json(
        { error: 'contact_id, milestone_type, milestone_date and agent_email are required' },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    const payload = {
      contact_id:     body.contact_id,
      deal_id:        body.deal_id ?? null,
      milestone_type: body.milestone_type,
      milestone_date: body.milestone_date,
      notes:          body.notes ?? null,
      agent_email:    body.agent_email,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('client_milestones')
      .insert(payload)
      .select()
      .single()

    if (error) {
      log.warn('[milestones] POST insert error', { route: 'api/portal/milestones', error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500, headers: { 'x-correlation-id': corrId } })
    }

    return NextResponse.json({ milestone: data }, {
      status: 201,
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.error('[milestones] POST error', err instanceof Error ? err : new Error(String(err)), { route: 'api/portal/milestones' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/portal/milestones ────────────────────────────────────────────

interface PatchMilestoneBody {
  id: string
  completed_at?: string
  notes?: string
}

export async function PATCH(req: NextRequest) {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId = getRequestCorrelationId(req)

  try {
    const body = (await req.json()) as Partial<PatchMilestoneBody>

    if (!body.id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    const updates: Record<string, string | null> = {}
    if (body.completed_at !== undefined) updates.completed_at = body.completed_at
    if (body.notes        !== undefined) updates.notes        = body.notes

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'At least one of completed_at or notes must be provided' },
        { status: 400, headers: { 'x-correlation-id': corrId } },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('client_milestones')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      log.warn('[milestones] PATCH update error', { route: 'api/portal/milestones', error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500, headers: { 'x-correlation-id': corrId } })
    }

    return NextResponse.json({ milestone: data }, {
      headers: { 'x-correlation-id': corrId },
    })
  } catch (err) {
    log.error('[milestones] PATCH error', err instanceof Error ? err : new Error(String(err)), { route: 'api/portal/milestones' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
