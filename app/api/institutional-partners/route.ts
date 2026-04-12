// =============================================================================
// Agency Group — Institutional Partners API
// GET  /api/institutional-partners   — list partners (filterable)
// POST /api/institutional-partners   — create new partner
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'institutional_partners'
const DEFAULT_PAGE_SIZE = 50

const VALID_TIPOS = [
  'advogado','notario','contabilista','gestor_patrimonio',
  'family_office','banco','fundo_investimento',
  'mediador_parceiro','promotor','outro',
]

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const tipo     = sp.get('tipo')
    const estado   = sp.get('estado')
    const cidade   = sp.get('cidade')
    const owner    = sp.get('owner')
    const page     = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
    const limit    = Math.min(200, parseInt(sp.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10))
    const offset   = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any).from(TABLE)
      .select('*', { count: 'exact' })
      .order('nivel_prioridade', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (tipo)   query = query.eq('tipo', tipo)
    if (estado) query = query.eq('estado', estado)
    if (cidade) query = query.ilike('cidade', `%${cidade}%`)
    if (owner)  query = query.eq('owner', owner)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    console.error('[institutional-partners GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const data = body as Record<string, unknown>

    if (!data.nome || typeof data.nome !== 'string' || !data.nome.trim()) {
      return NextResponse.json({ error: '"nome" is required' }, { status: 400 })
    }
    if (!data.tipo || !VALID_TIPOS.includes(String(data.tipo))) {
      return NextResponse.json({ error: `"tipo" must be one of: ${VALID_TIPOS.join(', ')}` }, { status: 400 })
    }

    const payload = {
      nome:             String(data.nome).trim(),
      empresa:          typeof data.empresa === 'string' ? data.empresa : null,
      tipo:             String(data.tipo),
      email:            typeof data.email === 'string' ? data.email.toLowerCase().trim() : null,
      phone:            typeof data.phone === 'string' ? data.phone : null,
      linkedin_url:     typeof data.linkedin_url === 'string' ? data.linkedin_url : null,
      website:          typeof data.website === 'string' ? data.website : null,
      cidade:           typeof data.cidade === 'string' ? data.cidade : null,
      paises_actuacao:  Array.isArray(data.paises_actuacao) ? data.paises_actuacao : null,
      segmento:         typeof data.segmento === 'string' ? data.segmento : null,
      ticket_medio:     typeof data.ticket_medio === 'number' ? data.ticket_medio : null,
      origem:           typeof data.origem === 'string' ? data.origem : null,
      estado:           typeof data.estado === 'string' ? data.estado : 'prospect',
      nivel_prioridade: typeof data.nivel_prioridade === 'string' ? data.nivel_prioridade : 'B',
      next_followup_at: typeof data.next_followup_at === 'string' ? data.next_followup_at : null,
      owner:            typeof data.owner === 'string' ? data.owner : null,
      notes:            typeof data.notes === 'string' ? data.notes : null,
      tags:             Array.isArray(data.tags) ? data.tags : null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabaseAdmin as any).from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    console.log(`[institutional-partners POST] Created partner "${payload.nome}" tipo=${payload.tipo}`)
    return NextResponse.json(inserted, { status: 201 })
  } catch (err) {
    console.error('[institutional-partners POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
