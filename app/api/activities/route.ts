// =============================================================================
// AGENCY GROUP — Activities API v1.0
// GET  /api/activities — list activities from Supabase
// POST /api/activities — create new activity
// AMI: 22506 | Supabase activities table
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function headers(): HeadersInit {
  return { 'Cache-Control': 'no-store' }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type       = searchParams.get('type')
    const contact_id = searchParams.get('contact_id')
    const deal_id    = searchParams.get('deal_id')
    const limit      = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const page       = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (supabaseAdmin as any)
      .from('activities')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (type)       query = query.eq('type', type)
    if (contact_id) query = query.eq('contact_id', contact_id)
    if (deal_id)    query = query.eq('deal_id', deal_id)

    const { data, error, count } = await query

    if (error || !data) {
      console.error('[activities GET] Supabase error:', error)
      return NextResponse.json({ data: [], source: 'error', error: error?.message }, { headers: headers() })
    }

    return NextResponse.json({
      data,
      total:    count ?? data.length,
      page,
      limit,
      pages:    Math.ceil((count ?? data.length) / limit),
      source:   'supabase',
    }, { headers: headers() })
  } catch (err) {
    console.error('[activities GET]', err)
    return NextResponse.json({ data: [], source: 'error' }, { status: 500, headers: headers() })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (!body.type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400, headers: headers() })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('activities')
      .insert({
        type:       body.type,
        note:       body.note || body.title || body.notes || null,  // support multiple field names
        contact_id: body.contact_id || null,
        deal_id:    body.deal_id || null,
        duration:   body.duration || null,
        outcome:    body.outcome || null,
        agent_id:   body.agent_id || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: headers() })
    }

    return NextResponse.json({ data, source: 'supabase' }, { status: 201, headers: headers() })
  } catch (err) {
    console.error('[activities POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: headers() })
  }
}
