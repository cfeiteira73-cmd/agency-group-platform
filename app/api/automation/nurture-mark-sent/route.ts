// =============================================================================
// Agency Group — Nurture Mark Sent API
// POST /api/automation/nurture-mark-sent
// Called by n8n wf-R after each successful email send
// Inserts a row into nurture_log to prevent duplicate sends
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secrets = [
    process.env.PORTAL_API_SECRET,
    process.env.CRON_SECRET,
    process.env.ADMIN_SECRET,
  ].filter(Boolean) as string[]
  return secrets.some(s => safeCompare(authHeader, `Bearer ${s}`))
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const contactId: string = String(body.contact_id ?? '').trim()
    const sequenceDay: number = Number(body.sequence_day)
    const email: string = String(body.email ?? '').trim()

    if (!contactId || !sequenceDay || !email) {
      return NextResponse.json(
        { error: 'contact_id, sequence_day, and email are required' },
        { status: 400 }
      )
    }

    // Ensure nurture_log table exists (idempotent via ON CONFLICT DO NOTHING)
    // Table schema: id uuid PK, contact_id text, sequence_day int, email text, sent_at timestamptz
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('nurture_log')
      .insert({
        id:           crypto.randomUUID(),
        contact_id:   contactId,
        sequence_day: sequenceDay,
        email,
        sent_at:      new Date().toISOString(),
      })

    if (error) {
      // Duplicate (already sent) — idempotent, not an error
      if (error.code === '23505') {
        return NextResponse.json({ success: true, status: 'already_sent' })
      }
      // Table doesn't exist yet — log and continue (migration pending)
      if (error.code === '42P01') {
        console.warn('[nurture-mark-sent] nurture_log table not yet created — skipping log')
        return NextResponse.json({ success: true, status: 'log_table_missing' })
      }
      console.error('[nurture-mark-sent] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, contact_id: contactId, sequence_day: sequenceDay })
  } catch (err) {
    console.error('[nurture-mark-sent] error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
