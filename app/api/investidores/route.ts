// =============================================================================
// AGENCY GROUP — Investidores API v1.0
// GET  /api/investidores — list investors from Supabase (mock fallback)
// POST /api/investidores — create new investor
// AMI: 22506 | Supabase-first, mock fallback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvestorRow {
  id: number
  name: string
  nationality: string
  flag: string
  type: string
  capitalMin: number
  capitalMax: number
  yieldTarget: number
  horizonYears: number
  riskProfile: string
  zonas: string[]
  tipoImovel: string[]
  ocupacao: string
  status: string
  lastContact: string
  totalInvested: number
  dealsHistory: number
  notes: string
  email: string
  phone: string
  tags: string[]
}

// ---------------------------------------------------------------------------
// Map Supabase row → InvestorRow
// ---------------------------------------------------------------------------

type InvestidoresRow = {
  id: string; nome: string; email: string | null; telefone: string | null;
  whatsapp: string | null; nacionalidade: string | null; flag: string | null;
  tipo: string | null; capital_min: number | null; capital_max: number | null;
  yield_target: number | null; horizon_years: number | null; risk_profile: string | null;
  zonas: string[] | null; tipo_imovel: string[] | null; ocupacao: string | null;
  status: string | null; last_contact: string | null; total_invested: number | null;
  deals_history: number | null; notes: string | null; phone: string | null;
  tags: string[] | null; created_at: string; updated_at: string;
}

function mapRow(row: InvestidoresRow, idx: number): InvestorRow {
  return {
    id: idx + 1,
    name: row.nome ?? '',
    nationality: row.nacionalidade ?? '',
    flag: row.flag ?? '',
    type: row.tipo ?? 'hnwi',
    capitalMin: row.capital_min ?? 0,
    capitalMax: row.capital_max ?? 0,
    yieldTarget: row.yield_target ?? 0,
    horizonYears: row.horizon_years ?? 5,
    riskProfile: row.risk_profile ?? 'moderado',
    zonas: Array.isArray(row.zonas) ? row.zonas : (row.zonas ? [row.zonas] : []),
    tipoImovel: Array.isArray(row.tipo_imovel) ? row.tipo_imovel : (row.tipo_imovel ? [row.tipo_imovel] : []),
    ocupacao: row.ocupacao ?? 'qualquer',
    status: row.status ?? 'activo',
    lastContact: row.last_contact ?? '',
    totalInvested: row.total_invested ?? 0,
    dealsHistory: row.deals_history ?? 0,
    notes: row.notes ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
  }
}

// ---------------------------------------------------------------------------
// GET /api/investidores
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  void req // parameter required by Next.js route handler signature

  try {
    const { data, error } = await supabaseAdmin.from('investidores')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const investors = data.map(mapRow)
      return NextResponse.json({ data: investors, source: 'supabase', total: investors.length }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Table unavailable — return empty (no mock data in production)
    return NextResponse.json(
      { data: [], source: 'empty', total: 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { data: [], source: 'unavailable', total: 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/investidores — create new investor
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  try {
    const rawBody = await req.json()

    const ALLOWED_INVESTOR_FIELDS = new Set([
      'nome', 'email', 'telefone', 'whatsapp', 'budget_min', 'budget_max',
      'paises_interesse', 'tipo_investimento', 'perfil_risco', 'notas',
      'fonte', 'status', 'nhr_interesse', 'lingua_preferida', 'nacionalidade',
      'retorno_esperado', 'horizonte_investimento', 'montante_disponivel',
      // camelCase aliases used in the insert mapping below
      'name', 'nationality', 'flag', 'type', 'capitalMin', 'capitalMax',
      'yieldTarget', 'horizonYears', 'riskProfile', 'zonas', 'tipoImovel',
      'ocupacao', 'lastContact', 'totalInvested', 'dealsHistory', 'phone', 'tags',
    ])
    const safeInput: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawBody as Record<string, unknown>)) {
      if (ALLOWED_INVESTOR_FIELDS.has(key)) safeInput[key] = value
    }
    const body = safeInput

    const { data, error } = await supabaseAdmin.from('investidores')
      .insert([{
        nome:          (body.name ?? body.nome) as string,
        nacionalidade: (body.nationality ?? body.nacionalidade) as string | undefined,
        flag:          body.flag as string | undefined,
        tipo:          (body.type ?? body.tipo) as 'family_office' | 'hnwi' | 'institucional' | 'privado' | 'fundo' | undefined,
        capital_min:   body.capitalMin as number | undefined,
        capital_max:   body.capitalMax as number | undefined,
        yield_target:  body.yieldTarget as number | undefined,
        horizon_years: body.horizonYears as number | undefined,
        risk_profile:  body.riskProfile as string | undefined,
        zonas:         body.zonas as string[] | undefined,
        tipo_imovel:   body.tipoImovel as string[] | undefined,
        ocupacao:      body.ocupacao as string | undefined,
        status:        (body.status as string) ?? 'activo',
        last_contact:  body.lastContact as string | undefined,
        total_invested: (body.totalInvested as number) ?? 0,
        deals_history:  (body.dealsHistory as number) ?? 0,
        notes:         (body.notes as string) ?? '',
        email:         (body.email as string) ?? '',
        phone:         (body.phone as string) ?? '',
        tags:          (body.tags as string[]) ?? [],
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: mapRow(data, 0) }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
