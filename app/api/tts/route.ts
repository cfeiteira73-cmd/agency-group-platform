import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, voice = 'nova' } = await req.json() as { text: string; voice?: string }

  if (!text || text.length > 1000) {
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 1000),
        voice, // 'nova' = warm female
        speed: 1.0,
        response_format: 'mp3',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[tts] OpenAI error:', err)
      return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
    }

    const audioBuffer = await res.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[tts] Error:', error)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }
}
