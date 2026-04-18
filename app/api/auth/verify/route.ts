import { NextRequest, NextResponse } from 'next/server'
import { createHmac, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

async function checkVerifyRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const key = `rl:auth:verify:${ip}`
      const now = Date.now()
      const window = 900 // 15 minutes
      const limit = 10
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZADD', key, now, `${now}`],
          ['ZREMRANGEBYSCORE', key, '-inf', now - window * 1000],
          ['ZCARD', key],
          ['EXPIRE', key, window],
        ]),
      })
      const results = await response.json() as Array<{ result: number }>
      const count = results[2]?.result ?? 0
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
    } catch {
      return { allowed: true, remaining: 10 }
    }
  }
  return { allowed: true, remaining: 10 }
}

const SECRET = process.env.AUTH_SECRET
if (!SECRET) {
  console.error('[auth/verify] AUTH_SECRET não configurado')
  // Não faz throw — deixa a rota tratar como 500 normalmente
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const SESSION_MAX_AGE = 8 * 60 * 60 // 8 horas em segundos

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkVerifyRateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas tentativas. Tente novamente em 15 minutos.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  if (!SECRET) {
    return NextResponse.json({ error: 'Configuração inválida' }, { status: 500 })
  }
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token em falta' }, { status: 400 })

    // Detect whether caller wants JSON (fetch from login page / HomeNav) or HTML (browser nav from email)
    const acceptHeader = req.headers.get('accept') || ''
    const wantsJson = acceptHeader.includes('application/json') && !acceptHeader.includes('text/html')

    const errorResponse = (msg: string, status: number) =>
      wantsJson
        ? NextResponse.json({ error: msg }, { status })
        : new Response(
            `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><title>Erro · Agency Group</title>
            <style>body{margin:0;background:#0c1f15;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#f4f0e6;text-align:center;padding:24px}</style>
            </head><body>
            <div>
              <p style="font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.6);margin-bottom:12px">Agency Group · AMI 22506</p>
              <p style="font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7);margin-bottom:24px">${msg}</p>
              <a href="/portal/login" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:12px 28px;text-decoration:none;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase">Pedir novo acesso →</a>
            </div>
            </body></html>`,
            { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
          )

    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return errorResponse('Link inválido.', 400)

    const payload = token.slice(0, dotIdx)
    const sig = token.slice(dotIdx + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')

    if (!safeCompare(sig, expected)) {
      return errorResponse('Link inválido.', 401)
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())

    if (data.type !== 'magic') {
      return errorResponse('Link inválido.', 401)
    }
    if (Date.now() > data.exp) {
      return errorResponse('Link expirado. Pede um novo acesso em agencygroup.pt/portal/login', 401)
    }

    // ── One-time-use check (atomic): INSERT is the check — no prior SELECT ──
    // Hash the token so the raw value is never stored in the DB.
    // The unique constraint on token_hash makes this a single atomic operation:
    // whichever concurrent request wins the INSERT owns the token; all others
    // get a 23505 conflict and are rejected — eliminating the race window.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // ATOMIC: try to insert first; if conflict → already used.
    // Include all NOT NULL fields required by the schema (email, expires_at).
    const { error: insertError } = await db
      .from('used_magic_tokens')
      .insert({
        token_hash: tokenHash,
        email: data.email,
        used_at: new Date().toISOString(),
        expires_at: new Date(data.exp).toISOString(),
      })

    if (insertError?.code === '23505') {
      // Unique constraint violation — token already consumed
      return errorResponse('Link já utilizado. Pede um novo acesso em agencygroup.pt/portal/login', 401)
    }
    if (insertError && insertError.code !== '42P01') {
      // 42P01 = table does not exist (migration not yet applied) → degrade gracefully
      // All other unexpected errors → 500
      console.error('[Auth] Failed to mark token as used:', insertError)
      return errorResponse('Erro interno. Tenta novamente.', 500)
    }
    // No SELECT check before — the INSERT IS the check
    // ── End one-time-use check ───────────────────────────────────────────────

    // Build session cookie value (signed with AUTH_SECRET so it can't be forged)
    const sessionPayload = Buffer.from(JSON.stringify({
      email: data.email,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    })).toString('base64url')
    const sessionSig = createHmac('sha256', SECRET).update(sessionPayload).digest('hex')
    const sessionCookieValue = `${sessionPayload}.${sessionSig}`

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
      // Called via fetch() from login page / HomeNav — return JSON with cookie.
      // Cache-Control: no-store prevents CDN from caching this response (which carries Set-Cookie).
      const res = NextResponse.json({ ok: true, email: data.email }, {
        headers: { 'Cache-Control': 'no-store, no-cache' },
      })
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
