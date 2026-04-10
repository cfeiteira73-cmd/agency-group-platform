// =============================================================================
// AGENCY GROUP — Send Document API v2.0
// POST /api/send-doc
// Body: { to, cc[], subject, message, docTitle, fields[], docUrl, pdfBase64 }
// Features: AI email body · PDF attachment · BCC geral@ · múltiplos destinatários (CC)
// AMI 22506 | From: geral@agencygroup.pt
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const FROM_EMAIL = 'Agency Group · AMI 22506 <geral@agencygroup.pt>'
const BCC_EMAIL  = 'geral@agencygroup.pt'
const SEDE       = 'Torre Soleil 1 B, Av. da República 120, 2780-158 Oeiras'

interface Field { label: string; value: string }

interface SendDocPayload {
  to:         string
  cc?:        string[]   // destinatários adicionais (opcional)
  subject?:   string
  message?:   string
  docTitle:   string
  fields:     Field[]
  docUrl?:    string
  pdfBase64?: string
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ─── AI Email Body ─────────────────────────────────────────────────────────────
async function generateAiEmailBody(
  docTitle: string,
  fields:   Field[],
  apiKey:   string
): Promise<string> {
  const client  = new Anthropic({ apiKey })
  const filled  = fields.filter(f => f.value?.trim()).slice(0, 20)
  const ctx     = filled.map(f => `${f.label}: ${f.value}`).join('\n')
  const nameF   = filled.find(f => /nome|proprietár|comprador|vendedor|cliente|outorgante/i.test(f.label))
  const name    = nameF?.value?.split(' ').slice(0, 2).join(' ') || ''

  const prompt = `És o assistente de comunicação da Agency Group, empresa portuguesa de mediação imobiliária de luxo (AMI 22506, Oeiras).

Escreve um email profissional, elegante e personalizado em português formal europeu para acompanhar o documento "${docTitle}" enviado ao cliente.

Contexto do documento:
${ctx}

Regras:
- Saudação formal: "Exmo./Exma. Sr./Sra. ${name || '[Nome]'}" — sem nome usa "Prezado/a Cliente"
- Máximo 3 parágrafos precisos e elegantes
- Referir especificamente "${docTitle}" e o que o cliente deve fazer (rever, assinar, devolver assinado, conservar, etc.)
- Linguagem de imobiliária de prestígio — nunca genérica, nunca excessiva
- Último parágrafo: total disponibilidade para qualquer esclarecimento
- Terminar com: "Com os melhores cumprimentos,"
- NÃO incluir assinatura, NÃO incluir cabeçalhos de email
- Só o corpo do email`

  const r = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })
  return ((r.content[0] as { text: string }).text || '').trim()
}

