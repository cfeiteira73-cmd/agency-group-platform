import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { withCircuitBreaker } from '@/lib/ops/circuitBreaker'

const HEYGEN_API = 'https://api.heygen.com'

// POST /api/heygen/start — send SDP answer to complete WebRTC handshake
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HeyGen não configurado' }, { status: 503 })

  try {
    const { sessionId, sdp } = await req.json()

    // withCircuitBreaker: prevents hammering HeyGen when their API is down.
    // Opens after 5 consecutive failures; probes again after 60s.
    const heygenRes = await withCircuitBreaker<Response | null>(
      'heygen-api',
      () => fetch(`${HEYGEN_API}/v1/streaming.start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ session_id: sessionId, sdp }),
      }),
      null,  // fallback: circuit OPEN → 503 below
    )

    if (heygenRes === null) {
      return NextResponse.json(
        { error: 'HeyGen service temporarily unavailable. Please try again shortly.' },
        { status: 503, headers: { 'Retry-After': '60' } },
      )
    }

    const data = await heygenRes.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao iniciar sessão WebRTC' }, { status: 500 })
  }
}
