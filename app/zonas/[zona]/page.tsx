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
      images: [{
        url: `https://www.agencygroup.pt/api/og?title=Im%C3%B3veis+em+${encodeURIComponent(z.nome)}+2026&subtitle=%E2%82%AC${z.preco.toLocaleString('pt-PT')}%2Fm%C2%B2+%C2%B7+%2B${z.yoy}%25+YoY+%C2%B7+Agency+Group`,
        width: 1200,
        height: 630,
        alt: `Imóveis em ${z.nome} 2026 — Agency Group`,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Imóveis em ${z.nome} 2026 · Agency Group`,
      description: `${z.desc} €${z.preco.toLocaleString('pt-PT')}/m² · +${z.yoy}% YoY`,
      images: [`https://www.agencygroup.pt/api/og?title=Im%C3%B3veis+em+${encodeURIComponent(z.nome)}+2026&subtitle=%E2%82%AC${z.preco.toLocaleString('pt-PT')}%2Fm%C2%B2+%C2%B7+%2B${z.yoy}%25+YoY+%C2%B7+Agency+Group`],
    },
  }
}

const ZONE_GEO: Record<string, { lat: number; lng: number }> = {
  lisboa:   { lat: 38.7169, lng: -9.1399 },
  cascais:  { lat: 38.6979, lng: -9.4215 },
  algarve:  { lat: 37.0179, lng: -7.9307 },
  porto:    { lat: 41.1579, lng: -8.6291 },
  comporta: { lat: 38.3817, lng: -8.7775 },
  madeira:  { lat: 32.6669, lng: -16.9241 },
  sintra:   { lat: 38.7978, lng: -9.3895 },
  ericeira: { lat: 38.9637, lng: -9.4178 },
}

export default async function ZonaPage({ params }: { params: Promise<{ zona: string }> }) {
  const { zona } = await params
  if (!ZONES[zona]) notFound()

  const z = ZONES[zona]
  const geo = ZONE_GEO[zona]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://www.agencygroup.pt' },
      { '@type': 'ListItem', position: 2, name: 'Imóveis', item: 'https://www.agencygroup.pt/imoveis' },
      { '@type': 'ListItem', position: 3, name: z.nome, item: `https://www.agencygroup.pt/zonas/${zona}` },
    ],
  }

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `https://www.agencygroup.pt/zonas/${zona}#localbusiness`,
    name: `Agency Group — Imóveis em ${z.nome}`,
    description: z.desc,
    url: `https://www.agencygroup.pt/zonas/${zona}`,
    telephone: '+351919948986',
    email: 'geral@agencygroup.pt',
    address: {
      '@type': 'PostalAddress',
      addressLocality: z.nome,
      addressCountry: 'PT',
    },
    ...(geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.lat,
        longitude: geo.lng,
      },
    }),
    identifier: { '@type': 'PropertyValue', name: 'AMI', value: '22506' },
    areaServed: z.nome,
    priceRange: '€€€€',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <ZonaClient zona={zona} />
    </>
  )
}
