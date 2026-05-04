import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { safeCompare } from '@/lib/safeCompare'
import { cronCorrelationId } from '@/lib/observability/correlation'

const NOTION_TOKEN = process.env.NOTION_TOKEN ?? ''
const NOTION_CRM   = process.env.NOTION_CRM_DB || '385a010f42244ef79b0a2ead4f258698'
const RESEND_KEY   = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL   = 'Agency Group <geral@agencygroup.pt>'
const BASE_URL     = process.env.NEXT_PUBLIC_URL || 'https://agencygroup.pt'

interface Contact {
  id: string
  name: string
  email: string
  zona: string
  budget: string
  lingua: string
  lastContact: string
  status: string
}

function notionHeaders() {
  return {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }
}

async function getContactsDueFollowUp(daysAgo: number): Promise<Contact[]> {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - daysAgo)
  const dateStr = targetDate.toISOString().split('T')[0]

  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CRM}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: 'Último Contacto',
            date: { equals: dateStr },
          },
          {
            property: 'Status',
            select: {
              does_not_equal: '❌ Perdido',
            },
          },
          {
            property: 'Email',
            email: { is_not_empty: true },
          },
        ],
      },
      page_size: 50,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return []
  const json = await res.json()
  const results = Array.isArray(json.results) ? json.results : []

  return results.map((page: Record<string, unknown>) => {
    const p = page as Record<string, unknown>
    const props = (p.properties as Record<string, Record<string, unknown>>) ?? {}
    return {
      id: p.id as string,
      name: (props['Nome']?.title as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      email: (props['Email']?.email as string) || '',
      zona: (props['Zona Interesse']?.select as { name: string } | null)?.name || '',
      budget: (props['Faixa Orçamento']?.select as { name: string } | null)?.name || '',
      lingua: (props['Língua']?.select as { name: string } | null)?.name || 'pt',
      lastContact: (props['Último Contacto']?.date as { start: string } | null)?.start || '',
      status: (props['Status']?.select as { name: string } | null)?.name || '',
    }
  }).filter((c: Contact) => c.email)
}

async function markFollowUpSent(notionId: string): Promise<void> {
  await fetch(`https://api.notion.com/v1/pages/${notionId}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({
      properties: {
        'Próximo Follow-up': { date: null },
        'Último Contacto': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    }),
    signal: AbortSignal.timeout(8000),
  })
}

function buildEmail3Days(contact: Contact, lang: string): { subject: string; html: string } {
  const isEn = lang.toLowerCase().startsWith('en') || lang === 'English' || lang === 'en'
  const isFr = lang.toLowerCase().startsWith('fr') || lang === 'French' || lang === 'fr'

  if (isEn) {
    return {
      subject: `Following up — ${contact.zona || 'Portugal'} properties`,
      html: followUpHtml({
        greeting: `Dear ${contact.name || 'there'}`,
        body: `I wanted to follow up on our recent conversation about ${contact.zona ? `properties in <strong>${contact.zona}</strong>` : 'real estate in Portugal'}.
        <br/><br/>The market is moving quickly${contact.budget ? ` in the ${contact.budget} range` : ''} and I've identified a few opportunities that may match your criteria.`,
        cta: 'Schedule a Call',
        ctaUrl: `${BASE_URL}/en#contacto`,
        ps: 'P.S. — I can also share exclusive off-market properties not listed publicly.',
        footer: 'Agency Group · Luxury Real Estate · AMI 22506 · Lisbon, Portugal',
      }),
    }
  }

  if (isFr) {
    return {
      subject: `Suite à notre conversation — biens immobiliers au Portugal`,
      html: followUpHtml({
        greeting: `Cher/Chère ${contact.name || ''}`,
        body: `Je me permets de faire suite à notre échange concernant l'immobilier${contact.zona ? ` à <strong>${contact.zona}</strong>` : ' au Portugal'}.
        <br/><br/>Le marché évolue rapidement et j'ai identifié plusieurs opportunités qui pourraient correspondre à vos critères.`,
        cta: 'Planifier un appel',
        ctaUrl: `${BASE_URL}/fr#contacto`,
        ps: 'P.S. — Je peux également vous présenter des biens off-market exclusifs.',
        footer: 'Agency Group · Immobilier de Luxe · AMI 22506 · Lisbonne, Portugal',
      }),
    }
  }

  return {
    subject: `Seguimento — propriedades em Portugal`,
    html: followUpHtml({
      greeting: `Caro/a ${contact.name || ''}`,
      body: `Queria fazer o seguimento da nossa conversa recente sobre imóveis${contact.zona ? ` em <strong>${contact.zona}</strong>` : ' em Portugal'}.
      <br/><br/>O mercado está a mover-se rapidamente${contact.budget ? ` na faixa de ${contact.budget}` : ''} e tenho algumas oportunidades que podem ser do seu interesse.`,
      cta: 'Agendar Reunião',
      ctaUrl: `${BASE_URL}#contacto`,
      ps: 'P.S. — Posso também partilhar imóveis exclusivos off-market não disponíveis publicamente.',
      footer: 'Agency Group · Imobiliário de Luxo · AMI 22506 · Lisboa, Portugal',
    }),
  }
}

