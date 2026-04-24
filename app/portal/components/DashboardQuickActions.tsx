'use client'
import { useRef } from 'react'
import type { DashboardTheme, SectionId } from './types'
import Tooltip from './Tooltip'
import { useStaggerIn } from '../hooks/useGSAPAnimations'

// ─── Quick actions config ─────────────────────────────────────────────────────
const QUICK_ACTIONS: {
  label: string
  sub: string
  sec: SectionId
  color: string
  svg: string
  badge?: string
  badgeRed?: boolean
}[] = [
  {
    label: 'CRM Clientes',
    sub: 'Gestão relacional · Leads & VIPs',
    sec: 'crm',
    color: '#c9a96e',
    svg: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    label: 'AVM Avaliação',
    sub: '6 metodologias RICS · Relatório PDF',
    sec: 'avm',
    color: '#1c4a35',
    svg: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    label: 'Deal Radar',
    sub: 'IA · Leilões + Banca + Mercado livre',
    sec: 'radar',
    color: '#c9a96e',
    svg: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    badge: '3 novos',
    badgeRed: false,
  },
  {
    label: 'Pipeline CPCV',
    sub: 'Deals activos · Em negociação',
    sec: 'pipeline',
    color: '#1c4a35',
    svg: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    label: 'Marketing AI',
    sub: 'Multi-formato · 6 idiomas',
    sec: 'marketing',
    color: '#c9a96e',
    svg: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  {
    label: 'Consultor Jurídico',
    sub: 'CPCV · NHR · Golden Visa · IMT',
    sec: 'juridico',
    color: '#1c4a35',
    svg: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    label: 'Investor Pitch',
    sub: 'Deal memos · Investor matching',
    sec: 'investorpitch',
    color: '#c9a96e',
    svg: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  },
  {
    label: 'Market Pulse',
    sub: 'Market intelligence · 2026',
    sec: 'pulse',
    color: '#1c4a35',
    svg: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    label: 'Campanhas',
    sub: 'Email · WhatsApp · Drip',
    sec: 'campanhas',
    color: '#c9a96e',
    svg: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
]

interface Props {
  theme: DashboardTheme
  followUpsHoje: number
  onSetSection: (s: SectionId) => void
}

export default function DashboardQuickActions({
  theme,
  followUpsHoje,
  onSetSection,
}: Props) {
  const { darkMode, cardBg, cardText, mutedText, borderCol } = theme

  const actionsGridRef = useRef<HTMLDivElement>(null)
  useStaggerIn(actionsGridRef, '[data-stagger]', { delay: 0.3 })

  return (
    <div style={{ marginBottom: '28px' }}>
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: '.52rem',
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: mutedText,
          marginBottom: '14px',
        }}
      >
        Ferramentas &amp; Módulos
      </div>
      <div
        ref={actionsGridRef}
        className="qa-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: '14px',
        }}
      >
        {QUICK_ACTIONS.map(a => {
          const needsAction = a.sec === 'crm' && followUpsHoje > 0
          return (
            <Tooltip key={a.label} content={a.sub} darkMode={darkMode} position="top">
            <div
              data-stagger=""
              className="qa-card"
              role="button"
              tabIndex={0}
              style={{
                background: cardBg,
                border: `1px solid ${needsAction ? 'rgba(220,38,38,.25)' : borderCol}`,
                padding: '16px 18px',
                cursor: 'pointer',
                transition: 'background .15s',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                position: 'relative',
                borderRadius: '12px',
              }}
              onClick={() => onSetSection(a.sec)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSetSection(a.sec) } }}
            >
              {/* Priority indicator */}
              {!!needsAction && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#dc2626',
                  }}
                />
              )}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  background: darkMode ? `${a.color}28` : `${a.color}14`,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={a.color}
                  strokeWidth="1.5"
                  width="20"
                  height="20"
                >
                  <path d={a.svg} />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <div
                    style={{
                      fontFamily: "'Jost',sans-serif",
                      fontSize: '.88rem',
                      fontWeight: 600,
                      color: cardText,
                    }}
                  >
                    {a.label}
                  </div>
                  {/* Badge count */}
                  {!!a.badge && (
                    <span
                      style={{
                        padding: '1px 6px',
                        background: a.badgeRed ? 'rgba(220,38,38,.1)' : darkMode ? 'rgba(28,74,53,.35)' : 'rgba(28,74,53,.08)',
                        color: a.badgeRed ? '#dc2626' : darkMode ? '#6fcf97' : '#1c4a35',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.54rem',
                        letterSpacing: '.06em',
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    >
                      {a.badge}
                    </span>
                  )}
                  {/* CRM follow-up count */}
                  {a.sec === 'crm' && followUpsHoje > 0 && (
                    <span
                      style={{
                        padding: '1px 6px',
                        background: 'rgba(220,38,38,.1)',
                        color: '#dc2626',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.54rem',
                        letterSpacing: '.06em',
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    >
                      {followUpsHoje} urgente{followUpsHoje > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    color: mutedText,
                    letterSpacing: '.04em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}
                >
                  {a.sub}
                </div>
              </div>
              <div
                className="qa-arrow"
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.7rem',
                  color: a.color,
                  opacity: 0,
                  transform: 'translateX(-4px)',
                  transition: 'opacity .15s ease, transform .15s ease',
                  flexShrink: 0,
                }}
              >
                →
              </div>
            </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
