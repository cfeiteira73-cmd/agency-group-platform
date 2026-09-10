'use client'
// ─── /app/partilhar/page.tsx — Public Property Share Page ────────────────────
// No auth required. Property data is decoded from the ?d= URL param.
// Accessible to anyone who receives a share link from the portal.

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import Link from 'next/link'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SharedProperty {
  ref: string
  nome: string
  zona: string
  bairro?: string
  tipo: string
  preco: number
  area: number
  quartos: number
  casasBanho: number
  badge?: string
  status?: string
  piscina?: boolean
  garagem?: boolean
  jardim?: boolean
  terraco?: boolean
  listingDate?: string
  descricao?: string
  imagens?: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(n: number): string {
  if (n >= 1_000_000) return `€ ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2).replace('.', ',')}M`
  return `€ ${n.toLocaleString('pt-PT')}`
}

function formatPriceM2(preco: number, area: number): string {
  if (!area) return '—'
  return `€${Math.round(preco / area).toLocaleString('pt-PT')}/m²`
}

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  'Destaque':   { bg: '#c9a96e',            color: '#0c1f15' },
  'Off-Market': { bg: 'rgba(28,74,53,.85)', color: '#c9a96e' },
  'Novo':       { bg: '#1c4a35',            color: '#c9a96e' },
  'Exclusivo':  { bg: 'rgba(201,169,110,.15)', color: '#c9a96e' },
}

