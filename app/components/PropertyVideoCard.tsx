'use client'
import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropertyVideoData {
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

interface Props {
  property: PropertyVideoData
  videoUrl?: string          // pre-generated and cached URL
  showScriptPreview?: boolean
}

type Status = 'idle' | 'loading' | 'script_ready' | 'generating' | 'ready' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export function PropertyVideoCard({
  property,
  videoUrl,
  showScriptPreview = true,
}: Props) {
  const [script, setScript] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(videoUrl ?? '')
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  const [errorMsg, setErrorMsg] = useState('')

  // ── Script generation ───────────────────────────────────────────────────────

  async function generateScript() {
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/heygen/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property, lang, generateScriptOnly: true }),
      })
      const data = await res.json() as { script?: string; error?: string }
      if (data.script) {
        setScript(data.script)
        setStatus('script_ready')
      } else {
        setErrorMsg(data.error ?? 'Erro desconhecido')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Erro de ligação ao servidor.')
      setStatus('error')
    }
  }

  // ── Full video generation ───────────────────────────────────────────────────

  async function generateVideo() {
    setStatus('generating')
    setVideoId(null)
    setErrorMsg('')
    try {
      const res = await fetch('/api/heygen/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property, lang, generateScriptOnly: false }),
      })
      const data = await res.json() as {
        videoId?: string | null
        script?: string
        error?: string
        status?: string
      }

      if (data.videoId) {
        setVideoId(data.videoId)
        pollVideoStatus(data.videoId)
      } else if (data.script) {
        // Fallback: HeyGen not configured — show script only
        setScript(data.script)
        setStatus('script_ready')
      } else {
        setErrorMsg(data.error ?? 'Erro ao iniciar geração de vídeo')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Erro de ligação ao servidor.')
      setStatus('error')
    }
  }

  // ── Status polling ──────────────────────────────────────────────────────────

  function pollVideoStatus(id: string) {
    const MAX_ATTEMPTS = 30 // 30 × 10s = 5 min
    let attempts = 0

    const check = async () => {
      if (attempts >= MAX_ATTEMPTS) {
        setErrorMsg('Tempo esgotado a aguardar o vídeo. Tente novamente.')
        setStatus('error')
        return
      }
      attempts++

      try {
        const res = await fetch(`/api/heygen/video?id=${encodeURIComponent(id)}`)
        const data = await res.json() as {
          status?: string
          videoUrl?: string
          error?: string
        }

        if (data.status === 'completed' && data.videoUrl) {
          setGeneratedVideoUrl(data.videoUrl)
          setStatus('ready')
        } else if (data.status === 'failed') {
          setErrorMsg('HeyGen reportou falha na geração do vídeo.')
          setStatus('error')
        } else {
          setTimeout(check, 10_000)
        }
      } catch {
        setTimeout(check, 10_000)
      }
    }

    setTimeout(check, 15_000) // first check after 15 s
  }

  // ── Render: video ready ─────────────────────────────────────────────────────

  if (generatedVideoUrl && status !== 'generating') {
    return (
      <div className="rounded-2xl overflow-hidden border border-[#1c4a35]/20">
        <video
          src={generatedVideoUrl}
          controls
          className="w-full aspect-video bg-[#1c4a35]"
          poster="/og-imoveis.jpg"
          aria-label={`Vídeo de apresentação: ${property.title}`}
        >
          <track kind="captions" label="Português" srcLang="pt" default />
        </video>
        <div className="p-3 bg-[#f4f0e6] flex items-center gap-2">
          <span className="text-[#c9a96e] text-sm font-semibold">✦ Sofia AI</span>
          <span className="text-gray-500 text-xs">
            Vídeo gerado por IA · Agency Group AMI 22506
          </span>
        </div>
      </div>
    )
  }

  // ── Render: interactive card ────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border-2 border-dashed border-[#1c4a35]/20 p-6 text-center bg-[#f4f0e6]/50">

      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div
          className="w-10 h-10 rounded-full bg-[#1c4a35] flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="text-[#c9a96e] text-lg">✦</span>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-[#1c4a35]">Sofia AI Video</p>
          <p className="text-xs text-gray-500">Apresentação personalizada por IA</p>
        </div>
      </div>

      {/* Language selector */}
      <div className="flex justify-center gap-2 mb-4">
        {(['pt', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              lang === l
                ? 'bg-[#1c4a35] text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {l === 'pt' ? '🇵🇹 Português' : '🇬🇧 English'}
          </button>
        ))}
      </div>

      {/* ── State: idle ── */}
      {status === 'idle' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={generateScript}
            className="w-full py-3 bg-[#1c4a35] text-white rounded-xl text-sm font-semibold hover:bg-[#2d6b4f] transition-colors"
          >
            ✦ Gerar Script Sofia AI
          </button>
          <p className="text-xs text-gray-400">Prévia do guião antes de criar o vídeo</p>
        </div>
      )}

      {/* ── State: loading (Claude writing) ── */}
      {status === 'loading' && (
        <div className="py-4">
          <div
            className="w-8 h-8 border-2 border-[#1c4a35] border-t-transparent rounded-full animate-spin mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-sm text-[#1c4a35]">Sofia está a escrever o guião...</p>
        </div>
      )}

      {/* ── State: script ready ── */}
      {status === 'script_ready' && showScriptPreview && (
        <div className="space-y-4 text-left">
          <div className="bg-white rounded-xl p-4 border border-[#1c4a35]/10">
            <p className="text-xs font-bold text-[#c9a96e] mb-2 tracking-widest uppercase">
              Guião Sofia AI
            </p>
            <p className="text-sm text-gray-700 leading-relaxed italic">
              &ldquo;{script}&rdquo;
            </p>
            <p className="text-xs text-gray-400 mt-2">
              ~{Math.round(script.split(' ').length / 2.5)}s · {script.split(' ').length} palavras
            </p>
          </div>
          <button
            type="button"
            onClick={generateVideo}
            className="w-full py-3 bg-[#c9a96e] text-white rounded-xl text-sm font-bold hover:bg-[#a8843a] transition-colors"
          >
            🎬 Criar Vídeo HeyGen
          </button>
          <p className="text-xs text-gray-400 text-center">
            Requer plano HeyGen Business ($89/mês)
          </p>
        </div>
      )}

      {/* ── State: generating (HeyGen processing) ── */}
      {status === 'generating' && (
        <div className="py-4 space-y-2">
          <div
            className="w-8 h-8 border-2 border-[#c9a96e] border-t-transparent rounded-full animate-spin mx-auto"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-[#1c4a35]">A criar vídeo Sofia AI...</p>
          <p className="text-xs text-gray-400">
            2-5 minutos · videoId: {videoId ?? '...'}
          </p>
          {videoId && (
            <p className="text-xs text-[#c9a96e]">✓ Processamento HeyGen iniciado</p>
          )}
        </div>
      )}

      {/* ── State: error ── */}
      {status === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">
            {errorMsg || 'Erro ao gerar vídeo. Tente novamente.'}
          </p>
          <button
            type="button"
            onClick={() => { setStatus('idle'); setErrorMsg('') }}
            className="text-xs text-[#1c4a35] underline"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}
