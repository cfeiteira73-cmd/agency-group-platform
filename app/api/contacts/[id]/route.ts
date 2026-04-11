// =============================================================================
// CONTACTS [id] PATCH — Agency Group
// Public PATCH for qualification data only (use_type, budget, timeline)
// Full CRUD requires auth — this endpoint accepts only qualification fields
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

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

    const { error } = await supabaseAdmin
      .from('contacts')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      console.error('[contacts/id] patch error:', error)
      return NextResponse.json({ error: 'Erro ao actualizar' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contacts/id] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
