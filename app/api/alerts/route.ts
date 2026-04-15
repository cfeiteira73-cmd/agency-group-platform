import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import { safeCompare } from '@/lib/safeCompare'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AlertSubscription {
  id: string
  email: string
  zona: string
  tipo: string
  precoMin: number
  precoMax: number
  quartosMin: number
  piscina: boolean
  purpose: string
  keyword?: string
  source?: string
  createdAt: string
  active: boolean
}

// ─── Supabase service client (bypasses RLS, used for admin ops) ───────────────
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseServiceClient(url, key)
}

// ─── n8n webhook trigger ──────────────────────────────────────────────────────
async function triggerN8nSavedSearch(sub: AlertSubscription): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    await fetch(`${webhookUrl}/webhook/saved-search-created`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'saved_search_created',
        id: sub.id,
        email: sub.email,
        zona: sub.zona,
        tipo: sub.tipo,
        preco_min: sub.precoMin,
        preco_max: sub.precoMax,
        quartos_min: sub.quartosMin,
        piscina: sub.piscina,
        purpose: sub.purpose,
        keyword: sub.keyword ?? null,
        source: sub.source ?? 'imoveis_page',
        created_at: sub.createdAt,
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // n8n unavailable — non-blocking, do not fail the request
  }
}

// ─── Supabase CRUD ────────────────────────────────────────────────────────────
async function createInSupabase(sub: AlertSubscription): Promise<boolean> {
  const client = getServiceClient()
  if (!client) return false
  // dedup already handled by findExistingInSupabase before this call
  // use insert (not upsert) — table has no unique constraint on (email,zona,tipo)
  const { error } = await client.from('public_saved_searches').insert({
    id: sub.id,
    email: sub.email,
    zona: sub.zona,
    tipo: sub.tipo,
    preco_min: sub.precoMin,
    preco_max: sub.precoMax,
    quartos_min: sub.quartosMin,
    piscina: sub.piscina,
    purpose: sub.purpose,
    keyword: sub.keyword ?? null,
    source: sub.source ?? 'imoveis_page',
    is_active: true,
    created_at: sub.createdAt,
  })
  if (error) console.error('Supabase insert error:', error.message, error.code)
  return !error
}

async function findExistingInSupabase(
  email: string, zona: string, tipo: string
): Promise<AlertSubscription | null> {
  const client = getServiceClient()
  if (!client) return null
  const { data } = await client
    .from('public_saved_searches')
    .select('*')
    .eq('email', email)
    .eq('zona', zona)
    .eq('tipo', tipo)
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    email: data.email,
    zona: data.zona,
    tipo: data.tipo,
    precoMin: data.preco_min,
    precoMax: data.preco_max,
    quartosMin: data.quartos_min,
    piscina: data.piscina,
    purpose: data.purpose ?? 'buy',
    keyword: data.keyword ?? undefined,
    source: data.source ?? 'imoveis_page',
    createdAt: data.created_at,
    active: data.is_active,
  }
}

async function getActiveFromSupabase(zonaFilter?: string): Promise<AlertSubscription[]> {
  const client = getServiceClient()
  if (!client) return []
  let query = client
    .from('public_saved_searches')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500)
  if (zonaFilter && zonaFilter !== 'Todas') {
    // Match subscribers who want this specific zone OR all zones
    query = query.or(`zona.eq.${zonaFilter},zona.eq.Todas`)
  }
  const { data } = await query
  if (!data) return []
  return data.map(d => ({
    id: d.id,
    email: d.email,
    zona: d.zona,
    tipo: d.tipo,
    precoMin: d.preco_min,
    precoMax: d.preco_max,
    quartosMin: d.quartos_min,
    piscina: d.piscina,
    purpose: d.purpose ?? 'buy',
    keyword: d.keyword ?? undefined,
    source: d.source ?? 'imoveis_page',
    createdAt: d.created_at,
    active: d.is_active,
  }))
}

