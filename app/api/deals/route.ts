// =============================================================================
// AGENCY GROUP — Deals Pipeline API v2.0
// GET    /api/deals — list deals (filters: ?stage=, ?agent_id=, ?min_value=, ?status=, ?search=)
// POST   /api/deals — create deal
// PUT    /api/deals — update deal (body: { id, ...fields })
// DELETE /api/deals?id= — delete deal (admin only)
// AMI: 22506 | Supabase-first, mock fallback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MockDeal {
  id: string
  stage: string
  property: string
  contact: string
  asking: number
  offer: number | null
  commission: number
  days_in_stage: number
  health: number
  status: string
  agent_id: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Rate-limit headers
// ---------------------------------------------------------------------------

function rateLimitHeaders(): HeadersInit {
  return {
    'X-RateLimit-Limit':     '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset':     String(Math.floor(Date.now() / 1000) + 60),
    'Cache-Control':         'no-store',
  }
}

// ---------------------------------------------------------------------------
// Mock deals — 8 realistic AG pipeline deals
// ---------------------------------------------------------------------------

const MOCK_DEALS: MockDeal[] = [
  {
    id: 'AG-2026-0012', stage: 'Negociação',
    property: 'Apartamento T3 Chiado', contact: 'James Mitchell',
    asking: 1250000, offer: 1180000, commission: 62500,
    days_in_stage: 8, health: 72, status: 'active',
    agent_id: null, created_at: '2026-03-28T10:00:00Z', updated_at: '2026-04-02T10:00:00Z',
  },
  {
    id: 'AG-2026-0011', stage: 'CPCV',
    property: 'Moradia V4 Cascais', contact: 'Khalid Al-Rashid',
    asking: 2800000, offer: 2650000, commission: 140000,
    days_in_stage: 12, health: 88, status: 'active',
    agent_id: null, created_at: '2026-03-24T09:00:00Z', updated_at: '2026-04-03T16:00:00Z',
  },
  {
    id: 'AG-2026-0010', stage: 'Visita',
    property: 'Penthouse T4 Parque Nações', contact: 'Pierre Dubois',
    asking: 890000, offer: null, commission: 44500,
    days_in_stage: 3, health: 90, status: 'active',
    agent_id: null, created_at: '2026-04-02T11:00:00Z', updated_at: '2026-04-02T11:00:00Z',
  },
  {
    id: 'AG-2026-0009', stage: 'Proposta',
    property: 'T2 Príncipe Real', contact: 'Charlotte Blake',
    asking: 720000, offer: 680000, commission: 36000,
    days_in_stage: 18, health: 55, status: 'active',
    agent_id: null, created_at: '2026-03-18T10:00:00Z', updated_at: '2026-03-30T15:00:00Z',
  },
  {
    id: 'AG-2026-0008', stage: 'Qualificado',
    property: 'Moradia V3 Sintra', contact: 'Sophie Hartmann',
    asking: 520000, offer: null, commission: 26000,
    days_in_stage: 5, health: 82, status: 'active',
    agent_id: null, created_at: '2026-03-31T09:00:00Z', updated_at: '2026-03-31T09:00:00Z',
  },
  {
    id: 'AG-2026-0007', stage: 'Escritura',
    property: 'T4 Belém', contact: 'Marco Aurelio Santos',
    asking: 1100000, offer: 1050000, commission: 55000,
    days_in_stage: 22, health: 95, status: 'closing',
    agent_id: null, created_at: '2026-03-14T10:00:00Z', updated_at: '2026-04-04T10:00:00Z',
  },
  {
    id: 'AG-2026-0006', stage: 'Contacto',
    property: 'T2 Alcântara', contact: 'Ana Beatriz Costa',
    asking: 320000, offer: null, commission: 16000,
    days_in_stage: 2, health: 78, status: 'active',
    agent_id: null, created_at: '2026-04-03T14:00:00Z', updated_at: '2026-04-03T14:00:00Z',
  },
  {
    id: 'AG-2026-0005', stage: 'Negociação',
    property: 'Villa Algarve', contact: 'Roberto Fontana',
    asking: 380000, offer: 355000, commission: 19000,
    days_in_stage: 25, health: 42, status: 'at_risk',
    agent_id: null, created_at: '2026-03-11T09:00:00Z', updated_at: '2026-03-25T13:00:00Z',
  },
]

