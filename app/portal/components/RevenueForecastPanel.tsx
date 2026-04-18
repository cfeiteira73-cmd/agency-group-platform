'use client'
// =============================================================================
// AGENCY GROUP — Revenue Forecast Panel v1.0
// Compact 3-period GCI forecast display.
// Pure rendering component — all data computed upstream in PortalDashboard.
//
// Design:
//   • 3 forecast cards (30d / 90d / 6m) with expected GCI bands
//   • Weighted vs raw pipeline GCI summary
//   • Top contributors list per period (collapsed by default)
//   • Confidence badges — never misleads when data is sparse
//   • AG design system: Cormorant / DM Mono / Jost, #1c4a35 / #c9a96e
// =============================================================================

import { useState } from 'react'
import type { ForecastOutput, PeriodForecast } from '../lib/intelligence/forecast'

// ─── Props ────────────────────────────────────────────────────────────────────

interface RevenueForecastPanelProps {
  darkMode: boolean
  forecast: ForecastOutput
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatK(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `€${Math.round(value / 1_000)}K`
  return `€${value}`
}

const CONFIDENCE_CONFIG = {
  high:   { label: 'Alta confiança',   color: '#22c55e', bg: 'rgba(34,197,94,.1)'   },
  medium: { label: 'Confiança média',  color: '#f59e0b', bg: 'rgba(245,158,11,.1)'  },
  low:    { label: 'Dados limitados',  color: '#888',    bg: 'rgba(136,136,136,.1)' },
} as const

const PERIOD_LABEL: Record<'30d' | '90d' | '180d', string> = {
  '30d':  '30 dias',
  '90d':  '3 meses',
  '180d': '6 meses',
}

// ─── Period Card ──────────────────────────────────────────────────────────────

function PeriodCard({
  forecast,
  darkMode,
  isHighlighted,
}: {
  forecast: PeriodForecast
  darkMode: boolean
  isHighlighted: boolean
}) {
  const [showContributors, setShowContributors] = useState(false)
  const cfg   = CONFIDENCE_CONFIG[forecast.confidence]
  const txt   = darkMode ? '#f4f0e6' : '#0e0e0d'
  const muted = darkMode ? 'rgba(244,240,230,.55)' : 'rgba(14,14,13,.50)'
  const bdr   = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.07)'

