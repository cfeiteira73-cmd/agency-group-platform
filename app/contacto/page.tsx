import type { Metadata } from 'next'
import Link from 'next/link'
import HomeNav from '@/app/components/HomeNav'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Contacto · Agency Group — Imobiliário de Luxo Portugal | AMI 22506',
  description:
    'Fale com a Agency Group. Consultores de imobiliário de luxo em Portugal. WhatsApp, email e reunião presencial. Resposta em menos de 2h. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/contacto',
    languages: {
      pt: 'https://www.agencygroup.pt/contacto',
      en: 'https://www.agencygroup.pt/en/contacto',
      'x-default': 'https://www.agencygroup.pt/contacto',
    },
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
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Torre Soleil 1 B, Av. da República 120',
    addressLocality: 'Oeiras',
    postalCode: '2780-158',
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

// ─── Contact channel icons ─────────────────────────────────────────────────────
function IconWhatsApp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function ContactoPage({
  searchParams,
}: {
  searchParams: Promise<{ obrigado?: string; erro?: string }>
}) {
  const params = await searchParams
  const showSuccess = params.obrigado === '1'
  const showError   = typeof params.erro === 'string'

  return (
    <>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Global navigation */}
      <HomeNav />

      {/* Toast banner */}
      {showSuccess && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', top: '72px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#1c4a35', border: '1px solid rgba(201,169,110,.3)', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          <span style={{ color: '#c9a96e', fontSize: '1rem' }}>✓</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: '#f4f0e6', textTransform: 'uppercase' }}>Briefing recebido — contactamos em breve.</span>
        </div>
      )}
      {showError && (
        <div role="alert" style={{ position: 'fixed', top: '72px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: '#2a0a0a', border: '1px solid rgba(255,80,80,.3)', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(255,180,180,.7)', textTransform: 'uppercase' }}>Erro ao enviar. Tente via WhatsApp ou email directamente.</span>
        </div>
      )}

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────────────── */}
        <section
          aria-label="Contacto"
          style={{
            background: '#060d08',
            padding: '140px 40px 96px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 30% 50%, rgba(28,74,53,.2) 0%, transparent 70%)', pointerEvents: 'none' }} aria-hidden="true" />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,169,110,.3), transparent)' }} aria-hidden="true" />

          <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(201,169,110,.65)', marginBottom: '20px' }}>
              AMI 22506 · Contacto Directo
            </div>
            <h1 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(2.8rem, 6vw, 5rem)', color: '#f4f0e6', lineHeight: 1.05, margin: '0 0 20px', letterSpacing: '-.01em' }}>
              Conversa confidencial.<br />
              <em style={{ color: '#c9a96e' }}>Sem compromisso.</em>
            </h1>
            <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: '.95rem', color: 'rgba(244,240,230,.55)', maxWidth: '480px', lineHeight: 1.75, margin: '0 0 48px' }}>
              Respondemos em menos de 2h. WhatsApp é o canal mais rápido. Se preferir, agende uma reunião presencial em Lisboa ou Cascais — ou por videochamada.
            </p>

            {/* Response time stats */}
            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
              {[
                { n: '< 2h', l: 'Resposta WhatsApp' },
                { n: '6', l: 'Idiomas falados' },
                { n: '47+', l: 'Famílias servidas' },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(244,240,230,.3)', marginTop: '5px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONTACT CHANNELS ─────────────────────────────────────────────────── */}
        <section style={{ background: '#0c1f15', padding: '0 40px', borderBottom: '1px solid rgba(201,169,110,.08)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }} className="contact-channels">
            {/* WhatsApp — primary */}
            <a
              href="https://wa.me/351919948986?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20im%C3%B3veis%20em%20Portugal."
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 32px', textDecoration: 'none', borderRight: '1px solid rgba(201,169,110,.1)', position: 'relative', overflow: 'hidden', transition: 'background .2s' }}
              className="contact-channel"
            >
              <div style={{ position: 'absolute', top: '12px', right: '14px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#1c4a35', background: 'rgba(28,74,53,.15)', border: '1px solid rgba(28,74,53,.3)', padding: '3px 8px' }}>
                Recomendado
              </div>
              <div style={{ color: '#25D366', width: '40px', height: '40px', background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconWhatsApp />
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.35rem', fontWeight: 400, color: '#f4f0e6', marginBottom: '6px' }}>WhatsApp</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(201,169,110,.6)' }}>+351 919 948 986</div>
              </div>
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.4)', lineHeight: 1.6, margin: 0 }}>
                Resposta em menos de 2h. Canal preferido para consultas urgentes e off-market.
              </p>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.45)', textTransform: 'uppercase', marginTop: 'auto' }}>
                Iniciar conversa →
              </div>
            </a>

            {/* Email */}
            <a
              href="mailto:geral@agencygroup.pt?subject=Pedido%20de%20Informa%C3%A7%C3%A3o"
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 32px', textDecoration: 'none', borderRight: '1px solid rgba(201,169,110,.1)', transition: 'background .2s' }}
              className="contact-channel"
            >
              <div style={{ color: '#c9a96e', width: '40px', height: '40px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="1" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.35rem', fontWeight: 400, color: '#f4f0e6', marginBottom: '6px' }}>Email</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(201,169,110,.6)' }}>geral@agencygroup.pt</div>
              </div>
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.4)', lineHeight: 1.6, margin: 0 }}>
                Para consultas detalhadas, documentação e propostas formais. Resposta em menos de 24h.
              </p>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.45)', textTransform: 'uppercase', marginTop: 'auto' }}>
                Enviar email →
              </div>
            </a>

            {/* Reunião */}
            <a
              href="mailto:geral@agencygroup.pt?subject=Pedido%20de%20Reuni%C3%A3o"
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 32px', textDecoration: 'none', transition: 'background .2s' }}
              className="contact-channel"
            >
              <div style={{ color: 'rgba(244,240,230,.5)', width: '40px', height: '40px', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(244,240,230,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="1" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.35rem', fontWeight: 400, color: '#f4f0e6', marginBottom: '6px' }}>Reunião</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.3)' }}>Lisboa · Cascais · Zoom</div>
              </div>
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.4)', lineHeight: 1.6, margin: 0 }}>
                Reunião presencial no escritório ou por videochamada. Internacional bem-vindo.
              </p>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.45)', textTransform: 'uppercase', marginTop: 'auto' }}>
                Agendar reunião →
              </div>
            </a>
          </div>

          <style>{`
            .contact-channels { border-top: 1px solid rgba(201,169,110,.08) }
            .contact-channel:hover { background: rgba(201,169,110,.03) !important }
            @media (max-width: 800px) {
              .contact-channels { grid-template-columns: 1fr !important }
              .contact-channel { border-right: none !important; border-bottom: 1px solid rgba(201,169,110,.1) }
              .contact-channel:last-child { border-bottom: none }
            }
          `}</style>
        </section>

        {/* ── INTAKE FORM — Qualify before connecting ────────────────────────── */}
        <section style={{ background: '#f4f0e6', padding: '96px 40px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'start' }} className="intake-grid">

            {/* Left — copy */}
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '20px' }}>
                Briefing Rápido · Opcional
              </div>
              <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#0e0e0d', lineHeight: 1.1, margin: '0 0 20px' }}>
                Diga-nos o que procura.<br />
                <em style={{ fontStyle: 'italic', color: '#1c4a35' }}>Respondemos com exactidão.</em>
              </h2>
              <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: '.9rem', color: 'rgba(14,14,13,.55)', lineHeight: 1.75, marginBottom: '40px' }}>
                Não é obrigatório. Mas quanto mais soubermos, mais pertinente será a primeira conversa. O seu briefing é confidencial e nunca partilhado.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { icon: '→', text: 'Compradores internacionais com NHR/IFICI — resposta nos próximos dias' },
                  { icon: '→', text: 'Investidores com objetivos de yield — análise personalizada' },
                  { icon: '→', text: 'Vendedores — avaliação gratuita em 24h' },
                ].map(item => (
                  <div key={item.text} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#c9a96e', marginTop: '3px', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.55)', lineHeight: 1.55 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — form */}
            <div style={{ background: '#fff', border: '1px solid rgba(201,169,110,.2)', borderTop: '2px solid #c9a96e', padding: '40px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '28px' }}>
                Briefing Confidencial
              </div>
              <form
                method="POST"
                action="/api/contacto"
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                {[
                  { id: 'nome', label: 'Nome', placeholder: 'O seu nome', type: 'text' },
                  { id: 'tel', label: 'Telefone / WhatsApp', placeholder: '+351 ou +1 XXX XXX XXXX', type: 'tel' },
                  { id: 'zona', label: 'Zona de interesse', placeholder: 'Ex: Lisboa, Cascais, Comporta...', type: 'text' },
                ].map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.5)', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                    <input
                      id={f.id}
                      name={f.id}
                      type={f.type}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '1px solid rgba(14,14,13,.18)', fontFamily: "'Jost',sans-serif", fontSize: '.88rem', color: '#0e0e0d', outline: 'none', background: 'transparent', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                {/* Objective */}
                <div>
                  <label htmlFor="objetivo" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.5)', display: 'block', marginBottom: '10px' }}>O que pretende?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} id="objetivo">
                    {['Comprar', 'Vender', 'Investir', 'Arrendar', 'Avaliar'].map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(14,14,13,.55)', padding: '6px 12px', border: '1px solid rgba(14,14,13,.15)', background: 'transparent' }}>
                        <input type="checkbox" name="objetivo" value={opt} style={{ accentColor: '#1c4a35', width: '12px', height: '12px' }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <label htmlFor="orcamento" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.5)', display: 'block', marginBottom: '6px' }}>Orçamento aproximado</label>
                  <select
                    id="orcamento"
                    name="orcamento"
                    defaultValue=""
                    style={{ width: '100%', padding: '12px 0', border: 'none', borderBottom: '1px solid rgba(14,14,13,.18)', fontFamily: "'Jost',sans-serif", fontSize: '.88rem', color: '#0e0e0d', outline: 'none', background: 'transparent', cursor: 'pointer', appearance: 'none' }}
                  >
                    <option value="" disabled>Seleccionar...</option>
                    <option>Até €500K</option>
                    <option>€500K – €1M</option>
                    <option>€1M – €2M</option>
                    <option>€2M – €5M</option>
                    <option>€5M+</option>
                    <option>Prefiro não indicar</option>
                  </select>
                </div>

                <button
                  type="submit"
                  style={{ background: '#1c4a35', color: '#c9a96e', border: 'none', padding: '16px 32px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', marginTop: '8px', width: '100%' }}
                >
                  Enviar Briefing →
                </button>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.06em', color: 'rgba(14,14,13,.3)', textAlign: 'center', marginTop: '4px' }}>
                  Confidencial · Nunca partilhado · Sem spam
                </p>
              </form>
            </div>
          </div>

          <style>{`
            @media (max-width: 820px) {
              .intake-grid { grid-template-columns: 1fr !important; gap: 40px !important }
            }
          `}</style>
        </section>

        {/* ── INFO + TRUST BAR ─────────────────────────────────────────────────── */}
        <section style={{ background: '#0c1f15', padding: '64px 40px', borderTop: '1px solid rgba(201,169,110,.08)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' }} className="info-trust-grid">

            {/* Office info */}
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: '24px' }}>
                Informações · Escritório
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {[
                  { label: 'Morada', value: 'Torre Soleil 1 B, Av. da República 120, 2780-158 Oeiras' },
                  { label: 'Telefone', value: '+351 919 948 986', href: 'tel:+351919948986' },
                  { label: 'Email', value: 'geral@agencygroup.pt', href: 'mailto:geral@agencygroup.pt' },
                  { label: 'Horário', value: 'Seg–Sex 9h–19h · Sáb 10h–14h' },
                  { label: 'Licença', value: 'AMI 22506' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: '16px', paddingBottom: '18px', borderBottom: '1px solid rgba(201,169,110,.06)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', minWidth: '72px', paddingTop: '2px' }}>{item.label}</div>
                    {item.href ? (
                      <a href={item.href} style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.7)', textDecoration: 'none', lineHeight: 1.5 }}>{item.value}</a>
                    ) : (
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.7)', lineHeight: 1.5 }}>{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Trust + zones */}
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: '24px' }}>
                Cobertura · Zonas de Actuação
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '40px' }}>
                {['Lisboa', 'Cascais', 'Comporta', 'Algarve', 'Porto', 'Sintra', 'Arrábida', 'Madeira', 'Açores', 'Ericeira', 'Espanha'].map(zona => (
                  <span key={zona} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,240,230,.5)', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.12)', padding: '5px 10px' }}>
                    {zona}
                  </span>
                ))}
              </div>

              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: '16px' }}>
                Idiomas de Atendimento
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
                {[
                  { flag: '🇵🇹', lang: 'PT' },
                  { flag: '🇬🇧', lang: 'EN' },
                  { flag: '🇫🇷', lang: 'FR' },
                  { flag: '🇩🇪', lang: 'DE' },
                  { flag: '🇸🇦', lang: 'AR' },
                  { flag: '🇨🇳', lang: 'ZH' },
                ].map(l => (
                  <div key={l.lang} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', color: 'rgba(244,240,230,.55)' }}>
                    <span>{l.flag}</span> {l.lang}
                  </div>
                ))}
              </div>

              {/* Google Reviews trust badge */}
              <a
                href="https://www.google.com/search?q=Agency+Group+AMI+22506+avalia%C3%A7%C3%B5es"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Ver avaliações no Google"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid rgba(201,169,110,.15)', textDecoration: 'none' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase' }}>
                  4.8 · 47 avaliações · Google
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(201,169,110,.4)" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>
          </div>

          <style>{`
            .info-trust-grid { border-top: 1px solid rgba(201,169,110,.06); padding-top: 0 }
            @media (max-width: 760px) {
              .info-trust-grid { grid-template-columns: 1fr !important; gap: 40px !important }
            }
          `}</style>
        </section>

        {/* ── EXPLORE CTA ──────────────────────────────────────────────────────── */}
        <section style={{ background: '#060d08', padding: '80px 40px', borderTop: '1px solid rgba(201,169,110,.06)' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '4rem', color: 'rgba(201,169,110,.12)', lineHeight: 0.8, marginBottom: '8px' }}>&ldquo;</div>
            <p style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', color: 'rgba(244,240,230,.7)', lineHeight: 1.4, margin: '0 0 40px' }}>
              Não são estimativas. Não são portfólio de imagens.<br />São transacções reais. €285M+ em volume histórico.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <Link href="/imoveis" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#1c4a35', color: '#c9a96e', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', textDecoration: 'none', padding: '14px 32px' }}>
                Ver Portfólio
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <Link href="/vendidos" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'transparent', color: 'rgba(244,240,230,.5)', border: '1px solid rgba(201,169,110,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', textDecoration: 'none', padding: '13px 32px' }}>
                Track Record →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