// ─── Photo Gallery Component ───────────────────────────────────────────────────
function PhotoGallery({ imagens }: { imagens: string[] }) {
  const [current, setCurrent] = useState(0)
  const [imgError, setImgError] = useState<Record<number, boolean>>({})

  const validImagens = imagens.filter((_, i) => !imgError[i])

  if (!validImagens.length) return <PlaceholderHero />

  const realIdx = imagens.indexOf(validImagens[current] ?? imagens[0])

  return (
    <div style={{ position: 'relative', height: 420, background: '#0c1f15', overflow: 'hidden' }}>
      {/* Main photo */}
      <img
        src={imagens[realIdx] ?? imagens[0]}
        alt=""
        onError={() => setImgError(prev => ({ ...prev, [realIdx]: true }))}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transition: 'opacity .3s',
        }}
      />
      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(12,31,21,.2) 0%, transparent 40%, rgba(12,31,21,.5) 100%)',
      }} />

      {/* Navigation arrows */}
      {validImagens.length > 1 && (
        <>
          <button onClick={() => setCurrent(c => (c - 1 + validImagens.length) % validImagens.length)}
            style={{
              position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(12,31,21,.6)', border: '1px solid rgba(201,169,110,.3)',
              color: '#c9a96e', width: 38, height: 38, borderRadius: '50%',
              fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
          <button onClick={() => setCurrent(c => (c + 1) % validImagens.length)}
            style={{
              position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(12,31,21,.6)', border: '1px solid rgba(201,169,110,.3)',
              color: '#c9a96e', width: 38, height: 38, borderRadius: '50%',
              fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>›</button>
        </>
      )}

      {/* Counter */}
      {validImagens.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '1rem', right: '1rem',
          background: 'rgba(12,31,21,.7)', color: '#c9a96e',
          padding: '.25rem .65rem', borderRadius: 20,
          fontFamily: "'Jost', sans-serif", fontSize: '.72rem', letterSpacing: '.06em',
        }}>
          {current + 1} / {validImagens.length}
        </div>
      )}

      {/* Thumbnail strip */}
      {validImagens.length > 1 && (
        <div style={{
          position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '.35rem',
        }}>
          {validImagens.slice(0, 8).map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 24 : 8, height: 8, borderRadius: 4, border: 'none',
                background: i === current ? '#c9a96e' : 'rgba(201,169,110,.4)',
                cursor: 'pointer', padding: 0, transition: 'all .2s',
              }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Placeholder when no photos ────────────────────────────────────────────────
function PlaceholderHero() {
  return (
    <div style={{
      height: 340,
      background: 'linear-gradient(135deg, rgba(28,74,53,.8) 0%, rgba(12,31,21,.95) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 120%, rgba(201,169,110,.08) 0%, transparent 70%)',
      }} />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ color: 'rgba(201,169,110,.3)', fontSize: '5rem', lineHeight: 1 }}>◈</div>
        <div style={{ color: 'rgba(201,169,110,.4)', fontSize: '.7rem', letterSpacing: '.2em', marginTop: '.5rem' }}>
          AGENCY GROUP · PORTFOLIO EXCLUSIVO
        </div>
      </div>
    </div>
  )
}

// ─── Inner component (needs useSearchParams — must be inside Suspense) ─────────
function PartilharContent() {
  const params = useSearchParams()
  const raw = params.get('d')

  let property: SharedProperty | null = null
  let decodeError = false

  if (raw) {
    try {
      property = JSON.parse(decodeURIComponent(raw)) as SharedProperty
    } catch {
      decodeError = true
    }
  }

  // ── Invalid / missing data ──────────────────────────────────────────────────
  if (!property || decodeError) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0c1f15', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: "'Jost', sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#c9a96e', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>◇</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '.5rem' }}>Link inválido ou expirado</div>
          <div style={{ fontSize: '.85rem', color: 'rgba(201,169,110,.6)', marginBottom: '2rem' }}>
            Por favor solicite um novo link ao consultor.
          </div>
          <Link href="/imoveis" style={{
            background: '#c9a96e', color: '#0c1f15', padding: '.75rem 2rem',
            borderRadius: 4, textDecoration: 'none', fontWeight: 700, fontSize: '.85rem',
            letterSpacing: '.06em',
          }}>
            VER PORTFÓLIO →
          </Link>
        </div>
      </div>
    )
  }

  const p = property
  const badge = p.badge && BADGE_COLORS[p.badge] ? p.badge : null
  const features: { label: string; show: boolean }[] = [
    { label: 'Piscina', show: !!p.piscina },
    { label: 'Garagem', show: !!p.garagem },
    { label: 'Jardim', show: !!p.jardim },
    { label: 'Terraço', show: !!p.terraco },
  ]
  const hasFeatures = features.some(f => f.show)
  const hasImagens = Array.isArray(p.imagens) && p.imagens.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#0c1f15', fontFamily: "'Jost', sans-serif" }}>
      {/* ── Google Fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Jost:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0c1f15; }
        .ag-chip { display: inline-flex; align-items: center; gap: .35rem; background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.25); border-radius: 4px; padding: .2rem .6rem; font-size: .72rem; font-weight: 600; letter-spacing: .06em; color: #c9a96e; }
      `}</style>

      {/* ── Header / Nav ── */}
      <header style={{
        borderBottom: '1px solid rgba(201,169,110,.15)',
        padding: '.9rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#c9a96e', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 600, letterSpacing: '.12em' }}>
          AGENCY GROUP
        </Link>
        <span style={{ color: 'rgba(201,169,110,.45)', fontSize: '.72rem', fontWeight: 500, letterSpacing: '.1em' }}>
          AMI 22506
        </span>
      </header>

      {/* ── Hero: gallery or placeholder ── */}
      <div style={{ position: 'relative' }}>
        {hasImagens ? (
          <PhotoGallery imagens={p.imagens!} />
        ) : (
          <PlaceholderHero />
        )}

        {/* Badge overlay */}
        {badge && (
          <div style={{
            position: 'absolute', top: '1rem', left: '1rem',
            background: BADGE_COLORS[badge].bg,
            color: BADGE_COLORS[badge].color,
            padding: '.25rem .75rem', borderRadius: 3,
            fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em',
            zIndex: 10,
          }}>
            {badge.toUpperCase()}
          </div>
        )}

        {/* Ref tag */}
        <div style={{
          position: 'absolute', top: '1rem', right: '1rem',
          color: 'rgba(201,169,110,.8)', fontSize: '.7rem', letterSpacing: '.12em',
          fontFamily: "'Jost', monospace",
          background: 'rgba(12,31,21,.6)', padding: '.2rem .5rem', borderRadius: 3,
          zIndex: 10,
        }}>
          {p.ref}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Location breadcrumb */}
        <div style={{ color: 'rgba(201,169,110,.5)', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.1em', marginBottom: '.6rem' }}>
          {[p.zona, p.bairro].filter(Boolean).join(' · ').toUpperCase()} · {p.tipo?.toUpperCase()}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          color: '#f4f0e6', fontSize: 'clamp(1.6rem, 5vw, 2.6rem)',
          fontWeight: 600, lineHeight: 1.15, marginBottom: '1.25rem',
        }}>
          {p.nome}
        </h1>

        {/* Price row */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap',
          borderBottom: '1px solid rgba(201,169,110,.15)', paddingBottom: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ color: '#c9a96e', fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 600 }}>
            {formatPrice(p.preco)}
          </div>
          {p.area > 0 && (
            <div style={{ color: 'rgba(201,169,110,.5)', fontSize: '.8rem', fontWeight: 500, letterSpacing: '.04em' }}>
              {formatPriceM2(p.preco, p.area)}
            </div>
          )}
        </div>

        {/* Key stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '1px', background: 'rgba(201,169,110,.12)',
          borderRadius: 6, overflow: 'hidden', marginBottom: '1.5rem',
        }}>
          {[
            { label: 'Área', value: p.area > 0 ? `${p.area} m²` : '—' },
            { label: 'Quartos', value: p.quartos > 0 ? `T${p.quartos}` : '—' },
            { label: 'WC', value: p.casasBanho > 0 ? String(p.casasBanho) : '—' },
            { label: 'Tipo', value: p.tipo || '—' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(12,31,21,.6)', padding: '1rem .75rem', textAlign: 'center',
            }}>
              <div style={{ color: '#c9a96e', fontWeight: 600, fontSize: '1rem', marginBottom: '.2rem' }}>
                {stat.value}
              </div>
              <div style={{ color: 'rgba(201,169,110,.45)', fontSize: '.68rem', letterSpacing: '.08em' }}>
                {stat.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        {hasFeatures && (
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {features.filter(f => f.show).map(f => (
              <span key={f.label} className="ag-chip">{f.label}</span>
            ))}
          </div>
        )}

        {/* Description */}
        {p.descricao && (
          <div style={{
            color: 'rgba(244,240,230,.7)', fontSize: '.92rem', lineHeight: 1.8,
            marginBottom: '2rem',
            borderLeft: '2px solid rgba(201,169,110,.25)',
            paddingLeft: '1rem',
            fontStyle: 'normal',
          }}>
            {p.descricao}
          </div>
        )}

        {/* CTA */}
        <div style={{
          background: 'rgba(28,74,53,.25)', border: '1px solid rgba(201,169,110,.2)',
          borderRadius: 8, padding: '1.5rem', marginBottom: '2rem',
        }}>
          <div style={{ color: '#f4f0e6', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 600, marginBottom: '.4rem' }}>
            Interessado neste imóvel?
          </div>
          <div style={{ color: 'rgba(244,240,230,.5)', fontSize: '.82rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            A nossa equipa está disponível para agendar visita, fornecer informação completa e acompanhá-lo ao longo de todo o processo.
          </div>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <a href={`https://wa.me/351910000000?text=Olá, tenho interesse no imóvel ${p.ref} — ${p.nome}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                background: '#1c4a35', color: '#c9a96e',
                padding: '.7rem 1.5rem', borderRadius: 4, textDecoration: 'none',
                fontWeight: 700, fontSize: '.78rem', letterSpacing: '.06em',
                border: '1px solid rgba(201,169,110,.3)',
              }}>
              CONTACTAR VIA WHATSAPP
            </a>
            <Link href="/contacto"
              style={{
                background: 'transparent', color: 'rgba(201,169,110,.7)',
                padding: '.7rem 1.5rem', borderRadius: 4, textDecoration: 'none',
                fontWeight: 600, fontSize: '.78rem', letterSpacing: '.06em',
                border: '1px solid rgba(201,169,110,.2)',
              }}>
              ENVIAR MENSAGEM
            </Link>
          </div>
        </div>

        {/* Back to portfolio */}
        <div style={{ textAlign: 'center' }}>
          <Link href="/imoveis" style={{
            color: 'rgba(201,169,110,.5)', fontSize: '.75rem', letterSpacing: '.1em',
            textDecoration: 'none', fontWeight: 500,
          }}>
            ← VER PORTFÓLIO COMPLETO
          </Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid rgba(201,169,110,.1)',
        padding: '1.25rem 1.5rem',
        textAlign: 'center',
        color: 'rgba(201,169,110,.3)',
        fontSize: '.7rem', letterSpacing: '.08em',
      }}>
        AGENCY GROUP · MEDIAÇÃO IMOBILIÁRIA LDA · AMI 22506 · Lisboa, Portugal
      </footer>
    </div>
  )
}

// ─── Page export ───────────────────────────────────────────────────────────────
export default function PartilharPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0c1f15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#c9a96e', fontFamily: 'Jost, sans-serif', fontSize: '.85rem', letterSpacing: '.1em' }}>
          A carregar…
        </div>
      </div>
    }>
      <PartilharContent />
    </Suspense>
  )
}
