import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

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

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('id, full_name, email, phone, last_contact_at, lead_score, status, preferred_locations, budget_max, lead_tier')
      .in('status', ['lead', 'prospect'])
      .or(`last_contact_at.lt.${cutoffIso},last_contact_at.is.null`)
      .order('lead_score', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({
      dormant: data || [],
      count: data?.length || 0,
      cutoff_date: cutoffStr,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    // Mock fallback
    return NextResponse.json({
      dormant: [],
      count: 0,
      source: 'error',
      error: String(error),
    })
  }
}
