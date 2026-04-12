// =============================================================================
// Agency Group — Risk Flags API
// GET /api/offmarket-leads/risk-flags
// Returns leads with active risk flags from offmarket_risk_flags view
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const severity = sp.get('severity') // 'high' | 'all'
    const limit = Math.min(100, parseInt(sp.get('limit') ?? '50', 10))

    // Query the risk flags view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('offmarket_risk_flags')
      .select('*')
      .not('risk_flags', 'eq', '{}')  // only rows that have at least one flag
      .order('score', { ascending: false })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      // Fallback: view may not exist yet (migration not run), compute in JS
      console.warn('[risk-flags] View not available, computing inline:', error.message)
      return await computeRiskFlagsInline(req)
    }

    // Filter to only leads with non-empty risk_flags array
    const flagged = (data ?? []).filter((row: { risk_flags: string[] | null }) =>
      Array.isArray(row.risk_flags) && row.risk_flags.length > 0
    )

    // Filter by severity if requested
    const HIGH_FLAGS = ['sla_breach', 'high_score_no_action', 'matched_not_contacted', 'cpcv_deadline_soon', 'escritura_deadline_soon']
    const filtered = severity === 'high'
      ? flagged.filter((r: { risk_flags: string[] }) => r.risk_flags.some((f: string) => HIGH_FLAGS.includes(f)))
      : flagged

    return NextResponse.json({ data: filtered, total: filtered.length })
  } catch (err) {
    console.error('[risk-flags GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fallback: compute risk flags from raw offmarket_leads if view doesn't exist yet
async function computeRiskFlagsInline(req: NextRequest): Promise<NextResponse> {
  try {
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leads, error } = await (supabaseAdmin as any)
      .from('offmarket_leads')
      .select('id,nome,score,status,assigned_to,deal_risk_level,created_at,last_contact_at,next_followup_at,sla_breach,sla_contacted_at,matched_to_buyers,buyer_matched_at,cpcv_target_date,cpcv_signed_at,escritura_target_date,escritura_done_at,deal_next_step_date')
      .not('status', 'in', '("closed_won","closed_lost")')
      .order('score', { ascending: false })
      .limit(limit)

    if (error) throw error

    const now = Date.now()

    const flagged = (leads ?? []).map((lead: Record<string, unknown>) => {
      const flags: string[] = []
      const createdAt = new Date(lead.created_at as string).getTime()
      const lastContact = lead.last_contact_at ? new Date(lead.last_contact_at as string).getTime() : null
      const score = lead.score as number | null

      if (lead.sla_breach) flags.push('sla_breach')
      if (score !== null && score >= 70 && !lead.sla_contacted_at && lead.status === 'new') {
        const hours = (now - createdAt) / 3600000
        if (hours > 2) flags.push('high_score_no_action')
      }
      if (lead.next_followup_at && new Date(lead.next_followup_at as string).getTime() < now) flags.push('no_followup_set')
      if (!lead.assigned_to) flags.push('no_owner_assigned')
      if (lead.matched_to_buyers && lead.status === 'new') {
        const matchedAt = lead.buyer_matched_at ? new Date(lead.buyer_matched_at as string).getTime() : createdAt
        if ((now - matchedAt) / 3600000 > 4) flags.push('matched_not_contacted')
      }
      if (lastContact && ['contacted','interested'].includes(lead.status as string)) {
        if ((now - lastContact) / 86400000 > 14) flags.push('stale_hot_lead')
      }
      if (lead.cpcv_target_date && !lead.cpcv_signed_at) {
        const daysLeft = (new Date(lead.cpcv_target_date as string).getTime() - now) / 86400000
        if (daysLeft < 7 && daysLeft >= 0) flags.push('cpcv_deadline_soon')
      }
      if (lead.escritura_target_date && !lead.escritura_done_at) {
        const daysLeft = (new Date(lead.escritura_target_date as string).getTime() - now) / 86400000
        if (daysLeft < 14 && daysLeft >= 0) flags.push('escritura_deadline_soon')
      }
      if (lead.deal_next_step_date && new Date(lead.deal_next_step_date as string).getTime() < now) {
        flags.push('next_step_overdue')
      }

      return { ...lead, risk_flags: flags }
    }).filter((l: { risk_flags: string[] }) => l.risk_flags.length > 0)

    return NextResponse.json({ data: flagged, total: flagged.length })
  } catch (err) {
    console.error('[risk-flags fallback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