  const hasContributors = forecast.topContributors.length > 0

  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '16px 18px',
        background: darkMode ? '#0f1e16' : '#ffffff',
        border: `1px solid ${isHighlighted ? '#c9a96e40' : bdr}`,
        borderTop: isHighlighted ? '2px solid #c9a96e' : `1px solid ${bdr}`,
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Period label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.54rem',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: isHighlighted ? '#c9a96e' : muted,
          }}
        >
          {PERIOD_LABEL[forecast.period]}
        </span>
        <span
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            letterSpacing: '.06em',
            color: cfg.color,
            background: cfg.bg,
            padding: '2px 6px',
            borderRadius: '3px',
          }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Expected GCI — primary number */}
      <div>
        <div
          style={{
            fontFamily: "'Cormorant',serif",
            fontSize: forecast.expectedGCI === 0 ? '1.2rem' : '1.6rem',
            fontWeight: 300,
            color: forecast.expectedGCI === 0 ? muted : txt,
            lineHeight: 1,
          }}
        >
          {forecast.expectedGCI === 0 ? '—' : formatK(forecast.expectedGCI)}
        </div>
        {forecast.expectedGCI > 0 && (
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              color: muted,
              marginTop: '4px',
              letterSpacing: '.04em',
            }}
          >
            {formatK(forecast.pessimisticGCI)} – {formatK(forecast.optimisticGCI)}
          </div>
        )}
      </div>

      {/* Deals count */}
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: '.56rem',
          color: muted,
          letterSpacing: '.04em',
        }}
      >
        {forecast.dealsCount === 0
          ? 'Sem deals neste horizonte'
          : `${forecast.dealsCount} deal${forecast.dealsCount > 1 ? 's' : ''} incluído${forecast.dealsCount > 1 ? 's' : ''}`}
      </div>

      {/* Contributors toggle */}
      {hasContributors && (
        <div>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.50rem',
              color: darkMode ? '#6fcf97' : '#1c4a35',
              cursor: 'pointer',
              letterSpacing: '.08em',
              padding: 0,
              transition: 'opacity .15s',
            }}
            onClick={() => setShowContributors(v => !v)}
          >
            {showContributors ? '▲ Ocultar' : `▼ Top ${forecast.topContributors.length} deals`}
          </button>

          {showContributors && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {forecast.topContributors.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.54rem',
                        color: txt,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        letterSpacing: '.02em',
                      }}
                    >
                      {c.dealRef} · {c.dealImovel}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.48rem',
                        color: muted,
                        letterSpacing: '.02em',
                      }}
                    >
                      {c.dealFase} · {c.closurePct}% fecho
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.54rem',
                      color: '#c9a96e',
                      flexShrink: 0,
                    }}
                  >
                    {formatK(c.expectedCommission)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RevenueForecastPanel({
  darkMode,
  forecast,
}: RevenueForecastPanelProps) {
  const cardBg    = darkMode ? '#0f1e16' : '#ffffff'
  const cardText  = darkMode ? '#f4f0e6' : '#0e0e0d'
  const mutedText = darkMode ? 'rgba(244,240,230,.55)' : 'rgba(14,14,13,.50)'
  const borderCol = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.07)'

  // Nothing in the pipeline — don't render noise
  if (forecast.rawPipelineGCI === 0) return null

  const conversionRatio = forecast.rawPipelineGCI > 0
    ? Math.round((forecast.weightedPipelineGCI / forecast.rawPipelineGCI) * 100)
    : 0

  return (
    <div style={{ marginBottom: '24px' }} aria-label="Previsão de receita">
      {/* Header */}
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
        <span
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.60rem',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: mutedText,
          }}
        >
          Previsão de GCI · Pipeline
        </span>

        {/* Pipeline summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.56rem',
              color: mutedText,
              letterSpacing: '.04em',
            }}
          >
            <span style={{ color: cardText }}>{formatK(forecast.weightedPipelineGCI)}</span>
            {' '}ponderado
          </div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.56rem',
              color: mutedText,
              letterSpacing: '.04em',
            }}
          >
            <span style={{ color: cardText }}>{formatK(forecast.rawPipelineGCI)}</span>
            {' '}bruto
          </div>
          <div
            style={{
              background: conversionRatio >= 50
                ? 'rgba(28,74,53,.12)'
                : 'rgba(245,158,11,.08)',
              color: conversionRatio >= 50 ? '#1c4a35' : '#d97706',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '.04em',
            }}
          >
            {conversionRatio}% conversão ponderada
          </div>
        </div>
      </div>

      {/* Forecast cards wrapper */}
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
            marginBottom: '16px',
          }}
        >
          Previsão de Receita por Horizonte
        </div>

        {/* 3 period cards */}
        <div
          className="forecast-grid"
          style={{
            display: 'flex',
            gap: '12px',
          }}
        >
          <PeriodCard forecast={forecast.monthly}    darkMode={darkMode} isHighlighted={forecast.monthly.dealsCount > 0} />
          <PeriodCard forecast={forecast.quarterly}  darkMode={darkMode} isHighlighted={false} />
          <PeriodCard forecast={forecast.semiAnnual} darkMode={darkMode} isHighlighted={false} />
        </div>

        {/* Footnote */}
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            color: mutedText,
            marginTop: '14px',
            paddingTop: '10px',
            borderTop: `1px solid ${borderCol}`,
            letterSpacing: '.04em',
          }}
        >
          Comissão estimada: 5% · Ponderado pela probabilidade de fecho actual de cada deal ·
          Bandas pessimista/optimista ±25%
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .forecast-grid { flex-direction: column !important; }
        }
      `}</style>
    </div>
  )
}
