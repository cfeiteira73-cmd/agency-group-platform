import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsApp, templates, type TemplateName } from '@/lib/whatsapp/client'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Portal token check — same auth as used by other portal APIs
  const authHeader = req.headers.get('x-portal-token') || req.cookies.get('ag_portal')?.value
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      phone: string
      template?: TemplateName
      data?: string[]
      customMessage?: string
    }

    const { phone, template, data, customMessage } = body

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    // Normalize phone: ensure it starts with + and only has digits after
    const normalizedPhone = phone.trim().startsWith('+')
      ? phone.trim()
      : `+${phone.trim()}`

    let messageText: string

    if (customMessage) {
      messageText = customMessage
    } else if (template && templates[template]) {
      const fn = templates[template] as (...args: string[]) => string
      messageText = fn(...(data ?? []))
    } else {
      return NextResponse.json(
        { error: 'Either customMessage or a valid template name is required' },
        { status: 400 }
      )
    }

    const result = await sendWhatsApp({
      to: normalizedPhone,
      type: 'text',
      text: messageText,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error) {
    console.error('[WhatsApp] Send route error:', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
