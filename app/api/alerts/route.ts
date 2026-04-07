import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { randomBytes } from 'crypto'
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
  createdAt: string
  active: boolean
  notionPageId?: string
}

// ─── In-memory fallback (resets on cold start) ────────────────────────────────
const memorySubscriptions: AlertSubscription[] = []

// ─── Notion helpers ────────────────────────────────────────────────────────────
const NOTION_TOKEN = () => process.env.NOTION_TOKEN ?? ''
const NOTION_ALERTS_DB = () => process.env.NOTION_ALERTS_DB ?? ''

function notionAvailable(): boolean {
  return Boolean(NOTION_TOKEN() && NOTION_ALERTS_DB())
}

async function notionRequest(
  path: string,
  method = 'GET',
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN()}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion ${method} ${path} → ${res.status}: ${text}`)
  }
  return (await res.json()) as Record<string, unknown>
}

// ─── Parse Notion page → AlertSubscription ────────────────────────────────────
function parseNotionPage(page: unknown): AlertSubscription | null {
  try {
    const p = page as Record<string, unknown>
    const props = (p['properties'] as Record<string, unknown>) ?? {}

    const getProp = (key: string): Record<string, unknown> =>
      (props[key] as Record<string, unknown>) ?? {}

    const titleItems = (getProp('Email')['title'] as unknown[]) ?? []
    const email = titleItems.length > 0
      ? String(((titleItems[0] as Record<string, unknown>)['plain_text'] as string) ?? '')
      : ''

    const zonaSelect = (getProp('Zona')['select'] as Record<string, unknown>) ?? {}
    const tipoSelect = (getProp('Tipo')['select'] as Record<string, unknown>) ?? {}
    const statusSelect = (getProp('Status')['select'] as Record<string, unknown>) ?? {}
    const idRich = (getProp('ID')['rich_text'] as unknown[]) ?? []
    const createdAtDate = (getProp('CreatedAt')['date'] as Record<string, unknown>) ?? {}

    const id = idRich.length > 0
      ? String(((idRich[0] as Record<string, unknown>)['plain_text'] as string) ?? '')
      : String(p['id'] ?? '')

    return {
      id: id || String(p['id'] ?? ''),
      email,
      zona: String(zonaSelect['name'] ?? 'Todas'),
      tipo: String(tipoSelect['name'] ?? 'Todos'),
      precoMin: Number(getProp('PrecoMin')['number'] ?? 0),
      precoMax: Number(getProp('PrecoMax')['number'] ?? 10000000),
      quartosMin: Number(getProp('QuartosMin')['number'] ?? 0),
      piscina: String(statusSelect['name'] ?? '').includes('piscina'),
      createdAt: String(createdAtDate['start'] ?? new Date().toISOString()),
      active: String(statusSelect['name'] ?? 'active') === 'active',
      notionPageId: String(p['id'] ?? ''),
    }
  } catch {
    return null
  }
}

// ─── Notion CRUD ──────────────────────────────────────────────────────────────
async function getSubscriptionsFromNotion(): Promise<AlertSubscription[]> {
  try {
    const result = await notionRequest(`/databases/${NOTION_ALERTS_DB()}/query`, 'POST', {
      filter: { property: 'Status', select: { equals: 'active' } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 100,
    })
    const results = Array.isArray(result['results']) ? result['results'] : []
    return results
      .map((p: unknown) => parseNotionPage(p))
      .filter((s): s is AlertSubscription => s !== null)
  } catch {
    return []
  }
}

async function getAllSubscriptionsFromNotion(): Promise<AlertSubscription[]> {
  try {
    const result = await notionRequest(`/databases/${NOTION_ALERTS_DB()}/query`, 'POST', {
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 100,
    })
    const results = Array.isArray(result['results']) ? result['results'] : []
    return results
      .map((p: unknown) => parseNotionPage(p))
      .filter((s): s is AlertSubscription => s !== null)
  } catch {
    return []
  }
}

async function createSubscriptionInNotion(sub: AlertSubscription): Promise<string | null> {
  try {
    const result = await notionRequest('/pages', 'POST', {
      parent: { database_id: NOTION_ALERTS_DB() },
      properties: {
        Email: { title: [{ text: { content: sub.email } }] },
        Zona: { select: { name: sub.zona } },
        Tipo: { select: { name: sub.tipo } },
        PrecoMin: { number: sub.precoMin },
        PrecoMax: { number: sub.precoMax },
        QuartosMin: { number: sub.quartosMin },
        Status: { select: { name: 'active' } },
        ID: { rich_text: [{ text: { content: sub.id } }] },
        CreatedAt: { date: { start: sub.createdAt } },
      },
    })
    return String(result['id'] ?? '')
  } catch (err) {
    console.error('Failed to create Notion subscription:', err)
    return null
  }
}

async function updateSubscriptionStatusInNotion(notionPageId: string, status: string): Promise<void> {
  try {
    await notionRequest(`/pages/${notionPageId}`, 'PATCH', {
      properties: {
        Status: { select: { name: status } },
      },
    })
  } catch (err) {
    console.error('Failed to update Notion subscription status:', err)
  }
}

async function findExistingInNotion(email: string, zona: string, tipo: string): Promise<AlertSubscription | null> {
  try {
    const result = await notionRequest(`/databases/${NOTION_ALERTS_DB()}/query`, 'POST', {
      filter: {
        and: [
          { property: 'Email', title: { equals: email } },
          { property: 'Zona', select: { equals: zona } },
          { property: 'Tipo', select: { equals: tipo } },
          { property: 'Status', select: { equals: 'active' } },
        ],
      },
      page_size: 1,
    })
    const results = Array.isArray(result['results']) ? result['results'] : []
    if (results.length === 0) return null
    return parseNotionPage(results[0])
  } catch {
    return null
  }
}

// ─── Email helpers: Resend → nodemailer SMTP fallback ─────────────────────────
async function sendEmail(params: {
  to: string; subject: string; html: string
}): Promise<boolean> {
  // 1. Try Resend
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: 'Agency Group <alertas@agencygroup.pt>', to: [params.to], subject: params.subject, html: params.html }),
        signal: AbortSignal.timeout(12000),
      })
      if (res.ok) return true
    } catch { /* fallthrough */ }
  }

  // 2. Fallback: nodemailer SMTP
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
  ].filter(Boolean)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#0a1a10;">
    <div style="padding:48px 40px 32px;border-bottom:1px solid rgba(201,169,110,.2);text-align:center;">
      <div style="color:#c9a96e;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;font-family:'Courier New',monospace;">Agency Group · AMI 22506</div>
      <h1 style="color:#f4f0e6;font-size:28px;font-weight:300;margin:0;">Alerta Ativado</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:rgba(244,240,230,.7);font-size:15px;line-height:1.7;margin-bottom:24px;">
        O seu alerta de imóveis foi criado com sucesso. Irá receber notificações quando novos imóveis corresponderem ao seu perfil.
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
        Agency Group · Rua do Alecrim, Lisboa · AMI 22506<br>
        Para cancelar, contacte <a href="mailto:info@agencygroup.pt" style="color:#c9a96e;">info@agencygroup.pt</a>
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
        <a href="mailto:info@agencygroup.pt" style="color:rgba(201,169,110,.4);">Cancelar alerta</a>
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
    const email = String(body['email'] ?? '')
    const zona = String(body['zona'] ?? 'Todas')
    const tipo = String(body['tipo'] ?? 'Todos')
    const precoMin = Number(body['precoMin'] ?? 0)
    const precoMax = Number(body['precoMax'] ?? 10000000)
    const quartosMin = Number(body['quartosMin'] ?? 0)
    const piscina = Boolean(body['piscina'] ?? false)

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // Check for duplicate
    if (notionAvailable()) {
      const existing = await findExistingInNotion(email, zona, tipo)
      if (existing) {
        return NextResponse.json({ message: 'Already subscribed', id: existing.id })
      }
    } else {
      const existing = memorySubscriptions.find(
        s => s.email === email && s.zona === zona && s.tipo === tipo && s.active
      )
      if (existing) {
        return NextResponse.json({ message: 'Already subscribed', id: existing.id })
      }
    }

    const subscription: AlertSubscription = {
      id: `alert_${Date.now()}_${randomBytes(8).toString('hex')}`,
      email, zona, tipo, precoMin, precoMax, quartosMin, piscina,
      createdAt: new Date().toISOString(),
      active: true,
    }

    // Store in Notion or memory
    if (notionAvailable()) {
      const notionPageId = await createSubscriptionInNotion(subscription)
      if (notionPageId) subscription.notionPageId = notionPageId
    } else {
      memorySubscriptions.push(subscription)
    }

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: 'Alerta de Imóveis Ativado — Agency Group',
      html: buildConfirmationEmail(subscription),
    })

    return NextResponse.json({
      success: true,
      id: subscription.id,
      message: 'Alerta criado com sucesso',
      stored: notionAvailable() ? 'notion' : 'memory',
    })
  } catch (err) {
    console.error('Alert API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ─── GET /api/alerts — List all subscriptions (admin) ────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  // /api/alerts?mode=active — returns all active subscriptions (used by digest)
  if (mode === 'active') {
    const authHeader = req.headers.get('authorization')
    const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET
    // Internal cron or authorized admin
    const isCron = req.headers.get('x-vercel-cron') === '1'
    if (!isCron && secret && !safeCompare(authHeader ?? '', `Bearer ${secret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let active: AlertSubscription[] = []
    if (notionAvailable()) {
      active = await getSubscriptionsFromNotion()
    } else {
      active = memorySubscriptions.filter(s => s.active)
    }
    return NextResponse.json({ subscriptions: active, count: active.length })
  }

  // Admin-only full list
  const authHeader = req.headers.get('authorization')
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.ADMIN_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let subscriptions: AlertSubscription[] = []
  if (notionAvailable()) {
    subscriptions = await getAllSubscriptionsFromNotion()
  } else {
    subscriptions = memorySubscriptions
  }

  return NextResponse.json({ subscriptions, count: subscriptions.length })
}

