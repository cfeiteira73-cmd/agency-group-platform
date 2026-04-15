'use client'

import React, { useState, useEffect, useRef } from 'react'
import { track } from '@/lib/gtm'

// ─── Market Publications ─────────────────────────────────────────────────────
// is_verified = true → direct article link, confirmed live
// is_verified = false → search/homepage, not a specific article
const MARKET_TICKER: Array<{
  name: string
  url: string
  is_verified: boolean
  article_date?: string
  article_title?: string
}> = [
  {
    name: 'Bloomberg',
    url: 'https://www.bloomberg.com/news/articles/2024-09-08/wealthy-americans-are-spiking-portugal-s-algarve-housing-market',
    is_verified: true,
    article_date: 'Setembro 2024',
    article_title: 'Wealthy Americans are spiking Portugal\'s Algarve housing market',
  },
  {
    name: 'CNN',
    url: 'https://www.cnn.com/travel/portugal-american-woman-never-coming-back/index.html',
    is_verified: true,
    article_date: '2023',
    article_title: 'Portugal: the country people move to and never come back from',
  },
  {
    name: 'New York Times',
    url: 'https://www.nytimes.com/shared/interactive/2022/travel/52-places-travel-2022/alentejo.html',
    is_verified: true,
    article_date: '2022',
    article_title: '52 Places to Go in 2022 — Alentejo, Portugal',
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/search?q=portugal+property+investment',
    is_verified: false,
  },
  {
    name: 'Forbes',
    url: 'https://www.forbes.com/search/?q=portugal+best+country+live+invest',
    is_verified: false,
  },
  {
    name: 'Le Figaro',
    url: 'https://recherche.lefigaro.fr/recherche/immobilier/portugal/',
    is_verified: false,
  },
  {
    name: 'Forbes Brasil',
    url: 'https://forbes.com.br/?s=portugal+investimento',
    is_verified: false,
  },
  {
    name: 'Vogue',
    url: 'https://www.vogue.com/search?q=portugal',
    is_verified: false,
  },
]

// Only verified articles shown in main ticker; unverified in secondary "as seen in" row
const VERIFIED_PRESS = MARKET_TICKER.filter(p => p.is_verified)
const SECONDARY_PRESS = MARKET_TICKER.filter(p => !p.is_verified)

