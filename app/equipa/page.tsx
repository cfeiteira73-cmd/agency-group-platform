import type { Metadata } from 'next'
import Link from 'next/link'
import HomeNav from '@/app/components/HomeNav'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Equipa · Consultores de Imobiliário de Luxo | Agency Group AMI 22506',
  description:
    'Conheça a equipa Agency Group. Consultores especializados em imobiliário premium, investimento e mercados internacionais em Portugal. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/equipa',
    languages: {
      pt: 'https://www.agencygroup.pt/equipa',
      en: 'https://www.agencygroup.pt/en/equipa',
      'x-default': 'https://www.agencygroup.pt/equipa',
    },
  },
  openGraph: {
    title: 'Equipa Agency Group · Consultores de Imobiliário de Luxo',
    description:
      'Especialistas em imobiliário premium, investimento internacional e mercados de luxo em Portugal. Agency Group AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/equipa',
    siteName: 'Agency Group',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=A+Nossa+Equipa&subtitle=Consultores+de+Luxo+%C2%B7+AMI+22506',
      width: 1200,
      height: 630,
      alt: 'Equipa Agency Group — Consultores Imobiliários',
    }],
  },
}

// ─── JSON-LD Schemas ──────────────────────────────────────────────────────────
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Agency Group',
  url: 'https://www.agencygroup.pt',
  logo: 'https://www.agencygroup.pt/logo.png',
  description:
    'Mediação imobiliária de luxo em Portugal. Especialistas em compradores internacionais, investimento e mercado premium.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'PT',
    addressLocality: 'Lisboa',
  },
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  areaServed: ['Lisboa', 'Cascais', 'Algarve', 'Porto', 'Madeira', 'Açores'],
  employee: [
    { '@type': 'Person', name: 'Carlos Gomes', jobTitle: 'Consultor Sénior · Imobiliário Residencial' },
    { '@type': 'Person', name: 'Maria Fonseca', jobTitle: 'Consultora · Investimento & Off-Market' },
    { '@type': 'Person', name: 'Ricardo Pinto', jobTitle: 'Consultor · NHR & Investimento Internacional' },
  ],
}

const personSchemas = [
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Carlos Gomes',
    jobTitle: 'Consultor Sénior · Imobiliário Residencial',
    worksFor: { '@type': 'Organization', name: 'Agency Group' },
    email: 'carlos@agencygroup.pt',
    telephone: '+351919948986',
    areaServed: ['Lisboa', 'Cascais', 'Sintra'],
    description:
      'Especializado em imobiliário residencial premium com foco em compradores internacionais e investimento estrangeiro. Mais de 8 anos de experiência no segmento de luxo em Portugal.',
    url: 'https://www.agencygroup.pt/equipa',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Maria Fonseca',
    jobTitle: 'Consultora · Investimento & Off-Market',
    worksFor: { '@type': 'Organization', name: 'Agency Group' },
    email: 'maria@agencygroup.pt',
    telephone: '+351919948986',
    areaServed: ['Comporta', 'Algarve', 'Madeira'],
    description:
      'Especialista em propriedades exclusivas e transacções off-market para clientes HNWI e family offices. Fluente em inglês, francês e espanhol.',
    url: 'https://www.agencygroup.pt/equipa',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Ricardo Pinto',
    jobTitle: 'Consultor · NHR & Investimento Internacional',
    worksFor: { '@type': 'Organization', name: 'Agency Group' },
    email: 'ricardo@agencygroup.pt',
    telephone: '+351919948986',
    areaServed: ['Porto', 'Douro', 'Açores'],
    description:
      'Foco em compradores internacionais, regime NHR/IFICI e estruturação de investimento imobiliário. Experiência em clientes do Médio Oriente, Reino Unido e Brasil.',
    url: 'https://www.agencygroup.pt/equipa',
  },
]

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://www.agencygroup.pt/' },
    { '@type': 'ListItem', position: 2, name: 'Equipa', item: 'https://www.agencygroup.pt/equipa' },
  ],
  twitter: {
    card: 'summary_large_image',
    title: 'Equipa Agency Group · Consultores de Imobiliário de Luxo',
    description: 'Boutique imobiliária de luxo em Portugal. AMI 22506.',
    images: ['https://www.agencygroup.pt/api/og?title=A+Nossa+Equipa&subtitle=Consultores+de+Luxo+%C2%B7+AMI+22506'],
  },
}

