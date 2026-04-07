'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

// =============================================================================
// SOFIA VIDEO STUDIO — World-Class AI Production Suite
// 4 AI agents · 6 languages · 7 buyer personas · 4 video formats
// Script · Hooks · Social Captions · Shot List — all streaming via claude-sonnet-4-6
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────
type Lang        = 'PT' | 'EN' | 'FR' | 'AR' | 'ZH' | 'DE'
type Persona     = 'generic' | 'american' | 'french' | 'british' | 'chinese' | 'brazilian' | 'middleeast'
type VideoFormat = 'reel' | 'youtube' | 'linkedin' | 'whatsapp'
type ContentTab  = 'script' | 'hooks' | 'captions' | 'shotlist'
type GenStatus   = 'idle' | 'script' | 'hooks' | 'captions' | 'shotlist' | 'done' | 'error'

interface Property {
  title: string; zone: string; type: string
  price: number; area: number; bedrooms: number
  features: string[]; description: string; rentalYield?: number
}

// ─── Demo Properties ──────────────────────────────────────────────────────────
const DEMO_PROPERTIES: Property[] = [
  {
    title: 'Penthouse Chiado',
    zone: 'Lisboa', type: 'Apartamento',
    price: 1_850_000, area: 180, bedrooms: 3,
    features: ['terraço privado', 'vista Tejo', 'garagem dupla', 'porteiro 24h', 'acabamentos Porcelanosa'],
    description: 'Penthouse de excepção no coração histórico do Chiado. Tecto duplo, varanda panorâmica e cozinha Boffi. O melhor endereço de Lisboa.',
    rentalYield: 4.2,
  },
  {
    title: 'Villa Cascais Golf',
    zone: 'Cascais', type: 'Moradia',
    price: 3_200_000, area: 350, bedrooms: 5,
    features: ['piscina aquecida', 'jardim 1.200m²', 'golf resort Oitavos', 'domótica KNX', 'garagem tripla'],
    description: 'Villa de arquitecto em condomínio golf premium. 5 suites, SPA, cozinha Bulthaup. A 30 min de Lisboa, entre serra e mar.',
    rentalYield: 3.8,
  },
  {
    title: 'Penthouse Funchal',
    zone: 'Madeira', type: 'Apartamento',
    price: 1_200_000, area: 210, bedrooms: 3,
    features: ['terraço 80m²', 'vista oceano 270°', 'IFICI elegível', 'spa privado', 'concierge'],
    description: 'Penthouse de luxo no Funchal. Vista atlântica sem limites, IFICI 20% flat tax disponível. O investimento da década.',
    rentalYield: 5.0,
  },
  {
    title: 'Quinta Comporta',
    zone: 'Comporta', type: 'Moradia',
    price: 2_750_000, area: 420, bedrooms: 5,
    features: ['piscina infinita', 'arrozais 2ha', 'arquitecto premiado', 'natureza preservada', 'praia privada'],
    description: 'Quinta exclusiva na Comporta. Arquitectura tipológica entre arrozais e oceano. A jóia do imobiliário europeu.',
    rentalYield: 4.8,
  },
]

// ─── Config ───────────────────────────────────────────────────────────────────
const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'PT', label: 'Português', flag: '🇵🇹' },
  { code: 'EN', label: 'English',   flag: '🇺🇸' },
  { code: 'FR', label: 'Français',  flag: '🇫🇷' },
  { code: 'AR', label: 'العربية',   flag: '🇸🇦' },
  { code: 'ZH', label: '中文',      flag: '🇨🇳' },
  { code: 'DE', label: 'Deutsch',   flag: '🇩🇪' },
]

const PERSONAS: { code: Persona; label: string; flag: string; share: string }[] = [
  { code: 'generic',    label: 'Premium',       flag: '🌍', share: '' },
  { code: 'american',   label: 'Americano',     flag: '🇺🇸', share: '16%' },
  { code: 'french',     label: 'Francês',       flag: '🇫🇷', share: '13%' },
  { code: 'british',    label: 'Britânico',     flag: '🇬🇧', share: '9%' },
  { code: 'chinese',    label: 'Chinês',        flag: '🇨🇳', share: '8%' },
  { code: 'brazilian',  label: 'Brasileiro',    flag: '🇧🇷', share: '6%' },
  { code: 'middleeast', label: 'Médio Oriente', flag: '🇦🇪', share: '' },
]

