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
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import track from '@/lib/trackLearningEvent'

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
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabaseAdmin.from('deals') as any)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (agentId) {
        query = query.eq('agent_id', agentId)
      }

      if (fase && fase !== 'all')     query = query.eq('fase', fase)
      // Note: deals table has no 'status' column — status filter is mock-only
      if (minValue !== null)          query = query.gte('valor', minValue)
      if (search) {
        query = query.or(
          `imovel.ilike.%${search}%,comprador.ilike.%${search}%,ref.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query

      if (!error && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row, idx) => ({
          // Use portal-compat columns if available (from migration 003), fall back to complex schema columns
          id: typeof row.id === 'number' ? row.id : idx + 1,  // sequential numeric ID since UUID→parseInt fails
          ref: row.ref || row.reference || '',
          imovel: row.imovel || row.title || '',
          valor: row.valor || (row.deal_value ? `€ ${Number(row.deal_value).toLocaleString('pt-PT')}` : '€0'),
          fase: row.fase || row.stage || 'Contacto',
          comprador: row.comprador || '',
          cpcvDate: row.cpcv_date_text || row.cpcv_date || '',
          escrituraDate: row.escritura_date_text || row.escritura_date || '',
          checklist: {},
          notas: row.notas || row.notes || '',
          propertyId: row.property_id || null,
        }))

        return NextResponse.json({
          data:   mapped,
          total:  count ?? mapped.length,
          page,
          limit,
          pages:  Math.ceil((count ?? mapped.length) / limit),
          source: 'supabase',
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

    // Normalise v2 stage names → v1 portal stage names so kanban columns always match
    const STAGE_V2_TO_V1: Record<string, string> = {
      'Contacto':    'Angariação',
      'Qualificado': 'Angariação',
      'Visita':      'Proposta Enviada',
      'Proposta':    'Proposta Enviada',
      'Negociação':  'Proposta Aceite',
      'CPCV':        'CPCV Assinado',
      'Escritura':   'Escritura Marcada',
    }

    // Map mock data to the Deal interface expected by the portal
    const mappedMock = sliced.map((d, i) => ({
      id: i + 1,  // sequential numeric ID for mock deals
      ref: d.id,
      imovel: d.property,
      valor: `€ ${Number(d.asking).toLocaleString('pt-PT')}`,
      fase: STAGE_V2_TO_V1[d.stage] ?? d.stage,
      comprador: d.contact,
      cpcvDate: '',
      escrituraDate: '',
      checklist: {},
      notas: '',
      propertyId: null,
    }))

    return NextResponse.json({
      data:   mappedMock,
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
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Try Supabase (uses portal-compat columns from migration 003)
    try {
      const valorNum = typeof body.valor === 'number' ? body.valor : parseFloat(String(body.valor)) || 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin.from('deals') as any)
        .insert({
          // Portal-friendly columns (added by migration 003_portal_compat.sql)
          ref,
          imovel:      String(body.imovel),
          valor:       `€ ${valorNum.toLocaleString('pt-PT')}`,
          fase:        String(body.fase || 'Contacto'),
          comprador:   typeof body.comprador === 'string'   ? body.comprador    : null,
          notas:       typeof body.notas === 'string'       ? body.notas        : null,
          // Standard columns (migration 001)
          title:       String(body.imovel),  // mirror imovel as title for schema compliance
          deal_value:  valorNum,
          property_id: typeof body.property_id === 'string' ? body.property_id : null,
          agent_id:    typeof body.agent_id === 'string'    ? body.agent_id     : null,
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
      agent_id:      typeof body.agent_id === 'string' ? body.agent_id : null,
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
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as Record<string, unknown>
    const { id, ref, ...updates } = body

    if (!id && !ref) {
      return NextResponse.json({ error: 'id or ref is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    if (typeof updates.fase === 'string' && !VALID_FASES.includes(updates.fase)) {
      return NextResponse.json({ error: 'Invalid fase value' }, { status: 400, headers: rateLimitHeaders() })
    }

    try {
      const allowed = ['ref', 'imovel', 'valor', 'fase', 'comprador', 'contact_id',
                       'cpcv_date', 'escritura_date', 'notas', 'agent_id', 'property_id']
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const key of allowed) {
        if (key in updates) updateData[key] = updates[key]
      }

      // Support both UUID id and ref-based lookups
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabaseAdmin.from('deals') as any).update(updateData)
      if (id && typeof id === 'string') {
        query = query.eq('id', id)
      } else if (ref && typeof ref === 'string') {
        query = query.eq('ref', ref)
      }
      const { data, error } = await query.select().single()
      if (!error && data) {
        // ── Learning events on stage transitions ─────────────────────────────
        if (typeof updates.fase === 'string') {
          const fase   = updates.fase as string
          const dealId = (id ?? ref ?? data?.id) as string | undefined
          const agentEmail = (session?.user?.email ?? null) as string | null
          const basePayload = {
            deal_id:     dealId ?? null,
            agent_email: agentEmail,
            metadata:    { fase, deal_ref: ref ?? id },
          }

          if (['Proposta Enviada', 'Proposta'].includes(fase)) {
            track.proposalSent(basePayload)
          } else if (['CPCV Assinado', 'CPCV', 'CPCV_assinado'].includes(fase)) {
            track.cpcvSigned(basePayload)
          } else if (['Escritura Concluída', 'pos_venda'].includes(fase)) {
            track.closed(basePayload)
          } else if (['Perdido', 'Rejeitado', 'lost', 'rejected'].includes(fase)) {
            track.rejected(basePayload)
          } else if (['Visita', 'visita_agendada', 'Visita Agendada'].includes(fase)) {
            track.callBooked(basePayload)
          }
        }
        return NextResponse.json({ success: true, deal: data, source: 'supabase' }, { headers: rateLimitHeaders() })
      }
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
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: rateLimitHeaders() })
    }

    try {
      const { error } = await supabaseAdmin.from('deals').delete().eq('id', id)
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
