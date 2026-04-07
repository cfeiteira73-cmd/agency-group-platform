import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// ─── Email sender: Resend → nodemailer SMTP fallback ──────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // 1. Try Resend
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({ from: 'Agency Group Radar <radar@agencygroup.pt>', to: [to], subject, html }),
        signal: AbortSignal.timeout(12000),
      })
      if (r.ok) return true
      console.error('Resend failed:', r.status, await r.text().catch(() => ''))
    } catch (e) { console.error('Resend error:', e) }
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
        from: `"Agency Group Radar" <${smtpUser}>`,
        to, subject, html,
      })
      return true
    } catch (e) { console.error('SMTP error:', e) }
  }

  return false
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Deal {
  url: string
  platform: string
  titulo: string
  morada: string
  zona: string
  preco: number
  area: number
  quartos: number
  pm2: number
  pm2_mercado: number
  score: number
  classificacao: string
  desconto_mercado_pct: number
  yield_bruto_pct: number
  roi5y_pct: number
  tipo_venda: string
  agente: string
  contacto: string
  telefone: string
  is_leilao: boolean
  is_banca: boolean
  valor_base?: number
  prazo_licitacao?: string
  processo?: string
  banco?: string
  imagem?: string
  var_yoy?: number
  liquidez?: number
}

interface SearchResult {
  success: boolean
  zona: string
  results: Deal[]
  total: number
  stats?: Record<string, unknown>
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  // Vercel cron sends x-vercel-cron: 1
  if (req.headers.get('x-vercel-cron') === '1') return true
  // Manual trigger via Bearer token
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (secret && auth === `Bearer ${secret}`) return true
  return false
}

