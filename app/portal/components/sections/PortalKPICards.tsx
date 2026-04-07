'use client'

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

export function PortalKPICards({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true" aria-label="A carregar KPIs">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <div key={i} className={`rounded-xl p-4 border ${kpi.color}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl" aria-hidden="true">{kpi.icon}</span>
            {kpi.change && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                kpi.changeType === 'positive' ? 'bg-green-100 text-green-700' :
                kpi.changeType === 'negative' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {kpi.change}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
        </div>
      ))}
    </div>
  )
}
