import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { Resend } from 'resend'

const PORTAL_URL = (process.env.NEXT_PUBLIC_URL || 'https://www.agencygroup.pt') + '/portal'
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.agencygroup.pt'
const ADMIN_EMAIL = 'geral@agencygroup.pt'
const FROM = 'Agency Group <noreply@agencygroup.pt>'

function makeToken(payload: object, secret: string): string {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(p).digest('hex')
  return `${p}.${sig}`
}

export async function POST(req: NextRequest) {
  const SECRET = process.env.AUTH_SECRET!
  const resend = new Resend(process.env.RESEND_API_KEY)
  const ALLOWED = [ADMIN_EMAIL]

  try {
    const { email } = await req.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Pre-approved agents: skip admin approval, send magic link directly
    if (ALLOWED.includes(email.toLowerCase())) {
      const magicToken = makeToken({ type: 'magic', email, exp: Date.now() + 24 * 60 * 60 * 1000 }, SECRET)
      const magicLink = `${PORTAL_URL}?token=${magicToken}`
      const { data: magicData, error: magicErr } = await resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Acesso · Área de Agentes · Agency Group',
        html: `
          <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
          <body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
              <tr><td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#0c1f15;padding:48px 40px">
                  <tr><td>
                    <p style="margin:0 0 6px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506</p>
                    <h1 style="margin:0 0 32px;font-size:1.2rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
                    <p style="margin:0 0 8px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,169,110,.9)">Link de Acesso</p>
                    <p style="margin:0 0 32px;font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7)">
                      Clica no botão abaixo para entrar.<br/>
                      O link é válido durante <strong style="color:#f4f0e6">24 horas</strong> — podes abrir noutro dispositivo.
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
      if (magicErr) {
        console.error('Resend magic link error:', magicErr)
        return NextResponse.json({ error: 'Falha ao enviar email. Tenta novamente.' }, { status: 500 })
      }
      console.log('Magic link sent ok, id:', magicData?.id)
      return NextResponse.json({ ok: true })
    }

    const exp24h = Date.now() + 24 * 60 * 60 * 1000
    const approveToken = makeToken({ type: 'approval', email, exp: exp24h }, SECRET)
    const rejectToken  = makeToken({ type: 'rejection', email, exp: exp24h }, SECRET)

    const approveLink = `${BASE_URL}/api/auth/approve?token=${approveToken}`
    const rejectLink  = `${BASE_URL}/api/auth/reject?token=${rejectToken}`
    const now = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })

    // Email para o admin
    const { data: adminData, error: adminErr } = await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `Pedido de Acesso Agentes · ${email}`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
        <body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#0c1f15;padding:48px 40px">
                <tr><td>
                  <p style="margin:0 0 6px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506 · Área de Agentes</p>
                  <h1 style="margin:0 0 32px;font-size:1.2rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Novo Pedido de Acesso</h1>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.04);border:1px solid rgba(201,169,110,.2);padding:20px 24px;margin-bottom:32px">
                    <tr><td>
                      <p style="margin:0 0 6px;font-size:.5rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,169,110,.6)">Email solicitado</p>
                      <p style="margin:0 0 16px;font-size:1rem;color:#f4f0e6;font-weight:500">${email}</p>
                      <p style="margin:0;font-size:.65rem;color:rgba(244,240,230,.35)">${now}</p>
                    </td></tr>
                  </table>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:12px">
                        <a href="${approveLink}" style="display:inline-block;background:#1c4a35;border:1px solid #c9a96e;color:#c9a96e;padding:14px 28px;text-decoration:none;font-size:.65rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase">✓ Aprovar Acesso</a>
                      </td>
                      <td>
                        <a href="${rejectLink}" style="display:inline-block;background:transparent;border:1px solid rgba(244,240,230,.2);color:rgba(244,240,230,.5);padding:14px 28px;text-decoration:none;font-size:.65rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase">✕ Rejeitar</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:32px 0 0;font-size:.6rem;color:rgba(244,240,230,.3);line-height:1.6">
                    Os links expiram em 24 horas.<br/>Agency Group · Mediação Imobiliária Lda · AMI 22506
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    })
    if (adminErr) {
      console.error('Resend admin email error:', JSON.stringify(adminErr))
      return NextResponse.json({ error: 'Falha ao enviar email de aprovação. Tenta novamente.' }, { status: 500 })
    }
    console.log('Admin approval email sent ok, resend_id:', adminData?.id)

    // Confirmação para o agente
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Pedido Recebido · Agency Group',
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
        <body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
            <tr><td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background:#0c1f15;padding:48px 40px">
                <tr><td>
                  <p style="margin:0 0 6px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506</p>
                  <h1 style="margin:0 0 32px;font-size:1.2rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
                  <p style="margin:0 0 8px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,169,110,.9)">Pedido Recebido</p>
                  <p style="margin:0;font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7)">
                    O teu pedido de acesso à área de agentes foi recebido.<br/>
                    Vais receber um email assim que o acesso for aprovado.
                  </p>
                  <p style="margin:40px 0 0;font-size:.6rem;color:rgba(244,240,230,.3)">Agency Group · Mediação Imobiliária Lda · AMI 22506</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno. Tenta novamente.' }, { status: 500 })
  }
}
