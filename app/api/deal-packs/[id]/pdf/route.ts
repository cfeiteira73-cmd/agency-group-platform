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
    id:           string
    title:        string
    price:        number
    zone:         string | null
    zone_key:     string | null
    type:         string | null
    area_m2:      number | null
    bedrooms:     number | null
    bathrooms:    number | null
    condition:    string | null
    features:     string[] | null
    photos:       string[] | null
    address:      string | null
    description:  string | null
    opportunity_score:      number | null
    estimated_rental_yield: number | null
    score_reason:           string | null
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
        opportunity_score, estimated_rental_yield, score_reason, is_exclusive
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
  const score       = p?.opportunity_score ?? null
  const yieldStr    = p?.estimated_rental_yield ? `${p.estimated_rental_yield}%` : null
  const scoreReason = p?.score_reason ?? null
  const isExclusive = p?.is_exclusive ?? false
  const description = p?.description ?? ''
  const summary     = pack.ai_summary ?? ''

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
