'use client'
// =============================================================================
// Agency Group — Financial Intelligence Page
// app/portal/analytics/financial/page.tsx
// P&L · Pipeline · Forecast
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancialData {
  period: string
  since: string
  until: string
  revenue_eur: number
  deals_closed: number
  avg_deal_value: number
  win_rate: number | null
  pipeline_value: number
  forecast_next_period: number
  forecast_basis: string
  wins: number
  losses: number
  generated: string
}

type Period = 'month' | 'quarter' | 'year'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function StatCard({
  label,
  value,
  sub,
  color = '#c9a96e',
  badge,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  badge?: string
}) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      borderRadius: 12,
      padding: '20px 24px',
      border: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
        {badge && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 8,
            padding: '2px 8px',
            borderRadius: 99,
            backgroundColor: '#c9a96e22',
            color: '#c9a96e',
            border: '1px solid #c9a96e44',
            verticalAlign: 'middle',
          }}>{badge}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#555' }}>{sub}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinancialPage() {
  const [data, setData]       = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [period, setPeriod]   = useState<Period>('month')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/financial?period=${period}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json() as FinancialData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { void load() }, [load])

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'month',   label: 'Mês' },
    { key: 'quarter', label: 'Trimestre' },
    { key: 'year',    label: 'Ano' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f0f0f',
      color: '#e8e0d0',
      fontFamily: 'system-ui, sans-serif',
      padding: '24px 20px',
    }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#c9a96e', margin: 0 }}>
          Financial Intelligence
        </h1>
        <p style={{ color: '#666', margin: '4px 0 20px', fontSize: 14 }}>
          P&amp;L · Pipeline · Forecast
        </p>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '7px 20px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: period === p.key ? 700 : 400,
                backgroundColor: period === p.key ? '#c9a96e22' : 'transparent',
                border: `1px solid ${period === p.key ? '#c9a96e' : '#333'}`,
                color: period === p.key ? '#c9a96e' : '#666',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: '#555' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8, color: '#c9a96e' }}>◎</div>
            <div style={{ fontSize: 14 }}>A carregar dados financeiros...</div>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ padding: 32, color: '#e63946', textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>Erro ao carregar</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{error}</div>
          <button
            type="button"
            onClick={load}
            style={{
              padding: '8px 24px', borderRadius: 8, border: '1px solid #e63946',
              background: 'none', color: '#e63946', cursor: 'pointer', fontSize: 13,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <>
          {/* KPI Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 28,
          }}>
            <StatCard
              label="Revenue (GCI)"
              value={formatEur(data.revenue_eur)}
              sub="Comissão líquida recebida"
              color="#c9a96e"
            />
            <StatCard
              label="Deals Fechados"
              value={String(data.deals_closed)}
              sub="Escritura + Pós-venda"
              color="#52b788"
            />
            <StatCard
              label="Valor Médio Deal"
              value={formatEur(data.avg_deal_value)}
              sub="Imóvel médio fechado"
              color="#c9a96e"
            />
            <StatCard
              label="Win Rate"
              value={data.win_rate !== null ? `${data.win_rate}%` : '—'}
              sub={`${data.wins}W / ${data.losses}L`}
              color={
                data.win_rate === null ? '#555'
                  : data.win_rate >= 70 ? '#52b788'
                  : data.win_rate >= 50 ? '#c9a96e'
                  : '#e63946'
              }
            />
            <StatCard
              label="Pipeline Value"
              value={formatEur(data.pipeline_value)}
              sub="Deals activos × 5% × prob. 50%"
              color="#c9a96e"
            />
            <StatCard
              label="Forecast Próximo Período"
              value={formatEur(data.forecast_next_period)}
              sub={data.forecast_basis}
              color="#c9a96e"
              badge="Estimativa"
            />
          </div>

          {/* Forecast section */}
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            border: '1px solid #2a2a2a',
            padding: '24px 28px',
            marginBottom: 24,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#c9a96e', margin: '0 0 12px' }}>
              Projecção Financeira
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Base (Actual)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e8e0d0' }}>
                  {formatEur(data.revenue_eur)}
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#52b788', fontSize: 24, fontWeight: 300,
              }}>
                +10%
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Forecast ★ Estimativa
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#c9a96e' }}>
                  {formatEur(data.forecast_next_period)}
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              backgroundColor: '#111',
              borderRadius: 8,
              border: '1px solid #222',
              fontSize: 12,
              color: '#555',
              lineHeight: 1.6,
            }}>
              <strong style={{ color: '#666' }}>Metodologia: </strong>
              Esta projecção assume crescimento constante de 10% face ao período actual. Não constitui garantia de resultados.
              Pipeline actual de {formatEur(data.pipeline_value)} não está incluído no cálculo base.
            </div>
          </div>

          {/* Meta */}
          <div style={{ fontSize: 11, color: '#333', textAlign: 'right' }}>
            Gerado: {new Date(data.generated).toLocaleString('pt-PT')} · Período: {data.period}
          </div>
        </>
      )}
    </div>
  )
}