// ─── Advisor data ─────────────────────────────────────────────────────────────
// ─── Team data — structure ready for real consultant profiles ─────────────────
// photo_url: add real headshot URLs when available (recommended: 400×400px AVIF)
// direct_phone: individual mobile number per consultant (if different from main)
// linkedin: public LinkedIn profile URL
// languages: ISO 639-1 codes
const ADVISORS = [
  {
    initials: 'CG',
    name: 'Carlos Gomes',
    title: 'Consultor Sénior · Imobiliário Residencial',
    zones: ['Lisboa', 'Cascais', 'Sintra'],
    bio: 'Especializado em imobiliário residencial premium com foco em compradores internacionais e investimento estrangeiro. Mais de 8 anos de experiência no segmento de luxo em Portugal.',
    whatsapp: 'https://wa.me/351919948986',
    email: 'carlos@agencygroup.pt',
    // Extended fields — populate with real data:
    photo_url: null as string | null,   // e.g. '/equipa/carlos-gomes.avif'
    direct_phone: null as string | null, // e.g. '+351 9XX XXX XXX'
    linkedin: null as string | null,
    languages: ['PT', 'EN'] as string[],
    transactions_count: null as number | null,
  },
  {
    initials: 'MF',
    name: 'Maria Fonseca',
    title: 'Consultora · Investimento & Off-Market',
    zones: ['Comporta', 'Algarve', 'Madeira'],
    bio: 'Especialista em propriedades exclusivas e transacções off-market para clientes HNWI e family offices. Fluente em inglês, francês e espanhol.',
    whatsapp: 'https://wa.me/351919948986',
    email: 'maria@agencygroup.pt',
    photo_url: null as string | null,
    direct_phone: null as string | null,
    linkedin: null as string | null,
    languages: ['PT', 'EN', 'FR', 'ES'] as string[],
    transactions_count: null as number | null,
  },
  {
    initials: 'RP',
    name: 'Ricardo Pinto',
    title: 'Consultor · NHR & Investimento Internacional',
    zones: ['Porto', 'Douro', 'Açores'],
    bio: 'Foco em compradores internacionais, regime NHR/IFICI e estruturação de investimento imobiliário. Experiência em clientes do Médio Oriente, Reino Unido e Brasil.',
    whatsapp: 'https://wa.me/351919948986',
    email: 'ricardo@agencygroup.pt',
    photo_url: null as string | null,
    direct_phone: null as string | null,
    linkedin: null as string | null,
    languages: ['PT', 'EN', 'AR'] as string[],
    transactions_count: null as number | null,
  },
]

// ─── Stats data ───────────────────────────────────────────────────────────────
const STATS = [
  { value: '€ 42M+', label: 'Volume · 2025' },
  { value: '8+ Anos', label: 'No mercado premium' },
  { value: '6 Idiomas', label: 'PT · EN · FR · ES · AR · ZH' },
]

