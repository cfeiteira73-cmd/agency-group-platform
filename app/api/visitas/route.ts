import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isPortalAuth } from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const client = new Anthropic();

interface SuggestFeedbackRequest {
  action: 'suggest-feedback';
  visit: object;
  contact: object;
}

interface SimpleActionRequest {
  action: 'create' | 'update' | 'list';
  [key: string]: unknown;
}

type VisitasRequest = SuggestFeedbackRequest | SimpleActionRequest;

export async function POST(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body: VisitasRequest = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Campo obrigatório: action' }, { status: 400 });
    }

    // Simple CRUD passthrough — persistence is handled client-side
    if (action === 'create' || action === 'update' || action === 'list') {
      return NextResponse.json({ success: true, message: 'Use client-side state' });
    }

    if (action === 'suggest-feedback') {
      const { visit, contact } = body as SuggestFeedbackRequest;

      if (!visit || !contact) {
        return NextResponse.json({ success: false, error: 'Campos obrigatórios: visit, contact' }, { status: 400 });
      }

      const prompt = `És Carlos Feiteira, consultor imobiliário sénior da Agency Group (AMI 22506) em Portugal.

Após uma visita a um imóvel, sugere as próximas ações de follow-up para converter este contacto.

DADOS DA VISITA:
${JSON.stringify(visit, null, 2)}

DADOS DO CONTACTO:
${JSON.stringify(contact, null, 2)}

Responde APENAS com um objeto JSON válido, em português europeu, sem markdown nem explicações adicionais:
{
  "followUpEmail": "rascunho de email de follow-up personalizado para enviar nas próximas 24h",
  "nextStep": "próximo passo concreto e imediato a tomar",
  "objectionResponse": "como responder à principal objeção provável deste cliente",
  "timeToDecision": "estimativa do tempo até decisão e razão"
}`;

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let suggestion: { followUpEmail?: string; nextStep?: string; objectionResponse?: string; timeToDecision?: string } = {};
      try {
        suggestion = JSON.parse(cleaned);
      } catch {
        return NextResponse.json({ success: false, error: 'Erro ao processar resposta do Claude', raw: cleaned }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        followUpEmail: suggestion.followUpEmail ?? '',
        nextStep: suggestion.nextStep ?? '',
        objectionResponse: suggestion.objectionResponse ?? '',
        timeToDecision: suggestion.timeToDecision ?? '',
      });
    }

    return NextResponse.json({ success: false, error: `Ação desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[Visitas] Error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
