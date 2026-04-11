import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = await rateLimit(ip, { maxAttempts: 5, windowMs: 15 * 60 * 1000 })
  if (!limit.success) {
    const minutes = getRetryAfterMinutes(limit.reset)
    return NextResponse.json(
      { error: `Demasiadas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    )
  }

  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ has2FA: false })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .select('totp_secret')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !data) {
      // Don't reveal whether user exists — just return false
      return NextResponse.json({ has2FA: false })
    }

    return NextResponse.json({ has2FA: !!data.totp_secret })
  } catch {
    return NextResponse.json({ has2FA: false })
  }
}
