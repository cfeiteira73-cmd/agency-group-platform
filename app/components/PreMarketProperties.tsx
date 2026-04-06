'use client'
import { useState, useEffect } from 'react'

interface PremarketProperty {
  id: string
  title: string
  zone: string
  type: string
  price_min: number
  price_max: number
  area: number
  bedrooms: number
  description: string
  features: string[]
  available_from: string
  exclusive_until: string
  access_level: string
  agent_name: string
  agent_phone: string
  alerts_count: number
}

function formatPrice(n: number) {
  if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`
  return `€${(n / 1000).toFixed(0)}K`
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

export function PreMarketProperties() {
  const [properties, setProperties] = useState<PremarketProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [interestSent, setInterestSent] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/premarket', { signal: controller.signal })
      .then(r => r.json())
      .then((d: { properties?: PremarketProperty[] }) => setProperties(d.properties ?? []))
      .catch(() => { /* silently fail */ })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  async function registerInterest(propertyId: string) {
    try {
      await fetch('/api/premarket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          message: 'Interesse em ser contactado sobre esta propriedade',
        }),
      })
      setInterestSent(prev => ({ ...prev, [propertyId]: true }))
    } catch {
      // handle error silently — user can retry
    }
  }

  if (loading) return (
    <div className="grid md:grid-cols-2 gap-6">
      {[1, 2].map(i => (
        <div key={i} className="animate-pulse rounded-2xl bg-gray-100 h-64" />
      ))}
    </div>
  )

  if (!properties.length) return null

  return (
    <section aria-label="Propriedades exclusivas pré-mercado">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1c4a35]">
            Exclusivos Pré-Mercado
          </h2>
          <p className="text-sm text-gray-500 mt-1">Acesso antecipado antes de irem a público</p>
        </div>
        <span className="bg-[#c9a96e] text-white text-xs font-bold px-3 py-1.5 rounded-full">
          {properties.length} disponíveis
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {properties.map(property => {
          const days = daysUntil(property.exclusive_until)
          const isVIP = property.access_level === 'vip'

          return (
            <article
              key={property.id}
              className={`relative rounded-2xl overflow-hidden border-2 transition-all hover:shadow-xl ${
                isVIP ? 'border-[#c9a96e]' : 'border-gray-100 hover:border-[#1c4a35]'
              }`}
            >
              {/* Header gradient */}
              <div className={`relative h-36 ${isVIP ? 'bg-gradient-to-br from-[#c9a96e] to-[#a8843a]' : 'bg-gradient-to-br from-[#1c4a35] to-[#2d6b4f]'} p-5`}>
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3">
                  {isVIP && (
                    <span className="bg-white text-[#c9a96e] text-xs font-bold px-2 py-0.5 rounded-full">
                      ★ VIP EXCLUSIVO
                    </span>
                  )}
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {property.type}
                  </span>
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {property.zone}
                  </span>
                </div>

                <h3 className="text-white font-bold text-base leading-tight">{property.title}</h3>

                {/* Price range */}
                <p className="text-white/90 text-sm mt-1">
                  {formatPrice(property.price_min)} – {formatPrice(property.price_max)}
                </p>

                {/* Countdown */}
                {days <= 30 && (
                  <div className="absolute top-4 right-4 text-center">
                    <div className="text-white font-bold text-xl">{days}</div>
                    <div className="text-white/70 text-xs">dias</div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="bg-white p-5">
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{property.description}</p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span>{property.bedrooms} quartos</span>
                  <span>{property.area}m²</span>
                  <span className="text-[#c9a96e] font-semibold">{property.alerts_count} interessados</span>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {property.features.slice(0, 4).map(f => (
                    <span key={f} className="text-xs bg-[#f4f0e6] text-[#1c4a35] px-2 py-0.5 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                {interestSent[property.id] ? (
                  <div className="text-center py-2 text-sm text-green-700 font-semibold">
                    ✓ Interesse registado — contacto em 24h
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => registerInterest(property.id)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      isVIP
                        ? 'bg-[#c9a96e] text-white hover:bg-[#a8843a]'
                        : 'bg-[#1c4a35] text-white hover:bg-[#2d6b4f]'
                    }`}
                  >
                    Tenho Interesse — Ser Contactado
                  </button>
                )}

                <p className="text-xs text-gray-400 text-center mt-2">
                  Exclusivo até {new Date(property.exclusive_until).toLocaleDateString('pt-PT')} · {property.agent_name}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
