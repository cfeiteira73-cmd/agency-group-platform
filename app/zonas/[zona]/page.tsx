import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ZonaClient from './ZonaClient'

interface ZoneData {
  nome: string
  nomeEn: string
  preco: number
  primePraco: number
  yoy: number
  yield: number
  yieldTur: number
  vol: number
  emoji: string
  bairros: string[]
  desc: string
  drivers: string[]
  forecast: string
  compradores: string[]
  faq: { q: string; a: string }[]
}

interface ZoneRecord {
  [key: string]: ZoneData
}

// Minimal copy of ZONES for SSG metadata (keep in sync with ZonaClient.tsx)
const ZONES: ZoneRecord = {
  lisboa: { nome: 'Lisboa', nomeEn: 'Lisbon', preco: 5000, primePraco: 8500, yoy: 14, yield: 3.2, yieldTur: 4.8, vol: 18420, emoji: '🏛', bairros: [], desc: 'Capital europeia com mercado prime de classe mundial.', drivers: [], forecast: '€5.800/m² em 2027', compradores: [], faq: [] },
  cascais: { nome: 'Cascais', nomeEn: 'Cascais', preco: 4713, primePraco: 7200, yoy: 12, yield: 3.8, yieldTur: 5.2, vol: 4820, emoji: '🏖', bairros: [], desc: 'A Riviera portuguesa. Lifestyle premium, golfe world-class, praias.', drivers: [], forecast: '€5.400/m² em 2027', compradores: [], faq: [] },
  algarve: { nome: 'Algarve', nomeEn: 'Algarve', preco: 3941, primePraco: 6500, yoy: 11, yield: 4.8, yieldTur: 7.2, vol: 12340, emoji: '☀️', bairros: [], desc: 'O destino de sol e golfe mais procurado da Europa.', drivers: [], forecast: '€4.600/m² em 2027', compradores: [], faq: [] },
  porto: { nome: 'Porto', nomeEn: 'Porto', preco: 3643, primePraco: 5800, yoy: 12, yield: 4.1, yieldTur: 6.1, vol: 8920, emoji: '🍷', bairros: [], desc: 'A segunda maior cidade de Portugal, com carisma único.', drivers: [], forecast: '€4.200/m² em 2027', compradores: [], faq: [] },
  madeira: { nome: 'Madeira', nomeEn: 'Madeira', preco: 3760, primePraco: 5200, yoy: 18, yield: 4.5, yieldTur: 6.8, vol: 3240, emoji: '🌺', bairros: [], desc: 'A ilha de crescimento mais rápido da Europa.', drivers: [], forecast: '€4.400/m² em 2027', compradores: [], faq: [] },
  comporta: { nome: 'Comporta', nomeEn: 'Comporta', preco: 4200, primePraco: 9500, yoy: 22, yield: 4.0, yieldTur: 6.5, vol: 820, emoji: '🌾', bairros: [], desc: 'O St. Tropez português. Mercado de maior crescimento em Portugal.', drivers: [], forecast: '€5.200/m² em 2027', compradores: [], faq: [] },
  sintra: { nome: 'Sintra', nomeEn: 'Sintra', preco: 3200, primePraco: 5500, yoy: 9, yield: 3.5, yieldTur: 5.0, vol: 2840, emoji: '🏰', bairros: [], desc: 'Património UNESCO, palácios reais e natureza serrana.', drivers: [], forecast: '€3.700/m² em 2027', compradores: [], faq: [] },
  ericeira: { nome: 'Ericeira', nomeEn: 'Ericeira', preco: 2800, primePraco: 4500, yoy: 15, yield: 4.2, yieldTur: 6.0, vol: 1240, emoji: '🏄', bairros: [], desc: 'Reserva Mundial de Surf. Crescimento acelerado a 40min Lisboa.', drivers: [], forecast: '€3.300/m² em 2027', compradores: [], faq: [] },
}

export function generateStaticParams() {
  return Object.keys(ZONES).map((zona) => ({ zona }))
}

export async function generateMetadata({ params }: { params: Promise<{ zona: string }> }): Promise<Metadata> {
  const { zona } = await params
  const z = ZONES[zona]
  if (!z) return {}
  return {
    title: `Imóveis em ${z.nome} 2026 | Comprar, Vender, Investir · Agency Group`,
    description: `Guia completo do mercado imobiliário de ${z.nome} em 2026. Preço médio €${z.preco.toLocaleString('pt-PT')}/m², yield ${z.yield}%, valorização +${z.yoy}% YoY. Agency Group AMI 22506.`,
    keywords: `imóveis ${z.nome}, comprar casa ${z.nome}, investir ${z.nome}, preço m2 ${z.nome} 2026, imobiliário ${z.nome} luxo`,
    alternates: {
      canonical: `https://www.agencygroup.pt/zonas/${zona}`,
      languages: {
        'pt': `https://www.agencygroup.pt/zonas/${zona}`,
        'en': `https://www.agencygroup.pt/en/zones/${zona}`,
        'x-default': `https://www.agencygroup.pt/zonas/${zona}`,
      },
    },
    openGraph: {
      title: `Imóveis em ${z.nome} 2026 · Agency Group`,
      description: `${z.desc} Preço médio €${z.preco.toLocaleString('pt-PT')}/m². Agency Group AMI 22506.`,
      type: 'website',
      url: `https://www.agencygroup.pt/zonas/${zona}`,
      siteName: 'Agency Group',
      locale: 'pt_PT',
    },
  }
}

export default async function ZonaPage({ params }: { params: Promise<{ zona: string }> }) {
  const { zona } = await params
  if (!ZONES[zona]) notFound()
  return <ZonaClient zona={zona} />
}