const FORMATS: { code: VideoFormat; label: string; icon: string; desc: string }[] = [
  { code: 'reel',     label: 'Reel',     icon: '📱', desc: '60s · 9:16 · IG/TikTok' },
  { code: 'youtube',  label: 'YouTube',  icon: '▶️', desc: '90s · 16:9 · HD'         },
  { code: 'linkedin', label: 'LinkedIn', icon: '💼', desc: '45s · Professional'       },
  { code: 'whatsapp', label: 'WhatsApp', icon: '💬', desc: '30s · Conversational'     },
]

const CONTENT_TABS: { code: ContentTab; label: string; icon: string }[] = [
  { code: 'script',   label: 'Script',    icon: '📝' },
  { code: 'hooks',    label: 'Hooks',     icon: '🎣' },
  { code: 'captions', label: 'Social',    icon: '📲' },
  { code: 'shotlist', label: 'Shot List', icon: '🎬' },
]

const GEN_STEPS: { status: GenStatus; label: string }[] = [
  { status: 'script',   label: 'Guião'     },
  { status: 'hooks',    label: 'Hooks'     },
  { status: 'captions', label: 'Social'    },
  { status: 'shotlist', label: 'Shot List' },
]

const STEP_IDX: Record<GenStatus, number> = {
  idle: -1, script: 0, hooks: 1, captions: 2, shotlist: 3, done: 4, error: -1,
}

