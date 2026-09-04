// =============================================================================
// PUBLIC LEADS CAPTURE API — Agency Group
// No auth required — public entry point for website CTAs
// Phase 2A: delegates persistence to ingestCommercialLead (contact + activity)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { ingestCommercialLead, type IngestSource } from '@/lib/crm/ingestLead'

export const runtime = 'nodejs'

const LeadSchema = z.object({
  name:         z.string().min(1).max(120).optional(),
  email:        z.string().email().optional(),
  phone:        z.string().max(30).optional(),
  source:       z.string().max(80).optional().default('website'),
  message:      z.string().max(2000).optional(),
  zona:         z.string().max(80).optional(),
  budget_min:   z.coerce.number().optional(),
  budget_max:   z.coerce.number().optional(),
  timeline:     z.string().max(80).optional(),
  use_type:     z.string().max(80).optional(),
  property_ref: z.string().max(40).optional(),
  property_name: z.string().max(200).optional(),
  lang:         z.string().max(5).optional().default('pt'),
  nationality:  z.string().max(100).optional(),
  intent:       z.enum(['buyer', 'seller', 'investor']).optional(),
  page_url:     z.string().max(500).optional(),
  // Idempotency: UUID generated per browser submission — prevents duplicate activities on retry
  submission_id: z.string().uuid().optional(),
  // UTM source attribution (migration 039)
  utm_source:   z.string().max(120).optional(),
  utm_medium:   z.string().max(120).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_term:     z.string().max(200).optional(),
  utm_content:  z.string().max(200).optional(),
  utm_landing:  z.string().max(500).optional(),
}).refine(d => d.email || d.phone, {
  message: 'email or phone required',
})

const VALID_SOURCES: IngestSource[] = [
  'contacto', 'property_enquiry', 'sofia_widget', 'sofia_handoff', 'scheduling', 'website',
]

