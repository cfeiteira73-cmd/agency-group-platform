// =============================================================================
// Agency Group — Buyer Record Close
// FASE 19: PATCH /api/buyers/[id]/record-close
// Updates buyer stats after a successful deal close
// Body: { close_date, property_value, close_days_from_first_contact, notes? }
// Updates: deals_closed_count++, avg_close_days (rolling avg), reliability_score,
//          buyer_scored_at reset (triggers re-scoring on next batch)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

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
      close_date,
      property_value,
      close_days_from_first_contact,
      notes,
    } = body as {
      close_date?: string
      property_value?: number
      close_days_from_first_contact?: number
      notes?: string
    }

    if (!close_date) {
      return NextResponse.json({ error: 'close_date required (ISO format)' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    // Fetch current buyer stats
    const { data: contact, error: fetchErr } = await s.from('contacts')
      .select('id, full_name, deals_closed_count, avg_close_days, reliability_score, notes as existing_notes')
      .eq('id', id)
      .single()

    if (fetchErr || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const prevClosed = contact.deals_closed_count ?? 0
    const prevAvgDays = contact.avg_close_days ?? null
    const prevReliability = contact.reliability_score ?? 3

    const newClosedCount = prevClosed + 1

    // Rolling average close days
    let newAvgDays: number | null = prevAvgDays
    if (close_days_from_first_contact != null && close_days_from_first_contact > 0) {
      if (prevAvgDays == null) {
        newAvgDays = close_days_from_first_contact
      } else {
        // Weighted rolling average: weight previous by count, new by 1
        newAvgDays = Math.round((prevAvgDays * prevClosed + close_days_from_first_contact) / newClosedCount)
      }
    }

    // Reliability score: increment on close (max 5)
    const newReliability = Math.min(5, prevReliability + 0.5) as number

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      deals_closed_count: newClosedCount,
      avg_close_days:     newAvgDays,
      reliability_score:  Math.round(newReliability * 2) / 2,  // round to 0.5
      last_contact_at:    close_date,
      active_status:      'closing',  // just closed
      buyer_scored_at:    null,        // reset to trigger re-scoring
    }

    // Append close note
    const closedValueStr = property_value ? ` · €${Math.round(property_value / 1000)}K` : ''
    const closedDaysStr = close_days_from_first_contact ? ` · ${close_days_from_first_contact}d` : ''
    const closeNote = `[CLOSE ${new Date(close_date).toLocaleDateString('pt-PT')}${closedValueStr}${closedDaysStr}]${notes ? ' ' + notes : ''}`

    if (notes || property_value || close_days_from_first_contact) {
      const existingNotes = contact.existing_notes ?? ''
      updatePayload.notes = existingNotes ? `${existingNotes}\n${closeNote}` : closeNote
    }

    const { data: updated, error: updateErr } = await s.from('contacts')
      .update(updatePayload)
      .eq('id', id)
      .select('id, full_name, deals_closed_count, avg_close_days, reliability_score, active_status')
      .single()

    if (updateErr) {
      // Fallback: update base fields only
      await s.from('contacts').update({
        last_contact_at: close_date,
        notes: ((contact.existing_notes ?? '') + '\n' + closeNote).trim(),
      }).eq('id', id)
      return NextResponse.json({
        contact_id: id,
        saved: true,
        note: 'migration 007 pending — base fields only updated',
      })
    }

    console.log(`[buyers/record-close] ${id} — close #${newClosedCount} recorded, avg_days=${newAvgDays}`)

    return NextResponse.json({
      contact_id:         id,
      name:               updated?.full_name ?? contact.full_name,
      deals_closed_count: updated?.deals_closed_count,
      avg_close_days:     updated?.avg_close_days,
      reliability_score:  updated?.reliability_score,
      active_status:      updated?.active_status,
      close_note:         closeNote,
      saved:              true,
    })
  } catch (err) {
    console.error('[buyers/record-close PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
