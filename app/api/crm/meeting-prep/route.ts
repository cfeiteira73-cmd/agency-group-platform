import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockBriefing(contact: Record<string, unknown>, matchedCount: number) {
  const name = String(contact.name || 'o cliente')
  const firstName = name.split(' ')[0]
  const budgetMax = Number(contact.budgetMax || 0)
  const budgetLabel = budgetMax > 0 ? `€${(budgetMax / 1000).toFixed(0)}K` : 'a confirmar'
  return {
    openingLine: `Bom dia ${firstName}, obrigado por se encontrar connosco hoje — preparei uma selecção específica para o seu perfil.`,
    keyInsights: [
      `Budget máximo ${budgetLabel} — foco em imóveis com valor percebido acima do preço`,
      `Origem: ${contact.origin || 'N/D'} — manter tom consultivo e não comercial`,
      `${matchedCount} imóvel(is) em carteira correspondente(s) ao perfil`,
    ],
    talkingPoints: [
      'Contexto de mercado actual — subida de 17,6% e 210 dias médios de venda',
      'Vantagens do mercado português vs outros europeus (fiscalidade, lifestyle, segurança)',
      'Diferencial Agency Group — carteira exclusiva, acesso off-market, AMI 22506',
    ],
    propertiesPitch: matchedCount > 0
      ? [`${matchedCount} imóvel(is) seleccionado(s) — apresentar com foco no ROI e lifestyle`]
      : ['Sem imóveis em carteira — qualificar melhor zonas e tipologia para pesquisa dedicada'],
    questionsToAsk: [
      'Qual é o principal critério de decisão — lifestyle, investimento ou ambos?',
      'Tem visitas marcadas com outras agências? Qual o feedback?',
      'Qual é o timeline real para decisão de compra?',
    ],
    closingStrategy: `No final da reunião, propor visita a pelo menos 1 imóvel nos próximos 5 dias e confirmar data no momento.`,
    warningFlags: ['Mock response — ANTHROPIC_API_KEY não configurada. Configurar para briefings personalizados.'],
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { contact, properties, deals, agentName } = await req.json()

    if (!contact || !contact.name) {
      return NextResponse.json({ error: 'contact.name é obrigatório' }, { status: 400 })
    }

    const safeProperties = Array.isArray(properties) ? properties : []

    const matchedProps = safeProperties
      .filter((p: Record<string, unknown>) => {
        const budOk = (Number(contact.budgetMin) || 0) <= Number(p.preco) && Number(p.preco) <= (Number(contact.budgetMax) || 999_999_999) * 1.2
        const zonaOk = !contact.zonas?.length || contact.zonas.some((z: string) => String(p.zona).includes(z.split('—')[0].trim()))
        const tipoOk = !contact.tipos?.length || contact.tipos.includes(String(p.tipo))
        return budOk && (zonaOk || tipoOk)
      })
      .slice(0, 3)

    // Graceful mock when API key is missing
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[meeting-prep] ANTHROPIC_API_KEY não definida — mock response')
      return NextResponse.json({ success: true, briefing: mockBriefing(contact, matchedProps.length) })
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const agent = agentName || 'Carlos Feiteira'
    const budgetMin = (Number(contact.budgetMin) || 0).toLocaleString('pt-PT')
    const budgetMax = (Number(contact.budgetMax) || 0).toLocaleString('pt-PT')
    const zonas = contact.zonas?.join(', ') || '—'
    const tipos = contact.tipos?.join(', ') || '—'
    const propsText = matchedProps.length > 0
      ? matchedProps.map((p: Record<string, unknown>) =>
          `- ${p.nome}: €${(Number(p.preco) / 1e6).toFixed(2)}M · ${p.zona} · ${p.area}m² · T${p.quartos}`
        ).join('\n')
      : '— Nenhum em carteira (qualificar melhor para pesquisa)'

    const prompt = `És ${agent}, agente sénior da Agency Group (AMI 22506), especialista em imobiliário de luxo em Portugal.
Contexto de mercado: Lisboa €5.000/m², Cascais €4.713/m², Algarve €3.941/m², Porto €3.643/m². Mercado em alta +17,6%.
Compradores estrangeiros dominam o segmento premium: norte-americanos, franceses, britânicos, chineses, árabes.

Prepara um briefing de reunião conciso e accionável para o seguinte cliente. Em português europeu formal.

CLIENTE:
- Nome: ${contact.name}
- Nacionalidade: ${contact.nationality || '—'}
- Status CRM: ${contact.status || 'lead'}
- Budget: €${budgetMin} – €${budgetMax}
- Zonas de interesse: ${zonas}
- Tipologias: ${tipos}
- Origem: ${contact.origin || '—'}
- Notas: ${contact.notes || '—'}
- Último contacto: ${contact.lastContact || '—'}
- Deals activos: ${deals?.length || 0}

IMÓVEIS EM CARTEIRA CORRESPONDENTES (${matchedProps.length}):
${propsText}

Responde APENAS em JSON válido:
{
  "openingLine": "Como abrir a reunião — 1 frase personalizada que demonstra conhecimento do cliente",
  "keyInsights": ["insight estratégico 1 sobre motivação/perfil", "insight 2", "insight 3"],
  "talkingPoints": ["ponto de conversa 1 com contexto de mercado real", "ponto 2", "ponto 3"],
  "propertiesPitch": ["pitch de 1-2 frases para cada imóvel correspondente, focado no benefício para este cliente específico"],
  "questionsToAsk": ["pergunta qualificadora 1", "pergunta 2", "pergunta 3"],
  "closingStrategy": "Como fechar esta reunião com um compromisso concreto — visita, proposta ou próximo passo definido",
  "warningFlags": ["flag de atenção se aplicável — ex: preço fora de mercado, objecções esperadas, sinais de falta de seriedade"] ou []
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      system: 'És um agente imobiliário de luxo sénior em Portugal. Respondes APENAS com JSON válido, sem texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return NextResponse.json({ success: true, briefing: JSON.parse(clean) })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw }, { status: 500 })
    }
  } catch (error) {
    console.error('[meeting-prep] Error:', error)
    return NextResponse.json({ error: 'Erro ao gerar briefing' }, { status: 500 })
  }
}
