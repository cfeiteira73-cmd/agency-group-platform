'use client'

import { useState } from 'react'
import { track } from '@/lib/gtm'

// ─── Zone market data — source: homeContent.ts + CLAUDE.md ───────────────────
const ZONA_DATA: Record<string, {
  pm2: number
  growth: string
  confidence: 'Alta' | 'Média'
  trend: string
}> = {
  'Lisboa':   { pm2: 6_538,  growth: '+19%', confidence: 'Alta',  trend: 'mercado em forte expansão' },
  'Cascais':  { pm2: 6_638,  growth: '+14%', confidence: 'Alta',  trend: 'procura internacional crescente' },
  'Comporta': { pm2: 11_000, growth: '+28%', confidence: 'Média', trend: 'valorização máxima nacional' },
  'Porto':    { pm2: 4_528,  growth: '+12%', confidence: 'Alta',  trend: 'segundo mercado prime de Portugal' },
  'Algarve':  { pm2: 5_200,  growth: '+10%', confidence: 'Alta',  trend: 'destino nº1 de investimento turístico' },
  'Madeira':  { pm2: 3_760,  growth: '+20%', confidence: 'Alta',  trend: 'expansão acelerada com regime IFICI' },
  'Sintra':   { pm2: 3_600,  growth: '+13%', confidence: 'Média', trend: '30 min de Lisboa, procura em alta' },
  'Ericeira': { pm2: 3_800,  growth: '+15%', confidence: 'Média', trend: 'reserva mundial de surf, procura jovem' },
}

const DEFAULT_ZONE = { pm2: 4_500, growth: '+17%', confidence: 'Média' as const, trend: 'mercado nacional em valorização' }

function formatRange(pm2: number, area?: number): { low: string; high: string } | null {
  if (!area || area <= 0) return null
  const low = Math.round(pm2 * area * 0.85 / 1000) * 1000
  const high = Math.round(pm2 * area * 1.15 / 1000) * 1000
  const fmt = (n: number) => '€ ' + n.toLocaleString('pt-PT')
  return { low: fmt(low), high: fmt(high) }
}

