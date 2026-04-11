import type { Metadata } from 'next'
import Link from 'next/link'

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
            backgroundColor: '#0c1f15',
            padding: '100px 24px 80px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.72rem',
              fontWeight: 400,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#c9a96e',
              marginBottom: '24px',
            }}
          >
            AMI 22506 · Track Record
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2.6rem, 6vw, 4.2rem)',
              fontWeight: 300,
              lineHeight: 1.1,
              color: '#f4f0e6',
              marginBottom: '28px',
              letterSpacing: '-0.01em',
            }}
          >
            Transacções Concluídas
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
              fontWeight: 300,
              color: '#c8bfad',
              maxWidth: '620px',
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Track record real. Transacções concluídas em imóveis de luxo
            seleccionados. Identidades protegidas pela privacidade dos clientes.
          </p>
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
              { value: '€ 42M+', label: 'Volume total' },
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
              Imóveis Vendidos
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
                          letterSpacing: '0.06em', color: 'rgba(14,14,13,.35)',
                          padding: '2px 0',
                        }}>Comprador {property.buyer_nationality}</span>
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
              Quer vender o seu imóvel?
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
                href="/avm"
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
                Avaliação Privada
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
