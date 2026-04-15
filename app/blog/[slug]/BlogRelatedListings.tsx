'use client'

import Link from 'next/link'
import { PROPERTIES, formatPriceFull } from '@/app/imoveis/data'
import { track } from '@/lib/gtm'

// ─── Zone mapping: blog article zona → imoveis zona ───────────────────────────
const ZONA_MAP: Record<string, string> = {
  'Lisboa': 'Lisboa',
  'Cascais': 'Cascais',
  'Comporta': 'Comporta',
  'Porto': 'Porto',
  'Algarve': 'Algarve',
  'Madeira': 'Madeira',
  'Sintra': 'Sintra',
  'Ericeira': 'Ericeira',
  'Arrábida': 'Arrábida',
}

// ─── Keyword → zona fallback mapping ─────────────────────────────────────────
const KEYWORD_ZONE_MAP: Record<string, string> = {
  'american': 'Algarve',
  'british': 'Algarve',
  'french': 'Lisboa',
  'chinês': 'Lisboa',
  'chinese': 'Lisboa',
  'middle east': 'Lisboa',
  'brasileiro': 'Lisboa',
  'invest': '', // all zones
  'nhr': '', // all zones
  'golden visa': '',
  'alojamento local': '',
  'luxury': 'Lisboa',
  'luxo': 'Lisboa',
  'açores': 'Lisboa', // no Açores listings, fallback to Lisboa
}

interface Props {
  articleZona?: string
  articleSlug: string
  articleCategory?: string
  articleKeywords?: string[]
  maxListings?: number
}

