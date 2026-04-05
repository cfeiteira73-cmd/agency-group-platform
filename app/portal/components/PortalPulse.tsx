'use client'
import { useState, useEffect } from 'react'

// ─── MARKET DATA ────────────────────────────────────────────────────────────
const MARKET_DATA = {
  nacional: {
    mediana: 3076,
    variacao: 17.6,
    transacoes: 169812,
    diasMercado: 210,
    liquidez: 'Alta',
  },
  zonas: [
    { zona: 'Chiado / Príncipe Real', preco: 8200, var: 14.1, trend: 'up', liquidez: 92 },
    { zona: 'Lisboa Centro', preco: 6800, var: 12.3, trend: 'up', liquidez: 95 },
    { zona: 'Comporta', preco: 7600, var: 31.5, trend: 'up', liquidez: 65 },
    { zona: 'Cascais', preco: 4713, var: 8.7, trend: 'up', liquidez: 88 },
    { zona: 'Porto Foz', preco: 4100, var: 19.2, trend: 'up', liquidez: 82 },
    { zona: 'Algarve Costa', preco: 3941, var: 22.4, trend: 'up', liquidez: 78 },
    { zona: 'Madeira', preco: 3760, var: 18.9, trend: 'up', liquidez: 70 },
    { zona: 'Sintra', preco: 2890, var: 11.2, trend: 'stable', liquidez: 75 },
    { zona: 'Setúbal', preco: 2340, var: 28.6, trend: 'up', liquidez: 72 },
    { zona: 'Açores', preco: 1952, var: 9.4, trend: 'stable', liquidez: 55 },
  ],
  compradores: [
    { pais: '🇵🇹 Portugal', pct: 36, variacao: -3.1 },
    { pais: '🇺🇸 EUA', pct: 16, variacao: 2.1 },
    { pais: '🇫🇷 França', pct: 13, variacao: -0.5 },
    { pais: '🇬🇧 Reino Unido', pct: 9, variacao: 1.2 },
    { pais: '🇸🇦 Médio Oriente', pct: 7, variacao: 5.2 },
    { pais: '🇨🇳 China', pct: 8, variacao: -1.8 },
    { pais: '🇧🇷 Brasil', pct: 6, variacao: 3.4 },
    { pais: '🇩🇪 Alemanha', pct: 5, variacao: 0.8 },
  ],
  segmentos: [
    { label: 'Luxo €1M+', volume: 4823, var: 34.2, avgDays: 89 },
    { label: 'Premium €500K–1M', volume: 18234, var: 21.8, avgDays: 145 },
    { label: 'Médio €250K–500K', volume: 67890, var: 15.3, avgDays: 198 },
    { label: 'Acessível <€250K', volume: 78865, var: 8.7, avgDays: 245 },
  ],
  indices: [
    { label: 'Índice Confiança', val: 7.8, max: 10, color: '#1c4a35' },
    { label: 'Índice Liquidez', val: 8.2, max: 10, color: '#c9a96e' },
    { label: 'Índice Volatilidade', val: 3.1, max: 10, color: '#e05454' },
    { label: 'Pressão Oferta', val: 6.4, max: 10, color: '#3a7bd5' },
  ],
  previsoes: [
    { periodo: 'Q2 2026', expectativa: '+4.2%', confianca: 'Alta', nota: 'Procura forte · Oferta limitada' },
    { periodo: 'Q3 2026', expectativa: '+3.8%', confianca: 'Média-Alta', nota: 'Sazonalidade verão · Algarve pico' },
    { periodo: 'Q4 2026', expectativa: '+2.9%', confianca: 'Média', nota: 'Possível abrandamento BCE' },
    { periodo: 'H1 2027', expectativa: '+6–9%', confianca: 'Baixa', nota: 'Incerteza macro europeia' },
  ],
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('pt-PT')
}

function priceHeat(preco: number): string {
  if (preco >= 7000) return 'rgba(28,74,53,0.18)'
  if (preco >= 5000) return 'rgba(28,74,53,0.10)'
  if (preco >= 3500) return 'rgba(28,74,53,0.05)'
  return 'transparent'
}

function trendSymbol(trend: string) {
  if (trend === 'up') return { sym: '↑', color: '#1c4a35' }
  if (trend === 'down') return { sym: '↓', color: '#e05454' }
  return { sym: '→', color: '#c9a96e' }
}

