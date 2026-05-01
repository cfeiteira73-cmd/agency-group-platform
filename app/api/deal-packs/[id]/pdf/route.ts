// =============================================================================
// Agency Group — Deal Pack PDF Export
// GET /api/deal-packs/[id]/pdf
//
// STRATEGY:
//   A. If PDFSHIFT_API_KEY is configured → render via PDFShift API (headless)
//   B. Fallback → return print-optimized HTML (browser saves as PDF)
//
// The HTML output is fully self-contained (inline CSS, no external deps)
// suitable for print-to-PDF in any browser or Puppeteer.
//
// AUTH: portal auth (agent) OR CRON_SECRET (internal automation)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import { portalAuthGate }            from '@/lib/requirePortalAuth'
import { getZone }                   from '@/lib/market/zones'

export const runtime    = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth: accepts portal auth OR cron secret (for automated generation)
// ---------------------------------------------------------------------------

async function authGate(req: NextRequest): Promise<{ ok: boolean; email: string | null }> {
  // Cron/automation path
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const token =
      req.headers.get('x-cron-secret') ??
      req.headers.get('authorization')?.replace('Bearer ', '').trim()
    if (token === cronSecret) return { ok: true, email: null }
  }

  // Portal auth path
  const portalAuth = await portalAuthGate(req)
  if (portalAuth.authed) return { ok: true, email: portalAuth.email ?? null }

  return { ok: false, email: null }
}

// ---------------------------------------------------------------------------
// Fetch deal pack + related data
// ---------------------------------------------------------------------------

interface DealPackFull {
  id:           string
  status:       string
  created_by:   string
  ai_summary:   string | null
  metadata:     Record<string, unknown> | null
  created_at:   string
  view_count:   number
  // Joined
  property?: {
    id:                     string
    title:                  string
    price:                  number
    zone:                   string | null
    zone_key:               string | null
    type:                   string | null
    area_m2:                number | null
    bedrooms:               number | null
    bathrooms:              number | null
    condition:              string | null
    features:               string[] | null
    photos:                 string[] | null
    address:                string | null
    description:            string | null
    opportunity_score:      number | null
    estimated_rental_yield: number | null
    estimated_cap_rate:     number | null
    score_reason:           string | null
    score_breakdown:        Record<string, number> | null
    days_on_market:         number | null
    price_per_sqm:          number | null
    is_exclusive:           boolean | null
  } | null
  lead?: {
    id:        string
    full_name: string
    email:     string | null
    phone:     string | null
    language:  string | null
  } | null
}

