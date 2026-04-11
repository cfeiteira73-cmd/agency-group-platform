// =============================================================================
// PUBLIC LEADS CAPTURE API — Agency Group
// No auth required — public entry point for website CTAs
// Inserts into contacts table via supabaseAdmin (bypasses RLS)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const LeadSchema = z.object({
  name:         z.string().min(1).max(120).optional(),
  email:        z.string().email().optional(),
  phone:        z.string().max(30).optional(),
  source:       z.string().max(80).optional().default('website'),
  message:      z.string().max(2000).optional(),
  zona:         z.string().max(80).optional(),
  budget_min:   z.coerce.number().optional(),
  budget_max:   z.coerce.number().optional(),
  timeline:     z.string().max(80).optional(),
  use_type:     z.string().max(80).optional(),
  property_ref: z.string().max(40).optional(),
  lang:         z.string().max(5).optional().default('pt'),
}).refine(d => d.email || d.phone, {
  message: 'email or phone required',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = LeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const {
      name, email, phone, source, message,
      zona, budget_min, budget_max, timeline,
      use_type, property_ref,
    } = parsed.data

    // Build notes from available context
    const noteParts: string[] = []
    if (message) noteParts.push(`Mensagem: ${message}`)
    if (property_ref) noteParts.push(`Imóvel: ${property_ref}`)

    // Upsert by email (if provided), else by phone
    const upsertKey = email ? { email } : { phone }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .upsert(
        {
          ...upsertKey,
          full_name:           name || 'Website Lead',
          phone:               phone || null,
          email:               email || null,
          status:              'lead' as const,
          source:              source || 'website',
          source_detail:       zona || null,
          notes:               noteParts.length ? noteParts.join(' | ') : null,
          preferred_locations: zona ? [zona] : null,
          budget_min:          budget_min || null,
          budget_max:          budget_max || null,
          timeline:            timeline || null,
          use_type:            use_type || null,
          last_contact_at:     new Date().toISOString(),
          created_at:          new Date().toISOString(),
          updated_at:          new Date().toISOString(),
        },
        {
          onConflict:          email ? 'email' : 'phone',
          ignoreDuplicates:    false,
        }
      )
      .select('id, status, lead_tier')
      .single()

    if (error) {
      console.error('[leads] upsert error:', error)
      return NextResponse.json({ error: 'Erro ao guardar lead' }, { status: 500 })
    }

    // Fire-and-forget: trigger lead scoring
    if (data?.id) {
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agencygroup.pt'}/api/automation/lead-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: data.id }),
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      id: data?.id,
      tier: data?.lead_tier || 'C',
    })
  } catch (err) {
    console.error('[leads] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
