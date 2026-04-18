'use client'
// =============================================================================
// AGENCY GROUP — Intelligence Panel v1.0
// Compact, high-signal panel showing copilot suggestions, manager brief,
// and top opportunities. Pure rendering — all intelligence computed upstream
// in PortalDashboard via useMemo.
//
// Design principles:
//   • No logic — accepts pre-computed intelligence objects
//   • No noise — only high-priority items surface
//   • AG design system — Cormorant / DM Mono / Jost, gold + forest
//   • Accessible — role, aria-label on interactive elements
// =============================================================================

import type { AgentCopilotOutput, CopilotSuggestion } from '../lib/intelligence/copilot'
import type { Opportunity } from '../lib/intelligence/opportunity'
import type { PricingInsight } from '../lib/intelligence/pricing'

// Wrapper type returned by computeAllPricingInsights
export interface PricingInsightEntry {
  dealRef: string
  dealImovel: string
  dealValor: string
  insight: PricingInsight
}
import type { SectionId } from './types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntelligencePanelProps {
  darkMode: boolean
  copilot: AgentCopilotOutput
  opportunities: Opportunity[]
  pricingInsights?: PricingInsightEntry[]  // Wave J: pricing signals per deal
  onGoToCRM: () => void
  onGoToPipeline: () => void
  onSetSection: (s: SectionId) => void
}

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  immediate: { label: 'URGENTE',      color: '#dc2626', bg: 'rgba(220,38,38,.08)',   border: 'rgba(220,38,38,.25)' },
  today:     { label: 'HOJE',         color: '#f59e0b', bg: 'rgba(245,158,11,.08)',  border: 'rgba(245,158,11,.25)' },
  this_week: { label: 'ESTA SEMANA',  color: '#3a7bd5', bg: 'rgba(58,123,213,.08)',  border: 'rgba(58,123,213,.20)' },
  this_month:{ label: 'ESTE MÊS',     color: '#888',    bg: 'rgba(136,136,136,.06)', border: 'rgba(136,136,136,.18)' },
} as const

const PRIORITY_CONFIG = {
  critical: { label: 'CRÍTICO', color: '#dc2626', dot: '#dc2626' },
  high:     { label: 'ALTA',    color: '#f59e0b', dot: '#f59e0b' },
  medium:   { label: 'MÉDIA',   color: '#3a7bd5', dot: '#3a7bd5' },
} as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  darkMode,
}: {
  s: CopilotSuggestion
  darkMode: boolean
}) {
  const uc  = URGENCY_CONFIG[s.urgency]
  const txt = darkMode ? '#f4f0e6' : '#0e0e0d'
  const muted = darkMode ? 'rgba(244,240,230,.55)' : 'rgba(14,14,13,.50)'

  return (
    <div
      style={{
        padding: '12px 14px',
        background: uc.bg,
        border: `1px solid ${uc.border}`,
        borderLeft: `3px solid ${uc.color}`,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* Urgency badge + headline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.50rem',
            letterSpacing: '.12em',
            color: uc.color,
            background: `${uc.color}18`,
            padding: '2px 6px',
            borderRadius: '3px',
            flexShrink: 0,
          }}
        >
          {uc.label}
        </span>
        <span
          style={{
            fontFamily: "'Jost',sans-serif",
            fontSize: '.84rem',
            fontWeight: 600,
            color: txt,
          }}
        >
          {s.headline}
        </span>
      </div>
      {/* Why */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.60rem', color: muted, letterSpacing: '.02em' }}>
        {s.why}
      </div>
      {/* Action */}
      <div
        style={{
          fontFamily: "'Jost',sans-serif",
          fontSize: '.78rem',
          color: uc.color,
          fontWeight: 500,
        }}
      >
        → {s.action}
      </div>
      {/* Data points */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
        {s.dataPoints.map((dp, i) => (
          <span
            key={i}
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.48rem',
              color: muted,
              background: darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.05)',
              padding: '2px 6px',
              borderRadius: '3px',
              letterSpacing: '.04em',
            }}
          >
            {dp}
          </span>
        ))}
      </div>
    </div>
  )
}

