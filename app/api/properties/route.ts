import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const zona     = searchParams.get('zona')
    const tipo     = searchParams.get('tipo')
    const maxPreco = searchParams.get('max_preco') ? parseInt(searchParams.get('max_preco')!) : null
    const status   = searchParams.get('status') ?? 'active'
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    if (!supabaseAdmin) {
      return NextResponse.json({ data: [], source: 'error', error: 'Supabase not configured' })
    }

    // Try with portal-compat columns (migration 003)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabaseAdmin as any)
        .from('properties')
        .select('id, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, energia, status, descricao, features, gradient')
        .not('nome', 'is', null)  // Only portal-populated rows
        .limit(limit)

      if (status && status !== 'all') query = query.eq('status', status)
      if (zona)     query = query.eq('zona', zona)
      if (tipo)     query = query.eq('tipo', tipo)
      if (maxPreco) query = query.lte('preco', maxPreco)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
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
      }
    } catch {
      // Portal-compat columns might not exist yet (pre-migration 003)
      // Fall through to complex schema attempt
    }

    // Try with complex Supabase schema (migration 001)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabaseAdmin as any)
        .from('properties')
        .select('id, title, zone, city, type, price, area_m2, bedrooms, bathrooms, energy_certificate, status, description, features')
        .limit(limit)

      if (status && status !== 'all') query = query.eq('status', status)
      if (zona)     query = query.eq('zone', zona)
      if (tipo)     query = query.eq('type', tipo)
      if (maxPreco) query = query.lte('price', maxPreco)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map((row) => ({
          id:         row.id,
          nome:       row.title      || '',
          zona:       row.zone       || row.city || '',
          bairro:     '',
          tipo:       row.type       || '',
          preco:      row.price      || 0,
          area:       row.area_m2    || 0,
          quartos:    row.bedrooms   || 0,
          casasBanho: row.bathrooms  || 0,
          energia:    row.energy_certificate || '',
          status:     row.status     || 'active',
          descricao:  row.description || '',
          features:   Array.isArray(row.features) ? row.features : [],
          gradient:   'from-slate-800 to-gray-900',
        }))
        .filter((p: { nome: string }) => p.nome)

        return NextResponse.json({ data: mapped, total: mapped.length, source: 'supabase' })
      }
    } catch {
      // Supabase unavailable or schema mismatch
    }

    // Return empty — component will use PORTAL_PROPERTIES fallback
    return NextResponse.json({ data: [], total: 0, source: 'empty' })
  } catch (error) {
    console.error('[properties GET]', error)
    return NextResponse.json({ data: [], source: 'error' }, { status: 500 })
  }
}
