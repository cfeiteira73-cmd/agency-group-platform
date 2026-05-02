// GET /api/commercial/partner-tiers
// Returns current partner tier rankings for agents and investors.

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin || !hasPermission(admin.role, 'commercial:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const partnerType = searchParams.get('type')   // agent | investor | null (all)
  const tier        = searchParams.get('tier')   // ELITE | PRIORITY | STANDARD | WATCHLIST | null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('partner_tiers')
      .select('*')
      .order('tier_score', { ascending: false })

    if (partnerType) query = query.eq('partner_type', partnerType)
    if (tier)        query = query.eq('tier', tier)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const rows = (data ?? []) as Array<{ tier: string; partner_type: string }>
    const summary = {
      agents:    { ELITE: 0, PRIORITY: 0, STANDARD: 0, WATCHLIST: 0 },
      investors: { ELITE: 0, PRIORITY: 0, STANDARD: 0, WATCHLIST: 0 },
    }
    for (const r of rows) {
      const group = r.partner_type === 'agent' ? 'agents' : 'investors'
      if (r.tier in summary[group]) summary[group][r.tier as keyof typeof summary.agents]++
    }

    return NextResponse.json({ partners: rows, summary, total: rows.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
