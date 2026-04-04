'use client'

import React, { useState } from 'react'

// ─── Market & Investment Press ─────────────────────────────────────────────────

const MARKET_PRESS = [
  // Artigos directos — headlines que vendem Portugal antes do cliente chegar ao escritório
  {
    name: 'Bloomberg',
    cat: '🇺🇸 "Americanos ricos estão a transformar o Algarve"',
    url: 'https://www.bloomberg.com/news/articles/2024-09-08/wealthy-americans-are-spiking-portugal-s-algarve-housing-market',
  },
  {
    name: 'CNN',
    cat: '🇺🇸 "Voltarei aos EUA numa urna" — nunca mais saio de Portugal',
    url: 'https://www.cnn.com/travel/portugal-american-woman-never-coming-back/index.html',
  },
  {
    name: 'New York Times',
    cat: '🗺️ Alentejo — 52 Lugares a Visitar · NYT',
    url: 'https://www.nytimes.com/shared/interactive/2022/travel/52-places-travel-2022/alentejo.html',
  },
  {
    name: 'Forbes',
    cat: '🇺🇸 Portugal — Melhor País do Mundo para Viver',
    url: 'https://www.forbes.com/search/?q=portugal+best+country+live+invest',
  },
  {
    name: 'Financial Times',
    cat: '🇬🇧 Mercado Britânico · Prime Property',
    url: 'https://www.ft.com/search?q=portugal+property+investment',
  },
  {
    name: 'Le Figaro',
    cat: '🇫🇷 "Os Franceses que escolheram Portugal"',
    url: 'https://recherche.lefigaro.fr/recherche/immobilier/portugal/',
  },
  {
    name: 'Forbes Brasil',
    cat: '🇧🇷 Mercado Brasileiro · Investimento',
    url: 'https://forbes.com.br/?s=portugal+investimento',
  },
  {
    name: 'Vogue',
    cat: '🌍 "Os Locais Mais Bonitos de Portugal"',
    url: 'https://www.vogue.com/search?q=portugal',
  },
]

// ─── Lifestyle · Aspirational Publications ─────────────────────────────────────