// ─── Fetch deals for one zone ─────────────────────────────────────────────────
async function fetchZoneDeals(baseUrl: string, zona: string): Promise<Deal[]> {
  try {
    const res = await fetch(`${baseUrl}/api/radar/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zona,
        fontes: ['idealista', 'imovirtual', 'eleiloes', 'banca', 'citius', 'supercasa'],
        score_min: 60,
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as SearchResult
    return Array.isArray(data.results) ? data.results : []
  } catch {
    return []
  }
}

// ─── Deduplicate deals ────────────────────────────────────────────────────────
function deduplicateDeals(deals: Deal[]): Deal[] {
  const seen = new Set<string>()
  return deals.filter(d => {
    if (!d.url || seen.has(d.url)) return false
    seen.add(d.url)
    return true
  })
}

// ─── Platform badge ───────────────────────────────────────────────────────────
function getPlatformBadge(deal: Deal): { label: string; color: string; emoji: string } {
  if (deal.is_leilao) return { label: 'LEILÃO', color: '#e53e3e', emoji: '🔨' }
  if (deal.is_banca) return { label: 'BANCA', color: '#3182ce', emoji: '🏦' }
  return { label: 'MERCADO', color: '#38a169', emoji: '🏠' }
}

// ─── Score ring color ─────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 88) return '#e53e3e'
  if (score >= 78) return '#c9a96e'
  if (score >= 68) return '#38a169'
  return '#718096'
}

// ─── Format price ─────────────────────────────────────────────────────────────
function formatPrice(n: number): string {
  if (n <= 0) return '—'
  return `€${n.toLocaleString('pt-PT')}`
}

// ─── Build deal card HTML ─────────────────────────────────────────────────────
function buildDealCard(deal: Deal, index: number): string {
  const badge = getPlatformBadge(deal)
  const ring = scoreColor(deal.score)
  const isAtaque = deal.score >= 88
  const precoFmt = formatPrice(deal.preco)
  const pm2Fmt = deal.pm2 > 0 ? `€${deal.pm2}/m²` : '—'
  const areaFmt = deal.area > 0 ? `${deal.area}m²` : '—'
  const descontoFmt = deal.desconto_mercado_pct !== 0 ? `${deal.desconto_mercado_pct > 0 ? '-' : '+'}${Math.abs(deal.desconto_mercado_pct)}% mercado` : ''

  return `
  <div style="margin-bottom:20px;background:rgba(255,255,255,0.04);border:1px solid rgba(201,169,110,${isAtaque ? '0.5' : '0.15'});padding:20px 24px;position:relative;${isAtaque ? 'box-shadow:0 0 20px rgba(229,62,62,0.15);' : ''}">
    ${isAtaque ? `<div style="position:absolute;top:-1px;right:20px;background:#e53e3e;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.15em;padding:4px 12px;font-family:'Courier New',monospace;">ATAQUE IMEDIATO</div>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="64" valign="top">
          <div style="width:56px;height:56px;border-radius:50%;border:3px solid ${ring};display:inline-flex;align-items:center;justify-content:center;text-align:center;background:rgba(0,0,0,0.3);">
            <span style="color:${ring};font-size:18px;font-weight:700;font-family:'Courier New',monospace;line-height:56px;display:block;padding-top:2px;">${deal.score}</span>
          </div>
        </td>
        <td valign="top" style="padding-left:16px;">
          <div style="margin-bottom:6px;">
            <span style="background:${badge.color};color:#fff;font-size:10px;font-weight:700;letter-spacing:0.12em;padding:3px 8px;font-family:'Courier New',monospace;margin-right:8px;">${badge.emoji} ${badge.label}</span>
            <span style="color:rgba(244,240,230,0.4);font-size:11px;font-family:'Courier New',monospace;">#${String(index + 1).padStart(2,'0')} · ${deal.platform}</span>
          </div>
          <div style="color:#f4f0e6;font-size:15px;font-family:Georgia,serif;margin-bottom:4px;line-height:1.4;">${deal.titulo || 'Imóvel disponível'}</div>
          <div style="color:rgba(244,240,230,0.55);font-size:13px;font-family:'Courier New',monospace;margin-bottom:10px;">${deal.morada || deal.zona}</div>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:24px;">
                <div style="color:rgba(201,169,110,0.6);font-size:10px;letter-spacing:0.12em;font-family:'Courier New',monospace;text-transform:uppercase;">Preço</div>
                <div style="color:#c9a96e;font-size:17px;font-weight:700;font-family:Georgia,serif;">${precoFmt}</div>
              </td>
              ${deal.area > 0 ? `<td style="padding-right:24px;">
                <div style="color:rgba(201,169,110,0.6);font-size:10px;letter-spacing:0.12em;font-family:'Courier New',monospace;text-transform:uppercase;">Área</div>
                <div style="color:#f4f0e6;font-size:14px;font-family:'Courier New',monospace;">${areaFmt}</div>
              </td>` : ''}
              ${deal.pm2 > 0 ? `<td style="padding-right:24px;">
                <div style="color:rgba(201,169,110,0.6);font-size:10px;letter-spacing:0.12em;font-family:'Courier New',monospace;text-transform:uppercase;">€/m²</div>
                <div style="color:#f4f0e6;font-size:14px;font-family:'Courier New',monospace;">${pm2Fmt}</div>
              </td>` : ''}
              ${descontoFmt ? `<td>
                <div style="color:rgba(201,169,110,0.6);font-size:10px;letter-spacing:0.12em;font-family:'Courier New',monospace;text-transform:uppercase;">vs Mercado</div>
                <div style="color:${deal.desconto_mercado_pct > 0 ? '#38a169' : '#e53e3e'};font-size:14px;font-family:'Courier New',monospace;">${descontoFmt}</div>
              </td>` : ''}
            </tr>
          </table>
          ${deal.classificacao ? `<div style="margin-top:10px;color:rgba(244,240,230,0.7);font-size:12px;font-family:'Courier New',monospace;">${deal.classificacao}</div>` : ''}
          <div style="margin-top:12px;">
            <a href="${deal.url}" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:8px 20px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Ver Imóvel →</a>
          </div>
        </td>
      </tr>
    </table>
  </div>`
}

// ─── Build full digest email ──────────────────────────────────────────────────
function buildDigestEmail(deals: Deal[], date: string): string {
  const topScore = deals.length > 0 ? deals[0].score : 0
  const leiloes = deals.filter(d => d.is_leilao).length
  const banca = deals.filter(d => d.is_banca).length
  const mercado = deals.length - leiloes - banca
  const ataqueDeals = deals.filter(d => d.score >= 88).length

  const dealCards = deals.map((d, i) => buildDealCard(d, i)).join('')

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Radar Diário — Agency Group</title>
</head>
<body style="margin:0;padding:0;background:#0c1f15;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1f15;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background:#0a1a10;border:1px solid rgba(201,169,110,0.2);padding:48px 40px 36px;text-align:center;">
          <div style="color:rgba(201,169,110,0.7);font-size:10px;letter-spacing:0.25em;text-transform:uppercase;font-family:'Courier New',monospace;margin-bottom:12px;">Agency Group · AMI 22506</div>
          <h1 style="margin:0 0 8px;color:#f4f0e6;font-size:30px;font-weight:300;letter-spacing:0.05em;">Radar Diário de Oportunidades</h1>
          <div style="color:rgba(244,240,230,0.4);font-size:12px;font-family:'Courier New',monospace;">${date}</div>
          <div style="margin:24px auto 0;width:60px;height:1px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></div>
        </td></tr>

        <!-- STATS BAR -->
        <tr><td style="background:rgba(201,169,110,0.07);border:1px solid rgba(201,169,110,0.15);border-top:none;padding:20px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:0 12px;">
                <div style="color:#c9a96e;font-size:26px;font-weight:700;font-family:'Courier New',monospace;">${deals.length}</div>
                <div style="color:rgba(244,240,230,0.5);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Oportunidades</div>
              </td>
              <td style="text-align:center;padding:0 12px;border-left:1px solid rgba(201,169,110,0.15);">
                <div style="color:#e53e3e;font-size:26px;font-weight:700;font-family:'Courier New',monospace;">${ataqueDeals}</div>
                <div style="color:rgba(244,240,230,0.5);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Ataque Imediato</div>
              </td>
              <td style="text-align:center;padding:0 12px;border-left:1px solid rgba(201,169,110,0.15);">
                <div style="color:#f4f0e6;font-size:26px;font-weight:700;font-family:'Courier New',monospace;">${topScore}</div>
                <div style="color:rgba(244,240,230,0.5);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Score Máx</div>
              </td>
              <td style="text-align:center;padding:0 12px;border-left:1px solid rgba(201,169,110,0.15);">
                <div style="color:#f4f0e6;font-size:13px;font-family:'Courier New',monospace;line-height:1.7;">
                  <span style="color:#e53e3e;">🔨</span> ${leiloes} Leilão<br>
                  <span style="color:#3182ce;">🏦</span> ${banca} Banca<br>
                  <span style="color:#38a169;">🏠</span> ${mercado} Mercado
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- DEALS -->
        <tr><td style="background:#0a1a10;border:1px solid rgba(201,169,110,0.15);border-top:none;padding:32px 32px 24px;">
          <div style="color:rgba(201,169,110,0.8);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;font-family:'Courier New',monospace;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid rgba(201,169,110,0.1);">Top Oportunidades — Ordenadas por Score</div>
          ${dealCards || `<div style="color:rgba(244,240,230,0.4);text-align:center;padding:40px 0;font-family:'Courier New',monospace;font-size:14px;">Nenhuma oportunidade encontrada hoje.<br>Verifique as configurações de fontes.</div>`}
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:#0a1a10;border:1px solid rgba(201,169,110,0.15);border-top:none;padding:24px 40px;text-align:center;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://agencygroup.pt'}/radar" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:14px 40px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;font-family:'Courier New',monospace;">Abrir Radar Completo →</a>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:24px 40px;text-align:center;border-top:1px solid rgba(201,169,110,0.08);">
          <p style="color:rgba(244,240,230,0.25);font-size:11px;line-height:1.7;font-family:'Courier New',monospace;margin:0;">
            Agency Group · AMI 22506 · Portugal<br>
            Este relatório é gerado automaticamente às 08:00 todos os dias.<br>
            Os scores são estimativas algorítmicas. Verifique sempre os dados antes de tomar decisões.<br>
            <a href="mailto:info@agencygroup.pt" style="color:rgba(201,169,110,0.5);text-decoration:none;">info@agencygroup.pt</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── GET handler (Vercel cron + manual POST) ──────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runDigest()
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const auth = req.headers.get('authorization') || ''
    const secret = process.env.CRON_SECRET
    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Allow override of target email via POST body
    const overrideEmail = body.email ? String(body.email) : undefined
    return runDigest(overrideEmail)
  } catch {
    return runDigest()
  }
}

// ─── Core digest logic ────────────────────────────────────────────────────────
async function runDigest(overrideEmail?: string): Promise<NextResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const digestEmail = overrideEmail || process.env.DIGEST_EMAIL || 'geral@agencygroup.pt'

  // Search across 5 zones in parallel
  const zones = ['Lisboa', 'Porto', 'Algarve', 'Madeira — Funchal', 'Nacional']

  const zoneResults = await Promise.allSettled(
    zones.map(zona => fetchZoneDeals(baseUrl, zona))
  )

  const allDeals: Deal[] = zoneResults
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])

  // Deduplicate + sort + top 10 with score >= 75
  const deduped = deduplicateDeals(allDeals)
    .filter(d => d.score >= 75)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const topScore = deduped.length > 0 ? deduped[0].score : 0
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-PT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // Build and send email
  const subject = deduped.length > 0
    ? `🔥 Radar AG — ${deduped.length} oportunidades · Score máx ${topScore} · ${now.toLocaleDateString('pt-PT')}`
    : `Radar AG — Sem oportunidades acima de 75 hoje · ${now.toLocaleDateString('pt-PT')}`

  const emailSent = await sendEmail(digestEmail, subject, buildDigestEmail(deduped, dateStr))

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  const resendKey = process.env.RESEND_API_KEY

  return NextResponse.json({
    success: true,
    sent_to: emailSent ? digestEmail : null,
    email_sent: emailSent,
    email_configured: Boolean(resendKey) || smtpConfigured,
    total_deals: deduped.length,
    top_score: topScore,
    zones_searched: zones,
    generated_at: now.toISOString(),
  })
}