// ─── Component ───────────────────────────────────────────────────────────────
export default function EquipaPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      {personSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <HomeNav />

      <div
        style={{
          minHeight: '100vh',
          fontFamily: "var(--font-jost, 'Jost', sans-serif)",
          background: '#f4f0e6',
        }}
      >
        {/* ── Hero section ─────────────────────────────────────────────────── */}
        <header
          style={{
            background: '#0c1f15',
            color: '#f4f0e6',
            padding: '120px 40px 96px',
          }}
        >
          {/* Back link */}
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                fontSize: '.52rem',
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color: 'rgba(201,169,110,.55)',
                textDecoration: 'none',
                marginBottom: '48px',
              }}
            >
              ← Início
            </Link>

            {/* Breadcrumb (screen-reader accessible) */}
            <nav aria-label="Breadcrumb" style={{ display: 'none' }}>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '8px' }}>
                <li><Link href="/" style={{ color: '#c9a96e', textDecoration: 'none' }}>Início</Link></li>
                <li aria-hidden="true">›</li>
                <li aria-current="page">Equipa</li>
              </ol>
            </nav>

            {/* Label */}
            <p
              style={{
                fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                fontSize: '.52rem',
                letterSpacing: '.22em',
                textTransform: 'uppercase',
                color: 'rgba(201,169,110,.65)',
                marginBottom: '20px',
                margin: '0 0 20px',
              }}
            >
              AMI 22506 · EQUIPA
            </p>

            {/* H1 */}
            <h1
              style={{
                fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
                fontWeight: 300,
                fontSize: 'clamp(2.4rem, 6vw, 3.8rem)',
                lineHeight: 1.08,
                color: '#f4f0e6',
                margin: '0 0 28px',
                letterSpacing: '-.01em',
              }}
            >
              Os Consultores
            </h1>

            {/* Subline */}
            <p
              style={{
                fontSize: '.95rem',
                color: 'rgba(244,240,230,.58)',
                lineHeight: 1.75,
                maxWidth: '560px',
                margin: '0 0 40px',
              }}
            >
              Acompanhamento personalizado desde a primeira conversa. Especialistas em imobiliário
              de luxo, compradores internacionais e transacções privadas em Portugal.
            </p>

            {/* Gold separator line */}
            <div
              style={{
                width: '48px',
                height: '1px',
                background: 'linear-gradient(90deg, #c9a96e 0%, rgba(201,169,110,0) 100%)',
              }}
              aria-hidden="true"
            />
          </div>
        </header>

        {/* ── Advisor cards section ─────────────────────────────────────────── */}
        <main id="main-content">
          <section
            aria-label="Consultores"
            style={{
              background: '#f4f0e6',
              padding: '96px 40px',
            }}
          >
            <div
              style={{
                maxWidth: '1100px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '32px',
              }}
            >
              {ADVISORS.map((advisor) => (
                <article
                  key={advisor.initials}
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(28,74,53,.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Photo — real headshot when available, initials fallback */}
                  <div
                    style={{
                      background: '#1c4a35',
                      height: '220px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                    aria-hidden="true"
                  >
                    {advisor.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={advisor.photo_url}
                        alt={advisor.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                      />
                    ) : (
                      /* Premium monogram placeholder — displays until real headshot is added */
                      <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(160deg, #0e2a1a 0%, #1c4a35 55%, #0a1f12 100%)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: '10px', position: 'relative',
                      }}>
                        {/* Subtle radial glow behind monogram */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(201,169,110,.07) 0%, transparent 100%)',
                          pointerEvents: 'none',
                        }} />
                        {/* Thin gold rule */}
                        <div style={{ width: '28px', height: '1px', background: 'rgba(201,169,110,.35)' }} />
                        {/* Initials */}
                        <span style={{
                          fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                          fontSize: '3.4rem',
                          fontWeight: 300,
                          color: '#c9a96e',
                          letterSpacing: '.18em',
                          lineHeight: 1,
                          userSelect: 'none',
                          position: 'relative', zIndex: 1,
                        }}>
                          {advisor.initials}
                        </span>
                        {/* Thin gold rule */}
                        <div style={{ width: '28px', height: '1px', background: 'rgba(201,169,110,.35)' }} />
                        {/* Name caption */}
                        <span style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: '.42rem',
                          letterSpacing: '.22em',
                          textTransform: 'uppercase',
                          color: 'rgba(201,169,110,.45)',
                          userSelect: 'none',
                          position: 'relative', zIndex: 1,
                        }}>
                          {advisor.name.split(' ')[0]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div
                    style={{
                      padding: '32px 28px 28px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      flex: 1,
                    }}
                  >
                    {/* Name */}
                    <h2
                      style={{
                        fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
                        fontWeight: 500,
                        fontSize: '1.4rem',
                        color: '#0e0e0d',
                        margin: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {advisor.name}
                    </h2>

                    {/* Title */}
                    <p
                      style={{
                        fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                        fontSize: '.55rem',
                        fontWeight: 400,
                        color: '#c9a96e',
                        letterSpacing: '.2em',
                        textTransform: 'uppercase',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {advisor.title}
                    </p>

                    {/* Zone chips */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      {advisor.zones.map((zone) => (
                        <span
                          key={zone}
                          style={{
                            background: '#1c4a35',
                            color: 'rgba(244,240,230,.75)',
                            fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                            fontSize: '.48rem',
                            letterSpacing: '.16em',
                            textTransform: 'uppercase',
                            padding: '5px 10px',
                            display: 'inline-block',
                          }}
                        >
                          {zone}
                        </span>
                      ))}
                    </div>

                    {/* Thin separator */}
                    <div
                      style={{
                        height: '1px',
                        background: 'rgba(28,74,53,.1)',
                      }}
                      aria-hidden="true"
                    />

                    {/* Bio */}
                    <p
                      style={{
                        fontFamily: "var(--font-jost, 'Jost', sans-serif)",
                        fontSize: '.88rem',
                        color: 'rgba(14,14,13,.62)',
                        lineHeight: 1.75,
                        margin: 0,
                        flex: 1,
                      }}
                    >
                      {advisor.bio}
                    </p>

                    {/* Contact row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        marginTop: '4px',
                      }}
                    >
                      <a
                        href={advisor.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp ${advisor.name}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          background: '#1c4a35',
                          color: '#c9a96e',
                          fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                          fontSize: '.52rem',
                          letterSpacing: '.16em',
                          textTransform: 'uppercase',
                          textDecoration: 'none',
                          padding: '10px 18px',
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                      </a>

                      <a
                        href={`mailto:${advisor.email}`}
                        aria-label={`Email ${advisor.name}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          background: 'transparent',
                          color: '#1c4a35',
                          border: '1px solid rgba(28,74,53,.3)',
                          fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                          fontSize: '.52rem',
                          letterSpacing: '.16em',
                          textTransform: 'uppercase',
                          textDecoration: 'none',
                          padding: '10px 18px',
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        Email
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── Stats bar ──────────────────────────────────────────────────── */}
          <section
            aria-label="Números Agency Group"
            style={{
              background: '#0c1f15',
              padding: '80px 40px',
            }}
          >
            <div
              style={{
                maxWidth: '1100px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '2px',
              }}
            >
              {STATS.map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: '48px 40px',
                    borderLeft: i > 0 ? '1px solid rgba(201,169,110,.1)' : 'none',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
                      fontWeight: 300,
                      fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                      color: '#c9a96e',
                      margin: '0 0 10px',
                      lineHeight: 1,
                      letterSpacing: '-.01em',
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                      fontSize: '.52rem',
                      letterSpacing: '.2em',
                      textTransform: 'uppercase',
                      color: 'rgba(244,240,230,.4)',
                      margin: 0,
                    }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA section ────────────────────────────────────────────────── */}
          <section
            aria-label="Contacto directo"
            style={{
              background: '#f4f0e6',
              padding: '96px 40px',
            }}
          >
            <div
              style={{
                maxWidth: '700px',
                margin: '0 auto',
                textAlign: 'center',
              }}
            >
              {/* Decorative gold line */}
              <div
                style={{
                  width: '40px',
                  height: '1px',
                  background: '#c9a96e',
                  margin: '0 auto 36px',
                }}
                aria-hidden="true"
              />

              <h2
                style={{
                  fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
                  fontWeight: 300,
                  fontSize: 'clamp(1.9rem, 4vw, 2.8rem)',
                  color: '#0e0e0d',
                  margin: '0 0 20px',
                  lineHeight: 1.15,
                }}
              >
                Fala directamente com um consultor
              </h2>

              <p
                style={{
                  fontFamily: "var(--font-jost, 'Jost', sans-serif)",
                  fontSize: '.92rem',
                  color: 'rgba(14,14,13,.55)',
                  lineHeight: 1.75,
                  margin: '0 0 44px',
                  maxWidth: '480px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                Sem formulários. Sem espera. Contacto directo com o especialista certo
                para o teu objectivo.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {/* WhatsApp CTA */}
                <a
                  href="https://wa.me/351919948986"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#1c4a35',
                    color: '#c9a96e',
                    fontFamily: "var(--font-jost, 'Jost', sans-serif)",
                    fontSize: '.62rem',
                    fontWeight: 600,
                    letterSpacing: '.2em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    padding: '16px 36px',
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>

                {/* Portfolio CTA */}
                <Link
                  href="/imoveis"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    color: '#0e0e0d',
                    border: '1px solid #c9a96e',
                    fontFamily: "var(--font-jost, 'Jost', sans-serif)",
                    fontSize: '.62rem',
                    fontWeight: 600,
                    letterSpacing: '.2em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    padding: '16px 36px',
                  }}
                >
                  Ver Portfólio →
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* ── Footer strip ─────────────────────────────────────────────────── */}
        <footer
          style={{
            background: '#0c1f15',
            borderTop: '1px solid rgba(201,169,110,.08)',
            padding: '24px 40px',
            fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
            fontSize: '.52rem',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'rgba(244,240,230,.2)',
            textAlign: 'center',
          }}
        >
          Agency Group · Mediação Imobiliária Lda · AMI 22506 · Lisboa, Portugal
        </footer>
      </div>
    </>
  )
}
