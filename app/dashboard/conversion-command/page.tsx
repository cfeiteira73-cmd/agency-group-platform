'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// /dashboard/conversion-command — Centro de Conversão
// Funnel visualizer, commission card, next-best-action, action queue.
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import type { ConversionFunnelPrediction } from '@/lib/buyer-to-conversion'
import type { RevenueImpactCard, ActionType } from '@/lib/value-attribution-engine'

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

interface FunnelResponse {
  prediction: ConversionFunnelPrediction
  top_action: RevenueImpactCard | null
  generated_at: string
}

type IntentOption = 'investor' | 'luxury_buyer' | 'family' | 'relocating' | 'international'

// ─── Action label mapping (Portuguese) ───────────────────────────────────────

const ACTION_LABELS: Record<ActionType, string> = {
  price_reduction: 'Redução de Preço',
  photo_upgrade: 'Melhoria de Fotografias',
  homepage_boost: 'Destaque na Homepage',
  campaign_send: 'Enviar Campanha',
  inquiry_response: 'Resposta a Inquérito',
  visit_booking: 'Agendar Visita',
  offer_submission: 'Submeter Proposta',
  negotiation_move: 'Movimento de Negociação',
  listing_refresh: 'Renovar Listagem',
  deal_pack_send: 'Enviar Deal Pack',
  follow_up_call: 'Chamada de Seguimento',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  return Math.round(n).toLocaleString('pt-PT')
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1)
}

