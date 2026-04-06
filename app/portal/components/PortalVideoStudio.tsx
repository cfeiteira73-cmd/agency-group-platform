'use client'
import { useState } from 'react'
import { PropertyVideoCard, type PropertyVideoData } from '@/app/components/PropertyVideoCard'

// ─── Demo properties for the studio ──────────────────────────────────────────
// These are sample showcase properties. In production, wire to PORTAL_PROPERTIES
// or a real-time property list from the CRM.

const STUDIO_PROPERTIES: PropertyVideoData[] = [
  {
    title: 'Penthouse Chiado',
    zone: 'Lisboa',
    type: 'Apartamento',
    price: 1_850_000,
    area: 180,
    bedrooms: 3,
    features: ['terraço', 'vista rio', 'garagem', 'porteiro 24h'],
    description: 'Penthouse premium no coração do Chiado com acabamentos de excepção',
    rentalYield: 4.2,
  },
  {
    title: 'Villa Cascais Golf',
    zone: 'Cascais',
    type: 'Moradia',
    price: 3_200_000,
    area: 350,
    bedrooms: 5,
    features: ['piscina', 'jardim', 'golf resort', 'domótica', 'garagem tripla'],
    description: 'Villa de luxo inserida num golf resort premium em Cascais',
    rentalYield: 3.8,
  },
  {
    title: 'Penthouse Funchal',
    zone: 'Madeira',
    type: 'Apartamento',
    price: 1_200_000,
    area: 210,
    bedrooms: 3,
    features: ['terraço 80m²', 'vista oceano 270°', 'IFICI elegível', 'spa privado'],
    description: 'Penthouse de luxo no Funchal com vista oceano panorâmica',
    rentalYield: 5.0,
  },
  {
    title: 'Quinta Comporta',
    zone: 'Comporta',
    type: 'Moradia',
    price: 2_750_000,
    area: 420,
    bedrooms: 5,
    features: ['piscina infinita', 'arrozais', 'natureza preservada', 'arquitectura tipológica'],
    description: 'Quinta exclusiva na Comporta com design de arquitecto de renome',
    rentalYield: 4.8,
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function PortalVideoStudio() {
  const [selected, setSelected] = useState(0)

  return (
    <section
      className="space-y-6"
      aria-label="Studio de vídeos Sofia AI"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[#1c4a35] flex items-center gap-2">
            <span aria-hidden="true">🎬</span> Sofia AI Video Studio
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gere vídeos de apresentação personalizados por IA para cada imóvel
          </p>
        </div>
        <span className="bg-[#c9a96e]/10 text-[#c9a96e] text-xs font-bold px-3 py-1.5 rounded-full border border-[#c9a96e]/30 flex-shrink-0">
          HeyGen Business Required
        </span>
      </div>

      {/* Property selector tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Seleccionar imóvel"
      >
        {STUDIO_PROPERTIES.map((p, i) => (
          <button
            key={p.title}
            type="button"
            role="tab"
            aria-selected={selected === i}
            onClick={() => setSelected(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              selected === i
                ? 'bg-[#1c4a35] text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Property metadata summary */}
      <div className="bg-white rounded-xl border border-[#1c4a35]/10 p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider block mb-0.5">Zona</span>
          <span className="font-semibold text-[#1c4a35]">{STUDIO_PROPERTIES[selected].zone}</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider block mb-0.5">Tipo</span>
          <span className="font-semibold text-[#1c4a35]">{STUDIO_PROPERTIES[selected].type}</span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider block mb-0.5">Preço</span>
          <span className="font-semibold text-[#1c4a35]">
            €{STUDIO_PROPERTIES[selected].price.toLocaleString('pt-PT')}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider block mb-0.5">Área</span>
          <span className="font-semibold text-[#1c4a35]">
            {STUDIO_PROPERTIES[selected].area}m² · T{STUDIO_PROPERTIES[selected].bedrooms}
          </span>
        </div>
        {STUDIO_PROPERTIES[selected].rentalYield && (
          <div className="col-span-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider block mb-0.5">Yield estimado</span>
            <span className="font-semibold text-[#c9a96e]">
              {STUDIO_PROPERTIES[selected].rentalYield}%
            </span>
          </div>
        )}
      </div>

      {/* Video card — key forces full reset when property changes */}
      <PropertyVideoCard
        key={selected}
        property={STUDIO_PROPERTIES[selected]}
        showScriptPreview
      />

      {/* Setup instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-bold text-amber-800 mb-2">
          ⚙️ Activar HeyGen Sofia
        </p>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
          <li>Subscrever HeyGen Business Plan ($89/mês) em heygen.com</li>
          <li>Criar avatar Sofia — Studio → Avatars → Instant Avatar</li>
          <li>Copiar Avatar ID → Vercel Env: <code className="bg-amber-100 px-1 rounded">HEYGEN_AVATAR_ID</code></li>
          <li>Copiar API Key → Vercel Env: <code className="bg-amber-100 px-1 rounded">HEYGEN_API_KEY</code></li>
          <li>Escolher Voice ID português → Vercel Env: <code className="bg-amber-100 px-1 rounded">HEYGEN_VOICE_ID</code></li>
        </ol>
        <p className="text-xs text-amber-600 mt-2">
          Sem a API Key, o Studio funciona em modo <strong>script-only</strong> — Claude gera o guião mas não cria o vídeo.
        </p>
      </div>
    </section>
  )
}
