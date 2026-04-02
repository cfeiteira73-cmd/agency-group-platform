import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL    = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://agencygroup.pt'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'geral@agencygroup.pt'
const FROM        = 'Agency Group <geral@agencygroup.pt>'

// ─── Deal stages ──────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  'Angariação',
  'Proposta Enviada',
  'Proposta Aceite',
  'Due Diligence',
  'CPCV Assinado',
  'Financiamento',
  'Escritura Marcada',
  'Escritura Concluída',
]

// ─── Market data (static intel) ──────────────────────────────────────────────
const MARKET_DATA = [
  { zona: 'Lisboa',  preco: '€5.000–€6.500/m²', yoy: '+17,6% YoY', flag: '🏙️' },
  { zona: 'Cascais', preco: '€4.713/m²',         yoy: '+14% YoY',  flag: '🌊' },
  { zona: 'Algarve', preco: '€3.941/m²',         yoy: '+12% YoY',  flag: '☀️' },
  { zona: 'Porto',   preco: '€3.643/m²',         yoy: '+13% YoY',  flag: '🏛️' },
]

// ─── Deal type from radar ─────────────────────────────────────────────────────
interface RadarDeal {
  titulo?: string
  zona?: string
  preco?: number
  score?: number
  pm2?: number
  url?: string
  classificacao?: string
}

// ─── Auth: Bearer token against AUTH_SECRET ───────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization') || ''
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

// ─── Week date range helper ───────────────────────────────────────────────────
function getWeekRange(): { label: string; from: Date; to: Date } {
  const now  = new Date()
  const day  = now.getDay()  // 0=Sun
  const diff = day === 0 ? 6 : day - 1  // Mon=0
  const from = new Date(now)
  from.setDate(now.getDate() - diff)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  to.setHours(23, 59, 59, 999)

  const fmt = (d: Date) =>
    d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })
  const label = `${fmt(from)} – ${fmt(to)} · ${to.getFullYear()}`
  return { label, from, to }
}

// ─── Fetch top-5 deals from internal radar ────────────────────────────────────
async function fetchRadarDeals(): Promise<RadarDeal[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/radar/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zona: 'Lisboa',
        fontes: ['idealista', 'imovirtual', 'eleiloes', 'banca', 'citius', 'supercasa'],
        score_min: 60,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const results: RadarDeal[] = Array.isArray(data.results) ? data.results : []
    return results
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5)
  } catch {
    return []
  }
}

// ─── Score colour ─────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 88) return '#e53e3e'
  if (score >= 78) return '#c9a96e'
  if (score >= 68) return '#38a169'
  return '#718096'
}

// ─── Format price ─────────────────────────────────────────────────────────────
function fmtPrice(n?: number): string {
  if (!n || n <= 0) return '—'
  return `€${n.toLocaleString('pt-PT')}`
}

// ─── Build radar deal row HTML ────────────────────────────────────────────────
function buildRadarRow(deal: RadarDeal, i: number): string {
  const score    = deal.score ?? 0
  const ring     = scoreColor(score)
  const title    = deal.titulo || 'Imóvel disponível'
  const zona     = deal.zona   || '—'
  const preco    = fmtPrice(deal.preco)
  const pm2      = deal.pm2 && deal.pm2 > 0 ? `€${deal.pm2}/m²` : '—'
  const classif  = deal.classificacao || ''
  const href     = deal.url || `${BASE_URL}/radar`

  return `
  <tr>
    <td style="padding:14px 16px;border-bottom:1px solid rgba(201,169,110,0.08);vertical-align:top;width:52px;">
      <div style="width:44px;height:44px;border-radius:50%;border:2px solid ${ring};text-align:center;line-height:44px;background:rgba(0,0,0,0.25);">
        <span style="color:${ring};font-size:14px;font-weight:700;font-family:'Courier New',monospace;">${score}</span>
      </div>
    </td>
    <td style="padding:14px 0 14px 12px;border-bottom:1px solid rgba(201,169,110,0.08);vertical-align:top;">
      <div style="color:#f4f0e6;font-size:14px;font-family:Georgia,serif;line-height:1.4;margin-bottom:3px;">${title}</div>
      <div style="color:rgba(244,240,230,0.45);font-size:11px;font-family:'Courier New',monospace;">${zona}${classif ? ' · ' + classif : ''}</div>
    </td>
    <td style="padding:14px 16px;border-bottom:1px solid rgba(201,169,110,0.08);vertical-align:top;text-align:right;white-space:nowrap;">
      <div style="color:#c9a96e;font-size:15px;font-weight:700;font-family:Georgia,serif;">${preco}</div>
      <div style="color:rgba(244,240,230,0.4);font-size:11px;font-family:'Courier New',monospace;">${pm2}</div>
    </td>
    <td style="padding:14px 16px;border-bottom:1px solid rgba(201,169,110,0.08);vertical-align:middle;width:80px;">
      <a href="${href}" style="display:inline-block;background:transparent;border:1px solid rgba(201,169,110,0.4);color:#c9a96e;padding:6px 12px;text-decoration:none;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;font-family:'Courier New',monospace;">Ver →</a>
    </td>
  </tr>`
}

