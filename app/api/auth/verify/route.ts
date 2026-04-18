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

// ── Shared: validate token signature + expiry (does NOT consume) ─────────────
function validateToken(token: string, secret: string): { ok: true; data: { type: string; email: string; exp: number } } | { ok: false; error: string; status: number } {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return { ok: false, error: 'Link inválido.', status: 400 }

  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  if (!safeCompare(sig, expected)) {
    return { ok: false, error: 'Link inválido.', status: 401 }
  }

  let data: { type: string; email: string; exp: number }
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return { ok: false, error: 'Link inválido.', status: 400 }
  }

  if (data.type !== 'magic') {
    return { ok: false, error: 'Link inválido.', status: 401 }
  }
  if (Date.now() > data.exp) {
    return { ok: false, error: 'Link expirado. Pede um novo acesso em agencygroup.pt/portal/login', status: 401 }
  }

  return { ok: true, data }
}

// ── Shared: consume token + issue session cookie ─────────────────────────────
async function consumeToken(
  token: string,
  data: { email: string; exp: number },
  secret: string,
): Promise<
  | { ok: true; cookieName: string; cookieValue: string; cookieOptions: object; cookieHeaderValue: string }
  | { ok: false; error: string; status: number }
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const { error: insertError } = await db
    .from('used_magic_tokens')
    .insert({
      token_hash: tokenHash,
      email: data.email,
      used_at: new Date().toISOString(),
      expires_at: new Date(data.exp).toISOString(),
    })

  if (insertError?.code === '23505') {
    return { ok: false, error: 'Link já utilizado. Pede um novo acesso em agencygroup.pt/portal/login', status: 401 }
  }
  if (insertError && insertError.code !== '42P01') {
    console.error('[Auth] Failed to mark token as used:', insertError)
    return { ok: false, error: 'Erro interno. Tenta novamente.', status: 500 }
  }

  const sessionPayload = Buffer.from(JSON.stringify({
    email: data.email,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  })).toString('base64url')
  const sessionSig = createHmac('sha256', secret).update(sessionPayload).digest('hex')
  const sessionCookieValue = `${sessionPayload}.${sessionSig}`
  const cookieName = 'ag-auth-token'
  // IE11 ignores Max-Age; Expires is required for IE/IE-mode compatibility.
  // Both are set so all browsers honour the 8-hour lifetime.
  const expiresDate = new Date(Date.now() + SESSION_MAX_AGE * 1000).toUTCString()
  const cookieOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
    expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
  }
  const cookieHeaderValue = [
    `${cookieName}=${sessionCookieValue}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
    `Expires=${expiresDate}`,
    'Path=/',
    ...(IS_PRODUCTION ? ['Secure'] : []),
  ].join('; ')

  return { ok: true, cookieName, cookieValue: sessionCookieValue, cookieOptions, cookieHeaderValue }
}

// ── GET: validate only (browser nav from email) or consume (fetch callers) ───
//
// TWO-STEP DESIGN — protects against email security scanner pre-fetch:
//
//   wantsJson = true  (HomeNav / login page fetch with Accept: application/json)
//     → consume token immediately, return JSON + Set-Cookie
//     → same as before; no change for code callers
//
//   wantsJson = false (browser navigation from email link)
//     → validate signature + expiry WITHOUT consuming the one-time token
//     → return a 200 HTML confirmation page with a hidden form that auto-submits
//       via JavaScript (email scanners can't run JS → token is preserved)
//     → user's browser runs the JS → form POST → POST handler consumes token
//
// This eliminates the "Link já utilizado" failure caused by scanners (Outlook Safe
// Links, Barracuda, Proofpoint, etc.) that follow links before the user clicks them.
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

    // ── Validate token (signature + expiry) ──────────────────────────────────
    const validation = validateToken(token, SECRET)
    if (!validation.ok) {
      return errorResponse(validation.error, validation.status)
    }

    // ── Fetch callers (HomeNav / login page): consume immediately ────────────
    if (wantsJson) {
      const consume = await consumeToken(token, validation.data, SECRET)
      if (!consume.ok) {
        return NextResponse.json({ error: consume.error }, { status: consume.status })
      }
      const res = NextResponse.json({ ok: true, email: validation.data.email }, {
        headers: { 'Cache-Control': 'no-store, no-cache' },
      })
      res.cookies.set(consume.cookieName, consume.cookieValue, consume.cookieOptions)
      return res
    }

    // ── Browser navigation from email: show confirmation page ────────────────
    //
    // The page auto-submits via JavaScript — seamless for real users.
    // Email scanners cannot execute JavaScript, so the token is NOT consumed
    // when the scanner pre-fetches the URL. The POST handler does the actual
    // token consumption only after the user's browser submits the form.
    const safeToken = encodeURIComponent(token)
    const confirmHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>A entrar… · Agency Group</title>
  <style>
    body{margin:0;background:#0c1f15;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#c9a96e;font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;text-align:center;padding:24px}
    #btn{display:inline-block;background:#c9a96e;color:#0c1f15;padding:14px 32px;border:none;cursor:pointer;font-size:.65rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;margin-top:20px;text-decoration:none}
  </style>
</head>
<body>
  <div>
    <p id="msg">A entrar no portal…</p>
    <form id="f" method="post" action="/api/auth/verify?token=${safeToken}">
      <button id="btn" type="submit">Entrar no Portal →</button>
    </form>
  </div>
  <script>
    // Auto-submit — runs in the user's browser; email scanners cannot run JS.
    // The button remains visible as fallback if JS delays (IE compatibility).
    try {
      document.getElementById('msg').textContent = 'A entrar no portal\u2026';
      document.getElementById('btn').style.display = 'none';
      document.getElementById('f').submit();
    } catch(e) {
      document.getElementById('btn').style.display = 'inline-block';
    }
  </script>
</body>
</html>`

    return new Response(confirmHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }
}

// ── POST: consume token + issue session cookie (called by confirmation form) ──
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkVerifyRateLimit(ip)
  if (!rl.allowed) {
    return new Response(
      `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><title>Erro · Agency Group</title>
      <style>body{margin:0;background:#0c1f15;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#f4f0e6;text-align:center;padding:24px}</style>
      </head><body>
      <div>
        <p style="font-size:.9rem;line-height:1.8;color:rgba(244,240,230,.7);margin-bottom:24px">Demasiadas tentativas. Tente novamente em 15 minutos.</p>
        <a href="/portal/login" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:12px 28px;text-decoration:none;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase">Pedir novo acesso →</a>
      </div>
      </body></html>`,
      { status: 429, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '900', 'Cache-Control': 'no-store' } }
    )
  }

  if (!SECRET) {
    return NextResponse.json({ error: 'Configuração inválida' }, { status: 500 })
  }

  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(new URL('/portal/login', req.url))
    }

    const errorHtml = (msg: string, status: number) =>
      new Response(
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

    // Validate token
    const validation = validateToken(token, SECRET)
    if (!validation.ok) {
      return errorHtml(validation.error, validation.status)
    }

    // Consume token + issue session
    const consume = await consumeToken(token, validation.data, SECRET)
    if (!consume.ok) {
      return errorHtml(consume.error, consume.status)
    }

    // 200 HTML response with Set-Cookie + JS redirect to /portal
    // (NOT a 302 redirect — see verify GET route comment about cross-origin redirect chains)
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
        'Set-Cookie': consume.cookieHeaderValue,
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
    })
  } catch {
    return NextResponse.redirect(new URL('/portal/login', req.url))
  }
}
