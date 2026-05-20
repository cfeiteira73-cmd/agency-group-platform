import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { auth } from '@/auth'
import { rateLimit } from '@/lib/rateLimit'
import { withResend } from '@/lib/ops/withResend'

const RESEND_KEY  = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL  = 'Agency Group <geral@agencygroup.pt>'
const ADMIN_EMAIL = 'geral@agencygroup.pt'

// Allowed origins for CSRF protection
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agencygroup.pt',
  'https://www.agencygroup.pt',
  'https://agencygroup.vercel.app',
]

interface BookingPayload {
  nome: string
  telefone: string
  email?: string
  propertyRef: string
  propertyName: string
  propertyPreco: string
  date: string        // "Seg 5 Mai"
  time: string        // "10:30"
  visitType: string   // "presencial" | "virtual"
}

function buildClientEmail(b: BookingPayload): string {
  const typeLabel = b.visitType === 'virtual' ? 'Tour Virtual' : 'Visita Presencial'
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0c1f15;border-radius:4px">
        <tr><td style="padding:10px 40px;background:linear-gradient(135deg,#0a1a0e,#162a1e)">
          <p style="margin:0;font-family:'Georgia',serif;font-size:1.5rem;font-weight:300;color:#c9a96e">Agency Group</p>
          <p style="margin:4px 0 0;font-size:.55rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(201,169,110,.5)">AMI 22506 · Confirmação de Agendamento</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <p style="margin:0 0 16px;color:#e8dfc8;font-size:.9rem">Caro/a <strong>${b.nome}</strong>,</p>
          <p style="margin:0 0 24px;color:rgba(220,225,215,.75);font-size:.85rem;line-height:1.7">
            Recebemos o seu pedido de visita. A nossa equipa irá confirmar em menos de 2 horas via WhatsApp ou email.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,169,110,.06);border:1px solid rgba(201,169,110,.15);border-radius:4px;margin-bottom:24px">
            <tr><td style="padding:20px 24px">
              <p style="margin:0 0 12px;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,169,110,.55)">Detalhe da Visita</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ['Imóvel', `${b.propertyRef} — ${b.propertyName}`],
                  ['Preço', b.propertyPreco],
                  ['Data', b.date],
                  ['Hora', b.time],
                  ['Tipo', typeLabel],
                  ['Contacto', b.telefone],
                ].map(([label, value]) => `
                <tr>
                  <td style="padding:5px 0;color:rgba(201,169,110,.5);font-size:.72rem;width:90px">${label}</td>
                  <td style="padding:5px 0;color:#e8dfc8;font-size:.78rem;font-weight:500">${value}</td>
                </tr>`).join('')}
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;color:rgba(220,225,215,.55);font-size:.78rem;line-height:1.6">
            Para cancelar ou reagendar, responda a este email ou envie WhatsApp para <a href="https://wa.me/351919948986" style="color:#c9a96e">+351 919 948 986</a>.
          </p>
          <p style="margin:0;color:rgba(201,169,110,.5);font-size:.75rem">Com os melhores cumprimentos,<br/>
            <strong style="color:#c9a96e">Equipa Agency Group</strong>
          </p>
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

function buildAdminEmail(b: BookingPayload): string {
  const typeLabel = b.visitType === 'virtual' ? 'Tour Virtual' : 'Visita Presencial'
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0c1f15;font-family:monospace;color:#e8dfc8;padding:24px">
  <h2 style="margin:0 0 16px;color:#c9a96e">📅 Nova Visita Agendada</h2>
  <table cellpadding="6" style="font-size:.85rem">
    <tr><td style="color:#c9a96e;width:100px">Imóvel</td><td>${b.propertyRef} — ${b.propertyName} (${b.propertyPreco})</td></tr>
    <tr><td style="color:#c9a96e">Data/Hora</td><td>${b.date} às ${b.time}</td></tr>
    <tr><td style="color:#c9a96e">Tipo</td><td>${typeLabel}</td></tr>
    <tr><td style="color:#c9a96e">Nome</td><td>${b.nome}</td></tr>
    <tr><td style="color:#c9a96e">Telefone</td><td>${b.telefone}</td></tr>
    <tr><td style="color:#c9a96e">Email</td><td>${b.email || '—'}</td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:.75rem;color:rgba(201,169,110,.5)">Agency Group · Booking System · ${new Date().toISOString()}</p>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  // ── Rate limit: 3 bookings per IP per minute ───────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`booking:${ip}`, { maxAttempts: 3, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  // ── CSRF protection — only allow requests from our own origin ──────────────
  const origin = req.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Auth check — session required to book a visit (portal feature) ─────────
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: BookingPayload = await req.json()
    const { nome, telefone, propertyRef, date, time } = body

    // ── Input validation ─────────────────────────────────────────────────────
    if (!nome || !telefone || !propertyRef || !date || !time) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta.' }, { status: 400 })
    }
    if (nome.trim().length > 100) {
      return NextResponse.json({ error: 'Nome demasiado longo.' }, { status: 400 })
    }
    if (telefone.trim().length > 30) {
      return NextResponse.json({ error: 'Telefone inválido.' }, { status: 400 })
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }

    if (!RESEND_KEY) {
      return NextResponse.json({ ok: true, note: 'Email skipped — no RESEND_API_KEY' })
    }

    const corrId = crypto.randomUUID()
    const resend = new Resend(RESEND_KEY)

    // Notify admin
    const adminSend = withResend(
      () => resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `📅 Nova Visita — ${propertyRef} · ${date} ${time}`,
        html: buildAdminEmail(body),
      }),
      corrId,
    )

    // Confirm to client if email provided
    const clientSend = body.email
      ? withResend(
          () => resend.emails.send({
            from: FROM_EMAIL,
            to: body.email!,
            subject: `Visita confirmada — ${body.propertyName} · ${date}`,
            html: buildClientEmail(body),
          }),
          corrId,
        )
      : Promise.resolve(null)

    const [adminResult, clientResult] = await Promise.allSettled([adminSend, clientSend])
    if (adminResult.status === 'rejected') {
      console.error('[booking] Admin email failed:', { corrId, reason: adminResult.reason })
    }
    if (clientResult.status === 'rejected') {
      console.error('[booking] Client email failed:', { corrId, reason: clientResult.reason })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
