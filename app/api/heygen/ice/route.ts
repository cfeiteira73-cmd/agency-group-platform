import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

const HEYGEN_API = 'https://api.heygen.com'

// POST /api/heygen/ice — relay ICE candidate to HeyGen
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HeyGen não configurado' }, { status: 503 })

  try {
    const { sessionId, candidate } = await req.json()

    const res = await fetch(`${HEYGEN_API}/v1/streaming.ice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: sessionId, candidate }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ICE candidate' }, { status: 500 })
  }
}
