import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status       = searchParams.get('status')
    const property_id  = searchParams.get('property_id')
    const contact_id   = searchParams.get('contact_id')
    const date_from    = searchParams.get('date_from')
    const date_to      = searchParams.get('date_to')
    const page         = parseInt(searchParams.get('page') || '1')
    const limit        = parseInt(searchParams.get('limit') || '50')

    const supabase = await createClient()
    let query = supabase
      .from('visitas')
      .select('*', { count: 'exact' })
      .order('date', { ascending: true })
      .range((page - 1) * limit, page * limit - 1)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    if (status && status !== 'all') query = query.eq('status', status)
    if (property_id) query = query.eq('property_id', property_id)
    if (contact_id)  query = query.eq('contact_id', parseInt(contact_id))
    if (date_from)   query = query.gte('date', date_from)
    if (date_to)     query = query.lte('date', date_to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      visitas: data,
      total: count,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('GET /api/visitas/db error:', error)
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

    if (!body.property_name || !body.contact_name || !body.date) {
      return NextResponse.json({ error: 'property_name, contact_name, and date are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('visitas')
      .insert({
        property_id:    body.property_id || null,
        property_name:  body.property_name,
        contact_id:     body.contact_id || null,
        contact_name:   body.contact_name,
        date:           body.date,
        time:           body.time || null,
        status:         body.status || 'agendada',
        notes:          body.notes || null,
        interest_score: body.interest_score || null,
        feedback:       body.feedback || null,
        ai_suggestion:  body.ai_suggestion || null,
        visit_type:     body.visit_type || 'presencial',
        agent_id:       session.user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, visita: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/visitas/db error:', error)
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

    const supabase = await createClient()

    const allowed = ['property_id','property_name','contact_id','contact_name','date','time','status','notes','interest_score','feedback','ai_suggestion','visit_type']
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in updates) updateData[key] = updates[key]
    }

    let query = supabase
      .from('visitas')
      .update(updateData)
      .eq('id', id)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Visita not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, visita: data })
  } catch (error) {
    console.error('PUT /api/visitas/db error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Soft cancel instead of delete
    let query = supabase
      .from('visitas')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Visita not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, message: 'Visita cancelled' })
  } catch (error) {
    console.error('DELETE /api/visitas/db error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