async function fetchDealPackFull(id: string): Promise<DealPackFull | null> {
  const { data, error } = await supabaseAdmin
    .from('deal_packs')
    .select(`
      id, status, created_by, ai_summary, metadata, created_at, view_count,
      property:properties (
        id, title, price, zone, zone_key, type, area_m2, bedrooms, bathrooms,
        condition, features, photos, address, description,
        opportunity_score, estimated_rental_yield, estimated_cap_rate,
        score_reason, score_breakdown, days_on_market, price_per_sqm, is_exclusive
      ),
      lead:contacts (
        id, full_name, email, phone, language
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as unknown as DealPackFull
}

// ---------------------------------------------------------------------------
// HTML render — fully self-contained, print-optimized
// ---------------------------------------------------------------------------

function renderDealPackHtml(pack: DealPackFull): string {
  const p = pack.property
  const lead = pack.lead

  const title       = p?.title ?? 'Propriedade'
  const price       = p?.price ? `€ ${p.price.toLocaleString('pt-PT')}` : 'Preço sob consulta'
  const zone        = p?.zone ?? p?.zone_key ?? 'Portugal'
  const area        = p?.area_m2 ? `${p.area_m2} m²` : ''
  const bedrooms    = p?.bedrooms != null ? `T${p.bedrooms}` : ''
  const bathrooms   = p?.bathrooms != null ? `${p.bathrooms} WC` : ''
  const condition   = p?.condition ?? ''
  const address     = p?.address ?? ''
  const type        = p?.type ?? ''
  const score         = p?.opportunity_score ?? null
  const yieldStr      = p?.estimated_rental_yield ? `${p.estimated_rental_yield.toFixed(2)}%` : null
  const capRateStr    = p?.estimated_cap_rate ? `${p.estimated_cap_rate.toFixed(2)}%` : null
  const scoreReason   = p?.score_reason ?? null
  const breakdown     = p?.score_breakdown ?? null
  const dom           = p?.days_on_market ?? null
  const ppm2          = p?.price_per_sqm ?? (p?.area_m2 && p.area_m2 > 0 ? Math.round(p.price / p.area_m2) : null)
  const isExclusive   = p?.is_exclusive ?? false
  const description   = p?.description ?? ''
  const summary       = pack.ai_summary ?? ''

  // Zone benchmarks
  const zoneKey     = p?.zone_key ?? null
  const zoneData    = zoneKey ? getZone(zoneKey) : null

  const photos      = (p?.photos ?? []).slice(0, 4)
  const features    = (p?.features ?? []).slice(0, 8)

  const leadName    = lead?.full_name ?? ''
  const createdDate = new Date(pack.created_at).toLocaleDateString('pt-PT', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const featureList = features.map(f => `<span class="feature-tag">${f}</span>`).join('')
  const photoGrid   = photos.map((src, i) => `
    <div class="photo-cell ${i === 0 ? 'photo-main' : 'photo-thumb'}">
      <img src="${escapeHtml(src)}" alt="Foto ${i + 1}" />
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deal Pack — ${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: white;
      line-height: 1.5;
    }

    @page {
      size: A4;
      margin: 14mm 14mm 12mm 14mm;
    }

    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #c9a96e;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .brand { font-size: 20pt; font-weight: 700; letter-spacing: -0.5px; color: #111; }
    .brand span { color: #c9a96e; }
    .brand-sub { font-size: 8pt; color: #777; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 8pt; color: #777; }
    .doc-meta strong { font-size: 10pt; color: #333; }

    /* ── Exclusive badge ── */
    .exclusive-badge {
      display: inline-block;
      background: #1a1a1a;
      color: #c9a96e;
      font-size: 7pt;
      font-weight: 600;
      letter-spacing: 1px;
      padding: 3px 8px;
      border-radius: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    /* ── Property title block ── */
    .property-title { font-size: 20pt; font-weight: 700; color: #111; line-height: 1.2; }
    .property-meta  { font-size: 10pt; color: #555; margin-top: 4px; }
    .property-price { font-size: 22pt; font-weight: 700; color: #c9a96e; margin-top: 8px; }

    /* ── Photo grid ── */
    .photo-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 4px;
      margin: 16px 0;
      border-radius: 6px;
      overflow: hidden;
      height: 200px;
    }
    .photo-main { grid-column: 1; grid-row: 1 / 3; }
    .photo-thumb { }
    .photo-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }

    /* ── Stats row ── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 16px 0;
    }
    .stat-card {
      background: #f8f6f2;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
    }
    .stat-label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 14pt; font-weight: 700; color: #111; margin-top: 2px; }

    /* ── Score section ── */
    .score-section {
      background: #1a1a1a;
      color: white;
      border-radius: 6px;
      padding: 14px 16px;
      margin: 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .score-number {
      font-size: 32pt;
      font-weight: 700;
      color: #c9a96e;
      line-height: 1;
    }
    .score-label { font-size: 8pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-reason { font-size: 9pt; color: #ddd; margin-top: 4px; max-width: 320px; }

    /* ── Description ── */
    .section-title {
      font-size: 10pt;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 16px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #eee;
    }
    .description { font-size: 10pt; color: #333; line-height: 1.6; }
    .ai-summary {
      font-size: 10pt;
      color: #333;
      line-height: 1.6;
      font-style: italic;
      background: #fafaf8;
      border-left: 3px solid #c9a96e;
      padding: 10px 14px;
      border-radius: 0 4px 4px 0;
    }

    /* ── Features ── */
    .features-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .feature-tag {
      background: #f0ede7;
      color: #555;
      font-size: 8pt;
      padding: 3px 8px;
      border-radius: 3px;
      text-transform: capitalize;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #aaa;
    }
    .footer strong { color: #555; }

    /* ── Print button ── */
    .print-btn {
      position: fixed;
      top: 16px;
      right: 16px;
      background: #c9a96e;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: 600;
      cursor: pointer;
      z-index: 100;
    }
    .print-btn:hover { background: #b8944f; }

    /* ── Financial table ── */
    .fin-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10pt;
    }
    .fin-table th {
      text-align: left;
      font-size: 8pt;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px 4px 0;
      border-bottom: 1px solid #eee;
      font-weight: 500;
    }
    .fin-table td {
      padding: 6px 8px 6px 0;
      border-bottom: 1px solid #f5f5f5;
      color: #333;
      vertical-align: top;
    }
    .fin-table td.fin-val {
      font-weight: 600;
      color: #111;
      white-space: nowrap;
    }
    .fin-table td.fin-bench {
      font-size: 9pt;
      color: #888;
    }

    /* ── Score breakdown bars ── */
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 8px;
    }
    .breakdown-item {
      background: #f8f6f2;
      border-radius: 4px;
      padding: 8px 10px;
    }
    .breakdown-dim { font-size: 7.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }
    .breakdown-bar-wrap { background: #e8e3db; border-radius: 2px; height: 4px; margin: 4px 0; }
    .breakdown-bar { background: #c9a96e; border-radius: 2px; height: 4px; }
    .breakdown-score { font-size: 9pt; font-weight: 600; color: #333; }

    /* ── Risk notice ── */
    .risk-section {
      background: #fff8f0;
      border: 1px solid #ffe4b5;
      border-radius: 6px;
      padding: 12px 14px;
      margin-top: 16px;
      font-size: 9pt;
      color: #555;
      line-height: 1.6;
    }
    .risk-section strong { color: #333; }
    .risk-section ul { margin: 6px 0 0 16px; }
    .risk-section li { margin-bottom: 3px; }
  </style>
</head>
<body>

  <button class="print-btn no-print" onclick="window.print()">⬇ Guardar PDF</button>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">Agency<span>Group</span></div>
      <div class="brand-sub">AMI 22506 · Real Estate de Luxo em Portugal</div>
    </div>
    <div class="doc-meta">
      <strong>Deal Pack Confidencial</strong><br />
      ${leadName ? `Para: ${escapeHtml(leadName)}<br />` : ''}
      Data: ${escapeHtml(createdDate)}<br />
      Ref: ${escapeHtml(pack.id.slice(0, 8).toUpperCase())}
    </div>
  </div>

  <!-- Title + Price -->
  ${isExclusive ? '<div class="exclusive-badge">Imóvel Exclusivo</div>' : ''}
  <div class="property-title">${escapeHtml(title)}</div>
  <div class="property-meta">
    ${[zone, address].filter(Boolean).map(escapeHtml).join(' · ')}
    ${[type, condition].filter(Boolean).map(escapeHtml).join(' · ')
      .replace(/^/, ' · ').replace(/^ · $/, '')}
  </div>
  <div class="property-price">${escapeHtml(price)}</div>

  <!-- Photos -->
  ${photos.length > 0 ? `<div class="photo-grid">${photoGrid}</div>` : ''}

  <!-- Stats -->
  <div class="stats-row">
    ${area ? `<div class="stat-card"><div class="stat-label">Área</div><div class="stat-value">${escapeHtml(area)}</div></div>` : ''}
    ${bedrooms ? `<div class="stat-card"><div class="stat-label">Tipologia</div><div class="stat-value">${escapeHtml(bedrooms)}</div></div>` : ''}
    ${bathrooms ? `<div class="stat-card"><div class="stat-label">Casa de Banho</div><div class="stat-value">${escapeHtml(bathrooms)}</div></div>` : ''}
    ${yieldStr ? `<div class="stat-card"><div class="stat-label">Yield Estimado</div><div class="stat-value">${escapeHtml(yieldStr)}</div></div>` : ''}
  </div>

  <!-- Score -->
  ${score != null ? `
  <div class="score-section">
    <div>
      <div class="score-label">Score de Oportunidade</div>
      <div class="score-reason">${escapeHtml(scoreReason ?? '')}</div>
    </div>
    <div class="score-number">${score}<span style="font-size:14pt;color:#888">/100</span></div>
  </div>
  ` : ''}

  <!-- AI Summary -->
  ${summary ? `
  <div class="section-title">Análise de Investimento</div>
  <div class="ai-summary">${escapeHtml(summary)}</div>
  ` : ''}

  <!-- Financial Analysis -->
  ${(yieldStr || capRateStr || ppm2 || zoneData) ? `
  <div class="section-title">Análise Financeira</div>
  <table class="fin-table">
    <thead>
      <tr>
        <th>Indicador</th>
        <th>Este Imóvel</th>
        <th>Benchmark Zona</th>
      </tr>
    </thead>
    <tbody>
      ${yieldStr ? `
      <tr>
        <td>Yield Bruto Estimado</td>
        <td class="fin-val">${escapeHtml(yieldStr)}</td>
        <td class="fin-bench">${zoneData ? `Zona: ${zoneData.yield_bruto.toFixed(1)}%` : '—'}</td>
      </tr>` : ''}
      ${capRateStr ? `
      <tr>
        <td>Cap Rate (após encargos)</td>
        <td class="fin-val">${escapeHtml(capRateStr)}</td>
        <td class="fin-bench">~75% do yield bruto</td>
      </tr>` : ''}
      ${ppm2 ? `
      <tr>
        <td>Preço por m²</td>
        <td class="fin-val">€ ${ppm2.toLocaleString('pt-PT')}/m²</td>
        <td class="fin-bench">${zoneData ? `Mediana transacção: €${zoneData.pm2_trans.toLocaleString('pt-PT')}/m²` : '—'}</td>
      </tr>` : ''}
      ${dom != null ? `
      <tr>
        <td>Dias no Mercado</td>
        <td class="fin-val">${dom} dias</td>
        <td class="fin-bench">${zoneData ? `Mediana zona: ${zoneData.dias_mercado} dias` : '—'}</td>
      </tr>` : ''}
      ${zoneData ? `
      <tr>
        <td>Absorção de Mercado</td>
        <td class="fin-val">—</td>
        <td class="fin-bench">${zoneData.abs_meses} meses · YoY +${zoneData.var_yoy}%</td>
      </tr>` : ''}
    </tbody>
  </table>
  ` : ''}

  <!-- Score Breakdown -->
  ${breakdown ? `
  <div class="section-title" style="margin-top:14px">Decomposição do Score</div>
  <div class="breakdown-grid">
    <div class="breakdown-item">
      <div class="breakdown-dim">Preço vs Zona</div>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${Math.round((breakdown.d1_price_vs_zone/30)*100)}%"></div></div>
      <div class="breakdown-score">${breakdown.d1_price_vs_zone}<span style="color:#aaa;font-weight:400">/30</span></div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-dim">Yield</div>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${Math.round((breakdown.d2_rental_yield/20)*100)}%"></div></div>
      <div class="breakdown-score">${breakdown.d2_rental_yield}<span style="color:#aaa;font-weight:400">/20</span></div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-dim">Momentum</div>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${Math.round((breakdown.d3_momentum/15)*100)}%"></div></div>
      <div class="breakdown-score">${breakdown.d3_momentum}<span style="color:#aaa;font-weight:400">/15</span></div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-dim">Tempo Mercado</div>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${Math.round((breakdown.d4_dom_position/15)*100)}%"></div></div>
      <div class="breakdown-score">${breakdown.d4_dom_position}<span style="color:#aaa;font-weight:400">/15</span></div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-dim">Tipo de Activo</div>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${Math.round((breakdown.d5_asset_type/10)*100)}%"></div></div>
      <div class="breakdown-score">${breakdown.d5_asset_type}<span style="color:#aaa;font-weight:400">/10</span></div>
    </div>
    <div class="breakdown-item">
      <div class="breakdown-dim">Fit Investidor</div>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${Math.round((breakdown.d6_investor_fit/10)*100)}%"></div></div>
      <div class="breakdown-score">${breakdown.d6_investor_fit}<span style="color:#aaa;font-weight:400">/10</span></div>
    </div>
  </div>
  ` : ''}

  <!-- Description -->
  ${description ? `
  <div class="section-title">Descrição do Imóvel</div>
  <div class="description">${escapeHtml(description)}</div>
  ` : ''}

  <!-- Features -->
  ${featureList ? `
  <div class="section-title">Características</div>
  <div class="features-list">${featureList}</div>
  ` : ''}

  <!-- Risks & Caveats -->
  <div class="risk-section">
    <strong>Riscos e Considerações</strong>
    <ul>
      ${zoneData && zoneData.risco >= 7 ? `<li><strong>Zona de risco elevado (${zoneData.risco}/10):</strong> maior volatilidade de preços e liquidez reduzida.</li>` : ''}
      ${zoneData && zoneData.liquidez < 5 ? `<li><strong>Liquidez abaixo da média (${zoneData.liquidez}/10):</strong> período de saída potencialmente superior a ${zoneData.dias_mercado} dias.</li>` : ''}
      ${dom != null && zoneData && dom > zoneData.dias_mercado * 1.5 ? `<li><strong>Imóvel estagnado:</strong> ${dom} dias no mercado vs ${zoneData.dias_mercado} dias mediana — investigar motivo.</li>` : ''}
      <li>Yield calculado com base em rendas de zona — valores reais sujeitos a ocupação, gestão e fiscalidade.</li>
      <li>Cap rate estimado assume encargos de 25%; análise fiscal individual recomendada.</li>
      <li>Todos os valores são indicativos e não constituem aconselhamento financeiro ou de investimento.</li>
    </ul>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <strong>Agency Group</strong> · AMI 22506 · info@agencygroup.pt<br />
      www.agencygroup.pt · Comissão 5% (50% CPCV + 50% Escritura)
    </div>
    <div style="text-align:right">
      Documento confidencial · ${escapeHtml(createdDate)}<br />
      Dados sujeitos a confirmação. Valores não vinculativos.
    </div>
  </div>

</body>
</html>`
}

// ---------------------------------------------------------------------------
// PDFShift render (if API key configured)
// ---------------------------------------------------------------------------

async function renderViaPdfShift(html: string): Promise<Buffer | null> {
  const apiKey = process.env.PDFSHIFT_API_KEY
  if (!apiKey) return null

  try {
    const resp = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        source:    html,
        format:    'A4',
        margin:    '14mm',
        landscape: false,
        use_print: true,
        delay:     500,
      }),
    })

    if (!resp.ok) {
      console.error(`[deal-packs/pdf] PDFShift error ${resp.status}: ${await resp.text()}`)
      return null
    }

    const arrayBuffer = await resp.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[deal-packs/pdf] PDFShift exception:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Escape HTML
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await authGate(req)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid deal pack ID' }, { status: 400 })
  }

  // Fetch deal pack
  const pack = await fetchDealPackFull(id)
  if (!pack) {
    return NextResponse.json({ error: 'Deal pack not found' }, { status: 404 })
  }

  // Check format param
  const format = req.nextUrl.searchParams.get('format') ?? 'auto'

  // Render HTML
  const html = renderDealPackHtml(pack)

  // Fire-and-forget view count increment helper
  const bumpViewCount = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any)
      .rpc('increment_deal_pack_view_count', { pack_id: id })
      .then(() => {})
      .catch(() => {})
  }

  // Try PDF generation first (if configured and format != 'html')
  if (format !== 'html') {
    const pdfBuffer = await renderViaPdfShift(html)
    if (pdfBuffer) {
      bumpViewCount()
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `inline; filename="deal-pack-${id.slice(0, 8)}.pdf"`,
          'Cache-Control':       'no-store',
        },
      })
    }
  }

  // Fallback: return HTML (browser print → Save as PDF)
  bumpViewCount()

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-PDF-Method':  'html-fallback',
    },
  })
}
