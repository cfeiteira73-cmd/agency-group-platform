import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    const prompt = `Extrai informação de contacto imobiliário deste texto. Responde APENAS em JSON válido, sem markdown.

TEXTO:
${text}

JSON esperado:
{
  "name": "Nome completo ou null",
  "email": "email@example.com ou null",
  "phone": "+351... ou null",
  "nationality": "🇵🇹 Português ou emoji+pais ou null",
  "language": "PT|EN|FR|DE|AR|ZH ou null",
  "budgetMin": número_em_euros_ou_null,
  "budgetMax": número_em_euros_ou_null,
  "zonas": ["zona1","zona2"] ou [],
  "tipos": ["T3","Villa","Apartamento"] ou [],
  "status": "lead|prospect|cliente|vip ou null",
  "notes": "Resumo conciso das necessidades e observações relevantes, em português europeu, máx 2 frases",
  "origin": "WhatsApp|Email|Referência|Website|LinkedIn ou null"
}

Se não tiveres certeza, usa null. Nunca inventes dados.`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })

    const text2 = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text2.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, contact: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw: text2 }, { status: 500 })
    }
  } catch (error) {
    console.error('Extract contact error:', error)
    return NextResponse.json({ error: 'Erro ao extrair contacto' }, { status: 500 })
  }
}
