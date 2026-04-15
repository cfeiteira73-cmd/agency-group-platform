// =============================================================================
// Agency Group — Property Alert Dedup API
// POST /api/automation/alert-check-sent
// Called by n8n wf-Q before sending each property alert email
//
// Behaviour:
//   - Returns { sent: false } if alert not yet sent for (email, property_id)
//     AND inserts a record to claim the slot atomically (ON CONFLICT DO NOTHING)
//   - Returns { sent: true }  if already sent — wf-Q should skip this subscriber
//
// This prevents duplicate property alert emails when properties are re-published
// or when the property webhook fires multiple times (Vercel retries, manual runs)
//
// Table: property_alert_sent (migration 040)
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
    const email: string       = String(body.email ?? '').trim().toLowerCase()
    const propertyId: string  = String(body.property_id ?? '').trim()
    const zona: string        = String(body.zona ?? '').trim()

    if (!email || !propertyId) {
      return NextResponse.json(
        { error: 'email and property_id are required' },
        { status: 400 }
      )
    }

    // Attempt to INSERT — if UNIQUE constraint blocks it, alert already sent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('property_alert_sent')
      .insert({
        id:          crypto.randomUUID(),
        email,
        property_id: propertyId,
        zona:        zona || null,
        sent_at:     new Date().toISOString(),
      })

    if (error) {
      // 23505 = unique_violation → already sent — skip this subscriber
      if (error.code === '23505') {
        return NextResponse.json({ sent: true, status: 'duplicate' })
      }
      // 42P01 = table missing (migration 040 not yet run) — allow send (safe degradation)
      if (error.code === '42P01') {
        console.warn('[alert-check-sent] property_alert_sent table missing — run migration 040')
        return NextResponse.json({ sent: false, status: 'table_missing' })
      }
      console.error('[alert-check-sent] insert error:', error.message)
      // On unexpected errors: allow the send (fail-open to avoid blocking emails)
      return NextResponse.json({ sent: false, status: 'error', error: error.message })
    }

    // Successfully inserted → first time for this email×property combo → send the email
    return NextResponse.json({ sent: false, status: 'ok', email, property_id: propertyId })
  } catch (err) {
    console.error('[alert-check-sent] error:', err)
    // Fail-open: if endpoint crashes, allow n8n to send (better than silent block)
    return NextResponse.json({ sent: false, status: 'exception' }, { status: 200 })
  }
}
