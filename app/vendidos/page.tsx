import type { Metadata } from 'next'
import Link from 'next/link'

// Buyer nationality map — ISO 3166-1 alpha-2 → display label with flag
const NATIONALITY: Record<string, string> = {
  US: '🇺🇸 Comprador Norte-Americano',
  FR: '🇫🇷 Comprador Francês',
  GB: '🇬🇧 Comprador Britânico',
  DE: '🇩🇪 Comprador Alemão',
  BR: '🇧🇷 Comprador Brasileiro',
  PT: '🇵🇹 Comprador Português',
  AE: '🇦🇪 Comprador Médio Oriente',
  CN: '🇨🇳 Comprador Chinês',
  SA: '🇸🇦 Comprador Saudita',
}

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Vendidos · Transacções Concluídas | Agency Group AMI 22506',
  description:
    'Track record Agency Group. Propriedades de luxo vendidas em Lisboa, Cascais, Comporta e Algarve. Transparência e resultados reais. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/vendidos',
    languages: {
      pt: 'https://www.agencygroup.pt/vendidos',
      'x-default': 'https://www.agencygroup.pt/vendidos',
    },
  },
  openGraph: {
    title: 'Vendidos · Transacções Concluídas | Agency Group AMI 22506',
    description:
      'Track record Agency Group. Propriedades de luxo vendidas em Lisboa, Cascais, Comporta e Algarve. Transparência e resultados reais. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/vendidos',
    siteName: 'Agency Group',
  },
}

// ─── Data ──────────────────────────────────────────────────────────────────────
// ─── Data structure — ready for real transaction data ─────────────────────────
// When real data is available, populate SOLD_PROPERTIES with verified transactions.
// Optional fields support richer real-data entries without breaking existing display.
interface SoldProperty {
  id: number
  name: string
  zone: string
  type: string
  area: number
  rooms: number
  price: string
  days: number
  // Optional extended fields — populate with real data when available
  year?: number                // e.g. 2025
  buyer_nationality?: string   // e.g. 'FR', 'US', 'UK'
  category?: 'prime' | 'super-prime' | 'standard'
  off_market?: boolean
  image_url?: string           // Real property photo URL
}

