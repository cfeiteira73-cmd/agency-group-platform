import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withAI } from '@/lib/ops/withAI';
import { rateLimit } from '@/lib/rateLimit';
import { isPortalAuth } from '@/lib/portalAuth';
import { getRequestCorrelationId } from '@/lib/observability/correlation'

const anthropicClient = new Anthropic();

/**
 * AG·AI Proxy — /api/ai
 * Proxy seguro para Anthropic API com retry automático (3 tentativas).
 * Corrige automaticamente nomes de modelo desatualizados.
 * Rate limited: 20 req/min per IP to prevent API cost abuse.
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

// sleep removed — withAI governance handles exponential retry internally

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 20 requests/minute per IP (prevents Anthropic API cost abuse)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const limited = await rateLimit(ip, { maxAttempts: 20, windowMs: 60 * 1000 })
  if (!limited.success) {
    return NextResponse.json(
      { error: 'Too many requests. Tente de novo em 1 minuto.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body inválido' }, { status: 400 });
  }

  // Corrige o modelo automaticamente
  const model = typeof body.model === 'string' ? resolveModel(body.model) : 'claude-sonnet-4-6';
  const messages = body.messages as Anthropic.MessageParam[] ?? [];
  const system   = typeof body.system === 'string' ? body.system : undefined;
  const maxTok   = typeof body.max_tokens === 'number' ? body.max_tokens : 1024;

  // GOVERNANCE FIX: was raw fetch() with custom retry loop — bypassed withAI governance.
  // withAI provides: policyEngine → circuit breaker → exponential retry → token tracking → audit log
  const result = await withAI(
    'anthropic',
    () => anthropicClient.messages.create({
      model,
      max_tokens: maxTok,
      messages,
      ...(system ? { system } : {}),
    }),
    null,
    'ai-proxy',
  )

  if (result === null) {
    console.error('[AG·AI] withAI returned null (circuit open or policy denied)', { corrId })
    return NextResponse.json(
      { type: 'error', error: { type: 'service_unavailable', message: 'Serviço temporariamente indisponível. Tenta novamente em 30 segundos.' } },
      { status: 503 },
    )
  }

  return NextResponse.json(result);
}
