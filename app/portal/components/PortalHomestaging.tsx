'use client'
import { useState, useRef } from 'react'

const HS_STYLES = [
  { id: 'moderno',      label: 'Moderno',      emoji: '◼', desc: 'Clean lines · Neutral palette' },
  { id: 'escandinavo',  label: 'Escandinavo',  emoji: '◻', desc: 'Light wood · Hygge · Linen' },
  { id: 'luxo',         label: 'Luxo',         emoji: '✦', desc: 'Marble · Gold · Bespoke' },
  { id: 'minimalista',  label: 'Minimalista',  emoji: '—', desc: 'Zero clutter · Zen volumes' },
  { id: 'industrial',   label: 'Industrial',   emoji: '⬡', desc: 'Brick · Steel · Edison' },
  { id: 'mediterraneo', label: 'Mediterrâneo', emoji: '○', desc: 'Terracotta · Arches · Warm' },
  { id: 'classico',     label: 'Clássico',     emoji: '⬘', desc: 'Elegant · Rich fabrics · Walnut' },
  { id: 'japandi',      label: 'Japandi',      emoji: '〇', desc: 'Wabi-sabi · Natural · Muted' },
]

const HS_ROOMS = [
  { id: 'sala',       label: 'Sala' },
  { id: 'quarto',     label: 'Quarto' },
  { id: 'cozinha',    label: 'Cozinha' },
  { id: 'casa_banho', label: 'Casa de Banho' },
  { id: 'varanda',    label: 'Varanda' },
  { id: 'escritorio', label: 'Escritório' },
  { id: 'entrada',    label: 'Entrada' },
  { id: 'garagem',    label: 'Garagem' },
]

