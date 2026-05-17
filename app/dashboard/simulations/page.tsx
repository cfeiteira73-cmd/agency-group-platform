'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// /dashboard/simulations — Simulador de Receita
// Financial forecasting: simulate impact of every decision before executing.
// =============================================================================

import { useState, useRef } from 'react'
import type { ActionSimulationResult, SimulableAction } from '@/lib/agent-autonomy-v2'

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0c1f15',
  card: '#111e16',
  cardDeep: 'rgba(12,31,21,0.6)',
  border: 'rgba(201,169,110,0.15)',
  goldBorder: 'rgba(201,169,110,0.22)',
  divider: 'rgba(201,169,110,0.08)',
  gold: '#c9a96e',
  goldDim: 'rgba(201,169,110,0.12)',
  cream: '#f4f0e6',
  cream55: 'rgba(244,240,230,0.55)',
  cream28: 'rgba(244,240,230,0.28)',
  green: '#4ade80',
  greenDim: 'rgba(74,222,128,0.1)',
  greenBorder: 'rgba(74,222,128,0.25)',
  err: '#f87171',
  errDim: 'rgba(248,113,113,0.1)',
  errBorder: 'rgba(248,113,113,0.25)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.1)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimulationsResponse {
  simulations: ActionSimulationResult[]
  recommended: ActionSimulationResult[]
  total_potential_gain_eur: number
}

// ─── Action label mapping (Portuguese) ───────────────────────────────────────

