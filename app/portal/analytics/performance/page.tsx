'use client'
// =============================================================================
// Agency Group — Performance Leaderboard Page
// app/portal/analytics/performance/page.tsx
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  agent_email:        string
  agent_name?:        string
  period:             string
  period_type:        'weekly' | 'monthly' | 'quarterly'
  deals_closed:       number
  deals_in_pipeline:  number
  gci_net:            number
  pipeline_value:     number
  win_rate:           number
  avg_days_to_close:  number
  calls_made?:        number
  emails_sent?:       number
  visits_conducted?:  number
  nps_score?:         number
  rank:               number
  rank_delta?:        number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n.toFixed(0)}`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 20 }}>🥇</span>
  if (rank === 2) return <span style={{ fontSize: 20 }}>🥈</span>
  if (rank === 3) return <span style={{ fontSize: 20 }}>🥉</span>
  return <span style={{ color: '#555', fontSize: 14, fontWeight: 700 }}>#{rank}</span>
}

function RankDelta({ delta }: { delta?: number }) {
  if (!delta) return null
  const color = delta > 0 ? '#52b788' : '#e63946'
  const arrow = delta > 0 ? '↑' : '↓'
  return <span style={{ color, fontSize: 11, marginLeft: 4 }}>{arrow}{Math.abs(delta)}</span>
}

function WinRateMini({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(0)
  const color = rate >= 0.7 ? '#52b788' : rate >= 0.5 ? '#c9a96e' : '#e63946'
  return <span style={{ color, fontWeight: 700 }}>{pct}%</span>
}

function GciBar({ value, max }: { value: number; max: number }) {
  const color = value / max >= 0.8 ? '#52b788' : value / max >= 0.5 ? '#c9a96e' : '#888'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 12, color, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatEur(value)}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly')
  const [sortKey, setSortKey] = useState<keyof LeaderboardEntry>('gci_net')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/leaderboard?period_type=${periodType}`)
      if (!res.ok) throw new Error('Erro ao carregar leaderboard')
      const json = await res.json()
      setData(json.leaderboard ?? json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [periodType])

  useEffect(() => { void load() }, [load])

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return typeof av === 'number' && typeof bv === 'number' ? bv - av : 0
  })

  const maxGci = Math.max(...data.map(d => d.gci_net ?? 0), 1)
  const totalGci = data.reduce((s, d) => s + (d.gci_net ?? 0), 0)
  const avgWinRate = data.length ? data.reduce((s, d) => s + (d.win_rate ?? 0), 0) / data.length : 0
  const totalDeals = data.reduce((s, d) => s + (d.deals_closed ?? 0), 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#888' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
        <div>A carregar Leaderboard...</div>
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>Performance Leaderboard</h1>
        <p style={{ color: '#888', margin: '4px 0 16px', fontSize: 14 }}>Ranking e scorecard da equipa · Transparência radical</p>

        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { id: 'weekly', label: 'Semana' },
            { id: 'monthly', label: 'Mês' },
            { id: 'quarterly', label: 'Trimestre' },
          ] as const).map(p => (
            <button key={p.id} onClick={() => setPeriodType(p.id)} style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: periodType === p.id ? 700 : 400,
              backgroundColor: periodType === p.id ? '#c9a96e22' : 'transparent',
              border: `1px solid ${periodType === p.id ? '#c9a96e' : '#333'}`,
              color: periodType === p.id ? '#c9a96e' : '#888',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'GCI Total Equipa', value: formatEur(totalGci), icon: '💰', color: '#c9a96e' },
          { label: 'Deals Fechados', value: totalDeals, icon: '✅', color: '#52b788' },
          { label: 'Win Rate Médio', value: `${(avgWinRate * 100).toFixed(1)}%`, icon: '🎯', color: '#c9a96e' },
          { label: 'Agentes Activos', value: data.length, icon: '👤', color: '#52b788' },
        ].map(c => (
          <div key={c.label} style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: '16px 20px', border: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Podium — top 3 */}
      {sorted.length >= 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          {[sorted[1], sorted[0], sorted[2]].map((agent, idx) => {
            const heights = [140, 170, 120]
            const medals = ['🥈', '🥇', '🥉']
            return (
              <div key={agent.agent_email} style={{
                backgroundColor: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a',
                padding: '20px 16px', textAlign: 'center',
                borderTop: idx === 1 ? '3px solid #c9a96e' : '3px solid #333',
                marginTop: idx === 1 ? 0 : 30,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{medals[idx]}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e0d0', marginBottom: 4 }}>
                  {(agent.agent_name ?? agent.agent_email.split('@')[0])}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#c9a96e', marginBottom: 4 }}>{formatEur(agent.gci_net)}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {agent.deals_closed} deals · {(agent.win_rate * 100).toFixed(0)}% win
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e8e0d0' }}>Ranking Completo</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#666' }}>Ordenar por:</span>
            {([
              { key: 'gci_net', label: 'GCI' },
              { key: 'deals_closed', label: 'Deals' },
              { key: 'win_rate', label: 'Win Rate' },
            ] as const).map(s => (
              <button key={s.key} onClick={() => setSortKey(s.key as keyof LeaderboardEntry)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                backgroundColor: sortKey === s.key ? '#c9a96e22' : 'transparent',
                border: `1px solid ${sortKey === s.key ? '#c9a96e' : '#333'}`,
                color: sortKey === s.key ? '#c9a96e' : '#666',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#111', color: '#555' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, width: 50 }}>#</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Agente</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>GCI</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500 }}>Deals</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500 }}>Win Rate</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500 }}>Pipeline</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500 }}>Dias Ciclo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 500 }}>NPS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent, idx) => (
                <tr key={agent.agent_email} style={{
                  borderTop: '1px solid #222',
                  backgroundColor: idx === 0 ? '#c9a96e08' : 'transparent',
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <RankBadge rank={idx + 1} />
                      <RankDelta delta={agent.rank_delta} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#e8e0d0', fontWeight: idx === 0 ? 700 : 400 }}>
                    {agent.agent_name ?? agent.agent_email.split('@')[0]}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <GciBar value={agent.gci_net ?? 0} max={maxGci} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#52b788', fontWeight: 600 }}>
                    {agent.deals_closed ?? 0}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <WinRateMini rate={agent.win_rate ?? 0} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#888' }}>
                    {formatEur(agent.pipeline_value ?? 0)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#888' }}>
                    {agent.avg_days_to_close ? `${agent.avg_days_to_close.toFixed(0)}d` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {agent.nps_score != null ? (
                      <span style={{ color: agent.nps_score >= 50 ? '#52b788' : agent.nps_score >= 0 ? '#c9a96e' : '#e63946', fontWeight: 600 }}>
                        {agent.nps_score}
                      </span>
                    ) : <span style={{ color: '#444' }}>—</span>}
                  </td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                    Sem dados de performance para este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
