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
// Mock fallback
// ---------------------------------------------------------------------------

const MOCK_INVESTORS: InvestorRow[] = [
  {
    id: 1, name: 'James Mitchell', nationality: 'UK', flag: '🇬🇧',
    type: 'family_office', capitalMin: 5000000, capitalMax: 20000000,
    yieldTarget: 3.5, horizonYears: 10, riskProfile: 'moderado',
    zonas: ['Lisboa'], tipoImovel: ['Apartamento', 'Moradia'],
    ocupacao: 'arrendamento_longa', status: 'activo',
    lastContact: '2026-04-01', totalInvested: 12500000, dealsHistory: 3,
    notes: 'Prefere imóveis prime Lisboa. Fundo familiar multi-geracional.',
    email: 'james.mitchell@mitchellfamily.co.uk', phone: '+44 7700 900123',
    tags: ['Lisboa Prime', 'Long-term', 'Off-market'],
  },
  {
    id: 2, name: 'Marie-Claire Dubois', nationality: 'FR', flag: '🇫🇷',
    type: 'hnwi', capitalMin: 1000000, capitalMax: 3000000,
    yieldTarget: 4.5, horizonYears: 7, riskProfile: 'moderado',
    zonas: ['Comporta', 'Alentejo'], tipoImovel: ['Herdade', 'Moradia'],
    ocupacao: 'uso_proprio', status: 'activo',
    lastContact: '2026-03-28', totalInvested: 2200000, dealsHistory: 1,
    notes: 'Procura second home + AL. Francesa executiva.',
    email: 'mc.dubois@gmail.com', phone: '+33 6 12 34 56 78',
    tags: ['Comporta', 'Lifestyle', 'NHR'],
  },
  {
    id: 3, name: 'Khalid Al-Rashidi', nationality: 'AE', flag: '🇦🇪',
    type: 'hnwi', capitalMin: 3000000, capitalMax: 10000000,
    yieldTarget: 4.0, horizonYears: 5, riskProfile: 'agressivo',
    zonas: ['Lisboa', 'Cascais'], tipoImovel: ['Apartamento', 'Moradia'],
    ocupacao: 'qualquer', status: 'activo',
    lastContact: '2026-04-02', totalInvested: 6800000, dealsHistory: 2,
    notes: 'Investidor Dubai. Golden Visa concluído.',
    email: 'khalid@alrashidi-inv.ae', phone: '+971 50 123 4567',
    tags: ['Golden Visa', 'Portfolio', 'UAE'],
  },
  {
    id: 4, name: 'Chen Wei', nationality: 'CN', flag: '🇨🇳',
    type: 'buy_hold', capitalMin: 2000000, capitalMax: 5000000,
    yieldTarget: 5.0, horizonYears: 8, riskProfile: 'moderado',
    zonas: ['Porto', 'Lisboa'], tipoImovel: ['Apartamento', 'Comercial'],
    ocupacao: 'arrendamento_longa', status: 'activo',
    lastContact: '2026-03-15', totalInvested: 3400000, dealsHistory: 2,
    notes: 'Investidor Shanghai. Foco yield + capital appreciation.',
    email: 'chenwei@greatwall-cap.com', phone: '+86 135 0000 1234',
    tags: ['Porto', 'Yield', 'Buy & Hold'],
  },
  {
    id: 5, name: 'Francisco Santos', nationality: 'PT', flag: '🇵🇹',
    type: 'yield_hunter', capitalMin: 500000, capitalMax: 2000000,
    yieldTarget: 6.0, horizonYears: 5, riskProfile: 'moderado',
    zonas: ['Porto'], tipoImovel: ['Apartamento'],
    ocupacao: 'AL', status: 'activo',
    lastContact: '2026-04-03', totalInvested: 1200000, dealsHistory: 4,
    notes: 'Investidor português experiente. AL Porto Foz.',
    email: 'fsantos@gmail.com', phone: '+351 912 345 678',
    tags: ['Porto', 'AL', 'Yield Hunter'],
  },
]

// ---------------------------------------------------------------------------
// Map Supabase row → InvestorRow
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any, idx: number): InvestorRow {
  return {
    id: typeof row.id === 'number' ? row.id : idx + 1,
    name: row.name ?? row.full_name ?? '',
    nationality: row.nationality ?? '',
    flag: row.flag ?? '',
    type: row.type ?? row.investor_type ?? 'hnwi',
    capitalMin: row.capital_min ?? row.capitalMin ?? 0,
    capitalMax: row.capital_max ?? row.capitalMax ?? 0,
    yieldTarget: row.yield_target ?? row.yieldTarget ?? 0,
    horizonYears: row.horizon_years ?? row.horizonYears ?? 5,
    riskProfile: row.risk_profile ?? row.riskProfile ?? 'moderado',
    zonas: Array.isArray(row.zonas) ? row.zonas : (row.zonas ? [row.zonas] : []),
    tipoImovel: Array.isArray(row.tipo_imovel) ? row.tipo_imovel : (row.tipo_imovel ? [row.tipo_imovel] : []),
    ocupacao: row.ocupacao ?? 'qualquer',
    status: row.status ?? 'activo',
    lastContact: row.last_contact ?? row.lastContact ?? row.last_contact_at?.slice(0, 10) ?? '',
    totalInvested: row.total_invested ?? row.totalInvested ?? 0,
    dealsHistory: row.deals_history ?? row.dealsHistory ?? 0,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from('investidores')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data && (data as unknown[]).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const investors = (data as any[]).map(mapRow)
      return NextResponse.json({ data: investors, source: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Table may not exist yet — return mock with note
    return NextResponse.json(
      { data: MOCK_INVESTORS, source: 'mock' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { data: MOCK_INVESTORS, source: 'mock' },
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from('investidores')
      .insert([{
        name: body.name,
        nationality: body.nationality,
        flag: body.flag,
        type: body.type,
        capital_min: body.capitalMin,
        capital_max: body.capitalMax,
        yield_target: body.yieldTarget,
        horizon_years: body.horizonYears,
        risk_profile: body.riskProfile,
        zonas: body.zonas,
        tipo_imovel: body.tipoImovel,
        ocupacao: body.ocupacao,
        status: (body.status as string) ?? 'activo',
        last_contact: body.lastContact,
        total_invested: (body.totalInvested as number) ?? 0,
        deals_history: (body.dealsHistory as number) ?? 0,
        notes: (body.notes as string) ?? '',
        email: (body.email as string) ?? '',
        phone: (body.phone as string) ?? '',
        tags: (body.tags as string[]) ?? [],
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
