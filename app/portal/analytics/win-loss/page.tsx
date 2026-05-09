'use client'
// =============================================================================
// Agency Group — Win/Loss Analytics Page
// app/portal/analytics/win-loss/page.tsx
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WinLossAnalytics {
  period_days:  number
  total_deals:  number
  wins:         number
  losses:       number
  win_rate:     number
  total_gci:    number
  avg_days_to_close: number
  by_reason:    Array<{ reason: string; count: number; is_win: boolean; avg_gci: number }>
  by_agent:     Array<{ agent_email: string; wins: number; losses: number; win_rate: number; total_gci: number }>
  by_stage:     Array<{ lost_at_stage: string | null; count: number }>
  by_objection: Array<{ category: string; count: number }>
  trend_30d:    Array<{ date: string; wins: number; losses: number }>
}

interface TopObjection {
  category:       string
  sub_category:   string | null
  frequency_score: number
  win_rate_when_handled: number | null
  best_response:  string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%` }

function WinRateBadge({ rate }: { rate: number }) {
  const pctVal = rate * 100
  const color = pctVal >= 70 ? '#52b788' : pctVal >= 50 ? '#c9a96e' : '#e63946'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      backgroundColor: color + '22',
      color,
      border: `1px solid ${color}44`,
    }}>{pctVal.toFixed(1)}%</span>
  )
}

function MiniBar({ value, max, color = '#c9a96e' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ width: '100%', height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WinLossPage() {
  const [analytics, setAnalytics] = useState<WinLossAnalytics | null>(null)
  const [objections, setObjections] = useState<TopObjection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<30 | 60 | 90 | 180>(90)
  const [tab, setTab] = useState<'overview' | 'reasons' | 'agents' | 'objections'>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [aRes, oRes] = await Promise.all([
        fetch(`/api/analytics/win-loss?days=${period}`),
        fetch('/api/analytics/win-loss?top_objections=true'),
      ])
      if (!aRes.ok) throw new Error('Erro ao carregar analytics')
      const aData = await aRes.json()
      setAnalytics(aData.analytics ?? aData)
      if (oRes.ok) {
        const oData = await oRes.json()
        setObjections(oData.top_objections ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { void load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#888' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
        <div>A carregar Win/Loss...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: 32, color: '#e63946', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
      <div>{error}</div>
      <button onClick={load} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid #e63946', background: 'none', color: '#e63946', cursor: 'pointer' }}>
        Tentar novamente
      </button>
    </div>
  )

  const a = analytics!
  const maxReasonCount = Math.max(...(a.by_reason ?? []).map(r => r.count), 1)
  const maxAgentGci = Math.max(...(a.by_agent ?? []).map(ag => ag.total_gci), 1)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>Win/Loss Analytics</h1>
        <p style={{ color: '#888', margin: '4px 0 16px', fontSize: 14 }}>Análise de negócios fechados e perdidos · Ciência comercial</p>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {([30, 60, 90, 180] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)} style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: period === d ? 700 : 400,
              backgroundColor: period === d ? '#c9a96e22' : 'transparent',
              border: `1px solid ${period === d ? '#c9a96e' : '#333'}`,
              color: period === d ? '#c9a96e' : '#888',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Negócios', value: a.total_deals, icon: '📋', color: '#c9a96e' },
          { label: 'Ganhos', value: a.wins, icon: '✅', color: '#52b788' },
          { label: 'Perdidos', value: a.losses, icon: '❌', color: '#e63946' },
          { label: 'Win Rate', value: pct(a.win_rate), icon: '🎯', color: a.win_rate >= 0.7 ? '#52b788' : a.win_rate >= 0.5 ? '#c9a96e' : '#e63946' },
          { label: 'GCI Total', value: formatEur(a.total_gci), icon: '💰', color: '#c9a96e' },
          { label: 'Dias até Fecho', value: `${a.avg_days_to_close.toFixed(0)}d`, icon: '📅', color: '#c9a96e' },
        ].map(card => (
          <div key={card.label} style={{
            backgroundColor: '#1a1a1a', borderRadius: 12, padding: '16px 20px',
            border: '1px solid #2a2a2a',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{card.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2a2a2a', paddingBottom: 0 }}>
        {([
          { id: 'overview', label: '📈 Trend' },
          { id: 'reasons', label: '🔍 Razões' },
          { id: 'agents', label: '👤 Agentes' },
          { id: 'objections', label: '💬 Objecções' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', fontSize: 13, cursor: 'pointer', borderRadius: '8px 8px 0 0',
            backgroundColor: tab === t.id ? '#1a1a1a' : 'transparent',
            border: tab === t.id ? '1px solid #2a2a2a' : '1px solid transparent',
            borderBottom: tab === t.id ? '1px solid #1a1a1a' : '1px solid transparent',
            color: tab === t.id ? '#c9a96e' : '#666',
            fontWeight: tab === t.id ? 700 : 400,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '0 12px 12px 12px', border: '1px solid #2a2a2a', padding: 24, minHeight: 280 }}>

        {/* Trend */}
        {tab === 'overview' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Tendência 30 dias</h3>
            {a.trend_30d && a.trend_30d.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#666' }}>
                      <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 400 }}>Data</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#52b788' }}>Ganhos</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#e63946' }}>Perdidos</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.trend_30d.map(row => {
                      const total = row.wins + row.losses
                      const wr = total > 0 ? row.wins / total : 0
                      return (
                        <tr key={row.date} style={{ borderTop: '1px solid #222' }}>
                          <td style={{ padding: '8px 12px', color: '#888' }}>{row.date}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#52b788', fontWeight: 600 }}>{row.wins}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#e63946', fontWeight: 600 }}>{row.losses}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}><WinRateBadge rate={wr} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados de tendência disponíveis</div>
            )}
          </div>
        )}

        {/* Reasons */}
        {tab === 'reasons' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Razões de Vitória/Perda</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(a.by_reason ?? []).map(r => (
                <div key={r.reason} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 100px', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{r.is_win ? '✅' : '❌'}</span>
                    <span style={{ fontSize: 13, color: '#e8e0d0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.reason}</span>
                  </div>
                  <div>
                    <MiniBar value={r.count} max={maxReasonCount} color={r.is_win ? '#52b788' : '#e63946'} />
                  </div>
                  <div style={{ fontSize: 13, textAlign: 'right', color: '#888' }}>{r.count}x</div>
                  <div style={{ fontSize: 12, textAlign: 'right', color: '#c9a96e' }}>{formatEur(r.avg_gci)}</div>
                </div>
              ))}
              {!a.by_reason?.length && (
                <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem razões registadas para este período</div>
              )}
            </div>
          </div>
        )}

        {/* Agents */}
        {tab === 'agents' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Performance por Agente</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#666' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 400 }}>Agente</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#52b788' }}>Wins</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#e63946' }}>Losses</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Win Rate</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 400 }}>GCI</th>
                    <th style={{ padding: '6px 12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(a.by_agent ?? []).sort((x, y) => y.total_gci - x.total_gci).map(ag => (
                    <tr key={ag.agent_email} style={{ borderTop: '1px solid #222' }}>
                      <td style={{ padding: '10px 12px', color: '#e8e0d0' }}>
                        {ag.agent_email.split('@')[0]}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#52b788', fontWeight: 600 }}>{ag.wins}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#e63946' }}>{ag.losses}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}><WinRateBadge rate={ag.win_rate} /></td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#c9a96e', fontWeight: 600 }}>{formatEur(ag.total_gci)}</td>
                      <td style={{ padding: '10px 12px', width: 100 }}>
                        <MiniBar value={ag.total_gci} max={maxAgentGci} color="#c9a96e" />
                      </td>
                    </tr>
                  ))}
                  {!a.by_agent?.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#666' }}>Sem dados de agentes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Objections */}
        {tab === 'objections' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Top Objecções Registadas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {objections.length > 0 ? objections.map((obj, i) => (
                <div key={obj.category + i} style={{
                  border: '1px solid #2a2a2a', borderRadius: 10, padding: '14px 16px',
                  backgroundColor: '#111',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e8e0d0' }}>{obj.category}</span>
                      {obj.sub_category && (
                        <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>— {obj.sub_category}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#888', backgroundColor: '#222', borderRadius: 6, padding: '2px 8px' }}>
                        Score: {obj.frequency_score}
                      </span>
                      {obj.win_rate_when_handled != null && (
                        <WinRateBadge rate={obj.win_rate_when_handled} />
                      )}
                    </div>
                  </div>
                  {obj.best_response && (
                    <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5, borderTop: '1px solid #2a2a2a', paddingTop: 8, marginTop: 4 }}>
                      <span style={{ color: '#52b788', fontWeight: 600 }}>💬 Resposta: </span>
                      {obj.best_response}
                    </div>
                  )}
                </div>
              )) : (
                <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem objecções registadas</div>
              )}
            </div>

            {/* By stage losses */}
            {a.by_stage && a.by_stage.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 12 }}>PERDAS POR FASE</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {a.by_stage.map(s => (
                    <span key={s.lost_at_stage ?? 'unknown'} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12,
                      backgroundColor: '#2a2a2a', color: '#c9a96e', border: '1px solid #333',
                    }}>
                      {s.lost_at_stage ?? 'Desconhecido'} <strong>({s.count})</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
