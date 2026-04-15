// =============================================================================
// AGENCY GROUP — Voz Process API v1.0
// POST /api/voz/process — process voice note transcript with AI
// Extracts intent, summary, action items from real estate voice notes
// AMI: 22506 | Claude AI processing
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isPortalAuth } from '@/lib/portalAuth'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `És um assistente especializado em imobiliário de luxo para a Agency Group (AMI 22506).
Analisa notas de voz de consultores imobiliários e extrai informação estruturada.
Responde SEMPRE em JSON válido sem markdown nem formatação extra.`

const INTENT_TYPES = ['nota_visita', 'follow_up', 'proposta', 'tarefa', 'desconhecido'] as const
type IntentType = typeof INTENT_TYPES[number]

interface AIProcessResult {
  intent: IntentType
  summary: string
  actionItems: string[]
  urgency: 'alta' | 'media' | 'baixa'
  sentiment: 'positivo' | 'neutro' | 'negativo'
  entities?: {
    properties?: string[]
    contacts?: string[]
    amounts?: string[]
    dates?: string[]
  }
}

function fallbackProcess(text: string): AIProcessResult {
  const lc = text.toLowerCase()
  const intent: IntentType =
    lc.includes('visit') || lc.includes('imóvel') || lc.includes('casa') ? 'nota_visita' :
    lc.includes('follow') || lc.includes('contactar') || lc.includes('ligar') ? 'follow_up' :
    lc.includes('proposta') || lc.includes('oferta') ? 'proposta' :
    lc.includes('tarefa') || lc.includes('criar') || lc.includes('lembrar') ? 'tarefa' :
    'desconhecido'

  return {
    intent,
    summary: text.slice(0, 120) + (text.length > 120 ? '...' : ''),
    actionItems: [
      'Rever conteúdo transcrito',
      'Confirmar dados com cliente',
      'Actualizar CRM',
    ],
    urgency: lc.includes('urgente') || lc.includes('hoje') || lc.includes('imediato') ? 'alta' : 'media',
    sentiment: lc.includes('positiv') || lc.includes('gostar') || lc.includes('adorar') ? 'positivo' : 'neutro',
  }
}

export async function POST(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const text = String(body.text || '').trim()

    if (!text || text.length < 5) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallbackProcess(text))
    }

    try {
      const client = new Anthropic({ apiKey })
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Analisa esta nota de voz de um consultor imobiliário e responde em JSON com estes campos exactos:
{
  "intent": "nota_visita|follow_up|proposta|tarefa|desconhecido",
  "summary": "resumo em 1-2 frases",
  "actionItems": ["acção 1", "acção 2", "acção 3"],
  "urgency": "alta|media|baixa",
  "sentiment": "positivo|neutro|negativo",
  "entities": {
    "properties": ["imóveis mencionados"],
    "contacts": ["contactos mencionados"],
    "amounts": ["valores mencionados"],
    "dates": ["datas mencionadas"]
  }
}

Nota de voz:
"${text}"`,
          },
        ],
      })

      const content = message.content[0]
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text) as AIProcessResult
          // Validate intent
          if (!INTENT_TYPES.includes(parsed.intent)) parsed.intent = 'desconhecido'
          return NextResponse.json(parsed)
        } catch {
          return NextResponse.json(fallbackProcess(text))
        }
      }
    } catch (aiErr) {
      console.warn('[voz/process] Claude error:', aiErr instanceof Error ? aiErr.message : aiErr)
    }

    return NextResponse.json(fallbackProcess(text))
  } catch (err) {
    console.error('[voz/process]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
