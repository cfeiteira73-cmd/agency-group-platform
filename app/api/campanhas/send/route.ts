// =============================================================================
// AGENCY GROUP — Campanhas Send API v1.0
// POST /api/campanhas/send — send campaign emails via Resend
// Body: { to: string[], subject: string, html: string, campaignId?: string, from?: string }
// AMI: 22506 | Resend ESP
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { auth } from '@/auth'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendPayload {
  to: string[]
  subject: string
  html: string
  campaignId?: string
  from?: string
  replyTo?: string
}

interface SendResult {
  success: boolean
  sent: number
  failed: number
  ids: string[]
  errors: string[]
  campaignId?: string
}

// ---------------------------------------------------------------------------
// POST /api/campanhas/send
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Partial<SendPayload>

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Campo "to" é obrigatório e deve ser um array de endereços.' },
        { status: 400 }
      )
    }
    if (!body.subject || typeof body.subject !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Campo "subject" é obrigatório.' },
        { status: 400 }
      )
    }
    if (!body.html || typeof body.html !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Campo "html" é obrigatório.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      // Dev fallback — simulate send without actually sending
      return NextResponse.json<SendResult>({
        success: true,
        sent: body.to.length,
        failed: 0,
        ids: body.to.map((_, i) => `dev-sim-${Date.now()}-${i}`),
        errors: [],
        campaignId: body.campaignId,
      })
    }

    const resend = new Resend(apiKey)
    const from = body.from ?? 'Agency Group <noreply@agencygroup.pt>'
    const replyTo = body.replyTo ?? 'info@agencygroup.pt'

    const ids: string[] = []
    const errors: string[] = []
    let sent = 0
    let failed = 0

    // Send in batches of 50 to respect Resend rate limits
    const BATCH = 50
    for (let i = 0; i < body.to.length; i += BATCH) {
      const batch = body.to.slice(i, i + BATCH)

      try {
        // Resend supports bcc for bulk — send one email per batch with bcc
        // For true 1-to-1 personalisation, iterate individually
        if (batch.length === 1) {
          const { data, error } = await resend.emails.send({
            from,
            to: batch[0],
            replyTo,
            subject: body.subject,
            html: body.html,
          })
          if (error) {
            failed += 1
            errors.push(`${batch[0]}: ${error.message}`)
          } else {
            sent += 1
            if (data?.id) ids.push(data.id)
          }
        } else {
          // Batch send using bcc
          const { data, error } = await resend.emails.send({
            from,
            to: from, // send to self, bcc to list
            bcc: batch,
            replyTo,
            subject: body.subject,
            html: body.html,
          })
          if (error) {
            failed += batch.length
            errors.push(`Batch ${i / BATCH + 1}: ${error.message}`)
          } else {
            sent += batch.length
            if (data?.id) ids.push(data.id)
          }
        }
      } catch (batchErr) {
        failed += batch.length
        errors.push(`Batch error: ${batchErr instanceof Error ? batchErr.message : 'Unknown'}`)
      }
    }

    return NextResponse.json<SendResult>({
      success: failed === 0,
      sent,
      failed,
      ids,
      errors,
      campaignId: body.campaignId,
    })

  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro interno', sent: 0, failed: 0, ids: [], errors: [] },
      { status: 500 }
    )
  }
}
