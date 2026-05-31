// POST /api/sofia/os
// Wave 54 Phase 4 — Sofia AI Operating System

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { processSofiaMessage } from '@/lib/ai/sofia/sofiaOS'

export const runtime = 'nodejs'
export const maxDuration = 30

function authorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)) }
  catch { return false }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const contact_id = typeof body['contact_id'] === 'string' ? body['contact_id'] : 'anonymous'
  const message    = typeof body['message']    === 'string' ? body['message']    : ''
  const channel    = (['WEB','WHATSAPP','EMAIL'].includes(String(body['channel'])) ? body['channel'] : 'WEB') as 'WEB'|'WHATSAPP'|'EMAIL'
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
  const result = await processSofiaMessage({
    contact_id,
    session_id: typeof body['session_id'] === 'string' ? body['session_id'] : undefined,
    message,
    channel,
    context: typeof body['context'] === 'object' && body['context'] !== null ? body['context'] as Record<string, unknown> : {},
    tenantId: typeof body['tenant_id'] === 'string' ? body['tenant_id'] : undefined,
  })
  return NextResponse.json(result)
}
