import { NextRequest, NextResponse } from 'next/server'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Generate a new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 })
    const totp = new OTPAuth.TOTP({
      issuer: 'Agency Group',
      label: session.user.email!,
      secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    })

    const uri = totp.toString()
    const qrCode = await QRCode.toDataURL(uri, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0c1f15',
        light: '#ffffff',
      },
    })

    // Store secret in pending state — user must verify before it's activated
    const supabase = await createClient()
    const { error } = await supabase
      .from('users')
      .update({ totp_secret_pending: secret.base32 })
      .eq('id', session.user.id)

    if (error) {
      console.error('setup-2fa DB error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      secret: secret.base32,
      qrCode,
      uri,
    })
  } catch (error) {
    console.error('setup-2fa error:', error)
    return NextResponse.json({ error: 'Failed to generate 2FA secret' }, { status: 500 })
  }
}
