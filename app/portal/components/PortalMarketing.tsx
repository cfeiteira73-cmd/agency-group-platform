'use client'
import { useRef, useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useMarketingStore } from '../stores/marketingStore'
import { FORMATS, PERSONAS } from './constants'

interface PortalMarketingProps {
  onRunMarketing: () => Promise<void>
  onAutoFillFromUrl: () => Promise<void>
  onStartVoice: () => void
  onCopyContent: () => void
  onPhotoUpload: (files: FileList | null) => void
}

// ─── Limites por formato ─────────────────────────────────────────────────────
const FORMAT_LIMITS: Record<string, number | null> = {
  instagram: 2200,
  linkedin: 3000,
  email: null,
  whatsapp: 1024,
  legenda: 150,
  hashtags: null,
  idealista: 4000,
  press_release: null,
}

const FORMAT_COLORS: Record<string, string> = {
  instagram: '#833ab4',
  linkedin: '#0077b5',
  whatsapp: '#25d366',
  email: '#c9a96e',
  legenda: '#e05252',
  hashtags: '#1c4a35',
  idealista: '#1e7d3a',
  press_release: '#555',
}

// ─── Templates pré-definidos ─────────────────────────────────────────────────
const TEMPLATES = [
  {
    categoria: 'Instagram',
    nome: 'Lançamento Exclusivo',
    preview: '✨ Exclusivo · {zona} · T{tipologia} excepcional...',
    emoji: '📸',
    color: '#833ab4',
    texto: '✨ Exclusivo · {zona}\n\nUm T{tipologia} excepcional com acabamentos premium e localização privilegiada.\n\n📐 {area}m² | 💰 €{preco}\n🌟 {features}\n\n📩 Contacto directo para visita privada.\n\n#realestate #luxuryrealestate #{zona_hashtag} #agencygroup',
  },
  {
    categoria: 'LinkedIn',
    nome: 'Market Update',
    emoji: '💼',
    color: '#0077b5',
    preview: 'Q1 2026: Lisboa continua a bater recordes...',
    texto: 'Q1 2026: O mercado imobiliário português continua a superar todas as expectativas.\n\nLisboa posicionada entre os top 5 mundiais no segmento de luxo. Transacções em alta de 17,6% YoY.\n\nPara investidores e compradores que procuram oportunidades únicas — estamos disponíveis para uma conversa.\n\n#RealEstate #Portugal #LuxuryProperty #AgencyGroup',
  },
  {
    categoria: 'Email',
    nome: 'Newsletter Mensal',
    emoji: '📧',
    color: '#c9a96e',
    preview: 'Caros clientes, o mercado imobiliário em {mês}...',
    texto: 'Assunto: Mercado Imobiliário — Relatório {mês} 2026\n\nCaros clientes,\n\nO mercado imobiliário em {mês} de 2026 continua a demonstrar uma resiliência notável, com a mediana nacional a atingir €3.076/m².\n\nDestaques do mês:\n• Lisboa Centro: €8.200/m² (+12% YoY)\n• Cascais: €5.890/m²\n• Algarve: €3.941/m²\n\nNovidades do nosso portfólio disponíveis em anexo.\n\nCom os melhores cumprimentos,\nAgency Group',
  },
  {
    categoria: 'WhatsApp',
    nome: 'Novo Imóvel',
    emoji: '💬',
    color: '#25d366',
    preview: 'Olá {nome}! Acabou de entrar um imóvel...',
    texto: 'Olá {nome}! 👋\n\nAcabou de entrar em portfólio um imóvel que pode interessar-lhe:\n\n📍 {zona}\n🏠 T{tipologia} · {area}m²\n💰 €{preco}\n✨ {features}\n\nPosso agendar uma visita esta semana?',
  },
  {
    categoria: 'Reel Script',
    nome: 'Propriedade de Luxo',
    emoji: '🎬',
    color: '#e05252',
    preview: '[Hook] Imagina acordar com esta vista...',
    texto: '[HOOK — 0-3s]\nImagina acordar com esta vista todos os dias...\n\n[DESENVOLVIMENTO — 3-20s]\nEste T{tipologia} em {zona} tem tudo o que sempre procurou:\n{features}\n\n[CTA — últimos 3s]\nLink na bio para agendar visita privada. Exclusivo Agency Group.',
  },
  {
    categoria: 'Press Release',
    nome: 'Venda Recorde',
    emoji: '📰',
    color: '#555',
    preview: 'A Agency Group anuncia a venda de...',
    texto: 'COMUNICADO DE IMPRENSA\nPara publicação imediata\n\nA Agency Group anuncia a conclusão de mais uma venda de referência no mercado imobiliário de luxo português.\n\nA propriedade, localizada em {zona}, foi transaccionada pelo valor de €{preco}, reforçando a posição da Agency Group como líder no segmento premium.\n\n"Esta transacção reflecte a confiança crescente de investidores internacionais no mercado português", afirmou Carlos Ferreira, fundador da Agency Group.\n\nContacto de imprensa: press@agencygroup.pt',
  },
]

