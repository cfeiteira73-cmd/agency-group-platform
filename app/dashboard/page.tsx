'use client'

// AGENCY GROUP — SH-ROS | Dashboard Home · Revenue Intelligence
// AMI 22506 · AG Elite Activo · Client component

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Intelligence {
  demand_score: number
  homepage_placement_score: number
  listing_readiness_score: number
  investor_attractiveness: number
}

interface Submission {
  submission_id: string
  status: string
  intelligence?: Intelligence | null
}

interface SubmissionsResponse {
  submissions: Submission[]
  total: number
}

interface AgentAction {
  id: string
  title?: string
  description?: string
  priority?: string
  urgency?: string
}

interface ActionsResponse {
  actions?: AgentAction[]
}

// ─── AG brand tokens ─────────────────────────────────────────────────────────

const C = {
  bg:         '#0c1f15',
  card:       '#111e16',
  cardAlt:    '#0f1c12',
  border:     'rgba(201,169,110,0.15)',
  borderHov:  'rgba(201,169,110,0.35)',
  divider:    'rgba(201,169,110,0.08)',
  gold:       '#c9a96e',
  goldDim:    'rgba(201,169,110,0.12)',
  goldBorder: 'rgba(201,169,110,0.22)',
  cream:      '#f4f0e6',
  cream55:    'rgba(244,240,230,0.55)',
  cream28:    'rgba(244,240,230,0.28)',
  cream10:    'rgba(244,240,230,0.08)',
  green:      '#4ade80',
  greenDim:   'rgba(74,222,128,0.1)',
  greenBorder:'rgba(74,222,128,0.25)',
}

// ─── Static fallback actions ──────────────────────────────────────────────────

