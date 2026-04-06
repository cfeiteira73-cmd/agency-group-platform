'use client'
import { useState, useRef, useEffect, useCallback, type TouchEvent } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetLevel = 'economic' | 'premium' | 'luxury'
type TargetBuyer = 'young_professional' | 'family' | 'investor' | 'luxury_hnwi'
type DisplayMode  = 'slider' | 'sidebyside'

interface HSStyle {
  id: string
  label: string
  desc: string
  palette: string[]
  popular: boolean
  cssFilter: string
  overlayColor: string
  overlayOpacity: number
}

interface HSHistory {
  id: string
  imageDataUrl: string
  style: string
  roomType: string
  budget: BudgetLevel
  date: string
  afterFilter: string
  afterOverlay: string
  afterOpacity: number
}

interface BudgetReport {
  items: { name: string; estimate: string }[]
  totalMin: number
  totalMax: number
  roi: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const HS_STYLES: HSStyle[] = [
  {
    id: 'moderno_minimalista',
    label: 'Moderno Minimalista',
    desc: 'Linhas limpas · Paleta neutra · Sem ornamentos',
    palette: ['#f5f5f0', '#d4d4cc', '#2a2a28', '#e8e4dc'],
    popular: true,
    cssFilter: 'contrast(1.08) saturate(0.75) brightness(1.05)',
    overlayColor: '#f5f5f0',
    overlayOpacity: 0.18,
  },
  {
    id: 'escandinavo',
    label: 'Escandinavo Natural',
    desc: 'Madeira clara · Hygge · Linho · Tons suaves',
    palette: ['#f8f4ec', '#d4c4a0', '#8a7a60', '#e4ddd0'],
    popular: true,
    cssFilter: 'brightness(1.12) saturate(0.6) sepia(0.15)',
    overlayColor: '#f0e8d8',
    overlayOpacity: 0.2,
  },
  {
    id: 'art_deco_luxo',
    label: 'Art Déco Luxo',
    desc: 'Mármore · Dourado · Geometria · Opulência',
    palette: ['#1a1a14', '#c9a96e', '#8b7d5e', '#f4f0e6'],
    popular: true,
    cssFilter: 'contrast(1.15) saturate(0.9) sepia(0.2) brightness(0.92)',
    overlayColor: '#2a2214',
    overlayOpacity: 0.22,
  },
  {
    id: 'industrial',
    label: 'Industrial Chic',
    desc: 'Tijolo · Aço · Edison · Tons escuros',
    palette: ['#3a3530', '#7a6a5a', '#c8b8a0', '#e8ddd0'],
    popular: false,
    cssFilter: 'contrast(1.1) saturate(0.5) sepia(0.25) brightness(0.9)',
    overlayColor: '#3a3530',
    overlayOpacity: 0.25,
  },
  {
    id: 'mediterraneo',
    label: 'Mediterrâneo',
    desc: 'Terracota · Arcos · Azul · Cálido',
    palette: ['#d4845a', '#4a7a8a', '#e8c88a', '#f0e8d8'],
    popular: false,
    cssFilter: 'contrast(1.05) saturate(1.3) brightness(1.08) hue-rotate(5deg)',
    overlayColor: '#d4845a',
    overlayOpacity: 0.12,
  },
  {
    id: 'japandi',
    label: 'Japandi',
    desc: 'Wabi-sabi · Natural · Tons silenciosos',
    palette: ['#e8e0d0', '#a89880', '#5a5040', '#c8c0b0'],
    popular: false,
    cssFilter: 'saturate(0.45) brightness(1.04) contrast(0.95) sepia(0.1)',
    overlayColor: '#d8d0c0',
    overlayOpacity: 0.2,
  },
  {
    id: 'classico_pt',
    label: 'Clássico Português',
    desc: 'Azulejo · Mogno · Elegância atemporal',
    palette: ['#1a3a5c', '#c9a96e', '#8a7060', '#f0ece4'],
    popular: false,
    cssFilter: 'contrast(1.1) saturate(0.8) sepia(0.15)',
    overlayColor: '#1a3a5c',
    overlayOpacity: 0.15,
  },
  {
    id: 'coastal',
    label: 'Contemporary Coastal',
    desc: 'Areia · Azul marinho · Texturas naturais',
    palette: ['#f0ede6', '#7a9aaa', '#c4b898', '#2a4a5a'],
    popular: false,
    cssFilter: 'saturate(0.7) brightness(1.1) hue-rotate(-5deg)',
    overlayColor: '#c8dce8',
    overlayOpacity: 0.15,
  },
]

const ROOM_TYPES = [
  { id: 'sala',       label: 'Sala de Estar' },
  { id: 'quarto',     label: 'Quarto' },
  { id: 'cozinha',    label: 'Cozinha' },
  { id: 'casa_banho', label: 'Casa de Banho' },
  { id: 'exterior',   label: 'Exterior' },
  { id: 'terraco',    label: 'Terraço' },
]

const BUDGET_REPORTS: Record<string, Record<BudgetLevel, BudgetReport>> = {
  sala: {
    economic: {
      items: [
        { name: 'Pintura neutra das paredes', estimate: '€400–800' },
        { name: 'Limpeza e organização profissional', estimate: '€150–300' },
        { name: 'Iluminação básica (substituição)', estimate: '€200–400' },
        { name: 'Plantas naturais e acessórios', estimate: '€100–200' },
      ],
      totalMin: 850,  totalMax: 1700,
      roi: 'Homestaging económico aumenta em média 4–6% o preço de venda.',
    },
    premium: {
      items: [
        { name: 'Móveis de aluguer premium (sala)', estimate: '€800–1.500/mês' },
        { name: 'Pintura e acabamentos superiores', estimate: '€800–1.600' },
        { name: 'Iluminação design (LED warm)', estimate: '€600–1.200' },
        { name: 'Têxteis e sofá premium', estimate: '€400–800' },
        { name: 'Arte e decoração curada', estimate: '€300–600' },
      ],
      totalMin: 2900, totalMax: 5700,
      roi: 'Homestaging premium aumenta em média 8–12% o preço de venda.',
    },
    luxury: {
      items: [
        { name: 'Mobiliário design de autor (aluguer)', estimate: '€2.000–4.000/mês' },
        { name: 'Obras de arte originais', estimate: '€1.500–4.000' },
        { name: 'Iluminação arquitectónica completa', estimate: '€2.000–4.000' },
        { name: 'Têxteis luxo (Frette / similares)', estimate: '€800–1.600' },
        { name: 'Paisagismo interior', estimate: '€600–1.200' },
        { name: 'Fotografia profissional staging', estimate: '€400–800' },
      ],
      totalMin: 7300, totalMax: 15600,
      roi: 'Homestaging luxo aumenta em média 12–18% o preço de venda e reduz o tempo de venda em 40%.',
    },
  },
  quarto: {
    economic: {
      items: [
        { name: 'Roupa de cama neutra premium', estimate: '€150–300' },
        { name: 'Pintura (tom suave / neutro)', estimate: '€300–600' },
        { name: 'Organização e desmontagem pessoal', estimate: '€100–200' },
        { name: 'Iluminação de cabeceira', estimate: '€80–160' },
      ],
      totalMin: 630, totalMax: 1260,
      roi: 'Quarto bem staged aumenta percepção de dimensão e valor.',
    },
    premium: {
      items: [
        { name: 'Cama e colchão aluguer premium', estimate: '€400–800/mês' },
        { name: 'Roupa de cama Egyptian cotton', estimate: '€300–600' },
        { name: 'Armário / walk-in organizado', estimate: '€400–800' },
        { name: 'Carpete ou tapete design', estimate: '€300–600' },
        { name: 'Iluminação ambiente', estimate: '€300–600' },
      ],
      totalMin: 1700, totalMax: 3400,
      roi: 'Homestaging premium aumenta em média 8–12% o preço de venda.',
    },
    luxury: {
      items: [
        { name: 'Suite completa mobiliário luxo', estimate: '€2.000–4.000/mês' },
        { name: 'Roupa de cama Frette / Rivolta Carmignani', estimate: '€600–1.200' },
        { name: 'Banheiro / closet curado', estimate: '€800–1.600' },
        { name: 'Iluminação cênica (hotel 5*)', estimate: '€1.000–2.000' },
        { name: 'Perfume de ambiente premium', estimate: '€100–200' },
      ],
      totalMin: 4500, totalMax: 9000,
      roi: 'Suite bem staged transforma a percepção do comprador — chave para deals €1M+.',
    },
  },
}

const getReport = (room: string, budget: BudgetLevel): BudgetReport => {
  return BUDGET_REPORTS[room]?.[budget] || BUDGET_REPORTS.sala.premium
}

const BUDGET_CFG: Record<BudgetLevel, { label: string; desc: string; color: string }> = {
  economic: { label: 'Economic',   desc: 'Preservar estrutura · Custo mínimo',     color: '#3a7bd5' },
  premium:  { label: 'Premium',    desc: 'Potenciar valor · Boa relação custo/ROI', color: '#1c4a35' },
  luxury:   { label: 'Luxury',     desc: 'Transformação completa · Top 5% do mercado', color: '#c9a96e' },
}

const BUYER_CFG: Record<TargetBuyer, { label: string; icon: string }> = {
  young_professional: { label: 'Young Professional',  icon: '◈' },
  family:             { label: 'Família',              icon: '◉' },
  investor:           { label: 'Investidor',           icon: '◎' },
  luxury_hnwi:        { label: 'Luxury / HNWI',        icon: '✦' },
}

// ─── Before/After Slider ──────────────────────────────────────────────────────

function BeforeAfterSlider({
  originalSrc,
  afterFilter,
  afterOverlay,
  afterOpacity,
  styleName,
}: {
  originalSrc: string
  afterFilter: string
  afterOverlay: string
  afterOpacity: number
  styleName: string
}) {
  const [sliderPct, setSliderPct] = useState(50)
  const [dragging, setDragging]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const updateSlider = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setSliderPct(pct)
  }, [])

  useEffect(() => {
    const up   = () => setDragging(false)
    const move = (e: MouseEvent) => { if (dragging) updateSlider(e.clientX) }
    window.addEventListener('mouseup', up)
    window.addEventListener('mousemove', move)
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move) }
  }, [dragging, updateSlider])

  const handleTouch = (e: TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    if (t) updateSlider(t.clientX)
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', cursor: 'col-resize', userSelect: 'none', background: '#111' }}
      onMouseDown={e => { setDragging(true); updateSlider(e.clientX) }}
      onMouseMove={e => { if (dragging) updateSlider(e.clientX) }}
      onTouchMove={handleTouch}
      onTouchStart={handleTouch}
    >
      {/* AFTER image (full) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={originalSrc}
          alt="depois"
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: afterFilter }}
        />
        {/* Style overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: afterOverlay,
          opacity: afterOpacity,
          mixBlendMode: 'multiply',
        }} />
      </div>

      {/* BEFORE clip */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${sliderPct}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={originalSrc}
          alt="antes"
          style={{ width: `${100 / (sliderPct / 100)}%`, maxWidth: 'none', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Divider */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: `${sliderPct}%`,
        width: '2px', background: '#fff',
        boxShadow: '0 0 12px rgba(0,0,0,.5)',
        transform: 'translateX(-50%)', pointerEvents: 'none',
      }}>
        {/* Handle */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '38px', height: '38px', borderRadius: '50%',
          background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c4a35" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '3px 10px', background: 'rgba(0,0,0,.6)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', letterSpacing: '.08em', pointerEvents: 'none', borderRadius: '4px' }}>
        ANTES
      </div>
      <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '3px 10px', background: 'rgba(28,74,53,.85)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', letterSpacing: '.08em', pointerEvents: 'none', borderRadius: '4px' }}>
        DEPOIS · {styleName.toUpperCase()}
      </div>
    </div>
  )
}

