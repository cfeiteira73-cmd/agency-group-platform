'use client'
import { useState, useMemo, useCallback, lazy, Suspense, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { PROPERTIES, ZONAS, TIPOS, formatPriceFull } from './data'
import FavoriteButton, { FavoritesDrawer } from './FavoriteButton'
import CompareBar from './CompareBar'
import { CurrencySelector, useCurrency } from '../components/CurrencyWidget'
import { AIPropertySearch } from '../components/AIPropertySearch'

const MapView = lazy(() => import('./MapView'))

// ─── Badge colours ────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  'Destaque':  { bg: '#c9a96e',       color: '#0c1f15' },
  'Off-Market':{ bg: 'rgba(28,74,53,.85)', color: '#c9a96e' },
  'Novo':      { bg: '#1c4a35',       color: '#c9a96e' },
  'Exclusivo': { bg: 'rgba(201,169,110,.15)', color: '#c9a96e' },
}

type SortKey = 'preco-asc' | 'preco-desc' | 'area-asc' | 'area-desc' | 'recente'
type ViewMode = 'grid' | 'map'

// ─── Urgency triggers — deterministic, consistent across page loads ───────────
function getViewerCount(id: string): number {
  const hash = id.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  return 2 + (Math.abs(hash) % 7) // Always 2-8 viewers
}

function getRecentActivity(id: string): string {
  const hash = id.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  const hours = 1 + (Math.abs(hash) % 23)
  return hours <= 2 ? 'Última visita há 1h' : `Última visita há ${hours}h`
}

