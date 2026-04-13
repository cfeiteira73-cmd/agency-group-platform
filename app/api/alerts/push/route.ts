// =============================================================================
// Agency Group — Alert Engine
// POST /api/alerts/push  (cron: 08:15 Mon-Fri)
//
// ORDEM OBRIGATÓRIA — só alerta DEPOIS de:
//   1. score calculado (score IS NOT NULL)
//   2. buyer match feito (buyer_matched_at IS NOT NULL)
//   3. price intel (gross_discount_pct IS NOT NULL)
//   4. deal eval (deal_evaluation_score IS NOT NULL)
//
// NÍVEIS:
//   P0  — score ≥80 | money_priority ≥60 | master_attack_rank ≥75 → email+WA
//   P1  — score 70-79 sem contacto → email
//   CPCV_TRIGGER — readiness ≥80 + buyer HIGH + cpcv_prob ≥65 → email+WA
//   NO_CONTACT   — score ≥70 sem contacto → email + task
//   NO_MEETING   — contacto exists, sem visita, score ≥70 → WA
//   HUMAN_FAILURE — human_failure_flag=true → email
//
// ANTI-SPAM:
//   P0: não repetir se last_alerted_at < 6h
//   P1/outros: não repetir se last_alerted_at < 24h
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/whatsapp/client'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Auth ─────────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const incoming = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  return incoming === secret
}

// ── Email sender (Resend) ────────────────────────────────────────────────────
async function sendAlertEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: 'Agency Group Alerts <alerts@agencygroup.pt>',
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(12000),
    })
    return r.ok
  } catch {
    return false
  }
}

// ── WhatsApp sender (internal) ───────────────────────────────────────────────
async function sendWA(phone: string, message: string): Promise<boolean> {
  if (process.env.WHATSAPP_ACTIVE !== 'true') return false
  const result = await sendWhatsApp({ to: phone, type: 'text', text: message })
  return result.success
}

