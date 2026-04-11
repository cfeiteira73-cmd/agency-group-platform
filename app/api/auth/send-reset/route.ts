import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'
import { z } from 'zod'

const SendResetSchema = z.object({
  email: z.string().email(),
})

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = await rateLimit(ip, { maxAttempts: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    const minutes = getRetryAfterMinutes(limit.reset)
    return NextResponse.json(
      { error: `Demasiadas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    )
  }

  try {
    const raw = await req.json()
    const parsed = SendResetSchema.safeParse(raw)
    // Always return success to avoid leaking info about valid emails (including on invalid input)
    if (!parsed.success) {
      return NextResponse.json({ success: true, message: 'Se o email existir, receberá um link.' })
    }
    const { email } = parsed.data

    const supabase = await createClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single()

    // Always respond with success regardless of whether user was found
    if (!user) {
      return NextResponse.json({ success: true, message: 'Se o email existir, receberá um link.' })
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await supabase
      .from('users')
      .update({ reset_token: token, reset_token_expires: expiresAt })
      .eq('id', user.id)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.agencygroup.pt'
    const resetLink = `${baseUrl}/auth/reset-password/confirm?token=${token}`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Agency Group <noreply@agencygroup.pt>',
      to: user.email,
      subject: 'Recuperação de Password · Agency Group',
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
                  <p style="margin:0 0 8px;font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:rgba(201,169,110,.9)">Recuperação de Password</p>
                  <p style="margin:0 0 32px;font-size:.9rem;line-height:1.7;color:rgba(244,240,230,.7)">
                    Recebemos um pedido para redefinir a password da sua conta.<br/>
                    Clique no botão abaixo para definir uma nova password.<br/>
                    O link é válido durante <strong style="color:#f4f0e6">1 hora</strong>.
                  </p>
                  <a href="${resetLink}" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:15px 36px;text-decoration:none;font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase">
                    Redefinir Password
                  </a>
                  <p style="margin:40px 0 0;font-size:.65rem;color:rgba(244,240,230,.35);line-height:1.6">
                    Agency Group · Mediação Imobiliária Lda · AMI 22506<br/>
                    Se não pediu esta recuperação, ignore este email — a sua password permanece inalterada.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    if (emailError) {
      console.error('[send-reset] Resend error:', emailError)
      // Still return success — don't expose internal errors to the user
    }

    return NextResponse.json({ success: true, message: 'Se o email existir, receberá um link.' })
  } catch (err) {
    console.error('[send-reset] Error:', err)
    return NextResponse.json({ success: true, message: 'Se o email existir, receberá um link.' })
  }
}
