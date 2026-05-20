import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

function isBearerAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secrets = [
    process.env.PORTAL_API_SECRET,
    process.env.CRON_SECRET,
    process.env.ADMIN_SECRET,
  ].filter(Boolean) as string[]
  return secrets.some(s => safeCompare(authHeader, `Bearer ${s}`))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)
  const startedAt = new Date().toISOString()

  const bearerOk = isBearerAuthorized(req)
  if (!bearerOk) {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const cutoffIso = cutoff.toISOString()

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    const { data, error } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, full_name, email, phone, last_contact_at, lead_score, status, preferred_locations, budget_max, lead_tier')
      .eq('tenant_id', tenantId)
      .in('status', ['lead', 'prospect'])
      .or(`last_contact_at.lt.${cutoffIso},last_contact_at.is.null`)
      .order('lead_score', { ascending: false })
      .limit(50)

    if (error) throw error

    // Best-effort audit log — non-blocking
    try {
      await supabaseAdmin.from('automations_log').insert({
        workflow_name: 'dormant-leads',
        trigger_type: 'api',
        status: 'success',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        outcome: {
          dormant_count: data?.length || 0,
          cutoff_date: cutoffStr,
          correlation_id: corrId,
        },
      })
    } catch { /* silent */ }

    return NextResponse.json({
      dormant: data || [],
      count: data?.length || 0,
      cutoff_date: cutoffStr,
      generated_at: new Date().toISOString(),
      correlation_id: corrId,
    }, {
      headers: { 'x-correlation-id': corrId },
    })
  } catch (error) {
    // Mock fallback
    return NextResponse.json({
      dormant: [],
      count: 0,
      source: 'error',
      error: String(error),
      correlation_id: corrId,
    }, {
      headers: { 'x-correlation-id': corrId },
    })
  }
}
