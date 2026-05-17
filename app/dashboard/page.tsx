'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// /dashboard — Revenue Command Center
// Single surface answering: "Como faço mais dinheiro hoje?"
// Pulls from /api/revenue-command/summary — the unified economic intelligence source.
// =============================================================================

import { useState, useEffect } from 'react'
import type { RevenueImpactCard, ActionType } from '@/lib/value-attribution-engine'

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:          '#0c1f15',
  card:        '#111e16',
  border:      'rgba(201,169,110,0.15)',
  goldBorder:  'rgba(201,169,110,0.22)',
  divider:     'rgba(201,169,110,0.08)',
  gold:        '#c9a96e',
  goldDim:     'rgba(201,169,110,0.12)',
  cream:       '#f4f0e6',
  cream55:     'rgba(244,240,230,0.55)',
  cream28:     'rgba(244,240,230,0.28)',
  cream10:     'rgba(244,240,230,0.07)',
  green:       '#4ade80',
  greenDim:    'rgba(74,222,128,0.09)',
  greenBorder: 'rgba(74,222,128,0.22)',
  amber:       '#fbbf24',
  amberDim:    'rgba(251,191,36,0.1)',
  red:         '#f87171',
  redDim:      'rgba(248,113,113,0.09)',
  redBorder:   'rgba(248,113,113,0.25)',
}

// ─── Summary type ─────────────────────────────────────────────────────────────

interface RevenueSummary {
  pipeline_value_eur: number
  commission_potential_eur: number
  monthly_forecast_eur: number
  total_leakage_eur: number
  listings_with_leakage: number
  live_count: number
  avg_demand_score: number
  hot_leads_count: number
  top_actions: RevenueImpactCard[]
  funnel_health: 'strong' | 'moderate' | 'weak'
  active_deals: number
  closed_deals_total_commission: number
  computed_at: string
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2).replace('.', ',')} M`
  if (n >= 1_000)     return `€${Math.round(n / 1000)}K`
  return `€${Math.round(n).toLocaleString('pt-PT')}`
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `€${Math.round(n / 1000)}K`
  return `€${Math.round(n)}`
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  } catch { return '--:--' }
}

// ─── Action type → Portuguese label ──────────────────────────────────────────

const ACTION_LABELS: Record<ActionType, string> = {
  price_reduction:   'Reduzir Preço',
  photo_upgrade:     'Melhorar Fotografias',
  homepage_boost:    'Destaque Homepage',
  campaign_send:     'Enviar Campanha',
  inquiry_response:  'Responder a Inquérito',
  visit_booking:     'Agendar Visita',
  offer_submission:  'Submeter Proposta',
  negotiation_move:  'Negociação',
  listing_refresh:   'Renovar Listagem',
  deal_pack_send:    'Deal Pack',
  follow_up_call:    'Follow-up',
}

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY = {
  critical: { label: 'Crítico', color: C.red,   bg: C.redDim,   border: C.redBorder   },
  high:     { label: 'Alto',    color: C.amber,  bg: C.amberDim, border: 'rgba(251,191,36,0.28)' },
  medium:   { label: 'Médio',   color: C.gold,   bg: C.goldDim,  border: C.goldBorder  },
  low:      { label: 'Baixo',   color: C.green,  bg: C.greenDim, border: C.greenBorder },
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function Shimmer({ h = 20, w = '100%', r = 8 }: { h?: number; w?: string; r?: number }) {
  return (
    <div style={{
      height: h,
      width: w,
      borderRadius: r,
      background: `linear-gradient(90deg, ${C.goldDim} 0%, rgba(201,169,110,0.22) 50%, ${C.goldDim} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'ag-shimmer 1.6s ease-in-out infinite',
    }} />
  )
}

// ─── KPI Pulse Card ───────────────────────────────────────────────────────────

