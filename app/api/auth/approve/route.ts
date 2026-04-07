import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { Resend } from 'resend'

const BASE_URL = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.agencygroup.pt'
const VERIFY_URL = BASE_URL + '/api/auth/verify'
const FROM = 'Agency Group <noreply@agencygroup.pt>'

function verifyToken(token: string, secret: string): Record<string, unknown> | null {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return null
  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  if (sig !== expected) return null
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()) }
  catch { return null }
}

function makeToken(payload: object, secret: string): string {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(p).digest('hex')
  return `${p}.${sig}`
}

function page(title: string, body: string, color: string) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title} · Agency Group</title></head>
    <body style="margin:0;padding:0;background:#0c1f15;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
      <div style="text-align:center;padding:48px 32px;max-width:420px">
        <p style="margin:0 0 8px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506</p>
        <h1 style="margin:0 0 24px;font-size:1.3rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
        <div style="display:inline-block;background:${color};padding:3px 14px;margin-bottom:20px">
          <span style="font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;color:#f4f0e6;font-weight:600">${title}</span>
        </div>
        <p style="margin:0;font-size:.85rem;line-height:1.8;color:rgba(244,240,230,.65)">${body}</p>
        <p style="margin:32px 0 0;font-size:.6rem;color:rgba(244,240,230,.25)">Agency Group · Mediação Imobiliária Lda · AMI 22506</p>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

export async function GET(req: NextRequest) {
  const SECRET = process.env.AUTH_SECRET!
  const resend = new Resend(process.env.RESEND_API_KEY)
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return page('Erro', 'Token em falta.', '#7f1d1d')

  const data = verifyToken(token, SECRET)
  if (!data || data.type !== 'approval') return page('Inválido', 'Token inválido.', '#7f1d1d')
  if (Date.now() > (data.exp as number)) return page('Expirado', 'Link expirou (24h). O agente deve pedir novamente.', '#7f1d1d')

  const email = data.email as string
  const magicToken = makeToken({ type: 'magic', email, exp: Date.now() + 24 * 60 * 60 * 1000 }, SECRET)
  const magicLink = `${VERIFY_URL}?token=${magicToken}`

  const { error: sendErr } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Acesso Aprovado · Área de Agentes · Agency Group',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
      <body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
          <tr><td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#0c1f15;padding:48px 40px">
              <tr><td>
                <p style="margin:0 0 6px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506</p>
                <h1 style="margin:0 0 32px;font-size:1.2rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
                <p style="margin:0 0 8px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,169,110,.9)">Acesso Aprovado</p>
                <p style="margin:0 0 32px;font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7)">
                  O teu acesso à área exclusiva de agentes foi aprovado.<br/>
                  Clica no botão abaixo para entrar. O link é válido durante <strong style="color:#f4f0e6">24 horas</strong> — podes abrir noutro dispositivo.
                </p>
                <a href="${magicLink}" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:15px 36px;text-decoration:none;font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase">Entrar na Área de Agentes</a>
                <p style="margin:40px 0 0;font-size:.6rem;color:rgba(244,240,230,.3);line-height:1.6">
                  Agency Group · Mediação Imobiliária Lda · AMI 22506<br/>
                  Se não pediste este acesso, ignora este email.
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  })
  if (sendErr) console.error('Resend approve email error:', sendErr)

  // Redireciona diretamente para o site com o token — autentica imediatamente
  return NextResponse.redirect(magicLink, { status: 302 })
}