// ─── Build pipeline stage row ─────────────────────────────────────────────────
function buildStageRow(stage: string, i: number): string {
  const isEven = i % 2 === 0
  return `
  <tr style="background:${isEven ? 'rgba(255,255,255,0.02)' : 'transparent'}">
    <td style="padding:11px 20px;border-bottom:1px solid rgba(201,169,110,0.06);color:rgba(244,240,230,0.75);font-size:12px;font-family:'Courier New',monospace;letter-spacing:0.04em;">${stage}</td>
    <td style="padding:11px 20px;border-bottom:1px solid rgba(201,169,110,0.06);text-align:center;color:rgba(244,240,230,0.3);font-size:13px;font-family:'Courier New',monospace;">—</td>
    <td style="padding:11px 20px;border-bottom:1px solid rgba(201,169,110,0.06);text-align:right;color:rgba(244,240,230,0.3);font-size:13px;font-family:'Courier New',monospace;">—</td>
  </tr>`
}

// ─── Build market row ─────────────────────────────────────────────────────────
function buildMarketRow(item: typeof MARKET_DATA[0]): string {
  return `
  <tr>
    <td style="padding:12px 20px;border-bottom:1px solid rgba(201,169,110,0.06);">
      <span style="font-size:16px;margin-right:8px;">${item.flag}</span>
      <span style="color:#f4f0e6;font-size:13px;font-family:'Courier New',monospace;letter-spacing:0.04em;">${item.zona}</span>
    </td>
    <td style="padding:12px 20px;border-bottom:1px solid rgba(201,169,110,0.06);text-align:center;">
      <span style="color:#c9a96e;font-size:13px;font-family:'Courier New',monospace;">${item.preco}</span>
    </td>
    <td style="padding:12px 20px;border-bottom:1px solid rgba(201,169,110,0.06);text-align:right;">
      <span style="color:#38a169;font-size:12px;font-family:'Courier New',monospace;font-weight:700;">${item.yoy}</span>
    </td>
  </tr>`
}

