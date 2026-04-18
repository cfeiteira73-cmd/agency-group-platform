'use client'
// =============================================================================
// AGENCY GROUP — Dashboard Priority Center
// Actionable intelligence surface combining lead + deal scoring.
//
// Sections:
//   1. Acção Imediata — overdue follow-ups + imminent closing dates
//   2. Deals em Risco — high-severity risk flags
//   3. Leads Prioritários — top-scored unconverted leads
//   4. Oportunidades Paradas — stalled > 30d
//
// Rendering rules:
//   • Never fabricates urgency — every item is grounded in real data
//   • Empty state per section (not collapsed) to make absence visible
//   • Score and reason badges provide transparency
//   • Max 5 items per section to avoid cognitive overload
// =============================================================================

import type { CRMContact, Deal } from './types'
import type { ScoredContact } from '../lib/leadScoring'
import type { ScoredDeal } from '../lib/dealScoring'

interface PriorityCenterProps {
  darkMode: boolean
  /** Scored and sorted contacts (from scoreAllContacts) */
  scoredContacts: ScoredContact[]
  /** Scored and sorted deals (from scoreAllDeals) */
  scoredDeals: ScoredDeal[]
  onGoToCRM:      () => void
  onGoToPipeline: () => void
  today: string  // YYYY-MM-DD
}

// ─── Small Helpers ────────────────────────────────────────────────────────────

function bandColor(band: string): string {
  const m: Record<string, string> = {
    A: '#1c4a35', B: '#2d6e52', C: '#a07840', D: '#888',
    SAUDAVEL: '#1c4a35', MODERADO: '#a07840', EM_RISCO: '#dc6820', CRITICO: '#dc2626',
  }
  return m[band] ?? '#888'
}

function daysUntilStr(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const days = Math.floor((d.getTime() - Date.now()) / 86400000)
  if (days < 0)  return `${Math.abs(days)}d em atraso`
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `em ${days}d`
}

