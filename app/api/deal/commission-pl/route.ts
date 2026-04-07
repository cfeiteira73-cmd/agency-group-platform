import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { safeCompare } from '@/lib/safeCompare'

const DealSchema = z.object({
  valor:     z.string(),
  fase:      z.string(),
  comprador: z.string().optional(),
  imovel:    z.string().optional(),
}).passthrough();

const CommissionPLSchema = z.object({
  deals:  z.array(DealSchema).min(1, 'É necessário pelo menos um deal'),
  period: z.string().optional().default('atual'),
});

export const runtime = 'nodejs';
export const maxDuration = 30;

const client = new Anthropic();

const STAGE_PCT: Record<string, number> = {
  'Angariação': 10,
  'Proposta Enviada': 20,
  'Proposta Aceite': 35,
  'Due Diligence': 50,
  'CPCV Assinado': 70,
  'Financiamento': 80,
  'Escritura Marcada': 90,
  'Escritura Concluída': 100,
};

const COMMISSION_RATE = 0.05;
const IRS_WITHHOLDING = 0.25;

interface Deal {
  valor: string;
  fase: string;
  comprador?: string;
  imovel?: string;
  [key: string]: unknown;
}

interface CommissionPLRequest {
  deals: Deal[];
  period: string;
}

function parseValor(valor: string): number {
  if (!valor) return 0;
  const cleaned = valor.replace(/[€\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

interface StageGroup {
  stage: string;
  deals: number;
  value: number;
  commission: number;
  probability: number;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const raw = await req.json();
    const parsed = CommissionPLSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }
    const { deals, period } = parsed.data;

    // Group by stage
    const stageMap: Record<string, StageGroup> = {};

    let realized = 0;
    let pipeline = 0;
    let topDeal: { imovel: string; commission: number } = { imovel: '', commission: 0 };

    for (const deal of deals) {
      const valor = parseValor(deal.valor);
      const fase = deal.fase || 'Angariação';
      const probability = (STAGE_PCT[fase] ?? 10) / 100;
      const grossCommission = valor * COMMISSION_RATE;
      const weightedCommission = grossCommission * probability;

      if (!stageMap[fase]) {
        stageMap[fase] = { stage: fase, deals: 0, value: 0, commission: 0, probability: (STAGE_PCT[fase] ?? 10) };
      }
      stageMap[fase].deals += 1;
      stageMap[fase].value += valor;
      stageMap[fase].commission += grossCommission;

      if (fase === 'Escritura Concluída') {
        realized += grossCommission;
      } else {
        pipeline += weightedCommission;
      }

      if (grossCommission > topDeal.commission) {
        topDeal = { imovel: deal.imovel || deal.comprador || 'N/D', commission: grossCommission };
      }
    }

    const byStage: StageGroup[] = Object.values(stageMap).sort(
      (a, b) => (STAGE_PCT[b.stage] ?? 0) - (STAGE_PCT[a.stage] ?? 0)
    );

    const expectedGross = realized + pipeline;
    const irsWithholding = expectedGross * IRS_WITHHOLDING;
    const expectedNet = expectedGross * (1 - IRS_WITHHOLDING);

    // Claude AI for forecast + insights
    const prompt = `És Carlos Feiteira, consultor imobiliário da Agency Group (AMI 22506) em Portugal.

Analisa o seguinte pipeline de comissões para o período: ${period || 'atual'}

RESUMO FINANCEIRO:
- Comissões realizadas (Escritura Concluída): €${realized.toFixed(2)}
- Pipeline ponderado: €${pipeline.toFixed(2)}
- Gross total esperado: €${expectedGross.toFixed(2)}
- IRS retido (25%): €${irsWithholding.toFixed(2)}
- Líquido esperado: €${expectedNet.toFixed(2)}

POR FASE:
${byStage.map(s => `- ${s.stage}: ${s.deals} deal(s), €${s.value.toFixed(0)} em valor, €${s.commission.toFixed(0)} em comissão bruta`).join('\n')}

DEAL TOPO: ${topDeal.imovel} — €${topDeal.commission.toFixed(0)} comissão bruta

Responde APENAS com um objeto JSON válido, sem markdown nem explicações:
{
  "forecast": {
    "3months": "previsão de comissões líquidas nos próximos 3 meses",
    "6months": "previsão para 6 meses",
    "12months": "previsão para 12 meses"
  },
  "insights": ["insight 1 acionável", "insight 2 acionável", "insight 3 acionável"],
  "recommendations": ["recomendação 1", "recomendação 2"]
}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let aiAnalysis: { forecast?: Record<string, string>; insights?: string[]; recommendations?: string[] } = {};
    try {
      aiAnalysis = JSON.parse(cleaned);
    } catch {
      console.error('[Commission P&L] Failed to parse Claude response:', cleaned);
    }

    return NextResponse.json({
      success: true,
      realized: parseFloat(realized.toFixed(2)),
      pipeline: parseFloat(pipeline.toFixed(2)),
      expectedGross: parseFloat(expectedGross.toFixed(2)),
      expectedNet: parseFloat(expectedNet.toFixed(2)),
      irsWithholding: parseFloat(irsWithholding.toFixed(2)),
      byStage,
      forecast: aiAnalysis.forecast ?? { '3months': 'N/D', '6months': 'N/D', '12months': 'N/D' },
      insights: aiAnalysis.insights ?? [],
      recommendations: aiAnalysis.recommendations ?? [],
      topDeal,
    });
  } catch (error) {
    console.error('[Commission P&L] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
