'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

interface PhotoResult {
  overall_score: number
  photo_count: number
  value_impact_pct: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendations: string[]
  scores: Array<{
    url: string; quality: number; staging: number; issues: string[]; strengths: string[]
  }>
}

// AG Design System tokens
const ag = {
  bgDark: '#0c1f15',
  bgMedium: '#1c4a35',
  bgPanel: 'rgba(28,74,53,0.4)',
  bgPanelLight: 'rgba(28,74,53,0.3)',
  gold: '#c9a96e',
  goldMuted: 'rgba(201,169,110,0.6)',
  textPrimary: '#f4f0e6',
  textMuted: 'rgba(244,240,230,0.65)',
  textDim: 'rgba(244,240,230,0.4)',
  border: 'rgba(201,169,110,0.2)',
  borderStrong: 'rgba(201,169,110,0.4)',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
} as const

const GRADE_STYLES: Record<'A' | 'B' | 'C' | 'D' | 'F', CSSProperties> = {
  A: { color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' },
  B: { color: '#c9a96e', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)' },
  C: { color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' },
  D: { color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)' },
  F: { color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' },
}

const s: Record<string, CSSProperties> = {
  card: {
    background: ag.bgPanel,
    border: `1px solid ${ag.border}`,
    borderRadius: 4,
    padding: '24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 4,
    background: `linear-gradient(135deg, ${ag.gold}, #a8843a)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'Cormorant Garamond, serif',
    fontWeight: 700,
    fontSize: 18,
    color: ag.textPrimary,
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    color: ag.textMuted,
    margin: 0,
    marginTop: 2,
  },
  label: {
    display: 'block',
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    color: ag.textMuted,
    marginBottom: 8,
  },
  textarea: {
    width: '100%',
    borderRadius: 4,
    border: `1px solid ${ag.border}`,
    background: 'rgba(12,31,21,0.6)',
    color: ag.textPrimary,
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    padding: '8px 12px',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    transition: 'all 0.3s ease',
  },
  button: {
    width: '100%',
    background: ag.gold,
    color: ag.bgDark,
    border: 'none',
    borderRadius: 4,
    padding: '12px 16px',
    fontFamily: 'Jost, sans-serif',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.3s ease',
    letterSpacing: '0.02em',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorText: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    color: ag.red,
  },
  divider: {
    borderTop: `1px solid ${ag.border}`,
    paddingTop: 16,
    marginTop: 4,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  statBox: {
    textAlign: 'center',
    padding: '12px',
    borderRadius: 4,
    border: `1px solid ${ag.border}`,
    background: ag.bgPanelLight,
  },
  statBigGrade: {
    fontFamily: 'Cormorant Garamond, serif',
    fontWeight: 900,
    fontSize: 30,
    lineHeight: 1,
  },
  statBig: {
    fontFamily: 'DM Mono, monospace',
    fontWeight: 700,
    fontSize: 22,
    color: ag.textPrimary,
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 11,
    color: ag.textDim,
    marginTop: 4,
  },
  recBox: {
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 4,
    padding: '12px 16px',
  },
  recTitle: {
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    color: ag.amber,
    margin: 0,
    marginBottom: 8,
  } as CSSProperties,
  recList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  recItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontFamily: 'Jost, sans-serif',
    fontSize: 13,
    color: 'rgba(251,191,36,0.85)',
  },
}

export function PortalPhotoScorer() {
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PhotoResult | null>(null)
  const [error, setError] = useState('')

  async function analyzePhotos() {
    const photos = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'))
    if (photos.length === 0) {
      setError('Adiciona pelo menos 1 URL de foto válida (https://...)')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/avm/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult(await res.json() as PhotoResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na análise')
    } finally {
      setLoading(false)
    }
  }

  const impactPositive = result ? result.value_impact_pct >= 0 : false

  return (
    <>
      <style>{`
        .ag-photo-textarea:focus {
          border-color: rgba(201,169,110,0.4) !important;
          box-shadow: 0 0 0 2px rgba(201,169,110,0.15);
        }
        .ag-photo-btn:hover:not(:disabled) {
          background: #a8843a !important;
        }
        .ag-photo-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.iconWrap}>
            <svg width="20" height="20" fill="none" stroke="#0c1f15" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 style={s.title}>Avaliação de Fotos IA</h2>
            <p style={s.subtitle}>Impacto das fotos no valor do imóvel</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="photo-urls" style={s.label}>
              URLs das fotos (1 por linha, máx. 8)
            </label>
            <textarea
              id="photo-urls"
              className="ag-photo-textarea"
              value={urls}
              onChange={e => setUrls(e.target.value)}
              rows={4}
              placeholder={"https://images.supabase.co/foto1.jpg\nhttps://images.supabase.co/foto2.jpg"}
              style={s.textarea}
              disabled={loading}
            />
          </div>

          <button
            type="button"
            className="ag-photo-btn"
            onClick={analyzePhotos}
            disabled={loading}
            style={s.button}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ animation: 'spin 1s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity: 0.75 }} />
                </svg>
                A analisar fotos...
              </>
            ) : 'Analisar Fotos'}
          </button>

          {error && (
            <p style={s.errorText} role="alert">{error}</p>
          )}

          {result && (
            <div style={s.divider}>
              <div style={s.statsGrid}>
                {/* Grade */}
                <div style={{ ...s.statBox, ...GRADE_STYLES[result.grade] }}>
                  <p style={{ ...s.statBigGrade, color: GRADE_STYLES[result.grade].color as string }}>{result.grade}</p>
                  <p style={s.statLabel}>Classificação</p>
                </div>
                {/* Score */}
                <div style={s.statBox}>
                  <p style={s.statBig}>{result.overall_score}</p>
                  <p style={s.statLabel}>Score /100</p>
                </div>
                {/* Value impact */}
                <div style={{
                  ...s.statBox,
                  background: impactPositive ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                  border: `1px solid ${impactPositive ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
                }}>
                  <p style={{ ...s.statBig, color: impactPositive ? ag.green : ag.red }}>
                    {result.value_impact_pct >= 0 ? '+' : ''}{result.value_impact_pct.toFixed(1)}%
                  </p>
                  <p style={s.statLabel}>Impacto valor</p>
                </div>
              </div>

              {result.recommendations.length > 0 && (
                <div style={{ ...s.recBox, marginTop: 12 }}>
                  <h3 style={s.recTitle}>Recomendações</h3>
                  <ul style={s.recList}>
                    {result.recommendations.map((rec, i) => (
                      <li key={i} style={s.recItem}>
                        <span aria-hidden="true">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
