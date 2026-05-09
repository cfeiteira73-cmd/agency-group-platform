'use client'
// =============================================================================
// Agency Group — Feature Adoption Analytics Page
// app/portal/analytics/adoption/page.tsx
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureStat {
  feature:          string
  label:            string
  total_events:     number
  unique_users:     number
  adoption_score:   number
  last_used:        string | null
}

interface UserAdoptionStat {
  user_email:       string
  total_events:     number
  features_used:    number
  adoption_score:   number
  last_active:      string | null
}

interface AdoptionAnalytics {
  period_days:       number
  overall_adoption:  number
  active_users:      number
  core_features:     number
  feature_stats:     FeatureStat[]
  user_stats:        UserAdoptionStat[]
  trend:             Array<{ date: string; events: number; unique_users: number }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function AdoptionRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#52b788' : score >= 50 ? '#c9a96e' : score >= 25 ? '#e07b39' : '#e63946'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2a2a2a" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
        fill={color} fontSize={size * 0.22} fontWeight={700}>{score.toFixed(0)}</text>
    </svg>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#52b788' : score >= 50 ? '#c9a96e' : score >= 25 ? '#e07b39' : '#e63946'
  const label = score >= 75 ? 'Alto' : score >= 50 ? 'Médio' : score >= 25 ? 'Baixo' : 'Crítico'
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      backgroundColor: color + '22', color, border: `1px solid ${color}44`,
    }}>{label}</span>
  )
}

function MiniBar({ value, color = '#c9a96e' }: { value: number; color?: string }) {
  return (
    <div style={{ width: '100%', height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdoptionPage() {
  const [data, setData] = useState<AdoptionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<30 | 60 | 90>(30)
  const [tab, setTab] = useState<'features' | 'users' | 'trend'>('features')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/adoption?days=${period}`)
      if (!res.ok) throw new Error('Erro ao carregar adoption analytics')
      const json = await res.json()
      setData(json)
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
        <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
        <div>A carregar Adoption Analytics...</div>
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

  const d = data!

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>Feature Adoption</h1>
        <p style={{ color: '#888', margin: '4px 0 16px', fontSize: 14 }}>Utilização do sistema por agente e funcionalidade</p>

        <div style={{ display: 'flex', gap: 8 }}>
          {([30, 60, 90] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: period === p ? 700 : 400,
              backgroundColor: period === p ? '#c9a96e22' : 'transparent',
              border: `1px solid ${period === p ? '#c9a96e' : '#333'}`,
              color: period === p ? '#c9a96e' : '#888',
            }}>{p}d</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: '20px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 16 }}>
          <AdoptionRing score={d.overall_adoption} size={64} />
          <div>
            <div style={{ fontSize: 13, color: '#888' }}>Adoption Score</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Score global da equipa</div>
          </div>
        </div>
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: '20px', border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#c9a96e' }}>{d.active_users}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Utilizadores Activos</div>
          <div style={{ fontSize: 11, color: '#666' }}>nos últimos {d.period_days} dias</div>
        </div>
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: '20px', border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#52b788' }}>{d.core_features}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Core Features</div>
          <div style={{ fontSize: 11, color: '#666' }}>funcionalidades monitorizadas</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2a2a2a', paddingBottom: 0 }}>
        {([
          { id: 'features', label: '🔧 Funcionalidades' },
          { id: 'users', label: '👥 Utilizadores' },
          { id: 'trend', label: '📊 Tendência' },
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

      <div style={{ backgroundColor: '#1a1a1a', borderRadius: '0 12px 12px 12px', border: '1px solid #2a2a2a', padding: 24, minHeight: 280 }}>

        {/* Features */}
        {tab === 'features' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>
              Adoption por Funcionalidade
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(d.feature_stats ?? []).sort((a, b) => b.adoption_score - a.adoption_score).map(f => (
                <div key={f.feature} style={{ display: 'grid', gridTemplateColumns: '180px 60px 1fr 80px 80px', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#e8e0d0', fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>{f.feature}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <AdoptionRing score={f.adoption_score} size={40} />
                  </div>
                  <div>
                    <MiniBar value={f.adoption_score} color={f.adoption_score >= 75 ? '#52b788' : f.adoption_score >= 50 ? '#c9a96e' : '#e07b39'} />
                  </div>
                  <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>{f.unique_users} users</div>
                  <div style={{ textAlign: 'right' }}><ScoreBadge score={f.adoption_score} /></div>
                </div>
              ))}
              {!d.feature_stats?.length && (
                <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados de features disponíveis</div>
              )}
            </div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>
              Adoption por Utilizador
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#666' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 400 }}>Agente</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Score</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Features</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Eventos</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Última Actividade</th>
                    <th style={{ padding: '6px 12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(d.user_stats ?? []).sort((a, b) => b.adoption_score - a.adoption_score).map(u => (
                    <tr key={u.user_email} style={{ borderTop: '1px solid #222' }}>
                      <td style={{ padding: '10px 12px', color: '#e8e0d0' }}>{u.user_email.split('@')[0]}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <AdoptionRing score={u.adoption_score} size={36} />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#c9a96e', fontWeight: 600 }}>{u.features_used}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#888' }}>{u.total_events}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                        {u.last_active ? new Date(u.last_active).toLocaleDateString('pt-PT') : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}><ScoreBadge score={u.adoption_score} /></td>
                    </tr>
                  ))}
                  {!d.user_stats?.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#666' }}>Sem dados de utilizadores</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trend */}
        {tab === 'trend' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>
              Tendência de Utilização
            </h3>
            {d.trend && d.trend.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#666' }}>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 400 }}>Data</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Eventos</th>
                    <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Utilizadores únicos</th>
                  </tr>
                </thead>
                <tbody>
                  {d.trend.map(row => (
                    <tr key={row.date} style={{ borderTop: '1px solid #222' }}>
                      <td style={{ padding: '8px 12px', color: '#888' }}>{row.date}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#c9a96e', fontWeight: 600 }}>{row.events}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#52b788' }}>{row.unique_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados de tendência disponíveis</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
