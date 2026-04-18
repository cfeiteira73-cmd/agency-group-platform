'use client'

import type { ExecutiveRankingOutput, PortfolioHealthLabel } from '../lib/intelligence/executiveRanking'

interface Props {
  darkMode: boolean
  ranking: ExecutiveRankingOutput
}

// ─── design tokens ────────────────────────────────────────────────────────────
const tokens = {
  dark: {
    bg:     '#0c1f15',
    card:   '#0e2518',
    border: 'rgba(201,169,110,.15)',
    text:   '#f4f0e6',
    muted:  'rgba(244,240,230,.45)',
    track:  'rgba(244,240,230,.08)',
  },
  light: {
    bg:     '#ffffff',
    card:   '#f9f9f7',
    border: 'rgba(14,14,13,.08)',
    text:   '#0e0e0d',
    muted:  'rgba(14,14,13,.45)',
    track:  'rgba(14,14,13,.06)',
  },
} as const

const GOLD   = '#c9a96e'
const GREEN  = '#6fcf97'
const AMBER  = '#d97706'
const RED    = '#dc2626'

// ─── helpers ──────────────────────────────────────────────────────────────────
function labelColor(label: PortfolioHealthLabel): string {
  if (label === 'EXCELENTE' || label === 'BOM') return GREEN
  if (label === 'MODERADO')                       return AMBER
  if (label === 'EM_RISCO')                       return RED
  return GOLD
}

