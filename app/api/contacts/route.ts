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
    const status  = searchParams.get('status')
    const search  = searchParams.get('search')
    const page    = parseInt(searchParams.get('page') || '1')
    const limit   = parseInt(searchParams.get('limit') || '50')

    const supabase = await createClient()
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    // Admins see all contacts; agents see only their own
    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    if (status && status !== 'all') query = query.eq('status', status)
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      contacts: data,
      total: count,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('GET /api/contacts error:', error)
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

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        name:         body.name,
        email:        body.email || null,
        phone:        body.phone || null,
        nationality:  body.nationality || null,
        language:     body.language || 'PT',
        budget_min:   body.budget_min || null,
        budget_max:   body.budget_max || null,
        zonas:        body.zonas || [],
        tipos:        body.tipos || [],
        status:       body.status || 'lead',
        notes:        body.notes || null,
        origin:       body.origin || null,
        last_contact: body.last_contact || null,
        lead_score:   body.lead_score || 0,
        tasks:        body.tasks || [],
        agent_id:     session.user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, contact: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/contacts error:', error)
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

    // Build update object (only allowed fields)
    // Includes migration 007 buyer intelligence fields
    const allowed = [
      'name','email','phone','nationality','language',
      'budget_min','budget_max','zonas','tipos',
      'status','notes','origin','last_contact','lead_score','tasks',
      // Migration 007 — buyer intelligence
      'buyer_score','buyer_type','liquidity_profile','proof_of_funds_status',
      'ticket_preference','target_strategy','deals_closed_count','avg_close_days',
      'negotiation_style','reliability_score','response_rate','active_status',
      // Buyer readiness (deal machine)
      'buyer_readiness_score','buyer_ready_for_deal',
      // Extended buyer profile
      'preferred_locations','typologies_wanted','preferred_asset_types',
      'buyer_scored_at','buyer_tier',
    ]
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in updates) updateData[key] = updates[key]
    }

    let query = supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)

    // Agents can only update their own contacts
    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, contact: data })
  } catch (error) {
    console.error('PUT /api/contacts error:', error)
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

    // Soft delete: mark as inactive
    let query = supabase
      .from('contacts')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (session.user.role !== 'admin') {
      query = query.eq('agent_id', session.user.id)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, message: 'Contact archived' })
  } catch (error) {
    console.error('DELETE /api/contacts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