function PulseCard({
  icon, label, value, sub, accent = false, danger = false,
}: {
  icon: string; label: string; value: string; sub?: string; accent?: boolean; danger?: boolean
}) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${danger ? C.redBorder : accent ? C.goldBorder : C.border}`,
      borderRadius: 14,
      padding: '18px 18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {(accent || danger) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: danger
            ? 'linear-gradient(90deg, transparent, #f87171, transparent)'
            : 'linear-gradient(90deg, transparent, #c9a96e, transparent)',
        }} />
      )}
      <div style={{ fontSize: 20, marginBottom: 10 }}>{icon}</div>
      <div style={{
        fontFamily: 'var(--font-cormorant, serif)',
        fontSize: 28,
        fontWeight: 600,
        color: danger ? C.red : C.gold,
        lineHeight: 1,
        marginBottom: 6,
        letterSpacing: '-0.01em',
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 10,
        color: C.cream28,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.07em',
        fontWeight: 600,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 10,
          color: C.cream28,
          marginTop: 3,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── Action Card ─────────────────────────────────────────────────────────────

function ActionCard({ card, rank }: { card: RevenueImpactCard; rank: number }) {
  const u = URGENCY[card.urgency] ?? URGENCY.medium

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      flex: 1,
      minWidth: 0,
    }}>
      {/* Rank + urgency */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 10,
          color: C.cream28,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          Acção #{rank}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          padding: '2px 8px',
          borderRadius: 4,
          background: u.bg,
          border: `1px solid ${u.border}`,
          color: u.color,
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          {u.label}
        </span>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 15,
        fontWeight: 700,
        color: C.cream,
        margin: 0,
        lineHeight: 1.3,
      }}>
        {ACTION_LABELS[card.action_type] ?? card.action_type}
      </h3>

      {/* Revenue impact — the hero number */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
      }}>
        <span style={{
          fontFamily: 'var(--font-cormorant, serif)',
          fontSize: 30,
          fontWeight: 700,
          color: C.gold,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>
          {fmtShort(card.expected_value_eur)}
        </span>
        <span style={{
          fontFamily: 'var(--font-jost, system-ui)',
          fontSize: 11,
          color: C.cream55,
        }}>
          receita esperada
        </span>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        <span style={{
          fontSize: 11,
          color: C.cream55,
          background: C.goldDim,
          padding: '2px 7px',
          borderRadius: 4,
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          +{card.conversion_lift_pct}% conversão
        </span>
        <span style={{
          fontSize: 11,
          color: C.cream55,
          background: C.greenDim,
          padding: '2px 7px',
          borderRadius: 4,
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          {card.time_to_close_delta_days} dias
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 3, background: C.goldDim, borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.round(card.confidence * 100)}%`,
            height: '100%', background: C.gold, borderRadius: 2,
          }} />
        </div>
        <span style={{
          fontSize: 10, color: C.cream28, fontFamily: 'var(--font-jost, system-ui)',
        }}>
          {Math.round(card.confidence * 100)}% conf.
        </span>
      </div>

      {/* CTA */}
      <a href="/dashboard/actions" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '9px 0',
        borderRadius: 9,
        border: `1px solid ${C.goldBorder}`,
        background: 'transparent',
        color: C.gold,
        fontFamily: 'var(--font-jost, system-ui)',
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'none',
        letterSpacing: '0.03em',
        transition: 'background 0.15s',
      }}>
        Executar → €{Math.round(card.expected_value_eur / 1000)}K
      </a>
    </div>
  )
}

// ─── Quick-access tile ────────────────────────────────────────────────────────

