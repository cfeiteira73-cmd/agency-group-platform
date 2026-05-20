// =============================================================================
// Agency Group — Executive Intelligence Copilot
// POST /api/executive/copilot
//
// Provides AI-powered answers to executive-level questions about the Portuguese
// luxury real estate market and Agency Group operations.
//
// Input:
//   body.message   — string  (required) user question
//   body.org_id    — string  (optional) organisation context
//   body.user_role — string  (optional) role context (e.g. "director", "agent")
//
// Output:
//   { message: string, generated_at: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { withAI } from '@/lib/ops/withAI'
import { requirePortalAuth } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'
export const maxDuration = 45

const client = new Anthropic()

const SYSTEM_PROMPT = `És o Executive Intelligence Copilot da Agency Group (AMI 22506), a boutique imobiliária de luxo líder em Portugal.

CONTEXTO DE MERCADO (dados actualizados):
• Mediana nacional: €3.076/m² · Crescimento: +17,6% YoY · 169.812 transacções anuais
• Lisboa: €5.000/m² · Cascais: €4.713/m² · Algarve: €3.941/m² · Porto: €3.643/m²
• Madeira: €3.760/m² · Açores: €1.952/m²
• Lisboa classificada no Top 5 mundial em imobiliário de luxo
• Tempo médio de venda: 210 dias
• Compradores estrangeiros: Norte-americanos 16% · Franceses 13% · Britânicos 9% · Chineses 8% · Brasileiros 6% · Alemães 5%
• Segmento core Agency Group: €500K–€3M · Top: €3M+ (family offices, HNWI, Médio Oriente)

AGENCY GROUP:
• AMI 22506 · Comissão: 5% (50% CPCV + 50% Escritura)
• Mercado: Portugal + Espanha + Madeira + Açores
• Posicionamento: boutique de luxo com inteligência de dados e IA

O teu papel é responder a questões executivas com análise precisa, dados concretos e recomendações accionáveis. Sê directo, formal e orientado para a decisão. Evita rodeios. Usa português europeu formal.`

export async function POST(req: NextRequest) {
  const authResult = await requirePortalAuth(req)
  if (!authResult.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as { message?: string; org_id?: string; user_role?: string }
    const { message, org_id, user_role } = body

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'O campo message é obrigatório.' }, { status: 400 })
    }

    const contextParts: string[] = []
    if (org_id)    contextParts.push(`Organização: ${org_id}`)
    if (user_role) contextParts.push(`Perfil: ${user_role}`)
    const contextHeader = contextParts.length > 0 ? `[${contextParts.join(' · ')}]\n\n` : ''

    const response = await withAI(
      'anthropic-opus',
      () => client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `${contextHeader}${message.trim()}` }],
      }),
      null,
    )

    if (response === null) {
      return NextResponse.json({ error: 'Serviço de IA temporariamente indisponível.' }, { status: 503 })
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({
      message: text,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[executive/copilot] Error:', error)
    return NextResponse.json({ error: 'Erro interno ao processar a questão.' }, { status: 500 })
  }
}