function stageColor(fase: string): string {
  if (fase === 'Escritura Concluída')                                          return GREEN
  if (['Negociação', 'CPCV', 'Proposta Aceite'].includes(fase))               return GOLD
  return 'rgba(244,240,230,.4)'
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ExecutiveRankingPanel({ darkMode, ranking }: Props) {
  const { portfolioHealth, topDeals: allRankedDeals } = ranking

  // auto-hide when there is nothing to show
  if (portfolioHealth.score === 0 && allRankedDeals.length === 0) return null

  const t          = darkMode ? tokens.dark : tokens.light
  const healthCol  = labelColor(portfolioHealth.label)
  const topDeals   = allRankedDeals.slice(0, 5)

  // ── styles ──────────────────────────────────────────────────────────────────
  const wrapperStyle: React.CSSProperties = {
    marginBottom: '24px',
  }

  const cardStyle: React.CSSProperties = {
    background:   t.card,
    border:       `1px solid ${t.border}`,
    padding:      '22px 24px',
    borderRadius: '12px',
  }

  const headerRowStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  }

  const headerLeftStyle: React.CSSProperties = {
    display:    'flex',
    alignItems: 'center',
    gap:        '8px',
  }

  const headerLabelStyle: React.CSSProperties = {
    fontFamily:    '"DM Mono", monospace',
    fontSize:      '0.7rem',
    fontWeight:    500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color:         t.muted,
  }

  const dotStyle: React.CSSProperties = {
    width:        '3px',
    height:       '3px',
    borderRadius: '50%',
    background:   t.muted,
    flexShrink:   0,
  }

  const waveBadgeStyle: React.CSSProperties = {
    fontFamily:    '"DM Mono", monospace',
    fontSize:      '0.62rem',
    fontWeight:    500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color:          GOLD,
    border:        `1px solid ${GOLD}`,
    borderRadius:  '4px',
    padding:       '1px 6px',
  }

  const gridStyle: React.CSSProperties = {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr',
    gap:                 '16px',
    marginTop:           '16px',
  }

  // ── left column ─────────────────────────────────────────────────────────────
  const subLabelStyle: React.CSSProperties = {
    fontFamily:    '"DM Mono", monospace',
    fontSize:      '0.65rem',
    fontWeight:    500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color:          t.muted,
    marginBottom:  '8px',
  }

  const bigScoreStyle: React.CSSProperties = {
    fontFamily:  '"Cormorant", serif',
    fontSize:    '3rem',
    fontWeight:  700,
    lineHeight:  1,
    color:        GOLD,
    marginBottom: '4px',
  }

  const healthLabelStyle: React.CSSProperties = {
    fontFamily:    '"DM Mono", monospace',
    fontSize:      '0.7rem',
    fontWeight:    500,
    letterSpacing: '0.06em',
    fontVariant:   'small-caps',
    color:          healthCol,
    marginBottom:  '10px',
  }

  const trackStyle: React.CSSProperties = {
    width:        '100%',
    height:       '4px',
    borderRadius: '2px',
    background:    t.track,
    marginBottom: '10px',
    position:     'relative' as const,
    overflow:     'hidden',
  }

  const barStyle: React.CSSProperties = {
    position:     'absolute' as const,
    left:         0,
    top:          0,
    height:       '100%',
    width:        `${portfolioHealth.score}%`,
    borderRadius: '2px',
    background:    healthCol,
    transition:   'width .4s ease',
  }

  const subScoresStyle: React.CSSProperties = {
    fontFamily: '"DM Mono", monospace',
    fontSize:   '0.65rem',
    color:       t.muted,
    lineHeight: 1.4,
  }

  // ── right column ─────────────────────────────────────────────────────────────
  const dealRowStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            '8px',
    padding:        '5px 0',
    borderBottom:   `1px solid ${t.border}`,
  }

  const rankStyle: React.CSSProperties = {
    fontFamily:  '"DM Mono", monospace',
    fontSize:    '0.62rem',
    color:        t.muted,
    minWidth:    '14px',
    flexShrink:  0,
    textAlign:   'right' as const,
  }

  const dealNameStyle: React.CSSProperties = {
    fontFamily:   '"Jost", sans-serif',
    fontSize:     '0.84rem',
    color:         t.text,
    flex:         1,
    overflow:     'hidden',
    whiteSpace:   'nowrap' as const,
    textOverflow: 'ellipsis',
  }

  const commissionStyle: React.CSSProperties = {
    fontFamily: '"DM Mono", monospace',
    fontSize:   '0.72rem',
    fontWeight: 600,
    color:       GOLD,
    flexShrink: 0,
    marginLeft: 'auto',
    paddingLeft: '6px',
  }

  // ── footer ───────────────────────────────────────────────────────────────────
  const footerStyle: React.CSSProperties = {
    marginTop:  '12px',
    fontFamily: '"DM Mono", monospace',
    fontSize:   '0.62rem',
    color:       t.muted,
    textAlign:  'center' as const,
    letterSpacing: '0.02em',
  }

  // ── empty state ───────────────────────────────────────────────────────────────
  const emptyStyle: React.CSSProperties = {
    fontFamily: '"DM Mono", monospace',
    fontSize:   '0.72rem',
    color:       t.muted,
    textAlign:  'center' as const,
    padding:    '12px 0',
  }

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>

        {/* ── header row ─────────────────────────────────────────────────────── */}
        <div style={headerRowStyle}>
          <div style={headerLeftStyle}>
            <span style={headerLabelStyle}>Ranking Executivo</span>
            <span style={dotStyle} />
            <span style={waveBadgeStyle}>Wave J</span>
          </div>
        </div>

        {/* ── two-column grid ────────────────────────────────────────────────── */}
        <div style={gridStyle}>

          {/* LEFT — Portfolio Health */}
          <div>
            <div style={subLabelStyle}>Saúde do Portfolio</div>

            <div style={bigScoreStyle}>{portfolioHealth.score}</div>

            <div style={healthLabelStyle}>{portfolioHealth.label}</div>

            {/* progress bar */}
            <div style={trackStyle}>
              <div style={barStyle} />
            </div>

            {/* sub-scores */}
            <div style={subScoresStyle}>
              Lead {portfolioHealth.avgLeadScore.toFixed(0)}%
              {' · '}
              Deal {portfolioHealth.avgDealScore.toFixed(0)}%
              {' · '}
              Fecho {portfolioHealth.avgClosurePct.toFixed(0)}%
            </div>
          </div>

          {/* RIGHT — Top Deals */}
          <div>
            <div style={subLabelStyle}>Top Deals · Comissão Esperada</div>

            {topDeals.length === 0 ? (
              <div style={emptyStyle}>Sem deals activos</div>
            ) : (
              <div>
                {topDeals.map((d, i) => {
                  const faseCol  = stageColor(d.dealFase ?? '')
                  const commStr  = `€${(d.expectedCommission / 1000).toFixed(1)}k`

                  const faseBadgeStyle: React.CSSProperties = {
                    fontFamily:    '"DM Mono", monospace',
                    fontSize:      '0.58rem',
                    fontWeight:    500,
                    color:          faseCol,
                    border:        `1px solid ${faseCol}`,
                    borderRadius:  '3px',
                    padding:       '1px 5px',
                    flexShrink:    0,
                    whiteSpace:    'nowrap' as const,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                  }

                  // last row no border
                  const rowStyle: React.CSSProperties = {
                    ...dealRowStyle,
                    borderBottom: i === topDeals.length - 1
                      ? 'none'
                      : `1px solid ${t.border}`,
                  }

                  return (
                    <div key={d.dealId ?? i} style={rowStyle}>
                      <span style={rankStyle}>{i + 1}</span>
                      <span style={dealNameStyle}>{d.dealImovel || '—'}</span>
                      <span style={commissionStyle}>{commStr}</span>
                      <span style={faseBadgeStyle}>{d.dealFase || '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── footer ─────────────────────────────────────────────────────────── */}
        <div style={footerStyle}>
          Ordenado por comissão esperada = valor × 5% × probabilidade
        </div>

      </div>
    </div>
  )
}
