// =============================================================================
// PUBLIC PROPERTIES API — Agency Group
// No auth required — returns active portfolio for public /imoveis page.
// Tries Supabase first; falls back to static data.ts catalog.
// Cache: 1 hour (revalidated on deploy or via on-demand ISR).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PROPERTIES } from '@/app/imoveis/data'

export const revalidate = 3600 // 1 hour ISR cache

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200)
  const zona  = searchParams.get('zona')  ?? undefined
  const tipo  = searchParams.get('tipo')  ?? undefined

  // ── Try Supabase (portal-compat columns from migration 003) ─────────────────
  if (supabaseAdmin) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabaseAdmin as any)
        .from('properties')
        .select('id, ref, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, energia, status, descricao, features, badge, gradient, lifestyle_tags, lat, lng, ambientes, imagens')
        .eq('status', 'active')
        .not('nome', 'is', null)
        .limit(limit)

      if (zona) query = query.eq('zona', zona)
      if (tipo) query = query.eq('tipo', tipo)

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data as any[]).map(row => ({
          id:          row.id          || row.ref || '',
          ref:         row.ref         || row.id  || '',
          nome:        row.nome        || '',
          zona:        row.zona        || '',
          bairro:      row.bairro      || '',
          tipo:        row.tipo        || '',
          preco:       Number(row.preco)       || 0,
          area:        Number(row.area)        || 0,
          quartos:     Number(row.quartos)     || 0,
          casasBanho:  Number(row.casas_banho) || 0,
          energia:     row.energia     || '',
          status:      row.status      || 'active',
          descricao:   row.descricao   || '',
          features:    Array.isArray(row.features)      ? row.features      : [],
          lifestyleTags: Array.isArray(row.lifestyle_tags) ? row.lifestyle_tags : [],
          badge:       row.badge       || undefined,
          gradient:    row.gradient    || undefined,
          lat:         row.lat         || undefined,
          lng:         row.lng         || undefined,
          ambientes:   row.ambientes   || undefined,
          imagens:     Array.isArray(row.imagens) ? row.imagens : [],
        }))

        return NextResponse.json(
          { data: mapped, total: mapped.length, source: 'supabase' },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          }
        )
      }
    } catch {
      // Supabase unavailable or schema mismatch — fall through to static
    }
  }

  // ── Fallback: static data.ts ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fallback: any[] = PROPERTIES
  if (zona) fallback = fallback.filter((p: any) => p.zona === zona)
  if (tipo) fallback = fallback.filter((p: any) => p.tipo === tipo)

  return NextResponse.json(
    { data: fallback.slice(0, limit), total: fallback.length, source: 'static' },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}
