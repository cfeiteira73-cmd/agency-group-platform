import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const maxDuration = 30

export async function GET() {
  const smtpHost = process.env.SMTP_HOST ?? ''
  const smtpUser = process.env.SMTP_USER ?? ''
  const smtpPass = process.env.SMTP_PASS ?? ''
  const smtpPort = Number(process.env.SMTP_PORT ?? 587)
  const smtpSecure = process.env.SMTP_SECURE === 'true'

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json({ error: 'SMTP env vars missing', smtpHost, smtpUser, hasPass: Boolean(smtpPass) })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    })

    // Verify connection first
    await transporter.verify()

    // Send test email
    const info = await transporter.sendMail({
      from: `"AG Radar Test" <${smtpUser}>`,
      to: smtpUser,
      subject: `✅ SMTP Test — ${new Date().toLocaleString('pt-PT')}`,
      html: '<p>SMTP funcionando correctamente desde Vercel.</p>',
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      config: { host: smtpHost, port: smtpPort, secure: smtpSecure, user: smtpUser },
    })
  } catch (e: unknown) {
    const err = e as Error & { code?: string; command?: string; response?: string; responseCode?: number }
    return NextResponse.json({
      success: false,
      error: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      config: { host: smtpHost, port: smtpPort, secure: smtpSecure, user: smtpUser },
    })
  }
}
