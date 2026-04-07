import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// ─── Mock fallback when API key is absent ─────────────────────────────────────

const MOCK_CONTACT = {
  name: null,
  email: null,
  phone: null,
  nationality: null,
  language: 'PT',
  budgetMin: null,
  budgetMax: null,
  zonas: [],
  tipos: [],
  status: 'lead',
  notes: 'Contacto importado manualmente. Preencher detalhes.',
  origin: null,
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (authHeader !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { text } = await req.json()

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ error: 'Texto demasiado curto para extrair contacto' }, { status: 400 })
    }

    // Graceful mock when API key is missing
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('[extract-contact] ANTHROPIC_API_KEY não definida — mock response')
      return NextResponse.json({ success: true, contact: { ...MOCK_CONTACT, notes: `Importado via texto (mock): ${text.slice(0, 80)}` } })
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const prompt = `És um especialista em CRM imobiliário de luxo em Portugal (Agency Group, AMI 22506).
Extrai informação de contacto deste texto e devolve APENAS JSON válido, sem markdown, sem explicações.

CONTEXTO: Mercado imobiliário premium português. Zonas relevantes: Lisboa, Cascais, Sintra, Algarve (Vilamoura, Quinta do Lago, Lagos), Porto, Foz, Comporta, Ericeira, Madeira, Açores.
Tipologias comuns: T1–T6, Apartamento, Moradia, Villa, Penthouse, Quinta, Escritório.
Compradores típicos: portugueses, brasileiros, franceses, britânicos, norte-americanos, alemães, árabes, chineses.

TEXTO A ANALISAR:
${text}

JSON esperado (usa null para campos não detectados, nunca inventes dados):
{
  "name": "Nome completo ou null",
  "email": "email@example.com ou null",
  "phone": "+351... formato internacional ou null",
  "nationality": "emoji+país (ex: 🇫🇷 Francês) ou null",
  "language": "PT|EN|FR|DE|AR|ZH|ES ou null",
  "budgetMin": número_em_euros_ou_null,
  "budgetMax": número_em_euros_ou_null,
  "zonas": ["Lisboa", "Cascais"] ou [],
  "tipos": ["T3", "Villa", "Apartamento"] ou [],
  "status": "lead|prospect|cliente|vip ou null",
  "notes": "Resumo conciso em português europeu — motivação, contexto e necessidades principais, máx 2 frases",
  "origin": "WhatsApp|Email|Referência|Website|LinkedIn|Evento|Telefone ou null"
}`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      system: 'És um extractor preciso de dados de contacto imobiliário. Respondes APENAS com JSON válido, sem qualquer texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, contact: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw }, { status: 500 })
    }
  } catch (error) {
    console.error('[extract-contact] Error:', error)
    return NextResponse.json({ error: 'Erro ao extrair contacto' }, { status: 500 })
  }
}