// ─── Email HTML Template ───────────────────────────────────────────────────────
function buildEmail(p: SendDocPayload, aiBody: string): string {
  const rows = p.fields
    .filter(f => f.value?.trim())
    .map(f => `
      <tr>
        <td style="padding:5px 0;color:rgba(201,169,110,.52);font-size:.7rem;width:148px;vertical-align:top;text-transform:uppercase;letter-spacing:.05em">${escHtml(f.label)}</td>
        <td style="padding:5px 0;color:#e8dfc8;font-size:.82rem;font-weight:500;vertical-align:top">${escHtml(f.value)}</td>
      </tr>`).join('')

  const bodyHtml = aiBody.split('\n').map(l => l.trim()
    ? `<p style="margin:0 0 16px;color:rgba(225,218,200,.85);font-size:.88rem;line-height:1.8">${escHtml(l)}</p>`
    : '').join('')

  const pdfNote = p.pdfBase64
    ? `<p style="margin:22px 0 0;padding:11px 16px;background:rgba(201,169,110,.07);border-left:3px solid rgba(201,169,110,.38);color:rgba(201,169,110,.68);font-size:.75rem;border-radius:0 3px 3px 0">
        📎 O documento <strong style="color:rgba(201,169,110,.85)">${escHtml(p.docTitle)}</strong> segue em anexo em formato PDF (não editável).
       </p>` : ''

  const date = new Date().toLocaleDateString('pt-PT',{day:'2-digit',month:'long',year:'numeric'})

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eee9de;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eee9de;padding:40px 16px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#0c1f15;border-radius:5px;overflow:hidden;max-width:580px">

  <!-- Header -->
  <tr><td style="padding:28px 40px;background:linear-gradient(150deg,#091910 0%,#152a1c 100%);border-bottom:1px solid rgba(201,169,110,.2)">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-family:Georgia,serif;font-size:1.55rem;font-weight:300;letter-spacing:.04em;color:#c9a96e">Agency Group</p>
          <p style="margin:5px 0 0;font-size:.55rem;letter-spacing:.26em;text-transform:uppercase;color:rgba(201,169,110,.4)">AMI 22506 · Mediação Imobiliária de Excelência</p></td>
      <td align="right" style="vertical-align:bottom"><p style="margin:0;font-size:.65rem;color:rgba(201,169,110,.32)">${date}</p></td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 40px 0">
    <p style="margin:0 0 4px;font-size:.58rem;letter-spacing:.24em;text-transform:uppercase;color:rgba(201,169,110,.42)">Documento</p>
    <p style="margin:0 0 24px;color:#c9a96e;font-size:1.05rem;font-weight:600;border-bottom:1px solid rgba(201,169,110,.13);padding-bottom:18px">${escHtml(p.docTitle)}</p>
    ${bodyHtml}${pdfNote}
  </td></tr>

  ${rows ? `
  <!-- Fields -->
  <tr><td style="padding:22px 40px 18px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,169,110,.05);border:1px solid rgba(201,169,110,.11);border-radius:4px">
      <tr><td style="padding:16px 20px">
        <p style="margin:0 0 11px;font-size:.58rem;letter-spacing:.24em;text-transform:uppercase;color:rgba(201,169,110,.42)">Dados do Documento</p>
        <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
    </table>
  </td></tr>` : ''}

  <!-- Signature -->
  <tr><td style="padding:20px 40px;background:rgba(0,0,0,.16);border-top:1px solid rgba(201,169,110,.1)">
    <p style="margin:0 0 2px;color:#c9a96e;font-size:.85rem;font-weight:700">Agency Group</p>
    <p style="margin:0 0 1px;font-size:.72rem;color:rgba(201,169,110,.48)">Mediação Imobiliária · AMI 22506 · NIPC 516.833.960</p>
    <p style="margin:0 0 1px;font-size:.72rem;color:rgba(201,169,110,.38)">${SEDE}</p>
    <p style="margin:0;font-size:.72rem;color:rgba(201,169,110,.38)">geral@agencygroup.pt · agencygroup.pt</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

// ─── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })

  let body: Partial<SendDocPayload>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Request body inválido' }, { status: 400 }) }

  if (!body.to || !body.to.includes('@'))
    return NextResponse.json({ error: 'Email principal inválido.' }, { status: 400 })
  if (!body.docTitle)
    return NextResponse.json({ error: 'Título do documento em falta.' }, { status: 400 })

  // Validate optional CC emails
  const ccList: string[] = []
  if (Array.isArray(body.cc)) {
    for (const e of body.cc) {
      if (typeof e === 'string' && e.trim() && e.includes('@')) {
        ccList.push(e.trim())
      }
    }
  }

  const payload: SendDocPayload = {
    to:        body.to.trim(),
    cc:        ccList,
    subject:   body.subject || `${body.docTitle} — Agency Group AMI 22506`,
    message:   body.message || '',
    docTitle:  body.docTitle,
    fields:    Array.isArray(body.fields) ? body.fields : [],
    docUrl:    body.docUrl  || '',
    pdfBase64: body.pdfBase64 || '',
  }

  // ── AI email body ──
  let aiBody = ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      aiBody = await generateAiEmailBody(payload.docTitle, payload.fields, anthropicKey)
    } catch (err) {
      console.error('[send-doc] AI body error:', err)
      aiBody = `Em anexo enviamos o documento "${payload.docTitle}". Solicitamos que reveja com atenção e nos contacte para qualquer esclarecimento.\n\nCom os melhores cumprimentos,`
    }
  } else {
    aiBody = `Em anexo enviamos o documento "${payload.docTitle}". Solicitamos que reveja com atenção e nos contacte para qualquer esclarecimento.\n\nCom os melhores cumprimentos,`
  }

  // ── PDF attachment ──
  const attachments = payload.pdfBase64 ? [{
    filename: `${payload.docTitle.replace(/[/\\:*?"<>|]/g,'-').trim()}.pdf`,
    content:  payload.pdfBase64,
  }] : undefined

  // ── Send ──
  const resend = new Resend(resendKey)
  try {
    const sendParams: Parameters<typeof resend.emails.send>[0] = {
      from:        FROM_EMAIL,
      to:          [payload.to],
      bcc:         [BCC_EMAIL],
      subject:     payload.subject!,
      html:        buildEmail(payload, aiBody),
      attachments,
    }
    if (ccList.length) sendParams.cc = ccList

    const { data, error } = await resend.emails.send(sendParams)
    if (error) {
      console.error('[send-doc] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: unknown) {
    const e = err as Error
    console.error('[send-doc] Exception:', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
