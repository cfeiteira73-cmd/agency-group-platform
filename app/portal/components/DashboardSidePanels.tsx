'use client'
import type { DashboardTheme, CRMContact, Deal, SectionId } from './types'
import { STAGE_PCT, STAGE_COLOR } from './constants'
import { parsePTValue as parseValorLocal } from '../utils/format'
import { getDeltaBadge } from '../lib/intelligence/deltaHelpers'
import type { ScoreDelta } from '../lib/intelligence/scoringMemory'

// ─── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  if (!dateStr) return '—'
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `há ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

// ─── Status badge colour ──────────────────────────────────────────────────────
function statusColor(status: string): string {
  const map: Record<string, string> = {
    vip: '#c9a96e',
    cliente: '#1c4a35',
    prospect: '#3a7bd5',
    lead: '#888',
  }
  return map[status] ?? '#888'
}

interface DealPrediction {
  prediction: { closureProbability: number }
}

interface Props {
  theme: DashboardTheme
  recentContacts: CRMContact[]
  today: string
  topDeals: Deal[]
  onSetSection: (s: SectionId) => void
  onSetPriceHistoryId?: (id: string) => void
  dealPredictionsMap: Map<string, DealPrediction>
  dealDeltaMap: Map<number, ScoreDelta>
}

export default function DashboardSidePanels({
  theme,
  recentContacts,
  today,
  topDeals,
  onSetSection,
  onSetPriceHistoryId,
  dealPredictionsMap,
  dealDeltaMap,
}: Props) {
  const { darkMode, cardBg, cardText, mutedText, borderCol } = theme

  return (
    <div
      className="side-panels"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '28px',
      }}
    >
      {/* Painel Esquerdo — Actividade Recente CRM */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${borderCol}`,
          padding: '22px 24px',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant',serif",
              fontSize: '1.1rem',
              fontWeight: 400,
              color: cardText,
            }}
          >
            Actividade Recente CRM
          </div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              color: darkMode ? '#6fcf97' : '#1c4a35',
              cursor: 'pointer',
              letterSpacing: '.08em',
              transition: 'opacity .15s ease',
            }}
            onClick={() => onSetSection('crm')}
          >
            Ver CRM →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {recentContacts.length === 0 && (
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: mutedText,
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              📋 Sem contactos no CRM
            </div>
          )}
          {recentContacts.map(c => {
            const initials = c.name
              .split(' ')
              .slice(0, 2)
              .map(n => n[0])
              .join('')
              .toUpperCase()
            const sColor = statusColor(c.status)
            const timeAgo = relativeTime(c.lastContact || c.createdAt || '')
            const needsFollowUp = c.nextFollowUp && c.nextFollowUp <= today
            return (
              <div
                key={c.id}
                className="recent-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 8px',
                  transition: 'background .15s',
                  borderBottom: `1px solid ${borderCol}`,
                  position: 'relative',
                }}
                onClick={() => onSetSection('crm')}
              >
                {/* Priority dot */}
                {!!needsFollowUp && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
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
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: `${sColor}22`,
                    border: `1.5px solid ${sColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.62rem',
                    color: sColor,
                    flexShrink: 0,
                    letterSpacing: '.04em',
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '.84rem',
                        fontWeight: 500,
                        color: cardText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      style={{
                        padding: '1px 6px',
                        background: `${sColor}18`,
                        color: sColor,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.52rem',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                        borderRadius: '3px',
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      color: mutedText,
                      letterSpacing: '.04em',
                    }}
                  >
                    {c.nationality || '—'} · €{((c.budgetMax ?? 0) / 1000).toFixed(0)}K max · {timeAgo}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Painel Direito — Deals em Destaque */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${borderCol}`,
          padding: '22px 24px',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant',serif",
              fontSize: '1.1rem',
              fontWeight: 400,
              color: cardText,
            }}
          >
            Deals em Destaque
          </div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              color: darkMode ? '#6fcf97' : '#1c4a35',
              cursor: 'pointer',
              letterSpacing: '.08em',
              transition: 'opacity .15s ease',
            }}
            onClick={() => onSetSection('pipeline')}
          >
            Ver pipeline →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {topDeals.length === 0 && (
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: mutedText,
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              🏠 Sem deals activos
            </div>
          )}
          {topDeals.map(d => {
            const val = parseValorLocal(d.valor)
            const pct = STAGE_PCT[d.fase] ?? 0
            const color = STAGE_COLOR[d.fase] ?? '#888'
            const pred  = dealPredictionsMap.get(d.ref ?? '')
            const delta = dealDeltaMap.get(d.id) ?? null
            const badge = getDeltaBadge(delta)
            return (
              <div
                key={d.id}
                className="top-deal"
                style={{
                  padding: '12px 8px',
                  borderBottom: `1px solid ${borderCol}`,
                  transition: 'background .15s',
                }}
                onClick={() => {
                  onSetSection('pipeline')
                  if (onSetPriceHistoryId && d.imovel) onSetPriceHistoryId(d.imovel)
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '4px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.52rem',
                          color: mutedText,
                          letterSpacing: '.08em',
                        }}
                      >
                        {d.ref}
                      </span>
                      <span
                        style={{
                          padding: '1px 7px',
                          background: `${color}1a`,
                          color,
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.52rem',
                          letterSpacing: '.06em',
                          borderRadius: '4px',
                        }}
                      >
                        {d.fase}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '.84rem',
                        fontWeight: 500,
                        color: cardText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.imovel}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.52rem',
                        color: mutedText,
                        marginTop: '2px',
                      }}
                    >
                      {d.comprador}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant',serif",
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: '#c9a96e',
                      flexShrink: 0,
                      marginLeft: '12px',
                    }}
                  >
                    €{(val / 1e6).toFixed(2)}M
                  </div>
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    height: '3px',
                    background: darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.06)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: '2px',
                      transition: 'width .4s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '4px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      color: mutedText,
                      letterSpacing: '.04em',
                    }}
                  >
                    {pct}% concluído
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Score delta badge */}
                    {badge.show && (
                      <span
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.48rem',
                          color: badge.color,
                          letterSpacing: '.04em',
                        }}
                      >
                        {badge.symbol} {badge.label}
                      </span>
                    )}
                    {/* Closure prediction badge */}
                    {pred && (
                      <span
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.48rem',
                          color: pred.prediction.closureProbability >= 70
                            ? '#6fcf97'
                            : pred.prediction.closureProbability >= 40
                            ? '#f59e0b'
                            : '#ef4444',
                          letterSpacing: '.04em',
                        }}
                      >
                        🎯 {pred.prediction.closureProbability}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
