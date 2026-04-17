import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { isPortalAuth } from '@/lib/portalAuth'

// ─── Staging Styles ────────────────────────────────────────────────────────────
const STYLE_PROMPTS: Record<string, string> = {
  moderno:      'modern contemporary interior design, clean lines, neutral tones, premium materials, polished surfaces, statement lighting, staged for sale, ultra-realistic, professional real estate photography, 8k',
  escandinavo:  'scandinavian nordic interior design, light oak furniture, bright white walls, hygge atmosphere, linen textiles, natural light, staged for sale, ultra-realistic, professional real estate photography, 8k',
  luxo:         'luxury high-end interior design, marble surfaces, brushed gold hardware, bespoke furniture, designer chandelier, rich textures, staged for sale, ultra-realistic, professional real estate photography, 8k',
  minimalista:  'minimalist zen interior design, monochromatic palette, clean empty volumes, essential furniture only, calm atmosphere, staged for sale, ultra-realistic, professional real estate photography, 8k',
  industrial:   'industrial chic interior design, exposed brick walls, raw steel elements, warm Edison bulbs, dark leather, reclaimed wood, staged for sale, ultra-realistic, professional real estate photography, 8k',
  mediterraneo: 'mediterranean interior design, terracotta tiles, warm earthy tones, arched features, handcrafted ceramics, woven textures, staged for sale, ultra-realistic, professional real estate photography, 8k',
  classico:     'classical traditional interior design, elegant furniture, rich velvet fabrics, warm walnut paneling, refined antique decor, staged for sale, ultra-realistic, professional real estate photography, 8k',
  japandi:      'japandi interior design, japanese wabi-sabi meets scandinavian functionality, natural bamboo and stone, muted warm palette, artisan ceramics, staged for sale, ultra-realistic, professional real estate photography, 8k',
}

const ROOM_BOOST: Record<string, string> = {
  sala:       ', living room, sofa, coffee table, area rug, floor lamp, art on wall',
  quarto:     ', bedroom, king bed with linen, bedside tables, dresser, soft lighting',
  cozinha:    ', kitchen, clean countertops, pendant lights, bar stools, fresh produce styling',
  casa_banho: ', bathroom, spa-like, freestanding bathtub or walk-in shower, towels, plants',
  varanda:    ', balcony terrace, outdoor furniture, planters, city or garden view',
  escritorio: ', home office, desk, ergonomic chair, shelving, focused task lighting',
  entrada:    ', entrance hall, console table, mirror, artwork, welcoming atmosphere',
  garagem:    ', garage, clean epoxy floor, organized storage, modern lighting',
}

const NEGATIVE_PROMPT = 'people, person, face, text, watermark, logo, blurry, low quality, distorted, deformed, ugly, extra rooms, changing room dimensions, changing window positions, changing door positions, changing structural walls'

// ─── Rate limit ────────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  // Purge expired entries to prevent unbounded memory growth
  for (const [key, val] of rateLimitMap) {
    if (now > val.reset) rateLimitMap.delete(key)
  }
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 3600000 })
    return true
  }
  if (entry.count >= 3) return false // 3 generations/hr — portal-only feature
  entry.count++
  return true
}

// ─── Call Stability AI Structure Control ──────────────────────────────────────
async function runStabilityStructure(params: {
  imageBuffer: Buffer
  prompt: string
  controlStrength: number
  outputFormat: 'jpeg' | 'png'
  seed?: number
}): Promise<string> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) throw new Error('STABILITY_API_KEY not configured')

  const formData = new FormData()
  const blob = new Blob([new Uint8Array(params.imageBuffer)], { type: 'image/jpeg' })
  formData.append('image', blob, 'room.jpg')
  formData.append('prompt', params.prompt)
  formData.append('control_strength', String(params.controlStrength))
  formData.append('output_format', params.outputFormat)
  if (params.seed !== undefined) formData.append('seed', String(params.seed))

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: formData,
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stability AI error ${res.status}: ${text.substring(0, 200)}`)
  }

  const json = await res.json() as { image?: string; finish_reason?: string; seed?: number }
  if (!json.image) throw new Error('No image returned from Stability AI')
  return json.image
}

// ─── POST /api/homestaging ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth guard — portal agents only
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit: 3 gerações/hora' }, { status: 429 })
    }

    const body = await req.json() as {
      image_base64: string
      style: string
      room_type: string
      variations: number
      control_strength?: number
    }

    const { image_base64, style, room_type, variations = 1, control_strength = 0.68 } = body

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 obrigatório' }, { status: 400 })
    }

    // Validate style
    const styleKey = STYLE_PROMPTS[style] ? style : 'moderno'
    const basePrompt = STYLE_PROMPTS[styleKey]
    const roomBoost = ROOM_BOOST[room_type] ?? ''
    const fullPrompt = basePrompt + roomBoost

    // Decode base64 image
    const base64Data = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Generate variations (1–3)
    const count = Math.min(Math.max(1, variations), 3)
    const seeds = Array.from({ length: count }, () => randomBytes(4).readUInt32BE(0) % 2147483647)

    const results = await Promise.allSettled(
      seeds.map((seed) =>
        runStabilityStructure({
          imageBuffer,
          prompt: fullPrompt,
          controlStrength: control_strength,
          outputFormat: 'jpeg',
          seed,
        })
      )
    )

    const images: { base64: string; seed: number }[] = []
    const errors: string[] = []

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        images.push({ base64: r.value, seed: seeds[i] })
      } else {
        errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason))
      }
    })

    if (images.length === 0) {
      return NextResponse.json({ error: errors[0] ?? 'Erro a gerar imagens' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      images,
      style: styleKey,
      room_type,
      prompt: fullPrompt,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
