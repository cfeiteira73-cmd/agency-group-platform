import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const zona     = searchParams.get('zona')
    const tipo     = searchParams.get('tipo')
    const maxPreco = searchParams.get('max_preco') ? parseInt(searchParams.get('max_preco')!) : null
    const status   = searchParams.get('status') ?? 'active'

    if (!supabaseAdmin) {
      return NextResponse.json({ data: [], source: 'error', error: 'Supabase not configured' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabaseAdmin
      .from('properties')
      .select('*')
      .order('preco', { ascending: false })

    if (status && status !== 'all') query = query.eq('status', status)
    if (zona)     query = query.eq('zona', zona)
    if (tipo)     query = query.eq('tipo', tipo)
    if (maxPreco) query = query.lte('preco', maxPreco)

    const { data, error } = await query

    if (error || !data) {
      console.error('[properties GET]', error)
      return NextResponse.json({ data: [], source: 'error' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = (data as any[]).map((row) => ({
      id:         row.id,
      nome:       row.nome       || '',
      zona:       row.zona       || '',
      bairro:     row.bairro     || '',
      tipo:       row.tipo       || '',
      preco:      row.preco      || 0,
      area:       row.area       || 0,
      quartos:    row.quartos    || 0,
      casasBanho: row.casas_banho || 0,
      energia:    row.energia    || '',
      status:     row.status     || 'active',
      descricao:  row.descricao  || '',
      features:   Array.isArray(row.features) ? row.features : [],
      gradient:   row.gradient   || 'from-slate-800 to-gray-900',
    }))

    return NextResponse.json({ data: mapped, total: mapped.length, source: 'supabase' })
  } catch (error) {
    console.error('[properties GET]', error)
    return NextResponse.json({ data: [], source: 'error' }, { status: 500 })
  }
}
