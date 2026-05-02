// GET  /api/commercial/commissions — list commission records
// POST /api/commercial/commissions — create or update a commission record

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { recordCommission, computeCommission } from '@/lib/commercial/revenueAttribution'
import { supabaseAdmin }             from '@/lib/supabase'
import { logAction }                 from '@/lib/auth/auditLog'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin || !hasPermission(admin.role, 'commercial:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const agentEmail  = searchParams.get('agent_email')
  const payoutStatus = searchParams.get('payout_status')
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('commission_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (agentEmail)   query = query.eq('agent_email', agentEmail)
    if (payoutStatus) query = query.eq('payout_status', payoutStatus)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const rows = data ?? []
    const totalExpected  = rows.reduce((s: number, r: { expected_commission: number | null }) => s + (r.expected_commission ?? 0), 0)
    const totalRealized  = rows.reduce((s: number, r: { realized_commission: number | null }) => s + (r.realized_commission ?? 0), 0)

    return NextResponse.json({
      commissions:      rows,
      total:            rows.length,
      total_expected:   parseFloat(totalExpected.toFixed(2)),
      total_realized:   parseFloat(totalRealized.toFixed(2)),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminRole(token.email as string)
  if (!admin || !hasPermission(admin.role, 'commercial:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    property_id:              string
    agent_email:              string
    sale_price:               number
    split_pct?:               number
    split_counterpart_email?: string
    cpcv_date?:               string
    escritura_date?:          string
    notes?:                   string
    commission_rate?:         number
  }

  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.property_id || !body.agent_email || !body.sale_price) {
    return NextResponse.json({ error: 'property_id, agent_email, sale_price required' }, { status: 400 })
  }

  try {
    const breakdown = computeCommission(body.sale_price, body.commission_rate ?? 0.05, body.split_pct ?? 100)
    const id = await recordCommission(
      body.property_id,
      body.agent_email,
      body.sale_price,
      body.split_pct ?? 100,
      {
        splitCounterpartEmail: body.split_counterpart_email,
        cpcvDate:              body.cpcv_date,
        escrituraDate:         body.escritura_date,
        notes:                 body.notes,
        commissionRate:        body.commission_rate,
      },
    )

    await logAction({
      actor_email:   token.email as string,
      actor_role:    admin.role,
      action_type:   'update_commission',
      resource_type: 'commission_record',
      resource_id:   id,
      new_value:     { property_id: body.property_id, agent_email: body.agent_email, expected: breakdown.commission_total },
    })

    return NextResponse.json({ id, breakdown })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
