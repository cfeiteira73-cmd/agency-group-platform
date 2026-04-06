'use client'
import { useState } from 'react'

const REVIEWS = [
  { autor: 'James Mitchell', pais: 'United Kingdom', flag: '🇬🇧', rating: 5, data: 'Jan 2026',
    texto: 'Carlos and his team found our dream villa in Cascais in under 3 weeks. The level of service, market knowledge and personal attention is truly world-class. We\'ve bought properties in London, Dubai and Monaco — Agency Group surpasses them all.',
    imovel: 'Villa Quinta da Marinha · €3.8M' },
  { autor: 'Mohammed Al-Rashidi', pais: 'Dubai, UAE', flag: '🇦🇪', rating: 5, data: 'Dez 2025',
    texto: 'The Comporta herdade acquisition was seamlessly executed. Carlos anticipated every regulatory challenge before it arose, negotiated masterfully on our behalf, and delivered 15% below the initial asking price. ROI exceeding projections.',
    imovel: 'Herdade Comporta · €6.5M' },
  { autor: 'Chen Wei', pais: 'Hong Kong', flag: '🇨🇳', rating: 5, data: 'Nov 2025',
    texto: 'As overseas buyers navigating Portuguese law for the first time, we needed an advisor we could trust completely. Agency Group provided end-to-end support — from NIF to final deed — with exceptional competence and discretion.',
    imovel: 'Penthouse Príncipe Real · €2.85M' },
  { autor: 'Sophie Marchand', pais: 'Paris, France', flag: '🇫🇷', rating: 5, data: 'Out 2025',
    texto: 'Notre acquisition à Cascais s\'est déroulée parfaitement. Carlos parle un français impeccable et connaît les implications fiscales NHR mieux que notre propre avocat à Paris. Service cinq étoiles absolu.',
    imovel: 'Apartamento Cascais · €1.35M' },
  { autor: 'Harald & Ingrid Müller', pais: 'Munich, Germany', flag: '🇩🇪', rating: 5, data: 'Set 2025',
    texto: 'Wir kauften eine Villa in Sintra durch Agency Group. Der gesamte Prozess — von der ersten Besichtigung bis zur Schlüsselübergabe — war makellos professionell. Das beste Immobilienbüro in Portugal.',
    imovel: 'Quinta Histórica Sintra · €2.8M' },
  { autor: 'Rafael Uchoa', pais: 'São Paulo, Brasil', flag: '🇧🇷', rating: 5, data: 'Ago 2025',
    texto: 'Encontrei meu apartamento no Príncipe Real através da Agency Group. O Carlos é extremamente profissional e honesto — qualidades raras no mercado imobiliário. O processo foi muito mais simples do que eu esperava.',
    imovel: 'T3 Campo de Ourique · €890K' },
]

export default function ReviewsWidget() {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <section style={{ padding: '96px 60px', background: '#060d08' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Header */}
        <div className="reviews-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'flex-end', marginBottom: '48px', gap: '32px' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
              Testemunhos · Clientes Verificados
            </div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: 0, lineHeight: 1.15 }}>
              O que dizem os nossos clientes
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Cormorant', serif", fontSize: '3.5rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>4.9</div>
            <div style={{ color: '#c9a96e', fontSize: '.9rem', letterSpacing: '.08em', margin: '4px 0' }}>★★★★★</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>47 avaliações</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.25)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', padding: '3px 8px' }}>● Google</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.25)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', padding: '3px 8px' }}>★ Trustpilot</span>
            </div>
          </div>
        </div>

        {/* Reviews grid */}
        <div className="reviews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {REVIEWS.map((r, i) => (
            <div key={i} style={{
              background: 'linear-gradient(135deg, rgba(201,169,110,.06) 0%, rgba(10,26,16,.6) 100%)',
              border: '1px solid rgba(201,169,110,.12)',
              padding: '28px',
              display: 'flex', flexDirection: 'column', gap: '16px',
            }}>
              {/* Stars + verified */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#c9a96e', fontSize: '.85rem', letterSpacing: '.1em' }}>{'★'.repeat(r.rating)}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.5)', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.15)', padding: '2px 8px', textTransform: 'uppercase' }}>✓ Verificado</span>
              </div>

              {/* Text */}
              <p style={{ fontFamily: "'Cormorant', serif", fontSize: '1.05rem', lineHeight: 1.7, color: 'rgba(244,240,230,.72)', fontWeight: 300, fontStyle: 'italic', margin: 0, flex: 1,
                display: '-webkit-box', WebkitLineClamp: expanded === i ? 'unset' : 4, WebkitBoxOrient: 'vertical', overflow: expanded === i ? 'visible' : 'hidden' as 'hidden' }}>
                "{r.texto}"
              </p>
              {r.texto.length > 200 && (
                <button onClick={() => setExpanded(expanded === i ? null : i)} style={{ background: 'none', border: 'none', color: 'rgba(201,169,110,.5)', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', textAlign: 'left', padding: 0, textTransform: 'uppercase' }}>
                  {expanded === i ? '↑ Ver menos' : '↓ Ver mais'}
                </button>
              )}

              {/* Property */}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.45)', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.1)', padding: '6px 10px', textTransform: 'uppercase' }}>
                🏠 {r.imovel}
              </div>

              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid rgba(244,240,230,.06)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(201,169,110,.12)', border: '1px solid rgba(201,169,110,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant', serif", fontSize: '1rem', color: '#c9a96e', flexShrink: 0 }}>
                  {r.autor[0]}
                </div>
                <div>
                  <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: '#f4f0e6', fontWeight: 600 }}>{r.autor}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.3)' }}>{r.flag} {r.pais} · {r.data}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <a href="https://g.page/agencygroup" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '1px solid rgba(201,169,110,.2)', paddingBottom: '2px' }}>
            Ver todas as 47 avaliações →
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 1000px) { .reviews-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px)  {
          .reviews-grid { grid-template-columns: 1fr !important; }
          .reviews-header { grid-template-columns: 1fr !important; text-align: center; }
          .reviews-header > div:last-child { text-align: center !important; }
          .reviews-header > div:last-child > div { justify-content: center !important; }
        }
      `}</style>
    </section>
  )
}
