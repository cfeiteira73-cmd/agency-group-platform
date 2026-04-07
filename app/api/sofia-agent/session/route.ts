import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// D-ID Agents API — fully prepared, activates when DID_API_KEY + DID_AGENT_ID are set
// Pricing: ~$99/month for D-ID Agents tier
// Setup: 1) Create agent at studio.d-id.com, 2) Add DID_API_KEY + DID_AGENT_ID to Vercel env

export async function POST(req: NextRequest) {
  const apiKey  = process.env.DID_API_KEY
  const agentId = process.env.DID_AGENT_ID

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { configured: false, fallback: 'text', message: 'D-ID not configured — using text chat' },
      { status: 200 }
    )
  }

  try {
    // Create D-ID Agents streaming session (WebRTC)
    const res = await fetch(`https://api.d-id.com/agents/${agentId}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const data = await res.json() as {
      id?: string; session_token?: string; ice_servers?: unknown[]
      error?: { description: string }
    }

    if (!res.ok || data.error) {
      return NextResponse.json(
        { configured: false, fallback: 'text', error: data.error?.description ?? 'D-ID session failed' },
        { status: 200 }
      )
    }

    return NextResponse.json({
      configured: true,
      sessionId: data.id,
      sessionToken: data.session_token,
      iceServers: data.ice_servers ?? [],
    })
  } catch (err) {
    return NextResponse.json(
      { configured: false, fallback: 'text', error: String(err) },
      { status: 200 }
    )
  }
}

// GET — check if D-ID is configured
export async function GET() {
  return NextResponse.json({
    configured: !!(process.env.DID_API_KEY && process.env.DID_AGENT_ID),
    provider: 'D-ID Agents API',
    docs: 'https://docs.d-id.com/reference/agents',
  })
}
