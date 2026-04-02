import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { contact, deals, recentActivity } = await req.json()

    const prompt = `És o melhor gestor comercial de imobiliário de luxo do mundo. Analisa este contacto e sugere a próxima acção mais eficaz.

CONTACTO:
- Nome: ${contact.name}
- Email: ${contact.email}
- Telefone: ${contact.phone || 'N/D'}
- Origem: ${contact.source || 'N/D'}
- Budget: €${Number(contact.budgetMin || 0).toLocaleString('pt-PT')} – €${Number(contact.budgetMax || 0).toLocaleString('pt-PT')}
- Zona de interesse: ${contact.zone || 'N/D'}
- Tipo: ${contact.type || 'N/D'}
- Notas: ${contact.notes || 'Sem notas'}
- Score actual: ${contact.score || 0}/100

DEALS ACTIVOS: ${deals?.length || 0}
ACTIVIDADE RECENTE: ${recentActivity || 'Sem actividade registada'}

Com base nesta informação, responde APENAS em JSON:
{
  "priority": "urgent|high|medium|low",
  "nextAction": "Acção específica e concreta para fazer HOJE — máx 15 palavras",
  "nextActionDetail": "Detalhe do que dizer/fazer — 2-3 frases com contexto específico deste contacto",
  "timing": "Quando fazer: Hoje / Esta semana / Próximos 3 dias / etc",
  "channel": "whatsapp|email|telefone|visita|reunião",
  "messageTemplate": "Template de mensagem pronta a enviar para este contacto específico — 50-80 palavras, personalizado",
  "reasoning": "Porque esta acção agora — 1-2 frases",
  "leadScore": number 0-100,
  "leadScoreFactors": ["factor1", "factor2", "factor3"],
  "riskFlag": "string or null — se há risco de perder este lead"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('next-step error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
