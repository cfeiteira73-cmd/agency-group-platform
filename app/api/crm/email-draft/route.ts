import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

const LANG_MAP: Record<string, string> = {
  PT: 'Português europeu formal e cálido',
  EN: 'formal British English, warm and professional',
  FR: 'français formel et chaleureux',
  DE: 'formales Deutsch, warm und professionell',
  AR: 'عربية رسمية ودودة ومهنية',
  ZH: '正式、温暖的中文',
}

export async function POST(req: NextRequest) {
  try {
    const { contact, purpose, property, agentName } = await req.json()

    const lang = LANG_MAP[contact.language || 'EN'] || LANG_MAP['EN']
    const langInstr = contact.language === 'PT' ? 'Responde em Português europeu formal.'
      : contact.language === 'FR' ? 'Réponds en français formel.'
      : contact.language === 'DE' ? 'Antworte auf formalem Deutsch.'
      : contact.language === 'AR' ? 'الرجاء الرد باللغة العربية الفصحى.'
      : contact.language === 'ZH' ? '请用正式中文回复。'
      : 'Respond in formal British English.'

    const prompt = `És ${agentName || 'Carlos Feiteira'}, agente de imobiliário de luxo da Agency Group (AMI 22506) em Portugal.

Escreve um email profissional, personalizado e persuasivo para o seguinte cliente:

CLIENTE:
- Nome: ${contact.name}
- Nacionalidade: ${contact.nationality}
- Status: ${contact.status}
- Budget: €${(Number(contact.budgetMin)||0).toLocaleString('pt-PT')} – €${(Number(contact.budgetMax)||0).toLocaleString('pt-PT')}
- Zonas de interesse: ${contact.zonas?.join(', ') || '—'}
- Tipologias: ${contact.tipos?.join(', ') || '—'}
- Notas: ${contact.notes || '—'}

OBJECTIVO DO EMAIL: ${purpose || 'Follow-up geral'}

${property ? `IMÓVEL A DESTACAR:
- Nome: ${String(property.nome)}
- Zona: ${String(property.zona)}
- Tipo: ${property.tipo}
- Preço: €${Number(property.preco).toLocaleString('pt-PT')}
- Área: ${property.area}m² · T${property.quartos}
` : ''}

${langInstr}

Gera o email em JSON com esta estrutura:
{
  "subject": "Assunto do email (máx 60 caracteres, apelativo)",
  "greeting": "Saudação personalizada",
  "body": "Corpo do email — 3-4 parágrafos concisos, persuasivos e personalizados. Referencia dados concretos do cliente. Sem clichés.",
  "cta": "Call to action final (1 frase directa)",
  "signature": "Assinatura profissional"
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
      return NextResponse.json({ success: true, draft: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('Email draft error:', error)
    return NextResponse.json({ error: 'Erro ao gerar draft' }, { status: 500 })
  }
}
