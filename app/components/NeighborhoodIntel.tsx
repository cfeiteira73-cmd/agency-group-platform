'use client'
import { useState, useEffect } from 'react'

interface NeighborhoodData {
  zone: string
  area: string
  scores: Record<string, number>
  highlights: string[]
  schools: Array<{ name: string; type: string; rating: string; distance: string }>
  restaurants: Array<{ name: string; cuisine: string; michelin?: boolean; distance: string }>
  transport: Array<{ type: string; name: string; walkTime: string }>
  safetyIndex: string
  walkTime: Record<string, string>
  bestFor: string[]
  notIdealFor: string[]
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg w-6 text-center" aria-hidden="true">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-[#1c4a35]">{label}</span>
          <span className="text-xs font-bold text-[#c9a96e]">{score}/100</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1c4a35] to-[#c9a96e] rounded-full transition-all duration-700"
            style={{ width: `${score}%` }}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label}: ${score} de 100`}
          />
        </div>
      </div>
    </div>
  )
}

interface Props {
  area: string
  zone: string
}

export function NeighborhoodIntel({ area, zone }: Props) {
  const [data, setData] = useState<NeighborhoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'scores' | 'schools' | 'restaurants' | 'transport'>('scores')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/neighborhood?area=${encodeURIComponent(area)}&zone=${encodeURIComponent(zone)}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [area, zone])

  if (loading) return (
    <div className="animate-pulse space-y-3 p-6">
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-2 bg-gray-100 rounded" />
      <div className="h-2 bg-gray-100 rounded w-5/6" />
    </div>
  )
  if (!data) return null

  const scoreItems = [
    { key: 'overall', label: 'Score Global', icon: '🏆' },
    { key: 'walkability', label: 'Walkability', icon: '🚶' },
    { key: 'transport', label: 'Transportes', icon: '🚇' },
    { key: 'schools', label: 'Escolas', icon: '🎓' },
    { key: 'restaurants', label: 'Restaurantes', icon: '🍽️' },
    { key: 'safety', label: 'Segurança', icon: '🛡️' },
    { key: 'greenSpaces', label: 'Natureza', icon: '🌿' },
    { key: 'beach', label: 'Praia', icon: '🏖️' },
  ]

  const tabs = [
    { id: 'scores' as const, label: 'Scores' },
    { id: 'schools' as const, label: 'Escolas' },
    { id: 'restaurants' as const, label: 'Restaurantes' },
    { id: 'transport' as const, label: 'Transportes' },
  ]

  return (
    <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden" aria-label={`Informações sobre ${data.area}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1c4a35] to-[#2d6b4f] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">{data.area}</h2>
            <p className="text-white/70 text-sm">{data.zone} · Neighborhood Intelligence</p>
          </div>
          <div className="text-center">
            <div className="text-[#c9a96e] text-3xl font-bold">{data.scores.overall}</div>
            <div className="text-white/60 text-xs">/ 100</div>
          </div>
        </div>

        {/* Highlights */}
        <div className="mt-3 flex flex-wrap gap-1">
          {data.highlights.slice(0, 2).map(h => (
            <span key={h} className="text-xs bg-white/10 text-white/90 px-2 py-0.5 rounded-full">{h}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'text-[#c9a96e] border-b-2 border-[#c9a96e]'
                : 'text-gray-400 hover:text-[#1c4a35]'
            }`}
            aria-selected={tab === t.id}
            role="tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === 'scores' && (
          <div className="space-y-3">
            {scoreItems.map(({ key, label, icon }) => (
              <ScoreBar key={key} label={label} score={data.scores[key] ?? 0} icon={icon} />
            ))}

            {/* Safety badge */}
            <div className="mt-4 flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
              <span aria-hidden="true">🛡️</span>
              <span className="text-sm text-green-700 font-medium">{data.safetyIndex}</span>
            </div>
          </div>
        )}

        {tab === 'schools' && (
          <div className="space-y-3">
            {data.schools.map(school => (
              <div key={school.name} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-[#1c4a35]">{school.name}</p>
                  <p className="text-xs text-gray-500">{school.type}</p>
                  <p className="text-xs text-[#c9a96e] mt-0.5">{school.rating}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{school.distance}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'restaurants' && (
          <div className="space-y-3">
            {data.restaurants.map(r => (
              <div key={r.name} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1c4a35]">{r.name}</p>
                    {r.michelin && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">★ Michelin</span>}
                  </div>
                  <p className="text-xs text-gray-500">{r.cuisine}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{r.distance}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'transport' && (
          <div className="space-y-3">
            {data.transport.map(t => (
              <div key={t.name} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white bg-[#1c4a35] px-2 py-0.5 rounded">{t.type}</span>
                  <span className="text-xs text-[#c9a96e] font-semibold">{t.walkTime} a pé</span>
                </div>
                <p className="text-xs text-gray-600">{t.name}</p>
              </div>
            ))}

            {/* Walk times */}
            <div className="mt-3">
              <p className="text-xs font-semibold text-[#1c4a35] mb-2">Distâncias chave</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.walkTime).map(([dest, time]) => (
                  <div key={dest} className="text-xs">
                    <span className="text-gray-500">{dest}:</span>
                    <span className="text-[#c9a96e] font-medium ml-1">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Best/Not ideal for */}
        <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold text-green-700 mb-1">✓ Ideal para</p>
            {data.bestFor.slice(0, 2).map(b => (
              <p key={b} className="text-xs text-gray-500">• {b}</p>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-orange-600 mb-1">⚠ Menos ideal para</p>
            {data.notIdealFor.slice(0, 2).map(n => (
              <p key={n} className="text-xs text-gray-500">• {n}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
