// =============================================================================
// FORGOTTEN LEADS — Agency Group
// Leads with no next_followup_at for > N days (default 7)
// Portal: GET /api/automation/forgotten-leads
// Cron: scheduled weekly
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '7')
  const limit = parseInt(searchParams.get('limit') || '50')

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  try {
    // Leads that:
    // 1. Have no next_followup_at set, OR next_followup_at is past
    // 2. Status is active (lead/prospect/qualified/active)
    // 3. last_contact_at was > N days ago
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('id, full_name, email, phone, status, lead_tier, lead_score, source, preferred_locations, budget_max, last_contact_at, next_followup_at, notes, created_at')
      .in('status', ['lead', 'prospect', 'qualified', 'active'])
      .or(`next_followup_at.is.null,next_followup_at.lt.${new Date().toISOString()}`)
      .lt('last_contact_at', cutoff.toISOString())
      .order('lead_tier', { ascending: true }) // A first (hottest)
      .order('last_contact_at', { ascending: true }) // oldest first
      .limit(limit)

    if (error) {
      console.error('[forgotten-leads] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Classify urgency
    const classified = (data || []).map(lead => {
      const daysSinceContact = Math.floor(
        (Date.now() - new Date(lead.last_contact_at || lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      const urgency = lead.lead_tier === 'A' && daysSinceContact > 3
        ? 'critical'
        : lead.lead_tier === 'A' || daysSinceContact > 14
        ? 'high'
        : daysSinceContact > 7
        ? 'medium'
        : 'low'

      return {
        ...lead,
        days_since_contact: daysSinceContact,
        urgency,
        suggested_action: urgency === 'critical'
          ? 'Ligar agora — lead A sem contacto há ' + daysSinceContact + ' dias'
          : urgency === 'high'
          ? 'WhatsApp hoje — risco de perda'
          : 'Follow-up esta semana',
      }
    })

    // Send alert email if cron-triggered (has CRON_SECRET header)
    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      const critical = classified.filter(l => l.urgency === 'critical' || l.urgency === 'high')
      if (critical.length > 0 && process.env.RESEND_API_KEY && process.env.AGENT_ALERT_EMAIL) {
        const rows = critical.slice(0, 10).map(l => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;">${l.full_name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#c9a96e;font-weight:700;">${l.lead_tier}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;">${l.days_since_contact} dias</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#b03a2e;">${l.urgency}</td>
          </tr>
        `).join('')

        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Agency Group CRM <crm@agencygroup.pt>',
            to: [process.env.AGENT_ALERT_EMAIL],
            subject: `⚠️ ${critical.length} leads esquecidos — acção necessária`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;padding:24px;">
                <h2 style="color:#b03a2e;margin:0 0 8px;">Leads Esquecidos</h2>
                <p style="color:#666;font-size:13px;margin:0 0 20px;">${classified.length} leads sem follow-up nos últimos ${days} dias. ${critical.length} requerem atenção urgente.</p>
                <table style="width:100%;border-collapse:collapse;">
                  <thead><tr style="background:#f4f0e6;">
                    <th style="padding:8px;text-align:left;font-size:11px;color:#666;">Nome</th>
                    <th style="padding:8px;text-align:left;font-size:11px;color:#666;">Tier</th>
                    <th style="padding:8px;text-align:left;font-size:11px;color:#666;">Dias</th>
                    <th style="padding:8px;text-align:left;font-size:11px;color:#666;">Urgência</th>
                  </tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                <div style="margin-top:20px;">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agencygroup.pt'}/portal?tab=crm"
                     style="background:#1c4a35;color:#f4f0e6;padding:10px 20px;text-decoration:none;font-size:12px;display:inline-block;">
                    Ver no Portal →
                  </a>
                </div>
                <p style="margin-top:20px;color:#999;font-size:11px;">Agency Group · AMI 22506 · ${new Date().toLocaleString('pt-PT')}</p>
              </div>
            `,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      total: classified.length,
      critical: classified.filter(l => l.urgency === 'critical').length,
      high: classified.filter(l => l.urgency === 'high').length,
      leads: classified,
      days_threshold: days,
    })
  } catch (err) {
    console.error('[forgotten-leads] error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
