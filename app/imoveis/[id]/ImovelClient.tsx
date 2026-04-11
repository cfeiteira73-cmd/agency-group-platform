'use client'
import { useState, useMemo, useRef, useEffect, type CSSProperties } from 'react'
import { track } from '@/lib/gtm'

// ─── Zone → advisor mapping (matches ADVISORS data in equipa/page.tsx) ─────────
const ZONE_ADVISOR: Record<string, { name: string; initials: string; whatsapp: string }> = {
  'Lisboa':        { name: 'Carlos Gomes',  initials: 'CG', whatsapp: 'https://wa.me/351919948986' },
  'Cascais':       { name: 'Carlos Gomes',  initials: 'CG', whatsapp: 'https://wa.me/351919948986' },
  'Sintra':        { name: 'Carlos Gomes',  initials: 'CG', whatsapp: 'https://wa.me/351919948986' },
  'Comporta':      { name: 'Maria Fonseca', initials: 'MF', whatsapp: 'https://wa.me/351919948986' },
  'Algarve':       { name: 'Maria Fonseca', initials: 'MF', whatsapp: 'https://wa.me/351919948986' },
  'Madeira':       { name: 'Maria Fonseca', initials: 'MF', whatsapp: 'https://wa.me/351919948986' },
  'Porto':         { name: 'Ricardo Pinto', initials: 'RP', whatsapp: 'https://wa.me/351919948986' },
  'Açores':        { name: 'Ricardo Pinto', initials: 'RP', whatsapp: 'https://wa.me/351919948986' },
}
import Link from 'next/link'
import Image from 'next/image'
import { PROPERTIES, ZONE_YIELDS, formatPriceFull } from '../data'
import FavoriteButton from '../FavoriteButton'
import { getPropertyPhotos } from '../photos'
import VideoSection from '../../components/VideoSection'
import NeighbourhoodIntel from '../../components/NeighbourhoodIntel'
import { NeighborhoodIntel } from '../../components/NeighborhoodIntel'
import Matterport3DTour from '@/app/components/Matterport3DTour'
import { CurrencySelector, useCurrency } from '../../components/CurrencyWidget'
import dynamic from 'next/dynamic'

const SchedulingModal = dynamic(() => import('../../components/SchedulingModal'), { ssr: false })
const FloorplanModal  = dynamic(() => import('../../components/FloorplanModal'),  { ssr: false })
const PriceHistoryChart = dynamic(() => import('../../components/PriceHistoryChart'), { ssr: false })

// ─── Badge colours ─────────────────────────────────────────────────────────────
const BADGE_STYLE: Record<string, CSSProperties> = {
  'Destaque':   { background: '#c9a96e', color: '#0c1f15' },
  'Off-Market': { background: 'rgba(28,74,53,.85)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)' },
  'Novo':       { background: '#1c4a35', color: '#c9a96e' },
  'Exclusivo':  { background: 'rgba(201,169,110,.12)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)' },
}

// ─── Energy rating colour ──────────────────────────────────────────────────────
const ENERGY_COLOR: Record<string, string> = {
  'A+': '#00aa44', 'A': '#33cc55', 'B': '#99cc00', 'B-': '#cccc00',
  'C': '#ffaa00', 'D': '#ff7700', 'E': '#ff3300', 'F': '#cc0000',
}

// ─── Zona slug map ──────────────────────────────────────────────────────────────
const ZONA_SLUG: Record<string, string> = {
  'Lisboa': 'lisboa', 'Cascais': 'cascais', 'Comporta': 'comporta',
  'Porto': 'porto', 'Algarve': 'algarve', 'Madeira': 'madeira',
  'Sintra': 'sintra', 'Ericeira': 'ericeira',
}

// ─── Zone descriptions ──────────────────────────────────────────────────────────
const ZONA_DESC: Record<string, string> = {
  'Lisboa': 'Capital europeia com mercado prime de classe mundial. Liquidez máxima, procura internacional crescente e infraestrutura world-class. Top 5 mundial de luxo (Savills 2026).',
  'Cascais': 'Riviera portuguesa a 30 minutos de Lisboa. Resorts exclusivos, praias premiadas e o lifestyle mais desejado da Europa Atlântica.',
  'Comporta': 'O Hamptons português. Natureza preservada por lei, arrozais centenários, praias desertas. Crescimento de +28% em 2025.',
  'Porto': 'Segunda cidade com mercado em aceleração. Foz do Douro e Boavista lideram o segmento prime. Rendimentos superiores a Lisboa.',
  'Algarve': 'Destino número um de investimento turístico. 300 dias de sol, golfe world-class, marinas internacionais.',
  'Madeira': 'Ilha atlântica com regime fiscal IFICI e clima único. Mercado em forte expansão, nova construção premium, procura internacional.',
  'Sintra': 'Património UNESCO a 30 minutos de Lisboa. Quintas históricas, microclima único, valorização consistente.',
  'Ericeira': 'Reserva Mundial de Surf. Comunidade criativa, proximidade a Lisboa, rendimento turístico excepcional.',
}

// ─── Investment Calc ──────────────────────────────────────────────────────────
function calcInvestment(preco: number, zona: string) {
  const zd = ZONE_YIELDS[zona] || { yield: 3.5, yoy: 10, preco: 4000 }
  const ltv = 0.60
  const equity = Math.round(preco * (1 - ltv))
  const loanAmt = preco * ltv
  const rate = 0.0295 / 12 // Euribor 6M Mar 2026 + spread
  const n = 360
  const monthlyMortgage = Math.round(loanAmt * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1))
  const yieldBruto = zd.yield
  const yieldLiquido = parseFloat((yieldBruto * 0.72).toFixed(2))
  const grossRent = Math.round(preco * yieldBruto / 100 / 12)
  const cashFlow = Math.round(grossRent * 0.72 - monthlyMortgage)
  const irr5yr = parseFloat((yieldLiquido + zd.yoy * 0.4).toFixed(1))
  const coc = parseFloat(((cashFlow * 12 / equity) * 100).toFixed(1))
  return { equity, monthlyMortgage, yieldBruto, yieldLiquido, grossRent, cashFlow, irr5yr, coc }
}