function buildEmail7Days(contact: Contact, lang: string): { subject: string; html: string } {
  const isEn = lang.toLowerCase().startsWith('en') || lang === 'English' || lang === 'en'
  const isFr = lang.toLowerCase().startsWith('fr') || lang === 'French' || lang === 'fr'

  if (isEn) {
    return {
      subject: `Still searching for your perfect property in Portugal?`,
      html: followUpHtml({
        greeting: `Dear ${contact.name || 'there'}`,
        body: `A week has passed since our last conversation. I didn't want you to miss out on some exceptional properties${contact.zona ? ` in <strong>${contact.zona}</strong>` : ''} that have just become available.
        <br/><br/>I'm happy to arrange private viewings at your convenience.`,
        cta: 'View Available Properties',
        ctaUrl: `${BASE_URL}/en/imoveis`,
        ps: 'P.S. — Reply to this email or call +351 919 948 986 to speak directly with your advisor.',
        footer: 'Agency Group · Luxury Real Estate · AMI 22506 · Lisbon, Portugal',
      }),
    }
  }

  if (isFr) {
    return {
      subject: `Toujours à la recherche de votre bien idéal au Portugal ?`,
      html: followUpHtml({
        greeting: `Cher/Chère ${contact.name || ''}`,
        body: `Une semaine s'est écoulée depuis notre dernier échange. Je ne voudrais pas que vous manquiez des propriétés exceptionnelles${contact.zona ? ` à <strong>${contact.zona}</strong>` : ''} qui viennent de devenir disponibles.`,
        cta: 'Voir les propriétés disponibles',
        ctaUrl: `${BASE_URL}/fr/imoveis`,
        ps: 'P.S. — Répondez à cet e-mail ou appelez le +351 919 948 986.',
        footer: 'Agency Group · Immobilier de Luxe · AMI 22506 · Lisbonne, Portugal',
      }),
    }
  }

  return {
    subject: `Ainda à procura do seu imóvel ideal em Portugal?`,
    html: followUpHtml({
      greeting: `Caro/a ${contact.name || ''}`,
      body: `Passou uma semana desde a nossa última conversa. Não queria que perdesse algumas propriedades excepcionais${contact.zona ? ` em <strong>${contact.zona}</strong>` : ''} que acabaram de ficar disponíveis.`,
      cta: 'Ver Imóveis Disponíveis',
      ctaUrl: `${BASE_URL}/imoveis`,
      ps: 'P.S. — Responda a este email ou ligue para +351 919 948 986 para falar diretamente.',
      footer: 'Agency Group · Imobiliário de Luxo · AMI 22506 · Lisboa, Portugal',
    }),
  }
}

function followUpHtml(opts: {
  greeting: string
  body: string
  cta: string
  ctaUrl: string
  ps: string
  footer: string
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e6;padding:48px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0c1f15;border-radius:4px;overflow:hidden">
        <tr><td style="padding:10px 40px;background:linear-gradient(135deg,#0a1a0e,#162a1e)">
          <p style="margin:0;font-family:'Georgia',serif;font-size:1.6rem;font-weight:300;color:#c9a96e;letter-spacing:.05em">Agency Group</p>
          <p style="margin:4px 0 0;font-size:.6rem;letter-spacing:.25em;text-transform:uppercase;color:rgba(201,169,110,.55)">AMI 22506 · Luxury Real Estate · Portugal</p>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <p style="margin:0 0 20px;color:#e8dfc8;font-size:.95rem;line-height:1.7">${opts.greeting},</p>
          <p style="margin:0 0 28px;color:rgba(220,225,215,.8);font-size:.9rem;line-height:1.75">${opts.body}</p>
          <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#c6a868,#a8893e);color:#0c1f15;text-decoration:none;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:3px">${opts.cta}</a>
          <p style="margin:28px 0 0;color:rgba(201,169,110,.55);font-size:.78rem;font-style:italic">${opts.ps}</p>
        </td></tr>
        <tr><td style="padding:16px 40px;border-top:1px solid rgba(201,169,110,.12)">
          <p style="margin:0;font-size:.7rem;color:rgba(201,169,110,.4);text-align:center">${opts.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  // Verify it's a Vercel cron call (or our own internal call with secret)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${cronSecret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const corrId = cronCorrelationId('followups')

  if (!NOTION_TOKEN || !RESEND_KEY) {
    return NextResponse.json({ error: 'Missing credentials', sent: 0 })
  }

  const resend = new Resend(RESEND_KEY)
  const results = { sent: 0, errors: 0, contacts_3d: 0, contacts_7d: 0 }

  // Get contacts last touched 3 days ago
  const contacts3 = await getContactsDueFollowUp(3).catch(() => [] as Contact[])
  results.contacts_3d = contacts3.length

  // Get contacts last touched 7 days ago
  const contacts7 = await getContactsDueFollowUp(7).catch(() => [] as Contact[])
  results.contacts_7d = contacts7.length

  // Send 3-day follow-ups
  for (const contact of contacts3) {
    try {
      const { subject, html } = buildEmail3Days(contact, contact.lingua)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: contact.email,
        subject,
        html,
      })
      await markFollowUpSent(contact.id).catch(err =>
        console.error('[followups] markFollowUpSent failed for contact', contact.id, ':', err?.message ?? err)
      )
      results.sent++
    } catch {
      results.errors++
    }
  }

  // Send 7-day follow-ups
  for (const contact of contacts7) {
    try {
      const { subject, html } = buildEmail7Days(contact, contact.lingua)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: contact.email,
        subject,
        html,
      })
      await markFollowUpSent(contact.id).catch(err =>
        console.error('[followups] markFollowUpSent failed for contact', contact.id, ':', err?.message ?? err)
      )
      results.sent++
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, ...results, correlation_id: corrId }, { headers: { 'x-correlation-id': corrId } })
}