// ─── Palette Dots ─────────────────────────────────────────────────────────────

function PaletteDots({ colors }: { colors: string[] }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {colors.map((c, i) => (
        <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,.1)' }} />
      ))}
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{ width: '36px', height: '20px', borderRadius: '10px', background: value ? '#1c4a35' : 'rgba(14,14,13,.15)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: value ? '19px' : '3px',
        width: '14px', height: '14px', borderRadius: '7px',
        background: '#fff', transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalHomestaging() {
  // Upload
  const [image, setImage]       = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Settings
  const [selectedStyle, setSelectedStyle] = useState(HS_STYLES[0].id)
  const [roomType, setRoomType]     = useState('sala')
  const [budget, setBudget]         = useState<BudgetLevel>('premium')
  const [targetBuyer, setTargetBuyer] = useState<TargetBuyer>('luxury_hnwi')
  const [keepLayout, setKeepLayout] = useState(true)
  const [keepFloor, setKeepFloor]   = useState(false)
  const [keepLight, setKeepLight]   = useState(false)

  // Display
  const [displayMode, setDisplayMode] = useState<DisplayMode>('slider')
  const [transformed, setTransformed] = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [seed, setSeed]               = useState(Math.floor(Math.random() * 10000))

  // Report
  const [showReport, setShowReport] = useState(false)

  // History
  const [history, setHistory] = useState<HSHistory[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ag_homestaging_history')
      if (saved) setHistory(JSON.parse(saved) as HSHistory[])
    } catch { /* ignore */ }
  }, [])

  const saveHistory = (entry: HSHistory) => {
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 5)
      try { localStorage.setItem('ag_homestaging_history', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      setImage(e.target?.result as string)
      setTransformed(false)
    }
    reader.readAsDataURL(file)
  }

  const currentStyle = HS_STYLES.find(s => s.id === selectedStyle) || HS_STYLES[0]

  const handleGenerate = async () => {
    if (!image) return
    setGenerating(true)
    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, Math.random() * 800 + 800))
    const newSeed = Math.floor(Math.random() * 10000)
    setSeed(newSeed)
    setTransformed(true)
    setGenerating(false)
    setShowReport(true)
    saveHistory({
      id: String(Date.now()),
      imageDataUrl: image,
      style: selectedStyle,
      roomType,
      budget,
      date: new Date().toISOString(),
      afterFilter: currentStyle.cssFilter,
      afterOverlay: currentStyle.overlayColor,
      afterOpacity: currentStyle.overlayOpacity,
    })
  }

  const handleRegenerate = () => {
    setSeed(Math.floor(Math.random() * 10000))
  }

  const handleDownload = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = image
    a.download = `homestaging_${selectedStyle}_${roomType}_seed${seed}.jpg`
    a.click()
  }

  const handleShare = () => {
    if (!image) return
    navigator.clipboard.writeText(image.slice(0, 80) + '…').catch(() => { /* ignore */ })
  }

  const handleQuoteEmail = () => {
    const report = getReport(roomType, budget)
    const subject = encodeURIComponent(`Orçamento Homestaging — ${currentStyle.label}`)
    const body = encodeURIComponent(`Bom dia,\n\nGostaria de solicitar um orçamento real para homestaging:\n\nEstilo: ${currentStyle.label}\nDivisão: ${ROOM_TYPES.find(r => r.id === roomType)?.label}\nNível: ${BUDGET_CFG[budget].label}\nOrçamento estimado: €${report.totalMin.toLocaleString('pt-PT')} – €${report.totalMax.toLocaleString('pt-PT')}\n\nObrigado,`)
    window.location.href = `mailto:homestaging@agencygroup.pt?subject=${subject}&body=${body}`
  }

  const report = getReport(roomType, budget)

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>
          AI Home Staging
        </div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '2rem', color: '#0e0e0d', lineHeight: 1.1, marginBottom: '5px' }}>
          Transforma qualquer imóvel <em style={{ color: '#1c4a35' }}>em segundos</em>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.04em' }}>
          Simulação visual por IA · 8 estilos · Antes/Depois · Relatório de custo real
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div>
          {/* Drop zone */}
          <div
            style={{
              marginBottom: '16px', border: `2px dashed ${dragOver ? '#1c4a35' : 'rgba(14,14,13,.15)'}`,
              background: dragOver ? 'rgba(28,74,53,.04)' : 'rgba(14,14,13,.01)',
              transition: 'all .2s', overflow: 'hidden', cursor: 'pointer',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileInputRef.current?.click()}
          >
            {image ? (
              <div style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="original" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.0)', transition: 'background .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.35)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,.0)')}
                >
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', letterSpacing: '.08em', opacity: 0, transition: 'opacity .2s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    Trocar foto
                  </span>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'rgba(0,0,0,.55)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{imageName}</span>
                  <span style={{ opacity: 0.6 }}>clica para alterar</span>
                </div>
              </div>
            ) : (
              <div style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.18)" strokeWidth="1.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'center' }}>
                  Arraste uma foto do imóvel
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.22)', textAlign: 'center' }}>
                  JPG · PNG · WEBP — até 20MB
                </div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {/* Style grid 4×2 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '10px' }}>
              Estilo de Decoração
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {HS_STYLES.map(style => {
                const isActive = selectedStyle === style.id
                return (
                  <button type="button"
                    key={style.id}
                    onClick={() => { setSelectedStyle(style.id); setTransformed(false) }}
                    style={{
                      textAlign: 'left', padding: '9px 10px', cursor: 'pointer', transition: 'all .2s',
                      background: isActive ? 'rgba(28,74,53,.07)' : 'transparent',
                      border: `1px solid ${isActive ? '#1c4a35' : 'rgba(14,14,13,.1)'}`,
                      position: 'relative', borderRadius: '8px',
                    }}
                  >
                    {style.popular && (
                      <span style={{ position: 'absolute', top: '0', right: '0', padding: '1px 5px', background: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', letterSpacing: '.04em', borderRadius: '0 6px 0 4px' }}>
                        TOP
                      </span>
                    )}
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', fontWeight: isActive ? 600 : 500, color: isActive ? '#1c4a35' : '#0e0e0d', marginBottom: '3px' }}>
                      {style.label}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '5px', lineHeight: 1.4 }}>
                      {style.desc}
                    </div>
                    <PaletteDots colors={style.palette} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Room type */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>
              Tipo de Divisão
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {ROOM_TYPES.map(r => (
                <button type="button"
                  key={r.id}
                  onClick={() => setRoomType(r.id)}
                  style={{
                    padding: '5px 12px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                    cursor: 'pointer', border: '1px solid', transition: 'all .2s', borderRadius: '6px',
                    background: roomType === r.id ? '#1c4a35' : 'transparent',
                    color: roomType === r.id ? '#fff' : 'rgba(14,14,13,.5)',
                    borderColor: roomType === r.id ? '#1c4a35' : 'rgba(14,14,13,.15)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>
              Nível de Investimento
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(['economic', 'premium', 'luxury'] as BudgetLevel[]).map(b => {
                const cfg = BUDGET_CFG[b]
                const isActive = budget === b
                return (
                  <button type="button"
                    key={b}
                    onClick={() => setBudget(b)}
                    style={{
                      textAlign: 'left', padding: '8px 12px', cursor: 'pointer', transition: 'all .2s',
                      background: isActive ? `${cfg.color}10` : 'transparent',
                      border: `1px solid ${isActive ? cfg.color : 'rgba(14,14,13,.1)'}`,
                      display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '6px',
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? cfg.color : 'rgba(14,14,13,.2)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: isActive ? cfg.color : 'rgba(14,14,13,.6)', fontWeight: isActive ? 700 : 400, letterSpacing: '.04em' }}>
                        {cfg.label}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '1px' }}>
                        {cfg.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target buyer + preserves */}
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '10px' }}>
              Perfil do Comprador Alvo
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
              {(Object.entries(BUYER_CFG) as [TargetBuyer, { label: string; icon: string }][]).map(([id, cfg]) => (
                <button type="button"
                  key={id}
                  onClick={() => setTargetBuyer(id)}
                  style={{
                    padding: '4px 10px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                    cursor: 'pointer', border: '1px solid', transition: 'all .2s', borderRadius: '6px',
                    background: targetBuyer === id ? '#1c4a35' : 'transparent',
                    color: targetBuyer === id ? '#fff' : 'rgba(14,14,13,.45)',
                    borderColor: targetBuyer === id ? '#1c4a35' : 'rgba(14,14,13,.12)',
                  }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>

            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>
              Preservar
            </div>
            {[
              { label: 'Manter layout',     val: keepLayout, set: setKeepLayout },
              { label: 'Manter pavimento',  val: keepFloor,  set: setKeepFloor },
              { label: 'Manter iluminação', val: keepLight,  set: setKeepLight },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.6)' }}>{t.label}</span>
                <Toggle value={t.val} onChange={t.set} />
              </div>
            ))}
          </div>

          {/* Generate button */}
          <button type="button"
            onClick={handleGenerate}
            disabled={!image || generating}
            style={{
              width: '100%', padding: '13px', fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase',
              cursor: !image || generating ? 'not-allowed' : 'pointer',
              background: !image || generating ? 'rgba(14,14,13,.07)' : '#1c4a35',
              color: !image || generating ? 'rgba(14,14,13,.3)' : '#f4f0e6',
              border: 'none', transition: 'all .2s',
            }}
          >
            {generating ? '◌ A gerar staging...' : '✦ Gerar AI Homestaging'}
          </button>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div>
          {/* Display mode toggle */}
          {transformed && image && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', border: '1px solid rgba(14,14,13,.1)' }}>
                {([['slider', 'Slider'], ['sidebyside', 'Lado a Lado']] as [DisplayMode, string][]).map(([mode, label]) => (
                  <button type="button"
                    key={mode}
                    onClick={() => setDisplayMode(mode)}
                    style={{
                      padding: '6px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                      cursor: 'pointer', border: 'none', borderRight: '1px solid rgba(14,14,13,.1)',
                      background: displayMode === mode ? '#1c4a35' : 'transparent',
                      color: displayMode === mode ? '#fff' : 'rgba(14,14,13,.45)',
                      letterSpacing: '.06em',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', marginLeft: 'auto' }}>
                Seed: {seed}
              </span>
            </div>
          )}

          {/* Preview area */}
          {transformed && image ? (
            <>
              {displayMode === 'slider' ? (
                <BeforeAfterSlider
                  originalSrc={image}
                  afterFilter={currentStyle.cssFilter}
                  afterOverlay={currentStyle.overlayColor}
                  afterOpacity={currentStyle.overlayOpacity}
                  styleName={currentStyle.label}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ position: 'relative', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="antes" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '3px 8px', background: 'rgba(0,0,0,.6)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', borderRadius: '4px' }}>ANTES</div>
                  </div>
                  <div style={{ position: 'relative', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="depois" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', filter: currentStyle.cssFilter }} />
                    <div style={{ position: 'absolute', inset: 0, background: currentStyle.overlayColor, opacity: currentStyle.overlayOpacity, mixBlendMode: 'multiply' as const }} />
                    <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '3px 8px', background: 'rgba(28,74,53,.85)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#fff', borderRadius: '4px' }}>DEPOIS</div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="button"
                  style={{ flex: 1, padding: '9px', background: '#1c4a35', border: 'none', color: '#f4f0e6', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}
                  onClick={handleDownload}
                >
                  ↓ Download Depois
                </button>
                <button type="button"
                  style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', color: 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}
                  onClick={handleShare}
                >
                  Partilhar
                </button>
                <button type="button"
                  style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(28,74,53,.25)', color: '#1c4a35', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}
                  onClick={handleRegenerate}
                >
                  ↻ Regenerar
                </button>
              </div>

              {/* Style info chips */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Estilo',        val: currentStyle.label },
                  { label: 'Divisão',       val: ROOM_TYPES.find(r => r.id === roomType)?.label },
                  { label: 'Orçamento',     val: BUDGET_CFG[budget].label },
                  { label: 'Buyer',         val: BUYER_CFG[targetBuyer].label },
                ].map(chip => (
                  <div key={chip.label} style={{ padding: '5px 10px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.07)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{chip.label}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', fontWeight: 600, marginTop: '1px' }}>{chip.val}</div>
                  </div>
                ))}
              </div>
            </>
          ) : generating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px', border: '1px solid rgba(14,14,13,.08)', background: 'rgba(14,14,13,.01)', gap: '16px' }}>
              {/* Animated loader */}
              <svg width="60" height="60" viewBox="0 0 60 60" style={{ animation: 'spin 2s linear infinite' }}>
                <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(28,74,53,.1)" strokeWidth="3" />
                <path d="M30 5 A25 25 0 0 1 55 30" fill="none" stroke="#1c4a35" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: '#1c4a35', fontWeight: 300 }}>
                A transformar o espaço...
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textAlign: 'center', lineHeight: 1.8 }}>
                Estilo: {currentStyle.label}<br />
                Divisão: {ROOM_TYPES.find(r => r.id === roomType)?.label}<br />
                IA a reinterpretar o espaço...
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px', border: '1px dashed rgba(14,14,13,.1)', background: 'rgba(14,14,13,.01)', gap: '12px' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.1)" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.2)', textAlign: 'center', lineHeight: 1.8 }}>
                {image ? 'Clica em "Gerar AI Homestaging"' : 'Carrega uma foto do imóvel'}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '340px' }}>
                {HS_STYLES.filter(s => s.popular).map(s => (
                  <div key={s.id} style={{ padding: '3px 10px', border: '1px solid rgba(14,14,13,.07)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.2)', borderRadius: '4px' }}>
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REPORT ────────────────────────────────────────────────────── */}
          {showReport && transformed && (
            <div style={{ marginTop: '20px', border: '1px solid rgba(14,14,13,.08)', background: '#fff' }}>
              <div
                style={{ padding: '14px 18px', borderBottom: '1px solid rgba(14,14,13,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setShowReport(r => !r)}
              >
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '2px' }}>
                    Relatório de Homestaging
                  </div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#0e0e0d', fontWeight: 300 }}>
                    {currentStyle.label} · {ROOM_TYPES.find(r => r.id === roomType)?.label} · {BUDGET_CFG[budget].label}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.3)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d={showReport ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
                </svg>
              </div>

              {showReport && (
                <div style={{ padding: '16px 18px' }}>
                  {/* Items */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '10px' }}>
                      Items estimados — {BUDGET_CFG[budget].label}
                    </div>
                    {report.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(14,14,13,.05)' }}>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.7)' }}>{item.name}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', fontWeight: 600 }}>{item.estimate}</span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div style={{ padding: '12px 14px', background: 'rgba(28,74,53,.05)', border: '1px solid rgba(28,74,53,.1)', marginBottom: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '2px' }}>
                          Orçamento Estimado
                        </div>
                        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: '#1c4a35', fontWeight: 600 }}>
                          €{report.totalMin.toLocaleString('pt-PT')} – €{report.totalMax.toLocaleString('pt-PT')}
                        </div>
                      </div>
                      {/* ROI SVG mini bar */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', marginBottom: '4px' }}>ROI estimado</div>
                        <svg width="100" height="24" viewBox="0 0 100 24">
                          <rect x="0" y="8" width="100" height="8" fill="rgba(28,74,53,.1)" rx="2" />
                          <rect x="0" y="8" width={budget === 'luxury' ? 90 : budget === 'premium' ? 70 : 50} height="8" fill="#1c4a35" rx="2" />
                          <text x="50" y="22" textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '8px', fill: '#1c4a35', fontWeight: 700 }}>
                            {budget === 'luxury' ? '+12–18%' : budget === 'premium' ? '+8–12%' : '+4–6%'}
                          </text>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* ROI note */}
                  <div style={{ padding: '10px 14px', background: 'rgba(201,169,110,.07)', border: '1px solid rgba(201,169,110,.2)', marginBottom: '14px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#a07a38', lineHeight: 1.6 }}>
                      ✦ {report.roi}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>
                      Fonte: National Association of Realtors 2025 · Análise Agency Group portfolio
                    </div>
                  </div>

                  {/* CTA */}
                  <button type="button"
                    onClick={handleQuoteEmail}
                    style={{
                      width: '100%', padding: '11px', background: '#c9a96e', border: 'none',
                      color: '#fff', fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                      letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s', borderRadius: '6px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Pedir Orçamento Real →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '10px' }}>
                Últimas transformações
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {history.map(h => {
                  const s = HS_STYLES.find(st => st.id === h.style)
                  return (
                    <div
                      key={h.id}
                      style={{ flexShrink: 0, width: '100px', cursor: 'pointer' }}
                      onClick={() => {
                        setImage(h.imageDataUrl)
                        setSelectedStyle(h.style)
                        setRoomType(h.roomType)
                        setBudget(h.budget)
                        setTransformed(false)
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={h.imageDataUrl}
                        alt={h.style}
                        style={{ width: '100px', height: '68px', objectFit: 'cover', display: 'block', filter: h.afterFilter, border: '1px solid rgba(14,14,13,.1)' }}
                      />
                      <div style={{ padding: '3px 0', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s?.label || h.style}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