// ─── Main Client Component ────────────────────────────────────────────────────
export default function ImovelClient({ id }: { id: string }) {
  const property = PROPERTIES.find(p => p.id === id)!
  const { formatConverted, currency } = useCurrency()
  const [tourOpen, setTourOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formMsg, setFormMsg] = useState('')
  const [navHov, setNavHov] = useState('')
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [schedulingOpen, setSchedulingOpen] = useState(false)
  const [floorplanOpen, setFloorplanOpen] = useState(false)
  // Touch swipe support
  const touchStartX = useRef<number | null>(null)

  // Property view tracking — fire once per property per session (debounced 5s)
  useEffect(() => {
    const key = `ag_viewed_${id}`
    const lastSeen = parseInt(localStorage.getItem(key) || '0')
    const SESSION_TTL = 24 * 60 * 60 * 1000 // 24h
    if (Date.now() - lastSeen < SESSION_TTL) return
    const timer = setTimeout(() => {
      localStorage.setItem(key, String(Date.now()))
      fetch('/api/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: id }),
      }).catch(() => {})
      track('property_viewed', { property_id: id })
    }, 5000)
    return () => clearTimeout(timer)
  }, [id])

  // Generate gallery frames: use real photos when available, fallback to gradients
  const galleryFrames = useMemo(() => {
    const realPhotos = getPropertyPhotos(property.id)
    if (realPhotos.length > 0) {
      return realPhotos.map(p => ({
        grad: property.grad,
        label: p.label,
        overlay: 'to top, rgba(12,31,21,.55) 0%, transparent 50%',
        photoUrl: p.url,
        thumbUrl: p.thumb,
      }))
    }
    // Fallback to gradient frames
    return [
      { grad: property.grad, label: 'Exterior Principal',   overlay: 'to right, rgba(12,31,21,.6) 0%, rgba(12,31,21,.1) 100%', photoUrl: '', thumbUrl: '' },
      { grad: property.grad, label: 'Sala de Estar',        overlay: 'to bottom-right, rgba(0,0,0,.55) 0%, rgba(12,31,21,.05) 100%', photoUrl: '', thumbUrl: '' },
      { grad: property.grad, label: 'Cozinha',              overlay: '135deg, rgba(12,31,21,.7) 0%, rgba(0,0,0,.1) 100%', photoUrl: '', thumbUrl: '' },
      { grad: property.grad, label: 'Suite Principal',      overlay: 'to top, rgba(12,31,21,.65) 0%, rgba(0,0,0,.05) 100%', photoUrl: '', thumbUrl: '' },
      { grad: property.grad, label: 'Casa de Banho',        overlay: '45deg, rgba(12,31,21,.6) 0%, rgba(12,31,21,.15) 100%', photoUrl: '', thumbUrl: '' },
      { grad: property.grad, label: 'Vista Exterior',       overlay: 'to left, rgba(12,31,21,.5) 0%, rgba(0,0,0,.1) 100%', photoUrl: '', thumbUrl: '' },
      ...(property.piscina ? [{ grad: property.grad, label: 'Piscina',        overlay: 'to bottom, rgba(12,31,21,.45) 0%, rgba(0,30,20,.2) 100%', photoUrl: '', thumbUrl: '' }] : []),
      ...(property.jardim  ? [{ grad: property.grad, label: 'Jardim Privado', overlay: '135deg, rgba(0,20,10,.5) 0%, rgba(12,31,21,.1) 100%', photoUrl: '', thumbUrl: '' }] : []),
      ...(property.terraco ? [{ grad: property.grad, label: 'Terraço',        overlay: 'to right, rgba(12,31,21,.4) 0%, rgba(0,0,0,.05) 100%', photoUrl: '', thumbUrl: '' }] : []),
      ...(property.garagem ? [{ grad: property.grad, label: 'Garagem',        overlay: 'to top-right, rgba(0,0,0,.6) 0%, rgba(12,31,21,.1) 100%', photoUrl: '', thumbUrl: '' }] : []),
    ]
  }, [property])

  const investment = useMemo(() => calcInvestment(property.preco, property.zona), [property])

  const pm2 = Math.round(property.preco / property.area)
  const zonePm2 = ZONE_YIELDS[property.zona]?.preco ?? 4000
  const pm2diff = pm2 > zonePm2 ? 'acima' : 'abaixo'
  const pm2pct = Math.abs(Math.round(((pm2 - zonePm2) / zonePm2) * 100))

  const similar = PROPERTIES.filter(p => p.zona === property.zona && p.id !== property.id).slice(0, 3)

  const waMsg = `Olá, tenho interesse no imóvel ${property.ref} — ${property.nome} (${formatPriceFull(property.preco)}). Podem agendar uma visita?`
  const waFormMsg = formName
    ? `Olá, sou ${formName} (${formPhone}). ${formMsg || `Interesse no ${property.ref} — ${property.nome}`}`
    : waMsg

  const zonaSlug = ZONA_SLUG[property.zona] || property.zona.toLowerCase()

  return (
    <>
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
        <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
          {[['/', 'Início'], ['/imoveis', 'Imóveis'], [`/zonas/${zonaSlug}`, property.zona]].map(([href, label]) => (
            <Link key={href} href={href}
              onMouseEnter={() => setNavHov(href)}
              onMouseLeave={() => setNavHov('')}
              style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
                letterSpacing: '.18em', textTransform: 'uppercase',
                color: navHov === href ? '#c9a96e' : 'rgba(244,240,230,.55)',
                textDecoration: 'none', transition: 'color .2s',
              }}>{label}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CurrencySelector />
          <a
            href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: '#25D366', color: '#fff', padding: '9px 22px',
              fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
              fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >WhatsApp →</a>
        </div>
      </nav>

      <div style={{ background: '#0c1f15', minHeight: '100vh', paddingTop: '68px' }}>

        {/* ── BREADCRUMB ── */}
        <nav aria-label="Localização da propriedade" style={{
          maxWidth: '1280px', margin: '0 auto', padding: '20px 40px 0',
        }}>
          <ol style={{
            display: 'flex', gap: '8px', alignItems: 'center',
            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
            letterSpacing: '.12em', color: 'rgba(244,240,230,.3)',
            flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: 0,
          }}>
            <li><Link href="/" style={{ color: 'rgba(201,169,110,.55)', textDecoration: 'none' }}>Agency Group</Link></li>
            <li aria-hidden="true" style={{ color: 'rgba(255,255,255,.4)' }}>/</li>
            <li><Link href="/imoveis" style={{ color: 'rgba(201,169,110,.55)', textDecoration: 'none' }}>Imóveis</Link></li>
            <li aria-hidden="true" style={{ color: 'rgba(255,255,255,.4)' }}>/</li>
            <li><Link href={`/zonas/${zonaSlug}`} style={{ color: 'rgba(201,169,110,.55)', textDecoration: 'none' }}>{property.zona}</Link></li>
            <li aria-hidden="true" style={{ color: 'rgba(255,255,255,.4)' }}>/</li>
            <li aria-current="page" style={{ color: 'rgba(244,240,230,.5)' }}>{property.nome}</li>
          </ol>
        </nav>

        {/* ── HERO GALLERY ── */}
        <div style={{
          position: 'relative',
          margin: '24px 40px 0',
          maxWidth: 'calc(100vw - 80px)',
          overflow: 'hidden',
        }}>
          {/* Main slide */}
          <div
            style={{
              position: 'relative',
              background: `linear-gradient(${galleryFrames[galleryIdx].grad})`,
              minHeight: '520px',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
            onClick={() => setLightboxOpen(true)}
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              if (touchStartX.current === null) return
              const dx = e.changedTouches[0].clientX - touchStartX.current
              if (Math.abs(dx) > 50) {
                if (dx < 0) setGalleryIdx(i => Math.min(i + 1, galleryFrames.length - 1))
                else setGalleryIdx(i => Math.max(i - 1, 0))
              }
              touchStartX.current = null
            }}
          >
            {galleryFrames[galleryIdx].photoUrl && (
              <Image
                src={galleryFrames[galleryIdx].photoUrl}
                alt={galleryFrames[galleryIdx].label}
                fill
                style={{ objectFit: 'cover', transition: 'opacity .4s' }}
                sizes="(max-width: 768px) 100vw, 1400px"
                priority={galleryIdx === 0}
              />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(${galleryFrames[galleryIdx].overlay})`,
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(12,31,21,.8) 0%, transparent 60%)',
            }} />

            {/* Photo label */}
            <div style={{
              position: 'absolute', top: '20px', left: '20px', zIndex: 5,
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.16em', color: 'rgba(244,240,230,.55)',
              background: 'rgba(12,31,21,.6)', backdropFilter: 'blur(8px)',
              padding: '5px 12px',
            }}>{galleryFrames[galleryIdx].label}</div>

            {/* Gallery counter + Floorplan button */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 5, display: 'flex', gap: '8px' }}>
              <button
                onClick={e => { e.stopPropagation(); setFloorplanOpen(true) }}
                style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.14em', color: '#c9a96e',
                  background: 'rgba(12,31,21,.7)', backdropFilter: 'blur(8px)',
                  padding: '5px 12px', border: '1px solid rgba(201,169,110,.3)',
                  cursor: 'pointer', textTransform: 'uppercase',
                }}>
                📐 Planta
              </button>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.16em', color: 'rgba(244,240,230,.55)',
                background: 'rgba(12,31,21,.6)', backdropFilter: 'blur(8px)',
                padding: '5px 12px', cursor: 'pointer', border: 'none',
              }}
                onClick={e => { e.stopPropagation(); setLightboxOpen(true) }}
              >
                {galleryIdx + 1} / {galleryFrames.length} — Ver Galeria
              </div>
            </div>

            {/* Mobile swipe dot indicators */}
            <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 5 }}>
              {galleryFrames.slice(0, Math.min(galleryFrames.length, 8)).map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setGalleryIdx(i) }}
                  style={{ width: galleryIdx === i ? '20px' : '6px', height: '6px', borderRadius: '3px', background: galleryIdx === i ? '#c9a96e' : 'rgba(244,240,230,.35)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all .3s ease' }} />
              ))}
            </div>

            {/* Content overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              padding: '48px 56px',
            }}>
              {/* Ref + Badge row */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.2em', color: 'rgba(244,240,230,.45)',
                  background: 'rgba(12,31,21,.5)', padding: '5px 12px',
                  backdropFilter: 'blur(8px)',
                }}>{property.ref}</span>
                {property.badge && (
                  <span style={{
                    ...BADGE_STYLE[property.badge],
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.16em', textTransform: 'uppercase',
                    padding: '5px 14px',
                  }}>{property.badge}</span>
                )}
              </div>

              {/* Property name */}
              <h1 style={{
                fontFamily: "'Cormorant', serif", fontWeight: 300,
                fontSize: 'clamp(2rem, 4vw, 3.4rem)', color: '#f4f0e6',
                lineHeight: 1.1, margin: '0 0 12px',
                maxWidth: '700px',
              }}>{property.nome}</h1>

              {/* Zone */}
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.22em', color: 'rgba(201,169,110,.7)',
                marginBottom: '24px',
              }}>{property.zona} · {property.bairro}</div>

            {/* Price */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                fontFamily: "'Cormorant', serif", fontWeight: 300,
                fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#c9a96e',
                letterSpacing: '.04em',
              }}>{formatPriceFull(property.preco)}</div>
              {currency !== 'EUR' && (
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.1em', color: 'rgba(201,169,110,.6)',
                  marginTop: '6px',
                }}>{formatConverted(property.preco)}</div>
              )}
            </div>

            {/* Stats bar */}
            <div style={{
              display: 'flex', gap: '0',
              background: 'rgba(12,31,21,.7)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(201,169,110,.15)',
              width: 'fit-content', flexWrap: 'wrap',
            }}>
              {[
                ['Área', `${property.area} m²`],
                ['Quartos', `T${property.quartos}`],
                ['WC', `${property.casasBanho}`],
                ['Andar', property.andar === 'r/c' ? 'R/C' : property.andar],
                ['EPC', property.energia],
              ].map(([label, val], i) => (
                <div key={label} style={{
                  padding: '14px 24px',
                  borderRight: i < 4 ? '1px solid rgba(201,169,110,.12)' : 'none',
                  minWidth: '80px', textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.14em', color: 'rgba(244,240,230,.35)',
                    marginBottom: '4px', textTransform: 'uppercase',
                  }}>{label}</div>
                  <div style={{
                    fontFamily: "'Cormorant', serif", fontWeight: 600,
                    fontSize: '1.05rem',
                    color: label === 'EPC' ? (ENERGY_COLOR[val] || '#c9a96e') : '#f4f0e6',
                  }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Prev/Next nav */}
          <button
            aria-label="Foto anterior"
            onClick={e => { e.stopPropagation(); setGalleryIdx(i => (i - 1 + galleryFrames.length) % galleryFrames.length) }}
            style={{
              position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'rgba(12,31,21,.7)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(201,169,110,.25)', color: '#c9a96e',
              width: '48px', height: '48px', minWidth: '48px', minHeight: '48px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button
            aria-label="Foto seguinte"
            onClick={e => { e.stopPropagation(); setGalleryIdx(i => (i + 1) % galleryFrames.length) }}
            style={{
              position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
              zIndex: 10,
              background: 'rgba(12,31,21,.7)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(201,169,110,.25)', color: '#c9a96e',
              width: '48px', height: '48px', minWidth: '48px', minHeight: '48px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          {/* Favorite button */}
          <div style={{ position: 'absolute', bottom: '80px', right: '20px', zIndex: 10 }}>
            <FavoriteButton propertyId={property.id} size="lg" />
          </div>

          {/* Tour Virtual button if exists */}
          {property.tourUrl && (
            <button
              onClick={e => { e.stopPropagation(); setTourOpen(true) }}
              style={{
                position: 'absolute', top: '24px', right: '24px',
                zIndex: 10,
                background: 'rgba(12,31,21,.75)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(201,169,110,.35)', color: '#c9a96e',
                padding: '10px 20px',
                fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
              Tour Virtual 3D
            </button>
          )}
          </div>{/* end main slide */}

          {/* Thumbnail strip */}
          <div style={{
            display: 'flex', gap: '4px',
            background: '#070f0a',
            padding: '8px',
            overflowX: 'auto',
          }}>
            {galleryFrames.map((frame, i) => (
              <button
                key={i}
                onClick={() => setGalleryIdx(i)}
                style={{
                  flexShrink: 0,
                  width: '80px', height: '56px',
                  background: `linear-gradient(${frame.grad})`,
                  border: `2px solid ${i === galleryIdx ? '#c9a96e' : 'transparent'}`,
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  transition: 'border-color .2s',
                  padding: 0,
                }}
              >
                {frame.thumbUrl ? (
                  <Image
                    src={frame.thumbUrl}
                    alt={frame.label}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="80px"
                  />
                ) : null}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: i === galleryIdx ? 'rgba(201,169,110,.15)' : 'rgba(12,31,21,.3)',
                }}/>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.06em', color: 'rgba(244,240,230,.7)',
                  background: 'rgba(0,0,0,.5)', padding: '2px 4px',
                  textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', zIndex: 2,
                }}>{frame.label}</div>
              </button>
            ))}
          </div>
        </div>{/* end HERO GALLERY wrapper */}

        {/* ── LIGHTBOX MODAL ── */}
        {lightboxOpen && (
          <>
            <div
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 2000,
                background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(4px)',
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Galeria de fotos: ${property.nome || 'Propriedade'}`}
              style={{
                position: 'fixed', inset: '40px', zIndex: 2001,
                display: 'flex', flexDirection: 'column',
                maxWidth: '1400px', margin: '0 auto',
              }}>
              {/* Lightbox header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0 0 16px',
              }}>
                <div>
                  <div style={{
                    fontFamily: "'Cormorant', serif", fontWeight: 300,
                    fontSize: '1.25rem', color: '#f4f0e6',
                  }}>{property.nome}</div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.14em', color: 'rgba(201,169,110,.6)',
                  }}>{galleryFrames[galleryIdx].label} · {galleryIdx + 1} / {galleryFrames.length}</div>
                </div>
                <button onClick={() => setLightboxOpen(false)} aria-label="Fechar galeria" style={{
                  background: 'none', border: '1px solid rgba(244,240,230,.2)',
                  color: 'rgba(244,240,230,.6)', padding: '8px 16px',
                  cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                  fontSize: '.52rem', letterSpacing: '.1em',
                }}>FECHAR ✕</button>
              </div>

              {/* Main lightbox image */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                <div style={{
                  width: '100%', height: '100%',
                  background: `linear-gradient(${galleryFrames[galleryIdx].grad})`,
                  position: 'relative',
                }}>
                  {galleryFrames[galleryIdx].photoUrl && (
                    <Image
                      src={galleryFrames[galleryIdx].photoUrl}
                      alt={galleryFrames[galleryIdx].label}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="100vw"
                    />
                  )}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(12,31,21,.6) 0%, transparent 60%)',
                  }}/>
                  <div style={{
                    position: 'absolute', bottom: '32px', left: '32px',
                    fontFamily: "'Cormorant', serif", fontWeight: 300,
                    fontSize: '2.5rem', color: 'rgba(244,240,230,.9)',
                    letterSpacing: '.04em', zIndex: 2,
                  }}>{galleryFrames[galleryIdx].label}</div>
                </div>

                {/* Lightbox prev/next */}
                <button
                  onClick={() => setGalleryIdx(i => (i - 1 + galleryFrames.length) % galleryFrames.length)}
                  style={{
                    position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(12,31,21,.8)', border: '1px solid rgba(201,169,110,.3)',
                    color: '#c9a96e', width: '52px', height: '52px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <button
                  onClick={() => setGalleryIdx(i => (i + 1) % galleryFrames.length)}
                  style={{
                    position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(12,31,21,.8)', border: '1px solid rgba(201,169,110,.3)',
                    color: '#c9a96e', width: '52px', height: '52px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>

              {/* Lightbox thumbnails */}
              <div style={{
                display: 'flex', gap: '6px', paddingTop: '12px',
                overflowX: 'auto',
              }}>
                {galleryFrames.map((frame, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIdx(i)}
                    style={{
                      flexShrink: 0, width: '100px', height: '64px',
                      background: `linear-gradient(${frame.grad})`,
                      border: `2px solid ${i === galleryIdx ? '#c9a96e' : 'rgba(244,240,230,.1)'}`,
                      cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: 0,
                    }}
                  >
                    {frame.thumbUrl ? (
                      <Image
                        src={frame.thumbUrl}
                        alt={frame.label}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="100px"
                      />
                    ) : null}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: i === galleryIdx ? 'rgba(201,169,110,.12)' : 'rgba(0,0,0,.3)',
                    }}/>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                      letterSpacing: '.04em', color: 'rgba(244,240,230,.8)',
                      background: 'rgba(0,0,0,.6)', padding: '3px 6px', textAlign: 'center', zIndex: 2,
                    }}>{frame.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── MAIN LAYOUT: Left content + Right sticky card ── */}
        <div style={{
          maxWidth: '1280px', margin: '0 auto',
          padding: '48px 40px 100px',
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: '48px',
          alignItems: 'start',
        }}
          className="imovel-layout"
        >

          {/* ════════ LEFT COLUMN ════════ */}
          <div>

            {/* ── Zone + Bairro tags ── */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
              {[property.zona, property.bairro, property.tipo].map(tag => (
                <span key={tag} style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.16em', color: 'rgba(201,169,110,.7)',
                  background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.2)',
                  padding: '6px 14px', textTransform: 'uppercase',
                }}>{tag}</span>
              ))}
            </div>

            {/* ── Description ── */}
            <p style={{
              fontFamily: "'Jost', sans-serif", fontSize: '.92rem',
              lineHeight: 1.85, color: 'rgba(244,240,230,.65)',
              marginBottom: '40px',
            }}>{property.desc}</p>

            {/* ── Features grid ── */}
            <div style={{ marginBottom: '48px' }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.22em', textTransform: 'uppercase',
                color: 'rgba(201,169,110,.55)', marginBottom: '20px',
              }}>Características</div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
              }}>
                {property.features.map(f => (
                  <div key={f} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'rgba(244,240,230,.03)', border: '1px solid rgba(244,240,230,.07)',
                    padding: '12px 16px',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{
                      fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
                      color: 'rgba(244,240,230,.7)', lineHeight: 1.4,
                    }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Investment Analysis Panel ── */}
            <div style={{
              border: '1px solid rgba(201,169,110,.2)',
              background: 'rgba(201,169,110,.04)',
              padding: '32px', marginBottom: '48px',
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.22em', textTransform: 'uppercase',
                color: 'rgba(201,169,110,.55)', marginBottom: '6px',
              }}>Análise de Investimento</div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.12em', color: 'rgba(244,240,230,.25)',
                marginBottom: '24px',
              }}>60% LTV · Euribor 6M 2,95% + spread · 30 anos</div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px',
                marginBottom: '16px',
              }}>
                {[
                  ['Capital Próprio (40%)', `€ ${investment.equity.toLocaleString('pt-PT')}`],
                  ['Prestação Mensal Est.', `€ ${investment.monthlyMortgage.toLocaleString('pt-PT')}/mês`],
                  ['Yield Bruto', `${investment.yieldBruto}%`],
                  ['Yield Líquido', `${investment.yieldLiquido}%`],
                  ['Renda Estimada', `€ ${investment.grossRent.toLocaleString('pt-PT')}/mês`],
                  ['Cash Flow Mensal', investment.cashFlow >= 0
                    ? `+€ ${investment.cashFlow.toLocaleString('pt-PT')}/mês`
                    : `-€ ${Math.abs(investment.cashFlow).toLocaleString('pt-PT')}/mês`],
                  ['IRR 5 Anos (est.)', `${investment.irr5yr}%`],
                  ['Cash-on-Cash', `${investment.coc}%`],
                ].map(([label, val]) => (
                  <div key={label} style={{
                    background: 'rgba(12,31,21,.5)',
                    border: '1px solid rgba(244,240,230,.06)',
                    padding: '14px 16px',
                  }}>
                    <div style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                      letterSpacing: '.12em', color: 'rgba(244,240,230,.3)',
                      marginBottom: '5px', textTransform: 'uppercase',
                    }}>{label}</div>
                    <div style={{
                      fontFamily: "'Cormorant', serif", fontWeight: 600,
                      fontSize: '1.15rem',
                      color: val.startsWith('+') ? '#4a9c7a' : val.startsWith('-') && label === 'Cash Flow Mensal' ? '#e07070' : '#c9a96e',
                    }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* YoY zone growth */}
              <div style={{
                background: 'rgba(28,74,53,.2)', border: '1px solid rgba(28,74,53,.4)',
                padding: '12px 16px',
                fontFamily: "'Jost', sans-serif", fontSize: '.78rem',
                color: 'rgba(244,240,230,.55)', lineHeight: 1.65,
              }}>
                <strong style={{ color: '#c9a96e' }}>{property.zona}</strong> cresceu{' '}
                <strong style={{ color: '#4a9c7a' }}>+{ZONE_YIELDS[property.zona]?.yoy ?? 10}%</strong>{' '}
                em 2025. Previsão 2026: forte procura internacional mantém valorização.
              </div>
              <div style={{
                marginTop: '10px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.1em', color: 'rgba(244,240,230,.2)',
              }}>
                * Estimativas indicativas. Não constituem aconselhamento financeiro. Consulte o seu banco e consultor fiscal.
              </div>
            </div>

            {/* ── Matterport 3D Tour ── */}
            <div style={{ marginBottom: '48px' }}>
              <Matterport3DTour
                propertyName={property.nome}
                propertyPrice={property.preco}
                compact={false}
              />
            </div>

            {/* ── Location section ── */}
            <div style={{ marginBottom: '48px' }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.22em', textTransform: 'uppercase',
                color: 'rgba(201,169,110,.55)', marginBottom: '16px',
              }}>Sobre {property.zona}</div>
              <p style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.88rem',
                lineHeight: 1.8, color: 'rgba(244,240,230,.55)',
                marginBottom: '16px',
              }}>{ZONA_DESC[property.zona]}</p>
              <Link href={`/zonas/${zonaSlug}`} style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
                color: '#c9a96e', textDecoration: 'none',
                borderBottom: '1px solid rgba(201,169,110,.3)',
                paddingBottom: '2px',
              }}>
                Guia completo de {property.zona} →
              </Link>
            </div>

            {/* ── Market Context ── */}
            <div style={{
              background: 'rgba(244,240,230,.03)', border: '1px solid rgba(244,240,230,.07)',
              padding: '24px 28px', marginBottom: '48px',
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.18em', color: 'rgba(201,169,110,.5)',
                marginBottom: '12px', textTransform: 'uppercase',
              }}>Contexto de Mercado · {property.zona} 2026</div>
              <p style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.86rem',
                lineHeight: 1.8, color: 'rgba(244,240,230,.55)', margin: 0,
              }}>
                Em <strong style={{ color: '#f4f0e6' }}>{property.zona}</strong>, o preço médio é{' '}
                <strong style={{ color: '#c9a96e' }}>€{zonePm2.toLocaleString('pt-PT')}/m²</strong>.{' '}
                Este imóvel está posicionado em{' '}
                <strong style={{ color: '#c9a96e' }}>€{pm2.toLocaleString('pt-PT')}/m²</strong>{' '}
                — <strong style={{ color: pm2diff === 'abaixo' ? '#4a9c7a' : 'rgba(244,240,230,.8)' }}>
                  {pm2pct}% {pm2diff} da média da zona
                </strong>.
                {pm2diff === 'abaixo' && ' Oportunidade de valorização.'}
              </p>
            </div>

            {/* ── CTA: Zona ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(28,74,53,.4) 0%, rgba(12,31,21,.8) 100%)',
              border: '1px solid rgba(28,74,53,.5)',
              padding: '28px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '16px',
              marginBottom: '48px',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.25rem',
                  color: '#f4f0e6', marginBottom: '6px',
                }}>
                  Mais imóveis em {property.zona}?
                </div>
                <div style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
                  color: 'rgba(244,240,230,.45)',
                }}>Ver todo o portfolio disponível nesta zona</div>
              </div>
              <Link href={`/zonas/${zonaSlug}`} style={{
                background: 'rgba(201,169,110,.12)', border: '1px solid rgba(201,169,110,.4)',
                color: '#c9a96e', padding: '12px 28px',
                fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>Ver {property.zona} →</Link>
            </div>

            {/* ── Deal Radar CTA ── */}
            <div style={{
              background: 'rgba(12,31,21,.8)', border: '1px solid rgba(201,169,110,.25)',
              padding: '28px 32px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '16px',
              marginBottom: '48px',
            }}>
              <div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.2em', color: 'rgba(201,169,110,.5)',
                  marginBottom: '6px', textTransform: 'uppercase',
                }}>Deal Radar 16D</div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.2rem',
                  color: '#f4f0e6', marginBottom: '4px',
                }}>Analise este imóvel em profundidade</div>
                <div style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.78rem',
                  color: 'rgba(244,240,230,.4)',
                }}>16 dimensões · Score 0–100 · Oferta óptima · IRR completo</div>
              </div>
              <a href="/#deal-radar" style={{
                background: '#c9a96e', color: '#0c1f15',
                padding: '12px 28px',
                fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>Analisar com Deal Radar →</a>
            </div>

            {/* ── Seller CTA — procura ativa ── */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(201,169,110,0.12)',
              padding: '24px 28px',
              marginBottom: '48px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
            }}>
              <div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                  letterSpacing: '.18em', color: 'rgba(201,169,110,.45)',
                  marginBottom: '6px', textTransform: 'uppercase',
                }}>Procura ativa · {property.zona}</div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.15rem',
                  color: '#f4f0e6', marginBottom: '4px',
                }}>
                  Este tipo de ativo está em procura ativa.
                </div>
                <div style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.78rem',
                  color: 'rgba(244,240,230,.4)',
                }}>
                  Pretende avaliar uma venda discreta?
                </div>
              </div>
              <a
                href={`/off-market`}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(201,169,110,.35)',
                  color: '#c9a96e',
                  padding: '12px 24px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                  fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  transition: 'background 0.2s',
                }}
              >
                Avaliação Confidencial →
              </a>
            </div>

            {/* ── Video Section ── */}
            <VideoSection
              propertyName={property.nome}
              propertyRef={property.ref}
              videoUrl={(property as {videoUrl?: string | null}).videoUrl ?? null}
              zona={property.zona}
              preco={property.preco}
            />

            {/* ── Neighbourhood Intelligence ── */}
            <NeighbourhoodIntel
              lat={property.lat}
              lng={property.lng}
              zona={property.zona}
              bairro={property.bairro}
            />

            {/* ── Price History Chart ── */}
            <div style={{ marginTop: '32px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.55)', marginBottom: '16px' }}>
                Evolução do Mercado · {property.zona}
              </div>
              <PriceHistoryChart zona={property.zona} currentPm2={Math.round(property.preco / property.area)} />
            </div>

            {/* ── Neighborhood Intelligence (detailed scores) ── */}
            <div style={{ marginTop: '32px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.55)', marginBottom: '16px' }}>
                Neighborhood Intelligence · {property.zona}
              </div>
              <NeighborhoodIntel area={property.bairro} zone={property.zona} />
            </div>

            {/* ── Agent Card ── */}
            <div style={{ marginTop: '32px', background: 'linear-gradient(135deg, rgba(201,169,110,.06) 0%, rgba(10,26,16,.5) 100%)', border: '1px solid rgba(201,169,110,.15)', padding: '28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #1c4a35, #0c1f15)', border: '2px solid rgba(201,169,110,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', color: '#c9a96e', fontWeight: 300 }}>CF</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '4px' }}>Consultor Responsável</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', fontWeight: 300, color: '#f4f0e6', marginBottom: '2px' }}>Carlos Feiteira</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: 'rgba(244,240,230,.4)' }}>AMI 22506 · €45M+ vendidos · 127 transacções · 4.9★</div>
              </div>
              <Link href="/agente/carlos" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.6)', textDecoration: 'none', border: '1px solid rgba(201,169,110,.2)', padding: '8px 16px', textTransform: 'uppercase', flexShrink: 0 }}>
                Ver Perfil →
              </Link>
            </div>

            {/* ── Similar Properties ── */}
            {similar.length > 0 && (
              <div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.22em', textTransform: 'uppercase',
                  color: 'rgba(201,169,110,.55)', marginBottom: '20px',
                }}>Imóveis Semelhantes em {property.zona}</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '16px',
                }}>
                  {similar.map(p => (
                    <Link key={p.id} href={`/imoveis/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        border: '1px solid rgba(201,169,110,.12)',
                        background: '#0e2318', overflow: 'hidden',
                        transition: 'border-color .2s',
                      }}>
                        <div style={{
                          height: '120px',
                          background: `linear-gradient(${p.grad})`,
                          position: 'relative',
                        }}>
                          {p.badge && (
                            <span style={{
                              position: 'absolute', top: '10px', right: '10px',
                              ...BADGE_STYLE[p.badge],
                              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                              letterSpacing: '.12em', textTransform: 'uppercase',
                              padding: '3px 8px',
                            }}>{p.badge}</span>
                          )}
                        </div>
                        <div style={{ padding: '14px' }}>
                          <div style={{
                            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                            letterSpacing: '.14em', color: 'rgba(201,169,110,.55)',
                            marginBottom: '5px',
                          }}>{p.bairro}</div>
                          <div style={{
                            fontFamily: "'Cormorant', serif", fontSize: '.95rem',
                            fontWeight: 300, color: '#f4f0e6',
                            marginBottom: '8px', lineHeight: 1.3,
                          }}>{p.nome}</div>
                          <div style={{
                            fontFamily: "'Cormorant', serif", fontSize: '1.05rem',
                            fontWeight: 300, color: '#c9a96e',
                          }}>{formatPriceFull(p.preco)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ════════ RIGHT COLUMN: Sticky Contact Card ════════ */}
          <div style={{ position: 'sticky', top: '90px' }}>
            <div style={{
              background: '#0a1a10',
              border: '1px solid rgba(201,169,110,.2)',
              padding: '32px',
            }}>
              {/* Header */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.2em', color: 'rgba(201,169,110,.5)',
                  marginBottom: '6px', textTransform: 'uppercase',
                }}>Agency Group · AMI 22506</div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontWeight: 300,
                  fontSize: '1.75rem', color: '#c9a96e',
                  letterSpacing: '.04em',
                }}>{formatPriceFull(property.preco)}</div>
                {currency !== 'EUR' && (
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.08em', color: 'rgba(201,169,110,.55)',
                    marginTop: '3px',
                  }}>{formatConverted(property.preco)}</div>
                )}
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.12em', color: 'rgba(244,240,230,.3)',
                  marginTop: '4px',
                }}>€{Math.round(property.preco / property.area).toLocaleString('pt-PT')}/m²</div>
              </div>

              {/* Advisor presence — zone-matched consultant */}
              {ZONE_ADVISOR[property.zona] && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', marginBottom: '16px',
                  background: 'rgba(201,169,110,.05)',
                  border: '1px solid rgba(201,169,110,.12)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1c4a35, #0d2b1f)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '.72rem',
                    color: '#c9a96e', letterSpacing: '.04em',
                  }}>{ZONE_ADVISOR[property.zona].initials}</div>
                  <div>
                    <div style={{
                      fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
                      fontWeight: 600, color: '#f4f0e6',
                    }}>{ZONE_ADVISOR[property.zona].name}</div>
                    <div style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
                      letterSpacing: '.1em', color: 'rgba(201,169,110,.55)',
                      textTransform: 'uppercase', marginTop: '1px',
                    }}>Consultor · {property.zona}</div>
                  </div>
                </div>
              )}

              {/* Premium microsite link (>€3M only) */}
              {property.preco >= 3_000_000 && (
                <Link
                  href={`/imoveis/premium/${property.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', background: 'rgba(201,169,110,.08)', color: '#c9a96e',
                    padding: '11px', marginBottom: '10px',
                    fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                    fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
                    textDecoration: 'none', border: '1px solid rgba(201,169,110,.3)', boxSizing: 'border-box',
                  }}
                >
                  ✦ Ver Microsite Exclusivo
                </Link>
              )}

              {/* Primary CTA — Inline Scheduling */}
              <button
                onClick={() => setSchedulingOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  width: '100%', background: '#c9a96e', color: '#0c1f15',
                  padding: '15px', marginBottom: '10px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                  fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
                  cursor: 'pointer', border: 'none', boxSizing: 'border-box',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Agendar Visita Privada
              </button>

              {/* WhatsApp secondary CTA */}
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  width: '100%', background: '#25D366', color: '#fff',
                  padding: '12px', marginBottom: '10px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                  fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
                  textDecoration: 'none', boxSizing: 'border-box',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.554 4.122 1.523 5.855L0 24l6.29-1.499A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.865 0-3.614-.505-5.12-1.385L2 22l1.418-4.797A10 10 0 112 12 10 10 0 0112 22z"/>
                </svg>
                WhatsApp Imediato
              </a>

              {/* Post-CTA clarity */}
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
                letterSpacing: '.1em', color: 'rgba(244,240,230,.3)',
                textAlign: 'center', marginBottom: '20px', lineHeight: 1.6,
              }}>
                Consultor contacta em menos de 2h · Visita confirmada por WhatsApp · 100% privado
              </div>

              {/* Tour Virtual button */}
              {property.tourUrl && (
                <button
                  onClick={() => setTourOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', background: 'rgba(28,74,53,.25)',
                    border: '1px solid rgba(28,74,53,.6)', color: '#4a9c7a',
                    padding: '12px', marginBottom: '20px',
                    fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                    fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
                    cursor: 'pointer', boxSizing: 'border-box',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                  </svg>
                  Tour Virtual 3D
                </button>
              )}

              {/* Divider */}
              <div style={{ borderTop: '1px solid rgba(244,240,230,.07)', margin: '4px 0 20px' }} />

              {/* Contact form */}
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.14em', color: 'rgba(244,240,230,.35)',
                marginBottom: '12px', textTransform: 'uppercase',
              }}>Pedir informação</div>

              <input
                type="text"
                placeholder="Seu nome"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                style={inputStyle}
              />
              <input
                type="tel"
                placeholder="Telefone / WhatsApp"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                style={inputStyle}
              />
              <textarea
                placeholder="Mensagem (opcional)"
                value={formMsg}
                onChange={e => setFormMsg(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '12px' }}
              />
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent(waFormMsg)}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  background: '#c9a96e', color: '#0c1f15',
                  padding: '13px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
                  fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
                  textDecoration: 'none', marginBottom: '14px', boxSizing: 'border-box',
                }}
              >Enviar via WhatsApp →</a>

              {/* Make offer — text link only */}
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent(`Olá, quero fazer uma proposta para o imóvel ${property.ref} — ${property.nome}. Preço pedido: ${formatPriceFull(property.preco)}.`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  color: 'rgba(244,240,230,.28)',
                  fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
                  letterSpacing: '.12em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >Submeter proposta →</a>
            </div>

            {/* AMI disclaimer */}
            <div style={{
              marginTop: '16px', padding: '0 4px',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.1em', color: 'rgba(244,240,230,.18)',
              lineHeight: 1.65, textTransform: 'uppercase',
            }}>
              Agency Group · Mediação Imobiliária Lda<br />
              AMI 22506 · Comissão 5% · CPCV 50% + Escritura 50%
            </div>
          </div>
        </div>
      </div>

      {/* ── Tour Virtual Modal ── */}
      {tourOpen && property.tourUrl && (
        <div
          onClick={() => setTourOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(12,31,21,.95)', backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '40px',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '1000px',
            background: '#0a1a10', border: '1px solid rgba(201,169,110,.2)',
            position: 'relative',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(244,240,230,.06)',
            }}>
              <div>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.16em', color: 'rgba(201,169,110,.6)',
                }}>TOUR VIRTUAL 3D</span>
                <span style={{
                  marginLeft: '12px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
                  color: 'rgba(244,240,230,.6)',
                }}>{property.nome}</span>
              </div>
              <button
                onClick={() => setTourOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'rgba(244,240,230,.4)',
                  cursor: 'pointer', fontSize: '1rem', padding: '4px 8px',
                }}
              >✕</button>
            </div>
            <iframe
              src={property.tourUrl}
              width="100%"
              height="520"
              style={{ display: 'block', border: 'none' }}
              allowFullScreen
              title={`Tour Virtual — ${property.nome}`}
            />
          </div>
        </div>
      )}

      {/* ── Scheduling Modal ── */}
      {schedulingOpen && (
        <SchedulingModal
          propertyRef={property.ref}
          propertyName={property.nome}
          propertyPreco={formatPriceFull(property.preco)}
          onClose={() => setSchedulingOpen(false)}
        />
      )}

      {/* ── Floorplan Modal ── */}
      {floorplanOpen && (
        <FloorplanModal
          propertyName={property.nome}
          area={property.area}
          quartos={property.quartos}
          casasBanho={property.casasBanho}
          tipo={property.tipo}
          onClose={() => setFloorplanOpen(false)}
        />
      )}

      {/* Responsive layout */}
      <style>{`
        @media (max-width: 960px) {
          .imovel-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(244,240,230,.04)',
  border: '1px solid rgba(244,240,230,.1)',
  borderBottom: '1px solid rgba(201,169,110,.25)',
  color: '#f4f0e6',
  padding: '11px 12px',
  fontFamily: "'Jost', sans-serif",
  fontSize: '.82rem',
  outline: 'none',
  marginBottom: '10px',
  boxSizing: 'border-box',
  letterSpacing: '.02em',
}