// ─── Gauge para SEO Score ────────────────────────────────────────────────────
function SeoGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#c9a96e' : '#e05252'
  const pct = score / 100
  const r = 28
  const cx = 36
  const cy = 36
  const circumference = Math.PI * r
  const dash = circumference * pct
  const gap = circumference - dash

  return (
    <svg width="72" height="44" viewBox="0 0 72 44" style={{ overflow: 'visible' }}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(14,14,13,.08)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontFamily: "'Cormorant',serif", fontSize: '11px', fill: color, fontWeight: 600 }}>{score}</text>
    </svg>
  )
}

// ─── CharCount bar ────────────────────────────────────────────────────────────
function CharCount({ current, max }: { current: number; max: number | null }) {
  if (!max) return null
  const pct = Math.min(current / max, 1)
  const over = current > max
  const color = over ? '#e05252' : pct > 0.8 ? '#c9a96e' : '#22c55e'
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)' }}>caracteres</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: over ? '#e05252' : 'rgba(14,14,13,.4)', fontWeight: over ? 700 : 400 }}>
          {current.toLocaleString('pt-PT')} / {max.toLocaleString('pt-PT')}
        </span>
      </div>
      <div style={{ height: '3px', background: 'rgba(14,14,13,.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: '2px', transition: 'width .3s ease' }} />
      </div>
    </div>
  )
}

