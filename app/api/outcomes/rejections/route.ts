// POST  /api/outcomes/rejections  — record a deal rejection
// GET   /api/outcomes/rejections  — rejection taxonomy analytics

import { NextRequest, NextResponse }    from 'next/server'
import { getAdminRole, hasPermission }  from '@/lib/auth/adminAuth'
import {
  buildRejectionRecord,
  recordRejection,
  classifyRejectionCategory,
} from '@/lib/intelligence/outcomeCapture'
import { supabaseAdmin }                from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: taxonomy, error: taxError } = await (supabaseAdmin as any)
      .from('v_rejection_taxonomy')
      .select('*')

    if (taxError) throw taxError

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recent, error: recError } = await (supabaseAdmin as any)
      .from('opportunity_rejections')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (recError) throw recError

    return NextResponse.json({ taxonomy: taxonomy ?? [], recent: recent ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const isService  = authHeader === process.env.CRON_SECRET
  let actorEmail   = 'service'

  if (!isService) {
    const user = await getAdminRole(authHeader ?? '')
    if (!user || !hasPermission(user.role, 'commercial:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    actorEmail = user.user_email
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { property_id, rejection_reason, rejection_category } = body
  if (!property_id || typeof property_id !== 'string') {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  }

  const category = rejection_category as string
    ?? (rejection_reason ? classifyRejectionCategory(rejection_reason as string) : 'other')

  try {
    const record = buildRejectionRecord(property_id, category as Parameters<typeof buildRejectionRecord>[1], {
      distributionEventId: body.distribution_event_id as string | undefined,
      recipientEmail:      body.recipient_email       as string | undefined,
      recipientType:       body.recipient_type        as 'agent' | 'investor' | undefined,
      rejectionReason:     rejection_reason           as string | undefined,
      lostToCompetitor:    Boolean(body.lost_to_competitor),
      competitorPrice:     body.competitor_price != null ? Number(body.competitor_price) : undefined,
      scoreAtTime:         body.score_at_time   != null ? Number(body.score_at_time)    : undefined,
      gradeAtTime:         body.grade_at_time          as string | undefined,
    })

    const id = await recordRejection(record)
    return NextResponse.json({ success: true, id, actor: actorEmail })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