// ─── Build full weekly email HTML ─────────────────────────────────────────────
function buildWeeklyEmail(weekLabel: string, radarDeals: RadarDeal[]): string {
  const now         = new Date()
  const generatedAt = now.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'long', timeStyle: 'short' })

  const stageRows  = PIPELINE_STAGES.map((s, i) => buildStageRow(s, i)).join('')
  const marketRows = MARKET_DATA.map(buildMarketRow).join('')

  const radarSection = radarDeals.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${radarDeals.map((d, i) => buildRadarRow(d, i)).join('')}
       </table>`
    : `<div style="padding:32px;text-align:center;color:rgba(244,240,230,0.35);font-family:'Courier New',monospace;font-size:13px;border:1px dashed rgba(201,169,110,0.15);">
        Nenhum deal encontrado no Radar agora.<br>
        <a href="${BASE_URL}/radar" style="color:#c9a96e;text-decoration:none;margin-top:12px;display:inline-block;">Abrir Radar →</a>
       </div>`

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Relatório Semanal · Agency Group</title>
</head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">


        <!-- ═══ HEADER ═══ -->
        <tr><td style="background:#0c1f15;padding:40px 40px 32px;text-align:center;border-bottom:2px solid #c9a96e;">
          <p style="margin:0 0 4px;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(201,169,110,0.55);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">AMI 22506</p>
          <h1 style="margin:0 0 6px;font-size:26px;font-weight:200;color:#f4f0e6;letter-spacing:0.06em;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Agency Group</h1>
          <div style="margin:0 auto 20px;width:40px;height:1px;background:#c9a96e;opacity:0.5;"></div>
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(201,169,110,0.85);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Relatório Semanal</p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(244,240,230,0.45);font-family:'Courier New',monospace;">${weekLabel}</p>
        </td></tr>


        <!-- ═══ SECTION 1 — RESUMO EXECUTIVO ═══ -->
        <tr><td style="background:#0c1f15;padding:32px 40px 8px;">
          <p style="margin:0 0 20px;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(201,169,110,0.6);font-family:'Courier New',monospace;padding-bottom:10px;border-bottom:1px solid rgba(201,169,110,0.1);">01 · Resumo Executivo</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- KPI 1 -->
              <td width="33%" style="padding:0 8px 24px 0;">
                <div style="border:1px solid rgba(201,169,110,0.2);padding:20px 18px;background:rgba(255,255,255,0.03);">
                  <p style="margin:0 0 6px;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.55);font-family:'Courier New',monospace;">Contactos Activos</p>
                  <p style="margin:0 0 8px;font-size:30px;font-weight:300;color:#f4f0e6;line-height:1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">—</p>
                  <p style="margin:0;font-size:10px;color:rgba(244,240,230,0.3);font-family:'Courier New',monospace;line-height:1.5;">Actualiza via<br>portal CRM</p>
                </div>
              </td>
              <!-- KPI 2 -->
              <td width="33%" style="padding:0 4px 24px;">
                <div style="border:1px solid rgba(201,169,110,0.2);padding:20px 18px;background:rgba(255,255,255,0.03);">
                  <p style="margin:0 0 6px;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.55);font-family:'Courier New',monospace;">Deals em Pipeline</p>
                  <p style="margin:0 0 8px;font-size:30px;font-weight:300;color:#f4f0e6;line-height:1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">—</p>
                  <p style="margin:0;font-size:10px;color:rgba(244,240,230,0.3);font-family:'Courier New',monospace;line-height:1.5;">Ver no<br>Notion CRM</p>
                </div>
              </td>
              <!-- KPI 3 -->
              <td width="33%" style="padding:0 0 24px 8px;">
                <div style="border:1px solid rgba(201,169,110,0.2);padding:20px 18px;background:rgba(255,255,255,0.03);">
                  <p style="margin:0 0 6px;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.55);font-family:'Courier New',monospace;">Follow-ups Esta Semana</p>
                  <p style="margin:0 0 8px;font-size:30px;font-weight:300;color:#f4f0e6;line-height:1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">—</p>
                  <p style="margin:0;font-size:10px;color:rgba(244,240,230,0.3);font-family:'Courier New',monospace;line-height:1.5;">Verificar<br>urgências abaixo</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>


        <!-- ═══ SECTION 2 — PIPELINE STATUS ═══ -->
        <tr><td style="background:#0c1f15;padding:0 40px 32px;">
          <p style="margin:0 0 16px;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(201,169,110,0.6);font-family:'Courier New',monospace;padding-bottom:10px;border-bottom:1px solid rgba(201,169,110,0.1);">02 · Pipeline Status</p>
          <div style="border:1px solid rgba(201,169,110,0.15);overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <!-- Table header -->
              <tr style="background:rgba(201,169,110,0.07);">
                <td style="padding:10px 20px;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.7);font-family:'Courier New',monospace;">Fase</td>
                <td style="padding:10px 20px;text-align:center;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.7);font-family:'Courier New',monospace;">Deals</td>
                <td style="padding:10px 20px;text-align:right;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.7);font-family:'Courier New',monospace;">Volume</td>
              </tr>
              ${stageRows}
            </table>
          </div>
          <p style="margin:12px 0 0;font-size:10px;color:rgba(244,240,230,0.3);font-family:'Courier New',monospace;text-align:center;">
            Acede ao Portal para ver dados em tempo real
          </p>
        </td></tr>


        <!-- ═══ SECTION 3 — FOLLOW-UPS URGENTES ═══ -->
        <tr><td style="background:#0c1f15;padding:0 40px 32px;">
          <p style="margin:0 0 16px;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(201,169,110,0.6);font-family:'Courier New',monospace;padding-bottom:10px;border-bottom:1px solid rgba(201,169,110,0.1);">03 · Follow-ups Urgentes</p>
          <div style="border:1px solid rgba(229,62,62,0.25);background:rgba(229,62,62,0.05);padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="top" style="padding-right:20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:rgba(229,62,62,0.9);letter-spacing:0.1em;text-transform:uppercase;font-family:'Courier New',monospace;">Atenção Requerida</p>
                  <p style="margin:0;font-size:13px;color:rgba(244,240,230,0.7);line-height:1.7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                    Verifica o CRM para follow-ups com mais de <strong style="color:#f4f0e6;">7 dias sem contacto</strong>.<br>
                    Contactos sem resposta perdem urgência e temperatura — actua hoje.
                  </p>
                </td>
                <td valign="top" style="white-space:nowrap;padding-top:4px;">
                  <a href="${BASE_URL}/portal" style="display:inline-block;background:#c9a96e;color:#0c1f15;padding:12px 22px;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;font-family:'Courier New',monospace;">Abrir CRM →</a>
                </td>
              </tr>
            </table>
          </div>
        </td></tr>


        <!-- ═══ SECTION 4 — DEAL RADAR TOP 5 ═══ -->
        <tr><td style="background:#0c1f15;padding:0 40px 32px;">
          <p style="margin:0 0 16px;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(201,169,110,0.6);font-family:'Courier New',monospace;padding-bottom:10px;border-bottom:1px solid rgba(201,169,110,0.1);">04 · Deal Radar — Top 5</p>
          <div style="border:1px solid rgba(201,169,110,0.15);">
            ${radarSection}
          </div>
          <div style="text-align:center;margin-top:16px;">
            <a href="${BASE_URL}/radar" style="display:inline-block;background:transparent;border:1px solid rgba(201,169,110,0.35);color:#c9a96e;padding:11px 28px;text-decoration:none;font-size:10px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;font-family:'Courier New',monospace;">Ver Radar Completo →</a>
          </div>
        </td></tr>


        <!-- ═══ SECTION 5 — MERCADO ESTA SEMANA ═══ -->
        <tr><td style="background:#0c1f15;padding:0 40px 32px;border-bottom:2px solid rgba(201,169,110,0.15);">
          <p style="margin:0 0 16px;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(201,169,110,0.6);font-family:'Courier New',monospace;padding-bottom:10px;border-bottom:1px solid rgba(201,169,110,0.1);">05 · Mercado Esta Semana</p>
          <div style="border:1px solid rgba(201,169,110,0.15);overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr style="background:rgba(201,169,110,0.07);">
                <td style="padding:10px 20px;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.7);font-family:'Courier New',monospace;">Zona</td>
                <td style="padding:10px 20px;text-align:center;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.7);font-family:'Courier New',monospace;">Preço/m²</td>
                <td style="padding:10px 20px;text-align:right;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,110,0.7);font-family:'Courier New',monospace;">Variação</td>
              </tr>
              ${marketRows}
            </table>
          </div>
          <p style="margin:12px 0 0;font-size:10px;color:rgba(244,240,230,0.3);font-family:'Courier New',monospace;text-align:center;">
            Fonte: Dados de mercado 2026 · Mediana nacional €3.076/m² · +17,6% · 169.812 transacções
          </p>
        </td></tr>


        <!-- ═══ FOOTER ═══ -->
        <tr><td style="background:#091710;padding:28px 40px;text-align:center;">
          <p style="margin:0 0 10px;font-size:10px;color:rgba(244,240,230,0.25);font-family:'Courier New',monospace;line-height:1.8;">
            Gerado automaticamente · Agency Group · AMI 22506<br>
            ${generatedAt}<br>
            <a href="${BASE_URL}/portal" style="color:rgba(201,169,110,0.45);text-decoration:none;">Aceder ao Portal</a>
            &nbsp;·&nbsp;
            <a href="mailto:geral@agencygroup.pt" style="color:rgba(201,169,110,0.45);text-decoration:none;">geral@agencygroup.pt</a>
          </p>
          <p style="margin:0;font-size:9px;color:rgba(244,240,230,0.15);font-family:'Courier New',monospace;">
            Os dados de pipeline são estimativas. Verifica sempre no CRM antes de tomar decisões.
          </p>
        </td></tr>


      </table>
    </td></tr>
  </table>

</body>
</html>`
}

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Auth check
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const targetEmail = searchParams.get('email') || ADMIN_EMAIL
  const isPreview   = searchParams.get('preview') === 'true'

  // Validate email param
  if (!targetEmail.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const week = getWeekRange()

  // Fetch radar deals (non-blocking — if it fails we show placeholder)
  const radarDeals = await fetchRadarDeals().catch(() => [] as RadarDeal[])

  const html = buildWeeklyEmail(week.label, radarDeals)

  // Preview mode — return HTML directly for browser testing
  if (isPreview) {
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurado' }, { status: 500 })
  }

  try {
    const resend = new Resend(resendKey)

    const now = new Date()
    const subject = `Relatório Semanal · Agency Group · ${now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}`

    const { data, error } = await resend.emails.send({
      from: FROM,
      to:   targetEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[weekly-report] Resend error:', error)
      return NextResponse.json({ error: 'Falha ao enviar email', detail: error }, { status: 502 })
    }

    return NextResponse.json({
      success:      true,
      sent_to:      targetEmail,
      email_id:     data?.id,
      week:         week.label,
      radar_deals:  radarDeals.length,
      generated_at: now.toISOString(),
    })
  } catch (err) {
    console.error('[weekly-report] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno. Tenta novamente.' }, { status: 500 })
  }
}
