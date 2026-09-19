// =============================================================================
// GET /api/deal-packs — List deal packs (portal auth required)
// Query: ?status=ready&limit=50&offset=0
//
// D2-B-DEALPACK-AUTH:
//   service_token → 403 (not a human actor)
//   is_active NULL → 403 (fail-closed per §4)
//   admin → sees all packs in tenant
//   agent → sees own packs only (created_by = actor.email)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import { resolveActor } from '@/lib/auth/commercialAuth'
import type { DealPackStatus } from '@/lib/database.types'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  // §19: service tokens must not bypass object-level authorization
  if (gate.via === 'service_token') {
    return NextResponse.json(
      { error: 'Service tokens cannot list deal packs — human actor required' },
      { status: 403 }
    )
  }

  // §4: fail-closed is_active check — NULL treated as inactive for deal pack ops
  const actorResult = await resolveActor(gate.email, supabase, { failClosed: true })
  if (!actorResult.ok) {
    return NextResponse.json({ error: actorResult.error }, { status: actorResult.status })
  }
  const actor = actorResult.actor

  try {
    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')
    const limit   = Math.min(parseInt(searchParams.get('limit')  || '100'), 200)
    const offset  = parseInt(searchParams.get('offset') || '0')

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (supabaseAdmin as any)
      .from('deal_packs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // §20: admin sees all packs; agents see only their own
    if (!actor.isAdmin) {
      query = query.eq('created_by', actor.email)
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
      console.error('[deal-packs GET] error:', error, { corrId })
      return NextResponse.json({ error: 'Erro ao carregar deal packs' }, { status: 500 })
    }

    return NextResponse.json({
      deal_packs: data ?? [],
      total: count ?? (data?.length ?? 0),
      limit,
      offset,
    })
  } catch (err) {
    console.error('[deal-packs GET] error:', err, { corrId })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
