import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { agent, deals, contacts, properties, period } = await req.json()

    const closedDeals = deals.filter((d: Record<string,string>) => d.fase === 'Escritura Concluída')
    const activeDeals = deals.filter((d: Record<string,string>) => d.fase !== 'Escritura Concluída')
    const hotContacts = contacts.filter((c: Record<string,unknown>) => c.status === 'vip' || c.status === 'cliente')
    const totalPipeline = activeDeals.reduce((s: number, d: Record<string,string>) => s + (parseFloat(d.valor.replace(/[^0-9.]/g,''))||0), 0)

    const prompt = `És ${agent || 'Carlos Feiteira'}, agente de imobiliário de luxo da Agency Group (AMI 22506).

Gera um relatório semanal profissional e conciso em português europeu formal.

DADOS DA SEMANA (${period || 'Semana actual'}):

DEALS ACTIVOS (${activeDeals.length}):
${activeDeals.slice(0,5).map((d: Record<string,string>) => `- ${d.imovel}: ${d.valor} · ${d.fase}`).join('\n')}

DEALS FECHADOS (${closedDeals.length}):
${closedDeals.slice(0,3).map((d: Record<string,string>) => `- ${d.imovel}: ${d.valor}`).join('\n') || '— Nenhum esta semana'}

PIPELINE TOTAL: €${Math.round(totalPipeline/1000)}K

CONTACTOS PRIORITÁRIOS (${hotContacts.length} VIP/Cliente):
${hotContacts.slice(0,4).map((c: Record<string,unknown>) => `- ${c.name}: ${c.nationality} · €${((Number(c.budgetMax)||0)/1e6).toFixed(1)}M`).join('\n')}

PORTFÓLIO: ${properties.length} imóveis activos

Gera o relatório em JSON:
{
  "title": "string",
  "period": "string",
  "executiveSummary": "2-3 frases de resumo executivo",
  "highlights": ["string", "string", "string"],
  "pipeline": {
    "total": "string",
    "activeDeals": "number",
    "closedDeals": "number",
    "expectedCommission": "string"
  },
  "priorities": ["string", "string", "string"],
  "marketInsight": "1 insight de mercado relevante para esta semana",
  "nextWeekFocus": "string"
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
      return NextResponse.json({ success: true, report: result })
    } catch {
      return NextResponse.json({ error: 'Parse error', raw: text }, { status: 500 })
    }
  } catch (error) {
    console.error('Weekly report error:', error)
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 })
  }
}
