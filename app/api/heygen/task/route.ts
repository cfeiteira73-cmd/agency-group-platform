import { NextRequest, NextResponse } from 'next/server'

const HEYGEN_API = 'https://api.heygen.com'

// POST /api/heygen/task — send text for avatar to speak
export async function POST(req: NextRequest) {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HeyGen não configurado' }, { status: 503 })

  try {
    const { sessionId, text, taskType } = await req.json()

    if (!sessionId || !text) {
      return NextResponse.json({ error: 'sessionId e text são obrigatórios' }, { status: 400 })
    }

    const res = await fetch(`${HEYGEN_API}/v1/streaming.task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        task_type: taskType || 'talk',
      }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao enviar texto' }, { status: 500 })
  }
}
