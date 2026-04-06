'use client'
import { useState } from 'react'

interface Matterport3DTourProps {
  modelId?: string
  propertyName?: string
  propertyPrice?: number
  compact?: boolean
}

// Real Matterport model IDs for Agency Group properties
// To activate: replace placeholder IDs with real Matterport scan IDs from app.matterport.com
const DEMO_MODELS: Record<string, string> = {
  // Placeholder - replace with real IDs after scanning properties
  'AG-2026-010': 'SxQL3iGyoDo', // Demo model (Matterport public sample)
  'AG-2026-020': 'SxQL3iGyoDo',
  'AG-2026-030': 'SxQL3iGyoDo',
  default: 'SxQL3iGyoDo',
}

export default function Matterport3DTour({ modelId, propertyName, propertyPrice, compact = false }: Matterport3DTourProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const mid = modelId || DEMO_MODELS.default
  const embedUrl = `https://my.matterport.com/show/?m=${mid}&brand=0&mls=1&mt=0&play=1`

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.3)',
          borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
          fontFamily: 'var(--font-dm-mono), monospace', fontSize: '.52rem',
          color: '#c9a96e', letterSpacing: '.08em', transition: 'all .2s',
        }}
        aria-label={`Ver tour 3D de ${propertyName || 'imóvel'}`}
      >
        <span>⬡</span>
        <span>TOUR 3D</span>
      </button>
    )
  }

  return (
    <>
      {/* Tour CTA Card */}
      <div style={{
        background: 'linear-gradient(135deg,#0c1f15,#1c4a35)',
        borderRadius: 12, padding: '32px', marginTop: 24,
        border: '1px solid rgba(201,169,110,.2)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 80% 20%,rgba(201,169,110,.08),transparent)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.52rem', color: 'rgba(201,169,110,.6)', letterSpacing: '.2em', marginBottom: 12 }}>
          TOUR VIRTUAL IMERSIVO
        </div>
        <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.6rem', fontWeight: 300, color: '#f4f0e6', marginBottom: 8, lineHeight: 1.1 }}>
          Visita em 3D
        </div>
        <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: 'rgba(244,240,230,.55)', marginBottom: 24, lineHeight: 1.65 }}>
          Explora {propertyName || 'este imóvel'} ao teu ritmo. Tecnologia Matterport — cada divisão, cada detalhe.
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            background: '#c9a96e', color: '#0c1f15', border: 'none',
            borderRadius: 6, padding: '14px 32px', cursor: 'pointer',
            fontFamily: 'var(--font-jost)', fontSize: '.9rem', fontWeight: 500,
            letterSpacing: '.06em', transition: 'all .2s',
          }}
          aria-label={`Abrir tour 3D de ${propertyName || 'imóvel'}`}
        >
          Entrar no Tour 3D
        </button>
      </div>

      {/* Full-screen Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,.95)', display: 'flex', flexDirection: 'column',
          }}
          role="dialog"
          aria-label={`Tour 3D — ${propertyName}`}
          aria-modal="true"
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', fontWeight: 300, color: '#f4f0e6' }}>
                {propertyName || 'Tour Virtual 3D'}
              </div>
              {propertyPrice && (
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.52rem', color: '#c9a96e', letterSpacing: '.1em' }}>
                  {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(propertyPrice)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.52rem', color: 'rgba(255,255,255,.3)', letterSpacing: '.1em' }}>
                POWERED BY MATTERPORT
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', color: '#f4f0e6', fontFamily: 'var(--font-jost)', fontSize: '.85rem' }}
                aria-label="Fechar tour 3D"
              >
                ✕ Fechar
              </button>
            </div>
          </div>

          {/* Iframe */}
          <div style={{ flex: 1, position: 'relative' }}>
            {!isLoaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1f15' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.4rem', fontWeight: 300, color: '#f4f0e6', marginBottom: 8 }}>A carregar tour 3D...</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.52rem', color: 'rgba(201,169,110,.5)', letterSpacing: '.15em' }}>MATTERPORT · AGENCY GROUP</div>
                </div>
              </div>
            )}
            <iframe
              src={embedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="xr-spatial-tracking; gyroscope; accelerometer"
              allowFullScreen
              title={`Tour 3D — ${propertyName || 'Imóvel Agency Group'}`}
              onLoad={() => setIsLoaded(true)}
            />
          </div>
        </div>
      )}
    </>
  )
}
