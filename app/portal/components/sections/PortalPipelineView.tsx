'use client'

interface Deal {
  id: string
  title: string
  contact_name: string
  valor: number
  stage: string
  lead_score?: number
  last_activity_at?: string
}

interface Props {
  deals: Deal[]
  onDealClick?: (deal: Deal) => void
  loading?: boolean
}

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-gray-100 border-gray-300' },
  { key: 'qualified', label: 'Qualificado', color: 'bg-blue-50 border-blue-200' },
  { key: 'visita', label: 'Visita', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'proposta', label: 'Proposta', color: 'bg-orange-50 border-orange-200' },
  { key: 'cpcv', label: 'CPCV', color: 'bg-purple-50 border-purple-200' },
  { key: 'escritura', label: 'Escritura', color: 'bg-green-50 border-green-200' },
]

export function PortalPipelineView({ deals, onDealClick, loading }: Props) {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4" aria-busy="true">
        {STAGES.map(s => (
          <div key={s.key} className="flex-shrink-0 w-48 h-64 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const dealsByStage = STAGES.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage.key] = deals.filter(d => d.stage === stage.key)
    return acc
  }, {})

  const formatPrice = (v: number) => v >= 1_000_000
    ? `€${(v / 1_000_000).toFixed(1)}M`
    : `€${(v / 1_000).toFixed(0)}K`

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4" role="list" aria-label="Pipeline de negócios">
      {STAGES.map(stage => {
        const stageDeals = dealsByStage[stage.key] || []
        const stageValue = stageDeals.reduce((sum, d) => sum + (d.valor || 0), 0)

        return (
          <div key={stage.key} className={`flex-shrink-0 w-56 rounded-xl border ${stage.color} p-3`} role="listitem">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-700">{stage.label}</h3>
              <div className="flex items-center gap-1">
                <span className="text-xs bg-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-gray-600 border">
                  {stageDeals.length}
                </span>
              </div>
            </div>
            {stageValue > 0 && (
              <p className="text-xs text-gray-500 mb-2">{formatPrice(stageValue)}</p>
            )}
            <div className="space-y-2">
              {stageDeals.slice(0, 5).map(deal => (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => onDealClick?.(deal)}
                  className="w-full text-left bg-white rounded-lg p-2.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-[#1c4a35] focus-visible:outline-offset-2"
                  aria-label={`Deal: ${deal.title}, ${deal.contact_name}`}
                >
                  <p className="text-xs font-semibold text-gray-800 truncate">{deal.title}</p>
                  <p className="text-xs text-gray-500 truncate">{deal.contact_name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs font-bold text-[#1c4a35]">{formatPrice(deal.valor || 0)}</p>
                    {deal.lead_score != null && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        deal.lead_score >= 70 ? 'bg-green-100 text-green-700' :
                        deal.lead_score >= 45 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {deal.lead_score}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {stageDeals.length > 5 && (
                <p className="text-xs text-center text-gray-400">+{stageDeals.length - 5} mais</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
