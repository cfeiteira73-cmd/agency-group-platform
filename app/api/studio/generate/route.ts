// =============================================================================
// AGENCY GROUP — Sofia Video Studio Generate API v1.0
// POST /api/studio/generate — multi-action streaming content generation
// Script · Hooks · Social Captions · Shot List · All powered by Claude
// =============================================================================

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

const client = new Anthropic()

// ─── Persona instructions ─────────────────────────────────────────────────────

const PERSONA: Record<string, string> = {
  generic:    'Write for an international premium buyer. Balance lifestyle and investment.',
  american:   'American buyer (16% of AG buyers). Emphasise: ROI, sq ft value vs NYC/Miami, IFICI tax 20% flat, safety, sunshine. Numbers-driven and confident.',
  french:     'French buyer (13% of AG buyers). Emphasise: art de vivre, NHR regime, cultural proximity, gastronomy, climate upgrade from Paris. Sophisticated and emotional.',
  british:    'British buyer (9% of AG buyers). Emphasise: post-Brexit EU residency via investment, climate, lifestyle upgrade from London, value per m². Practical + aspirational.',
  chinese:    'Chinese buyer (8% of AG buyers). Emphasise: capital preservation, prestigious address, privacy, scarcity, appreciation potential, European base. Prestige + security.',
  brazilian:  'Brazilian buyer (6% of AG buyers). Emphasise: cultural connection, Portuguese language, European base, NHR, safety, modern infrastructure. Warm and relational.',
  middleeast: 'Middle East buyer. Emphasise: privacy, large family spaces, Halal-friendly environment, investment security, European residency. Formal, prestigious, family-oriented.',
}

const FORMAT: Record<string, string> = {
  reel:      '60s max · ~150 words · 9:16 vertical · hook in 3s · Instagram/TikTok/Reels',
  youtube:   '90s max · ~225 words · 16:9 horizontal · detailed · YouTube/website',
  linkedin:  '45s max · ~110 words · professional tone · LinkedIn/business',
  whatsapp:  '30s max · ~75 words · conversational · WhatsApp status/story',
}

const LANG_NAME: Record<string, string> = {
  PT: 'Português (Portugal)',
  EN: 'English',
  FR: 'Français',
  AR: 'العربية',
  ZH: '中文 (Mandarin)',
  DE: 'Deutsch',
}

