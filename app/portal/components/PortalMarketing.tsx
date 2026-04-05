'use client'
import { useRef } from 'react'
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

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Conteúdo Multi-Formato</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Marketing AI</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>Idealista · Instagram · LinkedIn · WhatsApp · Email · +6 formatos</div>
      </div>

      <div className="mkt-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Input Panel */}
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

        {/* Output Panel */}
        <div>
          {/* Format tabs */}
          {mktResult && (
            <>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {FORMATS.map((f) => (
                  <button key={f.id} className={`mkt-tab${mktFormat === f.id ? ' active' : ''}`} onClick={() => setMktFormat(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Language tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                {mktLangs.map(l => (
                  <button key={l} className={`mkt-tab${mktLang === l ? ' active' : ''}`} onClick={() => setMktLang(l)} style={{ fontSize: '.38rem' }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {mktSeoScore !== null && (
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>SEO Score:</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: mktSeoScore >= 80 ? '#4a9c7a' : mktSeoScore >= 60 ? '#c9a96e' : '#dc2626', fontWeight: 700 }}>{mktSeoScore}/100</div>
                </div>
              )}

              <div className="mkt-result">{currentContent}</div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="p-btn" style={{ flex: 1 }} onClick={onCopyContent}>
                  {copied ? '✓ Copiado!' : '📋 Copiar'}
                </button>
              </div>

              {mktPhotoInsights && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)' }}>
                  <div className="p-label" style={{ marginBottom: '6px' }}>Insights das Fotos</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.65)', lineHeight: 1.6 }}>{mktPhotoInsights}</div>
                </div>
              )}

              {mktPostingSchedule && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.1)' }}>
                  <div className="p-label" style={{ marginBottom: '8px' }}>Calendário de Publicação</div>
                  {Object.entries(mktPostingSchedule).map(([fmt, sched]) => (
                    <div key={fmt} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(14,14,13,.05)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.5)' }}>{fmt}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#c9a96e' }}>{sched.day} · {sched.time}</div>
                    </div>
                  ))}
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
