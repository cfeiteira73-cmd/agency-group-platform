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
    } = parsed.data

    // Build notes from available context
    const noteParts: string[] = []
    if (message) noteParts.push(`Mensagem: ${message}`)
    if (property_ref) noteParts.push(`Imóvel: ${property_ref}`)

    // Build contact payload
    // nationality is CHAR(2) in DB (ISO 3166-1 alpha-2) — truncate/null if not 2 chars
    const nationalityVal = nationality && nationality.trim().length === 2
      ? nationality.trim().toUpperCase()
      : null

    const contactPayload = {
      full_name:           name || 'Website Lead',
      phone:               phone || null,
      email:               email || null,
      status:              'lead' as const,
      source:              source || 'website',
      source_detail:       zona || null,
      notes:               noteParts.length ? noteParts.join(' | ') : null,
      preferred_locations: zona ? [zona] : null,
      budget_min:          budget_min || null,
      budget_max:          budget_max || null,
      timeline:            timeline || null,
      use_type:            use_type || null,
      nationality:         nationalityVal,
      detected_intent:     intent ?? (
        use_type === 'vendedor'   ? 'seller'   :
        use_type === 'investidor' ? 'investor' : 'buyer'
      ),
      next_followup_at:    (() => {
        const d = new Date()
        const isSeller = intent === 'seller' || use_type === 'vendedor'
        if (isSeller) { d.setHours(d.getHours() + 2) }
        else          { d.setDate(d.getDate() + 1) }
        return d.toISOString()
      })(),
      last_contact_at:     new Date().toISOString(),
      updated_at:          new Date().toISOString(),
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
        .select('id, status, lead_tier')
        .single()
      data = result.data
      error = result.error
    } else {
      // INSERT new contact
      const result = await supabaseAdmin
        .from('contacts')
        .insert(contactPayload)
        .select('id, status, lead_tier')
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('[leads] db error:', error)
      // Temporary debug: expose raw error in non-prod for diagnosis — REMOVE AFTER FIX
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ error: 'Erro ao guardar lead', _debug: error }, { status: 500 })
      }
      return NextResponse.json({ error: 'Erro ao guardar lead', _debug: { code: (error as {code?:string}).code, message: (error as {message?:string}).message } }, { status: 500 })
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
                  <tr><td style="padding:8px 0;color:#666;font-size:13px;">Tier</td><td style="padding:8px 0;font-size:13px;color:#c9a96e;font-weight:700;">${data.lead_tier || 'C'}</td></tr>
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
        }).catch(() => {})
      } else {
        console.warn('[leads] RESEND_API_KEY or AGENT_ALERT_EMAIL not set — email alert skipped')
      }
    }

    return NextResponse.json({
      success: true,
      id: data?.id,
      tier: data?.lead_tier || 'C',
    })
  } catch (err) {
    console.error('[leads] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
