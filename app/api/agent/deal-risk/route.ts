// =============================================================================
// AGENCY GROUP — Deal Risk Analysis API v1.0
// POST /api/agent/deal-risk — AI-powered deal risk assessment
// AMI: 22506 | Claude AI analysis
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/auth'

export const runtime = 'nodejs'

interface RiskFactor {
  factor: string
  severity: 'high' | 'medium' | 'low'
  description: string
  mitigation: string
}

interface DealRiskResponse {
  overall_risk: 'high' | 'medium' | 'low'
  risk_score: number
  risk_factors: RiskFactor[]
  recommendation: string
  probability_of_close: number
  suggested_actions: string[]
}

function fallbackRiskAnalysis(deal: Record<string, unknown>): DealRiskResponse {
  const fase = String(deal.fase || deal.stage || 'Contacto')
  const valor = String(deal.valor || '€0')
  const diasEtapa = Number(deal.days_in_stage || deal.daysInStage || 0)

  const isHighValue = valor.includes('M') || parseInt(valor.replace(/\D/g, '')) > 1000000
  const isLateStage = ['Negociação', 'CPCV', 'Escritura'].includes(fase)
  const isStalled = diasEtapa > 30

  const riskScore = (isHighValue ? 30 : 15) + (isStalled ? 25 : 0) + (isLateStage ? 10 : 20)

  return {
    overall_risk: riskScore > 50 ? 'high' : riskScore > 30 ? 'medium' : 'low',
    risk_score: Math.min(riskScore, 85),
    risk_factors: [
      {
        factor: 'Stagnation Risk',
        severity: isStalled ? 'high' : 'low',
        description: isStalled ? `Deal stalled for ${diasEtapa} days in ${fase} stage` : `Deal progressing normally in ${fase}`,
        mitigation: 'Schedule urgent follow-up call and present new value proposition',
      },
      {
        factor: 'Financing Risk',
        severity: isHighValue ? 'medium' : 'low',
        description: isHighValue ? 'High-value transaction — financing approval critical' : 'Standard financing risk profile',
        mitigation: 'Confirm financing status and have backup lenders ready',
      },
      {
        factor: 'Negotiation Gap',
        severity: fase === 'Negociação' ? 'medium' : 'low',
        description: fase === 'Negociação' ? 'Active negotiation — bid/ask spread risk' : 'No active negotiation risk',
        mitigation: 'Prepare comparable market analysis to support pricing',
      },
    ],
    recommendation: isStalled
      ? `Urgent: schedule buyer call within 24h. ${isHighValue ? 'Consider bringing in senior partner for high-value deal.' : 'Refresh property presentation.'}`
      : `Deal on track. ${isLateStage ? 'Prepare closing documentation in advance.' : 'Continue nurturing buyer relationship.'}`,
    probability_of_close: Math.max(20, 85 - riskScore),
    suggested_actions: [
      isStalled ? '📞 Schedule call in next 24h — deal at risk of cooling' : '📅 Set next touchpoint for 3 days from now',
      isHighValue ? '📊 Prepare investor-grade deal memo' : '📧 Send property comparison report',
      isLateStage ? '📋 Start preparing CPCV documentation' : '🏠 Schedule second property visit',
    ],
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { deal } = body as { deal: Record<string, unknown> }

    if (!deal) {
      return NextResponse.json({ error: 'deal is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallbackRiskAnalysis(deal))
    }

    try {
      const client = new Anthropic({ apiKey })
      const dealContext = `
Deal: ${deal.ref || deal.id}
Property: ${deal.imovel}
Buyer: ${deal.comprador}
Value: ${deal.valor}
Stage: ${deal.fase}
Days in stage: ${deal.days_in_stage || deal.daysInStage || 'unknown'}
CPCV Date: ${deal.cpcvDate || deal.cpcv_date || 'not set'}
Escritura Date: ${deal.escrituraDate || deal.escritura_date || 'not set'}
Notes: ${deal.notas || deal.notes || 'none'}
`.trim()

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Analyse this real estate deal risk for Agency Group (AMI 22506, Portugal).
Respond in JSON with this exact structure:
{
  "overall_risk": "high|medium|low",
  "risk_score": 0-100,
  "risk_factors": [{"factor": "...", "severity": "high|medium|low", "description": "...", "mitigation": "..."}],
  "recommendation": "concise 1-2 sentence action recommendation in Portuguese",
  "probability_of_close": 0-100,
  "suggested_actions": ["emoji + action 1", "emoji + action 2", "emoji + action 3"]
}

Deal context:
${dealContext}`,
          },
        ],
      })

      const content = message.content[0]
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text) as DealRiskResponse
          return NextResponse.json(parsed)
        } catch {
          return NextResponse.json(fallbackRiskAnalysis(deal))
        }
      }
    } catch (aiErr) {
      console.warn('[deal-risk] Claude error:', aiErr instanceof Error ? aiErr.message : aiErr)
    }

    return NextResponse.json(fallbackRiskAnalysis(deal))
  } catch (err) {
    console.error('[deal-risk]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