// ─── Posting Schedule Grid ────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#833ab4',
  linkedin: '#0077b5',
  whatsapp: '#25d366',
  email: '#c9a96e',
  twitter: '#1da1f2',
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function PostingScheduleGrid({ schedule }: { schedule: Record<string, { day: string; time: string }> }) {
  // Map schedule entries to day indices
  const dayMap: Record<string, Array<{ fmt: string; time: string; color: string }>> = {}
  WEEKDAYS.forEach(d => { dayMap[d] = [] })

  Object.entries(schedule).forEach(([fmt, sched]) => {
    const dayLabel = sched.day?.slice(0, 3) ?? ''
    const match = WEEKDAYS.find(d => d.toLowerCase() === dayLabel.toLowerCase() || sched.day?.toLowerCase().startsWith(d.toLowerCase()))
    const key = match ?? WEEKDAYS[0]
    const color = PLATFORM_COLORS[fmt.toLowerCase()] ?? '#999'
    dayMap[key]?.push({ fmt, time: sched.time, color })
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
      {WEEKDAYS.map(day => (
        <div key={day} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.33rem', color: 'rgba(14,14,13,.4)', marginBottom: '4px', letterSpacing: '.05em' }}>{day}</div>
          <div style={{ minHeight: '48px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.05)', borderRadius: '2px', padding: '3px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {dayMap[day]?.map((item, i) => (
              <div key={i} style={{ padding: '2px 3px', background: `${item.color}18`, borderLeft: `2px solid ${item.color}`, borderRadius: '1px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: item.color, fontWeight: 700, lineHeight: 1.2 }}>{item.fmt}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.28rem', color: 'rgba(14,14,13,.4)', lineHeight: 1.2 }}>{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalMarketing({
  onRunMarketing,
  onAutoFillFromUrl,
  onStartVoice,
  onCopyContent,
  onPhotoUpload,
}: PortalMarketingProps) {
  const { darkMode } = useUIStore()
  const {
    mktInput, setMktInput,
    mktFormat, setMktFormat,
    mktLang, setMktLang,
    mktLangs, setMktLangs,
    mktResult, mktLoading,
    mktPersona, setMktPersona,
    mktPhotos, setMktPhotos,
    mktVideoUrl, setMktVideoUrl,
    mktListingUrl, setMktListingUrl,
    mktTourUrl, setMktTourUrl,
    mktInputTab, setMktInputTab,
    mktAutoFilling,
    mktSeoScore,
    mktPhotoInsights,
    mktPostingSchedule,
    isListening,
    copied,
    dragOver, setDragOver,
  } = useMarketingStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [copyCharCount, setCopyCharCount] = useState<number | null>(null)
  const [showCopyToast, setShowCopyToast] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)

  const LANGS = [
    { v: 'pt', l: 'PT' }, { v: 'en', l: 'EN' }, { v: 'fr', l: 'FR' },
    { v: 'de', l: 'DE' }, { v: 'ar', l: 'AR' }, { v: 'zh', l: 'ZH' },
  ]

  const toggleLang = (l: string) => {
    setMktLangs(mktLangs.includes(l) ? mktLangs.filter(x => x !== l) : [...mktLangs, l])
  }

  const currentContent = mktResult && mktResult[mktFormat]
    ? (mktResult[mktFormat] as Record<string, string>)[mktLang] || ''
    : ''

  const charLimit = FORMAT_LIMITS[mktFormat] ?? null
  const charCount = currentContent.length

  const handleCopy = () => {
    const chars = currentContent.length
    setCopyCharCount(chars)
    setShowCopyToast(true)
    onCopyContent()
    setTimeout(() => setShowCopyToast(false), 3000)
  }

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setActiveTemplate(tpl.nome)
    setMktInput({ descricao: tpl.texto })
    // Switch to dados tab
    setMktInputTab('dados')
  }

  // SEO breakdown keys
  const seoBreakdown = [
    { label: 'Título', key: 'titulo' },
    { label: 'Meta descrição', key: 'meta' },
    { label: 'Palavras-chave', key: 'keywords' },
    { label: 'Comprimento', key: 'length' },
  ]
  const seoDetails = mktResult?.seoDetails as Record<string, boolean> | undefined

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Conteúdo Multi-Formato</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Marketing AI</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>Idealista · Instagram · LinkedIn · WhatsApp · Email · +6 formatos</div>
      </div>

      <div className="mkt-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* ── Input Panel ──────────────────────────────────────────────────── */}
        <div>
          {/* Input tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.08)', marginBottom: '16px' }}>
            {(['dados', 'media', 'url', 'tour'] as const).map(t => (
              <button key={t} className={`mkt-input-tab${mktInputTab === t ? ' active' : ''}`} onClick={() => setMktInputTab(t)}>
                {t === 'dados' ? '📋 Dados' : t === 'media' ? '📸 Fotos' : t === 'url' ? '🔗 URL' : '🎥 Tour'}
              </button>
            ))}
          </div>

          {mktInputTab === 'dados' && (
            <div className="p-card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="p-label">Zona</label>
                  <input className="p-inp" placeholder="ex: Lisboa — Chiado" value={mktInput.zona} onChange={e => setMktInput({ zona: e.target.value })} />
                </div>
                <div>
                  <label className="p-label">Tipologia</label>
                  <input className="p-inp" placeholder="ex: T3" value={mktInput.tipo} onChange={e => setMktInput({ tipo: e.target.value })} />
                </div>
                <div>
                  <label className="p-label">Área (m²)</label>
                  <input className="p-inp" type="number" placeholder="ex: 120" value={mktInput.area} onChange={e => setMktInput({ area: e.target.value })} />
                </div>
                <div>
                  <label className="p-label">Preço (€)</label>
                  <input className="p-inp" type="number" placeholder="ex: 850000" value={mktInput.preco} onChange={e => setMktInput({ preco: e.target.value })} />
                </div>
                <div>
                  <label className="p-label">Quartos</label>
                  <input className="p-inp" type="number" placeholder="ex: 3" value={mktInput.quartos} onChange={e => setMktInput({ quartos: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="p-label">Features</label>
                  <input className="p-inp" placeholder="piscina, garagem dupla, terraço, vista mar..." value={mktInput.features} onChange={e => setMktInput({ features: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="p-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Descrição Livre</span>
                    <button onClick={onStartVoice} style={{ background: isListening ? '#dc2626' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '.7rem', color: isListening ? '#fff' : 'rgba(14,14,13,.4)', padding: '0 6px' }}>
                      {isListening ? '● A gravar...' : '🎤 Voz'}
                    </button>
                  </label>
                  <textarea className="p-inp" rows={3} placeholder="Descreva o imóvel livremente..." value={mktInput.descricao} onChange={e => setMktInput({ descricao: e.target.value })} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
          )}

          {mktInputTab === 'media' && (
            <div className="p-card">
              <div
                className={`photo-drop${dragOver ? ' drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); onPhotoUpload(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📸</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)' }}>Arrastar fotos ou clicar para selecionar</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.3)', marginTop: '4px' }}>Máx. 10 fotos · JPG, PNG, WebP</div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => onPhotoUpload(e.target.files)} />
              {mktPhotos.length > 0 && (
                <div className="photo-grid">
                  {mktPhotos.map((p, i) => (
                    <div key={i} className="photo-thumb">
                      <img src={p} alt={`photo-${i}`} />
                      <button className="photo-remove" onClick={() => setMktPhotos(mktPhotos.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '16px' }}>
                <label className="p-label">URL do Vídeo</label>
                <input className="p-inp" placeholder="YouTube, Vimeo..." value={mktVideoUrl} onChange={e => setMktVideoUrl(e.target.value)} />
              </div>
            </div>
          )}

          {mktInputTab === 'url' && (
            <div className="p-card">
              <label className="p-label">URL do Anúncio</label>
              <input className="p-inp" placeholder="https://idealista.pt/imovel/..." value={mktListingUrl} onChange={e => setMktListingUrl(e.target.value)} />
              <button className="p-btn" style={{ marginTop: '12px', width: '100%' }} onClick={onAutoFillFromUrl} disabled={mktAutoFilling || !mktListingUrl.trim()}>
                {mktAutoFilling ? '✦ A importar...' : '✦ Auto-Preencher Dados'}
              </button>
            </div>
          )}

          {mktInputTab === 'tour' && (
            <div className="p-card">
              <label className="p-label">URL do Tour Virtual</label>
              <input className="p-inp" placeholder="Matterport, iGuide, YouTube 360..." value={mktTourUrl} onChange={e => setMktTourUrl(e.target.value)} />
            </div>
          )}

          {/* ── Templates pré-definidos ──────────────────────────────────── */}
          <div className="p-card" style={{ marginTop: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '10px' }}>Templates Prontos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.nome}
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                    background: activeTemplate === tpl.nome ? `${tpl.color}10` : 'rgba(14,14,13,.02)',
                    border: `1px solid ${activeTemplate === tpl.nome ? tpl.color + '40' : 'rgba(14,14,13,.06)'}`,
                    borderRadius: '2px', cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: '.9rem' }}>{tpl.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.76rem', color: 'rgba(14,14,13,.75)', fontWeight: 500 }}>{tpl.nome}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: '10px', fontFamily: "'DM Mono',monospace", fontSize: '.3rem',
                        background: `${tpl.color}18`, color: tpl.color, letterSpacing: '.05em',
                      }}>{tpl.categoria}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.preview}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Persona & Languages */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <label className="p-label">Persona-Alvo</label>
                <select className="p-sel" value={mktPersona} onChange={e => setMktPersona(e.target.value)}>
                  {PERSONAS.map((p: Record<string, string>) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <label className="p-label">Idiomas</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {LANGS.map(l => (
                <button key={l.v} onClick={() => toggleLang(l.v)}
                  style={{ padding: '4px 10px', background: mktLangs.includes(l.v) ? '#1c4a35' : 'transparent', border: `1px solid ${mktLangs.includes(l.v) ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: mktLangs.includes(l.v) ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}>
                  {l.l}
                </button>
              ))}
            </div>
          </div>

          <button className="p-btn" style={{ width: '100%' }} onClick={onRunMarketing} disabled={mktLoading}>
            {mktLoading ? '✦ A gerar conteúdo...' : '✦ Gerar Conteúdo Multi-Formato'}
          </button>
        </div>

        {/* ── Output Panel ─────────────────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>

          {/* Copy toast */}
          {showCopyToast && (
            <div style={{
              position: 'absolute', top: '-12px', right: '0', zIndex: 10,
              padding: '6px 14px', background: '#1c4a35', color: '#f4f0e6',
              borderRadius: '2px', fontFamily: "'DM Mono',monospace", fontSize: '.38rem',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,.15)',
              animation: 'fadeInDown .2s ease',
            }}>
              <span>✓ Copiado para área de transferência</span>
              {copyCharCount !== null && (
                <span style={{ opacity: .65 }}>· {copyCharCount.toLocaleString('pt-PT')} chars</span>
              )}
            </div>
          )}

          {/* Format tabs */}
          {mktResult && (
            <>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {FORMATS.map((f) => {
                  const fColor = FORMAT_COLORS[f.id] ?? '#1c4a35'
                  return (
                    <button
                      key={f.id}
                      className={`mkt-tab${mktFormat === f.id ? ' active' : ''}`}
                      onClick={() => setMktFormat(f.id)}
                      style={mktFormat === f.id ? { borderColor: fColor, color: fColor } : {}}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              {/* Language tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                {mktLangs.map(l => (
                  <button key={l} className={`mkt-tab${mktLang === l ? ' active' : ''}`} onClick={() => setMktLang(l)} style={{ fontSize: '.38rem' }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* ── SEO Score melhorado ──────────────────────────────────── */}
              {mktSeoScore !== null && (
                <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.06)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <SeoGauge score={mktSeoScore} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)', marginBottom: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>SEO Score</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      {seoBreakdown.map(item => {
                        const ok = seoDetails?.[item.key] !== false
                        return (
                          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '.6rem', color: ok ? '#22c55e' : '#e05252' }}>{ok ? '✓' : '✗'}</span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: ok ? 'rgba(14,14,13,.55)' : '#e05252' }}>{item.label}</span>
                          </div>
                        )
                      })}
                    </div>
                    {mktSeoScore < 80 && (
                      <div style={{ marginTop: '6px', fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: '#c9a96e', lineHeight: 1.5 }}>
                        Sugestão: adicionar palavras-chave de localização e aumentar comprimento
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mkt-result">{currentContent}</div>

              {/* Char count */}
              <CharCount current={charCount} max={charLimit} />

              {/* Hashtags sugeridas */}
              {mktFormat === 'hashtags' && currentContent && (
                <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(28,74,53,.03)', border: '1px solid rgba(28,74,53,.07)' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.35)', marginBottom: '6px', letterSpacing: '.1em' }}>SUGESTÃO · 20 HASHTAGS</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#1c4a35', lineHeight: 1.8, wordBreak: 'break-word' }}>
                    #realestate #luxuryrealestate #portugal #lisboa #investimento #imoveis #propriedade #casasdesonho #mercadoimobiliario #agencygroup #casas #apartamento #moradia #penthouse #cascais #algarve #porto #imobiliaria #comprarcasa #luxuryhomes
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="p-btn" style={{ flex: 1 }} onClick={handleCopy}>
                  {copied ? '✓ Copiado!' : '📋 Copiar'}
                </button>
              </div>

              {mktPhotoInsights && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)' }}>
                  <div className="p-label" style={{ marginBottom: '6px' }}>Insights das Fotos</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.65)', lineHeight: 1.6 }}>{mktPhotoInsights}</div>
                </div>
              )}

              {/* ── Posting Schedule Grid ─────────────────────────────── */}
              {mktPostingSchedule && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.1)' }}>
                  <div className="p-label" style={{ marginBottom: '10px' }}>Calendário de Publicação</div>
                  <PostingScheduleGrid schedule={mktPostingSchedule} />
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
                      <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.3rem', color: 'rgba(14,14,13,.45)', textTransform: 'capitalize' }}>{platform}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!mktResult && !mktLoading && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✦</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: 'rgba(14,14,13,.4)' }}>Aguarda geração de conteúdo</div>
            </div>
          )}
          {mktLoading && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A gerar conteúdo multi-formato...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