export default function ImoveisPage() {
  const [zona,       setZona]       = useState('')
  const [tipo,       setTipo]       = useState('')
  const [preco,      setPreco]      = useState('')
  const [quartos,    setQuartos]    = useState('')
  const [features,   setFeatures]   = useState<string[]>([])
  const [lifestyle,  setLifestyle]  = useState('')
  const [sort,       setSort]       = useState<SortKey>('recente')
  const [viewMode,   setViewMode]   = useState<ViewMode>('grid')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [hoveredId,  setHoveredId]  = useState<string | undefined>(undefined)
  const [mapSelectedId, setMapSelectedId] = useState<string | undefined>(undefined)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function toggleFeature(f: string) {
    setFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    )
  }

  const priceRanges: Record<string, [number, number]> = {
    '500k-1m':  [500_000,   1_000_000],
    '1m-2m':    [1_000_000, 2_000_000],
    '2m-4m':    [2_000_000, 4_000_000],
    '4m+':      [4_000_000, 999_000_000],
  }

  const filtered = useMemo(() => {
    let list = [...PROPERTIES]
    if (zona)    list = list.filter(p => p.zona === zona)
    if (tipo)    list = list.filter(p => p.tipo === tipo)
    if (preco) {
      const r = priceRanges[preco]
      if (r) list = list.filter(p => p.preco >= r[0] && p.preco <= r[1])
    }
    if (quartos) list = list.filter(p => p.quartos >= parseInt(quartos))
    if (features.includes('piscina'))   list = list.filter(p => p.piscina)
    if (features.includes('garagem'))   list = list.filter(p => p.garagem)
    if (features.includes('vista-mar')) list = list.filter(p => ['mar','oceano','Tejo','rio','marina'].includes(p.vista))
    if (features.includes('off-market')) list = list.filter(p => p.badge === 'Off-Market')
    if (lifestyle) list = list.filter(p => (p as {lifestyle?: string[]}).lifestyle?.includes(lifestyle))
    list.sort((a, b) => {
      if (sort === 'preco-asc')  return a.preco - b.preco
      if (sort === 'preco-desc') return b.preco - a.preco
      if (sort === 'area-asc')   return a.area - b.area
      if (sort === 'area-desc')  return b.area - a.area
      return 0
    })
    return list
  }, [zona, tipo, preco, quartos, features, lifestyle, sort])

  function clearAll() {
    setZona(''); setTipo(''); setPreco(''); setQuartos(''); setFeatures([]); setLifestyle('')
  }
  const hasFilters = zona || tipo || preco || quartos || features.length > 0 || lifestyle

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }, [])

  // When a map pin is clicked → highlight + scroll to card
  const handleMapPropertyClick = useCallback((id: string) => {
    setMapSelectedId(id)
    const card = cardRefs.current.get(id)
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Imóveis de Luxo Portugal — Agency Group',
    numberOfItems: PROPERTIES.length,
    itemListElement: PROPERTIES.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://agencygroup.pt/imoveis/${p.id}`,
      name: p.nome,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        background: 'rgba(12,31,21,.96)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(201,169,110,.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '68px',
      }}>
        <Link href="/" style={{
          fontFamily: "'Cormorant', serif", fontSize: '1.25rem', fontWeight: 300,
          color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em',
        }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div className="imoveis-nav-links-desktop" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {['/', '#zonas', '#avaliacao', '#simulador', '#contacto'].map((href, i) => {
            const labels = ['Início', 'Zonas', 'Avaliação', 'Crédito', 'Contacto']
            return (
              <Link key={href} href={href} style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
                letterSpacing: '.18em', textTransform: 'uppercase',
                color: 'rgba(244,240,230,.55)', textDecoration: 'none',
              }}>{labels[i]}</Link>
            )
          })}
          <Link href="/imoveis" style={{
            fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
            letterSpacing: '.18em', textTransform: 'uppercase',
            color: '#c9a96e', textDecoration: 'none',
          }}>Imóveis</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CurrencySelector />
          <a href="https://wa.me/351919948986" target="_blank" rel="noopener noreferrer" style={{
            background: '#c9a96e', color: '#0c1f15', padding: '9px 22px',
            fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
            fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
            textDecoration: 'none',
          }} className="imoveis-nav-cta-desktop">Contacto →</a>
          {/* Hamburger — shown via CSS at <=960px */}
          <button
            className={`nav-burger${mobileMenuOpen ? ' open' : ''}`}
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(v => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`nav-drawer${mobileMenuOpen ? ' open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="nav-drawer-ov" onClick={() => setMobileMenuOpen(false)} />
        <div className="nav-drawer-panel">
          <nav className="nav-drawer-links" aria-label="Menu mobile">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>Início</Link>
            <Link href="/imoveis" onClick={() => setMobileMenuOpen(false)}>Imóveis</Link>
            <Link href="/#zonas" onClick={() => setMobileMenuOpen(false)}>Zonas</Link>
            <Link href="/#avaliacao" onClick={() => setMobileMenuOpen(false)}>Avaliação</Link>
            <Link href="/#simulador" onClick={() => setMobileMenuOpen(false)}>Crédito</Link>
            <Link href="/#contacto" onClick={() => setMobileMenuOpen(false)}>Contacto</Link>
          </nav>
          <a href="https://wa.me/351919948986" target="_blank" rel="noopener noreferrer" className="nav-drawer-cta">Contacto →</a>
        </div>
      </div>

      <div style={{ background: '#0c1f15', minHeight: '100vh', paddingTop: '68px' }}>

        {/* ── PAGE HEADER ── */}
        <div style={{
          background: 'linear-gradient(180deg, #0a1a10 0%, #0c1f15 100%)',
          borderBottom: '1px solid rgba(201,169,110,.1)',
          padding: '72px 40px 56px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
            letterSpacing: '.34em', textTransform: 'uppercase',
            color: 'rgba(201,169,110,.6)', marginBottom: '16px',
          }}>
            Portfolio · 20 Imóveis · Portugal 2026
          </div>
          <h1 style={{
            fontFamily: "'Cormorant', serif", fontWeight: 300,
            fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: '#f4f0e6',
            lineHeight: 1.1, margin: '0 0 20px',
          }}>
            Imóveis de <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>Luxo</em> em Portugal
          </h1>
          <p style={{
            fontFamily: "'Jost', sans-serif", fontSize: '.9rem',
            color: 'rgba(244,240,230,.45)', maxWidth: '520px',
            margin: '0 auto', lineHeight: 1.75,
          }}>
            Lisboa · Cascais · Comporta · Porto · Algarve · Madeira · Sintra · Ericeira
          </p>
          <div style={{
            marginTop: '28px', display: 'flex', justifyContent: 'center',
            gap: '8px', fontFamily: "'DM Mono', monospace",
            fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.3)',
          }}>
            <Link href="/" style={{ color: 'rgba(201,169,110,.55)', textDecoration: 'none' }}>Início</Link>
            <span>/</span>
            <span style={{ color: 'rgba(244,240,230,.5)' }}>Imóveis</span>
          </div>
        </div>

        {/* ── AI PROPERTY SEARCH — Sofia NLP ── */}
        <div style={{ background: '#0c1f15', padding: '0 40px 8px' }}>
          <AIPropertySearch />
        </div>

        {/* ── STICKY FILTER BAR ── */}
        <div style={{
          position: 'sticky', top: '68px', zIndex: 800,
          background: 'rgba(10,22,14,.97)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(201,169,110,.1)',
          padding: '16px 40px',
        }}>
          <div style={{
            maxWidth: '1400px', margin: '0 auto',
            display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
          }}>
            {/* Zona */}
            <select value={zona} onChange={e => setZona(e.target.value)} style={selectStyle}>
              <option value="">Todas as Zonas</option>
              {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
            </select>

            {/* Tipo */}
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={selectStyle}>
              <option value="">Todos os Tipos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Preço */}
            <select value={preco} onChange={e => setPreco(e.target.value)} style={selectStyle}>
              <option value="">Preço</option>
              <option value="500k-1m">€500K – €1M</option>
              <option value="1m-2m">€1M – €2M</option>
              <option value="2m-4m">€2M – €4M</option>
              <option value="4m+">€4M+</option>
            </select>

            {/* Quartos */}
            <select value={quartos} onChange={e => setQuartos(e.target.value)} style={selectStyle}>
              <option value="">Quartos</option>
              <option value="1">T1+</option>
              <option value="2">T2+</option>
              <option value="3">T3+</option>
              <option value="4">T4+</option>
              <option value="5">T5+</option>
            </select>

            {/* Feature toggles */}
            {[
              { key: 'piscina',    label: 'Piscina' },
              { key: 'garagem',    label: 'Garagem' },
              { key: 'vista-mar',  label: 'Vista Mar' },
              { key: 'off-market', label: 'Off-Market' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => toggleFeature(f.key)}
                style={{
                  background: features.includes(f.key) ? '#c9a96e' : 'rgba(244,240,230,.06)',
                  color: features.includes(f.key) ? '#0c1f15' : 'rgba(244,240,230,.55)',
                  border: `1px solid ${features.includes(f.key) ? '#c9a96e' : 'rgba(244,240,230,.1)'}`,
                  padding: '8px 16px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                  letterSpacing: '.12em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >{f.label}</button>
            ))}

            {/* Lifestyle filter */}
            <select
              value={lifestyle}
              onChange={e => setLifestyle(e.target.value)}
              style={{
                background: lifestyle ? '#c9a96e' : 'rgba(244,240,230,.06)',
                color: lifestyle ? '#0c1f15' : 'rgba(244,240,230,.55)',
                border: `1px solid ${lifestyle ? '#c9a96e' : 'rgba(244,240,230,.1)'}`,
                padding: '8px 16px',
                fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                letterSpacing: '.08em', textTransform: 'uppercase',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">🌍 Lifestyle</option>
              <option value="golf">⛳ Golf</option>
              <option value="surf">🏄 Surf</option>
              <option value="seafront">🌊 Frente Mar</option>
              <option value="nature">🌿 Natureza</option>
              <option value="historic">🏛️ Histórico</option>
              <option value="marina">⛵ Marina</option>
              <option value="city">🌆 Cidade</option>
              <option value="equestrian">🐎 Equestre</option>
            </select>

            {/* Clear */}
            {hasFilters && (
              <button onClick={clearAll} style={{
                background: 'none', border: '1px solid rgba(244,240,230,.15)',
                color: 'rgba(244,240,230,.35)', padding: '8px 14px',
                fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer',
              }}>Limpar ✕</button>
            )}

            {/* Right: view toggle + sort */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* View mode toggle */}
              <div style={{
                display: 'flex',
                border: '1px solid rgba(244,240,230,.1)',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    background: viewMode === 'grid' ? 'rgba(201,169,110,.15)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    padding: '8px 14px',
                    color: viewMode === 'grid' ? '#c9a96e' : 'rgba(244,240,230,.4)',
                    transition: 'all .2s',
                  }}
                  title="Vista em grelha"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  style={{
                    background: viewMode === 'map' ? 'rgba(201,169,110,.15)' : 'transparent',
                    border: 'none', borderLeft: '1px solid rgba(244,240,230,.1)', cursor: 'pointer',
                    padding: '8px 14px',
                    color: viewMode === 'map' ? '#c9a96e' : 'rgba(244,240,230,.4)',
                    transition: 'all .2s',
                  }}
                  title="Vista em mapa"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </button>
              </div>

              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.12em', color: 'rgba(244,240,230,.3)',
              }}>ORDENAR</span>
              <select
                value={sort} onChange={e => setSort(e.target.value as SortKey)}
                style={{ ...selectStyle, minWidth: '150px' }}
              >
                <option value="recente">Recente</option>
                <option value="preco-asc">Preço ↑</option>
                <option value="preco-desc">Preço ↓</option>
                <option value="area-asc">Área ↑</option>
                <option value="area-desc">Área ↓</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── RESULTS COUNT ── */}
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          padding: '20px 40px 0',
          fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
          letterSpacing: '.16em', color: 'rgba(244,240,230,.35)',
          textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <span>
            <span style={{ color: '#c9a96e' }}>{filtered.length}</span>
            {' '}imóve{filtered.length !== 1 ? 'is' : 'l'} encontrado{filtered.length !== 1 ? 's' : ''}
          </span>
          {compareIds.length > 0 && (
            <span style={{ color: 'rgba(201,169,110,.6)' }}>
              · {compareIds.length} selecionado{compareIds.length !== 1 ? 's' : ''} para comparar
            </span>
          )}
        </div>

        {/* ── MAP SPLIT VIEW ── */}
        {viewMode === 'map' && (
          <div style={{
            display: 'flex',
            height: 'calc(100vh - 136px)', /* 68px nav + 68px filter bar */
            overflow: 'hidden',
          }}>
            {/* Left: scrollable property list */}
            <div style={{
              width: '44%',
              overflowY: 'auto',
              padding: '16px',
              background: '#0c1f15',
              borderRight: '1px solid rgba(201,169,110,.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {filtered.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '60px 20px',
                  border: '1px solid rgba(201,169,110,.12)',
                }}>
                  <div style={{
                    fontFamily: "'Cormorant', serif", fontSize: '1.6rem',
                    fontWeight: 300, color: 'rgba(201,169,110,.6)', marginBottom: '12px',
                  }}>Nenhum imóvel encontrado</div>
                  <p style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
                    color: 'rgba(244,240,230,.35)', lineHeight: 1.75,
                  }}>Tente outros filtros ou contacte-nos.</p>
                </div>
              ) : (
                filtered.map(p => (
                  <div
                    key={p.id}
                    ref={el => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id) }}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(undefined)}
                  >
                    <MapListCard
                      property={p}
                      isHighlighted={mapSelectedId === p.id || hoveredId === p.id}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Right: sticky map */}
            <div style={{ width: '56%', position: 'relative', height: '100%' }}>
              <Suspense fallback={
                <div style={{
                  width: '100%', height: '100%', background: '#0e2318',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.2em', color: 'rgba(201,169,110,.5)',
                }}>
                  A carregar mapa...
                </div>
              }>
                <div style={{ height: '100%' }}>
                  <MapView
                    properties={filtered}
                    selectedId={hoveredId ?? mapSelectedId}
                    onPropertyClick={handleMapPropertyClick}
                    onDrawFilter={ids => {
                      // Filter the visible list to drawn area
                      // We signal this via a custom event for now — the draw filter
                      // already updates the map markers; filtered list stays as-is
                      // unless the user also triggers a zone/filter change
                      void ids
                    }}
                  />
                </div>
              </Suspense>
            </div>
          </div>
        )}

        {/* ── GRID VIEW ── */}
        {viewMode === 'grid' && (
          <div style={{
            maxWidth: '1400px', margin: '0 auto',
            padding: '28px 40px 100px',
          }}>
            {filtered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '100px 40px',
                border: '1px solid rgba(201,169,110,.12)',
              }}>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontSize: '2rem',
                  fontWeight: 300, color: 'rgba(201,169,110,.6)',
                  marginBottom: '16px',
                }}>
                  Nenhum imóvel encontrado
                </div>
                <p style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.85rem',
                  color: 'rgba(244,240,230,.35)', marginBottom: '32px', lineHeight: 1.75,
                }}>
                  Tente outros filtros ou contacte-nos — temos imóveis off-market<br />
                  que nunca chegam aos portais.
                </p>
                <a
                  href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, não encontrei o que procuro no vosso site. Podem ajudar-me?')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    background: '#25D366', color: '#fff',
                    padding: '14px 36px',
                    fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                    fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase',
                    textDecoration: 'none',
                  }}
                >
                  Falar com Consultor no WhatsApp →
                </a>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '24px',
                }}
                className="imoveis-grid"
              >
                {filtered.map(p => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    inCompare={compareIds.includes(p.id)}
                    canAddCompare={compareIds.length < 3}
                    onToggleCompare={toggleCompare}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── COMPARE BAR ── */}
      <CompareBar
        selected={compareIds}
        properties={PROPERTIES}
        onRemove={id => setCompareIds(prev => prev.filter(x => x !== id))}
        onClear={() => setCompareIds([])}
      />

      {/* ── FAVORITES DRAWER ── */}
      <FavoritesDrawer />

      {/* Responsive grid override */}
      <style>{`
        @media (max-width: 1100px) { .imoveis-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 680px)  { .imoveis-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}

// ─── Property Card ────────────────────────────────────────────────────────────
function PropertyCard({
  property: p,
  inCompare,
  canAddCompare,
  onToggleCompare,
}: {
  property: (typeof PROPERTIES)[0]
  inCompare: boolean
  canAddCompare: boolean
  onToggleCompare: (id: string) => void
}) {
  const [hov, setHov] = useState(false)
  const { formatConverted, currency } = useCurrency()
  const pm2 = Math.round(p.preco / p.area)

  return (
    <div style={{ position: 'relative' }}>
      {/* Compare checkbox */}
      <button
        onClick={() => onToggleCompare(p.id)}
        title={inCompare ? 'Remover da comparação' : canAddCompare ? 'Adicionar à comparação' : 'Máximo 3 imóveis'}
        style={{
          position: 'absolute', top: '14px', left: '14px', zIndex: 10,
          width: '24px', height: '24px',
          background: inCompare ? '#c9a96e' : 'rgba(12,31,21,.75)',
          border: `2px solid ${inCompare ? '#c9a96e' : 'rgba(244,240,230,.25)'}`,
          backdropFilter: 'blur(8px)',
          cursor: (!canAddCompare && !inCompare) ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s',
          opacity: (!canAddCompare && !inCompare) ? 0.4 : 1,
        }}
      >
        {inCompare && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0c1f15" strokeWidth="3">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        )}
      </button>

      {/* Favorite button */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
        <FavoriteButton propertyId={p.id} size="sm" />
      </div>

      <Link
        href={`/imoveis/${p.id}`}
        style={{ textDecoration: 'none' }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        <div style={{
          background: '#0e2318',
          border: `1px solid ${hov ? 'rgba(201,169,110,.35)' : inCompare ? 'rgba(201,169,110,.3)' : 'rgba(201,169,110,.1)'}`,
          transition: 'border-color .25s, transform .25s, box-shadow .25s',
          transform: hov ? 'translateY(-4px)' : 'none',
          boxShadow: hov ? '0 24px 64px rgba(0,0,0,.45)' : '0 4px 20px rgba(0,0,0,.2)',
          cursor: 'pointer', overflow: 'hidden',
        }}>

          {/* Gradient image area */}
          <div style={{
            height: '220px',
            background: `linear-gradient(${p.grad})`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(12,31,21,.7) 0%, transparent 60%)',
            }} />

            {/* Ref badge */}
            <div style={{
              position: 'absolute', top: '14px', left: '42px',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.18em', color: 'rgba(244,240,230,.45)',
              background: 'rgba(12,31,21,.6)', padding: '4px 10px',
              backdropFilter: 'blur(8px)',
            }}>{p.ref}</div>

            {/* Badge */}
            {p.badge && (
              <div style={{
                position: 'absolute', top: '14px', right: '52px',
                ...BADGE_COLORS[p.badge],
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.16em', textTransform: 'uppercase',
                padding: '5px 12px',
              }}>{p.badge}</div>
            )}

            {/* Urgency trigger — deterministic viewer count */}
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(12,31,21,0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(201,169,110,0.3)',
              borderRadius: 4, padding: '4px 10px',
              fontSize: '0.65rem', letterSpacing: '0.1em',
              color: '#c9a96e', display: 'flex', alignItems: 'center', gap: 6,
              zIndex: 2
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              {getViewerCount(p.id)} a ver agora
            </div>

            {/* Icons bottom-left */}
            <div style={{
              position: 'absolute', bottom: '14px', left: '14px',
              display: 'flex', gap: '8px',
            }}>
              {p.piscina && (
                <span style={iconChipStyle} title="Piscina">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
                    <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
                    <circle cx="7" cy="5" r="3"/>
                  </svg>
                </span>
              )}
              {p.garagem && (
                <span style={iconChipStyle} title="Garagem">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </span>
              )}
              {['mar','oceano','Tejo','rio','marina'].includes(p.vista) && (
                <span style={iconChipStyle} title="Vista Mar">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
                  </svg>
                </span>
              )}
              {p.tourUrl && (
                <span style={{ ...iconChipStyle, color: '#c9a96e', borderColor: 'rgba(201,169,110,.4)' }} title="Tour 3D">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                </span>
              )}
            </div>

            {/* Energia label */}
            <div style={{
              position: 'absolute', bottom: '14px', right: '14px',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.12em', color: '#c9a96e',
              background: 'rgba(12,31,21,.55)', padding: '3px 8px',
            }}>EPC {p.energia}</div>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 20px 22px' }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.18em', color: 'rgba(201,169,110,.65)',
              marginBottom: '8px', textTransform: 'uppercase',
            }}>
              {p.zona} · {p.bairro}
            </div>

            <h3 style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: '1.18rem', color: '#f4f0e6',
              lineHeight: 1.25, margin: '0 0 14px',
            }}>{p.nome}</h3>

            <div style={{
              display: 'flex', gap: '16px',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.1em', color: 'rgba(244,240,230,.4)',
              marginBottom: '16px',
            }}>
              <span>{p.area} m²</span>
              <span>T{p.quartos}</span>
              <span>{p.casasBanho} WC</span>
              {p.andar !== 'r/c' ? <span>{p.andar} andar</span> : <span>R/C</span>}
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              borderTop: '1px solid rgba(244,240,230,.06)', paddingTop: '14px',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300,
                  fontSize: '1.4rem', color: '#c9a96e',
                }}>
                  {formatPriceFull(p.preco)}
                </div>
                {currency !== 'EUR' && (
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.08em', color: 'rgba(201,169,110,.5)',
                    marginTop: '2px',
                  }}>{formatConverted(p.preco)}</div>
                )}
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.1em', color: 'rgba(244,240,230,.3)',
                }}>€{pm2.toLocaleString('pt-PT')}/m²</div>
              </div>

              <div style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
                color: hov ? '#0c1f15' : '#c9a96e',
                background: hov ? '#c9a96e' : 'transparent',
                border: '1px solid rgba(201,169,110,.4)',
                padding: '8px 16px',
                transition: 'all .2s',
              }}>Ver Imóvel →</div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Shared select style ──────────────────────────────────────────────────────
