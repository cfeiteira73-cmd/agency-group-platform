import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'
import { withCircuitBreaker } from '@/lib/ops/circuitBreaker'
import { withAnthropicRetry } from '@/lib/ops/withRetry'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

const client = new Anthropic()

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyData {
  title: string
  zone: string
  type: string
  price: number
  area: number
  bedrooms: number
  features: string[]
  description: string
  rentalYield?: number
}

// ─── Script generator ─────────────────────────────────────────────────────────

async function generateVideoScript(
  property: PropertyData,
  lang: 'pt' | 'en' = 'pt',
): Promise<string> {
  // withAnthropicRetry: 3 attempts + backoff; circuit breaker applied at call site
  const response = await withAnthropicRetry(() => client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    system:
      lang === 'pt'
        ? `És Sofia, a consultora de imobiliário de luxo da Agency Group (AMI 22506). \
Escreves scripts de vídeo profissionais, entusiastas e concisas para apresentação de imóveis. \
Máximo 45 segundos de fala (≈110 palavras). Tom: premium, confiante, pessoal.`
        : `You are Sofia, luxury real estate consultant at Agency Group (AMI 22506). \
Write professional, enthusiastic, concise video scripts for property presentations. \
Maximum 45 seconds of speech (≈110 words). Tone: premium, confident, personal.`,
    messages: [
      {
        role: 'user',
        content:
          lang === 'pt'
            ? `Cria um script de vídeo de 45 segundos para este imóvel:
Título: ${property.title}
Zona: ${property.zone}
Tipo: ${property.type}
Preço: €${property.price.toLocaleString('pt-PT')}
Área: ${property.area}m²
Quartos: ${property.bedrooms}
Features: ${property.features.join(', ')}
Descrição: ${property.description}
${property.rentalYield ? `Yield: ${property.rentalYield}%` : ''}

O script deve: apresentar o imóvel com entusiasmo, destacar 2-3 pontos únicos, \
mencionar a zona/localização, terminar com CTA para Agency Group.`
            : `Create a 45-second video script for this property:
Title: ${property.title}
Zone: ${property.zone}
Type: ${property.type}
Price: €${property.price.toLocaleString('en-GB')}
Area: ${property.area}m²
Bedrooms: ${property.bedrooms}
Features: ${property.features.join(', ')}
Description: ${property.description}
${property.rentalYield ? `Yield: ${property.rentalYield}%` : ''}

Script should: introduce enthusiastically, highlight 2-3 unique points, \
mention location, end with Agency Group CTA.`,
      },
    ],
  }))  // closes client.messages.create({}) and withAnthropicRetry(() => ...)

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─── HeyGen video creation ────────────────────────────────────────────────────

async function createHeyGenVideo(
  script: string,
  avatarId: string,
  voiceId: string,
): Promise<{ videoId: string; status: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HEYGEN_API_KEY not configured')

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: voiceId,
            speed: 1.0,
          },
          background: {
            type: 'color',
            value: '#1c4a35',
          },
        },
      ],
      dimension: { width: 1280, height: 720 },
      aspect_ratio: '16:9',
      test: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HeyGen API error: ${response.status} — ${err}`)
  }

  const data = await response.json() as { data?: { video_id?: string; status?: string } }
  return {
    videoId: data.data?.video_id ?? '',
    status: data.data?.status ?? 'pending',
  }
}

// ─── Video status poll ────────────────────────────────────────────────────────

async function getVideoStatus(videoId: string): Promise<{
  status: string
  videoUrl?: string
  thumbnailUrl?: string
}> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HEYGEN_API_KEY not configured')

  const response = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(10_000),
    },
  )

  if (!response.ok) throw new Error(`HeyGen status error: ${response.status}`)

  const data = await response.json() as {
    data?: { status?: string; video_url?: string; thumbnail_url?: string }
  }
  return {
    status: data.data?.status ?? 'unknown',
    videoUrl: data.data?.video_url,
    thumbnailUrl: data.data?.thumbnail_url,
  }
}

// ─── POST /api/heygen/video ───────────────────────────────────────────────────
// Body: { property: PropertyData, lang?: 'pt' | 'en', generateScriptOnly?: boolean }

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      property?: PropertyData
      lang?: 'pt' | 'en'
      generateScriptOnly?: boolean
    }
    const { property, lang = 'pt', generateScriptOnly = false } = body

    if (!property) {
      return NextResponse.json({ error: 'Property data required' }, { status: 400 })
    }

    // Step 1 — generate AI script with Claude Opus (circuit-breaker guarded)
    const script = await withCircuitBreaker<string | null>(
      'anthropic-vision',
      () => generateVideoScript(property, lang),
      null,  // fallback: circuit OPEN → 503 below
    )

    if (script === null) {
      return NextResponse.json(
        { error: 'Script generation temporarily unavailable. Please try again shortly.' },
        { status: 503, headers: { 'Retry-After': '60' } },
      )
    }

    const heyGenKey = process.env.HEYGEN_API_KEY
    const avatarId  = process.env.HEYGEN_AVATAR_ID ?? 'default'
    const voiceId   = process.env.HEYGEN_VOICE_ID  ?? 'pt-PT-FernandaNeural'
    const wordCount = script.split(' ').length
    const estimatedDuration = `~${Math.round(wordCount / 2.5)} seconds`

    // Script-only mode (or HeyGen not yet configured)
    if (generateScriptOnly || !heyGenKey) {
      return NextResponse.json({
        script,
        videoId: null,
        status: 'script_only',
        message: heyGenKey
          ? 'Script generated. Set generateScriptOnly: false to create video.'
          : 'HeyGen not configured. Set HEYGEN_API_KEY in environment variables.',
        wordCount,
        estimatedDuration,
      })
    }

    // Step 2 — create HeyGen video (circuit-breaker guarded)
    const videoResult = await withCircuitBreaker<{ videoId: string; status: string } | null>(
      'heygen-api',
      () => createHeyGenVideo(script, avatarId, voiceId),
      null,  // fallback: HeyGen circuit OPEN → 503 below
    )

    if (videoResult === null) {
      // Script was generated — return it so caller can retry video creation later
      return NextResponse.json(
        {
          script,
          videoId: null,
          status: 'service_unavailable',
          error: 'HeyGen service temporarily unavailable. Script is available; retry video creation shortly.',
          wordCount,
          estimatedDuration,
        },
        { status: 503, headers: { 'Retry-After': '60' } },
      )
    }

    return NextResponse.json({
      script,
      videoId:           videoResult.videoId,
      status:            videoResult.status,
      message:           'Video generation started. Poll /api/heygen/video?id=[videoId] for status.',
      estimatedTime:     '2-5 minutes',
      wordCount,
      estimatedDuration,
    })
  } catch (error) {
    console.error('[heygen/video POST]', error, { corrId })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 },
    )
  }
}

// ─── GET /api/heygen/video?id=xxx ─────────────────────────────────────────────
// Polls HeyGen for completion status of a previously created video.

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const videoId = new URL(req.url).searchParams.get('id')
  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 })
  }

  try {
    const statusResult = await withCircuitBreaker<
      { status: string; videoUrl?: string; thumbnailUrl?: string } | null
    >(
      'heygen-api',
      () => getVideoStatus(videoId),
      null,
    )
    if (statusResult === null) {
      return NextResponse.json(
        { error: 'HeyGen status check temporarily unavailable.' },
        { status: 503, headers: { 'Retry-After': '60' } },
      )
    }
    return NextResponse.json(statusResult)
  } catch (error) {
    console.error('[heygen/video GET]', error, { corrId })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 },
    )
  }
}
