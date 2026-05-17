'use client'

// AGENCY GROUP — SH-ROS | AMI: 22506
// Dashboard: Acções Prioritárias — AG Elite Action Queue
// =============================================================================

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType =
  | 'follow_up'
  | 'photo_improvement'
  | 'price_adjustment'
  | 'listing_boost'
  | 'inquiry_response'
  | 'deal_risk'
  | 'opportunity'

type Urgency = 'hoje' | 'esta_semana' | 'este_mes'

interface ActionItem {
  id: string
  type: ActionType
  title: string
  description: string
  urgency: Urgency
  impact_eur: number
  property_id?: string
  contact_id?: string
  cta_label: string
  cta_href: string
}

interface ActionsResponse {
  actions: ActionItem[]
  total_impact_eur: number
  generated_at: string
}

// ─── AG brand tokens ──────────────────────────────────────────────────────────

const C = {
  bg:          '#0c1f15',
  card:        '#111e16',
  cardHover:   '#162a1c',
  border:      'rgba(201,169,110,0.15)',
  borderHov:   'rgba(201,169,110,0.32)',
  divider:     'rgba(201,169,110,0.08)',
  gold:        '#c9a96e',
  goldBorder:  'rgba(201,169,110,0.22)',
  goldDim:     'rgba(201,169,110,0.10)',
  cream:       '#f4f0e6',
  cream55:     'rgba(244,240,230,0.55)',
  cream28:     'rgba(244,240,230,0.28)',
  cream10:     'rgba(244,240,230,0.08)',
  green:       '#4ade80',
  greenDim:    'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.25)',
  amber:       '#f59e0b',
  red:         '#f87171',
  redDim:      'rgba(248,113,113,0.12)',
  redBorder:   'rgba(248,113,113,0.30)',
}

// ─── Action metadata ──────────────────────────────────────────────────────────

const ACTION_ICON: Record<ActionType, string> = {
  follow_up:        '📞',
  photo_improvement:'📸',
  price_adjustment: '💰',
  listing_boost:    '🚀',
  inquiry_response: '💬',
  deal_risk:        '⚠️',
  opportunity:      '✨',
}

const URGENCY_META: Record<Urgency, { label: string; color: string; bg: string; border: string; borderLeft: string }> = {
  hoje:        { label: 'HOJE',        color: C.red,   bg: C.redDim,   border: C.redBorder,   borderLeft: C.red   },
  esta_semana: { label: 'ESTA SEMANA', color: C.gold,  bg: C.goldDim,  border: C.goldBorder,  borderLeft: C.gold  },
  este_mes:    { label: 'ESTE MÊS',    color: C.green, bg: C.greenDim, border: C.greenBorder, borderLeft: C.green },
}

