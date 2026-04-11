// ─── /imoveis/[id]/page.tsx — Luxury Property Detail Showcase ─────────────────
// Server Component (Next.js App Router). No 'use client' at top level.
// For known IDs → renders the full ImovelClient (existing rich component).
// For unknown / generated IDs → renders this full server-side showcase page.
// Brand: #0c1f15 · #1c4a35 · #c9a96e · #f4f0e6
// Fonts: Cormorant · Jost · DM Mono (Google Fonts, inline import)

import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PROPERTIES, PROPERTY_IDS, ZONE_YIELDS, formatPriceFull } from '../data'
import type { Property } from '../data'
import ImovelClient from './ImovelClient'
import ShareButton from './ShareButton'
import { BreadcrumbJsonLd } from '@/app/components/BreadcrumbJsonLd'
import { buildOgImageUrl } from '@/lib/og'
import HeyGenEmbed from '@/app/components/HeyGenEmbed'
import LeadCaptureForm from '@/app/components/LeadCaptureForm'

// ─── Static params ─────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return PROPERTY_IDS.map(id => ({ id }))
}

// ─── Mock data generator for IDs not in the portfolio ─────────────────────────
function generateMockProperty(id: string): Property {
  const num = Math.abs(
    id.replace('AG-2026-', '').split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  ) % 100 || 1

  const zonas  = ['Lisboa', 'Cascais', 'Comporta', 'Porto', 'Algarve', 'Madeira', 'Sintra', 'Ericeira']
  const tipos  = ['Apartamento', 'Moradia', 'Villa', 'Quinta', 'Herdade']
  const nomes  = ['Penthouse Exclusiva', 'Villa Contemporânea', 'Apartamento Premium',
                  'Moradia de Prestígio', 'Quinta Histórica', 'Residência de Luxo']
  const grads  = [
    '135deg, #1c3a5e, #0c1f15', '135deg, #0d2b1a, #061510',
    '135deg, #2a1a05, #150d00', '135deg, #0a1e2a, #050d14',
    '135deg, #1e2a0a, #0f1503', '135deg, #2a1e0a, #150f03',
  ]
  const bairros: Record<string, string[]> = {
    Lisboa:   ['Príncipe Real', 'Chiado', 'Campo de Ourique', 'Lapa', 'Estrela', 'Alfama'],
    Cascais:  ['Cascais Centro', 'Quinta da Marinha', 'Estoril', 'Birre'],
    Comporta: ['Comporta', 'Carvalhal', 'Brejos da Carregueira'],
    Porto:    ['Foz do Douro', 'Boavista', 'Cedofeita', 'Bonfim'],
    Algarve:  ['Vale do Lobo', 'Vilamoura', 'Lagos', 'Tavira', 'Albufeira'],
    Madeira:  ['Funchal', 'Câmara de Lobos', 'Caniçal'],
    Sintra:   ['Sintra Vila', 'Colares', 'Azenhas do Mar'],
    Ericeira: ['Ericeira', 'Mafra', 'São Julião do Tojal'],
  }

  const zona   = zonas[num % zonas.length]
  const tipo   = tipos[num % tipos.length]
  const bList  = bairros[zona] ?? ['Centro']
  const bairro = bList[(num + 3) % bList.length]
  const quartos = (num % 4) + 2
  const area    = 110 + (num % 12) * 25
  const preco   = 750_000 + (num % 28) * 125_000
  const pm2     = Math.round(preco / area)

  return {
    id,
    ref: id,
    nome: `${nomes[num % nomes.length]} ${bairro}`,
    zona, bairro, tipo, preco, area, quartos,
    casasBanho: Math.max(2, quartos - 1),
    andar: num % 5 === 0 ? 'r/c' : `${(num % 6) + 1}º`,
    energia: (['A+', 'A', 'B'] as const)[num % 3],
    vista: (['mar', 'jardim', 'cidade', 'golfe', 'natureza'] as const)[num % 5],
    piscina: num % 3 === 0,
    garagem: true,
    jardim: num % 2 === 0,
    terraco: true,
    condominio: num % 2 === 1,
    badge: num % 7 === 0 ? 'Destaque' : num % 11 === 0 ? 'Off-Market' : null,
    status: 'Ativo',
    desc: `${tipo} de luxo em ${bairro}, ${zona}. Localização privilegiada com acabamentos premium de autor. Espaços luminosos, design atemporal e qualidade construtiva excepcional. Uma oportunidade única no mercado imobiliário português, a ${15 + (num % 20)} minutos do centro.`,
    features: [
      `Área total ${area}m²`,
      `${quartos} quartos suite`,
      'Acabamentos premium de autor',
      'Parqueamento incluído',
      `Certificação energética ${(['A+', 'A', 'B'] as const)[num % 3]}`,
      `${pm2.toLocaleString('pt-PT')} €/m² — referência zona`,
    ],
    tourUrl: null,
    grad: grads[num % grads.length],
    lat:  38.7169 + ((num * 137) % 100) * 0.004,
    lng: -9.1399 - ((num * 97)  % 100) * 0.004,
    lifestyle: ['city'],
    videoUrl: null,
    virtualTourEmbed: null,
  }
}

