import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// Strip markdown so HeyGen TTS reads it cleanly
function cleanScript(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/—/g, ',')
    .replace(/\|.*?\|/g, '')
    .replace(/[-]{3,}/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4800)
}

const FORMAT_DIM: Record<string, { width: number; height: number }> = {
  reel:     { width: 1080, height: 1920 },
  youtube:  { width: 1920, height: 1080 },
  linkedin: { width: 1080, height: 1080 },
  whatsapp: { width: 720,  height: 1280 },
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'HEYGEN_API_KEY not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json() as {
    script: string; format?: string; avatarId?: string; voiceId?: string; testMode?: boolean
  }

  if (!body.script?.trim()) {
    return new Response(JSON.stringify({ error: 'Script required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const script    = cleanScript(body.script)
  const dimension = FORMAT_DIM[body.format ?? 'reel'] ?? FORMAT_DIM.reel
  const avatarId  = body.avatarId || process.env.HEYGEN_AVATAR_ID || 'Abigail_expressive_2024112501'
  const voiceId   = body.voiceId  || process.env.HEYGEN_VOICE_ID  || '2d5b0e6cf36f460aa7fc47e3eee4ba54'
  const testMode  = body.testMode ?? false

  const encoder = new TextEncoder()
  const send = (ctrl: ReadableStreamDefaultController, data: object) =>
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { status: 'submitting', message: 'A enviar para HeyGen...' })

        // 1. Submit to HeyGen v2
        const submitRes = await fetch('https://api.heygen.com/v2/video/generate', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Agency Group — Sofia AI',
            test: testMode,
            dimension,
            video_inputs: [{
              character: {
                type: 'avatar',
                avatar_id: avatarId,
                avatar_style: 'normal',
                talking_style: 'expressive',
                expression: 'happy',
              },
              voice: {
                type: 'text',
                voice_id: voiceId,
                input_text: script,
                speed: 1.0,
                emotion: 'Friendly',
              },
              background: { type: 'color', value: '#F5F0E8' },
            }],
          }),
        })

        const submitJson = await submitRes.json() as {
          error?: { message: string }
          data?: { video_id: string }
        }

        if (submitJson.error || !submitJson.data?.video_id) {
          send(controller, {
            status: 'error',
            message: submitJson.error?.message ?? 'HeyGen: submissão falhou',
          })
          return
        }

        const videoId = submitJson.data.video_id
        send(controller, { status: 'queued', videoId, message: 'Na fila de renderização...' })

        // 2. Poll until done (max 5 min)
        const MAX = 60
        for (let i = 0; i < MAX; i++) {
          await new Promise(r => setTimeout(r, 5000))

          const pollRes = await fetch(
            `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
            { headers: { 'x-api-key': apiKey } }
          )
          const pollJson = await pollRes.json() as {
            data?: { status: string; video_url?: string; thumbnail_url?: string; duration?: number }
          }
          const d = pollJson.data
          if (!d) continue

          if (d.status === 'completed' && d.video_url) {
            send(controller, {
              status: 'completed',
              videoId,
              videoUrl: d.video_url,
              thumbnailUrl: d.thumbnail_url ?? '',
              duration: d.duration ?? 0,
              message: '✅ Vídeo pronto!',
            })
            return
          }

          if (d.status === 'failed') {
            send(controller, { status: 'error', message: 'HeyGen: render falhou. Tenta novamente.' })
            return
          }

          const progress = Math.min(Math.round(((i + 1) / MAX) * 90), 90)
          send(controller, {
            status: d.status === 'processing' ? 'processing' : 'queued',
            videoId,
            progress,
            message: d.status === 'processing'
              ? `A renderizar vídeo... ${progress}%`
              : 'Na fila — a aguardar...',
          })
        }

        send(controller, { status: 'error', message: 'Timeout após 5 minutos. Tenta novamente.' })

      } catch (err) {
        send(controller, {
          status: 'error',
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