function toIngestSource(raw: string): IngestSource {
  return VALID_SOURCES.includes(raw as IngestSource) ? (raw as IngestSource) : 'website'
}

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)

  // Rate limit: 5 leads per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`leads:${ip}`, { maxAttempts: 5, windowMs: 3_600_000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiadas submissões. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(getRetryAfterMinutes(rl.reset) * 60) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = LeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const {
      name, email, phone, source, message,
      zona, budget_min, budget_max, timeline,
      use_type, property_ref, property_name, nationality, intent,
      page_url, submission_id,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_landing,
    } = parsed.data

    // ── CRM persistence via shared service (contact + activity) ─────────────
    const result = await ingestCommercialLead({
      name, email, phone,
      source:        toIngestSource(source ?? 'website'),
      message,
      zona,
      budget_min,
      budget_max,
      timeline,
      use_type,
      property_ref,
      property_name,
      nationality,
      intent,
      page_url:      page_url ?? req.headers.get('referer') ?? undefined,
      submissionId:  submission_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      utm_landing,
      corrId,
    })

    if (!result.success) {
      console.error('[leads] ingestCommercialLead failed:', result.error, { corrId })
      return NextResponse.json({ error: 'Erro ao guardar lead' }, { status: 500 })
    }

    const { contactId, isNew } = result
    const intentLabel = intent ?? (
      use_type === 'vendedor'   ? 'seller'   :
      use_type === 'investidor' ? 'investor' : 'buyer'
    )
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agencygroup.pt'

    // ── Fire-and-forget side effects ─────────────────────────────────────────
    if (contactId) {
      // 1. Lead scoring
      const portalSecret = process.env.PORTAL_API_SECRET
      if (portalSecret) {
        fetch(`${siteUrl}/api/automation/lead-score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${portalSecret}`,
          },
          body: JSON.stringify({
            name:        name || 'Website Lead',
            email:       email       || undefined,
            phone:       phone       || undefined,
            source:      source      || 'website',
            message:     message     || undefined,
            budget:      budget_max  || undefined,
            nationality: nationality || undefined,
            timeline:    timeline    || undefined,
          }),
        }).catch(err => console.error('[leads] scoring error:', err instanceof Error ? err.message : String(err), { corrId }))
      }

      // 2. Agent email alert (Resend) — secondary, non-blocking
      if (process.env.RESEND_API_KEY && process.env.AGENT_ALERT_EMAIL) {
        const contactLabel = name ? `${name} (${email || phone})` : (email || phone)
        const sourceLabel  = source || 'website'
        const zonaLabel    = zona ? ` · ${zona}` : ''
        const budgetLabel  = budget_max ? ` · até €${Number(budget_max).toLocaleString('pt-PT')}` : ''
        const newBadge     = isNew ? '🆕 ' : '🔄 '

        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Agency Group CRM <crm@agencygroup.pt>',
            to:   [process.env.AGENT_ALERT_EMAIL],
            subject: `${newBadge}${intent === 'seller' ? '🏠 VENDEDOR' : intent === 'investor' ? '💼 INVESTIDOR' : '🔔 Novo lead'}: ${contactLabel}${zonaLabel}${budgetLabel}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;padding:24px;">
                <h2 style="color:#1c4a35;margin:0 0 16px;">
                  ${isNew ? 'Novo Lead' : 'Lead Actualizado'} — Agency Group
                </h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Nome</td><td style="padding:8px 0;font-size:13px;font-weight:600;">${name || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Email</td><td style="padding:8px 0;font-size:13px;">${email || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Telefone</td><td style="padding:8px 0;font-size:13px;">${phone || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Fonte</td><td style="padding:8px 0;font-size:13px;">${sourceLabel}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Zona</td><td style="padding:8px 0;font-size:13px;">${zona || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Orçamento</td><td style="padding:8px 0;font-size:13px;">${budget_max ? `até €${Number(budget_max).toLocaleString('pt-PT')}` : '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Imóvel</td><td style="padding:8px 0;font-size:13px;">${property_ref || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Intent</td><td style="padding:8px 0;font-size:13px;color:#c9a96e;font-weight:700;">${intentLabel}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">CRM ID</td><td style="padding:8px 0;font-size:11px;font-family:monospace;color:#999;">${contactId}</td></tr>
                </table>
                ${message ? `<div style="margin-top:16px;padding:12px;background:#f4f0e6;border-left:3px solid #1c4a35;font-size:13px;">${message}</div>` : ''}
                <div style="margin-top:20px;">
                  <a href="${siteUrl}/portal" style="background:#1c4a35;color:#f4f0e6;padding:10px 20px;text-decoration:none;font-size:12px;display:inline-block;">
                    Abrir no Portal →
                  </a>
                </div>
                <p style="margin-top:20px;color:#999;font-size:11px;">Agency Group · AMI 22506 · ${new Date().toLocaleString('pt-PT')}</p>
              </div>
            `,
          }),
        }).catch(err =>
          console.error('[leads] Resend agent alert failed (lead captured):', err?.message ?? err, { corrId })
        )
      }

      // 3. n8n Workflow A — lead inbound enrichment (fire-and-forget)
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
      if (n8nWebhookUrl) {
        fetch(`${n8nWebhookUrl}/webhook/lead-inbound`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event:       'lead_created',
            contact_id:  contactId,
            is_new:      isNew,
            name:        name || 'Website Lead',
            email:       email    || null,
            phone:       phone    || null,
            source:      source   || 'website',
            property_ref: property_ref || null,
            zona:        zona        || null,
            budget_max:  budget_max  || null,
            nationality: nationality || null,
            intent:      intentLabel,
            created_at:  new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(err =>
          console.error('[leads] n8n lead-inbound webhook failed:', err?.message ?? err, { corrId })
        )
      }
    }

    return NextResponse.json({
      success: true,
      id: contactId,
    })
  } catch (err) {
    console.error('[leads] error:', err, { corrId })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