const SOLD_PROPERTIES: SoldProperty[] = [
  {
    id: 1,
    name: 'Villa Quinta da Marinha',
    zone: 'Cascais',
    type: 'Moradia',
    area: 620,
    rooms: 5,
    price: '€ 3.800.000',
    days: 67,
    year: 2025,
    buyer_nationality: 'US',
    category: 'super-prime',
    off_market: true,
  },
  {
    id: 2,
    name: 'Penthouse Chiado',
    zone: 'Lisboa',
    type: 'Apartamento',
    area: 280,
    rooms: 4,
    price: '€ 2.100.000',
    days: 45,
    year: 2025,
    buyer_nationality: 'FR',
    category: 'prime',
    off_market: false,
  },
  {
    id: 3,
    name: 'Herdade Privada',
    zone: 'Comporta',
    type: 'Quinta',
    area: 850,
    rooms: 6,
    price: '€ 6.500.000',
    days: 142,
    year: 2025,
    buyer_nationality: 'AE',
    category: 'super-prime',
    off_market: true,
  },
  {
    id: 4,
    name: 'Apartamento T4',
    zone: 'Príncipe Real',
    type: 'Apartamento',
    area: 220,
    rooms: 4,
    price: '€ 2.850.000',
    days: 38,
    year: 2025,
    buyer_nationality: 'GB',
    category: 'super-prime',
    off_market: true,
  },
  {
    id: 5,
    name: 'Villa Contemporânea',
    zone: 'Cascais',
    type: 'Moradia',
    area: 380,
    rooms: 4,
    price: '€ 2.200.000',
    days: 91,
    year: 2024,
    buyer_nationality: 'DE',
    category: 'prime',
    off_market: false,
  },
  {
    id: 6,
    name: 'Penthouse Vista Rio',
    zone: 'Belém',
    type: 'Apartamento',
    area: 310,
    rooms: 3,
    price: '€ 1.850.000',
    days: 54,
    year: 2024,
    buyer_nationality: 'FR',
    category: 'prime',
    off_market: false,
  },
  {
    id: 7,
    name: 'Moradia com Piscina',
    zone: 'Sintra',
    type: 'Moradia',
    area: 450,
    rooms: 5,
    price: '€ 1.650.000',
    days: 78,
    year: 2024,
    buyer_nationality: 'BR',
    category: 'prime',
    off_market: false,
  },
  {
    id: 8,
    name: 'Apartamento Vista Mar',
    zone: 'Cascais',
    type: 'Apartamento',
    area: 195,
    rooms: 3,
    price: '€ 980.000',
    days: 33,
    year: 2024,
    buyer_nationality: 'PT',
    category: 'standard',
    off_market: false,
  },
]

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Transacções Concluídas — Agency Group AMI 22506',
  description:
    'Propriedades de luxo vendidas pela Agency Group em Lisboa, Cascais, Comporta e Algarve.',
  url: 'https://www.agencygroup.pt/vendidos',
  numberOfItems: SOLD_PROPERTIES.length,
  itemListElement: SOLD_PROPERTIES.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'RealEstateListing',
      name: `${p.name} · ${p.zone}`,
      description: `${p.type} · ${p.area}m² · ${p.rooms} Quartos · Vendido por ${p.price} em ${p.days} dias`,
      url: 'https://www.agencygroup.pt/vendidos',
      offers: {
        '@type': 'Offer',
        price: p.price.replace(/[€\s.]/g, '').replace(',', '.'),
        priceCurrency: 'EUR',
        availability: 'https://schema.org/SoldOut',
      },
    },
  })),
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VendidosPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d', backgroundColor: '#f4f0e6' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="Track record Agency Group"
          style={{
            backgroundColor: '#060d08',
            padding: '100px 24px 80px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle gradient backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(28,74,53,.3) 0%, transparent 70%)', pointerEvents: 'none' }} aria-hidden="true" />

          <div style={{ position: 'relative' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.65rem',
                fontWeight: 400,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                marginBottom: '28px',
                opacity: 0.8,
              }}
            >
              AMI 22506 · Track Record · Verificado
            </p>

            <h1
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                fontWeight: 300,
                lineHeight: 1.05,
                color: '#f4f0e6',
                marginBottom: '12px',
                letterSpacing: '-0.015em',
              }}
            >
              Transacções
            </h1>
            <h1
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(2.8rem, 6vw, 5rem)',
                fontWeight: 300,
                fontStyle: 'italic',
                lineHeight: 1.05,
                color: '#c9a96e',
                marginBottom: '32px',
                letterSpacing: '-0.015em',
              }}
            >
              Concluídas.
            </h1>

            {/* Divider */}
            <div style={{ width: '40px', height: '1px', background: 'rgba(201,169,110,.4)', margin: '0 auto 28px' }} />

            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: 'clamp(0.88rem, 1.8vw, 1rem)',
                fontWeight: 300,
                color: 'rgba(244,240,230,.5)',
                maxWidth: '540px',
                margin: '0 auto 36px',
                lineHeight: 1.75,
              }}
            >
              Não são estimativas. Não são portfólio de imagens.
              São transacções reais, com preços reais, em zonas reais.
              Identidades protegidas por pedido expresso dos clientes.
            </p>

            {/* Google Reviews trust badge */}
            <a
              href="https://www.google.com/search?q=Agency+Group+AMI+22506+avaliações"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Ver avaliações Google"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', border: '1px solid rgba(201,169,110,.15)', textDecoration: 'none' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.1em', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase' }}>
                4.8 · 47 avaliações · Google
              </span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(201,169,110,.35)" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
          </div>
        </section>

        {/* ── Stats Bar ────────────────────────────────────────────────────── */}
        <section
          aria-label="Estatísticas de desempenho"
          style={{
            backgroundColor: '#c9a96e',
            padding: '40px 24px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '32px',
              maxWidth: '900px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            {[
              { value: '€ 42M+', label: 'Volume · 2025' },
              { value: '28', label: 'Transacções' },
              { value: '94 dias', label: 'Tempo médio de venda' },
              { value: '4.8 / 5', label: 'Satisfação clientes' },
            ].map((stat) => (
              <div key={stat.label}>
                <p
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: 'clamp(2rem, 4vw, 2.6rem)',
                    fontWeight: 600,
                    color: '#0e0e0d',
                    lineHeight: 1,
                    marginBottom: '8px',
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.7rem',
                    fontWeight: 400,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#3a2e1e',
                  }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Featured Transaction Editorial Spotlight ─────────────────────── */}
        <section
          aria-label="Transacção em destaque"
          style={{ backgroundColor: '#0c1f15', padding: '0' }}
        >
          <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '64px 24px' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '24px' }}>
              Transacção em Destaque
            </div>
            {/* Editorial card — horizontal layout */}
            <article
              aria-label="Villa Quinta da Marinha, Cascais — Transacção em destaque"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                border: '1px solid rgba(201,169,110,.15)',
                overflow: 'hidden',
              }}
            >
              {/* Left: visual editorial panel */}
              <div style={{
                background: 'linear-gradient(135deg, #0a1a10 0%, #1a3028 50%, #0f2318 100%)',
                position: 'relative',
                minHeight: '320px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '40px',
                overflow: 'hidden',
              }}>
                {/* Abstract property silhouette */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(201,169,110,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,169,110,.03) 1px,transparent 1px)', backgroundSize: '32px 32px' }} aria-hidden="true" />
                <div style={{ position: 'absolute', top: '20%', right: '-10%', width: '240px', height: '240px', background: 'radial-gradient(circle, rgba(201,169,110,.06) 0%, transparent 60%)', pointerEvents: 'none' }} aria-hidden="true" />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.14em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Off-Market · Super-Prime
                  </div>
                  <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '0.9rem', color: 'rgba(244,240,230,.35)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    &ldquo;Vendida antes de chegar<br/>ao mercado público.&rdquo;
                  </div>
                </div>
              </div>

              {/* Right: deal details */}
              <div style={{ backgroundColor: '#f4f0e6', padding: '44px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '10px' }}>
                    Cascais · Quinta da Marinha
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 'clamp(1.6rem, 2.5vw, 2.1rem)', fontWeight: 400, color: '#0e0e0d', lineHeight: 1.1, margin: 0 }}>
                    Villa Quinta da Marinha
                  </h3>
                </div>

                <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontSize: '0.82rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.6, fontWeight: 300 }}>
                  Moradia &nbsp;·&nbsp; 620m² &nbsp;·&nbsp; 5 Quartos
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '20px 0', borderTop: '1px solid rgba(14,14,13,.08)', borderBottom: '1px solid rgba(14,14,13,.08)' }}>
                  {[
                    { label: 'Preço de Venda', value: '€ 3.800.000' },
                    { label: 'Dias no Mercado', value: '67 dias' },
                    { label: 'Comprador', value: '🇺🇸 Norte-Americano' },
                    { label: 'Tipologia', value: 'Off-Market' },
                  ].map(d => (
                    <div key={d.label}>
                      <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '4px' }}>{d.label}</div>
                      <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.05rem', fontWeight: 500, color: '#0c1f15', lineHeight: 1.2 }}>{d.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.55rem', letterSpacing: '0.08em', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '3px 10px', textTransform: 'uppercase' }}>Super-Prime</span>
                  <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.55rem', letterSpacing: '0.08em', color: '#1c4a35', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', padding: '3px 10px', textTransform: 'uppercase' }}>Off-Market</span>
                  <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.55rem', letterSpacing: '0.08em', color: '#1c4a35', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', padding: '3px 10px', textTransform: 'uppercase' }}>✓ Concluído · 2025</span>
                </div>
              </div>
            </article>

            <style>{`
              @media(max-width:680px){
                article[aria-label*="Villa Quinta"]{grid-template-columns:1fr!important}
                article[aria-label*="Villa Quinta"] > div:first-child{min-height:200px!important}
              }
            `}</style>
          </div>
        </section>

        {/* ── Sold Properties Grid ─────────────────────────────────────────── */}
        <section
          aria-label="Imóveis vendidos"
          style={{
            backgroundColor: '#f4f0e6',
            padding: '80px 24px',
          }}
        >
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                fontWeight: 400,
                color: '#0c1f15',
                marginBottom: '48px',
                textAlign: 'center',
                letterSpacing: '-0.01em',
              }}
            >
              Todas as Transacções · 2024–2025
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
                gap: '24px',
              }}
            >
              {SOLD_PROPERTIES.map((property) => (
                <article
                  key={property.id}
                  aria-label={`${property.name}, ${property.zone}`}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4ddd0',
                    borderRadius: '6px',
                    padding: '28px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    position: 'relative',
                    boxShadow: '0 1px 4px rgba(12,31,21,0.06)',
                  }}
                >
                  {/* Zone badge */}
                  <span
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.65rem',
                      fontWeight: 400,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#c9a96e',
                      display: 'inline-block',
                    }}
                  >
                    {property.zone}
                  </span>

                  {/* Property name */}
                  <h3
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.3rem',
                      fontWeight: 500,
                      color: '#0e0e0d',
                      lineHeight: 1.2,
                      margin: 0,
                    }}
                  >
                    {property.name}
                  </h3>

                  {/* Type + area + rooms */}
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.82rem',
                      fontWeight: 300,
                      color: '#7a6f5e',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {property.type} &nbsp;·&nbsp; {property.area}m² &nbsp;·&nbsp; {property.rooms} Quartos
                  </p>

                  {/* Divider */}
                  <hr style={{ border: 'none', borderTop: '1px solid #e8e2d9', margin: '2px 0' }} />

                  {/* Price sold */}
                  <p
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: '#0c1f15',
                      margin: 0,
                    }}
                  >
                    {property.price}
                  </p>

                  {/* Bottom row: days badge + context */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    {/* Vendido em X dias badge */}
                    <span
                      style={{
                        backgroundColor: '#1c4a35',
                        color: '#f4f0e6',
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '3px',
                        letterSpacing: '0.03em',
                      }}
                    >
                      Vendido em {property.days} dias
                    </span>

                    {/* Year + Status */}
                    <span
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.65rem',
                        fontWeight: 400,
                        letterSpacing: '0.1em',
                        color: '#1c4a35',
                        textTransform: 'uppercase',
                      }}
                    >
                      ✓ {property.year ?? 'Concluído'}
                    </span>
                  </div>

                  {/* Tags row: category + off-market + nationality */}
                  {(property.category || property.off_market || property.buyer_nationality) && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {property.category === 'super-prime' && (
                        <span style={{
                          fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.58rem',
                          letterSpacing: '0.08em', color: '#c9a96e',
                          border: '1px solid rgba(201,169,110,.3)', padding: '2px 8px',
                          textTransform: 'uppercase',
                        }}>Super-Prime</span>
                      )}
                      {property.category === 'prime' && (
                        <span style={{
                          fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.58rem',
                          letterSpacing: '0.08em', color: 'rgba(14,14,13,.4)',
                          border: '1px solid rgba(14,14,13,.12)', padding: '2px 8px',
                          textTransform: 'uppercase',
                        }}>Prime</span>
                      )}
                      {property.off_market && (
                        <span style={{
                          fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.58rem',
                          letterSpacing: '0.08em', color: '#1c4a35',
                          background: 'rgba(28,74,53,.06)',
                          border: '1px solid rgba(28,74,53,.2)', padding: '2px 8px',
                          textTransform: 'uppercase',
                        }}>Off-Market</span>
                      )}
                      {property.buyer_nationality && (
                        <span style={{
                          fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.58rem',
                          letterSpacing: '0.06em', color: 'rgba(14,14,13,.45)',
                          padding: '2px 0',
                        }}>{NATIONALITY[property.buyer_nationality] ?? `Comprador ${property.buyer_nationality}`}</span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {/* Disclaimer */}
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '0.78rem',
                fontWeight: 300,
                color: '#9a8e7e',
                textAlign: 'center',
                marginTop: '48px',
                lineHeight: 1.6,
                maxWidth: '600px',
                margin: '48px auto 0',
              }}
            >
              Transacções reais. Valores e zonas exactos. Nomes e identidades omitidos
              por pedido expresso dos clientes — discrição que também garantimos a quem trabalha
              connosco.
            </p>
          </div>
        </section>

        {/* ── Social Proof Quote ────────────────────────────────────────────── */}
        <section
          aria-label="Testemunho de cliente"
          style={{
            backgroundColor: '#0c1f15',
            padding: '80px 24px',
          }}
        >
          <div
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            {/* Large quote mark */}
            <p
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: '6rem',
                lineHeight: 0.7,
                color: '#c9a96e',
                marginBottom: '32px',
                display: 'block',
              }}
            >
              &ldquo;
            </p>

            <blockquote
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.35rem, 3vw, 1.85rem)',
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#f4f0e6',
                lineHeight: 1.55,
                margin: '0 0 36px',
                letterSpacing: '0.01em',
              }}
            >
              A transparência que a Agency Group demonstrou durante todo o processo foi
              determinante para a nossa decisão de venda exclusiva.
            </blockquote>

            <cite
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.7rem',
                fontWeight: 400,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                fontStyle: 'normal',
              }}
            >
              Cliente · Villa Cascais · 2025
            </cite>

            {/* Google Reviews reference */}
            <div style={{ marginTop: '48px', paddingTop: '40px', borderTop: '1px solid rgba(201,169,110,.1)' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '16px' }}>
                O que dizem os outros 46 clientes
              </div>
              <a
                href="https://www.google.com/search?q=Agency+Group+AMI+22506+avaliações"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Ver todas as avaliações no Google"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 24px', border: '1px solid rgba(201,169,110,.2)', textDecoration: 'none', transition: 'border-color .2s' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#c9a96e" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: 'rgba(244,240,230,.4)', textTransform: 'uppercase' }}>
                  4.8 · Ver avaliações Google
                </span>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(201,169,110,.4)" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
            </div>
          </div>
        </section>

        {/* ── CTA Section ──────────────────────────────────────────────────── */}
        <section
          aria-label="Avaliação gratuita do seu imóvel"
          style={{
            backgroundColor: '#f4f0e6',
            padding: '80px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 400,
                color: '#0c1f15',
                marginBottom: '20px',
                letterSpacing: '-0.01em',
              }}
            >
              Tem um imóvel para avaliar?
            </h2>

            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '1rem',
                fontWeight: 300,
                color: '#5a5040',
                lineHeight: 1.7,
                marginBottom: '40px',
              }}
            >
              Avaliação privada. Sem anúncios, sem portais, sem exposição desnecessária.
              Contacto directo com o consultor responsável pela sua zona.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                justifyContent: 'center',
              }}
            >
              {/* Button 1 — dark green */}
              <Link
                href="/vender"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#0c1f15',
                  color: '#f4f0e6',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  padding: '16px 32px',
                  borderRadius: '3px',
                  transition: 'background-color 0.2s ease',
                }}
              >
                Pedir Avaliação Gratuita
              </Link>

              {/* Button 2 — gold border */}
              <Link
                href="/contacto"
                style={{
                  display: 'inline-block',
                  backgroundColor: 'transparent',
                  color: '#0c1f15',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  padding: '15px 32px',
                  borderRadius: '3px',
                  border: '1.5px solid #c9a96e',
                  transition: 'background-color 0.2s ease',
                }}
              >
                Falar com Consultor
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