// ─── POST /api/studio/generate ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      property: {
        title: string; zone: string; type: string
        price: number; area: number; bedrooms: number
        features: string[]; description: string; rentalYield?: number
      }
      lang?: string
      persona?: string
      format?: string
    }

    const { property, lang = 'PT', persona = 'generic', format = 'reel' } = body
    if (!property?.title) {
      return new Response(JSON.stringify({ error: 'Property data required' }), { status: 400 })
    }

    const langName    = LANG_NAME[lang]    ?? lang
    const personaCtx  = PERSONA[persona]   ?? PERSONA.generic
    const formatCtx   = FORMAT[format]     ?? FORMAT.reel
    const priceStr    = `€${property.price.toLocaleString('pt-PT')}`
    const pricePerM2  = `€${Math.round(property.price / property.area).toLocaleString('pt-PT')}/m²`

    const propertyCtx = `
Property: ${property.title}
Zone: ${property.zone}, Portugal
Type: ${property.type} | T${property.bedrooms}
Price: ${priceStr} (${pricePerM2})
Area: ${property.area}m²
Features: ${property.features?.join(', ') || 'premium finishes'}
Description: ${property.description}
${property.rentalYield ? `Rental Yield: ${property.rentalYield}% gross` : ''}
`.trim()

    const marketCtx = `
AG Market Context 2026: Lisboa €5.000/m² · Cascais €4.713 · Algarve €3.941 · Porto €3.643 · Madeira €3.760
+17.6% YoY · 169.812 transactions · Luxury Lisboa Top 5 global (Savills)
Agency Group: AMI 22506 · 5% commission · agencygroup.pt
`.trim()

    const system = `You are Sofia, world-class luxury real estate content creator at Agency Group (AMI 22506), Portugal.
You create premium multilingual content for luxury properties €500K–€10M.
Target buyer: ${personaCtx}
Video format: ${formatCtx}
Output language: ${langName}
Always end with Agency Group CTA (agencygroup.pt or AMI 22506).`

    const encoder = new TextEncoder()
    const send = (readable_controller: ReadableStreamDefaultController, action: string, text: string) => {
      readable_controller.enqueue(encoder.encode(`data: ${JSON.stringify({ action, text })}\n\n`))
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // ─── 1. VIDEO SCRIPT ─────────────────────────────────────────────────
          send(controller, 'status', 'script')

          const scriptStream = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 700,
            stream: true,
            system,
            messages: [{
              role: 'user',
              content: `Write a premium video script for the Sofia presenter to read.

${propertyCtx}

${marketCtx}

Requirements:
— Format: ${formatCtx}
— Language: ${langName}
— Open with a powerful, specific hook (not generic)
— Highlight exactly 2-3 unique selling points of this property
— Include a concrete location detail or lifestyle benefit
— Include market context if relevant (price/m² comparison, yield, appreciation)
— End with clear CTA: Agency Group, agencygroup.pt, AMI 22506
— Teleprompter-ready: no stage directions, just the spoken words
— Tone: premium, confident, personal — NOT corporate or stiff`
            }]
          })

          for await (const chunk of scriptStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              send(controller, 'script', chunk.delta.text)
            }
          }
          send(controller, 'script_done', '')

          // ─── 2. OPENING HOOKS ────────────────────────────────────────────────
          send(controller, 'status', 'hooks')

          const hooksStream = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 600,
            stream: true,
            system,
            messages: [{
              role: 'user',
              content: `Create 5 opening video hooks for this property. Language: ${langName}.

${propertyCtx}

Each hook: 1-2 sentences max. Designed for the FIRST 3 SECONDS of the video.
Must stop the scroll immediately.

Generate exactly these 5 angles:
1. CURIOSIDADE — makes viewer desperately want to know more
2. ASPIRAÇÃO — paints the dream so vividly they can feel it
3. AUTORIDADE — specific market data or investment fact that commands attention
4. HISTÓRIA — micro-narrative that creates instant emotional connection
5. CHOQUE — unexpected comparison, statistic or contrast that disrupts

Format:
**[ANGLE NAME]**
"Hook text here"

No explanations. Just the 5 hooks.`
            }]
          })

          for await (const chunk of hooksStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              send(controller, 'hooks', chunk.delta.text)
            }
          }
          send(controller, 'hooks_done', '')

          // ─── 3. SOCIAL CAPTIONS ──────────────────────────────────────────────
          send(controller, 'status', 'captions')

          const captionsStream = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 700,
            stream: true,
            system,
            messages: [{
              role: 'user',
              content: `Create platform-optimised social captions for this property. Language: ${langName}.

${propertyCtx}

Generate for all 4 platforms:

**INSTAGRAM REEL**
Caption (max 150 chars) + line break + 8 hashtags (mix PT/EN, niche + broad)

**LINKEDIN**
Professional caption (max 220 chars). Investment angle. No hashtags.

**YOUTUBE**
Title (max 60 chars, SEO-optimised) + Description (max 180 chars with keywords)

**WHATSAPP**
Short conversational message (max 100 chars) for sending to leads. Informal, urgent.

Each must include Agency Group mention and how to contact.`
            }]
          })

          for await (const chunk of captionsStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              send(controller, 'captions', chunk.delta.text)
            }
          }
          send(controller, 'captions_done', '')

          // ─── 4. SHOT LIST ────────────────────────────────────────────────────
          send(controller, 'status', 'shotlist')

          const shotStream = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 500,
            stream: true,
            system,
            messages: [{
              role: 'user',
              content: `Create a professional cinematic shot list for this property video. Language: ${langName}.

${propertyCtx}

Format: ${formatCtx}

Generate:
— 8 shots numbered, with type · subject · movement · duration
  Types: Aerial Drone · Exterior Wide · Walkthrough · Detail · Lifestyle · Aerial Static · Close-up · Hero Shot
  Movements: Push in · Pull out · Pan · Dolly · Static · Crane up · Gimbal walk

— Music mood (1 sentence: genre + tempo + feel)
— Lighting note (golden hour? midday? artificial?)
— 1 AI tool recommendation for each: Runway ML image-to-video for exteriors, D-ID for avatar narration

Format clearly with headers. Make it feel like a real production brief from a top agency.`
            }]
          })

          for await (const chunk of shotStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              send(controller, 'shotlist', chunk.delta.text)
            }
          }
          send(controller, 'shotlist_done', '')

        } catch (err) {
          send(controller, 'error', err instanceof Error ? err.message : 'Generation error')
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    })

  } catch {
    return new Response(JSON.stringify({ error: 'Failed to start generation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
