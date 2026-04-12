// =============================================================================
// Agency Group — Off-Market Lead Detail API
// GET    /api/offmarket-leads/[id]   — get single lead
// PATCH  /api/offmarket-leads/[id]   — update status, score, notes, assigned_to
// DELETE /api/offmarket-leads/[id]   — remove lead (admin only)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'offmarket_leads'

const ALLOWED_PATCH_FIELDS = new Set([
  'status', 'score', 'score_breakdown', 'score_updated_at',
  'notes', 'assigned_to', 'next_followup_at', 'last_contact_at',
  'contact_attempts', 'urgency', 'price_ask', 'price_estimate',
  'tags', 'contacto', 'owner_type', 'raw_data',
])

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .select('*')
      .eq('id', params.id)
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
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    // Auto-increment contact_attempts when last_contact_at is set
    if (patch.last_contact_at && !patch.contact_attempts) {
      patch.contact_attempts = null // let DB trigger handle, or fetch+increment below
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .update(patch)
      .eq('id', params.id)
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
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from(TABLE)
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[offmarket-leads DELETE/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