function OpportunityRow({
  opp,
  darkMode,
}: {
  opp: Opportunity
  darkMode: boolean
}) {
  const pc   = PRIORITY_CONFIG[opp.priority]
  const txt  = darkMode ? '#f4f0e6' : '#0e0e0d'
  const muted = darkMode ? 'rgba(244,240,230,.55)' : 'rgba(14,14,13,.50)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '8px 0',
        borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.06)'}`,
      }}
    >
      {/* Priority dot */}
      <div
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: pc.dot,
          flexShrink: 0,
          marginTop: '5px',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.48rem',
              color: pc.color,
              letterSpacing: '.1em',
            }}
          >
            {pc.label}
          </span>
          <span
            style={{
              fontFamily: "'Jost',sans-serif",
              fontSize: '.82rem',
              fontWeight: 600,
              color: txt,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
            }}
          >
            {opp.subjectName}
          </span>
          {opp.estimatedCommission !== undefined && opp.estimatedCommission > 0 && (
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.50rem',
                color: '#c9a96e',
                background: 'rgba(201,169,110,.1)',
                padding: '2px 5px',
                borderRadius: '3px',
              }}
            >
              €{Math.round(opp.estimatedCommission / 1_000)}K
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.58rem',
            color: muted,
            marginTop: '2px',
            letterSpacing: '.02em',
          }}
        >
          {opp.recommendedAction}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntelligencePanel({
  darkMode,
  copilot,
  opportunities,
  pricingInsights = [],
  onGoToCRM,
  onGoToPipeline,
}: IntelligencePanelProps) {
  const cardBg    = darkMode ? '#0f1e16' : '#ffffff'
  const cardText  = darkMode ? '#f4f0e6' : '#0e0e0d'
  const mutedText = darkMode ? 'rgba(244,240,230,.55)' : 'rgba(14,14,13,.50)'
  const borderCol = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.07)'

  const allSuggestions = [
    ...copilot.topLeadSuggestions,
    ...copilot.topDealSuggestions,
  ]

  const topOpps = opportunities.slice(0, 4)
  const criticalCount = opportunities.filter(o => o.priority === 'critical').length
  const revenueAtRisk = copilot.managerBrief.revenueAtRisk

  // Nothing actionable — don't render the panel
  if (allSuggestions.length === 0 && topOpps.length === 0) return null

  return (
    <div
      style={{ marginBottom: '24px' }}
      aria-label="Painel de inteligência"
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.60rem',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: mutedText,
            }}
          >
            Intelligence · Copilot
          </span>
          {criticalCount > 0 && (
            <span
              style={{
                background: '#dc2626',
                color: '#fff',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                padding: '2px 7px',
                borderRadius: '10px',
                letterSpacing: '.04em',
              }}
            >
              {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          {revenueAtRisk > 0 && (
            <span
              style={{
                color: '#c9a96e',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                letterSpacing: '.04em',
              }}
            >
              €{Math.round(revenueAtRisk / 1_000)}K em risco
            </span>
          )}
        </div>

        {/* Manager brief summary */}
        {copilot.managerBrief.biggestRisk !== 'Pipeline estável' && (
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.54rem',
              color: mutedText,
              letterSpacing: '.04em',
              fontStyle: 'italic',
              maxWidth: '340px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Maior risco: {copilot.managerBrief.biggestRisk}
          </div>
        )}
      </div>

      {/* 2-column grid: copilot suggestions | opportunities */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '14px',
        }}
        className="intel-grid"
      >
        {/* LEFT: Copilot suggestions */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant',serif",
              fontSize: '1rem',
              fontWeight: 400,
              color: cardText,
              marginBottom: '14px',
            }}
          >
            Copilot — Próximas Acções
          </div>

          {allSuggestions.length === 0 ? (
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.60rem',
                color: mutedText,
                textAlign: 'center',
                padding: '20px 0',
                letterSpacing: '.04em',
              }}
            >
              ✓ Sem acções urgentes pendentes
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allSuggestions.slice(0, 4).map((s, i) => (
                <SuggestionCard key={i} s={s} darkMode={darkMode} />
              ))}
            </div>
          )}

          {/* Navigation links */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: `1px solid ${borderCol}`,
            }}
          >
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
                padding: 0,
              }}
              onClick={onGoToCRM}
            >
              → Abrir CRM
            </button>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: '#c9a96e',
                cursor: 'pointer',
                letterSpacing: '.08em',
                padding: 0,
              }}
              onClick={onGoToPipeline}
            >
              → Ver Pipeline
            </button>
          </div>
        </div>

        {/* RIGHT: Opportunities */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            borderRadius: '12px',
            padding: '18px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1rem',
                fontWeight: 400,
                color: cardText,
              }}
            >
              Oportunidades Detectadas
            </div>
            {opportunities.length > 0 && (
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  color: mutedText,
                  letterSpacing: '.04em',
                }}
              >
                {opportunities.length} total
              </span>
            )}
          </div>

          {topOpps.length === 0 ? (
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.60rem',
                color: mutedText,
                textAlign: 'center',
                padding: '20px 0',
                letterSpacing: '.04em',
              }}
            >
              ✓ Sem oportunidades ocultas identificadas
            </div>
          ) : (
            <div>
              {topOpps.map(opp => (
                <OpportunityRow key={opp.id} opp={opp} darkMode={darkMode} />
              ))}
            </div>
          )}

          {/* Manager brief: where to intervene */}
          {copilot.managerBrief.whereToIntervene.length > 0 && (
            <div
              style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: `1px solid ${borderCol}`,
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  letterSpacing: '.1em',
                  color: mutedText,
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Onde intervir
              </div>
              {copilot.managerBrief.whereToIntervene.map((item, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.58rem',
                    color: darkMode ? '#f4f0e6' : '#0e0e0d',
                    letterSpacing: '.02em',
                    padding: '3px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i + 1}. {item}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Wave J: Pricing Alerts ──────────────────────────────────────────── */}
      {pricingInsights.length > 0 && (
        <div
          style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: `1px solid ${borderCol}`,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.58rem',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: mutedText,
              marginBottom: '10px',
            }}
          >
            Sinais de Preço · {pricingInsights.length} deal{pricingInsights.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pricingInsights.slice(0, 4).map((pi, i) => {
              const isOver   = pi.insight.signal === 'POSSIBLY_OVERPRICED'
              const sigCol   = isOver ? '#f59e0b' : '#6fcf97'
              const sigBg    = isOver ? 'rgba(245,158,11,.08)' : 'rgba(111,207,151,.08)'
              const sigLabel = isOver ? '⚠ Rever preço' : '✦ Forte procura'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 10px',
                    background: sigBg,
                    borderLeft: `2px solid ${sigCol}`,
                    borderRadius: '0 4px 4px 0',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.55rem',
                      color: sigCol,
                      letterSpacing: '.06em',
                      flexShrink: 0,
                    }}
                  >
                    {sigLabel}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Jost',sans-serif",
                      fontSize: '.78rem',
                      color: cardText,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {pi.dealImovel || pi.dealRef}
                  </span>
                  <span
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.55rem',
                      color: mutedText,
                      flexShrink: 0,
                    }}
                  >
                    {pi.insight.reasoning[0]?.slice(0, 30) ?? ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mobile responsiveness */}
      <style>{`
        @media (max-width: 768px) {
          .intel-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