export default function BlogRelatedListings({
  articleZona,
  articleSlug,
  articleCategory,
  articleKeywords = [],
  maxListings = 3,
}: Props) {
  // 1. Try direct zona match
  let zone = articleZona ? ZONA_MAP[articleZona] : undefined

  // 2. Fallback: infer from keywords
  if (!zone) {
    const allKw = [...articleKeywords, articleSlug, articleCategory ?? ''].join(' ').toLowerCase()
    for (const [kw, z] of Object.entries(KEYWORD_ZONE_MAP)) {
      if (allKw.includes(kw)) {
        zone = z
        break
      }
    }
  }

  // 3. Select listings
  let listings = zone
    ? PROPERTIES.filter(p => p.zona === zone).slice(0, maxListings)
    : []

  // 4. If not enough, fill with Off-Market or Destaque from any zone
  if (listings.length < maxListings) {
    const extra = PROPERTIES
      .filter(p => (!zone || p.zona !== zone) && (p.badge === 'Off-Market' || p.badge === 'Destaque'))
      .slice(0, maxListings - listings.length)
    listings = [...listings, ...extra]
  }

  // 5. Final fallback: first N properties
  if (listings.length === 0) {
    listings = PROPERTIES.slice(0, maxListings)
  }

  if (listings.length === 0) return null

  const sectionLabel = zone ? `Imóveis em ${zone}` : 'Imóveis Seleccionados'

  return (
    <div style={{
      margin: '2.5rem 0',
      padding: '0',
      borderTop: '2px solid rgba(28,74,53,.12)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 0 16px', flexWrap: 'wrap', gap: '8px',
      }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
            letterSpacing: '.22em', textTransform: 'uppercase',
            color: '#c9a96e', marginBottom: '4px',
          }}>
            Portfolio Exclusivo
          </div>
          <h3 style={{
            fontFamily: "'Cormorant', serif", fontWeight: 300,
            fontSize: '1.35rem', color: '#0c1f15', margin: 0,
          }}>
            {sectionLabel}
          </h3>
        </div>
        <Link
          href={zone ? `/imoveis?zona=${encodeURIComponent(zone)}` : '/imoveis'}
          onClick={() => track('related_listing_clicked', {
            source: 'blog_related_block',
            article: articleSlug,
            zona: zone ?? 'all',
            action: 'see_all',
          })}
          style={{
            fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
            fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
            color: '#1c4a35', textDecoration: 'none',
            borderBottom: '1px solid rgba(28,74,53,.3)',
            paddingBottom: '1px',
          }}
        >
          Ver Todos →
        </Link>
      </div>

      {/* Cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(listings.length, 3)}, 1fr)`,
        gap: '12px',
      }}
        className="blog-related-grid"
      >
        {listings.map(p => (
          <RelatedListingCard
            key={p.id}
            property={p}
            articleSlug={articleSlug}
          />
        ))}
      </div>

      {/* CTA below cards */}
      <div style={{
        marginTop: '16px', padding: '16px',
        background: 'rgba(28,74,53,.04)',
        border: '1px solid rgba(28,74,53,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <p style={{
          fontFamily: "'Jost', sans-serif", fontSize: '.75rem',
          color: 'rgba(14,14,13,.55)', margin: 0, lineHeight: 1.6,
        }}>
          Não encontrou o imóvel certo? Temos propriedades exclusivas<br className="hide-mobile" /> que nunca chegam aos portais.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, li o artigo e gostava de ver imóveis disponíveis.')}`}
            target="_blank" rel="noopener noreferrer"
            onClick={() => track('blog_cta_clicked', {
              cta_type: 'whatsapp',
              article: articleSlug,
              zona: zone ?? 'all',
            })}
            style={{
              background: '#1c4a35', color: '#c9a96e',
              padding: '10px 18px', textDecoration: 'none',
              fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
              fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            }}
          >
            Falar com Consultor →
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 680px) {
          .blog-related-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .blog-related-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Individual listing card ───────────────────────────────────────────────────
function RelatedListingCard({
  property: p,
  articleSlug,
}: {
  property: (typeof PROPERTIES)[0]
  articleSlug: string
}) {
  return (
    <Link
      href={`/imoveis/${p.id}`}
      onClick={() => track('related_listing_clicked', {
        source: 'blog_related_card',
        article: articleSlug,
        property_id: p.id,
        property_zona: p.zona,
        property_price: p.preco,
      })}
      style={{
        display: 'block', textDecoration: 'none',
        border: '1px solid rgba(14,14,13,.08)',
        background: '#fff',
        transition: 'transform .2s, box-shadow .2s',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 8px 32px rgba(14,14,13,.1)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.transform = 'none'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Image placeholder / badge */}
      <div style={{
        height: '120px',
        background: 'linear-gradient(135deg, #0c1f15 0%, #1c4a35 100%)',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {p.badge && (
          <div style={{
            position: 'absolute', top: '10px', left: '10px',
            background: p.badge === 'Off-Market' ? 'rgba(28,74,53,.9)' : '#c9a96e',
            color: p.badge === 'Off-Market' ? '#c9a96e' : '#0c1f15',
            fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
            letterSpacing: '.14em', textTransform: 'uppercase',
            padding: '4px 8px',
          }}>{p.badge}</div>
        )}
        <div style={{
          fontFamily: "'Cormorant', serif", fontSize: '1.6rem',
          color: 'rgba(201,169,110,.35)', fontWeight: 300,
        }}>AG</div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
          letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'rgba(14,14,13,.4)', marginBottom: '4px',
        }}>
          {p.zona} · {p.tipo}
        </div>
        <div style={{
          fontFamily: "'Cormorant', serif", fontSize: '.95rem',
          fontWeight: 400, color: '#0c1f15', lineHeight: 1.3,
          marginBottom: '8px',
        }}>
          {p.nome}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{
            fontFamily: "'Jost', sans-serif", fontSize: '.75rem',
            fontWeight: 600, color: '#1c4a35',
          }}>
            {formatPriceFull(p.preco)}
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
            color: 'rgba(14,14,13,.35)',
          }}>
            {p.area}m² · T{p.quartos}
          </div>
        </div>
      </div>
    </Link>
  )
}