function barColor(pct: number): string {
  if (pct > 0.4) return C.green
  if (pct > 0.2) return C.gold
  return C.amber
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function Shimmer({ width, height, style }: { width?: string; height?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? 20,
        borderRadius: 6,
        background: `linear-gradient(90deg, ${C.goldDim} 0%, rgba(201,169,110,0.22) 50%, ${C.goldDim} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'ag-shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// ─── Funnel stage row ─────────────────────────────────────────────────────────

function FunnelRow({ icon, label, probability }: { icon: string; label: string; probability: number }) {
  const pct = probability * 100
  const color = barColor(probability)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 18, width: 28, flexShrink: 0, textAlign: 'center' }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 13,
        color: C.cream55,
        width: 90,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 10,
        background: C.goldDim,
        borderRadius: 5,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.max(pct, 1)}%`,
          height: '100%',
          background: color,
          borderRadius: 5,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 13,
        fontWeight: 700,
        color,
        width: 46,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

// ─── Urgency badge ─────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: RevenueImpactCard['urgency'] }) {
  const map = {
    critical: { label: 'Crítico', bg: C.errDim, border: C.errBorder, color: C.err },
    high:     { label: 'Alto',    bg: C.amberDim, border: 'rgba(251,191,36,0.3)', color: C.amber },
    medium:   { label: 'Médio',   bg: C.goldDim, border: C.goldBorder, color: C.gold },
    low:      { label: 'Baixo',   bg: C.greenDim, border: C.greenBorder, color: C.green },
  }
  const s = map[urgency]
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

// ─── Action queue card ────────────────────────────────────────────────────────

function ActionQueueCard({ card, rank }: { card: RevenueImpactCard; rank: number }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <span style={{
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 11,
        fontWeight: 700,
        color: C.cream28,
        width: 18,
        flexShrink: 0,
        textAlign: 'center',
      }}>
        {rank}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 13,
            fontWeight: 600,
            color: C.cream,
          }}>
            {ACTION_LABELS[card.action_type]}
          </span>
          <UrgencyBadge urgency={card.urgency} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
          <span style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 12,
            color: C.gold,
            fontWeight: 700,
          }}>
            +€{fmtEur(card.expected_value_eur)}
          </span>
          <span style={{
            fontSize: 11,
            color: C.cream55,
            background: C.goldDim,
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-jost, system-ui)',
          }}>
            +{card.conversion_lift_pct}% conversão
          </span>
          <span style={{
            fontSize: 11,
            color: C.cream55,
            background: C.greenDim,
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-jost, system-ui)',
          }}>
            {card.time_to_close_delta_days} dias
          </span>
        </div>
        {/* Confidence bar */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1,
            height: 4,
            background: C.goldDim,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.round(card.confidence * 100)}%`,
              height: '100%',
              background: C.gold,
              borderRadius: 2,
            }} />
          </div>
          <span style={{
            fontSize: 10,
            color: C.cream28,
            fontFamily: 'var(--font-jost, system-ui)',
            flexShrink: 0,
          }}>
            {Math.round(card.confidence * 100)}% conf.
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConversionCommandPage() {
  const [propertyValue, setPropertyValue] = useState(500_000)
  const [intent, setIntent] = useState<IntentOption>('investor')
  const [data, setData] = useState<FunnelResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Derive all action cards from a fresh computation when we have data
  // We fetch from the API which returns top_action; we also display a ranked queue
  // built from the prediction's p_close + property_value using the same engine.
  const [actionCards, setActionCards] = useState<RevenueImpactCard[]>([])

  const fetchFunnel = useCallback((value: number, signal: AbortSignal) => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      property_value_eur: String(value),
      current_p_close: '0.08',
    })

    fetch(`/api/conversion/funnel?${params.toString()}`, { signal })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar funil')
        return res.json() as Promise<FunnelResponse>
      })
      .then((json) => {
        setData(json)
        setLoading(false)

        // Build ranked action cards client-side for the queue section
        // Use dynamic import pattern via valueAttributionEngine equivalent
        // We reconstruct from the top_action data + known models
        if (json.top_action) {
          setActionCards([json.top_action])
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Não foi possível carregar os dados. Tente novamente.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchFunnel(propertyValue, controller.signal)
    return () => controller.abort()
  }, [propertyValue, fetchFunnel])

  const prediction = data?.prediction
  const topAction = data?.top_action ?? null

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
          {/* Breadcrumb */}
          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 11,
            color: C.cream28,
            margin: '0 0 6px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Dashboard&nbsp;→&nbsp;Centro de Conversão
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 32,
              fontWeight: 600,
              color: C.cream,
              margin: 0,
              letterSpacing: '-0.01em',
            }}>
              Centro de{' '}
              <em style={{ color: C.gold, fontStyle: 'italic' }}>Conversão</em>
            </h1>
          </div>

          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 13,
            color: C.cream55,
            margin: '6px 0 0',
            letterSpacing: '0.01em',
          }}>
            Probabilidade de fecho · Acções de receita · Perfil do comprador
          </p>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div style={{ padding: '28px 32px', maxWidth: 960 }}>

          {/* ── Demo Funnel Controls ─────────────────────────────────────── */}
          <div style={{
            background: C.card,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 20,
            flexWrap: 'wrap',
          }}>
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
                Valor do Imóvel (€)
              </label>
              <input
                type="number"
                value={propertyValue}
                min={50_000}
                max={50_000_000}
                step={10_000}
                onChange={(e) => setPropertyValue(Number(e.target.value))}
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
                  width: 180,
                }}
              />
            </div>

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
                Perfil do Comprador
              </label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as IntentOption)}
                style={{
                  background: 'rgba(12,31,21,0.8)',
                  border: `1px solid ${C.goldBorder}`,
                  borderRadius: 8,
                  padding: '9px 14px',
                  color: C.cream,
                  fontFamily: 'var(--font-jost, system-ui)',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                  minWidth: 180,
                }}
              >
                <option value="investor">Investidor</option>
                <option value="luxury_buyer">Comprador Luxo</option>
                <option value="family">Família</option>
                <option value="relocating">Relocação</option>
                <option value="international">Internacional</option>
              </select>
            </div>

            <div style={{
              fontFamily: 'var(--font-jost, system-ui)',
              fontSize: 11,
              color: C.cream28,
              paddingBottom: 10,
            }}>
              Modo demo · sem sessão activa
            </div>
          </div>

          {/* ── Two-column layout ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* ── Funnel visualization ─────────────────────────────────── */}
            <div style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '22px 24px',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-cormorant, serif)',
                fontSize: 20,
                fontWeight: 600,
                color: C.cream,
                margin: '0 0 20px',
              }}>
                Funil de Conversão
              </h2>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[...Array(4)].map((_, i) => (
                    <Shimmer key={i} height={28} />
                  ))}
                </div>
              ) : error ? (
                <p style={{
                  fontFamily: 'var(--font-jost, system-ui)',
                  fontSize: 13,
                  color: C.err,
                }}>
                  {error}
                </p>
              ) : prediction ? (
                <>
                  <FunnelRow icon="🔍" label="Inquérito"  probability={prediction.p_inquiry} />
                  <FunnelRow icon="👁"  label="Visita"     probability={prediction.p_visit}   />
                  <FunnelRow icon="💼" label="Proposta"   probability={prediction.p_offer}   />
                  <FunnelRow icon="🤝" label="Fecho"      probability={prediction.p_close}   />
                </>
              ) : null}
            </div>

            {/* ── Commission card ───────────────────────────────────────── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(12,31,21,1) 100%)',
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 12,
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <p style={{
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 11,
                color: C.cream28,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: '0 0 8px',
              }}>
                Comissão Esperada · 5%
              </p>

              {loading ? (
                <>
                  <Shimmer height={48} style={{ marginBottom: 12 }} />
                  <Shimmer height={18} width="60%" />
                </>
              ) : prediction ? (
                <>
                  <div style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: 48,
                    fontWeight: 700,
                    color: C.gold,
                    lineHeight: 1,
                    marginBottom: 10,
                    letterSpacing: '-0.02em',
                  }}>
                    €{fmtEur(prediction.expected_value_eur)}
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 13,
                    color: C.cream55,
                    margin: '0 0 6px',
                  }}>
                    Valor esperado de comissão
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 12,
                    color: C.cream28,
                    margin: 0,
                  }}>
                    a 5% sobre imóvel de €{fmtEur(prediction.estimated_budget_eur)}
                  </p>

                  {/* Probability chip */}
                  <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Inquérito', v: prediction.p_inquiry },
                      { label: 'Fecho',     v: prediction.p_close },
                    ].map((item) => (
                      <div key={item.label} style={{
                        background: C.goldDim,
                        border: `1px solid ${C.goldBorder}`,
                        borderRadius: 6,
                        padding: '4px 10px',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-jost, system-ui)',
                          fontSize: 10,
                          color: C.cream28,
                          display: 'block',
                          marginBottom: 1,
                        }}>
                          {item.label}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-jost, system-ui)',
                          fontSize: 14,
                          fontWeight: 700,
                          color: barColor(item.v),
                        }}>
                          {fmtPct(item.v)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* ── Next Best Action ──────────────────────────────────────────── */}
          {!loading && topAction && (
            <div style={{
              marginTop: 24,
              background: C.card,
              border: `1px solid ${C.goldBorder}`,
              borderLeft: `4px solid ${C.gold}`,
              borderRadius: 12,
              padding: '20px 24px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 10,
                    color: C.gold,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    margin: '0 0 6px',
                    fontWeight: 700,
                  }}>
                    Próxima Melhor Acção
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{
                      fontFamily: 'var(--font-jost, system-ui)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: C.cream,
                      margin: 0,
                    }}>
                      {ACTION_LABELS[topAction.action_type]}
                    </h3>
                    <UrgencyBadge urgency={topAction.urgency} />
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 13,
                    color: C.cream55,
                    margin: '0 0 14px',
                    lineHeight: 1.5,
                  }}>
                    {topAction.reasoning}
                  </p>

                  {/* Chips */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      background: 'rgba(201,169,110,0.15)',
                      border: `1px solid ${C.goldBorder}`,
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontFamily: 'var(--font-jost, system-ui)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.gold,
                    }}>
                      → +€{fmtEur(topAction.expected_value_eur)} esperado
                    </span>
                    <span style={{
                      background: C.goldDim,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontFamily: 'var(--font-jost, system-ui)',
                      fontSize: 12,
                      color: C.cream55,
                    }}>
                      {topAction.time_to_close_delta_days} dias
                    </span>
                  </div>
                </div>

                {/* Execute button */}
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: `1.5px solid ${C.gold}`,
                    borderRadius: 9,
                    padding: '10px 22px',
                    color: C.gold,
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                >
                  Executar Acção
                </button>
              </div>
            </div>
          )}

          {/* Loading next-best placeholder */}
          {loading && (
            <div style={{ marginTop: 24 }}>
              <Shimmer height={100} />
            </div>
          )}

          {/* ── Action queue ──────────────────────────────────────────────── */}
          <div style={{ marginTop: 28 }}>
            <h2 style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 22,
              fontWeight: 600,
              color: C.cream,
              margin: '0 0 16px',
            }}>
              Fila de Acções
            </h2>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...Array(5)].map((_, i) => (
                  <Shimmer key={i} height={72} />
                ))}
              </div>
            ) : !data?.top_action ? (
              <div style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '32px 24px',
                textAlign: 'center',
              }}>
                <p style={{
                  fontFamily: 'var(--font-jost, system-ui)',
                  fontSize: 14,
                  color: C.cream55,
                  margin: 0,
                }}>
                  Sem acções disponíveis para o perfil seleccionado.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {actionCards.slice(0, 5).map((card, i) => (
                  <ActionQueueCard key={card.action_id} card={card} rank={i + 1} />
                ))}
                {actionCards.length === 0 && data?.top_action && (
                  <ActionQueueCard card={data.top_action} rank={1} />
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
