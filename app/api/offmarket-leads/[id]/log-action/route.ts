// =============================================================================
// Agency Group — Action Logger
// POST /api/offmarket-leads/[id]/log-action
//
// Regista acções comerciais: chamada, WhatsApp, visita, proposta, CPCV push.
// Atualiza: last_call_at, contact_attempts_count, last_action_type, etc.
// Triggers on DB side: first_contact_at, deal_readiness_score bump.
//
// BODY:
//   action_type  * required: call | whatsapp | visit | proposal | cpcv_push | email
//   notes          optional: notas livres
//   proposal_amount optional: valor da proposta em € (só para action_type=proposal)
//   meeting_at     optional: data/hora da visita (ISO string, só para action_type=visit)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export const runtime = 'nodejs'

const VALID_ACTIONS = ['call', 'whatsapp', 'visit', 'proposal', 'cpcv_push', 'email'] as const
type ActionType = typeof VALID_ACTIONS[number]

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && incoming === cronSecret) return true
  const session = await auth()
  return !!session
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  try {
    const body = await req.json() as Record<string, unknown>
    const action_type = typeof body.action_type === 'string' ? body.action_type as ActionType : null

    if (!action_type || !VALID_ACTIONS.includes(action_type)) {
      return NextResponse.json({
        error: `action_type obrigatório. Válidos: ${VALID_ACTIONS.join(', ')}`,
      }, { status: 400 })
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : null
    const proposal_amount = typeof body.proposal_amount === 'number' ? Math.round(body.proposal_amount) : null
    const meeting_at = typeof body.meeting_at === 'string' ? body.meeting_at : null
    const now = new Date().toISOString()

    // ── Build patch payload ──────────────────────────────────────────
    const patch: Record<string, unknown> = {
      last_action_type: action_type,
    }

    // Track attempts
    if (action_type === 'call') {
      patch.last_call_at = now
      patch.call_done_today = true
      // increment contact_attempts_count
    }

    if (action_type === 'whatsapp') {
      patch.last_whatsapp_at = now
    }

    if (action_type === 'visit' || action_type === 'whatsapp' || action_type === 'call') {
      // increment handled separately
    }

    if (action_type === 'visit') {
      patch.first_meeting_at = meeting_at ?? now
    }

    if (action_type === 'proposal') {
      patch.proposal_sent_at = now
      if (proposal_amount) patch.proposal_amount = proposal_amount
      if (notes) patch.deal_next_step = notes
    }

    // Append notes to existing notes
    if (notes) {
      const { data: current } = await s
        .from('offmarket_leads')
        .select('notes, contact_attempts_count')
        .eq('id', id)
        .single()

      const existingNotes = current?.notes ?? ''
      const timestamp = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      patch.notes = existingNotes
        ? `${existingNotes}\n[${timestamp}] ${action_type.toUpperCase()}: ${notes}`
        : `[${timestamp}] ${action_type.toUpperCase()}: ${notes}`

      // Increment contact_attempts_count for call/whatsapp/email
      if (['call', 'whatsapp', 'email'].includes(action_type)) {
        patch.contact_attempts_count = (current?.contact_attempts_count ?? 0) + 1
      }
    } else {
      // Still increment attempts even without notes
      if (['call', 'whatsapp', 'email'].includes(action_type)) {
        const { data: current } = await s
          .from('offmarket_leads')
          .select('contact_attempts_count')
          .eq('id', id)
          .single()
        patch.contact_attempts_count = (current?.contact_attempts_count ?? 0) + 1
      }
    }

    // ── Patch lead ───────────────────────────────────────────────────
    const { data: updated, error: patchErr } = await s
      .from('offmarket_leads')
      .update(patch)
      .eq('id', id)
      .select(`
        id, nome, last_action_type, last_call_at, last_whatsapp_at,
        first_contact_at, first_meeting_at, contact_attempts_count,
        deal_readiness_score, status, proposal_sent_at, call_done_today
      `)
      .single()

    if (patchErr || !updated) {
      console.error('[log-action] Patch error:', patchErr)
      return NextResponse.json({ error: patchErr?.message ?? 'Erro ao registar acção' }, { status: 500 })
    }

    // ── Compute next_action based on pipeline state ──────────────────
    const readiness = updated.deal_readiness_score ?? 0
    let next_action = ''

    if (!updated.first_contact_at) {
      next_action = '📞 LIGAR — nenhum contacto real ainda'
    } else if (!updated.first_meeting_at) {
      next_action = '📅 MARCAR VISITA — contacto feito, visita em falta'
    } else if (!updated.proposal_sent_at) {
      next_action = '📄 ENVIAR PROPOSTA — visita feita, proposta em falta'
    } else if (readiness >= 80) {
      next_action = '🟢 CPCV TRIGGER — preparar CPCV'
    } else {
      next_action = '⏳ SEGUIMENTO — acompanhar processo'
}

    console.log(`[log-action] Lead ${id}: ${action_type} registado. Attempts: ${updated.contact_attempts_count}`)

    return NextResponse.json({
      success: true,
      lead_id: id,
      action_type,
      updated: {
        last_action_type: updated.last_action_type,
        last_call_at: updated.last_call_at,
        first_contact_at: updated.first_contact_at,
        first_meeting_at: updated.first_meeting_at,
        contact_attempts_count: updated.contact_attempts_count,
        deal_readiness_score: updated.deal_readiness_score,
        status: updated.status,
        call_done_today: updated.call_done_today,
      },
      next_action,
      logged_at: now,
    })
  } catch (err) {
    console.error('[log-action]', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
