'use client'
import { useState } from 'react'

interface Props {
  propertyName: string
  propertyRef: string
  videoUrl: string | null // YouTube embed URL
  zona: string
  preco: number
}

export default function VideoSection({ propertyName, propertyRef, videoUrl, zona, preco }: Props) {
  const [requested, setRequested] = useState(false)
  const [phone, setPhone] = useState('')

  const handleRequest = () => {
    const msg = `Olá, tenho interesse num vídeo cinematográfico do imóvel ${propertyRef} — ${propertyName} (${zona}). Podem enviar?`
    window.open(`https://wa.me/351919948986?text=${encodeURIComponent(msg)}`, '_blank')
    setRequested(true)
  }

  return (
    <section style={{
      marginTop: '48px',
      border: '1px solid rgba(201,169,110,.12)',
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid rgba(201,169,110,.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,.02)',
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.2em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Tour Cinematográfico
          </div>
          <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.3rem', color: '#f4f0e6' }}>
            Vídeo Premium do Imóvel
          </div>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>
          4K · Drone · Áudio
        </div>
      </div>

      {videoUrl ? (
        /* Real video embed */
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
          <iframe
            src={videoUrl + '?rel=0&modestbranding=1&color=white&theme=dark'}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`Vídeo ${propertyName}`}
          />
        </div>
      ) : (
        /* Video request placeholder */
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #0c1f15 0%, #070f0a 100%)',
          minHeight: '380px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          {/* Background decorative */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 50%, rgba(201,169,110,.04) 0%, transparent 60%),
              radial-gradient(circle at 80% 50%, rgba(201,169,110,.03) 0%, transparent 60%)
            `,
          }} />

          {/* Play icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            border: '2px solid rgba(201,169,110,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '28px', position: 'relative', zIndex: 1,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>

          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
            Produção Cinematográfica
          </div>
          <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.8rem', color: '#f4f0e6', margin: '0 0 12px', position: 'relative', zIndex: 1, maxWidth: '500px' }}>
            Solicite o Vídeo 4K deste Imóvel
          </h3>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.7, maxWidth: '420px', margin: '0 0 32px', position: 'relative', zIndex: 1 }}>
            Produção cinematográfica profissional com drone 4K, steadicam e áudio ambiente. Disponível para todos os imóveis do nosso portfolio.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '36px', position: 'relative', zIndex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['🎬 Drone 4K', '🎙️ Áudio HD', '✂️ Edição Pro', '📱 Versão Reel'].map(f => (
              <div key={f} style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.45)', textTransform: 'uppercase' }}>{f}</div>
            ))}
          </div>

          {!requested ? (
            <button
              onClick={handleRequest}
              style={{
                background: '#c9a96e', color: '#0c1f15', border: 'none',
                padding: '16px 40px',
                fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
                cursor: 'pointer', position: 'relative', zIndex: 1,
                transition: 'all .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#b8924a')}
              onMouseLeave={e => (e.currentTarget.style.background = '#c9a96e')}
            >
              Solicitar Vídeo via WhatsApp →
            </button>
          ) : (
            <div style={{ color: '#27ae60', fontFamily: "'Jost', sans-serif", fontSize: '.72rem', position: 'relative', zIndex: 1 }}>
              ✓ Pedido enviado! Entraremos em contacto em breve.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
