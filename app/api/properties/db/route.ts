import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  // Properties list is semi-public — allow anon for active properties
  const isAuthenticated = !!session?.user?.id

  try {
    const { searchParams } = new URL(req.url)
    const zona    = searchParams.get('zona')
    const tipo    = searchParams.get('tipo')
    const badge   = searchParams.get('badge')
    const status  = searchParams.get('status')
    const precoMin = searchParams.get('preco_min')
    const precoMax = searchParams.get('preco_max')
    const search  = searchParams.get('search')
    const page    = parseInt(searchParams.get('page') || '1')
    const limit   = parseInt(searchParams.get('limit') || '50')

    const supabase = await createClient()
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    // Non-authenticated users only see active properties
    if (!isAuthenticated) {
      query = query.eq('status', 'active')
    } else if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (zona)    query = query.ilike('zona', `%${zona}%`)
    if (tipo)    query = query.eq('tipo', tipo)
    if (badge)   query = query.eq('badge', badge)
    if (precoMin) query = query.gte('preco', parseFloat(precoMin))
    if (precoMax) query = query.lte('preco', parseFloat(precoMax))
    if (search)  query = query.or(`nome.ilike.%${search}%,bairro.ilike.%${search}%,zona.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      properties: data,
      total: count,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('GET /api/properties/db error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role === 'viewer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    if (!body.id || !body.nome || !body.zona || !body.tipo || !body.preco || !body.area) {
      return NextResponse.json({ error: 'id, nome, zona, tipo, preco, and area are required' }, { status: 400 })
    }

    const VALID_TIPOS = ['Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Quinta', 'Herdade']
    if (!VALID_TIPOS.includes(body.tipo)) {
      return NextResponse.json({ error: `tipo must be one of: ${VALID_TIPOS.join(', ')}` }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('properties')
      .insert({
        id:             body.id,
        nome:           body.nome,
        zona:           body.zona,
        bairro:         body.bairro || null,
        tipo:           body.tipo,
        preco:          body.preco,
        area:           body.area,
        quartos:        body.quartos || null,
        casas_banho:    body.casas_banho || null,
        energia:        body.energia || null,
        descricao:      body.descricao || null,
        features:       body.features || [],
        views:          body.views || null,
        amenities:      body.amenities || {},
        badge:          body.badge || null,
        status:         body.status || 'active',
        lat:            body.lat || null,
        lng:            body.lng || null,
        images:         body.images || [],
        matterport_url: body.matterport_url || null,
        youtube_url:    body.youtube_url || null,
        lifestyle_tags: body.lifestyle_tags || [],
        gradient:       body.gradient || null,
        agent_id:       session.user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, property: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/properties/db error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role === 'viewer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const allowed = ['nome','zona','bairro','tipo','preco','area','quartos','casas_banho','energia','descricao','features','views','amenities','badge','status','lat','lng','images','matterport_url','youtube_url','lifestyle_tags','gradient']
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in updates) updateData[key] = updates[key]
    }

    let query = supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Property not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, property: data })
  } catch (error) {
    console.error('PUT /api/properties/db error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete properties' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    // Soft delete: mark as off-market
    const { data, error } = await supabase
      .from('properties')
      .update({ status: 'off-market', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    return NextResponse.json({ success: true, message: 'Property marked as off-market' })
  } catch (error) {
    console.error('DELETE /api/properties/db error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
