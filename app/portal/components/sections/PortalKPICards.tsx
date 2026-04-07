'use client'

import type { CSSProperties } from 'react'

interface KPIData {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: string
  color: string
}

interface Props {
  kpis: KPIData[]
  loading?: boolean
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
}

const skeletonStyle: CSSProperties = {
  height: 96,
  background: 'rgba(12,31,21,0.06)',
  borderRadius: 12,
  animation: 'pulse 1.5s ease-in-out infinite',
}

function badgeStyle(changeType?: 'positive' | 'negative' | 'neutral'): CSSProperties {
  if (changeType === 'positive') {
    return {
      fontSize: '0.75rem',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 999,
      background: 'rgba(22,163,74,0.12)',
      color: '#16a34a',
    }
  }
  if (changeType === 'negative') {
    return {
      fontSize: '0.75rem',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 999,
      background: 'rgba(220,38,38,0.12)',
      color: '#dc2626',
    }
  }
  return {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(12,31,21,0.06)',
    color: 'rgba(14,14,13,0.5)',
  }
}

export function PortalKPICards({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div style={gridStyle} aria-busy="true" aria-label="A carregar KPIs">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={skeletonStyle} />
        ))}
      </div>
    )
  }

  return (
    <div style={gridStyle}>
      {kpis.map((kpi, i) => (
        <div
          key={i}
          style={{
            borderRadius: 12,
            padding: 16,
            background: '#f4f0e6',
            border: `1px solid ${kpi.color}33`,
            boxShadow: '0 2px 8px rgba(12,31,21,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{kpi.icon}</span>
            {kpi.change && (
              <span style={badgeStyle(kpi.changeType)}>
                {kpi.change}
              </span>
            )}
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0e0e0d', margin: 0 }}>{kpi.value}</p>
          <p style={{ fontSize: '0.875rem', color: 'rgba(14,14,13,0.5)', marginTop: 4, marginBottom: 0 }}>{kpi.label}</p>
        </div>
      ))}
    </div>
  )
}