function confidenceBadgeStyle(c: string): React.CSSProperties {
  if (c === 'Alta') return { background: 'rgba(28,74,53,0.15)', color: '#1c4a35', border: '1px solid rgba(28,74,53,0.3)' }
  if (c === 'Média-Alta') return { background: 'rgba(201,169,110,0.15)', color: '#8a6c2e', border: '1px solid rgba(201,169,110,0.4)' }
  if (c === 'Média') return { background: 'rgba(58,123,213,0.12)', color: '#3a7bd5', border: '1px solid rgba(58,123,213,0.3)' }
  return { background: 'rgba(150,150,150,0.12)', color: '#555', border: '1px solid rgba(150,150,150,0.3)' }
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function PortalPulse() {
  const [tick, setTick] = useState(0)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 3000)
    const now = new Date()
    setLastUpdated(
      now.toLocaleString('pt-PT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    )
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      fontFamily: "'Jost', sans-serif",
      background: '#f4f0e6',
      color: '#0e0e0d',
      minHeight: '100vh',
      padding: '32px 24px 60px',
      maxWidth: 1280,
      margin: '0 auto',
    }}>

      {/* ── KEYFRAMES (injected once) ── */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(28,74,53,0.5); }
          50% { opacity: 0.8; transform: scale(1.15); box-shadow: 0 0 0 6px rgba(28,74,53,0); }
        }
        @keyframes pulse-gold {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(201,169,110,0.5); }
          50% { opacity: 0.8; transform: scale(1.15); box-shadow: 0 0 0 6px rgba(201,169,110,0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .pulse-row-hover { transition: background 0.18s ease; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 36,
        borderBottom: '1px solid rgba(28,74,53,0.15)',
        paddingBottom: 20,
        animation: 'fade-in 0.5s ease both',
      }}>
        <div>
          <div style={{
            fontFamily: "'Cormorant', serif",
            fontSize: 42,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.5px',
            color: '#0e0e0d',
          }}>
            Market <em style={{ color: '#1c4a35', fontStyle: 'italic' }}>Pulse IA</em>
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            color: '#666',
            marginTop: 6,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Inteligência de Mercado · Portugal 2026 · Tempo Real
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'flex-end',
            marginBottom: 4,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#1c4a35',
              display: 'inline-block',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#1c4a35', fontWeight: 600 }}>
              LIVE
            </span>
          </div>
          {lastUpdated && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#999' }}>
              {lastUpdated}
            </div>
          )}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#bbb', marginTop: 2 }}>
            AMI 22506 · Agency Group
          </div>
        </div>
      </div>

      {/* ── KPI TICKER ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 28,
        animation: 'fade-in 0.6s ease 0.1s both',
      }}>
        {[
          {
            label: 'Mediana Nacional',
            value: '€3.076/m²',
            badge: '+17.6% YoY',
            badgeColor: '#1c4a35',
            sub: '169.812 transacções',
            pulse: 'green',
          },
          {
            label: 'Volume Transacções',
            value: '169.812',
            badge: '+8.3%',
            badgeColor: '#1c4a35',
            sub: 'Mercado nacional 2026',
            pulse: 'green',
          },
          {
            label: 'Lisboa Luxo',
            value: '€8.200/m²',
            badge: '+14.1% YoY',
            badgeColor: '#c9a96e',
            sub: 'Chiado / Príncipe Real',
            pulse: 'gold',
          },
          {
            label: 'Dias Médio Mercado',
            value: '210 dias',
            badge: 'Liquidez Alta',
            badgeColor: '#3a7bd5',
            sub: 'Luxo: 89 dias',
            pulse: null,
          },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: '#fff',
            border: '1px solid rgba(28,74,53,0.1)',
            borderRadius: 14,
            padding: '20px 22px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}>
              {kpi.pulse && (
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: kpi.pulse === 'gold' ? '#c9a96e' : '#1c4a35',
                  display: 'inline-block',
                  flexShrink: 0,
                  animation: `${kpi.pulse === 'gold' ? 'pulse-gold' : 'pulse-dot'} 2s ease-in-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                }} />
              )}
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: '#888',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {kpi.label}
              </span>
            </div>
            <div style={{
              fontFamily: "'Cormorant', serif",
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: 8,
              color: '#0e0e0d',
            }}>
              {kpi.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: `${kpi.badgeColor}18`,
                color: kpi.badgeColor,
                border: `1px solid ${kpi.badgeColor}33`,
                borderRadius: 6,
                padding: '2px 8px',
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
              }}>
                {kpi.badge}
              </span>
              <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, color: '#aaa' }}>
                {kpi.sub}
              </span>
            </div>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 80,
              height: 80,
              background: `radial-gradient(circle at 100% 0%, ${kpi.badgeColor}0a 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
          </div>
        ))}
      </div>

      {/* ── INDICES GAUGES ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 28,
        animation: 'fade-in 0.6s ease 0.2s both',
      }}>
        {MARKET_DATA.indices.map((idx, i) => {
          const pct = (idx.val / idx.max) * 100
          const angle = (pct / 100) * 180
          return (
            <div key={i} style={{
              background: '#fff',
              border: '1px solid rgba(28,74,53,0.08)',
              borderRadius: 14,
              padding: '24px 20px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              {/* Arc gauge via conic-gradient */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
                <div style={{
                  width: 88,
                  height: 44,
                  borderRadius: '44px 44px 0 0',
                  background: `conic-gradient(from 180deg at 50% 100%, ${idx.color} 0deg, ${idx.color} ${angle}deg, #e8e4da ${angle}deg, #e8e4da 180deg)`,
                  overflow: 'hidden',
                  position: 'relative',
                }} />
                {/* Inner cutout */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 58,
                  height: 29,
                  borderRadius: '29px 29px 0 0',
                  background: '#fff',
                }} />
              </div>
              <div style={{
                fontFamily: "'Cormorant', serif",
                fontSize: 32,
                fontWeight: 700,
                color: idx.color,
                lineHeight: 1,
                marginBottom: 4,
              }}>
                {idx.val}
                <span style={{ fontSize: 14, color: '#aaa', fontFamily: "'DM Mono', monospace" }}>
                  /{idx.max}
                </span>
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: 4,
              }}>
                {idx.label}
              </div>
              {/* Linear bar backup */}
              <div style={{
                marginTop: 12,
                height: 3,
                background: '#e8e4da',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: idx.color,
                  borderRadius: 4,
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ZONA HEAT TABLE ── */}
      <div style={{
        background: '#fff',
        border: '1px solid rgba(28,74,53,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 28,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        animation: 'fade-in 0.6s ease 0.3s both',
      }}>
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid rgba(28,74,53,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: 20, fontWeight: 700 }}>
            Zonas de Mercado
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: '#aaa',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Por preço descendente · Portugal 2026
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(28,74,53,0.08)' }}>
              {['Zona', '€/m²', 'Var. YoY', 'Tendência', 'Liquidez'].map((col, ci) => (
                <th key={ci} style={{
                  padding: '10px 24px',
                  textAlign: ci === 0 ? 'left' : 'center',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: '#888',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKET_DATA.zonas.map((z, i) => {
              const { sym, color } = trendSymbol(z.trend)
              const isHovered = hoveredRow === i
              return (
                <tr
                  key={i}
                  className="pulse-row-hover"
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: isHovered
                      ? 'rgba(28,74,53,0.05)'
                      : i % 2 === 0
                        ? priceHeat(z.preco)
                        : 'rgba(248,246,240,0.5)',
                    borderBottom: '1px solid rgba(28,74,53,0.05)',
                    cursor: 'default',
                  }}
                >
                  <td style={{ padding: '13px 24px', fontWeight: 600, fontSize: 14 }}>
                    {z.zona}
                  </td>
                  <td style={{ padding: '13px 24px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                    <span style={{
                      background: `rgba(28,74,53,${Math.min((z.preco / 10000) * 0.35 + 0.05, 0.18)})`,
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontWeight: 600,
                    }}>
                      €{fmt(z.preco)}
                    </span>
                  </td>
                  <td style={{ padding: '13px 24px', textAlign: 'center' }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: z.var >= 20 ? '#c9a96e' : '#1c4a35',
                    }}>
                      +{z.var}%
                    </span>
                  </td>
                  <td style={{ padding: '13px 24px', textAlign: 'center' }}>
                    <span style={{ fontSize: 18, color, fontWeight: 700 }}>{sym}</span>
                  </td>
                  <td style={{ padding: '13px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <div style={{
                        width: 72,
                        height: 5,
                        background: '#e8e4da',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${z.liquidez}%`,
                          height: '100%',
                          background: z.liquidez >= 85 ? '#1c4a35' : z.liquidez >= 70 ? '#c9a96e' : '#e05454',
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: '#888',
                        minWidth: 26,
                        textAlign: 'right',
                      }}>
                        {z.liquidez}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── COMPRADORES + SEGMENTOS (side by side) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        marginBottom: 28,
        animation: 'fade-in 0.6s ease 0.4s both',
      }}>

        {/* Compradores */}
        <div style={{
          background: '#fff',
          border: '1px solid rgba(28,74,53,0.08)',
          borderRadius: 14,
          padding: '22px 24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Cormorant', serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
              Compradores Internacionais
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Mix por nacionalidade · % volume 2026
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MARKET_DATA.compradores.sort((a, b) => b.pct - a.pct).map((c, i) => {
              const isPositive = c.variacao > 0
              const barColor = c.pais.includes('EUA') || c.pais.includes('Médio')
                ? '#c9a96e'
                : c.pais.includes('Portugal')
                  ? '#3a7bd5'
                  : '#1c4a35'
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.pais}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: isPositive ? '#1c4a35' : '#e05454',
                        fontWeight: 600,
                      }}>
                        {isPositive ? '+' : ''}{c.variacao}%
                      </span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        minWidth: 30,
                        textAlign: 'right',
                      }}>
                        {c.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#f0ece2', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${c.pct * 2.5}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 4,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Segmentos */}
        <div style={{
          background: '#fff',
          border: '1px solid rgba(28,74,53,0.08)',
          borderRadius: 14,
          padding: '22px 24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Cormorant', serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
              Segmentos de Mercado
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Volume · Crescimento · Velocidade
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {MARKET_DATA.segmentos.map((s, i) => {
              const segColors = ['#c9a96e', '#1c4a35', '#3a7bd5', '#888']
              const col = segColors[i]
              return (
                <div key={i} style={{
                  border: `1px solid ${col}22`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  background: `${col}08`,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#0e0e0d' }}>{s.label}</span>
                    <span style={{
                      background: `${col}20`,
                      color: col,
                      border: `1px solid ${col}44`,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      +{s.var}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                        Volume
                      </div>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: 22, fontWeight: 700, lineHeight: 1, color: col }}>
                        {fmt(s.volume)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                        Dias Médios
                      </div>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                        {s.avgDays}d
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── PREVISÕES TIMELINE ── */}
      <div style={{
        background: '#fff',
        border: '1px solid rgba(28,74,53,0.08)',
        borderRadius: 14,
        padding: '22px 24px',
        marginBottom: 28,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        animation: 'fade-in 0.6s ease 0.5s both',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
            Previsões de Mercado
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Q2 2026 → H1 2027 · Modelo preditivo AG IA
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {MARKET_DATA.previsoes.map((p, i) => (
            <div key={i} style={{
              position: 'relative',
              paddingLeft: 16,
              borderLeft: `3px solid ${i === 0 ? '#1c4a35' : i === 1 ? '#c9a96e' : i === 2 ? '#3a7bd5' : '#bbb'}`,
            }}>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: '#aaa',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}>
                {p.periodo}
              </div>
              <div style={{
                fontFamily: "'Cormorant', serif",
                fontSize: 34,
                fontWeight: 700,
                color: '#1c4a35',
                lineHeight: 1,
                marginBottom: 8,
              }}>
                {p.expectativa}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  ...confidenceBadgeStyle(p.confianca),
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}>
                  {p.confianca}
                </span>
              </div>
              <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                {p.nota}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI INSIGHT BOX ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d2e1f 0%, #1c4a35 50%, #163d2b 100%)',
        borderRadius: 16,
        padding: '30px 32px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(28,74,53,0.35)',
        animation: 'fade-in 0.6s ease 0.6s both',
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(201,169,110,0.08)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -60,
          left: -30,
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}>
            <span style={{ color: '#c9a96e', fontSize: 18 }}>✦</span>
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              color: 'rgba(201,169,110,0.9)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}>
              Análise IA — Posicionamento de Mercado
            </span>
            <span style={{
              marginLeft: 'auto',
              background: 'rgba(201,169,110,0.15)',
              border: '1px solid rgba(201,169,110,0.35)',
              color: '#c9a96e',
              borderRadius: 6,
              padding: '2px 10px',
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.06em',
            }}>
              Q2 · 2026
            </span>
          </div>
          <div style={{
            fontFamily: "'Cormorant', serif",
            fontSize: 20,
            fontWeight: 400,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.92)',
            maxWidth: 940,
          }}>
            O mercado de luxo português apresenta fundamentos excepcionalmente robustos em Q2 2026.
            A procura norte-americana (+16%) e do Médio Oriente (+5.2% YoY) compensam a retracção chinesa.
            Comporta emerge como zona de maior valorização (31.5% YoY), seguida por Setúbal (28.6%).{' '}
            <span style={{ color: '#c9a96e', fontStyle: 'italic' }}>
              Recomendação: exposição a activos premium em Comporta e Cascais com horizonte 3–5 anos.
            </span>
          </div>
          <div style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            gap: 32,
          }}>
            {[
              { label: 'Zonas Analisadas', val: '10' },
              { label: 'Fontes de Dados', val: '24' },
              { label: 'Confiança Modelo', val: '91.4%' },
              { label: 'Última Actualização', val: 'Tempo Real' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 3,
                }}>
                  {m.label}
                </div>
                <div style={{
                  fontFamily: "'Cormorant', serif",
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#c9a96e',
                  lineHeight: 1,
                }}>
                  {m.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
