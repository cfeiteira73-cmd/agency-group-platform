import { NextRequest, NextResponse } from 'next/server';

/**
 * AG·AI Proxy — /api/ai
 * Proxy seguro para Anthropic API. A API key fica no servidor (Vercel env).
 * Os documentos HTML chamam este endpoint em vez de api.anthropic.com diretamente.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 });
  }

  try {
    const body = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[AG·AI Proxy] Erro:', err);
    return NextResponse.json({ error: 'Erro interno no proxy AI' }, { status: 500 });
  }
}
