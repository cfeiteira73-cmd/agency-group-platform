// ─── POST /api/contacto — Contact form handler ────────────────────────────────
// CRM-FIRST: persists to Supabase before any email notification.
// If CRM fails → redirect to /contacto?erro=sistema (no false success).
// If CRM succeeds but alert fails → lead is safe, redirect to obrigado.
// Phase 2A: source='contacto', activity type='contact_form'.
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { rateLimit } from '@/lib/rateLimit'
import { withResend } from '@/lib/ops/withResend'
import { ingestCommercialLead } from '@/lib/crm/ingestLead'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

const RESEND_KEY  = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL  = 'Agency Group <geral@agencygroup.pt>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'geral@agencygroup.pt'

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agencygroup.pt',
  'https://www.agencygroup.pt',
  'https://agencygroup.vercel.app',
]

function buildAdminEmail(data: Record<string, string>, isNew: boolean): string {
  const rows = [
    ['Nome',      data.nome      || '—'],
    ['Email',     data.email     || '—'],
    ['Telefone',  data.tel       || '—'],
    ['Zona',      data.zona      || '—'],
    ['Objetivo',  data.objetivo  || '—'],
    ['Orçamento', data.orcamento || '—'],
    ['CRM',       isNew ? '🆕 Novo contacto criado' : '🔄 Contacto actualizado'],
  ]
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#060d08;font-family:monospace;color:#e8dfc8;padding:28px">
  <h2 style="margin:0 0 20px;font-family:Georgia,serif;color:#c9a96e;font-weight:300">Novo Briefing de Contacto</h2>
  <table cellpadding="8" style="font-size:.85rem;border-collapse:collapse">
    ${rows.map(([label, value]) => `
    <tr>
      <td style="color:rgba(201,169,110,.65);padding:6px 20px 6px 0;vertical-align:top;white-space:nowrap">${label}</td>
      <td style="color:#e8dfc8;padding:6px 0">${value}</td>
    </tr>`).join('')}
  </table>
  <p style="margin:24px 0 0;font-size:.72rem;color:rgba(201,169,110,.3)">Agency Group · Briefing Contacto · ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}</p>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)

  // ── Rate limit: 3 submissions per IP per minute ────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`contacto:${ip}`, { maxAttempts: 3, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.redirect(new URL('/contacto?erro=limite', req.url))
  }

  // ── CSRF check ─────────────────────────────────────────────────────────────
  const origin = req.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return NextResponse.redirect(new URL('/contacto?erro=1', req.url))
  }

  try {
    const body = await req.formData()
    const data: Record<string, string> = {}
    for (const [key, value] of body.entries()) {
      if (key in data) {
        data[key] = `${data[key]}, ${value}`
      } else {
        data[key] = String(value).trim()
      }
    }

    // ── Input validation ───────────────────────────────────────────────────
    // Amendment 4: require contactability — EMAIL OR PHONE minimum
    const hasEmail = !!data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    const hasPhone = !!data.tel && data.tel.length >= 6
    if (!hasEmail && !hasPhone) {
      return NextResponse.redirect(new URL('/contacto?erro=contacto', req.url))
    }
    if (data.nome && data.nome.length > 100) {
      return NextResponse.redirect(new URL('/contacto?erro=campos', req.url))
    }
    if (data.tel && data.tel.length > 30) {
      return NextResponse.redirect(new URL('/contacto?erro=campos', req.url))
    }
    if (data.email && data.email.length > 200) {
      return NextResponse.redirect(new URL('/contacto?erro=campos', req.url))
    }

    // ── Capture page_url and UTM from hidden form fields ──────────────────
    const pageUrl    = data.page_url     || req.headers.get('referer') || undefined
    const utmSource   = data.utm_source   || undefined
    const utmMedium   = data.utm_medium   || undefined
    const utmCampaign = data.utm_campaign || undefined
    const utmTerm     = data.utm_term     || undefined
    const utmContent  = data.utm_content  || undefined
    const utmLanding  = data.utm_landing  || undefined

    // ── CRM PERSISTENCE — PRIMARY ─────────────────────────────────────────
    const result = await ingestCommercialLead({
      name:         data.nome    || undefined,
      email:        data.email   || undefined,
      phone:        data.tel     || undefined,
      source:       'contacto',
      zona:         data.zona    || undefined,
      message:      data.objetivo ? `Objetivo: ${data.objetivo}` : undefined,
      budget_max:   data.orcamento ? parseBudgetMax(data.orcamento) : undefined,
      intent:       deriveIntent(data.objetivo),
      page_url:     pageUrl,
      submissionId: crypto.randomUUID(), // idempotency: each form POST is unique
      utm_source:   utmSource,
      utm_medium:   utmMedium,
      utm_campaign: utmCampaign,
      utm_term:     utmTerm,
      utm_content:  utmContent,
      utm_landing:  utmLanding,
      corrId,
    })

    if (!result.success) {
      // CRM failed — no false success
      console.error('[contacto] CRM persistence failed:', result.error, { corrId })
      return NextResponse.redirect(new URL('/contacto?erro=sistema', req.url))
    }

    // ── ALERT EMAIL — SECONDARY (fire-and-forget) ─────────────────────────
    // CRM record exists regardless of what happens here
    if (RESEND_KEY) {
      const resend = new Resend(RESEND_KEY)
      const { error: sendErr } = await withResend(
        () => resend.emails.send({
          from: FROM_EMAIL,
          to:   ADMIN_EMAIL,
          subject: `📩 Novo Briefing — ${data.nome || 'Anónimo'} · ${data.zona || 'Zona n/d'}`,
          html: buildAdminEmail(data, result.isNew),
        }),
        corrId,
      )
      if (sendErr) {
        // Alert failure is non-fatal — lead is already in CRM
        console.error('[contacto] Resend alert failed (lead captured):', { corrId, error: sendErr })
      }
    }

    return NextResponse.redirect(new URL('/contacto?obrigado=1', req.url))
  } catch (err) {
    console.error('[contacto] form submission error:', err, { corrId })
    return NextResponse.redirect(new URL('/contacto?erro=1', req.url))
  }
}

function parseBudgetMax(orcamento: string): number | undefined {
  const map: Record<string, number> = {
    '100k-250k':   250_000,
    '250k-500k':   500_000,
    'ate-500k':    500_000,
    '500k-1m':   1_000_000,
    '1m-2m':     2_000_000,
    '1m-3m':     3_000_000,
    '2m-5m':     5_000_000,
    '3m+':       5_000_000,
    '5m+':      10_000_000,
  }
  return map[orcamento] ?? undefined
}

function deriveIntent(objetivo: string | undefined): 'buyer' | 'seller' | 'investor' | undefined {
  if (!objetivo) return undefined
  const lower = objetivo.toLowerCase()
  if (lower.includes('vender') || lower.includes('avaliar')) return 'seller'
  if (lower.includes('investir') || lower.includes('arrendar')) return 'investor'
  if (lower.includes('comprar')) return 'buyer'
  return undefined
}
