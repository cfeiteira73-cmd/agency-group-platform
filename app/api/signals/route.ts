// =============================================================================
// AGENCY GROUP — Signals API v1.0
// GET  /api/signals — list market opportunity signals from Supabase
// POST /api/signals — create new signal
// AMI: 22506 | Supabase signals table
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function headers(): HeadersInit {
  return { 'Cache-Control': 'no-store' }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status   = searchParams.get('status') ?? 'new'
    const type     = searchParams.get('type')
    const zone     = searchParams.get('zone')
    const priority = searchParams.get('priority')
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (supabaseAdmin as any)
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') query = query.eq('status', status)
    if (type)     query = query.eq('type', type)
    if (zone)     query = query.eq('zone', zone)
    if (priority) query = query.eq('priority', priority)

    const { data, error } = await query

    if (error || !data) {
      console.error('[signals GET] Supabase error:', error)
      return NextResponse.json({ data: [], source: 'error', error: error?.message }, { headers: headers() })
    }

    return NextResponse.json({ data, total: data.length, source: 'supabase' }, { headers: headers() })
  } catch (err) {
    console.error('[signals GET]', err)
    return NextResponse.json({ data: [], source: 'error' }, { status: 500, headers: headers() })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.type || !body.title) {
      return NextResponse.json({ error: 'type and title are required' }, { status: 400, headers: headers() })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('signals')
      .insert({
        type:        body.type,
        title:       body.title,
        description: body.description || null,
        zone:        body.zone || null,
        property_id: body.property_id || null,
        source:      body.source || 'manual',
        source_url:  body.source_url || null,
        priority:    body.priority || 'medium',
        status:      body.status || 'new',
        agent_id:    body.agent_id || null,
        data:        body.data || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: headers() })
    }

    return NextResponse.json({ data, source: 'supabase' }, { status: 201, headers: headers() })
  } catch (err) {
    console.error('[signals POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: headers() })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: headers() })

    const body = await req.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('signals')
      .update({ status: body.status, ...body })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: headers() })

    return NextResponse.json({ data, source: 'supabase' }, { headers: headers() })
  } catch (err) {
    console.error('[signals PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: headers() })
  }
}
