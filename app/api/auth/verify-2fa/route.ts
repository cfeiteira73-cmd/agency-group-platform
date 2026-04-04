import { NextRequest, NextResponse } from 'next/server'
import * as OTPAuth from 'otpauth'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = rateLimit(ip, { maxAttempts: 5, windowMs: 15 * 60 * 1000 })
  if (!limit.success) {
    const minutes = getRetryAfterMinutes(limit.reset)
    return NextResponse.json(
      { error: `Demasiadas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { token, action } = await req.json()

    if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
    }

    const supabase = await createClient()

    if (action === 'disable') {
      // Verify current TOTP before disabling
      const { data: user } = await supabase
        .from('users')
        .select('totp_secret')
        .eq('id', session.user.id)
        .single()

      if (!user?.totp_secret) {
        return NextResponse.json({ error: '2FA not enabled' }, { status: 400 })
      }

      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(user.totp_secret),
        digits: 6,
        period: 30,
      })
      const delta = totp.validate({ token, window: 1 })
      if (delta === null) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
      }

      await supabase
        .from('users')
        .update({ totp_secret: null, totp_secret_pending: null })
        .eq('id', session.user.id)

      return NextResponse.json({ success: true, message: '2FA disabled successfully' })
    }

    // Default: verify pending secret and activate
    const { data: user } = await supabase
      .from('users')
      .select('totp_secret_pending')
      .eq('id', session.user.id)
      .single()

    if (!user?.totp_secret_pending) {
      return NextResponse.json({ error: 'No pending 2FA setup found. Start setup first.' }, { status: 400 })
    }

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(user.totp_secret_pending),
      digits: 6,
      period: 30,
    })
    const delta = totp.validate({ token, window: 1 })
    if (delta === null) {
      return NextResponse.json({ error: 'Invalid token — check your authenticator app' }, { status: 400 })
    }

    // Activate 2FA: move pending secret to active
    const { error } = await supabase
      .from('users')
      .update({
        totp_secret: user.totp_secret_pending,
        totp_secret_pending: null,
      })
      .eq('id', session.user.id)

    if (error) {
      console.error('verify-2fa DB error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '2FA enabled successfully' })
  } catch (error) {
    console.error('verify-2fa error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
