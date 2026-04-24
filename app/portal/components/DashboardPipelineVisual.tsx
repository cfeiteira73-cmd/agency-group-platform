'use client'
import type { DashboardTheme } from './types'
import { STAGE_COLOR, STAGE_TARGET_DAYS } from './constants'

interface Props {
  theme: DashboardTheme
  stageBreakdown: { stage: string; count: number; value: number }[]
  maxStageVal: number
  stageAvgDays: Record<string, number>
  onViewPipeline: () => void
}

export default function DashboardPipelineVisual({
  theme,
  stageBreakdown,
  maxStageVal,
  stageAvgDays,
  onViewPipeline,
}: Props) {
  const { darkMode, cardBg, cardText, mutedText, borderCol } = theme

  if (stageBreakdown.length === 0) return null

  return (
    <div
      className="pipeline-section"
      style={{
        background: cardBg,
        border: `1px solid ${borderCol}`,
        padding: '22px 24px',
        marginBottom: '24px',
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
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
          Pipeline por Fase
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
          onClick={onViewPipeline}
        >
          Ver tudo →
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {stageBreakdown.map(s => {
          const barWidth = (s.value / maxStageVal) * 100
          const color = STAGE_COLOR[s.stage] ?? '#888'
          const avgDays = stageAvgDays[s.stage] ?? 0
          const targetDays = STAGE_TARGET_DAYS[s.stage] ?? 999
          const velocityOk = avgDays <= targetDays
          return (
            <div
              key={s.stage}
              className="pipeline-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(80px, 160px) 1fr minmax(60px, 120px)',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 8px',
                borderRadius: '6px',
                transition: 'background .15s',
              }}
              onClick={onViewPipeline}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.60rem',
                        color: cardText,
                        letterSpacing: '.04em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                    >
                      {s.stage}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        background: `${color}1a`,
                        borderRadius: '50%',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.52rem',
                        color,
                        flexShrink: 0,
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                  {/* Velocity row */}
                  {avgDays > 0 && (
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.52rem',
                        color: velocityOk ? '#4a9c7a' : '#dc2626',
                        letterSpacing: '.04em',
                        marginTop: '2px',
                      }}
                    >
                      {velocityOk ? '✓' : '⚠'} ~{avgDays}d {velocityOk ? '(dentro do alvo)' : `(alvo: ${targetDays}d)`}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  height: '6px',
                  background: darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.06)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '3px',
                    transition: 'width .4s ease',
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '.75rem',
                  color,
                  textAlign: 'right',
                  letterSpacing: '.04em',
                }}
              >
                €{(s.value / 1e6).toFixed(2)}M
              </div>
            </div>
          )
        })}
      </div>
      {/* Velocity legend */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: `1px solid ${borderCol}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4a9c7a' }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: mutedText, fontWeight: 500 }}>
            Dentro do alvo de velocidade
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: mutedText, fontWeight: 500 }}>
            Acima do alvo — acção requerida
          </span>
        </div>
      </div>
    </div>
  )
}