// ─── Urgency Badge ────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const m = URGENCY_META[urgency]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 99,
      background: m.bg,
      border: `1px solid ${m.border}`,
      color: m.color,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.07em',
      fontFamily: 'var(--font-jost, system-ui)',
      whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${C.goldBorder}`,
      borderRadius: 16,
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <style>{`
        @keyframes ag-shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        .ag-shimmer {
          background: linear-gradient(90deg, rgba(201,169,110,0.05) 25%, rgba(201,169,110,0.12) 50%, rgba(201,169,110,0.05) 75%);
          background-size: 800px 100%;
          animation: ag-shimmer 1.6s ease-in-out infinite;
          border-radius: 6px;
        }
      `}</style>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="ag-shimmer" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="ag-shimmer" style={{ height: 16, width: '60%' }} />
          <div className="ag-shimmer" style={{ height: 12, width: '85%' }} />
        </div>
        <div className="ag-shimmer" style={{ width: 90, height: 24, borderRadius: 99 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="ag-shimmer" style={{ height: 13, width: '40%' }} />
        <div className="ag-shimmer" style={{ height: 34, width: 130, borderRadius: 8 }} />
      </div>
    </div>
  )
}

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionCard({ item }: { item: ActionItem }) {
  const [hovered, setHovered] = useState(false)
  const urgencyMeta = URGENCY_META[item.urgency]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.cardHover : C.card,
        border: `1px solid ${hovered ? C.borderHov : C.border}`,
        borderLeft: `3px solid ${urgencyMeta.borderLeft}`,
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'background 0.2s ease, border-color 0.2s ease',
        cursor: 'default',
      }}
    >
      {/* Top row: icon + title + urgency badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: C.goldDim,
          border: `1px solid ${C.goldBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}>
          {ACTION_ICON[item.type]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            color: C.cream,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-jost, system-ui)',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {item.title}
          </p>
          <p style={{
            margin: '4px 0 0',
            color: C.cream55,
            fontSize: 13,
            fontFamily: 'var(--font-jost, system-ui)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {item.description}
          </p>
        </div>

        <div style={{ flexShrink: 0 }}>
          <UrgencyBadge urgency={item.urgency} />
        </div>
      </div>

      {/* Bottom row: impact + CTA */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{
          color: C.gold,
          fontSize: 13,
          fontFamily: 'var(--font-jost, system-ui)',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          {item.impact_eur > 0
            ? `€ ${item.impact_eur.toLocaleString('pt-PT')} impacto estimado`
            : 'Impacto a calcular'}
        </span>

        <Link
          href={item.cta_href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 18px',
            borderRadius: 8,
            border: `1px solid ${C.goldBorder}`,
            background: hovered ? C.goldDim : 'transparent',
            color: C.gold,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-jost, system-ui)',
            letterSpacing: '0.04em',
            textDecoration: 'none',
            transition: 'background 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {item.cta_label}
          <span style={{ fontSize: 10, opacity: 0.7 }}>→</span>
        </Link>
      </div>
    </div>
  )
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({
  label,
  active,
  count,
  color,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        borderRadius: 99,
        border: `1px solid ${active ? color : C.border}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : C.cream55,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-jost, system-ui)',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          borderRadius: 99,
          background: active ? `${color}30` : C.cream10,
          color: active ? color : C.cream28,
          fontSize: 10,
          fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const [data, setData] = useState<ActionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Urgency | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/agent/actions')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ActionsResponse>
      })
      .then(json => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar acções')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  const allActions = data?.actions ?? []

  const countByUrgency = (u: Urgency) => allActions.filter(a => a.urgency === u).length
  const hojeCount = countByUrgency('hoje')
  const semanaCount = countByUrgency('esta_semana')
  const mesCount = countByUrgency('este_mes')

  const filtered = activeTab === 'all'
    ? allActions
    : allActions.filter(a => a.urgency === activeTab)

  const totalImpact = data?.total_impact_eur ?? 0

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      padding: '32px 24px 64px',
      fontFamily: 'var(--font-jost, system-ui)',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap');
        @keyframes ag-shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        .ag-shimmer {
          background: linear-gradient(90deg, rgba(201,169,110,0.05) 25%, rgba(201,169,110,0.12) 50%, rgba(201,169,110,0.05) 75%);
          background-size: 800px 100%;
          animation: ag-shimmer 1.6s ease-in-out infinite;
          border-radius: 6px;
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 28,
          fontSize: 12,
          color: C.cream28,
          letterSpacing: '0.04em',
          fontWeight: 500,
        }}>
          <Link href="/dashboard" style={{ color: C.cream28, textDecoration: 'none' }}>Portal</Link>
          <span style={{ color: C.goldBorder }}>›</span>
          <span style={{ color: C.gold }}>Acções Prioritárias</span>
        </nav>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 10,
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 38,
              fontWeight: 400,
              color: C.cream,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              Acções{' '}
              <em style={{
                fontStyle: 'italic',
                fontWeight: 600,
                color: C.gold,
              }}>
                Prioritárias
              </em>
            </h1>
            <p style={{
              margin: '6px 0 0',
              color: C.cream55,
              fontSize: 13,
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}>
              Sistema de Inteligência · AG Elite Activo
            </p>
          </div>

          {/* Action count pill */}
          {!loading && data && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 99,
              background: C.goldDim,
              border: `1px solid ${C.goldBorder}`,
              color: C.gold,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: C.gold,
                animation: hojeCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
                display: 'inline-block',
              }} />
              {allActions.length} ACÇÕES
              {hojeCount > 0 && (
                <>
                  <span style={{ color: C.goldBorder }}>·</span>
                  <span style={{ color: C.red }}>{hojeCount} HOJE</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Urgency Tabs ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 24,
          marginBottom: 28,
          borderBottom: `1px solid ${C.divider}`,
          paddingBottom: 16,
        }}>
          <TabBtn
            label="TODAS"
            active={activeTab === 'all'}
            count={allActions.length}
            color={C.gold}
            onClick={() => setActiveTab('all')}
          />
          <TabBtn
            label="HOJE"
            active={activeTab === 'hoje'}
            count={hojeCount}
            color={C.red}
            onClick={() => setActiveTab('hoje')}
          />
          <TabBtn
            label="ESTA SEMANA"
            active={activeTab === 'esta_semana'}
            count={semanaCount}
            color={C.gold}
            onClick={() => setActiveTab('esta_semana')}
          />
          <TabBtn
            label="ESTE MÊS"
            active={activeTab === 'este_mes'}
            count={mesCount}
            color={C.green}
            onClick={() => setActiveTab('este_mes')}
          />
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background: C.redDim,
            border: `1px solid ${C.redBorder}`,
            borderRadius: 12,
            padding: '20px 24px',
            color: C.red,
            fontSize: 14,
            fontFamily: 'var(--font-jost, system-ui)',
          }}>
            Erro ao carregar acções: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '64px 24px',
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <p style={{
              margin: 0,
              color: C.cream55,
              fontSize: 15,
              fontFamily: 'var(--font-jost, system-ui)',
              lineHeight: 1.5,
            }}>
              Tudo em ordem — sem acções prioritárias neste momento.
            </p>
          </div>
        )}

        {/* Action cards */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => (
              <ActionCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* ── Total impact footer ─────────────────────────────────────────────── */}
        {!loading && !error && totalImpact > 0 && (
          <div style={{
            marginTop: 48,
            padding: '28px 32px',
            background: C.card,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 20,
            textAlign: 'center',
          }}>
            <p style={{
              margin: '0 0 6px',
              color: C.cream55,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-jost, system-ui)',
            }}>
              Total de receita potencial identificada
            </p>
            <p style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 42,
              fontWeight: 600,
              color: C.gold,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              € {totalImpact.toLocaleString('pt-PT')}
            </p>
            <p style={{
              margin: '8px 0 0',
              color: C.cream28,
              fontSize: 12,
              fontFamily: 'var(--font-jost, system-ui)',
              letterSpacing: '0.03em',
            }}>
              Com base nas {allActions.length} acções detectadas · Actualizado {data?.generated_at
                ? new Date(data.generated_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                : '–'}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