// ── HTML email builders ───────────────────────────────────────────────────────
function buildP0Email(leads: AlertLead[]): string {
  const rows = leads.map(l => `
    <tr style="border-bottom:1px solid #1a1a1a;">
      <td style="padding:12px 8px;color:#c9a96e;font-weight:700;font-size:14px;">${l.score ?? '—'}</td>
      <td style="padding:12px 8px;color:#f4f0e6;font-size:13px;">${l.nome ?? 'Sem nome'}</td>
      <td style="padding:12px 8px;color:#a0a0a0;font-size:12px;">${l.cidade ?? '—'} · ${l.tipo_ativo ?? '—'}</td>
      <td style="padding:12px 8px;color:#c9a96e;font-size:13px;">${l.price_ask ? `€${(l.price_ask / 1000).toFixed(0)}K` : '—'}</td>
      <td style="padding:12px 8px;color:${l.execution_blocker_reason === 'cpcv_trigger' ? '#22c55e' : '#f59e0b'};font-size:11px;text-transform:uppercase;letter-spacing:.05em;">${l.execution_blocker_reason?.replace('_', ' ') ?? '—'}</td>
      <td style="padding:12px 8px;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/portal?lead=${l.id}"
           style="background:#c9a96e;color:#0a0a0a;padding:6px 12px;border-radius:4px;font-size:11px;text-decoration:none;font-weight:700;">
          ABRIR
        </a>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:24px;">
  <div style="max-width:700px;margin:0 auto;">
    <div style="border-bottom:2px solid #c9a96e;padding-bottom:16px;margin-bottom:24px;">
      <span style="color:#c9a96e;font-size:11px;letter-spacing:.15em;text-transform:uppercase;">Agency Group · Deal Machine</span>
      <h1 style="color:#f4f0e6;font-size:22px;margin:8px 0 0;">🔴 ${leads.length} Lead${leads.length > 1 ? 's' : ''} P0 — Ataque Imediato</h1>
      <p style="color:#a0a0a0;font-size:13px;margin:4px 0 0;">${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} · Alerta automático pós-avaliação completa</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#111;">
          <th style="padding:8px;color:#666;font-size:10px;text-align:left;text-transform:uppercase;">Score</th>
          <th style="padding:8px;color:#666;font-size:10px;text-align:left;text-transform:uppercase;">Lead</th>
          <th style="padding:8px;color:#666;font-size:10px;text-align:left;text-transform:uppercase;">Zona · Tipo</th>
          <th style="padding:8px;color:#666;font-size:10px;text-align:left;text-transform:uppercase;">Preço</th>
          <th style="padding:8px;color:#666;font-size:10px;text-align:left;text-transform:uppercase;">Blocker</th>
          <th style="padding:8px;color:#666;font-size:10px;text-align:left;"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:24px;padding:16px;background:#111;border-radius:6px;">
      <p style="color:#a0a0a0;font-size:11px;margin:0;">
        Alerta enviado apenas após: scoring + buyer match + price intel + deal evaluation completos.<br>
        Próximo alerta só em 6h para leads P0 · 24h para outros.
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildNoContactEmail(leads: AlertLead[]): string {
  const items = leads.map(l =>
    `<li style="color:#f4f0e6;font-size:13px;padding:8px 0;border-bottom:1px solid #1a1a1a;">
      <strong style="color:#c9a96e;">${l.nome ?? 'Sem nome'}</strong> · ${l.cidade ?? '—'} ·
      Score <strong>${l.score}</strong> ·
      Comissão est. <strong>${l.revenue_per_lead_estimate ? `€${(l.revenue_per_lead_estimate / 1000).toFixed(0)}K` : '—'}</strong><br>
      <span style="color:#f59e0b;font-size:11px;">⚠ SEM CONTACTO — obter número agora</span>
    </li>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;">
    <h2 style="color:#f59e0b;font-size:18px;">⚠ ${leads.length} Lead${leads.length > 1 ? 's' : ''} Sem Contacto — Acção Necessária</h2>
    <p style="color:#a0a0a0;font-size:13px;">Estas leads têm score ≥70 mas sem contacto direto. O maior blocker atual.</p>
    <ul style="list-style:none;padding:0;">${items}</ul>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/portal"
       style="display:inline-block;background:#c9a96e;color:#0a0a0a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;margin-top:16px;">
      Abrir Deal Desk →
    </a>
  </div>
</body>
</html>`
}

function buildCPCVEmail(leads: AlertLead[]): string {
  const items = leads.map(l =>
    `<li style="color:#f4f0e6;font-size:13px;padding:12px 0;border-bottom:1px solid #1a1a1a;">
      <strong style="color:#22c55e;">✓ ${l.nome ?? 'Sem nome'}</strong> · ${l.cidade ?? '—'}<br>
      Score: <strong>${l.score}</strong> · Readiness: <strong>${l.deal_readiness_score ?? '—'}/100</strong> ·
      CPCV Prob: <strong>${l.cpcv_probability ?? '—'}%</strong><br>
      Comissão estimada: <strong style="color:#c9a96e;">${l.revenue_per_lead_estimate ? `€${(l.revenue_per_lead_estimate / 1000).toFixed(0)}K` : '—'}</strong>
    </li>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;">
    <h2 style="color:#22c55e;font-size:18px;">🟢 CPCV TRIGGER — ${leads.length} Lead${leads.length > 1 ? 's' : ''} Pronta${leads.length > 1 ? 's' : ''} para Fechar</h2>
    <p style="color:#a0a0a0;font-size:13px;">Buyer HIGH + readiness ≥80 + CPCV probability ≥65%.</p>
    <ul style="list-style:none;padding:0;">${items}</ul>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL}/portal"
       style="display:inline-block;background:#22c55e;color:#0a0a0a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;margin-top:16px;">
      Fechar Agora →
    </a>
  </div>
</body>
</html>`
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AlertLead {
  id: string
  nome: string | null
  cidade: string | null
  tipo_ativo: string | null
  score: number | null
  deal_evaluation_score: number | null
  master_attack_rank: number | null
  money_priority_score: number | null
  deal_readiness_score: number | null
  cpcv_probability: number | null
  price_ask: number | null
  revenue_per_lead_estimate: number | null
  contacto: string | null
  contact_phone_owner: string | null
  buyer_pressure_class: string | null
  execution_blocker_reason: string | null
  human_failure_flag: boolean
  last_alerted_at: string | null
  last_alert_type: string | null
  first_meeting_at: string | null
}

// ── Result tracker ────────────────────────────────────────────────────────────
interface AlertResult {
  lead_id: string
  nome: string | null
  alert_type: string
  channels: string[]
  sent: boolean
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handler(req)
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handler(req)
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const alertEmail = process.env.ALERT_EMAIL ?? process.env.DIGEST_EMAIL ?? 'carlos@agencygroup.pt'
  const alertPhone = process.env.ALERT_WHATSAPP_PHONE ?? process.env.FOUNDER_WHATSAPP_PHONE ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any
  const now = new Date()
  const results: AlertResult[] = []
  let emailsSent = 0
  let wasSent = 0

  // ── Anti-spam windows ─────────────────────────────────────────────────
  const p0Cooldown   = new Date(now.getTime() - 6  * 3600 * 1000).toISOString()
  const otherCooldown = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()

  try {
    // ────────────────────────────────────────────────────────────────────
    // QUERY: leads totalmente avaliados (score + match + price + eval)
    // Só alerta DEPOIS de pipeline completo
    // ────────────────────────────────────────────────────────────────────
    const { data: evaluatedLeads, error } = await s
      .from('offmarket_leads')
      .select(`
        id, nome, cidade, tipo_ativo, score,
        deal_evaluation_score, master_attack_rank, money_priority_score,
        deal_readiness_score, cpcv_probability, price_ask,
        revenue_per_lead_estimate,
        contacto, contact_phone_owner, buyer_pressure_class,
        execution_blocker_reason, human_failure_flag,
        last_alerted_at, last_alert_type, first_meeting_at
      `)
      .not('score', 'is', null)                      // 1. scored
      .not('buyer_matched_at', 'is', null)            // 2. buyer matched
      .not('gross_discount_pct', 'is', null)          // 3. price intel
      .not('deal_evaluation_score', 'is', null)       // 4. deal evaluated
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')
      .not('deal_kill_flag', 'is', true)
      .not('gate_status', 'in', '("rejected_noise","duplicate_secondary")')
      .order('money_priority_score', { ascending: false, nullsFirst: false })
      .limit(100)

    if (error) {
      console.error('[alerts/push] Query error:', error)
      return NextResponse.json({ error: 'DB query failed', details: error }, { status: 500 })
    }

    const leads: AlertLead[] = evaluatedLeads ?? []

    // ── SEGMENT leads by alert type ───────────────────────────────────
    const p0Leads: AlertLead[] = []
    const noContactLeads: AlertLead[] = []
    const noMeetingLeads: AlertLead[] = []
    const cpcvLeads: AlertLead[] = []
    const humanFailureLeads: AlertLead[] = []

    for (const lead of leads) {
      const lastAlert = lead.last_alerted_at
      const isCPCV = (lead.deal_readiness_score ?? 0) >= 80
        && lead.buyer_pressure_class === 'HIGH'
        && (lead.cpcv_probability ?? 0) >= 65

      // P0
      if ((lead.score ?? 0) >= 80
        || (lead.money_priority_score ?? 0) >= 60
        || (lead.master_attack_rank ?? 0) >= 75
      ) {
        if (!lastAlert || lastAlert < p0Cooldown) {
          p0Leads.push(lead)
        }
        continue
      }

      // CPCV Trigger
      if (isCPCV) {
        if (!lastAlert || lastAlert < otherCooldown) {
          cpcvLeads.push(lead)
        }
        continue
      }

      // No Contact (score ≥70 sem contacto)
      if ((lead.score ?? 0) >= 70
        && !lead.contacto
        && !lead.contact_phone_owner
      ) {
        if (!lastAlert || lastAlert < otherCooldown) {
          noContactLeads.push(lead)
        }
        continue
      }

      // No Meeting (tem contacto, sem visita)
      if ((lead.score ?? 0) >= 70
        && (lead.contacto || lead.contact_phone_owner)
        && !lead.first_meeting_at
      ) {
        if (!lastAlert || lastAlert < otherCooldown) {
          noMeetingLeads.push(lead)
        }
        continue
      }

      // Human Failure
      if (lead.human_failure_flag) {
        if (!lastAlert || lastAlert < otherCooldown) {
          humanFailureLeads.push(lead)
        }
      }
    }

    // ── SEND P0 ALERTS ────────────────────────────────────────────────
    if (p0Leads.length > 0) {
      const subject = `🔴 ${p0Leads.length} Lead${p0Leads.length > 1 ? 's' : ''} P0 · Ataque Imediato · ${new Date().toLocaleDateString('pt-PT')}`
      const html = buildP0Email(p0Leads)
      const sent = await sendAlertEmail(alertEmail, subject, html)
      if (sent) emailsSent++

      // WhatsApp: top 1 lead P0 if has contact + phone configured
      const topP0 = p0Leads[0]
      if (alertPhone && (topP0.contacto || topP0.contact_phone_owner)) {
        const msg = `🔴 *ATAQUE IMEDIATO* — Agency Group\n\n` +
          `Lead: *${topP0.nome ?? 'Sem nome'}*\n` +
          `Score: ${topP0.score} · Rank: ${topP0.master_attack_rank ?? '—'}\n` +
          `Cidade: ${topP0.cidade ?? '—'} · ${topP0.tipo_ativo ?? '—'}\n` +
          `Preço: ${topP0.price_ask ? `€${(topP0.price_ask / 1000).toFixed(0)}K` : '—'}\n` +
          `Blocker: ${topP0.execution_blocker_reason ?? 'pronto'}\n\n` +
          `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.agencygroup.pt')}/portal?lead=${topP0.id}`
        const waSent = await sendWA(alertPhone, msg)
        if (waSent) wasSent++
      }

      // Update last_alerted_at for P0 leads
      const p0Ids = p0Leads.map(l => l.id)
      await s
        .from('offmarket_leads')
        .update({
          last_alerted_at: now.toISOString(),
          last_alert_type: 'p0_email_wa',
        })
        .in('id', p0Ids)
      // Increment alert_count separately (raw SQL — avoids rpc misuse)
      await s.rpc('increment_alert_count', { lead_ids: p0Ids }).maybeSingle()

      p0Leads.forEach(l =>
        results.push({ lead_id: l.id, nome: l.nome, alert_type: 'p0', channels: sent ? ['email', 'wa'] : [], sent })
      )
    }

    // ── SEND CPCV ALERTS ──────────────────────────────────────────────
    if (cpcvLeads.length > 0) {
      const subject = `🟢 CPCV TRIGGER — ${cpcvLeads.length} Lead${cpcvLeads.length > 1 ? 's' : ''} Pronta${cpcvLeads.length > 1 ? 's' : ''} para Fechar`
      const html = buildCPCVEmail(cpcvLeads)
      const sent = await sendAlertEmail(alertEmail, subject, html)
      if (sent) emailsSent++

      // WhatsApp para cada CPCV lead
      if (alertPhone) {
        for (const lead of cpcvLeads.slice(0, 3)) {
          const msg = `🟢 *CPCV TRIGGER* — Agency Group\n\n` +
            `Lead: *${lead.nome ?? 'Sem nome'}*\n` +
            `Readiness: ${lead.deal_readiness_score}/100 · CPCV Prob: ${lead.cpcv_probability}%\n` +
            `Comissão est.: ${lead.revenue_per_lead_estimate ? `€${(lead.revenue_per_lead_estimate / 1000).toFixed(0)}K` : '—'}\n\n` +
            `Fechar agora: ${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.agencygroup.pt')}/portal?lead=${lead.id}`
          const waSent = await sendWA(alertPhone, msg)
          if (waSent) wasSent++
        }
      }

      await s
        .from('offmarket_leads')
        .update({ last_alerted_at: now.toISOString(), last_alert_type: 'cpcv_trigger' })
        .in('id', cpcvLeads.map(l => l.id))

      cpcvLeads.forEach(l =>
        results.push({ lead_id: l.id, nome: l.nome, alert_type: 'cpcv_trigger', channels: ['email', 'wa'], sent: true })
      )
    }

    // ── SEND NO_CONTACT ALERTS (email only) ───────────────────────────
    if (noContactLeads.length > 0) {
      const subject = `⚠ ${noContactLeads.length} Lead${noContactLeads.length > 1 ? 's' : ''} sem Contacto — Score ≥70`
      const html = buildNoContactEmail(noContactLeads)
      const sent = await sendAlertEmail(alertEmail, subject, html)
      if (sent) emailsSent++

      await s
        .from('offmarket_leads')
        .update({ last_alerted_at: now.toISOString(), last_alert_type: 'no_contact' })
        .in('id', noContactLeads.map(l => l.id))

      noContactLeads.forEach(l =>
        results.push({ lead_id: l.id, nome: l.nome, alert_type: 'no_contact', channels: ['email'], sent })
      )
    }

    // ── SEND NO_MEETING ALERTS (WA + email) ───────────────────────────
    if (noMeetingLeads.length > 0 && alertPhone) {
      const top3 = noMeetingLeads.slice(0, 3)
      const names = top3.map(l => l.nome ?? 'Lead').join(', ')
      const msg = `📅 *MARCAR VISITA* — Agency Group\n\n` +
        `${noMeetingLeads.length} lead${noMeetingLeads.length > 1 ? 's' : ''} com contacto mas sem visita:\n${names}\n\n` +
        `Marcar em <24h: ${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.agencygroup.pt')}/portal`
      const waSent = await sendWA(alertPhone, msg)
      if (waSent) wasSent++

      await s
        .from('offmarket_leads')
        .update({ last_alerted_at: now.toISOString(), last_alert_type: 'no_meeting' })
        .in('id', noMeetingLeads.map(l => l.id))

      noMeetingLeads.forEach(l =>
        results.push({ lead_id: l.id, nome: l.nome, alert_type: 'no_meeting', channels: ['wa'], sent: waSent })
      )
    }

    // ── SEND HUMAN_FAILURE ALERTS ────────────────────────────────────
    if (humanFailureLeads.length > 0) {
      const names = humanFailureLeads.map(l => l.nome ?? 'Lead').join(', ')
      const html = `<p style="font-family:Arial;color:#ef4444;">
        <strong>⚠ Human Failure Flag</strong><br>
        ${humanFailureLeads.length} lead(s) a falhar SLAs críticos:<br>
        ${names}<br><br>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/portal">Abrir Deal Desk</a>
      </p>`
      const sent = await sendAlertEmail(
        alertEmail,
        `⚠ SLA Failure — ${humanFailureLeads.length} Lead${humanFailureLeads.length > 1 ? 's' : ''} com Human Failure Flag`,
        html,
      )
      if (sent) emailsSent++

      await s
        .from('offmarket_leads')
        .update({ last_alerted_at: now.toISOString(), last_alert_type: 'human_failure' })
        .in('id', humanFailureLeads.map(l => l.id))

      humanFailureLeads.forEach(l =>
        results.push({ lead_id: l.id, nome: l.nome, alert_type: 'human_failure', channels: ['email'], sent })
      )
    }

    // ── Summary log ───────────────────────────────────────────────────
    console.log(`[alerts/push] ${results.length} alerts processed · ${emailsSent} emails · ${wasSent} WA · ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      total_leads_evaluated: leads.length,
      alerts_fired: results.length,
      emails_sent: emailsSent,
      whatsapp_sent: wasSent,
      breakdown: {
        p0: p0Leads.length,
        cpcv_trigger: cpcvLeads.length,
        no_contact: noContactLeads.length,
        no_meeting: noMeetingLeads.length,
        human_failure: humanFailureLeads.length,
      },
      results,
      generated_at: now.toISOString(),
    })
  } catch (err) {
    console.error('[alerts/push] Error:', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
