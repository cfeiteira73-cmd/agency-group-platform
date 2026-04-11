// ─── /api/auth/gen ─────────────────────────────────────────────────────────
// Gera uma sessão portal instantânea para o admin.
// Protegido por INTERNAL_API_SECRET — só o admin conhece o segredo.
//
// Uso:
//   https://www.agencygroup.pt/api/auth/gen?s=<INTERNAL_API_SECRET>
//
// O endpoint usa o AUTH_SECRET do servidor (produção ou dev, conforme o ambiente)
// e cria o cookie ag-auth-token directamente — sem email, sem Supabase, sem passos intermédios.
// Válido 8h.

import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { safeCompare } from '@/lib/safeCompare'

const SESSION_MAX_AGE = 8 * 60 * 60 // 8 horas em segundos
const IS_PRODUCTION   = process.env.NODE_ENV === 'production'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const secret   = process.env.INTERNAL_API_SECRET
  const authKey  = process.env.AUTH_SECRET
  const adminEmail = process.env.ADMIN_EMAIL || 'geral@agencygroup.pt'

  // 1. Validar que as variáveis críticas estão configuradas
  if (!secret || !authKey) {
    return new Response(errorHtml('Servidor não configurado. Verifica INTERNAL_API_SECRET e AUTH_SECRET no Vercel.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 2. Verificar segredo na query string (?s=...)
  const providedSecret = req.nextUrl.searchParams.get('s') ?? ''
  if (!safeCompare(providedSecret, secret)) {
    return new Response(errorHtml('Acesso negado.'), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 3. Criar cookie de sessão assinado com AUTH_SECRET (o mesmo que /api/auth/verify usa)
  const sessionPayload = Buffer.from(JSON.stringify({
    email: adminEmail,
    exp:   Date.now() + SESSION_MAX_AGE * 1000,
  })).toString('base64url')

  const sessionSig = createHmac('sha256', authKey).update(sessionPayload).digest('hex')
  const sessionCookieValue = `${sessionPayload}.${sessionSig}`

  const cookieHeaderValue = [
    `ag-auth-token=${sessionCookieValue}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    ...(IS_PRODUCTION ? ['Secure'] : []),
  ].join('; ')

  // 4. Retorna HTML que define o cookie e redireciona para /portal
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="refresh" content="0;url=/portal"/>
  <title>A entrar no Portal…</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:#0c1f15;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-direction:column;
      gap:16px;
      font-family:'Helvetica Neue',sans-serif;
    }
    .logo{
      font-size:.6rem;
      letter-spacing:.28em;
      text-transform:uppercase;
      color:rgba(201,169,110,.6);
    }
    .msg{
      font-size:.8rem;
      letter-spacing:.1em;
      text-transform:uppercase;
      color:#c9a96e;
    }
    .dot{
      width:6px;height:6px;
      border-radius:50%;
      background:#c9a96e;
      animation:pulse 1s infinite;
    }
    @keyframes pulse{
      0%,100%{opacity:.4;transform:scale(.8)}
      50%{opacity:1;transform:scale(1.2)}
    }
  </style>
</head>
<body>
  <div class="logo">Agency Group · AMI 22506</div>
  <div class="dot"></div>
  <div class="msg">A entrar no portal…</div>
  <script>
    // Cookie já definido pelo Set-Cookie header — redirecionar para o portal
    setTimeout(function(){ window.location.replace('/portal') }, 300)
  </script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Set-Cookie':    cookieHeaderValue,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma':        'no-cache',
    },
  })
}

function errorHtml(msg: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Erro de Acesso</title>
  <style>
    body{margin:0;background:#0c1f15;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;}
    .box{background:#0e2518;border:1px solid rgba(201,169,110,.2);padding:40px;max-width:400px;text-align:center;}
    .label{font-size:.5rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.5);margin-bottom:12px;}
    .msg{color:#f4f0e6;font-size:.9rem;line-height:1.7;}
    a{color:#c9a96e;font-size:.75rem;margin-top:20px;display:block;}
  </style>
</head>
<body>
  <div class="box">
    <div class="label">Agency Group · Portal</div>
    <div class="msg">${msg}</div>
    <a href="/portal/login">← Ir para o login</a>
  </div>
</body>
</html>`
}
