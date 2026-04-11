import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
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
    const { token, password } = await req.json()

    if (!token || typeof token !== 'string' || token.length !== 64) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'A password deve ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, reset_token, reset_token_expires')
      .eq('reset_token', token)
      .single()

    if (fetchError || !user) {
      return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 })
    }

    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return NextResponse.json({ error: 'O link de recuperação expirou. Solicite um novo.' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[confirm-reset] DB update error:', updateError)
      return NextResponse.json({ error: 'Erro ao guardar a nova password. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[confirm-reset] Error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
