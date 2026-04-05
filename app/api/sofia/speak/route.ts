// =============================================================================
// AGENCY GROUP — Sofia Speak API v1.0
// POST /api/sofia/speak — send text to Sofia video avatar to speak
// AMI: 22506 | HeyGen streaming avatar integration
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      sessionId?: string
      session_id?: string
      text: string
      language?: string
    }
    const sessionId = body.sessionId || body.session_id || ''
    const text = String(body.text || '').trim()
    const language = String(body.language || 'PT')

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.HEYGEN_API_KEY

    // Mock session or no HeyGen key
    if (!apiKey || !sessionId || sessionId.startsWith('mock-') || sessionId.startsWith('fallback-') || sessionId.startsWith('error-')) {
      return NextResponse.json({
        success: true,
        status: 'mock',
        message: `Sofia diria: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
        language,
      })
    }

    // Send text to HeyGen streaming session
    const res = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        task_type: 'talk',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[sofia/speak] HeyGen error:', errText)
      return NextResponse.json({ error: 'Failed to send speech task', detail: errText }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, task_id: data.data?.task_id, status: 'sent' })
  } catch (err) {
    console.error('[sofia/speak]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
