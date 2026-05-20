// =============================================================================
// GET /api/alerts/unsubscribe?email=...&zona=...&tipo=...&token=HMAC
// One-click unsubscribe — HMAC-SHA256 token required (AUTH_SECRET-signed)
//
// SECURITY: plain email-in-URL is an IDOR — any attacker knowing a victim's
// email can unsubscribe them. Fix: token = HMAC_SHA256(AUTH_SECRET, email:zona:tipo)
// Token generation: use lib/security/unsubscribeToken.ts → generateUnsubscribeToken()
// Backward compat: links without a token are rejected with a 403 + helpful message.
//
// Returns HTML page so it works from email clients
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/** Constant-time HMAC token verification. Returns true only if token is valid. */
function verifyUnsubscribeToken(email: string, zona: string, tipo: string, token: string): boolean {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    // AUTH_SECRET not configured — fail closed (safer than fail open)
    console.error('[alerts/unsubscribe] AUTH_SECRET not set — rejecting all requests')
    return false
  }
  const expected = createHmac('sha256', secret)
    .update(`${email}:${zona}:${tipo}`)
    .digest('hex')
  try {
    const buf1 = Buffer.from(token, 'hex')
    const buf2 = Buffer.from(expected, 'hex')
    if (buf1.length !== buf2.length) return false
    return timingSafeEqual(buf1, buf2)
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim().toLowerCase()
  const zona  = searchParams.get('zona')  ?? 'Todas'
  const tipo  = searchParams.get('tipo')  ?? 'Todos'
  const token = searchParams.get('token') ?? ''

  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return new NextResponse(unsubscribePage('error', 'Link de cancelamento inválido.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // SECURITY: Verify HMAC token — prevents IDOR unsubscribe attack
  if (!verifyUnsubscribeToken(email, zona, tipo, token)) {
    console.warn('[alerts/unsubscribe] Invalid or missing HMAC token', { email: email.slice(0, 3) + '***' })
    return new NextResponse(
      unsubscribePage('error', 'Este link de cancelamento expirou ou é inválido. Por favor, clique no link mais recente no seu email.'),
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const client = getServiceClient()
  if (client) {
    await client
      .from('public_saved_searches')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('email', email)
      .eq('zona', zona)
      .eq('tipo', tipo)
      .eq('is_active', true)
  }

  return new NextResponse(unsubscribePage('success', `O alerta para ${zona !== 'Todas' ? zona : 'todos os imóveis'} foi cancelado.`), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function unsubscribePage(status: 'success' | 'error', message: string): string {
  const isSuccess = status === 'success'
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${isSuccess ? 'Alerta cancelado' : 'Erro'} — Agency Group</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Georgia,serif;background:#f4f0e6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;max-width:480px;width:100%;padding:48px 40px;border:1px solid rgba(14,14,13,.08);text-align:center}
    .icon{font-size:2.5rem;margin-bottom:16px}
    .label{font-family:'Courier New',monospace;font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;color:${isSuccess ? '#1c4a35' : '#e74c3c'};margin-bottom:12px}
    h1{font-weight:300;font-size:1.4rem;color:#0c1f15;margin-bottom:12px}
    p{color:rgba(14,14,13,.6);font-size:.85rem;line-height:1.7;margin-bottom:28px}
    a{display:inline-block;background:#1c4a35;color:#c9a96e;padding:12px 28px;text-decoration:none;font-family:'Courier New',monospace;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '✓' : '⚠'}</div>
    <div class="label">Agency Group · Alertas</div>
    <h1>${isSuccess ? 'Alerta cancelado' : 'Erro ao cancelar'}</h1>
    <p>${message}</p>
    <a href="https://www.agencygroup.pt/imoveis">Ver Imóveis →</a>
  </div>
</body>
</html>`
}
