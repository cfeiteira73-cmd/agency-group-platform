import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import nodemailer from 'nodemailer'

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
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return page('Erro', 'Token em falta.', '#7f1d1d')

  const data = verifyToken(token, SECRET)
  if (!data || data.type !== 'rejection') return page('Inválido', 'Token inválido.', '#7f1d1d')
  if (Date.now() > (data.exp as number)) return page('Expirado', 'Link expirou.', '#7f1d1d')

  const email = data.email as string

  const transport = nodemailer.createTransport({
    host: 'smtp.serviciodecorreo.es',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transport.sendMail({
    from: `"Agency Group" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Pedido Não Aprovado · Agency Group',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
      <body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
          <tr><td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#0c1f15;padding:48px 40px">
              <tr><td>
                <p style="margin:0 0 6px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506</p>
                <h1 style="margin:0 0 32px;font-size:1.2rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
                <p style="margin:0 0 8px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(244,240,230,.5)">Pedido Não Aprovado</p>
                <p style="margin:0;font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7)">
                  O teu pedido de acesso não foi aprovado neste momento.<br/>
                  Para mais informações, contacta <a href="mailto:geral@agencygroup.pt" style="color:#c9a96e">geral@agencygroup.pt</a>
                </p>
                <p style="margin:40px 0 0;font-size:.6rem;color:rgba(244,240,230,.3)">Agency Group · Mediação Imobiliária Lda · AMI 22506</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  })

  return page('Rejeitado', `Pedido de <strong style="color:#f4f0e6">${email}</strong> rejeitado.<br/>Email de notificação enviado.`, '#4a1c1c')
}
