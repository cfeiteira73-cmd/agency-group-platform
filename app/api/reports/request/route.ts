// =============================================================================
// REPORTS REQUEST API — Agency Group
// Captures email, sends report confirmation via Resend, logs to Supabase
// No auth required — public entry point
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

const REPORT_DOWNLOAD_LINKS: Record<string, string> = {
  // Zone reports — link to whatsapp if no PDF is hosted yet
  // Replace values with actual S3/Vercel Blob URLs when PDFs are ready
  default: 'https://wa.me/351919948986',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; name?: string; report?: string; type?: string }
    const { email, name, report, type } = body

    if (!email || !report) {
      return NextResponse.json({ error: 'email and report required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    // ── Log to Supabase contacts ──────────────────────────────────────────────
    try {
      await supabaseAdmin
        .from('contacts')
        .upsert({
          full_name: name || 'Relatório Request',
          email: email.toLowerCase().trim() as string | null,
          source: 'reports-page',
          intent: 'buyer',
          message: `Solicitou relatório: ${report}`,
          utm_source: 'reports',
          created_at: new Date().toISOString(),
        }, { onConflict: 'email' })
    } catch (dbErr) {
      console.error('[reports/request] DB upsert failed:', dbErr)
      // Continue — email delivery is primary
    }

    // ── Send confirmation email via Resend ────────────────────────────────────
    const downloadLink = REPORT_DOWNLOAD_LINKS[report] || REPORT_DOWNLOAD_LINKS.default
    const isZone = type === 'zone'

    const { error: emailErr } = await resend.emails.send({
      from: 'Agency Group Research <research@agencygroup.pt>',
      to: email,
      bcc: 'geral@agencygroup.pt',
      subject: `O seu relatório está a caminho — ${report}`,
      html: `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Agency Group</title></head>
<body style="margin:0;padding:0;background:#0c1f15;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#0c1f15;border:1px solid rgba(201,169,110,.15)">

    <!-- Header -->
    <div style="padding:32px 40px 24px;border-bottom:1px solid rgba(201,169,110,.1)">
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:300;letter-spacing:.08em;color:#f4f0e6">
        Agency<span style="color:#c9a96e">Group</span>
      </div>
      <div style="font-size:10px;letter-spacing:.2em;color:rgba(201,169,110,.5);text-transform:uppercase;margin-top:4px">
        Research &amp; Intelligence · 2026
      </div>
    </div>

    <!-- Body -->
    <div style="padding:40px">
      <div style="font-size:11px;letter-spacing:.18em;color:rgba(201,169,110,.6);text-transform:uppercase;margin-bottom:16px">
        ${isZone ? 'Relatório de Zona' : 'Relatório Temático'}
      </div>
      <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#f4f0e6;margin:0 0 16px;line-height:1.2">
        ${report}
      </h1>
      <p style="font-size:14px;color:rgba(244,240,230,.6);line-height:1.7;margin:0 0 32px">
        Olá${name ? ` ${name.split(' ')[0]}` : ''},<br/><br/>
        Obrigado pelo seu interesse. Um membro da nossa equipa de research enviará o relatório em breve para este email.<br/><br/>
        Entretanto, pode falar directamente connosco para receber o documento de imediato ou para qualquer questão sobre o mercado.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px">
        <a href="https://wa.me/351919948986?text=${encodeURIComponent(`Olá, solicitei o relatório "${report}" e gostaria de o receber.`)}"
           style="display:inline-block;background:#c9a96e;color:#0c1f15;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:14px 28px;text-decoration:none">
          Receber por WhatsApp Agora →
        </a>
      </div>

      <!-- Market teaser -->
      <div style="background:rgba(201,169,110,.06);border:1px solid rgba(201,169,110,.12);padding:20px 24px;margin-bottom:32px">
        <div style="font-size:10px;letter-spacing:.18em;color:rgba(201,169,110,.5);text-transform:uppercase;margin-bottom:12px">Mercado Portugal 2026</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          ${[
            ['+17.6%', 'Valorização YoY'],
            ['€3.076/m²', 'Preço Mediana PT'],
            ['Top 5', 'Lisboa · Luxo Mundial'],
            ['44%', 'Compradores Int.'],
          ].map(([val, label]) => `
          <div>
            <div style="font-family:Georgia,serif;font-size:18px;color:#c9a96e;font-weight:300">${val}</div>
            <div style="font-size:9px;letter-spacing:.12em;color:rgba(244,240,230,.3);text-transform:uppercase">${label}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid rgba(201,169,110,.08)">
      <p style="font-size:11px;color:rgba(244,240,230,.25);line-height:1.6;margin:0">
        Agency Group · AMI 22506 · Lisboa, Portugal<br/>
        <a href="https://www.agencygroup.pt" style="color:rgba(201,169,110,.4);text-decoration:none">agencygroup.pt</a>
        &nbsp;·&nbsp;
        <a href="https://wa.me/351919948986" style="color:rgba(201,169,110,.4);text-decoration:none">+351 919 948 986</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    })

    if (emailErr) {
      console.error('[reports/request] Resend error:', emailErr)
      // Don't fail the request — DB was already logged, WhatsApp fallback in frontend
      return NextResponse.json({ ok: true, warning: 'email queued with delay' })
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[reports/request] Unexpected error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
