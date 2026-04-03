import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { contact, properties, deals, agentName } = await req.json()

    const matchedProps = properties
      .filter((p: Record<string,unknown>) => {
        const budOk = (Number(contact.budgetMin) || 0) <= Number(p.preco) && Number(p.preco) <= (Number(contact.budgetMax) || 999999999) * 1.2
        const zonaOk = !contact.zonas?.length || contact.zonas.some((z: string) => String(p.zona).includes(z.split('—')[0].trim()))
        const tipoOk = !contact.tipos?.length || contact.tipos.includes(String(p.tipo))
        return budOk && (zonaOk || tipoOk)
      })
      .slice(0, 3)

    const prompt = `És ${agentName || 'Carlos Feiteira'}, agente sénior da Agency Group (AMI 22506).

Prepara um briefing de reunião conciso para uma reunião com o seguinte cliente.

CLIENTE:
- Nome: ${contact.name}
- Nacionalidade: ${contact.nationality}
- Status: ${contact.status}
- Budget: €${(Number(contact.budgetMin)||0).toLocaleString('pt-PT')} – €${(Number(contact.budgetMax)||0).toLocaleString('pt-PT')}
- Interesse: ${contact.zonas?.join(', ') || '—'} · ${contact.tipos?.join(', ') || '—'}
- Origem: ${contact.origin || '—'}
- Notas: ${contact.notes || '—'}
- Último contacto: ${contact.lastContact || '—'}

IMÓVEIS CORRESPONDENTES (${matchedProps.length}):
${matchedProps.map((p: Record<string,unknown>) => `- ${p.nome}: €${(Number(p.preco)/1e6).toFixed(2)}M · ${p.zona} · ${p.area}m² · T${p.quartos}`).join('\n') || '— Nenhum em carteira'}

Gera o briefing em JSON em português europeu:
{
  "openingLine": "Como abrir a reunião — 1 frase personalizada",
  "keyInsights": ["insight1 sobre o cliente", "insight2", "insight3"],
  "talkingPoints": ["ponto de conversa 1", "ponto 2", "ponto 3"],
  "propertiesPitch": ["pitch conciso para cada imóvel correspondente"],
  "questionsToAsk": ["pergunta 1 para qualificar melhor", "pergunta 2", "pergunta 3"],
  "closingStrategy": "Como fechar esta reunião com um compromisso concreto",
  "warningFlags": ["flag de atenção 1 se aplicável"] ou []
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, briefing: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('Meeting prep error:', error)
    return NextResponse.json({ error: 'Erro ao gerar briefing' }, { status: 500 })
  }
}