const ACTION_LABELS: Record<SimulableAction, string> = {
  adjust_price:       'Redução de Preço',
  boost_homepage:     'Destaque na Homepage',
  trigger_campaign:   'Activar Campanha',
  outreach_contact:   'Contacto Proactivo',
  flag_listing:       'Sinalizar Listagem',
  generate_deal_pack: 'Gerar Deal Pack',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  return Math.round(n).toLocaleString('pt-PT')
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1)
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function Shimmer({ height, style }: { height?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: '100%',
        height: height ?? 20,
        borderRadius: 8,
        background: `linear-gradient(90deg, ${C.goldDim} 0%, rgba(201,169,110,0.22) 50%, ${C.goldDim} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'ag-shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// ─── Safety badge ──────────────────────────────────────────────────────────────

function SafetyBadge({ level }: { level: ActionSimulationResult['safety_level'] }) {
  const map = {
    safe:                    { label: 'Seguro',       bg: C.greenDim, border: C.greenBorder, color: C.green },
    review_required:         { label: 'Rever',        bg: C.amberDim, border: 'rgba(251,191,36,0.3)', color: C.amber },
    human_approval_required: { label: 'Aprovação',    bg: C.errDim,   border: C.errBorder,   color: C.err },
  }
  const s = map[level]
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      padding: '2px 8px',
      borderRadius: 4,
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontFamily: 'var(--font-jost, system-ui)',
    }}>
      {s.label}
    </span>
  )
}

// ─── Simulation card ──────────────────────────────────────────────────────────

function SimCard({
  result,
  isRecommended,
}: {
  result: ActionSimulationResult
  isRecommended: boolean
}) {
  const probGain = result.delta.probability_gain * 100
  const gainColor = result.delta.commission_gain_eur > 0 ? C.green : C.err

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${isRecommended ? C.gold : C.border}`,
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: isRecommended
        ? '0 0 0 1px rgba(201,169,110,0.15), 0 0 24px rgba(201,169,110,0.08)'
        : 'none',
      position: 'relative',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-jost, system-ui)',
              fontSize: 14,
              fontWeight: 700,
              color: C.cream,
            }}>
              {ACTION_LABELS[result.action]}
            </span>
            {isRecommended && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 4,
                background: 'rgba(201,169,110,0.15)',
                border: `1px solid ${C.goldBorder}`,
                color: C.gold,
                fontFamily: 'var(--font-jost, system-ui)',
              }}>
                Recomendado
              </span>
            )}
          </div>
        </div>
        <SafetyBadge level={result.safety_level} />
      </div>

      {/* Before / After */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {/* Before */}
        <div style={{
          background: 'rgba(244,240,230,0.03)',
          border: `1px solid ${C.divider}`,
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 10,
            color: C.cream28,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '0 0 8px',
            fontWeight: 700,
          }}>
            Antes
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: C.cream55 }}>
              {fmtPct(result.before.close_probability)}% fecho
            </span>
            <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: C.cream55 }}>
              {result.before.estimated_days_to_close} dias
            </span>
            <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: C.cream55 }}>
              €{fmtEur(result.before.expected_commission_eur)}
            </span>
          </div>
        </div>

        {/* After */}
        <div style={{
          background: 'rgba(74,222,128,0.03)',
          border: `1px solid ${C.greenBorder}`,
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 10,
            color: C.green,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '0 0 8px',
            fontWeight: 700,
          }}>
            Depois
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: gainColor }}>
              {fmtPct(result.after.close_probability)}% fecho
              {result.delta.probability_gain > 0 && (
                <span style={{ fontSize: 10, marginLeft: 4, color: C.green }}>
                  (+{probGain.toFixed(1)}%)
                </span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: result.delta.days_saved > 0 ? C.green : C.cream55 }}>
              {result.after.estimated_days_to_close} dias
              {result.delta.days_saved > 0 && (
                <span style={{ fontSize: 10, marginLeft: 4, color: C.green }}>
                  (−{result.delta.days_saved})
                </span>
              )}
            </span>
            <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: result.delta.commission_gain_eur > 0 ? C.green : C.cream55 }}>
              €{fmtEur(result.after.expected_commission_eur)}
              {result.delta.commission_gain_eur > 0 && (
                <span style={{ fontSize: 10, marginLeft: 4, color: C.green }}>
                  (+€{fmtEur(result.delta.commission_gain_eur)})
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Delta summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 12,
          fontWeight: 700,
          color: gainColor,
        }}>
          +{probGain.toFixed(1)}%
        </span>
        {result.delta.days_saved > 0 && (
          <span style={{
            fontSize: 11,
            color: C.cream55,
            background: C.greenDim,
            border: `1px solid ${C.greenBorder}`,
            padding: '2px 7px',
            borderRadius: 4,
            fontFamily: 'var(--font-jost, system-ui)',
          }}>
            −{result.delta.days_saved} dias
          </span>
        )}
        <span style={{
          fontSize: 11,
          color: C.gold,
          background: C.goldDim,
          border: `1px solid ${C.border}`,
          padding: '2px 7px',
          borderRadius: 4,
          fontFamily: 'var(--font-jost, system-ui)',
          fontWeight: 700,
        }}>
          €{fmtEur(result.delta.commission_gain_eur)}
        </span>
        <span style={{
          fontSize: 11,
          color: C.cream55,
          background: result.reversible ? C.greenDim : C.errDim,
          border: `1px solid ${result.reversible ? C.greenBorder : C.errBorder}`,
          padding: '2px 7px',
          borderRadius: 4,
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          {result.reversible ? 'Reversível' : 'Definitivo'}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          flex: 1,
          height: 4,
          background: C.goldDim,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.round(result.confidence * 100)}%`,
            height: '100%',
            background: C.gold,
            borderRadius: 2,
          }} />
        </div>
        <span style={{
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 10,
          color: C.cream28,
          flexShrink: 0,
        }}>
          {Math.round(result.confidence * 100)}% conf.
        </span>
      </div>

      {/* Recommendation */}
      <p style={{
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 12,
        color: C.cream55,
        fontStyle: 'italic',
        margin: 0,
        lineHeight: 1.5,
      }}>
        {result.recommendation}
      </p>
    </div>
  )
}

// ─── Number input ──────────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 11,
        color: C.cream28,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: 'rgba(12,31,21,0.8)',
          border: `1px solid ${C.goldBorder}`,
          borderRadius: 8,
          padding: '9px 14px',
          color: C.cream,
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SimulationsPage() {
  const [propertyValue, setPropertyValue]         = useState(500_000)
  const [closeProbability, setCloseProbability]   = useState(8)
  const [daysOnMarket, setDaysOnMarket]           = useState(90)
  const [demandScore, setDemandScore]             = useState(50)

  const [data, setData]       = useState<SimulationsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  function handleSimulate() {
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_value_eur: propertyValue,
        current_close_probability: closeProbability / 100,
        days_on_market: daysOnMarket,
        demand_score: demandScore,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha na simulação')
        return res.json() as Promise<SimulationsResponse>
      })
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Não foi possível executar a simulação. Tente novamente.')
        setLoading(false)
      })
  }

  const recommendedIds = new Set((data?.recommended ?? []).map((r) => r.simulation_id))

  return (
    <>
      <style>{`
        @keyframes ag-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: C.bg,
        padding: '0 0 60px',
      }}>
        {/* ── Sticky header ─────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: C.bg,
          borderBottom: `1px solid ${C.divider}`,
          padding: '18px 32px 16px',
        }}>
          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 11,
            color: C.cream28,
            margin: '0 0 6px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Dashboard&nbsp;→&nbsp;Simulações
          </p>

          <h1 style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 32,
            fontWeight: 600,
            color: C.cream,
            margin: '0 0 6px',
            letterSpacing: '-0.01em',
          }}>
            Simulador de{' '}
            <em style={{ color: C.gold, fontStyle: 'italic' }}>Receita</em>
          </h1>

          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 13,
            color: C.cream55,
            margin: 0,
          }}>
            Simule o impacto de cada decisão antes de executar
          </p>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '28px 32px', maxWidth: 1040 }}>

          {/* ── Input card ──────────────────────────────────────────────── */}
          <div style={{
            background: C.card,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 12,
            padding: '22px 24px',
            marginBottom: 28,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 20,
            }}>
              <NumInput
                label="Valor do Imóvel (€)"
                value={propertyValue}
                onChange={setPropertyValue}
                min={10_000}
                max={50_000_000}
                step={10_000}
              />
              <NumInput
                label="Probabilidade de Fecho (%)"
                value={closeProbability}
                onChange={setCloseProbability}
                min={1}
                max={99}
                step={1}
              />
              <NumInput
                label="Dias no Mercado"
                value={daysOnMarket}
                onChange={setDaysOnMarket}
                min={0}
                max={1000}
                step={1}
              />
              <NumInput
                label="Procura (0–100)"
                value={demandScore}
                onChange={setDemandScore}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <button
              type="button"
              onClick={handleSimulate}
              disabled={loading}
              style={{
                background: loading ? 'rgba(201,169,110,0.3)' : C.gold,
                border: 'none',
                borderRadius: 9,
                padding: '11px 28px',
                color: loading ? C.cream55 : '#0c1f15',
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {loading ? 'A calcular…' : 'Simular'}
            </button>
          </div>

          {/* ── Error state ──────────────────────────────────────────────── */}
          {error && (
            <div style={{
              background: C.errDim,
              border: `1px solid ${C.errBorder}`,
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 20,
            }}>
              <p style={{
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 13,
                color: C.err,
                margin: 0,
              }}>
                {error}
              </p>
            </div>
          )}

          {/* ── Loading skeletons ─────────────────────────────────────────── */}
          {loading && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}>
              {[...Array(6)].map((_, i) => (
                <Shimmer key={i} height={220} />
              ))}
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────────── */}
          {!loading && data && (
            <>
              {/* Total potential row */}
              <div style={{
                background: 'linear-gradient(90deg, rgba(201,169,110,0.1) 0%, rgba(12,31,21,0) 100%)',
                border: `1px solid ${C.goldBorder}`,
                borderRadius: 10,
                padding: '14px 20px',
                marginBottom: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: 'var(--font-jost, system-ui)',
                  fontSize: 13,
                  color: C.cream55,
                }}>
                  Potencial total de receita identificado:
                </span>
                <span style={{
                  fontFamily: 'var(--font-cormorant, serif)',
                  fontSize: 26,
                  fontWeight: 700,
                  color: C.gold,
                  letterSpacing: '-0.01em',
                }}>
                  €{fmtEur(data.total_potential_gain_eur)}
                </span>
              </div>

              {/* Simulation cards grid */}
              {data.simulations.length === 0 ? (
                <div style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '40px 24px',
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 14,
                    color: C.cream55,
                    margin: 0,
                  }}>
                    Nenhuma simulação disponível para os parâmetros inseridos.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 16,
                }}>
                  {data.simulations.map((result) => (
                    <SimCard
                      key={result.simulation_id}
                      result={result}
                      isRecommended={recommendedIds.has(result.simulation_id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Initial empty state (no simulation yet) ──────────────────── */}
          {!loading && !data && !error && (
            <div style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '48px 24px',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: 'var(--font-cormorant, serif)',
                fontSize: 22,
                color: C.cream55,
                margin: '0 0 8px',
              }}>
                Pronto para simular
              </p>
              <p style={{
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 13,
                color: C.cream28,
                margin: 0,
              }}>
                Insira os dados do imóvel e clique em Simular para ver o impacto de cada acção.
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