const LIFESTYLE_PRESS = [
  // ── Lifestyle & Viagem ──────────────────────────────────────────────────────
  {
    name: 'Condé Nast Traveller',
    cat: 'Lifestyle & Luxury',
    emoji: '✦',
    headline: '#1 Best Country\nin the World',
    sub: 'UK Readers\' Choice Awards 2024',
    color: '#d4a853',
    url: 'https://www.cntraveller.com/gallery/best-countries-in-the-world',
  },
  {
    name: 'Monocle',
    cat: 'Quality of Life',
    emoji: '◈',
    headline: 'Lisboa Top 3\nQuality of Life',
    sub: 'Porto: Best Small City — Monocle 2024',
    color: '#8fb8a0',
    url: 'https://monocle.com/magazine/',
  },
  {
    name: 'Lonely Planet',
    cat: 'Best in Travel',
    emoji: '▲',
    headline: 'Portugal — Top\nDestination Mundial',
    sub: 'Lonely Planet Best in Travel — Top 10 países',
    color: '#1a8a6e',
    url: 'https://www.lonelyplanet.com/portugal',
  },
  {
    name: 'Travel + Leisure',
    cat: 'World\'s Best Awards',
    emoji: '★',
    headline: 'Portugal #1\nWorld\'s Best Awards',
    sub: 'Travel + Leisure World\'s Best Awards — Destination',
    color: '#c9a96e',
    url: 'https://www.travelandleisure.com/travel-guide/portugal',
  },
  // ── Gastronomia ─────────────────────────────────────────────────────────────
  {
    name: 'Michelin Guide',
    cat: 'Gastronomia',
    emoji: '✶',
    headline: '53 Restaurantes\nEstrelados',
    sub: 'Guia Michelin Portugal 2024 — 1.ª edição própria',
    color: '#e8b84b',
    url: 'https://guide.michelin.com/pt/pt/restaurants',
  },
  {
    name: 'Boa Cama Boa Mesa',
    cat: 'Top 100 Restaurantes',
    emoji: '◉',
    headline: '100 Melhores\nRestaurantes de Portugal',
    sub: 'Guia anual · do Alentejo ao Douro · chefs e sabores únicos',
    color: '#c9606a',
    url: 'https://boaemaboa.pt/',
  },
  // ── Vinho & Quintas ──────────────────────────────────────────────────────────
  {
    name: 'Wines of Portugal',
    cat: '50 Melhores Quintas',
    emoji: '◇',
    headline: '50 Quintas Vinícolas\nde Excelência',
    sub: 'Douro · Alentejo · Dão · Vinho Verde — as adegas mais premiadas',
    color: '#7a3a6a',
    url: 'https://www.winesofportugal.com/gb/',
  },
  // ── Hotéis ──────────────────────────────────────────────────────────────────
  {
    name: 'Condé Nast · Hotéis',
    cat: '50 Melhores Hotéis',
    emoji: '♦',
    headline: '50 Melhores Hotéis\nde Portugal',
    sub: 'De Lisboa ao Algarve · resorts e boutique · experiências únicas',
    color: '#4a8fc0',
    url: 'https://www.cntraveller.com/gallery/best-hotels-in-portugal',
  },
  // ── Desporto ────────────────────────────────────────────────────────────────
  {
    name: 'Golf Digest',
    cat: 'Golfe · Top Europa',
    emoji: '⬡',
    headline: 'Quinta do Lago\n#6 Europe',
    sub: 'San Lorenzo: Top 100 Courses in the World · Algarve',
    color: '#5a9e72',
    url: 'https://www.golfdigest.com/story/best-courses-portugal',
  },
  {
    name: 'Estoril Open · ATP 500',
    cat: 'Ténis · Elite Mundial',
    emoji: '◎',
    headline: 'ATP 500 · Estoril\nTénis de Élite',
    sub: 'Millennium Estoril Open — Djokovic, Medvedev, Alcaraz',
    color: '#c04a4a',
    url: 'https://www.atptour.com/en/tournaments/estoril/741/overview',
  },
  {
    name: 'WSL / World Surf League',
    cat: 'Surf · Onda Gigante',
    emoji: '〜',
    headline: 'Nazaré — A Maior\nOnda do Mundo',
    sub: 'Big Wave World Championship — Praia do Norte',
    color: '#3a7ab8',
    url: 'https://www.worldsurfleague.com/',
  },
  // ── Natureza & Cultura ───────────────────────────────────────────────────────
  {
    name: 'National Geographic',
    cat: 'Natureza & Cultura',
    emoji: '◉',
    headline: '25 Sítios UNESCO\nem Portugal',
    sub: 'Alentejo — Starlight International Destination 2024',
    color: '#d4a040',
    url: 'https://www.nationalgeographic.com/travel/article/best-things-to-do-portugal',
  },
  {
    name: 'Time Out',
    cat: 'Cidade & Gastronomia',
    emoji: '◈',
    headline: 'Porto #1 City Break\nTime Out Market #1',
    sub: 'Time Out Market Lisboa: o mercado de comida mais copiado do mundo',
    color: '#e06040',
    url: 'https://www.timeout.com/portugal',
  },
  {
    name: 'International Living',
    cat: 'Lifestyle & Residência',
    emoji: '✦',
    headline: '#1 Best Country\nto Retire',
    sub: 'International Living Annual Global Retirement Index 2023',
    color: '#c9a96e',
    url: 'https://internationalliving.com/the-best-places-to-retire/',
  },
  {
    name: 'Time Out · Wellness',
    cat: '50 Health Clubs & Spas',
    emoji: '◈',
    headline: '50 Melhores Health\nClubs & Ginásios',
    sub: 'Os melhores health clubs, ginásios premium e spas de Portugal',
    color: '#5a9e8a',
    url: 'https://www.timeout.com/portugal/things-to-do/best-gyms-in-lisbon',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PressSection() {
  return (
    <>
      {/* ── MARKET PRESS ─────────────────────────────────────────────────── */}
      <section
        style={{
          background: '#0c1f15',
          padding: '72px 24px 80px',
          borderTop: '1px solid rgba(201,169,110,0.08)',
          borderBottom: '1px solid rgba(201,169,110,0.06)',
        }}
      >
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(201,169,110,0.5)',
              marginBottom: '10px',
            }}>
              Como visto em · Mercado & Investimento
            </p>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              letterSpacing: '0.06em',
              color: 'rgba(220,215,200,0.45)',
            }}>
              Uma publicação por mercado — cada comprador reconhece a sua fonte de confiança
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px',
            }}
            className="press-grid"
          >
            {MARKET_PRESS.map((item) => (
              <MarketLogo key={item.name} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ── LIFESTYLE PUBLICATIONS ───────────────────────────────────────── */}
      <section
        style={{
          background: '#070f0a',
          padding: '96px 24px 104px',
          borderBottom: '1px solid rgba(201,169,110,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ambient background glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(28,74,53,.14) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(201,169,110,.04) 0%, transparent 60%)',
        }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '72px' }}>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(201,169,110,.55)',
              marginBottom: '20px',
            }}>
              Portugal · Como o Mundo o Vê
            </p>
            <h2 style={{
              fontFamily: "'Cormorant', serif",
              fontWeight: 300,
              fontSize: 'clamp(2rem,4vw,3.4rem)',
              color: '#f4f0e6',
              margin: '0 0 20px',
              lineHeight: 1.15,
            }}>
              As Melhores Publicações<br />do <em style={{ color: '#c9a96e' }}>Mundo sobre Portugal</em>
            </h2>
            <p style={{
              fontFamily: "'Jost', sans-serif",
              fontWeight: 300,
              fontSize: 'clamp(.75rem,.9vw,.9rem)',
              color: 'rgba(244,240,230,.45)',
              maxWidth: '560px',
              margin: '0 auto',
              lineHeight: 1.75,
            }}>
              Da gastronomia ao surf, do golfe à arquitectura, do vinho às cidades mais habitáveis —
              o mundo reconhece o que Portugal tem de mais extraordinário.
            </p>
          </div>

          {/* Lifestyle grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
            className="lifestyle-grid"
          >
            {LIFESTYLE_PRESS.map((item) => (
              <LifestyleCard key={item.name} {...item} />
            ))}
          </div>

          {/* Bottom note */}
          <p style={{
            textAlign: 'center',
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.16em',
            color: 'rgba(201,169,110,.3)',
            marginTop: '56px',
            textTransform: 'uppercase',
          }}>
            15 publicações de referência · Lifestyle · Gastronomia · Quintas · Hotéis · Golfe · Ténis · Surf · Wellness · Natureza
          </p>

        </div>
      </section>

      <style>{`
        @media (max-width: 960px) {
          .press-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lifestyle-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .press-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .lifestyle-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}

// ─── Market Logo Box ───────────────────────────────────────────────────────────

function MarketLogo({ name, cat, url }: { name: string; cat: string; url: string; fact?: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '20px 14px',
        border: `1px solid ${hovered ? 'rgba(201,169,110,0.4)' : 'rgba(201,169,110,0.1)'}`,
        background: hovered ? 'rgba(201,169,110,0.06)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.22s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,.35)' : 'none',
        minHeight: '82px',
        textDecoration: 'none',
      }}
    >
      <span style={{
        fontFamily: "'Cormorant', serif",
        fontSize: '14px',
        fontWeight: 400,
        letterSpacing: '0.04em',
        color: hovered ? '#c9a96e' : 'rgba(220,215,200,0.6)',
        textAlign: 'center',
        transition: 'color 0.22s ease',
      }}>
        {name}
      </span>
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '8.5px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: hovered ? 'rgba(201,169,110,.55)' : 'rgba(201,169,110,.22)',
        transition: 'color 0.22s ease',
      }}>
        {hovered ? 'Ver artigo →' : cat}
      </span>
    </a>
  )
}

// ─── Lifestyle Card ────────────────────────────────────────────────────────────

function LifestyleCard({ name, cat, emoji, headline, sub, color, url }: {
  name: string; cat: string; emoji: string; headline: string; sub: string; color: string; url: string;
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '28px 22px',
        border: `1px solid ${hovered ? `${color}60` : 'rgba(255,255,255,0.06)'}`,
        background: hovered ? `rgba(${hexToRgb(color)},0.07)` : 'rgba(255,255,255,.025)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 12px 32px rgba(0,0,0,.5), 0 0 0 1px ${color}25` : 'none',
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
        display: 'block',
      }}
    >
      {/* ambient glow on hover */}
      {hovered && (
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: '120px', height: '120px',
          background: `radial-gradient(circle at top right, ${color}20, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Emoji / symbol */}
      <div style={{
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: hovered ? color : 'rgba(255,255,255,.2)',
        marginBottom: '14px',
        transition: 'color 0.25s ease',
      }}>
        {emoji}
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: "'Cormorant', serif",
        fontSize: 'clamp(1rem,1.1vw,1.15rem)',
        fontWeight: 300,
        color: hovered ? '#f4f0e6' : 'rgba(244,240,230,.75)',
        lineHeight: 1.3,
        whiteSpace: 'pre-line',
        marginBottom: '10px',
        transition: 'color 0.25s ease',
      }}>
        {headline}
      </div>

      {/* Sub */}
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '9px',
        letterSpacing: '0.1em',
        color: hovered ? `${color}cc` : 'rgba(201,169,110,.28)',
        lineHeight: 1.5,
        transition: 'color 0.25s ease',
        marginBottom: '18px',
      }}>
        {sub}
      </div>

      {/* Publication name */}
      <div style={{
        borderTop: `1px solid ${hovered ? `${color}30` : 'rgba(255,255,255,.06)'}`,
        paddingTop: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'border-color 0.25s ease',
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: hovered ? 'rgba(244,240,230,.5)' : 'rgba(244,240,230,.22)',
          transition: 'color 0.25s ease',
        }}>
          {name}
        </span>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '8px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: hovered ? `${color}90` : 'rgba(201,169,110,.18)',
          transition: 'color 0.25s ease',
        }}>
          {cat}
        </span>
      </div>
    </a>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
