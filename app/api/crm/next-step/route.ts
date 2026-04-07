import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockNextStep(contact: Record<string, unknown>) {
  const name = String(contact.name || 'o contacto')
  const budget = Number(contact.budgetMax || 0)
  const channel = contact.phone ? 'whatsapp' : contact.email ? 'email' : 'telefone'
  const priority = budget >= 1_000_000 ? 'urgent' : budget >= 500_000 ? 'high' : 'medium'

  return {
    priority,
    nextAction: `Contactar ${name} para follow-up e qualificação`,
    nextActionDetail: `Retomar conversa com ${name}. Confirmar budget, zonas de interesse e timeline de compra. Apresentar 2-3 imóveis em carteira que correspondam ao perfil.`,
    timing: 'Hoje',
    channel,
    messageTemplate: `Olá ${name.split(' ')[0]}, bom dia! Sou o Carlos da Agency Group. Queria dar-lhe seguimento à nossa conversa e partilhar algumas oportunidades que acabaram de surgir no mercado e que podem interessar-lhe. Tem 10 minutos esta semana?`,
    reasoning: 'Mock response — ANTHROPIC_API_KEY não configurada. Score calculado localmente.',
    leadScore: Math.min(100, Math.round((budget / 50000) * 10 + (contact.phone ? 15 : 0) + (contact.email ? 5 : 0))),
    leadScoreFactors: ['Budget indicado', 'Contacto disponível', 'Sem actividade recente'],
    riskFlag: 'Sem actividade recente — risco de resfriamento',
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { contact, deals, recentActivity } = await req.json()

    if (!contact || !contact.name) {
      return NextResponse.json({ error: 'contact.name é obrigatório' }, { status: 400 })
    }

    // Graceful mock when API key is missing
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[next-step] ANTHROPIC_API_KEY não definida — mock response')
      return NextResponse.json(mockNextStep(contact))
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const zonas = Array.isArray(contact.zonas) ? contact.zonas.join(', ') : (contact.zone || 'N/D')
    const tipos = Array.isArray(contact.tipos) ? contact.tipos.join(', ') : (contact.type || 'N/D')
    const budgetMin = Number(contact.budgetMin || 0).toLocaleString('pt-PT')
    const budgetMax = Number(contact.budgetMax || 0).toLocaleString('pt-PT')

    const prompt = `És Carlos Feiteira, agente sénior da Agency Group (AMI 22506) — imobiliário de luxo em Portugal.
Mercado: Lisboa €5.000/m², Cascais €4.713/m², Algarve €3.941/m², Porto €3.643/m². Core segment €500K–€3M.
Compradores principais: norte-americanos 16%, franceses 13%, britânicos 9%, chineses 8%, brasileiros 6%.

Analisa este contacto e define a próxima acção comercial mais eficaz. Responde APENAS em JSON válido.

CONTACTO:
- Nome: ${contact.name}
- Email: ${contact.email || 'N/D'}
- Telefone: ${contact.phone || 'N/D'}
- Nacionalidade: ${contact.nationality || 'N/D'}
- Origem: ${contact.origin || contact.source || 'N/D'}
- Budget: €${budgetMin} – €${budgetMax}
- Zonas: ${zonas}
- Tipologias: ${tipos}
- Status: ${contact.status || 'lead'}
- Notas: ${contact.notes || 'Sem notas'}
- Score actual: ${contact.score || contact.lead_score || 0}/100

DEALS ACTIVOS: ${deals?.length || 0}
ACTIVIDADE RECENTE: ${recentActivity || 'Sem actividade registada'}

JSON de resposta:
{
  "priority": "urgent|high|medium|low",
  "nextAction": "Acção específica para fazer HOJE — máx 15 palavras",
  "nextActionDetail": "O que dizer/fazer — 2-3 frases específicas para este contacto com contexto de mercado real",
  "timing": "Hoje|Amanhã|Próximos 3 dias|Esta semana",
  "channel": "whatsapp|email|telefone|visita|reunião",
  "messageTemplate": "Mensagem pronta a enviar — 50-80 palavras, personalizada, em português europeu formal mas cálido, referencia dados concretos do cliente",
  "reasoning": "Justificação da acção — 1-2 frases com lógica comercial",
  "leadScore": 0-100,
  "leadScoreFactors": ["factor positivo 1", "factor 2", "factor 3"],
  "riskFlag": "descrição do risco ou null"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 900,
      system: 'És um consultor de vendas de imobiliário de luxo em Portugal. Respondes APENAS com JSON válido, sem texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return NextResponse.json(JSON.parse(clean))
    } catch {
      return NextResponse.json({ error: 'Parse failed', raw }, { status: 500 })
    }
  } catch (error) {
    console.error('[next-step] Error:', error)
    return NextResponse.json({ error: 'Erro ao gerar próxima acção' }, { status: 500 })
  }
}