// ─── generateMetadata ──────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const p = PROPERTIES.find(x => x.id === id) ?? generateMockProperty(id)
  const price = formatPriceFull(p.preco)
  const title = `${p.nome} · ${p.zona} · ${price} | Agency Group`
  const desc  = `${p.tipo} em ${p.bairro}, ${p.zona}. ${p.area}m² · T${p.quartos} · ${price}. ${p.desc.slice(0, 110)}… AMI 22506.`

  return {
    title,
    description: desc,
    robots: p.badge === 'Off-Market' ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    alternates: { canonical: `https://www.agencygroup.pt/imoveis/${id}` },
    openGraph: {
      title,
      description: desc,
      type: 'website',
      url: `https://www.agencygroup.pt/imoveis/${id}`,
      siteName: 'Agency Group',
      locale: 'pt_PT',
      images: [{
        url: buildOgImageUrl({
          title: p.nome,
          subtitle: `${p.bairro}, ${p.zona}`,
          zone: p.zona,
          price: formatPriceFull(p.preco),
          type: 'property',
        }),
        width: 1200,
        height: 630,
        alt: `${p.nome} — Agency Group`,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      site: '@agencygroup_pt',
      images: [buildOgImageUrl({
        title: p.nome,
        subtitle: `${p.bairro}, ${p.zona}`,
        zone: p.zona,
        price: formatPriceFull(p.preco),
        type: 'property',
      })],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ImovelPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Unknown IDs → 404 (prevents infinite URL generation / crawl budget waste)
  if (!PROPERTY_IDS.includes(id)) notFound()

  const breadcrumbItems = [
    { name: 'Início', url: 'https://www.agencygroup.pt' },
    { name: 'Imóveis', url: 'https://www.agencygroup.pt/imoveis' },
    {
      name: PROPERTIES.find(x => x.id === id)?.nome ?? 'Propriedade',
      url: `https://www.agencygroup.pt/imoveis/${id}`,
    },
  ]

  // Build Property schema — at this point id is always a known ID
  const prop = PROPERTIES.find(x => x.id === id) ?? generateMockProperty(id)
  const propertySchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: prop.nome,
    description: prop.desc,
    offers: {
      '@type': 'Offer',
      price: prop.preco,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'RealEstateAgent',
        name: 'Agency Group',
        url: 'https://www.agencygroup.pt',
      },
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: prop.zona,
      addressCountry: 'PT',
    },
  }

  // Known IDs → use the existing rich ImovelClient (photo gallery, modals, etc.)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(propertySchema) }}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <ImovelClient id={id} />
    </>
  )

}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function vistaLabel(v: string) {
  const m: Record<string, string> = {
    mar: 'Vista Mar', oceano: 'Vista Oceano', Tejo: 'Vista Tejo',
    rio: 'Vista Rio', marina: 'Vista Marina', jardim: 'Vista Jardim',
    cidade: 'Vista Cidade', golfe: 'Vista Golfe', natureza: 'Vista Natureza',
  }
  return m[v] ?? v
}

const BADGE_CSS: Record<string, CSSProperties> = {
  Destaque:     { background: '#c9a96e',               color: '#0c1f15' },
  'Off-Market': { background: 'rgba(28,74,53,.9)',      color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)' },
  Novo:         { background: '#1c4a35',               color: '#c9a96e' },
  Exclusivo:    { background: 'rgba(201,169,110,.12)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)' },
}

// ─── QR Code SVG placeholder ───────────────────────────────────────────────────
function QRCodeSVG({ url }: { url: string }) {
  const cells = 13
  const cellPx = 14
  const size = cells * cellPx

  // Deterministic pseudo-random from URL
  let seed = url.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 42)
  function rand() {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }

  // Finder pattern occupies top-left 7×7, top-right 7×7, bottom-left 7×7
  const finderMask = (r: number, c: number) => {
    const tl = r < 7 && c < 7
    const tr = r < 7 && c >= cells - 7
    const bl = r >= cells - 7 && c < 7
    return tl || tr || bl
  }
  // Inside finder — solid/hollow/solid rings
  const finderPixel = (r: number, c: number, fr: number, fc: number): boolean => {
    const dr = r - fr, dc = c - fc
    const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3))
    if (ring <= 1) return true   // inner 3×3
    if (ring === 2) return false // white ring
    if (ring === 3) return true  // outer border
    return false
  }

  const isFinderOn = (r: number, c: number): boolean => {
    if (r < 7 && c < 7) return finderPixel(r, c, 0, 0)
    if (r < 7 && c >= cells - 7) return finderPixel(r, c, 0, cells - 7)
    if (r >= cells - 7 && c < 7) return finderPixel(r, c, cells - 7, 0)
    return false
  }

  // Pre-build the grid
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if (finderMask(r, c)) return isFinderOn(r, c)
      return rand() > 0.42
    })
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      <div style={{
        padding: '14px',
        background: '#f4f0e6',
        border: '1px solid rgba(201,169,110,.3)',
        lineHeight: 0,
      }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width={size} height={size} fill="#f4f0e6" />
          {grid.map((row, r) =>
            row.map((on, c) =>
              on ? (
                <rect
                  key={`${r}-${c}`}
                  x={c * cellPx}
                  y={r * cellPx}
                  width={cellPx}
                  height={cellPx}
                  fill="#0c1f15"
                />
              ) : null
            )
          )}
          {/* AG monogram in centre */}
          <rect
            x={Math.floor(cells / 2) * cellPx - cellPx * 1.5}
            y={Math.floor(cells / 2) * cellPx - cellPx * 1.5}
            width={cellPx * 3}
            height={cellPx * 3}
            fill="#f4f0e6"
          />
          <text
            x={Math.floor(cells / 2) * cellPx + cellPx / 2}
            y={Math.floor(cells / 2) * cellPx + cellPx * 1.1}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize="15"
            fontWeight="400"
            fill="#c9a96e"
            letterSpacing="1"
          >AG</text>
        </svg>
      </div>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '.52rem',
        letterSpacing: '.12em',
        color: 'rgba(244,240,230,.3)',
        textAlign: 'center',
        maxWidth: '220px',
        wordBreak: 'break-all',
      }}>
        {url}
      </div>
    </div>
  )
}

