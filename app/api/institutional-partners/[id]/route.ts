// =============================================================================
// Agency Group — Institutional Partner Detail API
// GET   /api/institutional-partners/[id]
// PATCH /api/institutional-partners/[id]
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'institutional_partners'

const ALLOWED_PATCH_FIELDS = new Set([
  'estado', 'nivel_prioridade', 'notes', 'owner',
  'next_followup_at', 'last_contact_at', 'contact_attempts',
  'deals_referidos', 'volume_referido', 'tags',
  'email', 'phone', 'linkedin_url', 'website',
  'ticket_medio', 'segmento', 'paises_actuacao',
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
    console.error('[institutional-partners GET/:id]', err)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .update(patch)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[institutional-partners PATCH/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