const STATUS_MSG: Partial<Record<GenStatus, string>> = {
  script:   '✍️ Sofia a escrever o guião teleprompter...',
  hooks:    '🎣 Criando 5 hooks para parar o scroll...',
  captions: '📲 Optimizando captions para 4 plataformas...',
  shotlist: '🎬 Elaborando shot list cinematográfica...',
  done:     '✅ Conteúdo gerado com sucesso!',
  error:    '❌ Erro na geração',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PortalVideoStudio() {
  // Property state
  const [propIdx,     setPropIdx]     = useState(0)
  const [isCustom,    setIsCustom]    = useState(false)
  const [cTitle,      setCTitle]      = useState('')
  const [cZone,       setCZone]       = useState('')
  const [cType,       setCType]       = useState('Apartamento')
  const [cPrice,      setCPrice]      = useState('')
  const [cArea,       setCArea]       = useState('')
  const [cBeds,       setCBeds]       = useState('3')
  const [cFeats,      setCFeats]      = useState('')
  const [cDesc,       setCDesc]       = useState('')
  const [cYield,      setCYield]      = useState('')

  // Studio settings
  const [lang,        setLang]        = useState<Lang>('PT')
  const [persona,     setPersona]     = useState<Persona>('generic')
  const [format,      setFormat]      = useState<VideoFormat>('reel')

  // Generation state
  const [generating,  setGenerating]  = useState(false)
  const [genStatus,   setGenStatus]   = useState<GenStatus>('idle')
  const [activeTab,   setActiveTab]   = useState<ContentTab>('script')
  const [script,      setScript]      = useState('')
  const [hooks,       setHooks]       = useState('')
  const [captions,    setCaptions]    = useState('')
  const [shotlist,    setShotlist]    = useState('')
  const [errorMsg,    setErrorMsg]    = useState('')
  const [copiedTab,   setCopiedTab]   = useState<ContentTab | null>(null)

  // Teleprompter state
  const [tpOpen,      setTpOpen]      = useState(false)
  const [tpScrolling, setTpScrolling] = useState(false)
  const [tpSpeed,     setTpSpeed]     = useState(2)
  const [tpFontSize,  setTpFontSize]  = useState(38)

  // Refs
  const abortRef  = useRef<AbortController | null>(null)
  const tpRef     = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-clear done status after 4s
  useEffect(() => {
    if (genStatus === 'done') {
      const t = setTimeout(() => setGenStatus('idle'), 4000)
      return () => clearTimeout(t)
    }
  }, [genStatus])

  // Teleprompter auto-scroll
  useEffect(() => {
    if (scrollRef.current) clearInterval(scrollRef.current)
    if (!tpScrolling || !tpRef.current) return
    const speeds = [0.3, 0.7, 1.3, 2.2, 3.5]
    const px = speeds[Math.min(tpSpeed - 1, 4)]
    scrollRef.current = setInterval(() => {
      if (!tpRef.current) return
      tpRef.current.scrollTop += px
      if (tpRef.current.scrollTop >= tpRef.current.scrollHeight - tpRef.current.clientHeight - 2) {
        setTpScrolling(false)
      }
    }, 16)
    return () => { if (scrollRef.current) clearInterval(scrollRef.current) }
  }, [tpScrolling, tpSpeed])

  // Copy handler
  const copyContent = useCallback(async (tab: ContentTab) => {
    const content = { script, hooks, captions, shotlist }[tab]
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopiedTab(tab)
      setTimeout(() => setCopiedTab(null), 2000)
    } catch {}
  }, [script, hooks, captions, shotlist])

  // Build property object
  const getProperty = useCallback((): Property | null => {
    if (isCustom) {
      const price = Number(cPrice.replace(/[^\d]/g, ''))
      const area  = Number(cArea)
      if (!cTitle || !cZone || !price || !area) return null
      return {
        title: cTitle, zone: cZone, type: cType || 'Apartamento',
        price, area, bedrooms: Number(cBeds) || 3,
        features: cFeats.split(',').map(f => f.trim()).filter(Boolean),
        description: cDesc || `${cTitle} — imóvel premium em ${cZone}`,
        rentalYield: cYield ? Number(cYield) : undefined,
      }
    }
    return DEMO_PROPERTIES[propIdx]
  }, [isCustom, cTitle, cZone, cType, cPrice, cArea, cBeds, cFeats, cDesc, cYield, propIdx])

  // Generate
  const generate = useCallback(async () => {
    const property = getProperty()
    if (!property || generating) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setGenerating(true)
    setGenStatus('script')
    setScript(''); setHooks(''); setCaptions(''); setShotlist('')
    setErrorMsg('')
    setActiveTab('script')

    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ property, lang, persona, format }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { setGenStatus('done'); continue }
          try {
            const { action, text } = JSON.parse(raw) as { action: string; text: string }
            switch (action) {
              case 'status':
                setGenStatus(text as GenStatus)
                if (text === 'hooks')    setActiveTab('hooks')
                if (text === 'captions') setActiveTab('captions')
                if (text === 'shotlist') setActiveTab('shotlist')
                break
              case 'script':   setScript(p   => p + text); break
              case 'hooks':    setHooks(p     => p + text); break
              case 'captions': setCaptions(p  => p + text); break
              case 'shotlist': setShotlist(p  => p + text); break
              case 'error':    setGenStatus('error'); setErrorMsg(text); break
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGenStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido')
      }
    } finally {
      setGenerating(false)
    }
  }, [getProperty, generating, lang, persona, format])

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort()
    setGenerating(false)
    setGenStatus('idle')
  }, [])

  // Derived
  const property       = getProperty()
  const stepIdx        = STEP_IDX[genStatus]
  const hasContent     = !!(script || hooks || captions || shotlist)
  const activeContent  = { script, hooks, captions, shotlist }[activeTab]
  const showStatusBar  = generating || genStatus === 'done' || genStatus === 'error'

  // ─── Custom form validation ──────────────────────────────────────────────
  const customValid = isCustom ? !!(cTitle && cZone && cPrice && cArea) : true

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <section aria-label="Sofia Video Studio" className="space-y-5">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-[#1c4a35] flex items-center gap-2">
              <span aria-hidden="true">🎬</span> Sofia Video Studio
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              World-class AI production · Script · Hooks · Social · Shot List
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-[#1c4a35]/10 text-[#1c4a35] text-xs font-bold px-3 py-1.5 rounded-full border border-[#1c4a35]/20">
              ⚡ claude-sonnet-4-6
            </span>
            <span className="bg-[#c9a96e]/10 text-[#c9a96e] text-xs font-bold px-3 py-1.5 rounded-full border border-[#c9a96e]/30">
              4 AI Agents
            </span>
            <span className="bg-purple-500/10 text-purple-600 text-xs font-bold px-3 py-1.5 rounded-full border border-purple-500/20">
              6 Idiomas · 7 Personas
            </span>
          </div>
        </div>

        {/* ── STUDIO GRID ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* ══════════════════════════════════════════════════════════════════
              LEFT PANEL — Production Settings
          ══════════════════════════════════════════════════════════════════ */}
          <div
            className="flex-shrink-0 w-full lg:w-[380px] rounded-2xl border space-y-5 p-5"
            style={{ background: '#0d1f17', borderColor: 'rgba(28,74,53,0.4)' }}
          >

            {/* ── 01 · PROPERTY ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span style={{ color: '#c9a96e' }} className="text-xs font-bold uppercase tracking-widest">
                  01 · Imóvel
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustom(v => !v)}
                  className="text-xs px-2 py-1 rounded-md border transition-colors"
                  style={{
                    borderColor: isCustom ? '#c9a96e' : 'rgba(201,169,110,0.3)',
                    color: isCustom ? '#c9a96e' : 'rgba(201,169,110,0.5)',
                    background: isCustom ? 'rgba(201,169,110,0.1)' : 'transparent',
                  }}
                >
                  {isCustom ? '← Demo' : '+ Personalizado'}
                </button>
              </div>

              {!isCustom ? (
                <>
                  {/* Demo property tabs */}
                  <div className="flex flex-col gap-1.5">
                    {DEMO_PROPERTIES.map((p, i) => (
                      <button
                        key={p.title}
                        type="button"
                        onClick={() => setPropIdx(i)}
                        className="w-full text-left px-3 py-2.5 rounded-xl transition-all border text-sm"
                        style={{
                          background: propIdx === i ? 'rgba(28,74,53,0.6)' : 'rgba(28,74,53,0.15)',
                          borderColor: propIdx === i ? 'rgba(201,169,110,0.5)' : 'rgba(28,74,53,0.3)',
                          color: propIdx === i ? '#fff' : 'rgba(255,255,255,0.55)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{p.title}</span>
                          <span style={{ color: '#c9a96e' }} className="text-xs font-bold">
                            €{(p.price / 1_000_000).toFixed(2).replace('.', ',')}M
                          </span>
                        </div>
                        <div className="text-xs mt-0.5 opacity-60">
                          {p.zone} · {p.area}m² · T{p.bedrooms}
                          {p.rentalYield ? ` · ${p.rentalYield}% yield` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* Custom property form */
                <div className="space-y-2.5">
                  {[
                    { label: 'Título', value: cTitle, set: setCTitle, placeholder: 'Ex: Penthouse Avenida da Liberdade' },
                    { label: 'Zona',   value: cZone,  set: setCZone,  placeholder: 'Ex: Lisboa, Cascais, Porto' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.label} *</label>
                      <input
                        type="text"
                        value={f.value}
                        onChange={e => f.set(e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full rounded-lg px-3 py-2 text-sm border outline-none transition"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          borderColor: 'rgba(28,74,53,0.4)',
                          color: '#fff',
                        }}
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Tipo</label>
                      <select
                        value={cType} onChange={e => setCType(e.target.value)}
                        className="w-full rounded-lg px-2 py-2 text-sm border outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                      >
                        {['Apartamento','Moradia','Penthouse','Estúdio','Quinta','Townhouse','Villa'].map(t => (
                          <option key={t} value={t} style={{ background: '#0d1f17' }}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Quartos</label>
                      <input
                        type="number" min="0" max="20"
                        value={cBeds} onChange={e => setCBeds(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Preço (€) *</label>
                      <input
                        type="text" value={cPrice} onChange={e => setCPrice(e.target.value)}
                        placeholder="1850000"
                        className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Área (m²) *</label>
                      <input
                        type="number" value={cArea} onChange={e => setCArea(e.target.value)}
                        placeholder="180"
                        className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Features <span className="opacity-50">(vírgula)</span>
                    </label>
                    <input
                      type="text" value={cFeats} onChange={e => setCFeats(e.target.value)}
                      placeholder="piscina, terraço, garagem, vista mar"
                      className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Descrição</label>
                    <textarea
                      value={cDesc} onChange={e => setCDesc(e.target.value)}
                      placeholder="Breve descrição premium do imóvel..."
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Yield Estimado (%) <span className="opacity-50">opcional</span>
                    </label>
                    <input
                      type="number" step="0.1" min="0" max="20"
                      value={cYield} onChange={e => setCYield(e.target.value)}
                      placeholder="4.5"
                      className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(28,74,53,0.4)', color: '#fff' }}
                    />
                  </div>
                  {isCustom && !customValid && (
                    <p className="text-xs" style={{ color: 'rgba(201,169,110,0.7)' }}>
                      * Título, Zona, Preço e Área são obrigatórios
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(28,74,53,0.3)' }} />

            {/* ── 02 · BUYER PERSONA ── */}
            <div>
              <span style={{ color: '#c9a96e' }} className="text-xs font-bold uppercase tracking-widest block mb-3">
                02 · Comprador Alvo
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {PERSONAS.map(p => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setPersona(p.code)}
                    title={p.label}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl border transition-all"
                    style={{
                      background: persona === p.code ? 'rgba(201,169,110,0.15)' : 'rgba(28,74,53,0.15)',
                      borderColor: persona === p.code ? 'rgba(201,169,110,0.6)' : 'rgba(28,74,53,0.3)',
                    }}
                  >
                    <span className="text-lg leading-none">{p.flag}</span>
                    <span className="text-[9px] font-medium leading-tight text-center" style={{ color: persona === p.code ? '#c9a96e' : 'rgba(255,255,255,0.45)' }}>
                      {p.label.split(' ')[0]}
                    </span>
                    {p.share && (
                      <span className="text-[8px] font-bold" style={{ color: persona === p.code ? '#c9a96e' : 'rgba(201,169,110,0.4)' }}>
                        {p.share}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(28,74,53,0.3)' }} />

            {/* ── 03 · LANGUAGE ── */}
            <div>
              <span style={{ color: '#c9a96e' }} className="text-xs font-bold uppercase tracking-widest block mb-3">
                03 · Idioma do Vídeo
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm"
                    style={{
                      background: lang === l.code ? 'rgba(201,169,110,0.15)' : 'rgba(28,74,53,0.15)',
                      borderColor: lang === l.code ? 'rgba(201,169,110,0.6)' : 'rgba(28,74,53,0.3)',
                      color: lang === l.code ? '#c9a96e' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span className="text-xs font-medium">{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(28,74,53,0.3)' }} />

            {/* ── 04 · FORMAT ── */}
            <div>
              <span style={{ color: '#c9a96e' }} className="text-xs font-bold uppercase tracking-widest block mb-3">
                04 · Formato do Vídeo
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => setFormat(f.code)}
                    className="text-left px-3 py-2.5 rounded-xl border transition-all"
                    style={{
                      background: format === f.code ? 'rgba(201,169,110,0.12)' : 'rgba(28,74,53,0.15)',
                      borderColor: format === f.code ? 'rgba(201,169,110,0.6)' : 'rgba(28,74,53,0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">{f.icon}</span>
                      <span className="text-sm font-bold" style={{ color: format === f.code ? '#c9a96e' : '#fff' }}>
                        {f.label}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(28,74,53,0.3)' }} />

            {/* ── GENERATE BUTTON ── */}
            {!generating ? (
              <button
                type="button"
                onClick={generate}
                disabled={!property || !customValid}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: (!property || !customValid)
                    ? 'rgba(201,169,110,0.2)'
                    : 'linear-gradient(135deg, #c9a96e 0%, #e0c08a 50%, #c9a96e 100%)',
                  color: (!property || !customValid) ? 'rgba(201,169,110,0.4)' : '#0d1f17',
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em',
                  cursor: (!property || !customValid) ? 'not-allowed' : 'pointer',
                  boxShadow: (!property || !customValid) ? 'none' : '0 4px 20px rgba(201,169,110,0.3)',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <span>GERAR CONTEÚDO</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={cancelGeneration}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2"
                style={{
                  background: 'transparent',
                  borderColor: 'rgba(255,80,80,0.4)',
                  color: 'rgba(255,120,120,0.8)',
                }}
              >
                <span className="animate-spin">⟳</span>
                <span>Cancelar Geração</span>
              </button>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(28,74,53,0.3)' }} />

            {/* ── AI TOOLS ── */}
            <div>
              <span style={{ color: 'rgba(201,169,110,0.5)' }} className="text-xs font-bold uppercase tracking-widest block mb-2">
                Ferramentas IA · Em Breve
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { name: 'D-ID', desc: 'Avatar IA', icon: '🎭' },
                  { name: 'ElevenLabs', desc: 'Voz TTS', icon: '🎙️' },
                  { name: 'Runway', desc: 'Vídeo IA', icon: '🎥' },
                ].map(tool => (
                  <div
                    key={tool.name}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center"
                    style={{ borderColor: 'rgba(28,74,53,0.2)', background: 'rgba(28,74,53,0.08)' }}
                  >
                    <span className="text-lg">{tool.icon}</span>
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{tool.name}</span>
                    <span className="text-[9px]" style={{ color: 'rgba(201,169,110,0.3)' }}>{tool.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT PANEL — Content Output
          ══════════════════════════════════════════════════════════════════ */}
          <div
            className="flex-1 min-w-0 rounded-2xl border overflow-hidden flex flex-col"
            style={{
              background: '#0d1f17',
              borderColor: 'rgba(28,74,53,0.4)',
              minHeight: '600px',
            }}
          >

            {/* ── STATUS BAR ── */}
            {showStatusBar && (
              <div
                className="px-5 py-3 border-b flex items-center gap-3"
                style={{
                  background: genStatus === 'error'
                    ? 'rgba(220,38,38,0.1)'
                    : genStatus === 'done'
                    ? 'rgba(34,197,94,0.08)'
                    : 'rgba(201,169,110,0.06)',
                  borderColor: genStatus === 'error'
                    ? 'rgba(220,38,38,0.2)'
                    : 'rgba(201,169,110,0.15)',
                }}
              >
                {generating && (
                  <div
                    className="h-4 w-4 rounded-full border-2 animate-spin flex-shrink-0"
                    style={{ borderColor: '#c9a96e', borderTopColor: 'transparent' }}
                  />
                )}
                <span
                  className="text-sm font-medium flex-1"
                  style={{ color: genStatus === 'error' ? '#f87171' : genStatus === 'done' ? '#4ade80' : '#c9a96e' }}
                >
                  {genStatus === 'error' ? `❌ ${errorMsg || 'Erro na geração'}` : STATUS_MSG[genStatus] || ''}
                </span>

                {/* Progress steps */}
                {generating && (
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {GEN_STEPS.map((step, i) => {
                      const isDone   = i < stepIdx
                      const isActive = i === stepIdx
                      return (
                        <div key={step.status} className="flex items-center gap-1">
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all"
                            style={{
                              background: isDone ? 'rgba(201,169,110,0.2)' : isActive ? 'rgba(201,169,110,0.1)' : 'transparent',
                              borderColor: isDone ? '#c9a96e' : isActive ? 'rgba(201,169,110,0.5)' : 'rgba(28,74,53,0.4)',
                              color: isDone ? '#c9a96e' : isActive ? 'rgba(201,169,110,0.7)' : 'rgba(255,255,255,0.2)',
                            }}
                          >
                            {isDone ? '✓' : isActive ? '●' : '○'} {step.label}
                          </div>
                          {i < GEN_STEPS.length - 1 && (
                            <span style={{ color: 'rgba(28,74,53,0.5)', fontSize: 10 }}>›</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CONTENT TABS ── */}
            <div
              className="flex border-b"
              role="tablist"
              style={{ borderColor: 'rgba(28,74,53,0.4)' }}
            >
              {CONTENT_TABS.map(tab => {
                const tabContent = { script, hooks, captions, shotlist }[tab.code]
                const isActive   = activeTab === tab.code
                const hasData    = tabContent.length > 0
                return (
                  <button
                    key={tab.code}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.code)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5"
                    style={{
                      borderBottomColor: isActive ? '#c9a96e' : 'transparent',
                      color: isActive ? '#c9a96e' : hasData ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                      background: isActive ? 'rgba(201,169,110,0.05)' : 'transparent',
                    }}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {hasData && !isActive && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: '#c9a96e', opacity: 0.6 }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── CONTENT AREA ── */}
            <div className="flex-1 relative">
              {/* Empty state */}
              {!hasContent && !generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <div
                    className="h-20 w-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(28,74,53,0.2)', border: '2px solid rgba(28,74,53,0.3)' }}
                  >
                    <span style={{ fontSize: '2rem' }}>🎬</span>
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg mb-1">
                      Studio pronto
                    </p>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Selecciona um imóvel, define o comprador alvo e<br />clica em ⚡ Gerar Conteúdo
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border text-xs"
                    style={{ borderColor: 'rgba(28,74,53,0.3)', color: 'rgba(255,255,255,0.25)' }}
                  >
                    <span>📝 Script teleprompter</span>
                    <span>·</span>
                    <span>🎣 5 Hooks</span>
                    <span>·</span>
                    <span>📲 4 Plataformas</span>
                    <span>·</span>
                    <span>🎬 Shot List</span>
                  </div>
                </div>
              )}

              {/* Content display */}
              {(hasContent || generating) && (
                <div className="h-full flex flex-col">
                  <div
                    className="flex-1 overflow-y-auto p-5"
                    style={{ maxHeight: '480px' }}
                  >
                    <pre
                      className="whitespace-pre-wrap leading-relaxed text-sm font-sans"
                      style={{ color: 'rgba(255,255,255,0.88)', lineHeight: '1.75' }}
                    >
                      {activeContent}
                      {/* Blinking cursor while this tab is actively streaming */}
                      {generating && (genStatus as string) === activeTab && (
                        <span
                          className="inline-block h-4 w-0.5 ml-0.5 align-middle animate-pulse"
                          style={{ background: '#c9a96e', opacity: 0.8 }}
                        />
                      )}
                    </pre>
                    {!activeContent && generating && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(201,169,110,0.5)' }}>
                        <div
                          className="h-3 w-3 rounded-full border animate-spin flex-shrink-0"
                          style={{ borderColor: '#c9a96e', borderTopColor: 'transparent' }}
                        />
                        <span>Aguardando esta secção...</span>
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  {hasContent && (
                    <div
                      className="px-5 py-3 border-t flex items-center gap-2 flex-wrap"
                      style={{ borderColor: 'rgba(28,74,53,0.3)' }}
                    >
                      <button
                        type="button"
                        onClick={() => copyContent(activeTab)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                        style={{
                          borderColor: copiedTab === activeTab ? '#4ade80' : 'rgba(201,169,110,0.35)',
                          color: copiedTab === activeTab ? '#4ade80' : '#c9a96e',
                          background: copiedTab === activeTab ? 'rgba(74,222,128,0.08)' : 'transparent',
                        }}
                      >
                        {copiedTab === activeTab ? '✓ Copiado!' : '📋 Copiar'}
                      </button>

                      {activeTab === 'script' && script && (
                        <button
                          type="button"
                          onClick={() => { setTpOpen(true); setTpScrolling(false) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                          style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)' }}
                        >
                          🎙️ Teleprompter
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setScript(''); setHooks(''); setCaptions(''); setShotlist(''); setGenStatus('idle') }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ml-auto"
                        style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}
                      >
                        🗑 Limpar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── PROPERTY CONTEXT FOOTER ── */}
            {property && (
              <div
                className="px-5 py-2.5 border-t flex items-center gap-4 text-xs flex-wrap"
                style={{ borderColor: 'rgba(28,74,53,0.3)', color: 'rgba(255,255,255,0.25)' }}
              >
                <span style={{ color: 'rgba(201,169,110,0.5)' }} className="font-semibold">{property.title}</span>
                <span>·</span>
                <span>{property.zone}</span>
                <span>·</span>
                <span>€{property.price.toLocaleString('pt-PT')}</span>
                <span>·</span>
                <span>{property.area}m² · T{property.bedrooms}</span>
                {property.rentalYield && (
                  <>
                    <span>·</span>
                    <span style={{ color: '#c9a96e' }}>{property.rentalYield}% yield</span>
                  </>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <span>{LANGUAGES.find(l => l.code === lang)?.flag}</span>
                  <span>{PERSONAS.find(p => p.code === persona)?.flag}</span>
                  <span style={{ color: 'rgba(201,169,110,0.4)' }}>{FORMATS.find(f => f.code === format)?.label}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TELEPROMPTER OVERLAY
      ══════════════════════════════════════════════════════════════════════ */}
      {tpOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: '#000' }}
          role="dialog"
          aria-modal="true"
          aria-label="Teleprompter"
        >
          {/* Teleprompter header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'rgba(201,169,110,0.2)', background: '#0a0a0a' }}
          >
            <div className="flex items-center gap-4">
              <span style={{ color: '#c9a96e' }} className="font-bold text-sm tracking-widest uppercase">
                🎙️ Teleprompter
              </span>
              {property && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {property.title} · {LANGUAGES.find(l => l.code === lang)?.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Font size */}
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Tamanho</span>
                <button type="button" onClick={() => setTpFontSize(s => Math.max(20, s - 4))}
                  className="h-7 w-7 rounded border flex items-center justify-center text-xs font-bold"
                  style={{ borderColor: 'rgba(201,169,110,0.3)', color: '#c9a96e' }}>−</button>
                <span className="text-xs w-8 text-center" style={{ color: '#c9a96e' }}>{tpFontSize}</span>
                <button type="button" onClick={() => setTpFontSize(s => Math.min(72, s + 4))}
                  className="h-7 w-7 rounded border flex items-center justify-center text-xs font-bold"
                  style={{ borderColor: 'rgba(201,169,110,0.3)', color: '#c9a96e' }}>+</button>
              </div>

              {/* Speed */}
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Velocidade</span>
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTpSpeed(s)}
                    className="h-7 w-7 rounded border flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      borderColor: tpSpeed === s ? '#c9a96e' : 'rgba(255,255,255,0.1)',
                      color: tpSpeed === s ? '#c9a96e' : 'rgba(255,255,255,0.3)',
                      background: tpSpeed === s ? 'rgba(201,169,110,0.1)' : 'transparent',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { setTpOpen(false); setTpScrolling(false) }}
                className="h-8 w-8 rounded-lg border flex items-center justify-center text-sm font-bold transition"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}
                aria-label="Fechar teleprompter"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Teleprompter content */}
          <div
            ref={tpRef}
            className="flex-1 overflow-y-auto px-16 py-12"
            style={{ scrollBehavior: 'smooth' }}
          >
            {/* Top gradient fade */}
            <div
              className="fixed top-[57px] left-0 right-0 h-24 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to bottom, #000, transparent)' }}
            />
            {/* Bottom gradient fade */}
            <div
              className="fixed bottom-[80px] left-0 right-0 h-24 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to top, #000, transparent)' }}
            />

            <p
              className="text-center mx-auto leading-loose font-medium"
              style={{
                fontSize: tpFontSize,
                color: '#f0f0f0',
                maxWidth: '900px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {script}
            </p>

            {/* Padding at bottom */}
            <div style={{ height: '50vh' }} />
          </div>

          {/* Teleprompter controls */}
          <div
            className="flex items-center justify-center gap-4 px-6 py-5 border-t flex-shrink-0"
            style={{ borderColor: 'rgba(201,169,110,0.2)', background: '#0a0a0a' }}
          >
            {/* Reset */}
            <button
              type="button"
              onClick={() => {
                setTpScrolling(false)
                if (tpRef.current) tpRef.current.scrollTop = 0
              }}
              className="h-10 px-4 rounded-xl border text-xs font-semibold transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' }}
            >
              ⏮ Início
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => setTpScrolling(s => !s)}
              className="h-12 px-8 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
              style={{
                background: tpScrolling
                  ? 'rgba(220,38,38,0.2)'
                  : 'linear-gradient(135deg, #c9a96e, #e0c08a)',
                color: tpScrolling ? '#f87171' : '#000',
                border: tpScrolling ? '1px solid rgba(220,38,38,0.4)' : 'none',
                boxShadow: tpScrolling ? 'none' : '0 4px 20px rgba(201,169,110,0.3)',
              }}
            >
              {tpScrolling ? '⏸ PAUSAR' : '▶ INICIAR'}
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={() => copyContent('script')}
              className="h-10 px-4 rounded-xl border text-xs font-semibold transition-all"
              style={{
                borderColor: copiedTab === 'script' ? '#4ade80' : 'rgba(201,169,110,0.3)',
                color: copiedTab === 'script' ? '#4ade80' : 'rgba(201,169,110,0.6)',
              }}
            >
              {copiedTab === 'script' ? '✓ Copiado' : '📋 Copiar Guião'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
