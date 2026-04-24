// =============================================================================
// GET /api/deal-packs — List deal packs (portal auth required)
// Query: ?status=ready&limit=50&offset=0
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import type { DealPackStatus } from '@/lib/database.types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await portalAuthGate(req)
  if (!auth.authed) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')
    const limit   = Math.min(parseInt(searchParams.get('limit')  || '100'), 200)
    const offset  = parseInt(searchParams.get('offset') || '0')

    let query = supabaseAdmin
      .from('deal_packs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by agent ownership if not a service token
    if (auth.via !== 'service_token') {
      query = query.eq('created_by', auth.email)
    }

    const validStatuses: DealPackStatus[] = ['draft', 'ready', 'sent', 'viewed', 'archived']
    if (status && validStatuses.includes(status as DealPackStatus)) {
      query = query.eq('status', status as DealPackStatus)
    }

    const { data, error, count } = await query

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') {
        return NextResponse.json({ deal_packs: [], total: 0, note: 'table_pending_migration' })
      }
      console.error('[deal-packs GET] error:', error)
      return NextResponse.json({ error: 'Erro ao carregar deal packs' }, { status: 500 })
    }

    return NextResponse.json({
      deal_packs: data ?? [],
      total: count ?? (data?.length ?? 0),
      limit,
      offset,
    })
  } catch (err) {
    console.error('[deal-packs GET] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
