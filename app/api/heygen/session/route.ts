import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

// ─── HeyGen Streaming Session Proxy ───────────────────────────────────────────
// Keeps HEYGEN_API_KEY server-side only — never exposed to browser

const HEYGEN_API = 'https://api.heygen.com'

// POST /api/heygen/session — create a new streaming session
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