function daysSinceStr(dateStr: string | null | undefined): string {
  if (!dateStr) return 'nunca'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'nunca'
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days}d`
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon, label, count, accent, darkMode,
}: {
  icon: string; label: string; count: number; accent: string; darkMode: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.07)' : 'rgba(14,14,13,.06)'}`,
      }}
    >
      <span style={{ fontSize: '.85rem' }}>{icon}</span>
      <span style={{
        fontFamily: "'DM Mono',monospace",
        fontSize: '.54rem',
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: accent,
        fontWeight: 600,
      }}>
        {label}
      </span>
      <span style={{
        marginLeft: 'auto',
        fontFamily: "'DM Mono',monospace",
        fontSize: '.52rem',
        color: accent,
        background: `${accent}18`,
        padding: '1px 7px',
        borderRadius: '3px',
      }}>
        {count}
      </span>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ label, darkMode }: { label: string; darkMode: boolean }) {
  return (
    <div style={{
      fontFamily: "'DM Mono',monospace",
      fontSize: '.52rem',
      color: darkMode ? 'rgba(244,240,230,.3)' : 'rgba(14,14,13,.3)',
      padding: '10px 0 6px 0',
      letterSpacing: '.04em',
    }}>
      ✓ {label}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPriorityCenter({
  darkMode,
  scoredContacts,
  scoredDeals,
  onGoToCRM,
  onGoToPipeline,
  today,
}: PriorityCenterProps) {
  const cardBg   = darkMode ? '#0f1e16' : '#ffffff'
  const cardText = darkMode ? '#f4f0e6' : '#0e0e0d'
  const mutedText = darkMode ? 'rgba(240,237,228,.50)' : 'rgba(14,14,13,.45)'
  const borderCol = darkMode ? 'rgba(244,240,230,.07)' : 'rgba(14,14,13,.06)'

  // ── Section 1: Acção Imediata ─────────────────────────────────────────────
  // Leads with overdue follow-up (score ≥ 35) + deals closing within 14 days
  const urgentLeads = scoredContacts
    .filter(({ contact, scoring }) => {
      if (scoring.score < 35) return false
      if (!contact.nextFollowUp) return false
      return contact.nextFollowUp <= today
    })
    .slice(0, 3)

  const immMinentDeals = scoredDeals
    .filter(({ deal }) => {
      const d1 = deal.cpcvDate     ? Math.floor((new Date(deal.cpcvDate).getTime()     - Date.now()) / 86400000) : null
      const d2 = deal.escrituraDate ? Math.floor((new Date(deal.escrituraDate).getTime() - Date.now()) / 86400000) : null
      const nearest = [d1, d2].filter(d => d !== null) as number[]
      return nearest.some(d => d >= 0 && d <= 14)
    })
    .slice(0, 2)

  // ── Section 2: Deals em Risco ─────────────────────────────────────────────
  const dealsAtRisk = scoredDeals
    .filter(({ scoring }) =>
      scoring.dealHealth === 'CRITICO' ||
      scoring.dealHealth === 'EM_RISCO' ||
      scoring.dealRiskFlags.some(f => f.severity === 'high')
    )
    .slice(0, 5)

  // ── Section 3: Leads Prioritários ────────────────────────────────────────
  const topLeads = scoredContacts
    .filter(({ scoring }) => scoring.band === 'A' || scoring.band === 'B')
    .slice(0, 5)

  // ── Section 4: Oportunidades Paradas ─────────────────────────────────────
  const stalledLeads = scoredContacts
    .filter(({ contact }) => {
      if (contact.status === 'cliente') return false
      if (!contact.lastContact) return true
      const days = Math.floor((Date.now() - new Date(contact.lastContact).getTime()) / 86400000)
      return days > 30
    })
    .slice(0, 5)

  const immediateCount = urgentLeads.length + immMinentDeals.length
  const hasAnyData = scoredContacts.length > 0 || scoredDeals.length > 0

  if (!hasAnyData) {
    return (
      <div style={{
        background: cardBg,
        border: `1px solid ${borderCol}`,
        padding: '20px 24px',
        marginBottom: '24px',
        borderRadius: '12px',
      }}>
        <div style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: '.52rem',
          color: mutedText,
          textAlign: 'center',
          padding: '16px 0',
        }}>
          Centro de Prioridades disponível após carga de dados CRM e Pipeline
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${borderCol}`,
        borderRadius: '12px',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 22px',
        borderBottom: `1px solid ${borderCol}`,
        background: darkMode ? 'rgba(28,74,53,.15)' : 'rgba(28,74,53,.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '.85rem' }}>🎯</span>
          <div>
            <div style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.54rem',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: darkMode ? '#6fcf97' : '#1c4a35',
              fontWeight: 600,
            }}>
              Centro de Prioridades
            </div>
            <div style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              color: mutedText,
              marginTop: '1px',
            }}>
              {scoredContacts.length} leads · {scoredDeals.length} deals avaliados
            </div>
          </div>
        </div>
        {immediateCount > 0 && (
          <span style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.54rem',
            background: 'rgba(220,38,38,.12)',
            color: '#dc2626',
            border: '1px solid rgba(220,38,38,.25)',
            padding: '3px 10px',
            borderRadius: '4px',
            letterSpacing: '.06em',
          }}>
            ⚠ {immediateCount} acção{immediateCount !== 1 ? 'ões' : ''} imediata{immediateCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* 2×2 grid of sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto auto',
      }}>

        {/* Cell 1: Acção Imediata */}
        <div style={{
          padding: '16px 20px',
          borderRight: `1px solid ${borderCol}`,
          borderBottom: `1px solid ${borderCol}`,
        }}>
          <SectionHeader
            icon="⚡"
            label="Acção Imediata"
            count={immediateCount}
            accent="#dc2626"
            darkMode={darkMode}
          />
          {urgentLeads.length === 0 && immMinentDeals.length === 0 && (
            <EmptyState label="Sem acções urgentes" darkMode={darkMode} />
          )}
          {urgentLeads.map(({ contact, scoring }) => (
            <div
              key={`ul-${contact.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '7px 0',
                borderBottom: `1px solid ${borderCol}`,
                cursor: 'pointer',
              }}
              onClick={onGoToCRM}
            >
              <span style={{
                width: '20px',
                height: '20px',
                background: `${bandColor(scoring.band)}22`,
                border: `1px solid ${bandColor(scoring.band)}55`,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.46rem',
                color: bandColor(scoring.band),
                flexShrink: 0,
                marginTop: '1px',
              }}>
                {scoring.band}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.82rem',
                  fontWeight: 500,
                  color: cardText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {contact.name}
                </div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.50rem',
                  color: '#dc2626',
                  letterSpacing: '.04em',
                  marginTop: '1px',
                }}>
                  {scoring.recommendedNextAction}
                </div>
              </div>
              <span style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                color: mutedText,
                flexShrink: 0,
              }}>
                {scoring.score}pts
              </span>
            </div>
          ))}
          {immMinentDeals.map(({ deal, scoring }) => (
            <div
              key={`id-${deal.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '7px 0',
                borderBottom: `1px solid ${borderCol}`,
                cursor: 'pointer',
              }}
              onClick={onGoToPipeline}
            >
              <span style={{
                width: '20px',
                height: '20px',
                background: 'rgba(201,169,110,.15)',
                border: '1px solid rgba(201,169,110,.35)',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.54rem',
                flexShrink: 0,
                marginTop: '1px',
              }}>
                🏠
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.82rem',
                  fontWeight: 500,
                  color: cardText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {deal.ref} — {deal.imovel || 'sem nome'}
                </div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.50rem',
                  color: '#c9a96e',
                  letterSpacing: '.04em',
                  marginTop: '1px',
                }}>
                  {deal.cpcvDate   ? `CPCV ${daysUntilStr(deal.cpcvDate)}`     : ''}
                  {deal.escrituraDate ? ` · Escritura ${daysUntilStr(deal.escrituraDate)}` : ''}
                </div>
              </div>
              <span style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                color: bandColor(scoring.dealHealth),
                flexShrink: 0,
                padding: '1px 5px',
                background: `${bandColor(scoring.dealHealth)}15`,
                borderRadius: '3px',
              }}>
                {scoring.closurePct}%
              </span>
            </div>
          ))}
        </div>

        {/* Cell 2: Deals em Risco */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${borderCol}`,
        }}>
          <SectionHeader
            icon="⚠"
            label="Deals em Risco"
            count={dealsAtRisk.length}
            accent="#dc6820"
            darkMode={darkMode}
          />
          {dealsAtRisk.length === 0 && (
            <EmptyState label="Todos os deals saudáveis" darkMode={darkMode} />
          )}
          {dealsAtRisk.map(({ deal, scoring }) => (
            <div
              key={`dr-${deal.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '7px 0',
                borderBottom: `1px solid ${borderCol}`,
                cursor: 'pointer',
              }}
              onClick={onGoToPipeline}
            >
              <span style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.50rem',
                color: bandColor(scoring.dealHealth),
                background: `${bandColor(scoring.dealHealth)}14`,
                border: `1px solid ${bandColor(scoring.dealHealth)}40`,
                padding: '2px 6px',
                borderRadius: '3px',
                flexShrink: 0,
                marginTop: '1px',
              }}>
                {scoring.dealHealthLabel.toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.82rem',
                  fontWeight: 500,
                  color: cardText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {deal.ref} — {deal.imovel || 'sem nome'}
                </div>
                {scoring.dealRiskFlags[0] && (
                  <div style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.50rem',
                    color: bandColor(scoring.dealHealth),
                    letterSpacing: '.03em',
                    marginTop: '2px',
                  }}>
                    {scoring.dealRiskFlags[0].label}
                  </div>
                )}
              </div>
              <span style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                color: mutedText,
                flexShrink: 0,
              }}>
                {scoring.dealScore}pts
              </span>
            </div>
          ))}
        </div>

        {/* Cell 3: Leads Prioritários */}
        <div style={{
          padding: '16px 20px',
          borderRight: `1px solid ${borderCol}`,
        }}>
          <SectionHeader
            icon="⭐"
            label="Leads Prioritários"
            count={topLeads.length}
            accent="#1c4a35"
            darkMode={darkMode}
          />
          {topLeads.length === 0 && (
            <EmptyState label="Nenhum lead de band A/B no CRM" darkMode={darkMode} />
          )}
          {topLeads.map(({ contact, scoring }) => (
            <div
              key={`tl-${contact.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 0',
                borderBottom: `1px solid ${borderCol}`,
                cursor: 'pointer',
              }}
              onClick={onGoToCRM}
            >
              <span style={{
                width: '22px',
                height: '22px',
                background: `${bandColor(scoring.band)}20`,
                border: `1.5px solid ${bandColor(scoring.band)}55`,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                fontWeight: 700,
                color: bandColor(scoring.band),
                flexShrink: 0,
              }}>
                {scoring.band}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.82rem',
                  fontWeight: 500,
                  color: cardText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {contact.name}
                </div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.50rem',
                  color: mutedText,
                  letterSpacing: '.03em',
                  marginTop: '1px',
                }}>
                  {contact.nationality || '—'} · €{((contact.budgetMax ?? 0) / 1000).toFixed(0)}K · ú.cont: {daysSinceStr(contact.lastContact)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  fontWeight: 600,
                  color: bandColor(scoring.band),
                }}>
                  {scoring.score}
                </div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.44rem',
                  color: mutedText,
                }}>
                  pts
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cell 4: Oportunidades Paradas */}
        <div style={{ padding: '16px 20px' }}>
          <SectionHeader
            icon="⏸"
            label="Oportunidades Paradas"
            count={stalledLeads.length}
            accent="#a07840"
            darkMode={darkMode}
          />
          {stalledLeads.length === 0 && (
            <EmptyState label="Sem leads parados >30 dias" darkMode={darkMode} />
          )}
          {stalledLeads.map(({ contact, scoring }) => (
            <div
              key={`sl-${contact.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 0',
                borderBottom: `1px solid ${borderCol}`,
                cursor: 'pointer',
              }}
              onClick={onGoToCRM}
            >
              <span style={{
                width: '22px',
                height: '22px',
                background: 'rgba(160,120,64,.14)',
                border: '1px solid rgba(160,120,64,.35)',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: '#a07840',
                flexShrink: 0,
              }}>
                {scoring.band}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.82rem',
                  fontWeight: 500,
                  color: cardText,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {contact.name}
                </div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.50rem',
                  color: '#a07840',
                  letterSpacing: '.03em',
                  marginTop: '1px',
                }}>
                  Ú. contacto: {daysSinceStr(contact.lastContact)} · {contact.status}
                </div>
              </div>
              <span style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                color: mutedText,
                flexShrink: 0,
              }}>
                {scoring.score}pts
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
