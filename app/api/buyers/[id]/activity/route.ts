// =============================================================================
// Agency Group — Buyer Activity Update
// FASE 19: PATCH /api/buyers/[id]/activity
// Updates buyer interaction stats after a contact event
// Body: { interaction_type, notes?, contacted_at? }
// Updates: last_contact_at, response_rate, active_status, buyer_scored_at reset
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const INTERACTION_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'proposal', 'no_response'] as const
type InteractionType = typeof INTERACTION_TYPES[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const body = await req.json().catch(() => ({}))
    const {
      interaction_type,
      notes,
      contacted_at,
    } = body as {
      interaction_type?: InteractionType
      notes?: string
      contacted_at?: string
    }

    if (!interaction_type || !INTERACTION_TYPES.includes(interaction_type)) {
      return NextResponse.json({
        error: `interaction_type required — one of: ${INTERACTION_TYPES.join(', ')}`,
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    // Fetch current buyer data
    const { data: contact, error: fetchErr } = await s.from('contacts')
      .select('id, full_name, response_rate, last_contact_at, notes as existing_notes')
      .eq('id', id)
      .single()

    if (fetchErr || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const now = new Date()
    const contactedTime = contacted_at ?? now.toISOString()

    // Compute updated response_rate
    // Increment response rate for positive interactions, decrement for no_response
    let newResponseRate = contact.response_rate ?? 50  // default 50%
    if (interaction_type === 'no_response') {
      newResponseRate = Math.max(0, newResponseRate - 10)
    } else {
      newResponseRate = Math.min(100, newResponseRate + 5)
    }

    // Determine active_status based on interaction type
    const activeStatus = interaction_type === 'no_response' ? 'cooling' :
                         ['proposal', 'visit', 'meeting'].includes(interaction_type) ? 'hot' :
                         'active'

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      last_contact_at: contactedTime,
      response_rate: Math.round(newResponseRate),
      active_status: activeStatus,
      // Reset buyer_score to trigger re-scoring on next batch
      buyer_scored_at: null,
    }

    // Append note if provided
    if (notes) {
      const existingNotes = contact.existing_notes ?? ''
      const timestamp = new Date(contactedTime).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
      updatePayload.notes = existingNotes
        ? `${existingNotes}\n[${timestamp} — ${interaction_type}] ${notes}`
        : `[${timestamp} — ${interaction_type}] ${notes}`
    }

    const { data: updated, error: updateErr } = await s.from('contacts')
      .update(updatePayload)
      .eq('id', id)
      .select('id, full_name, last_contact_at, response_rate, active_status')
      .single()

    if (updateErr) {
      // Fallback: update base fields only (pre-migration 007)
      await s.from('contacts').update({ last_contact_at: contactedTime }).eq('id', id)
      return NextResponse.json({
        contact_id: id,
        interaction_type,
        saved: true,
        note: 'migration 007 pending — only last_contact_at updated',
      })
    }

    console.log(`[buyers/activity] ${id} — ${interaction_type} logged, response_rate=${newResponseRate}`)

    return NextResponse.json({
      contact_id:      id,
      name:            updated?.full_name ?? contact.full_name,
      interaction_type,
      last_contact_at: updated?.last_contact_at,
      response_rate:   updated?.response_rate,
      active_status:   updated?.active_status,
      saved:           true,
    })
  } catch (err) {
    console.error('[buyers/activity PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