// ─── Amenity chip ──────────────────────────────────────────────────────────────
function Chip({ icon, label, gold = false }: { icon: string; label: string; gold?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: gold ? 'rgba(201,169,110,.1)' : 'rgba(28,74,53,.28)',
      border: `1px solid ${gold ? 'rgba(201,169,110,.3)' : 'rgba(28,74,53,.55)'}`,
      padding: '6px 14px',
      fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
      fontWeight: 500, letterSpacing: '.08em',
      color: gold ? '#c9a96e' : 'rgba(244,240,230,.65)',
    }}>
      <span style={{ fontSize: '.8rem' }}>{icon}</span>
      {label}
    </span>
  )
}

// ─── Stat box ─────────────────────────────────────────────────────────────────
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#0e2318',
      borderRight: '1px solid rgba(201,169,110,.07)',
      borderBottom: '1px solid rgba(201,169,110,.07)',
      padding: '20px 18px',
    }}>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
        letterSpacing: '.18em', textTransform: 'uppercase',
        color: 'rgba(244,240,230,.3)', marginBottom: '8px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Jost', sans-serif", fontWeight: 500,
        fontSize: '.9rem', color: '#f4f0e6', letterSpacing: '.02em',
      }}>
        {value}
      </div>
    </div>
  )
}

// ─── JSON-LD for property ──────────────────────────────────────────────────────
function buildJsonLd(p: Property) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: p.nome,
    description: p.desc,
    url: `https://www.agencygroup.pt/imoveis/${p.id}`,
    identifier: p.ref,
    offers: {
      '@type': 'Offer',
      price: p.preco,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'RealEstateAgent',
        name: 'Agency Group',
        telephone: '+351919948986',
        identifier: { '@type': 'PropertyValue', name: 'AMI', value: '22506' },
      },
    },
    floorSize: { '@type': 'QuantitativeValue', value: p.area, unitCode: 'MTK' },
    numberOfRooms: p.quartos,
    numberOfBathroomsTotal: p.casasBanho,
    address: {
      '@type': 'PostalAddress',
      addressLocality: p.bairro,
      addressRegion: p.zona,
      addressCountry: 'PT',
    },
    geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
  })
}

