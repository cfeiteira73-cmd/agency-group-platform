'use client'
import type { DashboardTheme } from './types'

interface SofiaInsightsData {
  opportunity: string
  market: string
  action: string
  risk: string
}

interface Props {
  theme: DashboardTheme
  insights: SofiaInsightsData
  sofiaTs: Date
  sofiaRefreshing: boolean
  stalledGCI: number
  stalledCount: number
  hasActiveDeals: boolean
  onRefresh: () => Promise<void>
  onNavigatePipeline: () => void
}

export default function DashboardSofiaInsights({
  theme,
  insights,
  sofiaTs,
  sofiaRefreshing,
  stalledGCI,
  stalledCount,
  hasActiveDeals,
  onRefresh,
  onNavigatePipeline,
}: Props) {
  const { darkMode, cardText, mutedText, borderCol } = theme

  return (
    <div
      style={{
        background: darkMode ? '#0f1e16' : 'linear-gradient(135deg,#fafaf8,#f4f0e6)',
        border: `1px solid ${borderCol}`,
        marginBottom: '24px',
        overflow: 'hidden',
        borderRadius: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: `1px solid ${borderCol}`,
          background: darkMode ? 'rgba(28,74,53,.3)' : 'rgba(28,74,53,.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              background: '#1c4a35',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '.75rem',
            }}
          >
            🤖
          </div>
          <div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: darkMode ? '#6fcf97' : '#1c4a35',
                fontWeight: 600,
              }}
            >
              Sofia Insights
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
                color: mutedText,
                marginTop: '1px',
              }}
            >
              Análise inteligente · {sofiaTs.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <button
          type="button"
          style={{
            padding: '5px 14px',
            background: 'transparent',
            border: `1px solid ${darkMode ? 'rgba(111,207,151,.2)' : 'rgba(28,74,53,.2)'}`,
            color: darkMode ? '#6fcf97' : '#1c4a35',
            fontFamily: "'DM Mono',monospace",
            fontSize: '.52rem',
            cursor: sofiaRefreshing ? 'not-allowed' : 'pointer',
            letterSpacing: '.06em',
            opacity: sofiaRefreshing ? 0.5 : 1,
            transition: 'all .15s',
            borderRadius: '4px',
          }}
          disabled={sofiaRefreshing}
          onClick={() => { void onRefresh() }}
        >
          {sofiaRefreshing ? '✦ A actualizar...' : '↻ Refresh'}
        </button>
      </div>

      {/* 2×2 Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'auto auto',
        }}
      >
        {/* Cell 1 — Oportunidade do Dia */}
        <div
          className="sofia-card"
          style={{
            padding: '18px 20px',
            borderRight: `1px solid ${borderCol}`,
            borderBottom: `1px solid ${borderCol}`,
            transition: 'background .15s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '.9rem' }}>💡</span>
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#c9a96e',
              }}
            >
              Oportunidade do Dia
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Jost',sans-serif",
              fontSize: '.82rem',
              color: cardText,
              lineHeight: 1.65,
              fontStyle: 'italic',
            }}
          >
            {insights.opportunity}
          </div>
        </div>

        {/* Cell 2 — Mercado Hoje */}
        <div
          className="sofia-card"
          style={{
            padding: '18px 20px',
            borderBottom: `1px solid ${borderCol}`,
            transition: 'background .15s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '.9rem' }}>📊</span>
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#3a7bd5',
              }}
            >
              Mercado Hoje
            </span>
          </div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              color: cardText,
              lineHeight: 1.9,
              whiteSpace: 'pre-line',
            }}
          >
            {insights.market}
          </div>
        </div>

        {/* Cell 3 — Acção Prioritária */}
        <div
          className="sofia-card"
          style={{
            padding: '18px 20px',
            borderRight: `1px solid ${borderCol}`,
            transition: 'background .15s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '.9rem' }}>🎯</span>
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: darkMode ? '#6fcf97' : '#1c4a35',
              }}
            >
              Acção Prioritária
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Jost',sans-serif",
              fontSize: '.82rem',
              color: cardText,
              lineHeight: 1.65,
              fontStyle: 'italic',
            }}
          >
            {insights.action}
          </div>
          {hasActiveDeals && (
            <button
              type="button"
              style={{
                marginTop: '12px',
                padding: '4px 12px',
                background: darkMode ? 'rgba(28,74,53,.25)' : 'rgba(28,74,53,.06)',
                border: `1px solid ${darkMode ? 'rgba(111,207,151,.25)' : 'rgba(28,74,53,.2)'}`,
                color: darkMode ? '#6fcf97' : '#1c4a35',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                cursor: 'pointer',
                letterSpacing: '.06em',
                borderRadius: '4px',
              }}
              onClick={onNavigatePipeline}
            >
              → Ver Pipeline
            </button>
          )}
        </div>

        {/* Cell 4 — Receita em Risco */}
        <div
          className="sofia-card"
          style={{
            padding: '18px 20px',
            borderLeft: stalledCount > 0 ? '3px solid rgba(220,38,38,.4)' : 'none',
            transition: 'background .15s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '.9rem' }}>💰</span>
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: stalledCount > 0 ? '#dc2626' : '#4a9c7a',
              }}
            >
              Receita em Risco
            </span>
          </div>
          {stalledCount > 0 ? (
            <>
              <div
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '1.6rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                €{Math.round(stalledGCI / 1000)}K
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  color: mutedText,
                  whiteSpace: 'pre-line',
                  lineHeight: 1.7,
                }}
              >
                {insights.risk}
              </div>
              <button
                type="button"
                style={{
                  marginTop: '10px',
                  padding: '4px 12px',
                  background: 'rgba(220,38,38,.06)',
                  border: '1px solid rgba(220,38,38,.25)',
                  color: '#dc2626',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  cursor: 'pointer',
                  letterSpacing: '.06em',
                  borderRadius: '4px',
                }}
                onClick={onNavigatePipeline}
              >
                → Seguimento urgente
              </button>
            </>
          ) : (
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: '#4a9c7a',
                lineHeight: 1.7,
                whiteSpace: 'pre-line',
              }}
            >
              {insights.risk}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
