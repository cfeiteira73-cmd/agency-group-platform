import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { safeCompare } from '@/lib/safeCompare'

const DealRiskSchema = z.object({
  deal: z.object({
    imovel:        z.string().optional(),
    comprador:     z.string().optional(),
    valor:         z.string().optional(),
    fase:          z.string().optional(),
    dataCPCV:      z.string().optional(),
    dataEscritura: z.string().optional(),
    financiamento: z.string().optional(),
    notas:         z.string().optional(),
  }),
})

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const raw = await req.json()
    const parsed = DealRiskSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { deal } = parsed.data

    const prompt = `És um consultor sénior de imobiliário de luxo da Agency Group (AMI 22506) a analisar riscos num negócio activo.

DEAL EM ANÁLISE:
- Imóvel: ${deal.imovel || '—'}
- Comprador: ${deal.comprador || '—'}
- Valor: ${deal.valor || '—'}
- Fase: ${deal.fase || '—'}
- CPCV: ${deal.dataCPCV || 'n/d'}
- Escritura: ${deal.dataEscritura || 'n/d'}
- Financiamento: ${deal.financiamento || 'n/d'}
- Notas: ${deal.notas || '—'}

Analisa os riscos deste deal e responde em JSON:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "riskScore": 0-100,
  "risks": [
    { "category": "string", "description": "string", "severity": "LOW"|"MEDIUM"|"HIGH" }
  ],
  "recommendations": ["string", "string", "string"],
  "nextCriticalAction": "string",
  "timeline": "string"
}

Máximo 3-5 riscos. Foca em riscos reais: financiamento, prazo, documentação, mercado, partes. Responde em português europeu.`

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, analysis: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('Deal risk error:', error)
    return NextResponse.json({ error: 'Erro ao analisar risco' }, { status: 500 })
  }
}
