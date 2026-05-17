'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// Daily Brief — Morning intelligence layer for the field agent
// /dashboard/daily-brief

import { useEffect, useState, useCallback } from 'react'

// ─── Brand tokens ──────────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MorningAction {
  priority: number
  action: string
  why: string
  expected_impact_eur: number
  urgency: 'agora' | 'hoje' | 'esta_semana'
}

interface TopOpportunity {
  title: string
  expected_value_eur: number
  action_required: string
}

interface BriefAlert {
  type: 'warning' | 'info' | 'success'
  message: string
}

interface DailyBriefData {
  date: string
  greeting: string
  live_listings: number
  listings_needing_action: number
  hot_leads: number
  active_deals: number
  estimated_daily_opportunity_eur: number
  morning_actions: MorningAction[]
  top_opportunities: TopOpportunity[]
  alerts: BriefAlert[]
  generated_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `€${(amount / 1_000).toFixed(0)}K`
  return `€${amount.toLocaleString('pt-PT')}`
}

function briefTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '--:--'
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width, height }: { width: string | number; height: number }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 6,
      background: `linear-gradient(90deg, ${C.goldDim} 0%, rgba(201,169,110,0.18) 50%, ${C.goldDim} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'ag-pulse 1.6s ease-in-out infinite',
    }} />
  )
}

// ─── Urgency chip ─────────────────────────────────────────────────────────────

function UrgencyChip({ urgency }: { urgency: MorningAction['urgency'] }) {
  const configs: Record<MorningAction['urgency'], { label: string; bg: string; color: string }> = {
    agora: { label: 'AGORA', bg: C.errDim, color: C.err },
    hoje: { label: 'HOJE', bg: C.amberDim, color: C.amber },
    esta_semana: { label: 'ESTA SEMANA', bg: C.goldDim, color: C.gold },
  }
  const cfg = configs[urgency]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      background: cfg.bg,
      color: cfg.color,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.1em',
      fontFamily: 'var(--font-jost, system-ui)',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── Alert chip ───────────────────────────────────────────────────────────────

function AlertChip({ alert }: { alert: BriefAlert }) {
  const cfgs = {
    warning: { icon: '⚠️', bg: C.amberDim, border: 'rgba(251,191,36,0.25)', color: C.amber },
    info: { icon: 'ℹ️', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', color: '#93c5fd' },
    success: { icon: '✓', bg: C.greenDim, border: C.greenBorder, color: C.green },
  }
  const cfg = cfgs[alert.type]
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 14px',
      borderRadius: 9,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>{cfg.icon}</span>
      <span style={{
        color: cfg.color,
        fontSize: 13,
        fontFamily: 'var(--font-jost, system-ui)',
        lineHeight: 1.5,
      }}>
        {alert.message}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DailyBriefPage() {
  const [data, setData] = useState<DailyBriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchBrief = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/daily-brief')
      if (!res.ok) throw new Error('Failed')
      const json: DailyBriefData = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrief()
  }, [fetchBrief])

  // ── Global pulse keyframe ─────────────────────────────────────────────────
  const globalStyle = `
    @keyframes ag-pulse {
      0%, 100% { opacity: 0.6; background-position: 0% 0%; }
      50% { opacity: 1; background-position: 100% 0%; }
    }
    @keyframes ag-dot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }
  `

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        padding: 32,
      }}>
        <style>{globalStyle}</style>
        <span style={{ fontSize: 32 }}>☁️</span>
        <p style={{
          color: C.cream55,
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 15,
          textAlign: 'center',
          margin: 0,
        }}>
          Brief temporariamente indisponível. Tente novamente.
        </p>
        <button
          type="button"
          onClick={fetchBrief}
          style={{
            padding: '10px 24px',
            borderRadius: 9,
            background: C.goldDim,
            border: `1px solid ${C.goldBorder}`,
            color: C.gold,
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          ↻ Tentar de novo
        </button>
      </div>
    )
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 32px' }}>
        <style>{globalStyle}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
          <Skeleton width={220} height={18} />
          <Skeleton width={360} height={48} />
          <Skeleton width="100%" height={120} />
          <Skeleton width="100%" height={80} />
          <Skeleton width="100%" height={80} />
          <Skeleton width="100%" height={80} />
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      padding: '40px 32px 60px',
    }}>
      <style>{globalStyle}</style>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ── 1. Header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <p style={{
            color: C.gold,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-jost, system-ui)',
            margin: '0 0 6px',
          }}>
            {data.date}
          </p>

          <h1 style={{
            margin: '0 0 10px',
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 42,
            fontWeight: 600,
            lineHeight: 1.1,
            color: C.cream,
            letterSpacing: '-0.01em',
          }}>
            Brief <em style={{ fontStyle: 'italic', color: C.gold }}>Diário</em>
          </h1>

          <p style={{
            color: C.cream55,
            fontSize: 15,
            fontFamily: 'var(--font-jost, system-ui)',
            margin: 0,
          }}>
            {data.greeting}
          </p>
        </div>

        {/* ── 2. Revenue Opportunity Card ────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(201,169,110,0.05) 100%)`,
          border: `1px solid ${C.goldBorder}`,
          borderRadius: 14,
          padding: '28px 32px',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* decorative corner accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 120,
            height: 120,
            background: 'radial-gradient(circle at top right, rgba(201,169,110,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <p style={{
            color: C.gold,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-jost, system-ui)',
            margin: '0 0 8px',
          }}>
            Oportunidade de Receita de Hoje
          </p>

          <p style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 56,
            fontWeight: 700,
            color: C.cream,
            margin: '0 0 4px',
            lineHeight: 1,
          }}>
            {formatEur(data.estimated_daily_opportunity_eur)}
          </p>

          <p style={{
            color: C.cream55,
            fontSize: 13,
            fontFamily: 'var(--font-jost, system-ui)',
            margin: 0,
          }}>
            valor esperado de leads activos
          </p>

          {/* quick stats row */}
          <div style={{
            display: 'flex',
            gap: 28,
            marginTop: 22,
            paddingTop: 20,
            borderTop: `1px solid ${C.divider}`,
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Imóveis Live', value: data.live_listings },
              { label: 'Leads Quentes', value: data.hot_leads },
              { label: 'Negócios Activos', value: data.active_deals },
              { label: 'Acção Urgente', value: data.listings_needing_action },
            ].map(stat => (
              <div key={stat.label}>
                <p style={{
                  fontFamily: 'var(--font-cormorant, serif)',
                  fontSize: 28,
                  fontWeight: 700,
                  color: C.cream,
                  margin: '0 0 2px',
                  lineHeight: 1,
                }}>
                  {stat.value}
                </p>
                <p style={{
                  color: C.cream28,
                  fontSize: 11,
                  fontFamily: 'var(--font-jost, system-ui)',
                  margin: 0,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Morning Actions ─────────────────────────────────────────── */}
        {data.morning_actions.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <p style={{
              color: C.cream28,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jost, system-ui)',
              margin: '0 0 14px',
            }}>
              Acções desta Manhã
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.morning_actions.map(action => (
                <div
                  key={action.priority}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 20,
                  }}
                >
                  {/* Number circle */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: C.goldDim,
                    border: `1px solid ${C.goldBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-cormorant, serif)',
                      fontSize: 22,
                      fontWeight: 700,
                      color: C.gold,
                      lineHeight: 1,
                    }}>
                      {action.priority}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}>
                      <p style={{
                        color: C.cream,
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: 'var(--font-jost, system-ui)',
                        margin: 0,
                      }}>
                        {action.action}
                      </p>
                      <UrgencyChip urgency={action.urgency} />
                    </div>

                    <p style={{
                      color: C.cream55,
                      fontSize: 13,
                      fontFamily: 'var(--font-jost, system-ui)',
                      margin: '0 0 8px',
                      lineHeight: 1.5,
                    }}>
                      {action.why}
                    </p>

                    <p style={{
                      color: C.green,
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: 'var(--font-cormorant, serif)',
                      margin: 0,
                    }}>
                      +{formatEur(action.expected_impact_eur)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Hot Leads strip ────────────────────────────────────────── */}
        {data.hot_leads > 0 && (
          <div style={{
            background: C.errDim,
            border: `1px solid ${C.errBorder}`,
            borderRadius: 12,
            padding: '16px 24px',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Pulsing red dot */}
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: C.err,
                flexShrink: 0,
                animation: 'ag-dot-pulse 1.2s ease-in-out infinite',
              }} />
              <div>
                <p style={{
                  color: C.err,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-jost, system-ui)',
                  margin: '0 0 2px',
                }}>
                  Leads Quentes
                </p>
                <p style={{
                  color: C.cream55,
                  fontSize: 13,
                  fontFamily: 'var(--font-jost, system-ui)',
                  margin: 0,
                }}>
                  {data.hot_leads} lead{data.hot_leads > 1 ? 's' : ''} com alta probabilidade de fecho — acção imediata recomendada
                </p>
              </div>
            </div>

            <a
              href="/dashboard/actions"
              style={{
                display: 'inline-block',
                padding: '8px 18px',
                borderRadius: 8,
                background: C.errDim,
                border: `1px solid ${C.errBorder}`,
                color: C.err,
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              Ver Contactos →
            </a>
          </div>
        )}

        {/* ── 5. Alerts ─────────────────────────────────────────────────── */}
        {data.alerts.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <p style={{
              color: C.cream28,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jost, system-ui)',
              margin: '0 0 12px',
            }}>
              Alertas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.alerts.map((alert, i) => (
                <AlertChip key={i} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* ── 6. Top Opportunities ──────────────────────────────────────── */}
        {data.top_opportunities.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <p style={{
              color: C.cream28,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jost, system-ui)',
              margin: '0 0 14px',
            }}>
              Top Oportunidades
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {data.top_opportunities.slice(0, 3).map((opp, i) => (
                <div
                  key={i}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '18px 20px',
                  }}
                >
                  <p style={{
                    color: C.cream,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'var(--font-jost, system-ui)',
                    margin: '0 0 6px',
                    lineHeight: 1.4,
                  }}>
                    {opp.title}
                  </p>

                  <p style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: C.gold,
                    margin: '0 0 8px',
                    lineHeight: 1,
                  }}>
                    {formatEur(opp.expected_value_eur)}
                  </p>

                  <p style={{
                    color: C.cream55,
                    fontSize: 12,
                    fontFamily: 'var(--font-jost, system-ui)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}>
                    {opp.action_required}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. Footer ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 20,
          borderTop: `1px solid ${C.divider}`,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <p style={{
            color: C.cream28,
            fontSize: 11,
            fontFamily: 'var(--font-jost, system-ui)',
            margin: 0,
            letterSpacing: '0.06em',
          }}>
            SH-ROS · Brief gerado às {briefTime(data.generated_at)}
          </p>

          <button
            type="button"
            onClick={fetchBrief}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 8,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.cream55,
              fontFamily: 'var(--font-jost, system-ui)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>↻</span>
            Actualizar
          </button>
        </div>

      </div>
    </div>
  )
}