// ─── PATCH /api/alerts — Update subscription status ──────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = String(body['id'] ?? '')
    const status = String(body['status'] ?? 'active')
    const notionPageId = String(body['notionPageId'] ?? '')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    if (notionAvailable() && notionPageId) {
      await updateSubscriptionStatusInNotion(notionPageId, status)
      return NextResponse.json({ success: true, id, status, stored: 'notion' })
    }

    // Update in memory
    const sub = memorySubscriptions.find(s => s.id === id)
    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }
    sub.active = status === 'active'
    return NextResponse.json({ success: true, id, status, stored: 'memory' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// ─── Notify all active subscribers of a high-score deal ──────────────────────
// Called internally by the digest when a deal with score ≥ 85 is found.
export async function notifySubscribersOfDeal(deal: Record<string, unknown>): Promise<number> {
  let active: AlertSubscription[] = []
  if (notionAvailable()) {
    active = await getSubscriptionsFromNotion()
  } else {
    active = memorySubscriptions.filter(s => s.active)
  }

  const dealZona = String(deal['zona'] ?? '')
  const dealPreco = Number(deal['preco'] ?? 0)

  let sent = 0
  for (const sub of active) {
    // Match criteria
    if (sub.zona !== 'Todas' && dealZona && !dealZona.includes(sub.zona.split(' — ')[0])) continue
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
