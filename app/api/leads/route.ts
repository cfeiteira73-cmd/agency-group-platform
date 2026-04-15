// =============================================================================
// PUBLIC LEADS CAPTURE API — Agency Group
// No auth required — public entry point for website CTAs
// Inserts into contacts table via supabaseAdmin (bypasses RLS)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getRetryAfterMinutes } from '@/lib/rateLimit'

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
  lang:         z.string().max(5).optional().default('pt'),
  nationality:  z.string().max(100).optional(),
  intent:       z.enum(['buyer', 'seller', 'investor']).optional(),
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

export async function POST(req: NextRequest) {
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
      use_type, property_ref, nationality, intent,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_landing,
    } = parsed.data

    // Build notes from available context
    const noteParts: string[] = []
    if (message) noteParts.push(`Mensagem: ${message}`)
    if (property_ref) noteParts.push(`Imóvel: ${property_ref}`)

    // Build contact payload
    // Live DB uses original schema.sql (not 001_initial_schema.sql migration).
    // Confirmed live columns: id, agent_email, name, email, phone, nationality,
    //   budget_min, budget_max, tipos, zonas, status, notes, last_contact,
    //   next_follow_up, deal_ref, origin, created_at
    // Plus COMBINED_OFFMARKET_MIGRATIONS additions:
    //   full_name (nullable TEXT), preferred_locations, last_contact_at,
    //   next_followup_at, timeline, role, whatsapp, lead_tier, source
    //
    const intentLabel = intent ?? (
      use_type === 'vendedor'   ? 'seller'   :
      use_type === 'investidor' ? 'investor' : 'buyer'
    )
    if (zona)        noteParts.push(`Zona: ${zona}`)
    if (use_type)    noteParts.push(`Tipo: ${use_type}`)
    if (nationality) noteParts.push(`Nacionalidade: ${nationality}`)
    if (budget_min)  noteParts.push(`Budget min: €${budget_min}`)
    if (budget_max)  noteParts.push(`Budget max: €${budget_max}`)
    if (intentLabel) noteParts.push(`Intent: ${intentLabel}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactPayload: any = {
      // Only COMBINED_OFFMARKET_MIGRATIONS confirmed columns — safe to send
      // Plus `name` which is NOT NULL in live DB (original schema.sql column)
      full_name:        name || 'Website Lead',
      name:             name || 'Website Lead',
      email:            email || null,
      phone:            phone || null,
      status:           'lead',
      source:           source || 'website',
      notes:            noteParts.length ? noteParts.join(' | ') : null,
      preferred_locations: zona ? [zona] : null,
      timeline:         timeline || null,
      next_followup_at: (() => {
        const d = new Date()
        const isSeller = intent === 'seller' || use_type === 'vendedor'
        if (isSeller) { d.setHours(d.getHours() + 2) }
        else          { d.setDate(d.getDate() + 1) }
        return d.toISOString()
      })(),
      last_contact_at:  new Date().toISOString(),
      // UTM attribution — stored only when present (migration 039)
      ...(utm_source   ? { utm_source }   : {}),
      ...(utm_medium   ? { utm_medium }   : {}),
      ...(utm_campaign ? { utm_campaign } : {}),
      ...(utm_term     ? { utm_term }     : {}),
      ...(utm_content  ? { utm_content }  : {}),
      ...(utm_landing  ? { utm_landing }  : {}),
    }

    // Find-then-insert/update — contacts.email has no UNIQUE constraint so
    // upsert onConflict:'email' raises 42P10. Use explicit check instead.
    let existingId: string | null = null
    if (email) {
      const { data: existing } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      existingId = existing?.id ?? null
    } else if (phone) {
      const { data: existing } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()
      existingId = existing?.id ?? null
    }

    let data, error
    if (existingId) {
      // UPDATE existing contact — merge new data on top
      const result = await supabaseAdmin
        .from('contacts')
        .update(contactPayload)
        .eq('id', existingId)
        .select('id, status')
        .single()
      data = result.data
      error = result.error
    } else {
      // INSERT new contact
      const result = await supabaseAdmin
        .from('contacts')
        .insert(contactPayload)
        .select('id, status')
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('[leads] db error:', error)
      return NextResponse.json({ error: 'Erro ao guardar lead' }, { status: 500 })
    }

    // Fire-and-forget: trigger lead scoring + agent alert
    if (data?.id) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agencygroup.pt'

      // 1. Lead scoring — full payload + auth (was broken: only contact_id → 400)
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
            message:     message     || (noteParts.length ? noteParts.join(' | ') : undefined),
            budget:      budget_max  || undefined,
            nationality: nationality || undefined,
            timeline:    timeline    || undefined,
          }),
        }).catch(err => console.error('[leads] scoring error:', err instanceof Error ? err.message : String(err)))
      } else {
        console.warn('[leads] PORTAL_API_SECRET not configured — lead scoring skipped')
      }

      // 2. Agent email alert (Resend)
      if (process.env.RESEND_API_KEY && process.env.AGENT_ALERT_EMAIL) {
        const contactLabel = name ? `${name} (${email || phone})` : (email || phone)
        const sourceLabel = source || 'website'
        const zonaLabel = zona ? ` · ${zona}` : ''
        const budgetLabel = budget_max ? ` · até €${Number(budget_max).toLocaleString('pt-PT')}` : ''

        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Agency Group CRM <crm@agencygroup.pt>',
            to: [process.env.AGENT_ALERT_EMAIL],
            subject: `${intent === 'seller' ? '🏠 VENDEDOR' : intent === 'investor' ? '💼 INVESTIDOR' : '🔔 Novo lead'}: ${contactLabel}${zonaLabel}${budgetLabel}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;padding:24px;">
                <h2 style="color:#1c4a35;margin:0 0 16px;">Novo Lead — Agency Group</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Nome</td><td style="padding:8px 0;font-size:13px;font-weight:600;">${name || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Email</td><td style="padding:8px 0;font-size:13px;">${email || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Telefone</td><td style="padding:8px 0;font-size:13px;">${phone || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Fonte</td><td style="padding:8px 0;font-size:13px;">${sourceLabel}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Zona</td><td style="padding:8px 0;font-size:13px;">${zona || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Orçamento</td><td style="padding:8px 0;font-size:13px;">${budget_max ? `até €${Number(budget_max).toLocaleString('pt-PT')}` : '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Prazo</td><td style="padding:8px 0;font-size:13px;">${timeline || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Intent</td><td style="padding:8px 0;font-size:13px;color:#c9a96e;font-weight:700;">${intentLabel}</td></tr>
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
          console.error('[leads] Resend agent alert failed:', err?.message ?? err)
        )
      } else {
        console.warn('[leads] RESEND_API_KEY or AGENT_ALERT_EMAIL not set — email alert skipped')
      }

      // 3. n8n Workflow A — lead inbound enrichment (fire-and-forget)
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
      if (n8nWebhookUrl) {
        fetch(`${n8nWebhookUrl}/webhook/lead-inbound`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event:       'lead_created',
            contact_id:  data?.id,
            name:        name || 'Website Lead',
            email:       email       || null,
            phone:       phone       || null,
            source:      source      || 'website',
            zona:        zona        || null,
            budget_max:  budget_max  || null,
            nationality: nationality || null,
            intent:      intentLabel,
            created_at:  new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(err =>
          console.error('[leads] n8n lead-inbound webhook failed:', err?.message ?? err)
        )
      }
    }

    return NextResponse.json({
      success: true,
      id: data?.id,
    })
  } catch (err) {
    console.error('[leads] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
