import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PROPERTIES, PROPERTY_IDS, formatPriceFull } from '../data'
import ImovelClient from './ImovelClient'

// ─── generateStaticParams ─────────────────────────────────────────────────────
export function generateStaticParams() {
  return PROPERTY_IDS.map(id => ({ id }))
}

// ─── generateMetadata ─────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const p = PROPERTIES.find(x => x.id === id)
  if (!p) return { title: 'Imóvel não encontrado | Agency Group' }

  const desc = `${p.desc.slice(0, 140)} — ${formatPriceFull(p.preco)} · ${p.area}m² · ${p.zona} · Agency Group AMI 22506`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: p.nome,
    description: p.desc,
    url: `https://agencygroup.pt/imoveis/${p.id}`,
    identifier: p.ref,
    offers: {
      '@type': 'Offer',
      price: p.preco,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'RealEstateAgent',
        name: 'Agency Group',
        telephone: '+351919948986',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'PT',
          addressLocality: p.zona,
        },
      },
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: p.area,
      unitCode: 'MTK',
    },
    numberOfRooms: p.quartos,
    numberOfBathroomsTotal: p.casasBanho,
    amenityFeature: [
      ...(p.piscina  ? [{ '@type': 'LocationFeatureSpecification', name: 'Piscina', value: true }] : []),
      ...(p.garagem  ? [{ '@type': 'LocationFeatureSpecification', name: 'Garagem', value: true }] : []),
      ...(p.jardim   ? [{ '@type': 'LocationFeatureSpecification', name: 'Jardim', value: true }] : []),
      ...(p.terraco  ? [{ '@type': 'LocationFeatureSpecification', name: 'Terraço', value: true }] : []),
      ...(p.tourUrl  ? [{ '@type': 'LocationFeatureSpecification', name: 'Tour Virtual 3D', value: true }] : []),
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PT',
      addressLocality: p.bairro,
      addressRegion: p.zona,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: p.lat,
      longitude: p.lng,
    },
    additionalType: p.tipo === 'Apartamento' ? 'https://schema.org/Apartment' : 'https://schema.org/House',
  }

  return {
    title: `${p.nome} — ${formatPriceFull(p.preco)} | ${p.zona} | Agency Group`,
    description: desc,
    openGraph: {
      title: `${p.nome} — ${formatPriceFull(p.preco)} | ${p.zona}`,
      description: p.desc.slice(0, 200),
      url: `https://agencygroup.pt/imoveis/${p.id}`,
      siteName: 'Agency Group',
      locale: 'pt_PT',
      type: 'website',
    },
    alternates: { canonical: `https://agencygroup.pt/imoveis/${p.id}` },
    other: {
      'script:ld+json': JSON.stringify(jsonLd),
    },
  }
}

// ─── Page Component ────────────────────────────────────────────────────────────
export default async function ImovelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!PROPERTY_IDS.includes(id)) notFound()
  return <ImovelClient id={id} />
}
