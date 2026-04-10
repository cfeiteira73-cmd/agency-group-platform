import { NextRequest, NextResponse } from 'next/server';

/**
 * AG·AI Proxy — /api/ai
 * Proxy seguro para Anthropic API com retry automático (3 tentativas).
 * Corrige automaticamente nomes de modelo desatualizados.
 */

// Modelos válidos actuais
const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
  'claude-opus-4-20250514':   'claude-opus-4-6',
  'claude-haiku-4-20250514':  'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
  'claude-3-5-haiku-20241022':  'claude-haiku-4-5-20251001',
};

function resolveModel(model: string): string {
  if (MODEL_MAP[model]) return MODEL_MAP[model];
  // Se não reconhecido, usa Sonnet 4.6 como default
  const known = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'];
  if (known.includes(model)) return model;
  return 'claude-sonnet-4-6';
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body inválido' }, { status: 400 });
  }

  // Corrige o modelo automaticamente
  if (typeof body.model === 'string') {
    body.model = resolveModel(body.model);
  } else {
    body.model = 'claude-sonnet-4-6';
  }

  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(1500 * attempt); // 1.5s, 3s
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as Record<string, unknown>;

      // 529 = overloaded → retry
      if (response.status === 529 && attempt < MAX_RETRIES - 1) {
        console.warn(`[AG·AI] Anthropic overloaded, tentativa ${attempt + 1}/${MAX_RETRIES}`);
        lastError = data;
        continue;
      }

      return NextResponse.json(data, { status: response.status });

    } catch (err) {
      console.error(`[AG·AI] Tentativa ${attempt + 1} falhou:`, err);
      lastError = err;
    }
  }

  console.error('[AG·AI] Todas as tentativas falharam:', lastError);
  return NextResponse.json(
    { type: 'error', error: { type: 'service_unavailable', message: 'Serviço temporariamente indisponível. Tenta novamente em 30 segundos.' } },
    { status: 503 }
  );
}