// ─── Full showcase page (server component) ────────────────────────────────────
function PropertyShowcase({ property: p }: { property: Property }) {
  const pm2 = Math.round(p.preco / p.area)
  const yieldData = ZONE_YIELDS[p.zona]
  const pageUrl   = `https://www.agencygroup.pt/imoveis/${p.id}`

  const waMsg = encodeURIComponent(
    `Olá Carlos, tenho interesse no imóvel ${p.nome} (${p.ref}), preço ${formatPriceFull(p.preco)}. Podemos agendar uma visita privada?`
  )
  const mailSubject = encodeURIComponent(`Interesse — ${p.nome} · ${p.ref}`)
  const mailBody = encodeURIComponent(
    `Olá,\n\nGostaria de mais informações e de agendar uma visita ao imóvel:\n\n${p.nome}\nReferência: ${p.ref}\nPreço: ${formatPriceFull(p.preco)}\nLocalização: ${p.bairro}, ${p.zona}\n\nObrigado.`
  )
  const shareWhatsApp = encodeURIComponent(`${p.nome} · ${formatPriceFull(p.preco)} · ${pageUrl}`)

  const relatedProps = PROPERTIES
    .filter(r => r.zona === p.zona)
    .slice(0, 3)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(p) }} />

      {/* ── Fonts + base CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        .ag-nav-link {
          font-family: 'Jost', sans-serif;
          font-size: .68rem;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: rgba(244,240,230,.45);
          text-decoration: none;
          transition: color .2s;
        }
        .ag-nav-link:hover { color: #c9a96e; }

        .ag-feat-item {
          display: flex;
          align-items: center;
          padding: 14px 0;
          border-bottom: 1px solid rgba(201,169,110,.07);
          font-family: 'Jost', sans-serif;
          font-weight: 400;
          font-size: .88rem;
          color: rgba(244,240,230,.7);
          letter-spacing: .01em;
        }
        .ag-feat-item::before {
          content: '';
          display: inline-block;
          width: 5px; height: 5px;
          background: #c9a96e;
          margin-right: 16px;
          flex-shrink: 0;
          transform: rotate(45deg);
        }

        .ag-btn-gold {
          display: inline-flex; align-items: center; gap: 10px;
          background: #c9a96e; color: #0c1f15;
          padding: 16px 36px;
          font-family: 'Jost', sans-serif; font-size: .7rem;
          font-weight: 700; letter-spacing: .2em; text-transform: uppercase;
          text-decoration: none; border: none; cursor: pointer;
          transition: background .2s, transform .15s;
        }
        .ag-btn-gold:hover { background: #ddb87c; transform: translateY(-1px); }

        .ag-btn-ghost {
          display: inline-flex; align-items: center; gap: 10px;
          background: transparent; color: #c9a96e;
          border: 1px solid rgba(201,169,110,.4);
          padding: 15px 32px;
          font-family: 'Jost', sans-serif; font-size: .7rem;
          font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
          text-decoration: none; cursor: pointer;
          transition: all .2s;
        }
        .ag-btn-ghost:hover { background: rgba(201,169,110,.08); border-color: #c9a96e; }

        .ag-grid-5 {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          border: 1px solid rgba(201,169,110,.1);
          overflow: hidden;
        }
        @media (max-width: 960px) { .ag-grid-5 { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) { .ag-grid-5 { grid-template-columns: repeat(2, 1fr); } }

        .ag-layout {
          display: grid;
          grid-template-columns: 1fr 356px;
          gap: 60px;
          align-items: start;
        }
        @media (max-width: 1080px) { .ag-layout { grid-template-columns: 1fr; gap: 40px; } }

        .ag-stat3 {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: rgba(201,169,110,.08);
          border: 1px solid rgba(201,169,110,.1);
        }
        @media (max-width: 560px) { .ag-stat3 { grid-template-columns: 1fr; } }

        .ag-related {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .ag-rel-card { text-decoration: none; }
        .ag-rel-card-inner {
          background: #0e2318;
          border: 1px solid rgba(201,169,110,.1);
          overflow: hidden;
          transition: border-color .22s, transform .22s;
        }
        .ag-rel-card:hover .ag-rel-card-inner {
          border-color: rgba(201,169,110,.35);
          transform: translateY(-3px);
        }

        .ag-hero-meta { display: flex; gap: 20px; flex-wrap: wrap; }
        @media (max-width: 640px) {
          .ag-hero-title { font-size: clamp(1.6rem, 7vw, 2.8rem) !important; }
          .ag-hero-price { bottom: 20px !important; right: 16px !important; padding: 14px 18px !important; }
          .ag-hero-bottom { padding: 0 16px 88px !important; }
          nav { padding: 0 16px !important; }
          .ag-layout { padding-left: 16px !important; padding-right: 16px !important; }
        }

        @media print {
          nav, .ag-cta-section, .ag-qr-section, footer { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
        }
      `}</style>

      <div style={{ background: '#0c1f15', minHeight: '100vh', fontFamily: "'Jost', sans-serif" }}>

        {/* ══ TOP NAV ══════════════════════════════════════════════════════════ */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
          background: 'rgba(12,31,21,.97)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(201,169,110,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', height: '68px',
        }}>
          <Link href="/" style={{
            fontFamily: "'Cormorant', serif", fontSize: '1.3rem', fontWeight: 300,
            color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em',
            flexShrink: 0,
          }}>
            Agency<span style={{ color: '#c9a96e' }}>Group</span>
          </Link>

          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <Link href="/"         className="ag-nav-link">Início</Link>
            <Link href="/imoveis"  className="ag-nav-link" style={{ color: '#c9a96e' }}>Imóveis</Link>
            <Link href="/#avaliacao" className="ag-nav-link">Avaliação</Link>
            <Link href="/#simulador" className="ag-nav-link">Crédito</Link>
            <Link href="/#contacto"  className="ag-nav-link">Contacto</Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.16em', color: 'rgba(201,169,110,.45)',
            }}>AMI 22506</span>
            <a
              href={`https://wa.me/351919948986?text=${waMsg}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                background: '#c9a96e', color: '#0c1f15', padding: '9px 22px',
                fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Contacto →
            </a>
          </div>
        </nav>

        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <section style={{
          position: 'relative',
          height: 'min(88vh, 720px)', minHeight: '500px',
          background: `linear-gradient(${p.grad})`,
          marginTop: '68px', overflow: 'hidden',
        }}>
          {/* Atmospheric overlays */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(12,31,21,.25) 0%, rgba(12,31,21,0) 35%, rgba(12,31,21,.8) 100%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 30% 60%, rgba(201,169,110,.05) 0%, transparent 60%)',
          }} />
          {/* Subtle grain */}
          <div style={{
            position: 'absolute', inset: 0, opacity: .035,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }} />

          {/* REF chip — top left */}
          <div style={{
            position: 'absolute', top: '30px', left: '40px',
            fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
            letterSpacing: '.22em', color: 'rgba(244,240,230,.5)',
            background: 'rgba(12,31,21,.55)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(244,240,230,.08)', padding: '6px 14px',
          }}>
            REF {p.ref}
          </div>

          {/* Badge — top right */}
          {p.badge && BADGE_CSS[p.badge] && (
            <div style={{
              position: 'absolute', top: '30px', right: '40px',
              ...BADGE_CSS[p.badge],
              fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
              letterSpacing: '.18em', textTransform: 'uppercase',
              padding: '6px 16px',
            }}>
              {p.badge}
            </div>
          )}

          {/* Bottom content */}
          <div className="ag-hero-bottom" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '0 40px 56px',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            {/* Breadcrumb */}
            <nav aria-label="breadcrumb" style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.14em', color: 'rgba(244,240,230,.35)',
            }}>
              <Link href="/"        style={{ color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>Início</Link>
              <span>/</span>
              <Link href="/imoveis" style={{ color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>Imóveis</Link>
              <span>/</span>
              <span style={{ color: 'rgba(244,240,230,.45)' }}>{p.zona}</span>
              <span>/</span>
              <span style={{ color: 'rgba(244,240,230,.3)' }}>{p.ref}</span>
            </nav>

            {/* Zone · bairro · tipo */}
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.24em', textTransform: 'uppercase',
              color: '#c9a96e', display: 'flex', gap: '12px', flexWrap: 'wrap',
            }}>
              <span>{p.zona}</span>
              <span style={{ opacity: .4 }}>·</span>
              <span style={{ opacity: .75 }}>{p.bairro}</span>
              <span style={{ opacity: .4 }}>·</span>
              <span style={{ opacity: .6 }}>{p.tipo}</span>
            </div>

            {/* Title */}
            <h1 className="ag-hero-title" style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: 'clamp(2rem, 5vw, 3.75rem)',
              color: '#f4f0e6', lineHeight: 1.05,
              letterSpacing: '-.01em', maxWidth: '820px',
            }}>
              {p.nome}
            </h1>

            {/* Quick meta */}
            <div className="ag-hero-meta" style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
              letterSpacing: '.14em', color: 'rgba(244,240,230,.42)',
            }}>
              <span>{p.area} m²</span>
              <span style={{ opacity: .4 }}>·</span>
              <span>T{p.quartos}</span>
              <span style={{ opacity: .4 }}>·</span>
              <span>{p.casasBanho} WC</span>
              <span style={{ opacity: .4 }}>·</span>
              <span>{vistaLabel(p.vista)}</span>
              <span style={{ opacity: .4 }}>·</span>
              <span style={{ color: '#c9a96e' }}>EPC {p.energia}</span>
            </div>
          </div>

          {/* Price badge — bottom right */}
          <div className="ag-hero-price" style={{
            position: 'absolute', bottom: '56px', right: '40px',
            background: 'rgba(8,20,12,.82)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(201,169,110,.22)',
            padding: '22px 30px', textAlign: 'right',
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.2em', textTransform: 'uppercase',
              color: 'rgba(201,169,110,.45)', marginBottom: '8px',
            }}>Preço de Venda</div>
            <div style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: 'clamp(1.7rem, 3.5vw, 2.5rem)', color: '#c9a96e', lineHeight: 1,
            }}>
              {formatPriceFull(p.preco)}
            </div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.12em', color: 'rgba(244,240,230,.28)',
              marginTop: '8px',
            }}>
              €{pm2.toLocaleString('pt-PT')}/m²
            </div>
          </div>
        </section>

        {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 40px' }}>
          <div className="ag-layout" style={{ paddingTop: '64px', paddingBottom: '80px' }}>

            {/* ═══ LEFT COLUMN ═══════════════════════════════════════════════ */}
            <div>

              {/* ── PROPERTY DETAILS GRID ── */}
              <section style={{ marginBottom: '56px' }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                  letterSpacing: '.28em', textTransform: 'uppercase',
                  color: 'rgba(201,169,110,.5)', marginBottom: '24px',
                }}>
                  Ficha do Imóvel
                </div>

                <div className="ag-grid-5">
                  {[
                    ['Área Total',     `${p.area} m²`],
                    ['Quartos',        `T${p.quartos}`],
                    ['Zona',           p.zona],
                    ['Tipo',           p.tipo],
                    ['Referência',     p.ref],
                    ['Casas de Banho', String(p.casasBanho)],
                    ['Piso',           p.andar === 'r/c' ? 'Rés-do-Chão' : `${p.andar} Andar`],
                    ['Certificado',    `EPC ${p.energia}`],
                    ['Vista',          vistaLabel(p.vista)],
                    ['Preço/m²',       `€${pm2.toLocaleString('pt-PT')}`],
                  ].map(([label, value]) => (
                    <StatBox key={label} label={label} value={value} />
                  ))}
                </div>

                {/* Amenity chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
                  {p.piscina    && <Chip icon="🏊" label="Piscina" />}
                  {p.garagem    && <Chip icon="🚗" label="Garagem" />}
                  {p.jardim     && <Chip icon="🌿" label="Jardim" />}
                  {p.terraco    && <Chip icon="🌅" label="Terraço" />}
                  {p.condominio && <Chip icon="🏰" label="Condomínio" />}
                  {p.tourUrl    && <Chip icon="🎥" label="Tour Virtual 3D" gold />}
                </div>
              </section>

              {/* ── DESCRIPTION ── */}
              <section style={{
                marginBottom: '56px', paddingBottom: '56px',
                borderBottom: '1px solid rgba(201,169,110,.08)',
              }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                  letterSpacing: '.28em', textTransform: 'uppercase',
                  color: 'rgba(201,169,110,.5)', marginBottom: '24px',
                }}>
                  Descrição
                </div>

                <p style={{
                  fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  fontSize: '1rem', lineHeight: 1.9, color: 'rgba(244,240,230,.72)',
                  marginBottom: '24px',
                }}>
                  {p.desc}
                </p>

                <p style={{
                  fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  fontSize: '1rem', lineHeight: 1.9, color: 'rgba(244,240,230,.55)',
                  marginBottom: '24px',
                }}>
                  Situado numa das localizações mais privilegiadas de {p.zona}, este {p.tipo.toLowerCase()} representa
                  uma oportunidade singular no mercado imobiliário de luxo português. Os acabamentos de autor, a
                  luminosidade natural abundante e a qualidade construtiva excepcional definem um imóvel pensado
                  para quem exige o melhor em cada detalhe. Privacidade, segurança e elegância num endereço de prestígio.
                </p>

                <p style={{
                  fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  fontSize: '1rem', lineHeight: 1.9, color: 'rgba(244,240,230,.42)',
                }}>
                  {p.bairro} é uma das zonas mais valorizadas e procuradas por compradores nacionais
                  e internacionais. Com excelente acessibilidade, vida cultural rica e serviços de
                  topo nas imediações, este imóvel oferece um equilíbrio perfeito entre exclusividade
                  residencial e vivência urbana premium.
                  {yieldData && ` A zona regista uma valorização média de +${yieldData.yoy}% ao ano, consolidando este ativo como investimento de excelência.`}
                </p>
              </section>

              {/* ── VIDEO PRESENTATION ── */}
              {p.videoUrl && (
                <section style={{
                  marginBottom: '56px', paddingBottom: '56px',
                  borderBottom: '1px solid rgba(201,169,110,.08)',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                    letterSpacing: '.28em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.5)', marginBottom: '24px',
                  }}>
                    Apresentação em Vídeo
                  </div>
                  <HeyGenEmbed
                    videoUrl={p.videoUrl}
                    title={`Apresentação · ${p.nome}`}
                  />
                </section>
              )}

              {/* ── KEY FEATURES ── */}
              <section style={{
                marginBottom: '56px', paddingBottom: '56px',
                borderBottom: '1px solid rgba(201,169,110,.08)',
              }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                  letterSpacing: '.28em', textTransform: 'uppercase',
                  color: 'rgba(201,169,110,.5)', marginBottom: '24px',
                }}>
                  Características Principais
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                  {p.features.map((f, i) => (
                    <div key={i} className="ag-feat-item">{f}</div>
                  ))}
                </div>
              </section>

              {/* ── MARKET DATA ── */}
              {yieldData && (
                <section style={{
                  marginBottom: '56px', paddingBottom: '56px',
                  borderBottom: '1px solid rgba(201,169,110,.08)',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                    letterSpacing: '.28em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.5)', marginBottom: '24px',
                  }}>
                    Dados de Mercado · {p.zona} · 2026
                  </div>

                  <div className="ag-stat3">
                    {[
                      { label: 'Preço médio/m²',   value: `€${yieldData.preco.toLocaleString('pt-PT')}` },
                      { label: 'Yield bruta média', value: `${yieldData.yield}%` },
                      { label: 'Valorização YoY',   value: `+${yieldData.yoy}%` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#0e2318', padding: '28px 20px', textAlign: 'center' }}>
                        <div style={{
                          fontFamily: "'Cormorant', serif", fontWeight: 300,
                          fontSize: '2rem', color: '#c9a96e', lineHeight: 1, marginBottom: '10px',
                        }}>{value}</div>
                        <div style={{
                          fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                          letterSpacing: '.16em', textTransform: 'uppercase',
                          color: 'rgba(244,240,230,.35)',
                        }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.1em', color: 'rgba(244,240,230,.22)', marginTop: '12px',
                  }}>
                    Fonte: Agency Group Research / INE 2026. Dados indicativos — não constitui garantia de rendimento.
                  </p>
                </section>
              )}

              {/* ── MAP PLACEHOLDER ── */}
              <section style={{ marginBottom: '56px' }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                  letterSpacing: '.28em', textTransform: 'uppercase',
                  color: 'rgba(201,169,110,.5)', marginBottom: '24px',
                }}>
                  Localização · {p.bairro}, {p.zona}
                </div>

                <div style={{
                  height: '380px',
                  background: 'linear-gradient(145deg, #071410 0%, #0e2318 55%, #071410 100%)',
                  border: '1px solid rgba(201,169,110,.12)',
                  position: 'relative', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '18px',
                }}>
                  {/* Grid lines */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(rgba(201,169,110,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,.035) 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                  }} />

                  {/* Concentric circles */}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '280px', height: '280px',
                    border: '1px solid rgba(201,169,110,.07)',
                    borderRadius: '50%',
                  }} />
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '180px', height: '180px',
                    border: '1px solid rgba(201,169,110,.1)',
                    borderRadius: '50%',
                  }} />

                  {/* Pin */}
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
                      <path d="M22 0C13.16 0 6 7.16 6 16c0 10.5 16 36 16 36s16-25.5 16-36c0-8.84-7.16-16-16-16z"
                        fill="#1c4a35" stroke="#c9a96e" strokeWidth="1.2" />
                      <circle cx="22" cy="16" r="6" fill="#c9a96e" />
                    </svg>
                  </div>

                  <div style={{
                    position: 'relative', zIndex: 2, textAlign: 'center',
                    fontFamily: "'Cormorant', serif", fontWeight: 300,
                    fontSize: '1.4rem', color: '#f4f0e6',
                  }}>
                    {p.bairro}
                    <br />
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                      letterSpacing: '.18em', color: 'rgba(201,169,110,.5)', display: 'block',
                      marginTop: '8px',
                    }}>
                      {p.lat.toFixed(4)}° N · {Math.abs(p.lng).toFixed(4)}° W
                    </span>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      position: 'relative', zIndex: 2,
                      fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                      fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
                      color: '#c9a96e', textDecoration: 'none',
                      border: '1px solid rgba(201,169,110,.3)', padding: '10px 24px',
                      transition: 'background .2s',
                    }}
                  >
                    Abrir no Google Maps →
                  </a>

                  <div style={{
                    position: 'absolute', bottom: '14px', right: '16px',
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.12em', color: 'rgba(244,240,230,.18)',
                    border: '1px solid rgba(244,240,230,.05)', padding: '4px 10px',
                  }}>
                    Localização aproximada
                  </div>
                </div>
              </section>

            </div>{/* end left column */}

            {/* ═══ RIGHT STICKY SIDEBAR ══════════════════════════════════════ */}
            <div>
              <div style={{ position: 'sticky', top: '88px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* ── AGENT CARD ── */}
                <div style={{
                  background: '#0e2318',
                  border: '1px solid rgba(201,169,110,.16)',
                  padding: '30px 26px',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.24em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.45)', marginBottom: '20px',
                    paddingBottom: '16px', borderBottom: '1px solid rgba(201,169,110,.08)',
                  }}>
                    Consultor Responsável
                  </div>

                  {/* Photo + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
                    {/* Photo placeholder */}
                    <div style={{
                      width: '66px', height: '66px', flexShrink: 0,
                      background: 'linear-gradient(135deg, #1c4a35, #0c1f15)',
                      border: '2px solid rgba(201,169,110,.22)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <svg width="30" height="35" viewBox="0 0 30 35" fill="none">
                        <circle cx="15" cy="11" r="8" fill="rgba(201,169,110,.35)" />
                        <path d="M0 35c0-8.28 6.72-15 15-15s15 6.72 15 15" fill="rgba(201,169,110,.2)" />
                      </svg>
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "'Cormorant', serif", fontWeight: 400,
                        fontSize: '1.12rem', color: '#f4f0e6',
                        lineHeight: 1.25, marginBottom: '4px',
                      }}>
                        Carlos Feiteira
                      </div>
                      <div style={{
                        fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                        letterSpacing: '.13em', color: 'rgba(201,169,110,.55)',
                        textTransform: 'uppercase',
                      }}>
                        Senior Consultant · AMI 22506
                      </div>
                    </div>
                  </div>

                  {/* Contact actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/351919948986?text=${waMsg}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        background: '#25D366', color: '#fff',
                        padding: '13px 18px',
                        fontFamily: "'Jost', sans-serif", fontSize: '.63rem',
                        fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase',
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>

                    {/* Phone */}
                    <a
                      href="tel:+351919948986"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        background: 'rgba(201,169,110,.1)', color: '#c9a96e',
                        border: '1px solid rgba(201,169,110,.28)',
                        padding: '12px 18px',
                        fontFamily: "'Jost', sans-serif", fontSize: '.63rem',
                        fontWeight: 600, letterSpacing: '.15em', textTransform: 'uppercase',
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.62-.62a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                      </svg>
                      +351 919 191 919
                    </a>

                    {/* Email */}
                    <a
                      href={`mailto:geral@agencygroup.pt?subject=${mailSubject}&body=${mailBody}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        background: 'transparent', color: 'rgba(244,240,230,.45)',
                        border: '1px solid rgba(244,240,230,.1)',
                        padding: '12px 18px',
                        fontFamily: "'Jost', sans-serif", fontSize: '.63rem',
                        fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase',
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      Enviar E-mail
                    </a>
                  </div>

                  <div style={{
                    marginTop: '18px', paddingTop: '14px',
                    borderTop: '1px solid rgba(201,169,110,.07)',
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.14em', color: 'rgba(244,240,230,.25)',
                    textAlign: 'center',
                  }}>
                    PT · EN · FR · ES
                  </div>
                </div>

                {/* ── QUICK FACTS ── */}
                <div style={{
                  background: '#0e2318', border: '1px solid rgba(201,169,110,.1)',
                  padding: '22px 22px',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.22em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.42)', marginBottom: '14px',
                  }}>
                    Resumo
                  </div>
                  {[
                    ['Preço',       formatPriceFull(p.preco)],
                    ['Área',        `${p.area} m²`],
                    ['Quartos',     `T${p.quartos}`],
                    ['Localização', `${p.bairro}, ${p.zona}`],
                    ['Referência',  p.ref],
                    ['Comissão',    '5% · AMI 22506'],
                  ].map(([k, v]) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(244,240,230,.04)',
                    }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                        letterSpacing: '.12em', textTransform: 'uppercase',
                        color: 'rgba(244,240,230,.3)',
                      }}>{k}</span>
                      <span style={{
                        fontFamily: "'Jost', sans-serif", fontSize: '.84rem', fontWeight: 500,
                        color: k === 'Preço' ? '#c9a96e' : 'rgba(244,240,230,.7)',
                        textAlign: 'right', maxWidth: '58%',
                      }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* ── LEAD CAPTURE ── */}
                <div style={{
                  background: '#0e2318',
                  border: '1px solid rgba(201,169,110,.1)',
                  padding: '22px',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.22em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.42)', marginBottom: '12px',
                  }}>
                    Receber Informações
                  </div>
                  <p style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
                    color: 'rgba(244,240,230,.45)', lineHeight: 1.5, marginBottom: '14px',
                  }}>
                    Visita privada disponível esta semana. Resposta em menos de 2h.
                  </p>
                  <LeadCaptureForm
                    source="property_page"
                    zona={p.zona}
                    propertyRef={p.ref}
                    placeholder="Email ou telemóvel"
                    ctaLabel="Agendar Visita →"
                  />
                </div>

                {/* ── SHARE BUTTON (client island) ── */}
                <ShareButton url={pageUrl} title={p.nome} />

              </div>
            </div>

          </div>
        </div>

        {/* ══ CTA SECTION ═══════════════════════════════════════════════════════ */}
        <section className="ag-cta-section" style={{
          background: 'linear-gradient(135deg, #071410 0%, #1c4a35 50%, #071410 100%)',
          borderTop: '1px solid rgba(201,169,110,.15)',
          borderBottom: '1px solid rgba(201,169,110,.15)',
          padding: '88px 40px', textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(201,169,110,.06) 0%, transparent 65%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto' }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.32em', textTransform: 'uppercase',
              color: 'rgba(201,169,110,.5)', marginBottom: '20px',
            }}>
              Próximo Passo
            </div>
            <h2 style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#f4f0e6',
              lineHeight: 1.15, marginBottom: '18px',
            }}>
              Agendar Visita{' '}
              <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>Privada</em>
            </h2>
            <p style={{
              fontFamily: "'Jost', sans-serif", fontWeight: 300,
              fontSize: '.95rem', color: 'rgba(244,240,230,.5)',
              lineHeight: 1.85, marginBottom: '40px', maxWidth: '520px', margin: '0 auto 40px',
            }}>
              Visitas privadas, sem pressão e conduzidas pelo consultor responsável.
              Disponibilidade 7 dias por semana — a uma mensagem de distância.
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href={`https://wa.me/351919948986?text=${waMsg}`}
                target="_blank" rel="noopener noreferrer"
                className="ag-btn-gold"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Agendar por WhatsApp
              </a>
              <a
                href={`mailto:geral@agencygroup.pt?subject=${mailSubject}&body=${mailBody}`}
                className="ag-btn-ghost"
              >
                Enviar Pedido por E-mail →
              </a>
            </div>

            <p style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.14em', color: 'rgba(244,240,230,.22)', marginTop: '28px',
            }}>
              Confidencialidade garantida · RGPD compliant · Sem spam
            </p>
          </div>
        </section>

        {/* ══ QR CODE SECTION ════════════════════════════════════════════════════ */}
        <section className="ag-qr-section" style={{
          background: '#080f0a',
          borderBottom: '1px solid rgba(201,169,110,.07)',
          padding: '72px 40px',
        }}>
          <div style={{
            maxWidth: '560px', margin: '0 auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
              letterSpacing: '.28em', textTransform: 'uppercase',
              color: 'rgba(201,169,110,.4)',
            }}>
              Partilhar Este Imóvel
            </div>

            <h3 style={{
              fontFamily: "'Cormorant', serif", fontWeight: 300,
              fontSize: '1.55rem', color: '#f4f0e6',
              textAlign: 'center', lineHeight: 1.3, maxWidth: '440px',
            }}>
              {p.nome}
            </h3>

            <QRCodeSVG url={pageUrl} />

            <p style={{
              fontFamily: "'Jost', sans-serif", fontWeight: 300,
              fontSize: '.82rem', color: 'rgba(244,240,230,.32)',
              textAlign: 'center', lineHeight: 1.8, maxWidth: '380px',
            }}>
              Digitalize o código QR para aceder diretamente a esta ficha.
              Partilhe com quem possa ter interesse nesta propriedade.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a
                href={`https://wa.me/?text=${shareWhatsApp}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(37,211,102,.1)', color: '#25D366',
                  border: '1px solid rgba(37,211,102,.22)', padding: '10px 20px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                  fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Partilhar WhatsApp
              </a>
              <a
                href={`mailto:?subject=${mailSubject}&body=${encodeURIComponent(p.nome + '\n' + pageUrl)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'transparent', color: 'rgba(244,240,230,.38)',
                  border: '1px solid rgba(244,240,230,.1)', padding: '10px 20px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                  fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Partilhar por E-mail
              </a>
            </div>
          </div>
        </section>

        {/* ══ RELATED PROPERTIES ════════════════════════════════════════════════ */}
        {relatedProps.length > 0 && (
          <section style={{
            background: '#0c1f15', padding: '72px 40px',
            borderBottom: '1px solid rgba(201,169,110,.07)',
          }}>
            <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: '36px', flexWrap: 'wrap', gap: '12px',
              }}>
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                    letterSpacing: '.28em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.44)', marginBottom: '12px',
                  }}>
                    Também Poderá Interessar
                  </div>
                  <h2 style={{
                    fontFamily: "'Cormorant', serif", fontWeight: 300,
                    fontSize: '1.75rem', color: '#f4f0e6',
                  }}>
                    Imóveis em {p.zona}
                  </h2>
                </div>
                <Link href="/imoveis" style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                  fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
                  color: 'rgba(201,169,110,.55)', textDecoration: 'none',
                }}>
                  Ver Todos →
                </Link>
              </div>

              <div className="ag-related">
                {relatedProps.map(rel => (
                  <Link key={rel.id} href={`/imoveis/${rel.id}`} className="ag-rel-card">
                    <div className="ag-rel-card-inner">
                      <div style={{
                        height: '165px',
                        background: `linear-gradient(${rel.grad})`,
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(12,31,21,.65) 0%, transparent 60%)',
                        }} />
                        <div style={{
                          position: 'absolute', bottom: '12px', left: '12px',
                          fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                          letterSpacing: '.14em', color: 'rgba(244,240,230,.45)',
                          background: 'rgba(12,31,21,.55)', padding: '3px 8px',
                          backdropFilter: 'blur(8px)',
                        }}>{rel.ref}</div>
                        {rel.badge && BADGE_CSS[rel.badge] && (
                          <div style={{
                            position: 'absolute', top: '10px', right: '10px',
                            ...BADGE_CSS[rel.badge],
                            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                            letterSpacing: '.12em', textTransform: 'uppercase',
                            padding: '3px 8px',
                          }}>{rel.badge}</div>
                        )}
                      </div>
                      <div style={{ padding: '16px 16px 18px' }}>
                        <div style={{
                          fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                          letterSpacing: '.14em', color: 'rgba(201,169,110,.55)',
                          marginBottom: '6px',
                        }}>{rel.bairro}</div>
                        <div style={{
                          fontFamily: "'Cormorant', serif", fontWeight: 300,
                          fontSize: '1.05rem', color: '#f4f0e6',
                          lineHeight: 1.3, marginBottom: '12px',
                        }}>{rel.nome}</div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{
                            fontFamily: "'Cormorant', serif", fontWeight: 300,
                            fontSize: '1.1rem', color: '#c9a96e',
                          }}>{formatPriceFull(rel.preco)}</span>
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                            letterSpacing: '.1em', color: 'rgba(244,240,230,.32)',
                          }}>{rel.area}m² · T{rel.quartos}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
        <footer style={{
          background: '#060c07',
          borderTop: '1px solid rgba(201,169,110,.1)',
          padding: '48px 40px 32px',
        }}>
          <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: '36px', flexWrap: 'wrap', gap: '24px',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Cormorant', serif", fontSize: '1.55rem', fontWeight: 300,
                  color: '#f4f0e6', letterSpacing: '.06em', marginBottom: '8px',
                }}>
                  Agency<span style={{ color: '#c9a96e' }}>Group</span>
                </div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                  letterSpacing: '.2em', color: 'rgba(201,169,110,.45)',
                  marginBottom: '12px',
                }}>
                  Mediação Imobiliária · AMI 22506
                </div>
                <div style={{
                  fontFamily: "'Jost', sans-serif", fontSize: '.78rem', fontWeight: 300,
                  color: 'rgba(244,240,230,.3)', lineHeight: 1.6,
                }}>
                  Lisboa · Cascais · Comporta<br />
                  Porto · Algarve · Madeira
                </div>
              </div>

              <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.18em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.4)', marginBottom: '14px',
                  }}>Menu</div>
                  {[
                    ['/imoveis',    'Imóveis'],
                    ['/#avaliacao', 'Avaliação'],
                    ['/#simulador', 'Crédito'],
                    ['/#contacto',  'Contacto'],
                  ].map(([href, label]) => (
                    <div key={href} style={{ marginBottom: '10px' }}>
                      <Link href={href} style={{
                        fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
                        letterSpacing: '.1em',
                        color: 'rgba(244,240,230,.3)', textDecoration: 'none',
                      }}>{label}</Link>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    letterSpacing: '.18em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,.4)', marginBottom: '14px',
                  }}>Contacto</div>
                  <div style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.78rem', fontWeight: 300,
                    color: 'rgba(244,240,230,.3)', lineHeight: 1.9,
                  }}>
                    +351 919 191 919<br />
                    geral@agencygroup.pt<br />
                    agencygroup.pt
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              borderTop: '1px solid rgba(244,240,230,.04)',
              paddingTop: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '10px',
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.13em', color: 'rgba(244,240,230,.18)',
              }}>
                © 2026 Agency Group – Mediação Imobiliária Lda · Todos os direitos reservados
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                letterSpacing: '.13em', color: 'rgba(244,240,230,.18)',
              }}>
                AMI 22506 · RGPD · Política de Privacidade
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
