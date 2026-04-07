import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const LANG_MAP: Record<string, string> = {
  PT: 'Português europeu formal e cálido',
  EN: 'formal British English, warm and professional',
  FR: 'français formel et chaleureux',
  DE: 'formales Deutsch, warm und professionell',
  AR: 'عربية رسمية ودودة ومهنية',
  ZH: '正式、温暖的中文',
}

const LANG_INSTR: Record<string, string> = {
  PT: 'Escreve em Português europeu formal.',
  EN: 'Write in formal British English.',
  FR: 'Écris en français formel.',
  DE: 'Schreibe auf formalem Deutsch.',
  AR: 'اكتب باللغة العربية الفصحى.',
  ZH: '请用正式中文写作。',
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockDraft(contact: Record<string, unknown>, purpose: string, agentName: string) {
  const name = String(contact.name || 'Cliente')
  const firstName = name.split(' ')[0]
  const lang = String(contact.language || 'PT')
  const budgetMax = Number(contact.budgetMax || 0)
  const budgetLabel = budgetMax > 0 ? `€${(budgetMax / 1000).toFixed(0)}K` : 'o seu orçamento'

  if (lang === 'EN') {
    return {
      subject: `Exclusive Properties Matching Your Profile — Agency Group`,
      greeting: `Dear ${firstName},`,
      body: `I hope this message finds you well. Following our recent conversation, I wanted to share a selection of properties that closely match your criteria.\n\nOur current portfolio includes several exclusive opportunities in your areas of interest, within ${budgetLabel}. These properties are not widely advertised and represent genuine value in the current market.\n\nI would be delighted to arrange viewings at your convenience and provide a comprehensive market analysis to support your decision.`,
      cta: `Please let me know your availability for a call or visit this week.`,
      signature: `Kind regards,\n${agentName}\nAgency Group | AMI 22506\n+351 XXX XXX XXX`,
    }
  }

  return {
    subject: `Selecção de imóveis para ${firstName} — Agency Group`,
    greeting: `Caro/a ${firstName},`,
    body: `Espero que esteja bem. Na sequência da nossa conversa, preparei uma selecção de imóveis que correspondem ao seu perfil e budget (${budgetLabel}).\n\nTemos em carteira algumas oportunidades exclusivas nas zonas do seu interesse, algumas delas não publicitadas nos portais. O mercado está activo e os imóveis mais bem posicionados saem rapidamente.\n\nEstaria disponível para uma visita esta semana? Posso organizar um roteiro de 2-3 imóveis num só período.`,
    cta: `Diga-me a sua disponibilidade e trato de tudo.`,
    signature: `Com os melhores cumprimentos,\n${agentName}\nAgency Group | AMI 22506\n+351 XXX XXX XXX`,
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { contact, purpose, property, agentName } = await req.json()

    if (!contact || !contact.name) {
      return NextResponse.json({ error: 'contact.name é obrigatório' }, { status: 400 })
    }

    const agent = agentName || 'Carlos Feiteira'
    const lang = String(contact.language || 'PT').toUpperCase()
    const purposeText = purpose || 'Follow-up geral'

    // Graceful mock when API key is missing
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[email-draft] ANTHROPIC_API_KEY não definida — mock response')
      return NextResponse.json({ success: true, draft: mockDraft(contact, purposeText, agent) })
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const langStyle = LANG_MAP[lang] || LANG_MAP['EN']
    const langInstr = LANG_INSTR[lang] || LANG_INSTR['EN']
    const budgetMin = (Number(contact.budgetMin) || 0).toLocaleString('pt-PT')
    const budgetMax = (Number(contact.budgetMax) || 0).toLocaleString('pt-PT')
    const zonas = Array.isArray(contact.zonas) ? contact.zonas.join(', ') : '—'
    const tipos = Array.isArray(contact.tipos) ? contact.tipos.join(', ') : '—'

    const propertySection = property
      ? `IMÓVEL A DESTACAR:
- Nome: ${String(property.nome || property.name || '')}
- Zona: ${String(property.zona || property.zone || '')}
- Tipo: ${String(property.tipo || property.type || '')}
- Preço: €${Number(property.preco || property.price || 0).toLocaleString('pt-PT')}
- Área: ${property.area || property.area_m2}m² · T${property.quartos || property.bedrooms}`
      : ''

    const prompt = `És ${agent}, agente de imobiliário de luxo da Agency Group (AMI 22506) em Portugal.
Mercado: Lisboa €5.000/m², Cascais €4.713/m², Algarve €3.941/m², Porto €3.643/m². +17,6% YoY.
Compradores estrangeiros: norte-americanos, franceses, britânicos, chineses, brasileiros.

${langInstr}
Estilo: ${langStyle}. Sem clichés. Personalizado. Persuasivo mas não agressivo. 3-4 parágrafos.

Escreve um email profissional para:

CLIENTE:
- Nome: ${contact.name}
- Nacionalidade: ${contact.nationality || '—'}
- Status: ${contact.status || 'lead'}
- Budget: €${budgetMin} – €${budgetMax}
- Zonas: ${zonas}
- Tipologias: ${tipos}
- Notas: ${contact.notes || '—'}

OBJECTIVO: ${purposeText}

${propertySection}

Responde APENAS em JSON válido:
{
  "subject": "Assunto do email — máx 60 caracteres, apelativo e específico",
  "greeting": "Saudação personalizada",
  "body": "Corpo do email — 3-4 parágrafos, referencias dados concretos do cliente (zonas, budget, contexto), sem clichés genéricos de imobiliário",
  "cta": "Call to action final — 1 frase directa com proposta específica (ex: visita, chamada, envio de dossier)",
  "signature": "Assinatura profissional com nome, empresa, AMI e contacto"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 900,
      system: 'És um agente imobiliário de luxo sénior. Respondes APENAS com JSON válido, sem texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return NextResponse.json({ success: true, draft: JSON.parse(clean) })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw }, { status: 500 })
    }
  } catch (error) {
    console.error('[email-draft] Error:', error)
    return NextResponse.json({ error: 'Erro ao gerar draft de email' }, { status: 500 })
  }
}
