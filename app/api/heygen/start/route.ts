import { NextRequest, NextResponse } from 'next/server'

const HEYGEN_API = 'https://api.heygen.com'

// POST /api/heygen/start — send SDP answer to complete WebRTC handshake
export async function POST(req: NextRequest) {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HeyGen não configurado' }, { status: 503 })

  try {
    const { sessionId, sdp } = await req.json()

    const res = await fetch(`${HEYGEN_API}/v1/streaming.start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: sessionId, sdp }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao iniciar sessão WebRTC' }, { status: 500 })
  }
}