const FALLBACK_ACTIONS = [
  {
    id: 'fa-1',
    title: '2 imóveis precisam de fotos melhores',
    urgency: 'HOJE',
  },
  {
    id: 'fa-2',
    title: '1 lead quente sem follow-up há 48h',
    urgency: 'HOJE',
  },
  {
    id: 'fa-3',
    title: '1 imóvel com preço acima do mercado',
    urgency: 'ESTA SEMANA',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: string
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${accent ? C.goldBorder : C.border}`,
      borderRadius: 16,
      padding: '22px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'border-color 0.2s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {accent && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, #c9a96e, transparent)',
        }} />
      )}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: C.goldDim,
        border: `1px solid ${C.goldBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{
          color: C.gold,
          fontWeight: 700,
          fontSize: 28,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--font-cormorant, serif)',
          margin: 0,
        }}>
          {value}
        </p>
        <p style={{
          color: C.cream28,
          fontSize: 11,
          marginTop: 5,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          {label}
        </p>
        {sub && (
          <p style={{
            color: C.cream28,
            fontSize: 10,
            marginTop: 4,
            letterSpacing: '0.03em',
            fontFamily: 'var(--font-jost, system-ui)',
          }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

function ActionCard({ title, urgency }: { title: string; urgency?: string }) {
  const isToday = urgency === 'HOJE'
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${C.gold}`,
      borderRadius: '0 12px 12px 0',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <p style={{
        color: C.cream,
        fontSize: 13,
        fontWeight: 400,
        margin: 0,
        fontFamily: 'var(--font-jost, system-ui)',
        lineHeight: 1.4,
      }}>
        {title}
      </p>
      {urgency && (
        <span style={{
          flexShrink: 0,
          padding: '3px 8px',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-jost, system-ui)',
          background: isToday ? 'rgba(201,169,110,0.15)' : 'rgba(244,240,230,0.06)',
          color: isToday ? C.gold : C.cream28,
          border: `1px solid ${isToday ? C.goldBorder : 'rgba(244,240,230,0.1)'}`,
        }}>
          {urgency}
        </span>
      )}
    </div>
  )
}

// ─── Format currency ──────────────────────────────────────────────────────────

function formatEur(value: number): string {
  if (value >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(2).replace('.', ',')} M`
  }
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const [submissions, setSubmissions]         = useState<Submission[]>([])
  const [actions, setActions]                 = useState<{ id: string; title: string; urgency?: string }[]>([])
  const [loadingSubmissions, setLoadingSubs]  = useState(true)
  const [loadingActions, setLoadingActions]   = useState(true)

  // Fetch submissions for KPI computation
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/property-ai/submissions?org_id=agency-group&limit=100', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() as Promise<SubmissionsResponse> : Promise.reject())
      .then(data => setSubmissions(data.submissions ?? []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingSubs(false))
    return () => ctrl.abort()
  }, [])

  // Fetch action queue
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/agent/actions?limit=3', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() as Promise<ActionsResponse> : Promise.reject())
      .then(data => {
        const list = data.actions ?? []
        if (list.length > 0) {
          setActions(list.slice(0, 3).map(a => ({
            id: a.id,
            title: a.title ?? a.description ?? 'Acção pendente',
            urgency: a.urgency ?? a.priority ?? 'ESTA SEMANA',
          })))
        } else {
          setActions(FALLBACK_ACTIONS)
        }
      })
      .catch(() => setActions(FALLBACK_ACTIONS))
      .finally(() => setLoadingActions(false))
    return () => ctrl.abort()
  }, [])

  // ── KPI computations ────────────────────────────────────────────────────────
  const liveCount = submissions.filter(s => s.status === 'live').length

  const pipelineCount = submissions.filter(s =>
    ['ingesting', 'analyzing', 'enriching', 'generating'].includes(s.status)
  ).length

  const liveWithScore = submissions.filter(
    s => s.status === 'live' && typeof s.intelligence?.demand_score === 'number'
  )
  const avgDemand = liveWithScore.length > 0
    ? Math.round(liveWithScore.reduce((acc, s) => acc + (s.intelligence?.demand_score ?? 0), 0) / liveWithScore.length)
    : 0

  const homepageReady = submissions.filter(
    s => (s.intelligence?.homepage_placement_score ?? 0) >= 70
  ).length

  // Estimated commission: live count × avg price €1.2M × 5%
  const commissionEstimate = liveCount * 1_200_000 * 0.05

  const isLoading = loadingSubmissions

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: 'var(--font-jost, system-ui)',
      color: C.cream,
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ag-dash-link:hover { color: #c9a96e !important; }
        .ag-ql-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 18px;
          border-radius: 10px;
          background: #111e16;
          border: 1px solid rgba(201,169,110,0.15);
          color: rgba(244,240,230,0.55);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          font-family: var(--font-jost, system-ui);
          transition: all 0.15s;
        }
        .ag-ql-link:hover {
          border-color: rgba(201,169,110,0.35);
          color: #f4f0e6;
          background: rgba(201,169,110,0.05);
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, #0c1f15 0%, rgba(12,31,21,0.95) 100%)`,
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 32px' }}>
          {/* Breadcrumb */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingTop: 12,
            paddingBottom: 4,
          }}>
            <span style={{
              color: C.gold,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              Dashboard
            </span>
          </div>

          {/* Title row */}
          <div style={{ paddingBottom: 22 }}>
            <h1 style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 38,
              fontWeight: 300,
              letterSpacing: '0.02em',
              color: C.cream,
              lineHeight: 1.1,
              margin: 0,
            }}>
              Revenue{' '}
              <span style={{ color: C.gold, fontStyle: 'italic' }}>Intelligence</span>
            </h1>
            <p style={{
              color: C.cream28,
              fontSize: 12,
              marginTop: 7,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jost, system-ui)',
            }}>
              Sistema Autónomo de Receita · AG Elite Activo
            </p>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1060,
        margin: '0 auto',
        padding: '32px 32px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        animation: 'fadeUp 0.35s ease',
      }}>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <section>
          <p style={{
            fontSize: 10,
            color: C.cream28,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 14,
          }}>
            Visão Geral do Portfolio
          </p>
          {isLoading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  height: 130,
                  animation: 'pulse 1.8s ease infinite',
                  animationDelay: `${i * 0.12}s`,
                }} />
              ))}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}>
              <KpiCard
                icon="🏛"
                label="Imóveis Live"
                value={liveCount}
                sub="Listings activos"
                accent
              />
              <KpiCard
                icon="⟳"
                label="Pipeline de Análise"
                value={pipelineCount}
                sub="Em processamento IA"
              />
              <KpiCard
                icon="◈"
                label="Score Médio Demand"
                value={liveWithScore.length > 0 ? `${avgDemand}` : '—'}
                sub="Imóveis live com score"
              />
              <KpiCard
                icon="✦"
                label="Prontos p/ Homepage"
                value={homepageReady}
                sub="Score placement ≥ 70"
              />
            </div>
          )}
        </section>

        {/* ── Two-column: Actions + Revenue ────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Action Queue */}
          <section>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <p style={{
                fontSize: 10,
                color: C.cream28,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600,
                margin: 0,
              }}>
                Acções Prioritárias
              </p>
              <a href="/dashboard/actions" className="ag-dash-link" style={{
                color: C.cream28,
                fontSize: 11,
                textDecoration: 'none',
                letterSpacing: '0.04em',
                transition: 'color 0.15s',
              }}>
                Ver todas →
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingActions ? (
                [0, 1, 2].map(i => (
                  <div key={i} style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${C.goldBorder}`,
                    borderRadius: '0 12px 12px 0',
                    height: 50,
                    animation: 'pulse 1.8s ease infinite',
                    animationDelay: `${i * 0.1}s`,
                  }} />
                ))
              ) : (
                actions.map(a => (
                  <ActionCard key={a.id} title={a.title} urgency={a.urgency} />
                ))
              )}
            </div>
          </section>

          {/* Revenue Summary */}
          <section>
            <p style={{
              fontSize: 10,
              color: C.cream28,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 14,
            }}>
              Receita Estimada
            </p>

            <div style={{
              background: C.card,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 16,
              padding: '24px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Decorative top bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: 'linear-gradient(90deg, transparent 0%, #c9a96e 40%, #c9a96e 60%, transparent 100%)',
              }} />

              <p style={{
                color: C.cream28,
                fontSize: 11,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                margin: '0 0 10px',
                fontFamily: 'var(--font-jost, system-ui)',
              }}>
                Comissão Potencial Estimada
              </p>

              {isLoading ? (
                <div style={{
                  height: 52,
                  width: '70%',
                  borderRadius: 8,
                  background: C.goldDim,
                  animation: 'pulse 1.8s ease infinite',
                }} />
              ) : (
                <p style={{
                  color: C.gold,
                  fontFamily: 'var(--font-cormorant, serif)',
                  fontSize: 42,
                  fontWeight: 600,
                  lineHeight: 1,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  {formatEur(commissionEstimate)}
                </p>
              )}

              <p style={{
                color: C.cream28,
                fontSize: 11,
                marginTop: 12,
                fontFamily: 'var(--font-jost, system-ui)',
                lineHeight: 1.5,
              }}>
                Baseado em {liveCount} imóve{liveCount !== 1 ? 'is' : 'l'} live
                · preço médio €1,2M · comissão 5%
              </p>

              <div style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: `1px solid ${C.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.gold,
                  animation: 'pulse 2s ease infinite',
                }} />
                <span style={{
                  color: C.cream28,
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-jost, system-ui)',
                }}>
                  Estimativa indicativa · sujeita a negociação
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ── Quick Links ──────────────────────────────────────────────────── */}
        <section>
          <p style={{
            fontSize: 10,
            color: C.cream28,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 14,
          }}>
            Acesso Rápido
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <a href="/dashboard/properties" className="ag-ql-link">
              <span>🏠 Ver todos os imóveis</span>
              <span style={{ fontSize: 14, color: C.gold }}>→</span>
            </a>
            <a href="/dashboard/actions" className="ag-ql-link">
              <span>⚡ Acções Prioritárias</span>
              <span style={{ fontSize: 14, color: C.gold }}>→</span>
            </a>
            <a href="/dashboard/executive" className="ag-ql-link">
              <span>📊 Executive Revenue</span>
              <span style={{ fontSize: 14, color: C.gold }}>→</span>
            </a>
          </div>
        </section>

        {/* ── Footer note ──────────────────────────────────────────────────── */}
        <p style={{
          color: C.cream28,
          fontSize: 10,
          letterSpacing: '0.06em',
          textAlign: 'center',
          marginTop: 8,
          fontFamily: 'var(--font-jost, system-ui)',
        }}>
          Agency Group · AMI 22506 · Comissão 5% · CPCV 50% + Escritura 50%
        </p>

      </div>
    </div>
  )
}