export default function PortalHomestaging() {
  const [hsImage, setHsImage] = useState<string | null>(null)
  const [hsImageName, setHsImageName] = useState('')
  const [hsStyle, setHsStyle] = useState('moderno')
  const [hsRoomType, setHsRoomType] = useState('sala')
  const [hsVariations, setHsVariations] = useState(1)
  const [hsStrength, setHsStrength] = useState(0.68)
  const [hsLoading, setHsLoading] = useState(false)
  const [hsError, setHsError] = useState<string | null>(null)
  const [hsResults, setHsResults] = useState<{ base64: string; seed: number }[]>([])
  const [hsSelected, setHsSelected] = useState(0)
  const [hsSlider, setHsSlider] = useState(50)
  const [hsDragOver, setHsDragOver] = useState(false)
  const hsFileRef = useRef<HTMLInputElement>(null)
  const hsSliderRef = useRef<HTMLDivElement>(null)

  const handleHsFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setHsImageName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setHsImage(e.target?.result as string)
      setHsResults([])
      setHsError(null)
    }
    reader.readAsDataURL(file)
  }

  const generateStaging = async () => {
    if (!hsImage) return
    setHsLoading(true)
    setHsError(null)
    setHsResults([])
    try {
      const res = await fetch('/api/homestaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: hsImage,
          style: hsStyle,
          room_type: hsRoomType,
          variations: hsVariations,
          control_strength: hsStrength,
        }),
      })
      const data = await res.json() as { success?: boolean; images?: { base64: string; seed: number }[]; error?: string }
      if (!res.ok || !data.success) {
        setHsError(data.error ?? 'Erro a gerar staging')
      } else {
        setHsResults(data.images ?? [])
        setHsSelected(0)
        setHsSlider(50)
      }
    } catch (e) {
      setHsError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setHsLoading(false)
    }
  }

  const downloadImage = (base64: string, idx: number) => {
    const a = document.createElement('a')
    a.href = `data:image/jpeg;base64,${base64}`
    a.download = `staging_${hsStyle}_${hsRoomType}_v${idx + 1}.jpg`
    a.click()
  }

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = hsSliderRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    setHsSlider(Math.max(0, Math.min(100, (x / rect.width) * 100)))
  }

  const currentResult = hsResults[hsSelected]

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>Stability AI Structure Control · 8 Estilos · Antes/Depois</div>
      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: '#0e0e0d', marginBottom: '4px' }}>Home Staging <em style={{ color: '#1c4a35' }}>IA</em></div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)', marginBottom: '24px' }}>Transforma qualquer divisão mantendo a geometria exacta — paredes, janelas, portas, áreas inalteradas</div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* LEFT CONTROLS */}
        <div>
          {/* Upload zone */}
          <div className="p-card" style={{ marginBottom: '16px', padding: '0' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', padding: '10px 14px 6px' }}>✦ Fotografia Original</div>
            <div
              onDragOver={e => { e.preventDefault(); setHsDragOver(true) }}
              onDragLeave={() => setHsDragOver(false)}
              onDrop={e => { e.preventDefault(); setHsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleHsFile(f) }}
              onClick={() => hsFileRef.current?.click()}
              style={{
                margin: '0 14px 14px',
                border: `2px dashed ${hsDragOver ? '#1c4a35' : 'rgba(14,14,13,.15)'}`,
                background: hsDragOver ? 'rgba(28,74,53,.04)' : 'rgba(14,14,13,.02)',
                cursor: 'pointer',
                minHeight: hsImage ? 'auto' : '120px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s',
                overflow: 'hidden',
              }}>
              {hsImage ? (
                <div style={{ position: 'relative', width: '100%' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hsImage} alt="original" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.5)', padding: '4px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{hsImageName || 'Imagem carregada'}</span>
                    <span style={{ color: 'rgba(255,255,255,.6)' }}>clica para alterar</span>
                  </div>
                </div>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.2)" strokeWidth="1.5"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.3)', marginTop: '8px', textAlign: 'center', letterSpacing: '.06em' }}>Arrasta ou clica para carregar<br />JPG · PNG · WEBP</div>
                </>
              )}
            </div>
            <input ref={hsFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleHsFile(f) }} />
          </div>

          {/* Room Type */}
          <div className="p-card" style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '10px' }}>✦ Tipo de Divisão</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {HS_ROOMS.map(r => (
                <button key={r.id} onClick={() => setHsRoomType(r.id)}
                  style={{
                    fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.06em',
                    padding: '5px 10px', border: '1px solid', cursor: 'pointer', transition: 'all .15s',
                    background: hsRoomType === r.id ? '#1c4a35' : 'transparent',
                    color: hsRoomType === r.id ? '#fff' : 'rgba(14,14,13,.5)',
                    borderColor: hsRoomType === r.id ? '#1c4a35' : 'rgba(14,14,13,.15)',
                  }}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* Style Grid */}
          <div className="p-card" style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '10px' }}>✦ Estilo de Decoração</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {HS_STYLES.map(s => (
                <button key={s.id} onClick={() => setHsStyle(s.id)}
                  style={{
                    textAlign: 'left', padding: '8px 10px', cursor: 'pointer', transition: 'all .15s',
                    background: hsStyle === s.id ? 'rgba(28,74,53,.08)' : 'transparent',
                    border: `1px solid ${hsStyle === s.id ? '#1c4a35' : 'rgba(14,14,13,.1)'}`,
                  }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: hsStyle === s.id ? '#1c4a35' : 'rgba(14,14,13,.7)', fontWeight: hsStyle === s.id ? 600 : 400 }}>
                    {s.emoji} {s.label}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.33rem', color: 'rgba(14,14,13,.35)', marginTop: '2px' }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="p-card" style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '10px' }}>✦ Opções</div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.5)', marginBottom: '4px' }}>Variações: <strong style={{ color: '#1c4a35' }}>{hsVariations}</strong></div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setHsVariations(n)}
                    style={{
                      flex: 1, padding: '5px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer', border: '1px solid',
                      background: hsVariations === n ? '#1c4a35' : 'transparent',
                      color: hsVariations === n ? '#fff' : 'rgba(14,14,13,.5)',
                      borderColor: hsVariations === n ? '#1c4a35' : 'rgba(14,14,13,.15)',
                    }}>{n}×</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.5)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Fidelidade estrutural</span>
                <strong style={{ color: '#1c4a35' }}>{Math.round(hsStrength * 100)}%</strong>
              </div>
              <input type="range" min="0.4" max="0.85" step="0.05" value={hsStrength}
                onChange={e => setHsStrength(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#1c4a35' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: 'rgba(14,14,13,.3)' }}>
                <span>Mais criativo</span><span>Mais fiel</span>
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button onClick={generateStaging} disabled={!hsImage || hsLoading}
            style={{
              width: '100%', padding: '13px', fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
              letterSpacing: '.14em', textTransform: 'uppercase', cursor: (!hsImage || hsLoading) ? 'not-allowed' : 'pointer',
              background: (!hsImage || hsLoading) ? 'rgba(14,14,13,.08)' : '#1c4a35',
              color: (!hsImage || hsLoading) ? 'rgba(14,14,13,.3)' : '#fff',
              border: 'none', transition: 'all .2s',
            }}>
            {hsLoading ? '◌ A gerar staging...' : '✦ Gerar Home Staging'}
          </button>

          {hsError && (
            <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: '#dc2626' }}>
              {hsError}
            </div>
          )}
        </div>

        {/* RIGHT: Preview */}
        <div>
          {hsResults.length > 0 && currentResult ? (
            <>
              {hsResults.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {hsResults.map((_, i) => (
                    <button key={i} onClick={() => setHsSelected(i)}
                      style={{
                        flex: 1, padding: '7px', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.06em',
                        textTransform: 'uppercase', cursor: 'pointer', border: '1px solid',
                        background: hsSelected === i ? '#1c4a35' : 'transparent',
                        color: hsSelected === i ? '#fff' : 'rgba(14,14,13,.5)',
                        borderColor: hsSelected === i ? '#1c4a35' : 'rgba(14,14,13,.15)',
                      }}>Variação {i + 1}</button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '8px', fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>◀ ANTES</span>
                <span style={{ color: 'rgba(14,14,13,.25)' }}>— arrasta para comparar —</span>
                <span>DEPOIS ▶</span>
              </div>

              <div
                ref={hsSliderRef}
                onMouseMove={e => { if (e.buttons === 1) handleSliderMove(e) }}
                onClick={handleSliderMove}
                style={{
                  position: 'relative', width: '100%', aspectRatio: '16/9',
                  overflow: 'hidden', cursor: 'col-resize', userSelect: 'none',
                  border: '1px solid rgba(14,14,13,.1)',
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/jpeg;base64,${currentResult.base64}`} alt="depois"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${hsSlider}%`, overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hsImage!} alt="antes"
                    style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${100 / hsSlider * 100}%`, maxWidth: 'none', objectFit: 'cover' }} />
                </div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hsSlider}%`, width: '2px', background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,.4)', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '32px', height: '32px', borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', fontWeight: 700, pointerEvents: 'none' }}>⇔</div>
                </div>
                <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,.55)', padding: '3px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: '#fff', letterSpacing: '.06em' }}>ANTES</div>
                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(28,74,53,.85)', padding: '3px 8px', fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: '#fff', letterSpacing: '.06em' }}>DEPOIS · {HS_STYLES.find(s => s.id === hsStyle)?.label}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => downloadImage(currentResult.base64, hsSelected)}
                  style={{ flex: 1, padding: '9px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', background: '#1c4a35', color: '#fff', border: 'none' }}>
                  ↓ Download JPG
                </button>
                <button onClick={() => { const link = document.createElement('a'); link.href = hsImage!; link.download = `original_${hsImageName || 'foto'}`; link.click() }}
                  style={{ padding: '9px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', color: 'rgba(14,14,13,.5)' }}>
                  ↓ Original
                </button>
                <button onClick={generateStaging} disabled={hsLoading}
                  style={{ padding: '9px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase', cursor: hsLoading ? 'not-allowed' : 'pointer', background: 'transparent', border: '1px solid rgba(28,74,53,.3)', color: '#1c4a35' }}>
                  ↻ Novo
                </button>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Estilo', val: HS_STYLES.find(s => s.id === hsStyle)?.label },
                  { label: 'Divisão', val: HS_ROOMS.find(r => r.id === hsRoomType)?.label },
                  { label: 'Fidelidade', val: `${Math.round(hsStrength * 100)}%` },
                  { label: 'Seed', val: String(currentResult.seed) },
                ].map(item => (
                  <div key={item.label} style={{ padding: '4px 10px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.07)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{item.label}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#1c4a35', fontWeight: 600 }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </>
          ) : hsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', border: '1px solid rgba(14,14,13,.08)', background: 'rgba(14,14,13,.02)' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.1em', textTransform: 'uppercase' }}>◌ A processar...</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', marginTop: '8px' }}>Stability AI · Structure Control · ~15-30s</div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '6px' }}>
                {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
                  <div key={o} style={{ width: '6px', height: '6px', borderRadius: '50%', background: `rgba(28,74,53,${o})`, animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${o * 0.2}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', border: '1px dashed rgba(14,14,13,.12)', background: 'rgba(14,14,13,.02)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(14,14,13,.12)" strokeWidth="1"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.2)', marginTop: '16px', textAlign: 'center' }}>
                Carrega uma foto · escolhe o estilo · gera
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '320px' }}>
                {['Moderno', 'Luxo', 'Japandi', 'Escandinavo', 'Industrial', 'Mediterrâneo'].map(s => (
                  <div key={s} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.2)', border: '1px solid rgba(14,14,13,.06)', padding: '3px 8px' }}>{s}</div>
                ))}
              </div>
              <div style={{ marginTop: '20px', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.18)', textAlign: 'center', lineHeight: 1.6 }}>
                Paredes · janelas · portas · áreas<br />mantidos exactamente como estão
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
