import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

// ─── HeyGen Streaming Session Proxy ───────────────────────────────────────────
// Keeps HEYGEN_API_KEY server-side only — never exposed to browser

const HEYGEN_API = 'https://api.heygen.com'

async function checkHeygenSessionRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const key = `rl:heygen:session:${userId}`
      const now = Date.now()
      const window = 3600 // 1 hour
      const limit = 10 // 10 sessions per hour per user
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZADD', key, now, `${now}`],
          ['ZREMRANGEBYSCORE', key, '-inf', now - window * 1000],
          ['ZCARD', key],
          ['EXPIRE', key, window],
        ]),
      })
      const results = await response.json() as Array<{ result: number }>
      const count = results[2]?.result ?? 0
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
    } catch {
      return { allowed: true, remaining: 10 }
    }
  }
  return { allowed: true, remaining: 10 }
}

// POST /api/heygen/session — create a new streaming session
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkHeygenSessionRateLimit(session.user.id)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas sessões. Tente novamente em 60 minutos.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    )
  }

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HeyGen não configurado. Adicionar HEYGEN_API_KEY ao .env.local' }, { status: 503 })
  }

  try {
    const { avatarId, voiceId, quality } = await req.json().catch(() => ({}))

    const res = await fetch(`${HEYGEN_API}/v1/streaming.new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        quality: quality || 'medium',
        avatar_id: avatarId || process.env.HEYGEN_AVATAR_ID || 'default',
        voice: { voice_id: voiceId || process.env.HEYGEN_VOICE_ID || '' },
        version: 'v2',
        video_encoding: 'H264',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('HeyGen session error:', err)
      return NextResponse.json({ error: 'Erro ao criar sessão HeyGen' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('HeyGen session error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/heygen/session — stop a streaming session
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HeyGen não configurado' }, { status: 503 })

  try {
    const { sessionId } = await req.json()
    const res = await fetch(`${HEYGEN_API}/v1/streaming.stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: sessionId }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao fechar sessão' }, { status: 500 })
  }
}