// ─── Avaliação Privada form — lead capture → inline estimate → WhatsApp ───────
export default function HomeAvaliacaoForm() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    zona: string; area: number | null; pm2: number; growth: string; confidence: string; trend: string;
  } | null>(null)
  const [waUrl, setWaUrl] = useState('')

  async function submitAvaliacao() {
    const nome = (document.getElementById('avalNome') as HTMLInputElement)?.value?.trim() || ''
    const tel  = (document.getElementById('avalTel')  as HTMLInputElement)?.value?.trim() || ''
    const zona = (document.getElementById('avalZona') as HTMLInputElement)?.value?.trim() || ''
    const areaRaw = (document.getElementById('avalArea') as HTMLInputElement)?.value?.trim() || ''
    const area = areaRaw ? parseFloat(areaRaw) : null

    if (!nome || !tel) {
      window.dispatchEvent(new CustomEvent('ag:toast', {
        detail: { msg: 'Por favor preenche o nome e telefone.', type: 'error' }
      }))
      return
    }

    setLoading(true)

    // Save to CRM — seller lead, high priority
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    nome,
          phone:   tel.replace(/\s/g, ''),
          source:  'avm_owner',
          intent:  'seller',
          zona:    zona || undefined,
          message: `Avaliação inicial confidencial · ${zona || 'zona não indicada'}${area ? ` · ${area}m²` : ''}`,
        }),
      })
    } catch { /* silent — never block UX */ }

    track('lead_form_submit', { source: 'avm_owner', intent: 'seller' })

    // Compute inline result
    const zd = (zona && ZONA_DATA[zona]) ? ZONA_DATA[zona] : DEFAULT_ZONE
    setResult({ zona: zona || 'Portugal', area, pm2: zd.pm2, growth: zd.growth, confidence: zd.confidence, trend: zd.trend })

    // Prepare WhatsApp with context
    const waText = [
      `Pedido de avaliação privada:`,
      `Nome: ${nome}`,
      `Telefone: ${tel}`,
      zona ? `Zona: ${zona}` : null,
      area ? `Área estimada: ${area}m²` : null,
    ].filter(Boolean).join('\n')
    setWaUrl(`https://wa.me/351919948986?text=${encodeURIComponent(waText)}`)
    setLoading(false)
  }

  // ── Post-submit: show result + CTA ─────────────────────────────────────────
  if (result) {
    const range = formatRange(result.pm2, result.area ?? undefined)
    return (
      <div style={{ marginTop: '8px' }}>
        {/* Result card */}
        <div style={{
          background: 'rgba(28,74,53,0.06)',
          border: '1px solid rgba(28,74,53,0.15)',
          padding: '20px 20px 16px',
          marginBottom: '12px',
        }}>
          {/* Zone + confidence */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
              letterSpacing: '.14em', textTransform: 'uppercase', color: '#1c4a35',
            }}>
              {result.zona} · Avaliação Inicial
            </span>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.48rem',
              letterSpacing: '.08em', color: 'rgba(28,74,53,.5)',
              background: 'rgba(28,74,53,.06)', padding: '2px 8px',
            }}>
              Confiança: {result.confidence}
            </span>
          </div>

          {/* Price per m² */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem',
              fontWeight: 400, color: '#0c1f15', lineHeight: 1,
            }}>
              {result.pm2.toLocaleString('pt-PT')} €/m²
            </div>
            <div style={{
              fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
              color: 'rgba(14,14,13,.45)', marginTop: '2px',
            }}>
              Preço médio de referência · {result.zona} 2026
            </div>
          </div>

          {/* Range if area entered */}
          {range && (
            <div style={{
              background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.15)',
              padding: '10px 14px', marginTop: '10px',
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
                letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)',
                marginBottom: '4px',
              }}>Intervalo estimado</div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem',
                fontWeight: 400, color: '#0c1f15',
              }}>
                {range.low} – {range.high}
              </div>
            </div>
          )}

          {/* Market note */}
          <div style={{
            fontFamily: "'Jost', sans-serif", fontSize: '.7rem',
            color: 'rgba(14,14,13,.4)', marginTop: '10px', lineHeight: 1.5,
          }}>
            Valorização 2025: <strong style={{ color: '#1c4a35' }}>{result.growth}</strong> · {result.trend}
          </div>

          {/* Disclaimer */}
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.46rem',
            letterSpacing: '.05em', color: 'rgba(14,14,13,.3)', marginTop: '10px',
            borderTop: '1px solid rgba(14,14,13,.06)', paddingTop: '8px',
          }}>
            Estimativa indicativa baseada no mercado de referência. Avaliação precisa requer análise presencial.
          </div>
        </div>

        {/* Primary CTA — WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('whatsapp_click', { source: 'avm_result' })}
          style={{
            display: 'block', width: '100%',
            padding: '14px', textAlign: 'center',
            background: '#1c4a35', color: '#f4f0e6',
            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
            letterSpacing: '.14em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Obter Avaliação Precisa →
        </a>
      </div>
    )
  }

  // ── Input form ──────────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={submitAvaliacao}
      disabled={loading}
      style={{
        marginTop: '8px',
        padding: '14px',
        background: loading ? 'rgba(28,74,53,0.6)' : '#1c4a35',
        color: '#f4f0e6',
        border: 'none',
        fontFamily: "'DM Mono', monospace",
        fontSize: '.52rem',
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontWeight: 400,
        transition: 'background .25s, transform .2s',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!loading) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
          ;(e.currentTarget as HTMLButtonElement).style.background = '#16382a'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLButtonElement).style.background = loading ? 'rgba(28,74,53,0.6)' : '#1c4a35'
      }}
    >
      {loading ? 'A calcular...' : 'Avaliação Inicial Confidencial →'}
    </button>
  )
}
