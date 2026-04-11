import type { Metadata } from 'next'
import Link from 'next/link'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Contacto · Agency Group — Imobiliário de Luxo Portugal | AMI 22506',
  description:
    'Contacte a Agency Group. Consultores de imobiliário de luxo em Portugal. WhatsApp, email e reunião presencial. AMI 22506 — Lisboa, Cascais, Algarve, Porto.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/contacto',
  },
  openGraph: {
    title: 'Contacto · Agency Group — Imobiliário de Luxo Portugal',
    description:
      'Consultores de imobiliário de luxo em Portugal. WhatsApp, email e reunião presencial. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/contacto',
    siteName: 'Agency Group',
  },
}

// ─── JSON-LD ───────────────────────────────────────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Agency Group',
  telephone: '+351912000000',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Lisboa',
    addressCountry: 'PT',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '19:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday'],
      opens: '10:00',
      closes: '14:00',
    },
  ],
  url: 'https://www.agencygroup.pt',
  additionalProperty: {
    '@type': 'PropertyValue',
    name: 'Licença AMI',
    value: 'AMI 22506',
  },
}

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────
function IconWhatsApp() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function IconEmail() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ContactoPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d' }}>

        {/* ── HERO ─────────────────────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: '#0c1f15',
            padding: '96px 24px 80px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: '#c9a96e',
              textTransform: 'uppercase',
              marginBottom: '24px',
            }}
          >
            AMI 22506 · Contacto
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(48px, 8vw, 84px)',
              fontWeight: 300,
              lineHeight: 1.1,
              color: '#f4f0e6',
              margin: '0 0 24px',
              letterSpacing: '-0.01em',
            }}
          >
            Fala Connosco
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(15px, 2vw, 18px)',
              fontWeight: 300,
              color: 'rgba(244,240,230,0.72)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.65,
            }}
          >
            Sem formulários complexos. Escolhe o canal que preferes — respondemos rapidamente.
          </p>
        </section>

        {/* ── MAIN CONTACT SECTION ─────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: '#f4f0e6',
            padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 48px)',
          }}
        >
          <div
            style={{
              maxWidth: '1160px',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '32px',
              alignItems: 'flex-start',
            }}
          >

            {/* LEFT COLUMN — Contact Methods */}
            <div
              style={{
                flex: '1 1 380px',
                minWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >

              {/* Card 1 — WhatsApp */}
              <div
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(201,169,110,0.2)',
                  borderRadius: '2px',
                  padding: '32px',
                  position: 'relative',
                }}
              >
                {/* Primary badge */}
                <span
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '9px',
                    letterSpacing: '0.18em',
                    color: '#1c4a35',
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(28,74,53,0.08)',
                    padding: '4px 8px',
                    borderRadius: '2px',
                  }}
                >
                  Recomendado
                </span>

                <div style={{ color: '#25D366', marginBottom: '16px' }}>
                  <IconWhatsApp />
                </div>

                <h2
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: '24px',
                    fontWeight: 500,
                    color: '#0e0e0d',
                    margin: '0 0 8px',
                  }}
                >
                  WhatsApp
                </h2>

                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(14,14,13,0.55)',
                    margin: '0 0 24px',
                    lineHeight: 1.55,
                  }}
                >
                  Resposta em menos de 2h (horário laboral)
                </p>

                <a
                  href="https://wa.me/351912000000?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20im%C3%B3veis%20em%20Portugal."
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    backgroundColor: '#1c4a35',
                    color: '#c9a96e',
                    textAlign: 'center',
                    padding: '14px 24px',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    borderRadius: '1px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  Iniciar Conversa
                </a>
              </div>

              {/* Card 2 — Email */}
              <div
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(201,169,110,0.2)',
                  borderRadius: '2px',
                  padding: '32px',
                }}
              >
                <div style={{ color: '#1c4a35', marginBottom: '16px' }}>
                  <IconEmail />
                </div>

                <h2
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: '24px',
                    fontWeight: 500,
                    color: '#0e0e0d',
                    margin: '0 0 8px',
                  }}
                >
                  Email
                </h2>

                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(14,14,13,0.55)',
                    margin: '0 0 24px',
                    lineHeight: 1.55,
                    fontFamily: 'var(--font-dm-mono), monospace',
                    letterSpacing: '0.02em',
                  }}
                >
                  geral@agencygroup.pt
                </p>

                <a
                  href="mailto:geral@agencygroup.pt"
                  style={{
                    display: 'block',
                    backgroundColor: 'transparent',
                    color: '#0e0e0d',
                    textAlign: 'center',
                    padding: '13px 24px',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    borderRadius: '1px',
                    border: '1px solid #c9a96e',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  Enviar Email
                </a>
              </div>

              {/* Card 3 — Reunião */}
              <div
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(201,169,110,0.2)',
                  borderRadius: '2px',
                  padding: '32px',
                }}
              >
                <div style={{ color: '#1c4a35', marginBottom: '16px' }}>
                  <IconCalendar />
                </div>

                <h2
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: '24px',
                    fontWeight: 500,
                    color: '#0e0e0d',
                    margin: '0 0 8px',
                  }}
                >
                  Reunião Presencial ou Videochamada
                </h2>

                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(14,14,13,0.55)',
                    margin: '0 0 24px',
                    lineHeight: 1.55,
                  }}
                >
                  Lisboa · Cascais · Chamada Zoom/Teams
                </p>

                <a
                  href="mailto:geral@agencygroup.pt?subject=Pedido%20de%20Reuni%C3%A3o"
                  style={{
                    display: 'block',
                    backgroundColor: 'transparent',
                    color: '#0e0e0d',
                    textAlign: 'center',
                    padding: '13px 24px',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    borderRadius: '1px',
                    border: '1px solid #c9a96e',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  Agendar Reunião
                </a>
              </div>

            </div>

            {/* RIGHT COLUMN — Info box */}
            <div
              style={{
                flex: '0 1 340px',
                minWidth: '260px',
                backgroundColor: '#1c4a35',
                borderRadius: '2px',
                padding: '40px 36px',
                color: '#f4f0e6',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-cormorant), serif',
                  fontSize: '28px',
                  fontWeight: 400,
                  color: '#f4f0e6',
                  margin: '0 0 32px',
                  letterSpacing: '0.01em',
                }}
              >
                Informações
              </h3>

              {/* Info rows */}
              {[
                { label: 'Morada', value: 'Lisboa, Portugal' },
                { label: 'Telefone', value: '+351 912 000 000' },
                { label: 'Email', value: 'geral@agencygroup.pt' },
                { label: 'Horário', value: 'Segunda–Sexta 9h–19h\nSábado 10h–14h' },
                { label: 'Licença', value: 'AMI 22506' },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: '20px' }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '9px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: '#c9a96e',
                      margin: '0 0 4px',
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontSize: label === 'Email' ? '12px' : '14px',
                      color: 'rgba(244,240,230,0.85)',
                      margin: 0,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-line',
                      fontFamily: label === 'Email' ? 'var(--font-dm-mono), monospace' : 'inherit',
                      letterSpacing: label === 'Email' ? '0.01em' : 'inherit',
                    } as React.CSSProperties}
                  >
                    {value}
                  </p>
                </div>
              ))}

              {/* Gold separator */}
              <div
                style={{
                  height: '1px',
                  backgroundColor: '#c9a96e',
                  opacity: 0.35,
                  margin: '28px 0',
                }}
                role="separator"
              />

              {/* Zonas */}
              <p
                style={{
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '9px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#c9a96e',
                  margin: '0 0 12px',
                }}
              >
                Zonas de actuação
              </p>

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                {[
                  'Lisboa',
                  'Cascais',
                  'Comporta',
                  'Algarve',
                  'Porto',
                  'Sintra',
                  'Ericeira',
                  'Madeira',
                  'Açores',
                ].map((zona) => (
                  <li
                    key={zona}
                    style={{
                      fontSize: '12px',
                      color: 'rgba(244,240,230,0.72)',
                      backgroundColor: 'rgba(244,240,230,0.07)',
                      padding: '4px 10px',
                      borderRadius: '2px',
                      lineHeight: 1.5,
                    }}
                  >
                    {zona}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </section>

        {/* ── RESPONSE TIME BAR ────────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: '#0c1f15',
            padding: '56px clamp(16px, 5vw, 48px)',
          }}
        >
          <div
            style={{
              maxWidth: '1160px',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-around',
              gap: '32px',
            }}
          >
            {[
              { stat: '< 2h', label: 'Resposta WhatsApp' },
              { stat: '< 24h', label: 'Resposta Email' },
              { stat: '6 Idiomas', label: 'Atendimento internacional' },
              { stat: 'Presencial', label: 'Lisboa e Cascais' },
            ].map(({ stat, label }) => (
              <div
                key={stat}
                style={{
                  textAlign: 'center',
                  flex: '1 1 160px',
                  minWidth: '120px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: 'clamp(28px, 4vw, 40px)',
                    fontWeight: 300,
                    color: '#c9a96e',
                    margin: '0 0 6px',
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {stat}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(244,240,230,0.5)',
                    margin: 0,
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA BOTTOM ───────────────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: '#f4f0e6',
            padding: 'clamp(56px, 8vw, 88px) clamp(16px, 5vw, 48px)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(14,14,13,0.4)',
              margin: '0 0 16px',
            }}
          >
            Explorar
          </p>

          <h2
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 400,
              color: '#0e0e0d',
              margin: '0 0 40px',
              letterSpacing: '-0.01em',
            }}
          >
            Preferes explorar primeiro?
          </h2>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              justifyContent: 'center',
            }}
          >
            <Link
              href="/imoveis"
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                color: '#f4f0e6',
                backgroundColor: '#1c4a35',
                padding: '14px 32px',
                borderRadius: '1px',
                display: 'inline-block',
              }}
            >
              Ver Imóveis →
            </Link>

            <Link
              href="/faq"
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                color: '#0e0e0d',
                backgroundColor: 'transparent',
                padding: '13px 32px',
                borderRadius: '1px',
                border: '1px solid #c9a96e',
                display: 'inline-block',
              }}
            >
              Ver FAQ →
            </Link>
          </div>
        </section>

      </main>
    </>
  )
}
