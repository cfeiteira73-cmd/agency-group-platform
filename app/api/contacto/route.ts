// ─── POST /api/contacto — Contact form handler ────────────────────────────────
// Receives form-encoded data from /contacto page.
// Sends notification email via Resend, then redirects.
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const RESEND_KEY  = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL  = 'Agency Group <geral@agencygroup.pt>'
const ADMIN_EMAIL = 'geral@agencygroup.pt'

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agencygroup.pt',
  'https://www.agencygroup.pt',
  'https://agencygroup.vercel.app',
]

function buildAdminEmail(data: Record<string, string>): string {
  const rows = [
    ['Nome',     data.nome      || '—'],
    ['Telefone', data.tel       || '—'],
    ['Zona',     data.zona      || '—'],
    ['Objetivo', data.objetivo  || '—'],
    ['Orçamento',data.orcamento || '—'],
  ]
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#060d08;font-family:monospace;color:#e8dfc8;padding:28px">
  <h2 style="margin:0 0 20px;font-family:Georgia,serif;color:#c9a96e;font-weight:300">Novo Briefing de Contacto</h2>
  <table cellpadding="8" style="font-size:.85rem;border-collapse:collapse">
    ${rows.map(([label, value]) => `
    <tr>
      <td style="color:rgba(201,169,110,.65);padding:6px 20px 6px 0;vertical-align:top;white-space:nowrap">${label}</td>
      <td style="color:#e8dfc8;padding:6px 0">${value}</td>
    </tr>`).join('')}
  </table>
  <p style="margin:24px 0 0;font-size:.72rem;color:rgba(201,169,110,.3)">Agency Group · Briefing Contacto · ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}</p>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  // CSRF check
  const origin = req.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return NextResponse.redirect(new URL('/contacto?erro=1', req.url))
  }

  try {
    const body = await req.formData()
    const data: Record<string, string> = {}
    for (const [key, value] of body.entries()) {
      // Handle multiple checkboxes (objetivo) — join with comma
      if (key in data) {
        data[key] = `${data[key]}, ${value}`
      } else {
        data[key] = String(value)
      }
    }

    // Basic validation
    if (!data.nome && !data.tel) {
      return NextResponse.redirect(new URL('/contacto?erro=campos', req.url))
    }

    // Send admin notification if Resend is configured
    if (RESEND_KEY) {
      const resend = new Resend(RESEND_KEY)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `📩 Novo Briefing — ${data.nome || 'Anónimo'} · ${data.zona || 'Zona n/d'}`,
        html: buildAdminEmail(data),
      })
    }

    return NextResponse.redirect(new URL('/contacto?obrigado=1', req.url))
  } catch (err) {
    console.error('[contacto] form submission error:', err)
    return NextResponse.redirect(new URL('/contacto?erro=1', req.url))
  }
}