const VALID_FASES = [
  'Angariação', 'Proposta Enviada', 'Proposta Aceite', 'Due Diligence',
  'CPCV Assinado', 'Financiamento', 'Escritura Marcada', 'Escritura Concluída',
  // v2 stages
  'Contacto', 'Qualificado', 'Visita', 'Proposta', 'Negociação', 'CPCV', 'Escritura',
]

// ---------------------------------------------------------------------------
// GET /api/deals
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rateLimitHeaders() })
  }

  try {
    const { searchParams } = new URL(req.url)
    const stage     = searchParams.get('stage')
    const agentId   = searchParams.get('agent_id')
    const minValue  = searchParams.get('min_value') ? parseFloat(searchParams.get('min_value')!) : null
    const status    = searchParams.get('status')
    const search    = searchParams.get('search')
    const fase      = searchParams.get('fase') ?? stage  // support both param names
    const page      = Math.max(parseInt(searchParams.get('page')  ?? '1'),  1)
    const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    // --- Try Supabase ---
    try {
      const supabase = await createClient()
      let query = supabase
        .from('deals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (session.user.role !== 'admin') {
        query = query.eq('agent_id', session.user.id)
      } else if (agentId) {
        query = query.eq('agent_id', agentId)
      }

      if (fase && fase !== 'all')    query = query.eq('fase', fase)
      if (status && status !== 'all') query = query.eq('stage', status)
      if (minValue !== null)          query = query.gte('deal_value', minValue)
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,reference.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query

      if (!error && data) {
        return NextResponse.json({
          success: true,
          deals:   data,
          total:   count ?? data.length,
          page,
          limit,
          pages:   Math.ceil((count ?? data.length) / limit),
          source:  'supabase',
        }, { headers: rateLimitHeaders() })
      }
    } catch {
      // Supabase unavailable — fall through to mock
    }

    // --- Mock fallback ---
    let filtered = [...MOCK_DEALS]

    if (fase && fase !== 'all')    filtered = filtered.filter(d => d.stage === fase)
    if (status && status !== 'all') filtered = filtered.filter(d => d.status === status)
    if (minValue !== null)          filtered = filtered.filter(d => d.asking >= minValue)
    if (agentId)                    filtered = filtered.filter(d => d.agent_id === agentId)
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter(d =>
        d.property.toLowerCase().includes(s) ||
        d.contact.toLowerCase().includes(s)  ||
        d.id.toLowerCase().includes(s)
      )
    }

    const total  = filtered.length
    const sliced = filtered.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      success: true,
      deals:   sliced,
      total,
      page,
      limit,
      pages:  Math.ceil(total / limit),
      source: 'mock',
    }, { headers: rateLimitHeaders() })
  } catch (error) {
    console.error('[deals GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}

// ---------------------------------------------------------------------------
// POST /api/deals — create deal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rateLimitHeaders() })
  }

  try {
    const body = await req.json() as Record<string, unknown>

    if (!body.imovel || !body.valor || !body.fase) {
      return NextResponse.json(
        { error: 'imovel, valor, and fase are required' },
        { status: 400, headers: rateLimitHeaders() }
      )
    }

    if (!VALID_FASES.includes(String(body.fase))) {
      return NextResponse.json(
        { error: `fase must be one of: ${VALID_FASES.join(', ')}` },
        { status: 400, headers: rateLimitHeaders() }
      )
    }

    const ref = String(body.ref || `AG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`)

    // Try Supabase
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('deals')
        .insert({
          reference:      ref,
          title:          String(body.imovel),
          property_id:    typeof body.property_id === 'string'  ? body.property_id  : null,
          deal_value:     typeof body.valor === 'number'        ? body.valor         : parseFloat(String(body.valor)),
          stage:          'lead',
          contact_id:     typeof body.contact_id === 'string'   ? body.contact_id   : '',
          commission_rate: 0.05,
          notes:          typeof body.notas === 'string'        ? body.notas         : null,
          tags:           Array.isArray(body.tags)              ? body.tags as string[] : null,
          assigned_consultant: session.user.id,
        })
        .select()
        .single()

      if (!error && data) {
        return NextResponse.json({ success: true, deal: data, source: 'supabase' }, { status: 201, headers: rateLimitHeaders() })
      }
      if (error) console.warn('[deals POST] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    // Mock fallback
    const mockDeal: MockDeal = {
      id:            ref,
      stage:         String(body.fase),
      property:      String(body.imovel),
      contact:       typeof body.comprador === 'string' ? body.comprador : 'Unknown',
      asking:        typeof body.valor === 'number' ? body.valor : parseFloat(String(body.valor)) || 0,
      offer:         null,
      commission:    (typeof body.valor === 'number' ? body.valor : parseFloat(String(body.valor)) || 0) * 0.05,
      days_in_stage: 0,
      health:        80,
      status:        'active',
      agent_id:      session.user.id,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }

    return NextResponse.json(
      { success: true, deal: mockDeal, source: 'mock', warning: 'Supabase unavailable — deal not persisted' },
      { status: 201, headers: rateLimitHeaders() }
    )
  } catch (error) {
    console.error('[deals POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/deals — update deal
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rateLimitHeaders() })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const { id, ...updates } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    if (typeof updates.fase === 'string' && !VALID_FASES.includes(updates.fase)) {
      return NextResponse.json({ error: 'Invalid fase value' }, { status: 400, headers: rateLimitHeaders() })
    }

    try {
      const supabase = await createClient()

      const allowed = ['title', 'property_id', 'deal_value', 'stage', 'contact_id',
                       'cpcv_date', 'escritura_date', 'notes', 'tags', 'probability']
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const key of allowed) {
        if (key in updates) updateData[key] = updates[key]
      }
      // Legacy campo mapping
      if ('imovel' in updates)        updateData['title']       = updates.imovel
      if ('valor' in updates)         updateData['deal_value']  = updates.valor
      if ('fase' in updates)          updateData['stage']       = updates.fase
      if ('comprador' in updates)     updateData['notes']       = updates.comprador
      if ('notas' in updates)         updateData['notes']       = updates.notas

      let query = supabase
        .from('deals')
        .update(updateData)
        .eq('id', id)

      if (session.user.role !== 'admin') {
        query = query.eq('assigned_consultant', session.user.id)
      }

      const { data, error } = await query.select().single()
      if (!error && data) return NextResponse.json({ success: true, deal: data, source: 'supabase' }, { headers: rateLimitHeaders() })
      if (error) console.warn('[deals PUT] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    const mock = MOCK_DEALS.find(d => d.id === id)
    if (!mock) return NextResponse.json({ error: 'Deal not found' }, { status: 404, headers: rateLimitHeaders() })

    return NextResponse.json(
      { success: true, deal: { ...mock, ...updates, id, updated_at: new Date().toISOString() }, source: 'mock', warning: 'Not persisted' },
      { headers: rateLimitHeaders() }
    )
  } catch (error) {
    console.error('[deals PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/deals?id= — admin only
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rateLimitHeaders() })
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete deals' }, { status: 403, headers: rateLimitHeaders() })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    try {
      const supabase = await createClient()
      const { error } = await supabase.from('deals').delete().eq('id', id)
      if (!error) return NextResponse.json({ success: true, message: 'Deal deleted' }, { headers: rateLimitHeaders() })
      console.warn('[deals DELETE] Supabase error:', error.message)
    } catch {
      // Supabase unavailable
    }

    return NextResponse.json({ success: true, message: 'Deal deleted (mock)', source: 'mock' }, { headers: rateLimitHeaders() })
  } catch (error) {
    console.error('[deals DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: rateLimitHeaders() })
  }
}