// ─── Email helpers: Resend → nodemailer SMTP fallback ─────────────────────────
async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'Agency Group <alertas@agencygroup.pt>',
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (res.ok) return true
    } catch { /* fallthrough */ }
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      })
      await transporter.sendMail({
        from: `"Agency Group" <${smtpUser}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      })
      return true
    } catch (e) { console.error('SMTP error:', e) }
  }
  return false
}

function buildConfirmationEmail(sub: AlertSubscription): string {
  const criteria = [
    sub.zona !== 'Todas' ? `Zona: ${sub.zona}` : '',
    sub.tipo !== 'Todos' ? `Tipo: ${sub.tipo}` : '',
    sub.precoMax < 10000000 ? `Até €${sub.precoMax.toLocaleString('pt-PT')}` : '',
    sub.quartosMin > 0 ? `T${sub.quartosMin}+` : '',
    sub.piscina ? 'Com Piscina' : '',
    sub.purpose !== 'buy' ? `Objetivo: ${sub.purpose === 'invest' ? 'Investimento' : 'Compra + Investimento'}` : '',
    sub.keyword ? `Pesquisa: "${sub.keyword}"` : '',
  ].filter(Boolean)

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#0a1a10;">
    <div style="padding:48px 40px 32px;border-bottom:1px solid rgba(201,169,110,.2);text-align:center;">
      <div style="color:#c9a96e;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;font-family:'Courier New',monospace;">Agency Group · AMI 22506</div>
      <h1 style="color:#f4f0e6;font-size:28px;font-weight:300;margin:0;">Alerta Ativado</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:rgba(244,240,230,.7);font-size:15px;line-height:1.7;margin-bottom:24px;">
        O seu alerta de imóveis foi criado. Será notificado assim que surgir algo que corresponda ao seu perfil.
      </p>
      <div style="background:rgba(201,169,110,.08);border:1px solid rgba(201,169,110,.2);padding:20px 24px;margin-bottom:32px;">
        <div style="color:#c9a96e;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:12px;font-family:'Courier New',monospace;">Critérios de Pesquisa</div>
        ${criteria.length > 0
          ? criteria.map(c => `<div style="color:#f4f0e6;font-size:14px;margin-bottom:6px;">✓ ${c}</div>`).join('')
          : '<div style="color:#f4f0e6;font-size:14px;">✓ Todos os imóveis disponíveis</div>'
        }
      </div>
      <a href="https://agencygroup.pt/imoveis" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:14px 32px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;font-family:'Courier New',monospace;">Ver Imóveis Disponíveis →</a>
    </div>
    <div style="padding:24px 40px;border-top:1px solid rgba(201,169,110,.12);text-align:center;">
      <p style="color:rgba(244,240,230,.3);font-size:12px;line-height:1.6;font-family:'Courier New',monospace;">
        Agency Group · Torre Soleil 1B, Oeiras · AMI 22506<br>
        Para cancelar: <a href="mailto:geral@agencygroup.pt" style="color:#c9a96e;">geral@agencygroup.pt</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildDealAlertEmail(sub: AlertSubscription, deal: Record<string, unknown>): string {
  const preco = Number(deal['preco'] ?? 0)
  const score = Number(deal['score'] ?? 0)
  const titulo = String(deal['titulo'] ?? 'Imóvel disponível')
  const zona = String(deal['zona'] ?? '')
  const url = String(deal['url'] ?? '#')
  const classificacao = String(deal['classificacao'] ?? '')
  const isAtaque = score >= 88

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0c1f15;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#0a1a10;">
    <div style="padding:40px;border-bottom:1px solid rgba(201,169,110,.2);text-align:center;">
      <div style="color:#c9a96e;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;font-family:'Courier New',monospace;">Agency Group · Radar Alert</div>
      <h1 style="color:#f4f0e6;font-size:24px;font-weight:300;margin:0;">${isAtaque ? '🔥 Oportunidade Crítica Detectada' : '⭐ Nova Oportunidade Radar'}</h1>
    </div>
    <div style="padding:32px 40px;">
      ${isAtaque ? `<div style="background:#e53e3e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.15em;padding:8px 16px;text-align:center;font-family:'Courier New',monospace;margin-bottom:20px;">ATAQUE IMEDIATO — SCORE ${score}/99</div>` : ''}
      <h2 style="color:#f4f0e6;font-size:18px;margin:0 0 8px;">${titulo}</h2>
      <div style="color:rgba(244,240,230,.5);font-size:13px;font-family:'Courier New',monospace;margin-bottom:20px;">${zona}</div>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding-right:32px;">
            <div style="color:rgba(201,169,110,.6);font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Preço</div>
            <div style="color:#c9a96e;font-size:20px;font-weight:700;">€${preco.toLocaleString('pt-PT')}</div>
          </td>
          <td>
            <div style="color:rgba(201,169,110,.6);font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Score</div>
            <div style="color:#f4f0e6;font-size:20px;font-weight:700;font-family:'Courier New',monospace;">${score}/99</div>
          </td>
        </tr>
      </table>
      <div style="color:rgba(244,240,230,.7);font-size:13px;margin-bottom:24px;font-family:'Courier New',monospace;">${classificacao}</div>
      <a href="${url}" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:12px 28px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;font-family:'Courier New',monospace;">Ver Imóvel →</a>
    </div>
    <div style="padding:20px 40px;border-top:1px solid rgba(201,169,110,.1);text-align:center;">
      <p style="color:rgba(244,240,230,.25);font-size:11px;font-family:'Courier New',monospace;margin:0;">
        Alerta para ${sub.zona} · Agency Group AMI 22506<br>
        <a href="mailto:geral@agencygroup.pt" style="color:rgba(201,169,110,.4);">Cancelar alerta</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ─── POST /api/alerts — Create subscription ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const email = String(body['email'] ?? '').trim().toLowerCase()
    const zona = String(body['zona'] ?? 'Todas')
    const tipo = String(body['tipo'] ?? 'Todos')
    const precoMin = Number(body['precoMin'] ?? 0)
    const precoMax = Number(body['precoMax'] ?? 10000000)
    const quartosMin = Number(body['quartosMin'] ?? 0)
    const piscina = Boolean(body['piscina'] ?? false)
    const purpose = String(body['purpose'] ?? 'buy')
    const keyword = body['keyword'] ? String(body['keyword']).trim().slice(0, 120) : undefined
    const source = body['source'] ? String(body['source']) : 'imoveis_page'

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // Dedup check — Supabase first
    const existing = await findExistingInSupabase(email, zona, tipo)
    if (existing) {
      return NextResponse.json({ message: 'Already subscribed', id: existing.id })
    }

    const subscription: AlertSubscription = {
      id: crypto.randomUUID(),
      email, zona, tipo, precoMin, precoMax, quartosMin, piscina,
      purpose, keyword, source,
      createdAt: new Date().toISOString(),
      active: true,
    }

    // 1. Persist to Supabase (primary)
    const saved = await createInSupabase(subscription)
    if (!saved) {
      console.error('Failed to persist saved search to Supabase')
    }

    // 2. Fire n8n webhook (async, non-blocking)
    triggerN8nSavedSearch(subscription).catch(() => {})

    // 3. Send confirmation email (async, non-blocking)
    sendEmail({
      to: email,
      subject: 'Alerta de Imóveis Ativado — Agency Group',
      html: buildConfirmationEmail(subscription),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      id: subscription.id,
      message: 'Alerta criado com sucesso',
      stored: saved ? 'supabase' : 'degraded',
    })
  } catch (err) {
    console.error('Alert API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ─── GET /api/alerts — List active subscriptions (admin / cron / n8n) ─────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  if (mode === 'active') {
    const authHeader = req.headers.get('authorization')
    const isCron = req.headers.get('x-vercel-cron') === '1'
    // Accept CRON_SECRET (Vercel cron), PORTAL_API_SECRET (n8n wf-Q), or ADMIN_SECRET
    const validSecrets = [
      process.env.CRON_SECRET,
      process.env.PORTAL_API_SECRET,
      process.env.ADMIN_SECRET,
    ].filter(Boolean) as string[]
    const isAuthorized = isCron || validSecrets.some(s => safeCompare(authHeader ?? '', `Bearer ${s}`))
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const zonaFilter = searchParams.get('zona') ?? undefined
    const active = await getActiveFromSupabase(zonaFilter)
    return NextResponse.json({ subscriptions: active, count: active.length })
  }

  // Full admin list
  const authHeader = req.headers.get('authorization')
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.ADMIN_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const subscriptions = await getActiveFromSupabase()
  return NextResponse.json({ subscriptions, count: subscriptions.length })
}

// ─── PATCH /api/alerts — Deactivate subscription (admin / n8n only) ──────────
export async function PATCH(req: NextRequest) {
  // Requires ADMIN_SECRET or PORTAL_API_SECRET — not public
  const authHeader = req.headers.get('authorization')
  const validSecrets = [
    process.env.ADMIN_SECRET,
    process.env.PORTAL_API_SECRET,
    process.env.CRON_SECRET,
  ].filter(Boolean) as string[]
  const isAuthorized = validSecrets.some(s => safeCompare(authHeader ?? '', `Bearer ${s}`))
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = String(body['id'] ?? '')
    const status = String(body['status'] ?? 'active')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const client = getServiceClient()
    if (client) {
      await client
        .from('public_saved_searches')
        .update({ is_active: status === 'active', updated_at: new Date().toISOString() })
        .eq('id', id)
    }
    return NextResponse.json({ success: true, id, status })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// ─── Notify subscribers of a matching deal (called by digest/radar) ───────────
export async function notifySubscribersOfDeal(deal: Record<string, unknown>): Promise<number> {
  const active = await getActiveFromSupabase()
  const dealZona = String(deal['zona'] ?? '')
  const dealPreco = Number(deal['preco'] ?? 0)
  let sent = 0

  for (const sub of active) {
    if (sub.zona !== 'Todas' && typeof dealZona === 'string' && dealZona && !dealZona.includes(sub.zona.split(' — ')[0])) continue
    if (dealPreco > 0 && dealPreco < sub.precoMin) continue
    if (dealPreco > 0 && sub.precoMax < 10000000 && dealPreco > sub.precoMax) continue

    const ok = await sendEmail({
      to: sub.email,
      subject: `🔥 Oportunidade Score ${Number(deal['score'] ?? 0)} — ${String(deal['zona'] ?? '')} — Agency Group`,
      html: buildDealAlertEmail(sub, deal),
    })
    if (ok) sent++
  }
  return sent
}
