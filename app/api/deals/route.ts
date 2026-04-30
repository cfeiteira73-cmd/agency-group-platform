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
// Types (MockDeal removed — Supabase is the only data source)
// ---------------------------------------------------------------------------

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

    // Supabase unavailable — return empty result with explicit note (no mock data)
    console.error('[deals GET] Supabase unavailable after retry')
    return NextResponse.json({
      data:    [],
      total:   0,
      page,
      limit,
      pages:   0,
      source:  'unavailable',
      message: 'Base de dados temporariamente indisponível. Tente novamente.',
    }, { status: 200, headers: rateLimitHeaders() })
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

    // Supabase unavailable — cannot persist deal, return 503
    console.error('[deals POST] Supabase unavailable — deal not created')
    return NextResponse.json(
      { error: 'Serviço indisponível. Deal não foi guardado. Tente novamente.' },
      { status: 503, headers: rateLimitHeaders() }
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

    // Supabase unavailable — cannot update deal
    console.error('[deals PUT] Supabase unavailable — deal not updated')
    return NextResponse.json(
      { error: 'Serviço indisponível. Alteração não foi guardada. Tente novamente.' },
      { status: 503, headers: rateLimitHeaders() }
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
