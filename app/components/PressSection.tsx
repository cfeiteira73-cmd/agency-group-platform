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
// Neuromarketing: cada card = um momento da vida futura do comprador em Portugal
// Future pacing · Identity anchoring · Sensory triggers · Social proof

const LIFESTYLE_PRESS = [

  // ── IDENTIDADE & STATUS — "Escolheste o melhor país do mundo" ───────────────
  {
    name: 'Condé Nast Traveller',
    cat: 'Destino do Ano',
    emoji: '✦',
    headline: 'Comprou o País\nQue o Mundo Elegeu #1',
    sub: 'UK Readers\' Choice Awards 2024 — Portugal #1 Best Country',
    dream: 'Você escolheu o melhor país do planeta →',
    color: '#d4a853',
    url: 'https://www.cntraveller.com/gallery/best-countries-in-the-world',
  },
  {
    name: 'International Living',
    cat: 'Liberdade & Qualidade de Vida',
    emoji: '◇',
    headline: 'O País Mais Inteligente\nPara a Sua Liberdade',
    sub: '#1 Global Retirement Index · Clima · Saúde · Custo de Vida · Segurança',
    dream: 'Liberdade financeira. Clima perfeito. Para sempre →',
    color: '#c9a96e',
    url: 'https://internationalliving.com/the-best-places-to-retire/',
  },

  // ── MANHÃ — "Como começa o seu dia" ──────────────────────────────────────────
  {
    name: 'Michelin Guide',
    cat: 'Gastronomia de Classe Mundial',
    emoji: '✶',
    headline: 'A 10 Min de 53\nEstrelas Michelin',
    sub: 'Guia Michelin Portugal 2024 — da tasca de bairro ao fine dining de topo',
    dream: 'Quinta-feira à noite. Mesa reservada. Estrela Michelin →',
    color: '#e8b84b',
    url: 'https://guide.michelin.com/pt/pt/restaurants',
  },
  {
    name: 'Boa Cama Boa Mesa',
    cat: '100 Melhores Restaurantes',
    emoji: '◉',
    headline: '100 Razões para Nunca\nSair Desapontado ao Jantar',
    sub: 'Guia anual · do Alentejo ao Douro · os chefs e sabores únicos de Portugal',
    dream: 'Sábado. Mesa nova. Ainda há 97 para descobrir →',
    color: '#c9606a',
    url: 'https://www.boa-cama-boa-mesa.pt/restaurantes/',
  },

  // ── FIM DE SEMANA — "O que faz aos sábados" ──────────────────────────────────
  {
    name: 'Golf Digest',
    cat: 'Golfe · Top 10 Europa',
    emoji: '⬡',
    headline: 'Golf com o Atlântico\nComo Pano de Fundo',
    sub: 'Quinta do Lago #6 Europe · San Lorenzo Top 100 Mundial · Algarve',
    dream: '9h da manhã. Fairway. O Atlântico ali →',
    color: '#5a9e72',
    url: 'https://www.golfdigest.com/story/best-courses-portugal',
  },
  {
    name: 'Wines of Portugal',
    cat: 'Top 100 Vinhos do Mundo',
    emoji: '◈',
    headline: 'Domingos em Quintas\ndo Douro com Vinhos Top 100',
    sub: 'Douro · Alentejo · Dão · Vinho Verde — as adegas mais premiadas do mundo',
    dream: 'Domingo. Quinta do Douro. Taça na mão →',
    color: '#7a3a6a',
    url: 'https://www.winesofportugal.com/gb/',
  },
  {
    name: 'Estoril Open · ATP 500',
    cat: 'Ténis · Elite Mundial',
    emoji: '◎',
    headline: 'Os Seus Vizinhos\nJogam com Djokovic',
    sub: 'Millennium Estoril Open ATP 500 — Djokovic · Medvedev · Alcaraz · Sinner',
    dream: 'O seu clube tem ATP 500. Literalmente →',
    color: '#c04a4a',
    url: 'https://www.milleniumestorilopen.com/',
  },

  // ── AVENTURA — "O que descobre ao fim de semana" ─────────────────────────────
  {
    name: 'WSL · World Surf League',
    cat: 'Surf · Onda Gigante',
    emoji: '〜',
    headline: 'A 2h do Maior\nEspectáculo Natural do Planeta',
    sub: 'Nazaré Big Wave World Championship — Praia do Norte · Guinness Records',
    dream: 'Nazaré fica a 2 horas. A maior onda do mundo →',
    color: '#3a7ab8',
    url: 'https://www.worldsurfleague.com/',
  },
  {
    name: 'National Geographic',
    cat: 'Natureza & 25 Sítios UNESCO',
    emoji: '◉',
    headline: '25 Tesouros da\nHumanidade no Seu Quintal',
    sub: 'Portugal · 25 sítios UNESCO · Alentejo Starlight Destination 2024',
    dream: '25 maravilhas da humanidade. A maioria, perto de si →',
    color: '#d4a040',
    url: 'https://www.nationalgeographic.com/travel/article/best-things-to-do-portugal',
  },

  // ── CIDADE & CULTURA — "A sua vida urbana" ───────────────────────────────────
  {
    name: 'Monocle',
    cat: 'Cidade Mais Habitável da Europa',
    emoji: '▲',
    headline: 'Acorda Todos os Dias\nna Cidade Mais Habitável',
    sub: 'Lisboa Top 3 Quality of Life · Porto Best Small City — Monocle 2024',
    dream: 'Lisboa. Café. Sol. A cidade que o mundo quer ser →',
    color: '#8fb8a0',
    url: 'https://monocle.com/magazine/',
  },
  {
    name: 'Time Out',
    cat: 'Porto #1 · Lisboa #1 Market',
    emoji: '◈',
    headline: 'Porto #1 City Break\nO Mercado Mais Copiado do Mundo',
    sub: 'Time Out Market Lisboa: original e mais copiado do mundo · Porto #1 Europa',
    dream: 'Porto de manhã. Time Out Market ao almoço →',
    color: '#e06040',
    url: 'https://www.timeout.com/portugal',
  },

  // ── HOTÉIS & RETIRO — "As suas escapadas" ────────────────────────────────────
  {
    name: 'Condé Nast · Hotéis',
    cat: '50 Melhores Hotéis · Portugal',
    emoji: '♦',
    headline: 'Os Melhores Hotéis\ndo Mundo São os Seus Vizinhos',
    sub: 'De Lisboa ao Algarve · 50 hotéis de referência · resorts, boutique & wine hotels',
    dream: 'Aniversário. 20min de distância. Um dos 50 melhores →',
    color: '#4a8fc0',
    url: 'https://www.cntraveller.com/gallery/best-hotels-in-portugal',
  },
  {
    name: 'Lonely Planet',
    cat: 'Top 10 Países · Best in Travel',
    emoji: '★',
    headline: 'O Destino Que\nTodo o Mundo Quer Descobrir',
    sub: 'Lonely Planet Best in Travel · Top 10 países · Portugal no topo do mundo',
    dream: 'Todos querem vir. Você já chegou →',
    color: '#1a8a6e',
    url: 'https://www.lonelyplanet.com/portugal',
  },

  // ── WELLNESS & LONGEVIDADE — "A sua saúde e energia" ─────────────────────────
  {
    name: 'Time Out · Wellness',
    cat: 'Health Clubs & Spas Premium',
    emoji: '◈',
    headline: 'O Seu Ginásio\nTem Piscina com Vista Mar',
    sub: 'Os melhores health clubs, ginásios premium e spas — de Lisboa ao Algarve',
    dream: 'Treino. Piscina infinita. Atlântico no horizonte →',
    color: '#5a9e8a',
    url: 'https://www.timeout.com/portugal/things-to-do/best-gyms-in-lisbon',
  },
  {
    name: 'Travel + Leisure',
    cat: 'World\'s Best Awards',
    emoji: '◇',
    headline: 'Eleito pelos\nViajantes Mais Exigentes',
    sub: 'Travel + Leisure World\'s Best Awards — Portugal entre os destinos de topo',
    dream: 'Os mais exigentes do mundo já escolheram. Como você →',
    color: '#c9a96e',
    url: 'https://www.travelandleisure.com/travel-guide/portugal',
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
              A Sua Nova Vida · Portugal
            </p>
            <h2 style={{
              fontFamily: "'Cormorant', serif",
              fontWeight: 300,
              fontSize: 'clamp(2rem,4vw,3.4rem)',
              color: '#f4f0e6',
              margin: '0 0 20px',
              lineHeight: 1.15,
            }}>
              Tudo o Que o Mundo Reconhece —<br /><em style={{ color: '#c9a96e' }}>No Seu Novo Quintal</em>
            </h2>
            <p style={{
              fontFamily: "'Jost', sans-serif",
              fontWeight: 300,
              fontSize: 'clamp(.75rem,.9vw,.9rem)',
              color: 'rgba(244,240,230,.45)',
              maxWidth: '620px',
              margin: '0 auto',
              lineHeight: 1.75,
            }}>
              Imagine acordar com 53 restaurantes Michelin à porta, golf com o Atlântico como pano de fundo,
              a maior onda do mundo a 2 horas e a cidade mais habitável da Europa como rotina.
              Portugal não é apenas um país — é o estilo de vida que o mundo inteiro cobiça.
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
            15 publicações · Status · Gastronomia · Golfe · Vinho · Ténis · Surf · UNESCO · Cidade · Hotéis · Wellness · Liberdade
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

function LifestyleCard({ name, cat, emoji, headline, sub, dream, color, url }: {
  name: string; cat: string; emoji: string; headline: string; sub: string; dream: string; color: string; url: string;
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
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 16px 40px rgba(0,0,0,.55), 0 0 0 1px ${color}30` : 'none',
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
          width: '160px', height: '160px',
          background: `radial-gradient(circle at top right, ${color}18, transparent 70%)`,
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

      {/* Sub (fact) → Dream (PNL) on hover */}
      <div style={{
        fontFamily: hovered ? "'Cormorant', serif" : "'DM Mono', monospace",
        fontStyle: hovered ? 'italic' : 'normal',
        fontSize: hovered ? '13px' : '9px',
        letterSpacing: hovered ? '0' : '0.1em',
        color: hovered ? `${color}ee` : 'rgba(201,169,110,.28)',
        lineHeight: 1.55,
        transition: 'all 0.3s ease',
        marginBottom: '18px',
        minHeight: '32px',
      }}>
        {hovered ? dream : sub}
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
          {hovered ? 'Ver →' : cat}
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
