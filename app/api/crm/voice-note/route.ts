import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { transcript, existingContact, language } = await req.json()

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ error: 'Transcrição demasiado curta ou vazia' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const lang = language || 'pt'

    const prompt = `És Carlos Feiteira, agente sénior da Agency Group (AMI 22506), a actualizar o teu CRM após uma reunião/chamada.

DATA ACTUAL: ${today}
IDIOMA DA NOTA: ${lang}

TRANSCRIÇÃO DA NOTA DE VOZ:
"${transcript}"

${existingContact ? `CONTACTO EXISTENTE NO CRM (actualiza apenas o que for novo ou diferente):
Nome: ${existingContact.name || '—'}
Budget: €${existingContact.budgetMin?.toLocaleString('pt-PT') || '—'} – €${existingContact.budgetMax?.toLocaleString('pt-PT') || '—'}
Zonas: ${existingContact.zonas?.join(', ') || '—'}
Status: ${existingContact.status || '—'}
Notas anteriores: ${existingContact.notes || '—'}` : 'NOVO CONTACTO — extrair toda a informação disponível'}

Extrai e estrutura toda a informação em JSON rigoroso. Não inventes dados que não estejam na transcrição:
{
  "contact": {
    "name": "nome completo ou null",
    "phone": "+351... formato internacional ou null",
    "email": "email@... ou null",
    "nationality": "emoji+país (ex: 🇫🇷 Francês) ou null",
    "language": "PT|EN|FR|DE|ES|AR|ZH",
    "budgetMin": número_euros_ou_null,
    "budgetMax": número_euros_ou_null,
    "zonas": ["zona1", "zona2"],
    "tipos": ["Apartamento", "Villa", "Moradia", "Quinta", "Penthouse"],
    "status": "lead|prospect|cliente|vip",
    "origin": "WhatsApp|Email|Referência|Website|Phone|Event",
    "notes": "resumo conciso das necessidades, preferências e contexto em 2-3 frases"
  },
  "tasks": [
    { "title": "tarefa específica e accionável", "date": "${today}", "priority": "high|medium|low", "done": false }
  ],
  "nextStep": "próxima acção clara, específica e com prazo",
  "dealPotential": "alto|médio|baixo",
  "urgency": "imediato|esta semana|este mês|sem urgência",
  "followUpDate": "YYYY-MM-DD recomendado para próximo contacto",
  "keyInsights": [
    "insight 1 relevante sobre motivação/contexto do cliente",
    "insight 2"
  ],
  "meetingSummary": "resumo executivo da reunião/chamada em 1 parágrafo em português europeu formal",
  "sentiment": "positivo|neutro|negativo|incerto",
  "objections": ["objecção mencionada 1 se houver", "objecção 2"],
  "budget_confirmed": true_ou_false,
  "timeline_confirmed": true_ou_false
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Voice Note] Error:', error)
    return NextResponse.json({ error: 'Erro ao processar nota de voz' }, { status: 500 })
  }
}