const selectStyle: CSSProperties = {
  background: 'rgba(244,240,230,.06)',
  border: '1px solid rgba(244,240,230,.1)',
  color: 'rgba(244,240,230,.65)',
  padding: '8px 14px',
  fontFamily: "'Jost', sans-serif",
  fontSize: '.65rem',
  letterSpacing: '.08em',
  cursor: 'pointer',
  outline: 'none',
  minWidth: '130px',
}

const iconChipStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '24px', height: '24px',
  background: 'rgba(12,31,21,.65)', backdropFilter: 'blur(8px)',
  color: 'rgba(201,169,110,.8)',
  border: '1px solid rgba(201,169,110,.2)',
}

// ─── Map List Card (compact card for split-view left panel) ──────────────────
function MapListCard({
  property: p,
  isHighlighted,
}: {
  property: (typeof PROPERTIES)[0]
  isHighlighted: boolean
}) {
  const { formatConverted, currency } = useCurrency()

  return (
    <Link href={`/imoveis/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: isHighlighted ? '#0e2318' : 'rgba(14,35,24,.6)',
        border: `1px solid ${isHighlighted ? 'rgba(201,169,110,.5)' : 'rgba(201,169,110,.12)'}`,
        transition: 'border-color .2s, background .2s, box-shadow .2s',
        boxShadow: isHighlighted ? '0 8px 32px rgba(0,0,0,.4)' : 'none',
        display: 'flex',
        gap: '14px',
        padding: '14px',
        cursor: 'pointer',
        transform: isHighlighted ? 'translateX(2px)' : 'none',
      }}>
        {/* Color swatch (gradient thumbnail) */}
        <div style={{
          width: '90px',
          minWidth: '90px',
          height: '70px',
          background: `linear-gradient(${p.grad})`,
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {p.badge && (
            <div style={{
              position: 'absolute', bottom: '4px', left: '4px',
              background: 'rgba(12,31,21,.85)',
              fontFamily: "'DM Mono', monospace",
              fontSize: '.42rem', letterSpacing: '.12em',
              color: '#c9a96e', padding: '2px 6px',
              textTransform: 'uppercase',
            }}>{p.badge}</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
            letterSpacing: '.14em', color: 'rgba(201,169,110,.6)',
            marginBottom: '4px', textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {p.zona} · {p.bairro}
          </div>
          <div style={{
            fontFamily: "'Cormorant', serif", fontWeight: 300,
            fontSize: '.95rem', color: '#f4f0e6',
            lineHeight: 1.2, marginBottom: '6px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{p.nome}</div>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
            letterSpacing: '.08em', color: 'rgba(244,240,230,.35)',
            marginBottom: '6px',
          }}>
            {p.area}m² · T{p.quartos} · {p.casasBanho} WC
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{
                fontFamily: "'Cormorant', serif", fontWeight: 300,
                fontSize: '1.05rem', color: '#c9a96e',
              }}>
                {formatPriceFull(p.preco)}
              </div>
              {currency !== 'EUR' && (
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
                  letterSpacing: '.06em', color: 'rgba(201,169,110,.45)',
                }}>{formatConverted(p.preco)}</div>
              )}
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
              letterSpacing: '.1em', color: isHighlighted ? '#c9a96e' : 'rgba(244,240,230,.25)',
              transition: 'color .2s',
            }}>
              Ver →
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
