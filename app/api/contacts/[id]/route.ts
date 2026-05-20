// =============================================================================
// CONTACTS [id] — Agency Group
// PATCH: portal auth required — qualification fields (use_type, budget, timeline)
//        NOTE: was previously "public" — SECURITY FIX: contact UUIDs are not
//        secrets. Any public PATCH allows arbitrary CRM data corruption via IDOR.
//        Callers must authenticate (portal session, magic-link cookie, or service token).
// DELETE: portal auth required + ownership RBAC (agents delete own; admin deletes any)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

// Only qualification fields are allowed via this public endpoint
const QualSchema = z.object({
  use_type:   z.string().max(80).optional(),
  budget_min: z.coerce.number().optional(),
  budget_max: z.coerce.number().optional(),
  timeline:   z.string().max(80).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY FIX: require portal auth — contact UUIDs are not secrets (IDOR risk)
  const authCheck = await requirePortalAuth(req)
  if (!authCheck.ok) return authCheck.response

  const corrId = getRequestCorrelationId(req)
  try {
    const { id } = await params
    if (!id || id.length < 4) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = QualSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { use_type, budget_min, budget_max, timeline } = parsed.data

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (use_type)   updatePayload.use_type   = use_type
    if (budget_min) updatePayload.budget_min = budget_min
    if (budget_max) updatePayload.budget_max = budget_max
    if (timeline)   updatePayload.timeline   = timeline

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? 'agency-group'
    const { error } = await (supabaseAdmin as any)
      .from('contacts')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('[contacts/id] patch error:', error, { corrId })
      return NextResponse.json({ error: 'Erro ao actualizar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contacts/id] error:', err, { corrId })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/contacts/[id]
// RBAC: agents may only delete contacts they own (agent_email match)
//       service tokens (CRON_SECRET / INTERNAL_API_TOKEN) bypass ownership
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const corrId = getRequestCorrelationId(req)
  const authCheck = await requirePortalAuth(req)
  if (!authCheck.ok) return authCheck.response

  try {
    const { id } = await params
    if (!id || id.length < 4) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? 'agency-group'
    // Load contact to check ownership
    const { data: contact, error: fetchError } = await (supabaseAdmin as any)
      .from('contacts')
      .select('agent_email')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !contact) {
      return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 })
    }

    // RBAC — service tokens bypass, agents must own the contact
    if (authCheck.via !== 'service_token') {
      const ownerEmail = (contact as { agent_email?: string }).agent_email
      if (ownerEmail && ownerEmail !== authCheck.email) {
        return NextResponse.json(
          { error: 'Sem permissão para eliminar este contacto' },
          { status: 403 }
        )
      }
    }

    const { error } = await (supabaseAdmin as any)
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('[contacts/id] delete error:', error, { corrId })
      return NextResponse.json({ error: 'Erro ao eliminar contacto' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted_id: id })
  } catch (err) {
    console.error('[contacts/id] delete error:', err, { corrId })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
