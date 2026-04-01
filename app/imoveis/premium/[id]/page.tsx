import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PROPERTIES, formatPriceFull } from '../../data'
import { PROPERTY_PHOTOS } from '../../photos'

// Only premium properties (>€3M) get their own microsite
const PREMIUM_IDS = PROPERTIES
  .filter(p => p.preco >= 3_000_000)
  .map(p => p.id)

export function generateStaticParams() {
  return PREMIUM_IDS.map(id => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const p = PROPERTIES.find(x => x.id === id && x.preco >= 3_000_000)
  if (!p) return {}
  return {
    title: `${p.nome} · ${formatPriceFull(p.preco)} · Agency Group`,
    description: `Imóvel exclusivo em ${p.zona}. ${p.area}m² · T${p.quartos} · ${p.desc.slice(0, 120)}...`,
    openGraph: {
      title: `${p.nome} — ${formatPriceFull(p.preco)}`,
      description: p.desc,
      type: 'website',
    },
  }
}

export default async function PremiumPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const property = PROPERTIES.find(p => p.id === id && p.preco >= 3_000_000)
  if (!property) notFound()

  const photos = PROPERTY_PHOTOS[property.id] ?? []
  const waMsg = `Olá, tenho interesse no imóvel exclusivo ${property.ref} — ${property.nome} (${formatPriceFull(property.preco)}). Podem agendar uma apresentação privada?`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.nome,
    description: property.desc,
    url: `https://agencygroup.pt/imoveis/premium/${property.id}`,
    price: property.preco,
    priceCurrency: 'EUR',
    numberOfRooms: property.quartos,
    floorSize: { '@type': 'QuantitativeValue', value: property.area, unitCode: 'MTK' },
    address: { '@type': 'PostalAddress', addressLocality: property.bairro, addressRegion: property.zona, addressCountry: 'PT' },
    geo: { '@type': 'GeoCoordinates', latitude: property.lat, longitude: property.lng },
    offers: {
      '@type': 'Offer',
      price: property.preco,
      priceCurrency: 'EUR',
      seller: { '@type': 'RealEstateAgent', name: 'Agency Group', telephone: '+351919948986' },
    },
  }

  return (
    <div style={{ background: '#060d08', minHeight: '100vh', color: '#f4f0e6', fontFamily: "'Jost', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Fixed nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        background: 'rgba(6,13,8,.97)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(201,169,110,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 60px', height: '72px',
      }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.18em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase' }}>
          {property.ref} · Propriedade Exclusiva
        </div>
        <a
          href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            background: '#c9a96e', color: '#0c1f15',
            padding: '10px 28px',
            fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
            fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >Apresentação Privada →</a>
      </nav>

      {/* Full-screen hero */}
      <div style={{
        position: 'relative', height: '100vh', overflow: 'hidden',
        background: `linear-gradient(${property.grad})`,
      }}>
        {photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photos[0].url}
            alt={property.nome}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(6,13,8,.95) 0%, rgba(6,13,8,.3) 60%, rgba(6,13,8,.5) 100%)',
        }} />

        {/* Badge */}
        {property.badge && (
          <div style={{
            position: 'absolute', top: '100px', left: '60px',
            fontFamily: "'DM Mono', monospace", fontSize: '.44rem',
            letterSpacing: '.22em', color: '#c9a96e',
            background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.3)',
            padding: '6px 16px', textTransform: 'uppercase',
          }}>{property.badge}</div>
        )}

        <div style={{
          position: 'absolute', bottom: '80px', left: '60px', right: '60px',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: '48px', alignItems: 'flex-end',
        }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', marginBottom: '16px' }}>
              {property.zona} · {property.bairro}
            </div>
            <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.8rem, 5vw, 5rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.05, maxWidth: '800px' }}>
              {property.nome}
            </h1>
            <div style={{ fontFamily: "'Cormorant', serif", fontSize: 'clamp(2rem, 3.5vw, 3.5rem)', color: '#c9a96e', fontWeight: 300, letterSpacing: '.03em' }}>
              {formatPriceFull(property.preco)}
            </div>
          </div>
          {/* Key specs */}
          <div style={{
            display: 'flex', gap: '0',
            background: 'rgba(6,13,8,.75)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(201,169,110,.15)',
          }}>
            {[
              ['Área', `${property.area} m²`],
              ['Quartos', `T${property.quartos}`],
              ['WC', `${property.casasBanho}`],
              ['EPC', property.energia],
            ].map(([label, val], i) => (
              <div key={label} style={{
                padding: '20px 28px', textAlign: 'center',
                borderRight: i < 3 ? '1px solid rgba(201,169,110,.1)' : 'none',
              }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', color: '#f4f0e6', fontWeight: 300 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          fontFamily: "'DM Mono', monospace", fontSize: '.38rem',
          letterSpacing: '.2em', color: 'rgba(201,169,110,.4)', textTransform: 'uppercase',
        }}>↓ Descobrir</div>
      </div>

      {/* Photo gallery — full width masonry */}
      {photos.length > 1 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '3px',
          background: '#060d08',
        }}>
          {photos.slice(1, 7).map((photo, i) => (
            <div key={i} style={{
              position: 'relative',
              paddingBottom: i === 0 || i === 3 ? '75%' : '60%',
              overflow: 'hidden',
              gridColumn: i === 0 ? 'span 2' : 'span 1',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.label}
                loading="lazy"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .6s ease' }}
                />
              <div style={{
                position: 'absolute', bottom: '16px', left: '20px',
                fontFamily: "'DM Mono', monospace", fontSize: '.38rem',
                letterSpacing: '.12em', color: 'rgba(244,240,230,.7)',
                background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
                padding: '4px 10px', textTransform: 'uppercase',
              }}>{photo.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Description + Features */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '96px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>
              Sobre esta Propriedade
            </div>
            <p style={{ fontFamily: "'Cormorant', serif", fontSize: '1.25rem', lineHeight: 1.8, color: 'rgba(244,240,230,.75)', fontWeight: 300, margin: 0 }}>
              {property.desc}
            </p>
            {property.vista && (
              <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '1px', background: '#c9a96e' }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.44rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase' }}>Vista {property.vista}</span>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>
              Características Exclusivas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {property.features.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '14px 20px',
                  border: '1px solid rgba(201,169,110,.1)',
                  background: 'rgba(201,169,110,.03)',
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c9a96e', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.7)' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(201,169,110,.08) 0%, rgba(12,31,21,.4) 100%)',
        border: '1px solid rgba(201,169,110,.12)',
        margin: '0 60px 96px',
        padding: '64px',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>
          Propriedade de Representação Exclusiva
        </div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f4f0e6', margin: '0 0 16px' }}>
          Interesse nesta Propriedade?
        </h2>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.5)', maxWidth: '500px', margin: '0 auto 40px', lineHeight: 1.7 }}>
          A Agency Group oferece um serviço de apresentação privada. O nosso consultor acompanha-o em cada detalhe da transação.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: '#c9a96e', color: '#0c1f15',
              padding: '18px 48px',
              fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
              fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >Solicitar Apresentação Privada →</a>
          <Link
            href={`/imoveis/${property.id}`}
            style={{
              background: 'transparent', color: '#c9a96e',
              padding: '18px 40px',
              border: '1px solid rgba(201,169,110,.4)',
              fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
              fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >Ver Ficha Técnica Completa</Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(201,169,110,.1)',
        padding: '32px 60px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.1rem', color: '#c9a96e' }}>
          Agency<span style={{ color: '#f4f0e6' }}>Group</span>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', textTransform: 'uppercase' }}>
          AMI 22506 · {property.ref} · Lisboa
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>
          +351 919 948 986
        </div>
      </div>
    </div>
  )
}