function QuickTile({ icon, label, href, sub }: { icon: string; label: string; href: string; sub?: string }) {
  return (
    <a href={href} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      borderRadius: 10,
      background: C.card,
      border: `1px solid ${C.border}`,
      color: C.cream55,
      fontSize: 13,
      fontWeight: 500,
      textDecoration: 'none',
      fontFamily: 'var(--font-jost, system-ui)',
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div>{label}</div>
        {sub && <div style={{ fontSize: 10, color: C.cream28, marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ marginLeft: 'auto', color: C.gold, fontSize: 14 }}>→</span>
    </a>
  )
}

// ─── Funnel health badge ──────────────────────────────────────────────────────

function HealthBadge({ health }: { health: 'strong' | 'moderate' | 'weak' }) {
  const map = {
    strong:   { icon: '🟢', label: 'Forte',     color: C.green, bg: C.greenDim, border: C.greenBorder },
    moderate: { icon: '🟡', label: 'Moderado',  color: C.amber, bg: C.amberDim, border: 'rgba(251,191,36,0.25)' },
    weak:     { icon: '🔴', label: 'Fraco',     color: C.red,   bg: C.redDim,   border: C.redBorder },
  }
  const s = map[health]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 20,
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontFamily: 'var(--font-jost, system-ui)',
      fontSize: 13,
      fontWeight: 700,
    }}>
      {s.icon} {s.label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const [data, setData]       = useState<RevenueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [clock, setClock]     = useState('')

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  // Fetch revenue summary
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/revenue-command/summary', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() as Promise<RevenueSummary> : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const hasLeakage = (data?.total_leakage_eur ?? 0) > 0
  const hasTopActions = (data?.top_actions?.length ?? 0) > 0

  return (
    <>
      <style>{`
        @keyframes ag-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .ag-ql:hover {
          border-color: rgba(201,169,110,0.35) !important;
          color: #f4f0e6 !important;
          background: rgba(201,169,110,0.04) !important;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-jost, system-ui)' }}>

        {/* ── Sticky header ───────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: `linear-gradient(180deg, #0c1f15 0%, rgba(12,31,21,0.97) 100%)`,
          borderBottom: `1px solid ${C.divider}`,
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <p style={{
              fontFamily: 'var(--font-jost, system-ui)',
              fontSize: 10,
              color: C.cream28,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 2px',
            }}>
              Revenue Command Center
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 28,
              fontWeight: 600,
              color: C.cream,
              margin: 0,
              letterSpacing: '0.01em',
            }}>
              Como faço mais dinheiro{' '}
              <em style={{ color: C.gold }}>hoje?</em>
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {/* Live clock */}
            <div style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 24,
              fontWeight: 600,
              color: C.cream55,
              letterSpacing: '0.02em',
            }}>
              {clock}
            </div>

            {/* SH-ROS badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: C.goldDim,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 8,
              padding: '5px 12px',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: C.gold,
                animation: 'pulse 2s ease infinite',
              }} />
              <span style={{
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 10,
                color: C.gold,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                SH-ROS · AG Elite
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '28px 32px 72px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          animation: 'fadeUp 0.3s ease',
        }}>

          {/* ── Revenue Pulse — 4 KPI cards ─────────────────────────────── */}
          <section>
            <p style={{
              fontSize: 10, color: C.cream28, letterSpacing: '0.1em',
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
            }}>
              Pulso de Receita
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, height: 120,
                    animation: 'pulse 1.8s ease infinite', animationDelay: `${i * 0.1}s`,
                  }} />
                ))
              ) : (
                <>
                  <PulseCard
                    icon="🏛"
                    label="Pipeline Total"
                    value={fmtM(data?.pipeline_value_eur ?? 0)}
                    sub={`${data?.live_count ?? 0} imóveis live`}
                    accent
                  />
                  <PulseCard
                    icon="✦"
                    label="Comissão Potencial"
                    value={fmtM(data?.commission_potential_eur ?? 0)}
                    sub="A 5% · portfolio actual"
                    accent
                  />
                  <PulseCard
                    icon="◈"
                    label="Previsão Mensal"
                    value={fmtM(data?.monthly_forecast_eur ?? 0)}
                    sub="Estimativa de fecho mensal"
                  />
                  <PulseCard
                    icon="⚠"
                    label="Receita em Risco"
                    value={hasLeakage ? fmtM(data!.total_leakage_eur) : '€0'}
                    sub={hasLeakage ? `${data?.listings_with_leakage} imóveis em perda` : 'Sem perdas detectadas'}
                    danger={hasLeakage}
                  />
                </>
              )}
            </div>
          </section>

          {/* ── Top 3 Actions — "As tuas 3 acções mais importantes hoje" ─── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{
                  fontSize: 10, color: C.cream28, letterSpacing: '0.1em',
                  textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px',
                }}>
                  As Tuas 3 Acções Mais Importantes Hoje
                </p>
                <p style={{ fontSize: 12, color: C.cream55, margin: 0 }}>
                  Ordenadas por impacto em €. Cada acção tem aprovação humana antes de execução.
                </p>
              </div>
              <a href="/dashboard/actions" style={{
                fontFamily: 'var(--font-jost, system-ui)',
                fontSize: 11,
                color: C.cream28,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}>
                Ver todas →
              </a>
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} style={{
                    flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, height: 220,
                    animation: 'pulse 1.8s ease infinite', animationDelay: `${i * 0.12}s`,
                  }} />
                ))
              ) : hasTopActions ? (
                (data!.top_actions ?? []).slice(0, 3).map((card, i) => (
                  <ActionCard key={card.action_id} card={card} rank={i + 1} />
                ))
              ) : (
                <div style={{
                  flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: '32px 24px', textAlign: 'center',
                }}>
                  <p style={{ color: C.cream55, fontSize: 14, margin: 0 }}>
                    Adicione imóveis para activar as recomendações de receita.
                  </p>
                  <a href="/dashboard/properties" style={{
                    display: 'inline-block',
                    marginTop: 14,
                    padding: '9px 20px',
                    borderRadius: 9,
                    border: `1px solid ${C.goldBorder}`,
                    color: C.gold,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: 'var(--font-jost, system-ui)',
                  }}>
                    Adicionar Imóvel →
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* ── Intelligence row ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Funnel health */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 22px',
            }}>
              <p style={{
                fontSize: 10, color: C.cream28, letterSpacing: '0.1em',
                textTransform: 'uppercase', fontWeight: 600, margin: '0 0 14px',
              }}>
                Saúde do Funil de Vendas
              </p>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Shimmer h={30} w="60%" />
                  <Shimmer h={18} />
                  <Shimmer h={18} />
                </div>
              ) : (
                <>
                  <HealthBadge health={data?.funnel_health ?? 'moderate'} />
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Imóveis live',    value: String(data?.live_count ?? 0),        dim: 'listings activos' },
                      { label: 'Score de procura', value: String(data?.avg_demand_score ?? 0) + '/100', dim: 'média do portfolio' },
                      { label: 'Leads quentes',   value: String(data?.hot_leads_count ?? 0),   dim: 'score ≥ 75' },
                      { label: 'Deals activos',   value: String(data?.active_deals ?? 0),      dim: 'em negociação' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: C.cream55 }}>
                          {item.label}
                        </span>
                        <span style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 14, fontWeight: 700, color: C.cream }}>
                          {item.value}
                          <span style={{ fontSize: 10, color: C.cream28, marginLeft: 5 }}>{item.dim}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Revenue leakage */}
            <div style={{
              background: C.card,
              border: `1px solid ${hasLeakage && !loading ? C.redBorder : C.border}`,
              borderRadius: 14,
              padding: '22px 22px',
            }}>
              <p style={{
                fontSize: 10, color: C.cream28, letterSpacing: '0.1em',
                textTransform: 'uppercase', fontWeight: 600, margin: '0 0 14px',
              }}>
                Receita em Risco
              </p>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Shimmer h={44} w="70%" />
                  <Shimmer h={16} />
                  <Shimmer h={16} />
                </div>
              ) : hasLeakage ? (
                <>
                  <div style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    fontSize: 38,
                    fontWeight: 700,
                    color: C.red,
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                    marginBottom: 8,
                  }}>
                    {fmtM(data!.total_leakage_eur)}
                    <span style={{ fontSize: 14, color: C.cream28, marginLeft: 8 }}>/mês</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 12, color: C.cream55, margin: '0 0 16px' }}>
                    {data!.listings_with_leakage} imóvel(eis) com receita em perda detectada — acção recomendada imediata.
                  </p>
                  <a href="/dashboard/executive" style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: C.redDim,
                    border: `1px solid ${C.redBorder}`,
                    color: C.red,
                    fontFamily: 'var(--font-jost, system-ui)',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}>
                    Ver Análise Completa →
                  </a>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24 }}>✓</span>
                  <p style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 13, color: C.green, margin: 0, fontWeight: 600 }}>
                    Sem perdas detectadas
                  </p>
                  <p style={{ fontFamily: 'var(--font-jost, system-ui)', fontSize: 11, color: C.cream55, margin: 0 }}>
                    Todos os imóveis dentro das bandas de preço óptimas.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Quick Access Grid ────────────────────────────────────────── */}
          <section>
            <p style={{
              fontSize: 10, color: C.cream28, letterSpacing: '0.1em',
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
            }}>
              Acesso Rápido
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <QuickTile icon="☀️" label="Brief Diário"       href="/dashboard/daily-brief"        sub="Começa aqui" />
              <QuickTile icon="⚡" label="Acções Prioritárias" href="/dashboard/actions"            sub="Fila de execução" />
              <QuickTile icon="🏠" label="Property AI Engine"  href="/dashboard/properties"        sub="Imóveis + análise IA" />
              <QuickTile icon="🎯" label="Centro de Conversão" href="/dashboard/conversion-command" sub="Funil + probabilidades" />
              <QuickTile icon="📊" label="Executive Revenue"   href="/dashboard/executive"          sub="P&L + leakage" />
              <QuickTile icon="🚀" label="Activação de Agente" href="/dashboard/onboarding"         sub="< 15 min setup" />
            </div>
          </section>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <p style={{
            fontFamily: 'var(--font-jost, system-ui)',
            fontSize: 10,
            color: C.cream28,
            letterSpacing: '0.06em',
            textAlign: 'center',
            marginTop: 4,
          }}>
            Agency Group · AMI 22506 · SH-ROS recalibra diariamente
            {data?.computed_at ? ` · Dados de ${fmtTime(data.computed_at)}` : ''}
          </p>
        </div>
      </div>
    </>
  )
}
