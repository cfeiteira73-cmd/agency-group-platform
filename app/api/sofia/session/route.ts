// =============================================================================
// AGENCY GROUP — Sofia Session API v1.0
// POST /api/sofia/session — create/initialize Sofia video avatar session
// AMI: 22506 | HeyGen streaming avatar integration
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const language = String(body.language || 'PT')

    const apiKey = process.env.HEYGEN_API_KEY
    const avatarId = process.env.HEYGEN_AVATAR_ID
    const voiceId = process.env.HEYGEN_VOICE_ID

    // If HeyGen is not configured, return a mock session
    if (!apiKey || !avatarId) {
      console.log('[sofia/session] HeyGen not configured — returning mock session')
      return NextResponse.json({
        session_id: `mock-session-${Date.now()}`,
        sdp: null,
        ice_servers: [],
        status: 'mock',
        message: 'Sofia em modo demonstração. Configure HEYGEN_API_KEY e HEYGEN_AVATAR_ID para activar.',
        language,
      })
    }

    // Create HeyGen streaming session
    const res = await fetch('https://api.heygen.com/v1/streaming.new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        quality: 'medium',
        avatar_name: avatarId,
        voice: { voice_id: voiceId || undefined },
        video_encoding: 'VP8',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[sofia/session] HeyGen error:', errText)
      return NextResponse.json({
        session_id: `fallback-${Date.now()}`,
        status: 'error',
        message: 'Falha ao criar sessão Sofia. Tenta novamente.',
        language,
      }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({
      session_id: data.data?.session_id || data.session_id,
      sdp: data.data?.sdp || null,
      ice_servers: data.data?.ice_servers || [],
      status: 'ready',
      language,
    })
  } catch (err) {
    console.error('[sofia/session]', err)
    return NextResponse.json({
      session_id: `error-${Date.now()}`,
      status: 'error',
      message: 'Erro interno ao iniciar Sofia.',
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const sessionId = String(body.session_id || '')

    const apiKey = process.env.HEYGEN_API_KEY
    if (!apiKey || !sessionId || sessionId.startsWith('mock-') || sessionId.startsWith('fallback-')) {
      return NextResponse.json({ success: true })
    }

    await fetch('https://api.heygen.com/v1/streaming.stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sofia/session DELETE]', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
