import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const VALID_FASES = [
  'Angariação', 'Proposta Enviada', 'Proposta Aceite', 'Due Diligence',
  'CPCV Assinado', 'Financiamento', 'Escritura Marcada', 'Escritura Concluída',
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const fase   = searchParams.get('fase')
    const search = searchParams.get('search')
    const page   = parseInt(searchParams.get('page') || '1')
    const limit  = parseInt(searchParams.get('limit') || '50')

    const supabase = await createClient()
    let query = supabase
      .from('deals')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    if (fase && fase !== 'all') query = query.eq('fase', fase)
    if (search) query = query.or(`imovel.ilike.%${search}%,ref.ilike.%${search}%,comprador.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      deals: data,
      total: count,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('GET /api/deals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    if (!body.imovel || !body.valor || !body.fase) {
      return NextResponse.json({ error: 'imovel, valor, and fase are required' }, { status: 400 })
    }

    if (!VALID_FASES.includes(body.fase)) {
      return NextResponse.json({ error: `fase must be one of: ${VALID_FASES.join(', ')}` }, { status: 400 })
    }

    // Auto-generate ref if not provided
    const ref = body.ref || `AG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('deals')
      .insert({
        ref,
        imovel:         body.imovel,
        property_id:    body.property_id || null,
        valor:          body.valor,
        fase:           body.fase,
        comprador:      body.comprador || null,
        contact_id:     body.contact_id || null,
        cpcv_date:      body.cpcv_date || null,
        escritura_date: body.escritura_date || null,
        notas:          body.notas || null,
        checklist:      body.checklist || {},
        deal_room:      body.deal_room || [],
        agent_id:       session.user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, deal: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/deals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    if (updates.fase && !VALID_FASES.includes(updates.fase)) {
      return NextResponse.json({ error: `Invalid fase value` }, { status: 400 })
    }

    const supabase = await createClient()

    const allowed = ['imovel','property_id','valor','fase','comprador','contact_id','cpcv_date','escritura_date','notas','checklist','deal_room']
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in updates) updateData[key] = updates[key]
    }

    let query = supabase
      .from('deals')
      .update(updateData)
      .eq('id', id)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Deal not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, deal: data })
  } catch (error) {
    console.error('PUT /api/deals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can hard-delete deals
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete deals' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Deal deleted' })
  } catch (error) {
    console.error('DELETE /api/deals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
