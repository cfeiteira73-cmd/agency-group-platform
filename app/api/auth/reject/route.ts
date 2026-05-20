import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { Resend } from 'resend'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

const FROM = 'Agency Group <geral@agencygroup.pt>'

function verifyToken(token: string, secret: string): Record<string, unknown> | null {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return null
  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) return null
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

/**
 * GET /api/auth/reject?token=...
 *
 * Two-step protection against email-scanner prefetch:
 * GET shows a confirmation page with a POST form.
 * POST actually executes the rejection (sends notification email).
 *
 * This prevents security scanners (Barracuda, Outlook Safe Links, etc.)
 * that blindly GET all links in emails from triggering the rejection action.
 */
export async function GET(req: NextRequest) {
  const SECRET = process.env.AUTH_SECRET
  if (!SECRET) return page('Erro', 'Servidor não configurado.', '#7f1d1d')

  const token = req.nextUrl.searchParams.get('token')
  if (!token) return page('Erro', 'Token em falta.', '#7f1d1d')

  const data = verifyToken(token, SECRET)
  if (!data || data.type !== 'rejection') return page('Inválido', 'Token inválido.', '#7f1d1d')
  if (Date.now() > (data.exp as number)) return page('Expirado', 'Link expirou.', '#7f1d1d')

  const email = data.email as string
  const actionUrl = `/api/auth/reject?token=${encodeURIComponent(token)}`

  // Show confirmation form — scanner bots issue GET only, never POST.
  return new NextResponse(
    `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/>
    <title>Confirmar Rejeição · Agency Group</title></head>
    <body style="margin:0;padding:0;background:#0c1f15;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
      <div style="text-align:center;padding:48px 32px;max-width:480px">
        <p style="margin:0 0 8px;font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">AMI 22506</p>
        <h1 style="margin:0 0 24px;font-size:1.3rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Agency Group</h1>
        <p style="margin:0 0 24px;font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7)">
          Clica para rejeitar o pedido de acesso de<br/>
          <strong style="color:#c9a96e">${email}</strong>
        </p>
        <form method="POST" action="${actionUrl}">
          <button type="submit"
            style="background:#7f1d1d;color:#f4f0e6;padding:15px 36px;border:none;cursor:pointer;font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase">
            Rejeitar Pedido
          </button>
        </form>
        <p style="margin:32px 0 0;font-size:.6rem;color:rgba(244,240,230,.25)">Agency Group · Mediação Imobiliária Lda · AMI 22506</p>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

/**
 * POST /api/auth/reject?token=...
 * Executes the rejection: sends notification email to the requesting agent.
 */
export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const SECRET = process.env.AUTH_SECRET
  if (!SECRET) return page('Erro', 'Servidor não configurado.', '#7f1d1d')

  const resend = new Resend(process.env.RESEND_API_KEY)
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return page('Erro', 'Token em falta.', '#7f1d1d')

  const data = verifyToken(token, SECRET)
  if (!data || data.type !== 'rejection') return page('Inválido', 'Token inválido.', '#7f1d1d')
  if (Date.now() > (data.exp as number)) return page('Expirado', 'Link expirou.', '#7f1d1d')

  const email = data.email as string

  const { error: sendErr } = await resend.emails.send({
    from: FROM,
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
  if (sendErr) console.error('Resend reject email error:', sendErr, { corrId })

  return new NextResponse(
    `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/>
    <title>Pedido Rejeitado · Agency Group</title></head>
    <body style="margin:0;padding:64px 24px;background:#0c1f15;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;text-align:center">
      <p style="margin:0 0 12px;font-size:.55rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6)">Agency Group · AMI 22506</p>
      <h1 style="margin:0 0 24px;font-size:1.4rem;font-weight:300;color:#f4f0e6;letter-spacing:.05em">Pedido Rejeitado</h1>
      <p style="font-size:.85rem;line-height:1.8;color:rgba(244,240,230,.7);max-width:400px;margin:0 auto">
        O agente foi notificado da decisão.<br/>Podes fechar esta página.
      </p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
