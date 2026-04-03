import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const client = new Anthropic();

interface CMARequest {
  property: object;
  allProperties: object[];
}

export async function POST(req: NextRequest) {
  try {
    const body: CMARequest = await req.json();
    const { property, allProperties } = body;

    if (!property || !allProperties) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: property, allProperties' }, { status: 400 });
    }

    const prompt = `És Carlos Feiteira, consultor imobiliário sénior da Agency Group (AMI 22506), especializado em análise de mercado em Portugal.

Analisa o seguinte imóvel e compara com a lista de propriedades disponíveis, selecionando as 3 mais comparáveis com base em zona, tipo, número de quartos e preço.

IMÓVEL A ANALISAR:
${JSON.stringify(property, null, 2)}

LISTA DE PROPRIEDADES DISPONÍVEIS:
${JSON.stringify(allProperties, null, 2)}

Responde APENAS com um objeto JSON válido, sem markdown, sem código, sem explicações adicionais:
{
  "summary": "análise em 2-3 frases sobre o posicionamento do imóvel no mercado",
  "comparables": [
    {
      "nome": "nome ou referência do imóvel comparável",
      "preco": número,
      "area": número em m²,
      "precoM2": número (preço por m²),
      "zona": "zona/localização",
      "quartos": número,
      "diff": "diferença percentual de preço face ao imóvel analisado, ex: +5% ou -3%",
      "positioning": "como se posiciona face ao imóvel analisado"
    }
  ],
  "valorJusto": número (valor justo de mercado estimado),
  "valorMinimo": número (valor mínimo aceitável),
  "valorMaximo": número (valor máximo premium),
  "recomendacao": "recomendação de preço de listagem com justificação",
  "estrategia": "estratégia de venda recomendada"
}`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ success: false, error: 'Erro ao processar resposta do Claude', raw: cleaned }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...analysis });
  } catch (error) {
    console.error('[CMA] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
