// =============================================================================
// Agency Group — Off-Market Lead Detail API
// GET    /api/offmarket-leads/[id]   — get single lead
// PATCH  /api/offmarket-leads/[id]   — update status, score, notes, assigned_to
// DELETE /api/offmarket-leads/[id]   — remove lead
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'offmarket_leads'

const ALLOWED_PATCH_FIELDS = new Set([
  'status', 'score', 'score_breakdown', 'score_updated_at', 'score_status',
  'score_reason', 'score_attempts', 'last_score_at',
  'notes', 'assigned_to', 'next_followup_at', 'last_contact_at',
  'contact_attempts', 'urgency', 'price_ask', 'price_estimate',
  'tags', 'contacto', 'owner_type', 'raw_data',
  // FASE 12: buyer matching
  'matched_buyers_count', 'best_buyer_match_score', 'buyer_match_notes',
  'matched_to_buyers', 'buyer_matched_at',
  // FASE 13: pre-close flags
  'preclose_candidate', 'outreach_ready', 'institutional_priority',
  // Wave 10+11: SLA + Deal/Negotiation fields
  'sla_contacted_at', 'sla_breach',
  'offer_amount', 'offer_date', 'counter_offer_amount', 'counter_offer_date',
  'negotiation_status', 'cpcv_target_date', 'cpcv_signed_at',
  'deposit_received', 'legal_status', 'docs_pending',
  'escritura_target_date', 'escritura_done_at',
  'deal_risk_level', 'deal_risk_reason', 'deal_owner',
  'deal_next_step', 'deal_next_step_date',
])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[offmarket-leads GET/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const incoming = body as Record<string, unknown>
    const patch: Record<string, unknown> = {}

    for (const [k, v] of Object.entries(incoming)) {
      if (ALLOWED_PATCH_FIELDS.has(k)) patch[k] = v
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[offmarket-leads PATCH/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from(TABLE)
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[offmarket-leads DELETE/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
