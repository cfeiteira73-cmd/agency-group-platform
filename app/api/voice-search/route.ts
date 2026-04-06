import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioBlob = formData.get('audio') as File | null

    if (!audioBlob) {
      return NextResponse.json({ error: 'Audio required' }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY

    // If no OpenAI key, return error (Web Speech API should be used instead)
    if (!openaiKey) {
      return NextResponse.json({
        error: 'Voice transcription not configured',
        fallback: 'Use browser speech recognition',
      }, { status: 503 })
    }

    // Call OpenAI Whisper
    const whisperForm = new FormData()
    whisperForm.append('file', audioBlob, 'audio.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'pt') // Portuguese first
    whisperForm.append('response_format', 'json')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
      signal: AbortSignal.timeout(10000),
    })

    if (!whisperRes.ok) {
      throw new Error(`Whisper error: ${whisperRes.status}`)
    }

    const { text } = await whisperRes.json() as { text: string }
    return NextResponse.json({ transcript: text, source: 'whisper' })

  } catch (error) {
    console.error('Voice search error:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
