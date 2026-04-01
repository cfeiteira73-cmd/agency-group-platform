'use client'

import React from 'react'

// ─── Press / As Seen In Section ───────────────────────────────────────────────

const PRESS_ITEMS = [
  { name: 'Público', category: 'Media Nacional', url: 'https://www.publico.pt/economia/imobiliario', desc: 'Mercado imobiliário PT' },
  { name: 'Expresso', category: 'Media Nacional', url: 'https://expresso.pt/economia/imobiliario', desc: 'Economia & Imobiliário' },
  { name: 'Jornal de Negócios', category: 'Media Financeira', url: 'https://www.jornaldenegocios.pt/mercados', desc: 'Mercados & Investimento' },
  { name: 'Idealista News', category: 'Imobiliário Digital', url: 'https://www.idealista.pt/news/', desc: 'Notícias do Mercado' },
  { name: 'JLL Portugal', category: 'Consultoria Global', url: 'https://www.jll.pt/pt/tendencias-e-insights', desc: 'Research & Insights' },
  { name: 'Savills Portugal', category: 'Consultoria Global', url: 'https://www.savills.pt/research_articles/', desc: 'Luxury Market Reports' },
  { name: 'Forbes', category: 'Media Global', url: 'https://www.forbes.com/real-estate/', desc: 'Global Real Estate' },
  { name: 'Financial Times', category: 'Media Global', url: 'https://www.ft.com/property', desc: 'Property & Investment' },
]

export default function PressSection() {
  return (
    <section
      style={{
        background: '#0c1f15',
        padding: '72px 24px 80px',
        borderTop: '1px solid rgba(201,169,110,0.08)',
        borderBottom: '1px solid rgba(201,169,110,0.08)',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(201,169,110,0.5)',
            marginBottom: '10px',
          }}>
            Como visto em
          </p>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '13px',
            letterSpacing: '0.08em',
            color: 'rgba(220,215,200,0.6)',
          }}>
            8 publicações de referência
          </p>
        </div>

        {/* Grid 4×2 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}
          className="press-grid"
        >
          {PRESS_ITEMS.map((item) => (
            <PressLogo key={item.name} name={item.name} category={item.category} url={item.url} />
          ))}
        </div>

      </div>

      <style>{`
        @media (max-width: 900px) {
          .press-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .press-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </section>
  )
}

// ─── Individual Logo Box ───────────────────────────────────────────────────────

function PressLogo({ name, category, url }: { name: string; category: string; url: string }) {
  const [hovered, setHovered] = React.useState(false)

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
        padding: '22px 16px',
        border: `1px solid ${hovered ? 'rgba(201,169,110,0.45)' : 'rgba(201,169,110,0.12)'}`,
        background: hovered ? 'rgba(201,169,110,0.08)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
        minHeight: '88px',
        textDecoration: 'none',
        position: 'relative',
      }}
    >
      <span
        style={{
          fontFamily: "'Cormorant', serif",
          fontSize: '15px',
          fontWeight: 400,
          letterSpacing: '0.04em',
          color: hovered ? '#c9a96e' : 'rgba(220,215,200,0.65)',
          textAlign: 'center',
          lineHeight: 1.3,
          transition: 'color 0.25s ease',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: hovered ? 'rgba(201,169,110,0.6)' : 'rgba(201,169,110,0.25)',
          transition: 'color 0.25s ease',
        }}
      >
        {hovered ? 'Ver artigo →' : category}
      </span>
    </a>
  )
}