// ─── Lifestyle Cards — 8 life moments ──────────────────────────────────────────
// Neuromarketing: future pacing · identity anchoring · sensory triggers
const LIFESTYLE_CARDS = [
  {
    emoji: '✦',
    headline: 'Comprou o País\nQue o Mundo Elegeu #1',
    sub: 'UK Readers\' Choice Awards 2024 — Portugal #1 Best Country',
    dream: 'Você escolheu o melhor país do planeta →',
    name: 'Condé Nast Traveller',
    cat: 'Destino do Ano',
    color: '#d4a853',
    url: 'https://www.cntraveller.com/gallery/best-countries-in-the-world',
  },
  {
    emoji: '◇',
    headline: 'O País Mais Inteligente\nPara a Sua Liberdade',
    sub: '#1 Global Retirement Index · Clima · Saúde · Custo de Vida · Segurança',
    dream: 'Liberdade financeira. Clima perfeito. Para sempre →',
    name: 'International Living',
    cat: 'Qualidade de Vida',
    color: '#c9a96e',
    url: 'https://internationalliving.com/the-best-places-to-retire/',
  },
  {
    emoji: '✶',
    headline: 'A 10 Min de 53\nEstrelas Michelin',
    sub: 'Guia Michelin Portugal 2024 — da tasca ao fine dining de topo',
    dream: 'Quinta-feira à noite. Mesa reservada. Estrela Michelin →',
    name: 'Michelin Guide',
    cat: 'Gastronomia Mundial',
    color: '#e8b84b',
    url: 'https://guide.michelin.com/pt/pt/restaurants',
  },
  {
    emoji: '⬡',
    headline: 'Golf com o Atlântico\nComo Pano de Fundo',
    sub: 'Quinta do Lago #6 Europe · San Lorenzo Top 100 Courses · Algarve',
    dream: '9h da manhã. Fairway. O Atlântico ali →',
    name: 'Golf Digest',
    cat: 'Golfe · Top 10 Europa',
    color: '#5a9e72',
    url: 'https://www.golfdigest.com/story/best-courses-portugal',
  },
  {
    emoji: '◈',
    headline: 'Domingos em Quintas\ndo Douro com Vinhos Top 100',
    sub: 'Douro · Alentejo · Dão · Vinho Verde — as adegas mais premiadas do mundo',
    dream: 'Domingo. Quinta do Douro. Taça na mão →',
    name: 'Wines of Portugal',
    cat: 'Top 100 Vinhos Mundo',
    color: '#7a3a6a',
    url: 'https://www.winesofportugal.com/gb/',
  },
  {
    emoji: '〜',
    headline: 'A 2h do Maior\nEspectáculo Natural do Planeta',
    sub: 'Nazaré Big Wave World Championship — Praia do Norte · Guinness Records',
    dream: 'Nazaré fica a 2 horas. A maior onda do mundo →',
    name: 'WSL · World Surf League',
    cat: 'Surf · Onda Gigante',
    color: '#3a7ab8',
    url: 'https://www.worldsurfleague.com/',
  },
  {
    emoji: '◉',
    headline: '25 Tesouros da\nHumanidade no Seu Quintal',
    sub: 'Portugal · 25 Sítios UNESCO · Alentejo Starlight Destination 2024',
    dream: '25 maravilhas da humanidade. A maioria, perto de si →',
    name: 'National Geographic',
    cat: 'Natureza & UNESCO',
    color: '#d4a040',
    url: 'https://www.nationalgeographic.com/travel/article/best-things-to-do-portugal',
  },
  {
    emoji: '▲',
    headline: 'Acorda Todos os Dias\nNa Cidade Mais Habitável',
    sub: 'Lisboa Top 3 Quality of Life · Porto Best Small City — Monocle 2024',
    dream: 'Lisboa. Café. Sol. A cidade que o mundo quer ser →',
    name: 'Monocle',
    cat: 'Qualidade de Vida',
    color: '#8fb8a0',
    url: 'https://monocle.com/magazine/',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PressSection() {
  return (
    <>
      {/* ── 1. FEATURED QUOTE — Bloomberg full width ─────────────────────── */}
      <section style={{
        background: '#040a06',
        padding: '96px 24px 88px',
        borderTop: '1px solid rgba(201,169,110,.06)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* ambient */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,169,110,.03) 0%, transparent 70%)',
        }} />

        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          {/* opening guillemet */}
          <div style={{
            fontFamily: "'Cormorant', serif",
            fontSize: 'clamp(4rem, 10vw, 8rem)',
            color: 'rgba(201,169,110,.12)',
            lineHeight: 0.8,
            marginBottom: '8px',
            userSelect: 'none',
          }}>
            "
          </div>

          {/* The quote */}
          <blockquote style={{
            fontFamily: "'Cormorant', serif",
            fontWeight: 300,
            fontStyle: 'italic',
            fontSize: 'clamp(1.6rem, 3.5vw, 3rem)',
            color: 'rgba(244,240,230,.94)',
            lineHeight: 1.25,
            margin: '0 0 36px',
            letterSpacing: '-.01em',
          }}>
            Wealthy Americans are spiking<br />
            Portugal&rsquo;s Algarve housing market.
          </blockquote>

          {/* Attribution */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <div style={{ width: '32px', height: '1px', background: 'rgba(201,169,110,.3)' }} />
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(201,169,110,.68)',
            }}>
              Bloomberg · Setembro 2024
            </span>
            <div style={{ width: '32px', height: '1px', background: 'rgba(201,169,110,.3)' }} />
          </div>
        </div>
      </section>

      {/* ── 2. VERIFIED PRESS — 3 direct article links with date ─────────── */}
      <section style={{
        background: '#0c1f15',
        borderTop: '1px solid rgba(201,169,110,.08)',
        borderBottom: '1px solid rgba(201,169,110,.06)',
        padding: '32px 40px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Label */}
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
            letterSpacing: '.28em', textTransform: 'uppercase',
            color: 'rgba(201,169,110,.4)', marginBottom: '20px', textAlign: 'center',
          }}>
            Cobertura Editorial Verificada
          </div>

          {/* Verified articles row */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            flexWrap: 'wrap', gap: '12px', marginBottom: '24px',
          }}>
            {VERIFIED_PRESS.map(pub => (
              <a
                key={pub.name}
                href={pub.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('press_article_clicked', { publication: pub.name, verified: true })}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  padding: '14px 20px',
                  border: '1px solid rgba(201,169,110,.2)',
                  background: 'rgba(201,169,110,.04)',
                  textDecoration: 'none',
                  transition: 'all .2s', minWidth: '200px', maxWidth: '320px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(201,169,110,.09)'
                  e.currentTarget.style.borderColor = 'rgba(201,169,110,.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(201,169,110,.04)'
                  e.currentTarget.style.borderColor = 'rgba(201,169,110,.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{
                    fontFamily: "'Cormorant', serif", fontSize: '1rem',
                    fontWeight: 400, color: 'rgba(244,240,230,.75)',
                    letterSpacing: '.02em',
                  }}>{pub.name}</span>
                  {pub.article_date && (
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
                      letterSpacing: '.1em', color: 'rgba(201,169,110,.45)',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>{pub.article_date}</span>
                  )}
                </div>
                {pub.article_title && (
                  <span style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                    color: 'rgba(244,240,230,.35)', lineHeight: 1.4,
                    fontStyle: 'italic',
                  }}>
                    &ldquo;{pub.article_title.slice(0, 72)}{pub.article_title.length > 72 ? '…' : ''}&rdquo;
                  </span>
                )}
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
                  letterSpacing: '.1em', color: 'rgba(201,169,110,.35)',
                  textTransform: 'uppercase', marginTop: '2px',
                }}>Artigo verificado →</span>
              </a>
            ))}
          </div>

          {/* Secondary "as seen in" row — unverified publications */}
          {SECONDARY_PRESS.length > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              flexWrap: 'wrap', gap: '24px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(201,169,110,.06)',
            }}>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
                letterSpacing: '.2em', textTransform: 'uppercase',
                color: 'rgba(244,240,230,.2)',
              }}>também em</span>
              {SECONDARY_PRESS.map(pub => (
                <span
                  key={pub.name}
                  style={{
                    fontFamily: "'Cormorant', serif", fontSize: '.95rem',
                    color: 'rgba(244,240,230,.22)', letterSpacing: '.03em',
                  }}
                >{pub.name}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 3. LIFESTYLE SECTION — 8 life moment cards ───────────────────── */}
      <section style={{
        background: '#070f0a',
        padding: '104px 24px 112px',
        borderBottom: '1px solid rgba(201,169,110,.08)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* ambient */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(28,74,53,.14) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(201,169,110,.04) 0%, transparent 60%)',
        }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(201,169,110,.5)',
              marginBottom: '24px',
            }}>
              A Sua Nova Vida · Portugal
            </p>
            <h2 style={{
              fontFamily: "'Cormorant', serif",
              fontWeight: 300,
              fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)',
              color: '#f4f0e6',
              margin: '0 0 24px',
              lineHeight: 1.1,
              letterSpacing: '-.01em',
            }}>
              Tudo o Que o Mundo Reconhece —<br />
              <em style={{ color: '#c9a96e' }}>No Seu Novo Quintal</em>
            </h2>
            <p style={{
              fontFamily: "'Jost', sans-serif",
              fontWeight: 300,
              fontSize: 'clamp(.8rem, 1vw, 1rem)',
              color: 'rgba(244,240,230,.4)',
              maxWidth: '640px',
              margin: '0 auto',
              lineHeight: 1.8,
            }}>
              53 restaurantes Michelin. Golf com o Atlântico. A maior onda do mundo a 2 horas.
              A cidade mais habitável da Europa como rotina. Portugal não é um destino —
              é o estilo de vida que o mundo inteiro cobiça.
            </p>
          </div>

          {/* 4 × 2 grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
            className="lifestyle-grid"
          >
            {LIFESTYLE_CARDS.map((card) => (
              <LifestyleCard key={card.name} {...card} />
            ))}
          </div>

          {/* bottom note */}
          <p style={{
            textAlign: 'center',
            fontFamily: "'DM Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.18em',
            color: 'rgba(201,169,110,.25)',
            marginTop: '60px',
            textTransform: 'uppercase',
          }}>
            8 publicações · Status · Gastronomia · Golfe · Vinho · Surf · UNESCO · Liberdade · Cidade
          </p>
        </div>
      </section>

      <style>{`
        @keyframes pubTicker {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-33.333%) }
        }
        @media (max-width: 960px) {
          .lifestyle-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .lifestyle-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}

// ─── Lifestyle Card ────────────────────────────────────────────────────────────

function LifestyleCard({ name, cat, emoji, headline, sub, dream, color, url }: {
  name: string; cat: string; emoji: string; headline: string
  sub: string; dream: string; color: string; url: string
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
        background: hovered ? `rgba(${hexToRgb(color)},0.08)` : 'rgba(255,255,255,.025)',
        cursor: 'pointer',
        transition: 'all 0.28s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 20px 48px rgba(0,0,0,.55), 0 0 0 1px ${color}28` : 'none',
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
        display: 'block',
      }}
    >
      {/* corner glow on hover */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '160px', height: '160px',
          background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Symbol */}
      <div style={{
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: hovered ? color : 'rgba(255,255,255,.18)',
        marginBottom: '16px',
        transition: 'color 0.28s ease',
      }}>
        {emoji}
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: "'Cormorant', serif",
        fontSize: 'clamp(1rem, 1.15vw, 1.2rem)',
        fontWeight: 300,
        color: hovered ? '#f4f0e6' : 'rgba(244,240,230,.82)',
        lineHeight: 1.3,
        whiteSpace: 'pre-line',
        marginBottom: '12px',
        transition: 'color 0.28s ease',
      }}>
        {headline}
      </div>

      {/* Sub → Dream on hover (PNL future-pacing) */}
      <div style={{
        fontFamily: hovered ? "'Cormorant', serif" : "'DM Mono', monospace",
        fontStyle: hovered ? 'italic' : 'normal',
        fontSize: hovered ? '14px' : '8.5px',
        letterSpacing: hovered ? '0' : '0.1em',
        color: hovered ? `${color}dd` : 'rgba(201,169,110,.25)',
        lineHeight: 1.6,
        transition: 'all 0.3s ease',
        marginBottom: '20px',
        minHeight: '34px',
      }}>
        {hovered ? dream : sub}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${hovered ? `${color}28` : 'rgba(255,255,255,.05)'}`,
        paddingTop: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'border-color 0.28s ease',
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '8.5px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: hovered ? 'rgba(244,240,230,.45)' : 'rgba(244,240,230,.2)',
          transition: 'color 0.28s ease',
        }}>
          {name}
        </span>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '8px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: hovered ? `${color}88` : 'rgba(201,169,110,.15)',
          transition: 'color 0.28s ease',
        }}>
          {hovered ? 'Ver →' : cat}
        </span>
      </div>
    </a>
  )
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
