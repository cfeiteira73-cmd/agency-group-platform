import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

const LANG_INSTR: Record<string, string> = {
  PT: 'Responde em Português europeu formal, cálido e persuasivo.',
  EN: 'Respond in formal British English, warm and persuasive.',
  FR: 'Réponds en français formel, chaleureux et persuasif.',
  AR: 'الرجاء الرد باللغة العربية الفصحى، بأسلوب دافئ ومقنع.',
}

export async function POST(req: NextRequest) {
  try {
    const { property, language, purpose } = await req.json()

    const langInstr = LANG_INSTR[language] || LANG_INSTR['EN']

    const prompt = `És a Sofia, consultora de imobiliário de luxo da Agency Group (AMI 22506), a falar directamente com um cliente potencial através de um avatar de vídeo IA.

IMÓVEL:
- Nome: ${property.nome}
- Localização: ${property.zona}${property.bairro ? ', ' + property.bairro : ''}
- Tipo: ${property.tipo}
- Preço: €${Number(property.preco).toLocaleString('pt-PT')}
- Área: ${property.area}m² · ${property.quartos} quartos${property.casasBanho ? ' · ' + property.casasBanho + ' WC' : ''}
- Features: ${[property.piscina&&'Piscina',property.garagem&&'Garagem',property.terraco&&'Terraço'].filter(Boolean).join(' · ')||'—'}
- Badge: ${property.badge||'Standard'}

OBJECTIVO DO SCRIPT: ${purpose || 'Apresentação do imóvel'}

${langInstr}

Gera um script de apresentação em voz para o avatar, máximo 100 palavras. Tom natural, cálido e profissional — como se fosses a Sofia a falar directamente com o cliente. Sem emojis, sem labels, só o texto puro que a Sofia irá dizer em voz alta.`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })

    const script = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return NextResponse.json({ success: true, script })
  } catch (error) {
    console.error('Sofia script error:', error)
    return NextResponse.json({ error: 'Erro ao gerar script' }, { status: 500 })
  }
}
