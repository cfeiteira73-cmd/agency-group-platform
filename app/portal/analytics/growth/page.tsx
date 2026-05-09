'use client'
// =============================================================================
// Agency Group — Growth Machine Analytics Page
// app/portal/analytics/growth/page.tsx
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { GrowthAnalytics } from '@/lib/commercial/growth'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNum(n: number) {
  return new Intl.NumberFormat('pt-PT').format(n)
}

function formatEur(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function MiniBar({ value, max, color = '#c9a96e' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ width: '100%', height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </div>
  )
}

function KPICard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      borderRadius: 12,
      padding: '16px 20px',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const [analytics, setAnalytics] = useState<GrowthAnalytics | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [period, setPeriod]       = useState<30 | 60 | 90 | 180>(90)
  const [tab, setTab]             = useState<'referrers' | 'sources' | 'trend'>('referrers')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/growth?days=${period}`)
      if (!res.ok) throw new Error('Erro ao carregar Growth Analytics')
      const data = (await res.json()) as GrowthAnalytics
      setAnalytics(data)
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
        <div>A carregar Growth Machine...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: 32, color: '#e63946', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
      <div>{error}</div>
      <button
        onClick={load}
        style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid #e63946', background: 'none', color: '#e63946', cursor: 'pointer' }}
      >
        Tentar novamente
      </button>
    </div>
  )

  const a = analytics!
  const kCoeff = a.viral_coefficient.toFixed(3)
  const maxReferrals   = Math.max(...(a.top_referrers ?? []).map(r => r.referrals), 1)
  const maxSourceCount = Math.max(...(a.source_breakdown ?? []).map(s => s.count), 1)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>Growth Machine</h1>
        <p style={{ color: '#888', margin: '4px 0 16px', fontSize: 14 }}>Referrals · Viral Coefficient · CAC/LTV · Fontes de crescimento</p>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KPICard label="Novos Leads"   value={formatNum(a.new_leads)}    icon="🎯" color="#c9a96e" />
        <KPICard label="Novos Clientes" value={formatNum(a.new_clients)}  icon="🤝" color="#52b788" />
        <KPICard label="Referrals"      value={formatNum(a.referral_count)} icon="🔗" color="#c9a96e" />
        <KPICard
          label="K-Factor"
          value={kCoeff}
          icon="📡"
          color={a.viral_coefficient >= 1 ? '#52b788' : a.viral_coefficient >= 0.5 ? '#c9a96e' : '#e63946'}
        />
        <KPICard label="CAC Médio"      value={a.cac_avg > 0 ? formatEur(a.cac_avg) : '—'} icon="💸" color="#c9a96e" />
        <KPICard label="LTV Médio"      value={a.ltv_avg > 0 ? formatEur(a.ltv_avg) : '—'} icon="💰" color="#52b788" />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2a2a2a', paddingBottom: 0 }}>
        {([
          { id: 'referrers', label: '🔗 Referrers' },
          { id: 'sources',   label: '📊 Fontes' },
          { id: 'trend',     label: '📅 Tendência' },
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

        {/* Referrers */}
        {tab === 'referrers' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Top Referrers</h3>
            {a.top_referrers && a.top_referrers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#666' }}>
                      <th style={{ textAlign: 'left',   padding: '6px 12px', fontWeight: 400 }}>#</th>
                      <th style={{ textAlign: 'left',   padding: '6px 12px', fontWeight: 400 }}>Email</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#c9a96e' }}>Referrals</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#52b788' }}>Deals</th>
                      <th style={{ padding: '6px 12px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.top_referrers.map((r, i) => (
                      <tr key={r.email} style={{ borderTop: '1px solid #222' }}>
                        <td style={{ padding: '10px 12px', color: '#555', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', color: '#e8e0d0' }}>{r.email}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#c9a96e', fontWeight: 700 }}>{r.referrals}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#52b788', fontWeight: 600 }}>{r.deals_generated}</td>
                        <td style={{ padding: '10px 12px', width: 120 }}>
                          <MiniBar value={r.referrals} max={maxReferrals} color="#c9a96e" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem referrals registados para este período</div>
            )}
          </div>
        )}

        {/* Sources */}
        {tab === 'sources' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Breakdown por Fonte</h3>
            {a.source_breakdown && a.source_breakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {a.source_breakdown.map(s => {
                  const pct = maxSourceCount > 0 ? Math.round((s.count / maxSourceCount) * 100) : 0
                  return (
                    <div key={s.source}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                        <span style={{ color: '#e8e0d0', textTransform: 'capitalize', fontWeight: 500 }}>{s.source}</span>
                        <span style={{ display: 'flex', gap: 16, color: '#888' }}>
                          <span style={{ color: '#c9a96e', fontWeight: 700 }}>{s.count} leads</span>
                          <span>{pct}%</span>
                          {s.conversion_rate > 0 && (
                            <span style={{ color: '#52b788' }}>→ {(s.conversion_rate * 100).toFixed(0)}% conv.</span>
                          )}
                        </span>
                      </div>
                      <MiniBar value={s.count} max={maxSourceCount} color="#c9a96e" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados de fonte disponíveis para este período</div>
            )}
          </div>
        )}

        {/* Weekly Trend */}
        {tab === 'trend' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e0d0', marginTop: 0, marginBottom: 20 }}>Tendência Semanal</h3>
            {a.weekly_trend && a.weekly_trend.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#666' }}>
                      <th style={{ textAlign: 'left',   padding: '6px 12px', fontWeight: 400 }}>Semana</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#c9a96e' }}>Novos Leads</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400, color: '#52b788' }}>Referrals</th>
                      <th style={{ textAlign: 'center', padding: '6px 12px', fontWeight: 400 }}>Clientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.weekly_trend.map(row => (
                      <tr key={row.week} style={{ borderTop: '1px solid #222' }}>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{row.week}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#c9a96e', fontWeight: 600 }}>{row.new_leads}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#52b788', fontWeight: 600 }}>{row.referrals}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#e8e0d0' }}>{row.clients}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Sem dados de tendência semanal disponíveis</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
