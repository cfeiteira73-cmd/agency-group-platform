// =============================================================================
// AGENCY GROUP — Send Document API v1.0
// POST /api/send-doc — envia documento preenchido por email via Resend
// Body: { to, subject, message, docTitle, fields: [{label,value}][], docUrl }
// AMI: 22506 | Resend ESP | From: geral@agencygroup.pt
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const FROM_EMAIL = 'Agency Group · AMI 22506 <geral@agencygroup.pt>'

interface Field {
  label: string
  value: string
}

interface SendDocPayload {
  to: string
  subject?: string
  message?: string
  docTitle: string
  fields: Field[]
  docUrl?: string
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEmail(p: SendDocPayload): string {
  const rows = p.fields
    .filter(f => f.value && f.value.trim())
    .map(f => `
      <tr>
        <td style="padding:6px 0;color:rgba(201,169,110,.55);font-size:.72rem;width:160px;vertical-align:top">${escHtml(f.label)}</td>
        <td style="padding:6px 0;color:#e8dfc8;font-size:.78rem;font-weight:500;vertical-align:top">${escHtml(f.value)}</td>
      </tr>`).join('')

  const messageBlock = p.message ? `
    <p style="margin:0 0 24px;color:rgba(220,225,215,.75);font-size:.85rem;line-height:1.7;white-space:pre-wrap">${escHtml(p.message)}</p>` : ''

  const docUrlBlock = p.docUrl ? `
    <p style="margin:24px 0 0;text-align:center">
      <a href="${p.docUrl}" style="display:inline-block;padding:10px 28px;background:#1c4a35;color:#c9a96e;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;border-radius:3px;border:1px solid rgba(201,169,110,.3)">
        Abrir Documento
      </a>
    </p>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0c1f15;border-radius:4px">
        <tr><td style="padding:10px 40px;background:linear-gradient(135deg,#0a1a0e,#162a1e)">
          <p style="margin:0;font-family:'Georgia',serif;font-size:1.5rem;font-weight:300;color:#c9a96e">Agency Group</p>
          <p style="margin:4px 0 0;font-size:.55rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(201,169,110,.5)">AMI 22506 · Documento</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <p style="margin:0 0 6px;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,169,110,.5)">Documento</p>
          <p style="margin:0 0 24px;color:#e8dfc8;font-size:1.05rem;font-weight:500">${escHtml(p.docTitle)}</p>
          ${messageBlock}
          ${rows ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,169,110,.06);border:1px solid rgba(201,169,110,.15);border-radius:4px;margin-bottom:8px">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 14px;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,169,110,.55)">Campos Preenchidos</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
            </td></tr>
          </table>` : ''}
          ${docUrlBlock}
        </td></tr>
        <tr><td style="padding:14px 40px;border-top:1px solid rgba(201,169,110,.1)">
          <p style="margin:0;font-size:.62rem;color:rgba(201,169,110,.3);text-align:center">Agency Group · AMI 22506 · Amoreiras Square, Lisboa · geral@agencygroup.pt</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
  }

  let body: Partial<SendDocPayload>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body inválido' }, { status: 400 })
  }

  if (!body.to || typeof body.to !== 'string' || !body.to.includes('@')) {
    return NextResponse.json({ error: 'Campo "to" é obrigatório e deve ser um email válido.' }, { status: 400 })
  }
  if (!body.docTitle) {
    return NextResponse.json({ error: 'Campo "docTitle" é obrigatório.' }, { status: 400 })
  }

  const payload: SendDocPayload = {
    to: body.to.trim(),
    subject: body.subject || `${body.docTitle} — Agency Group`,
    message: body.message || '',
    docTitle: body.docTitle,
    fields: Array.isArray(body.fields) ? body.fields : [],
    docUrl: body.docUrl || '',
  }

  const resend = new Resend(apiKey)

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject!,
      html: buildEmail(payload),
    })

    if (error) {
      console.error('[send-doc] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: unknown) {
    const e = err as Error
    console.error('[send-doc] Exception:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
