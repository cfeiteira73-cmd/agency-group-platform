import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { Resend } from 'resend'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

const PORTAL_LOGIN_URL = (process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.agencygroup.pt') + '/portal/login'

function makeToken(email: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ type: 'magic', email, exp: Date.now() + 30 * 60 * 1000 })
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = rateLimit(ip, { maxAttempts: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    const minutes = getRetryAfterMinutes(limit.reset)
    return NextResponse.json(
      { error: `Demasiadas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const SECRET = process.env.AUTH_SECRET!
  try {
    const { email } = await req.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const token = makeToken(email, SECRET)
    const link = `${PORTAL_LOGIN_URL}?token=${token}`

    const { error } = await resend.emails.send({
      from: 'Agency Group <noreply@agencygroup.pt>',
      to: email,
      subject: 'Acesso Área de Agentes · Agency Group',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
            <tr><td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background:#0c1f15;padding:48px 40px">
                <tr><td>
                  <p style="margin:0 0 8px;font-size:.55rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.7)">AMI 22506</p>
                  <h1 style="margin:0 0 32px;font-size:1.4rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
                  <p style="margin:0 0 8px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,169,110,.9)">Área de Agentes</p>
                  <p style="margin:0 0 32px;font-size:.9rem;line-height:1.7;color:rgba(244,240,230,.7)">
                    Clica no botão abaixo para aceder à tua área exclusiva.<br/>
                    O link é válido durante <strong style="color:#f4f0e6">30 minutos</strong>.
                  </p>
                  <a href="${link}" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:15px 36px;text-decoration:none;font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase">
                    Entrar na Área de Agentes
                  </a>
                  <p style="margin:40px 0 0;font-size:.65rem;color:rgba(244,240,230,.35);line-height:1.6">
                    Agency Group · Mediação Imobiliária Lda · AMI 22506<br/>
                    Se não pediste este acesso, ignora este email.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Falha no envio. Tenta novamente.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
