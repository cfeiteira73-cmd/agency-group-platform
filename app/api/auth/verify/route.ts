import { NextRequest, NextResponse } from 'next/server'
import { createHmac, createHash } from 'crypto'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabase'

const SECRET = process.env.AUTH_SECRET
if (!SECRET) {
  console.error('[auth/verify] AUTH_SECRET não configurado')
  // Não faz throw — deixa a rota tratar como 500 normalmente
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const SESSION_MAX_AGE = 8 * 60 * 60 // 8 horas em segundos

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const limit = rateLimit(ip, { maxAttempts: 10, windowMs: 15 * 60 * 1000 })
  if (!limit.success) {
    const minutes = getRetryAfterMinutes(limit.reset)
    return NextResponse.json(
      { error: `Demasiadas tentativas. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.` },
      { status: 429, headers: { 'Retry-After': String(minutes * 60) } }
    )
  }

  if (!SECRET) {
    return NextResponse.json({ error: 'Configuração inválida' }, { status: 500 })
  }
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token em falta' }, { status: 400 })

    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')

    if (sig !== expected) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())

    if (data.type !== 'magic') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    if (Date.now() > data.exp) {
      return NextResponse.json({ error: 'Link expirado. Pede um novo acesso.' }, { status: 401 })
    }

    // ── One-time-use check: reject already-consumed tokens ──────────────────
    // We hash the token before DB lookup so the raw token is never stored.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { data: usedRow } = await db
      .from('used_magic_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (usedRow) {
      return NextResponse.json({ error: 'Link inválido ou já utilizado' }, { status: 401 })
    }

    // Mark token as used immediately (before issuing the session cookie)
    // to prevent race-condition reuse even under concurrent requests.
    const { error: insertError } = await db
      .from('used_magic_tokens')
      .insert({
        token_hash: tokenHash,
        email: data.email,
        expires_at: new Date(data.exp).toISOString(),
      })
    if (insertError) {
      // If insert fails due to unique constraint race, another request already
      // consumed this token — reject this one.
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Link inválido ou já utilizado' }, { status: 401 })
      }
      // Other DB errors: fail safe (deny access rather than allow duplicate use)
      console.error('[auth/verify] Failed to record used token:', insertError)
      return NextResponse.json({ error: 'Erro interno. Tenta novamente.' }, { status: 500 })
    }
    // ── End one-time-use check ───────────────────────────────────────────────

    // Build session cookie value (signed with AUTH_SECRET so it can't be forged)
    const sessionPayload = Buffer.from(JSON.stringify({
      email: data.email,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    })).toString('base64url')
    const sessionSig = createHmac('sha256', SECRET).update(sessionPayload).digest('hex')
    const sessionCookieValue = `${sessionPayload}.${sessionSig}`

    // Detect whether the client wants JSON (called via fetch from login page)
    // or a browser navigation (direct GET from email link)
    const acceptHeader = req.headers.get('accept') || ''
    const wantsJson = acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')

    // Use a plain cookie name without the __Secure- prefix.
    // Chrome silently drops __Secure- cookies when they arrive via a redirect
    // chain (agencygroup.pt → www.agencygroup.pt → /api/auth/verify) because
    // the prefix requires the cookie to be set in a "secure context" with no
    // cross-origin hops — a constraint Chrome enforces strictly while IE ignores.
    // proxy.ts already checks both variants so the fallback is preserved.
    const cookieName = 'ag-auth-token'
    const cookieOptions = {
      httpOnly: true,
      secure: IS_PRODUCTION,   // HTTPS-only in production, as required
      sameSite: 'lax' as const,
      path: '/',
      maxAge: SESSION_MAX_AGE,
    }

    if (wantsJson) {
      // Called via fetch() from login page — return JSON with cookie
      const res = NextResponse.json({ ok: true, email: data.email })
      res.cookies.set(cookieName, sessionCookieValue, cookieOptions)
      return res
    }

    // Direct browser navigation from email link.
    //
    // IMPORTANT: We return a 200 HTML page (NOT a 302 redirect) that carries
    // the Set-Cookie header and immediately redirects via JavaScript/meta-refresh.
    //
    // Why not 302 + Set-Cookie?
    //   Chrome enforces that cookies on redirect responses that pass through a
    //   cross-origin redirect chain (agencygroup.pt → www.agencygroup.pt → verify)
    //   may be silently dropped.  A plain 200 response with Set-Cookie is ALWAYS
    //   honoured by every browser — the cookie is stored before the JS redirect runs.
    //
    // The CSP already allows 'unsafe-inline' scripts so the tiny redirect script
    // is permitted.
    const cookieHeaderValue = [
      `${cookieName}=${sessionCookieValue}`,
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${SESSION_MAX_AGE}`,
      'Path=/',
      ...(IS_PRODUCTION ? ['Secure'] : []),
    ].join('; ')

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="refresh" content="0;url=/portal"/>
  <title>A entrar…</title>
  <style>body{margin:0;background:#0c1f15;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#c9a96e;font-size:.75rem;letter-spacing:.15em;text-transform:uppercase}</style>
</head>
<body>
  <p>A entrar no portal…</p>
  <script>window.location.replace('/portal');</script>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': cookieHeaderValue,
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
}
