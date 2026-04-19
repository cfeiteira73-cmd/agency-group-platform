'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function InvestirClient() {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', budget: '', perfil: '', zona: '' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.nome, email: form.email, phone: form.telefone,
          zona: form.zona, source: 'investir-page', intent: 'investor' as const,
          message: `Budget: ${form.budget} | Perfil: ${form.perfil}`,
          utm_source: 'direct',
        }),
      })
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  const YIELDS = [
    { zona: 'Ericeira', yield: '6.0%', tipo: 'Turismo sazonal', trend: '↑', note: 'World Surf Reserve · AL premium' },
    { zona: 'Porto', yield: '5.1%', tipo: 'Residencial + AL', trend: '↑', note: 'Foz Douro · Bonfim premium' },
    { zona: 'Comporta', yield: '5.8%', tipo: 'Turismo ecológico', trend: '↑', note: 'Procura superior à oferta' },
    { zona: 'Algarve', yield: '4.8%', tipo: 'Turismo + longa duração', trend: '→', note: 'Vale do Lobo · Quinta do Lago' },
    { zona: 'Madeira', yield: '4.5%', tipo: 'Residencial + turismo', trend: '↑', note: 'IFICI elegível · NHR' },
    { zona: 'Lisboa', yield: '4.2%', tipo: 'Residencial', trend: '→', note: 'Capital appreciation dominante' },
  ]

  const STRATEGIES = [
    {
      icon: '🏘️',
      title: 'Buy-to-Rent',
      desc: 'Compra para arrendamento residencial de longa duração. Yield 3–5%. Estabilidade, procura estrutural e benefícios fiscais NHR para compradores internacionais.',
      metrics: ['Yield 3–5%', 'Risco baixo', 'Liquidez 6–18 meses'],
    },
    {
      icon: '🌿',
      title: 'Turismo Premium',
      desc: 'Alojamento local de luxo em zonas de procura turística intensa. Yield 5–7%. Comporta, Ericeira, Algarve prime e Madeira com retornos superiores ao residencial.',
      metrics: ['Yield 5–7%', 'Gestão delegada', 'Liquidez 3–12 meses'],
    },
    {
      icon: '🔨',
      title: 'Value-Add',
      desc: 'Reabilitação de imóveis em zonas consolidadas de valorização. Margem 20–40% em 12–24 meses. Para perfis activos com capacidade de execução.',
      metrics: ['Margem 20–40%', 'Prazo 12–24m', 'Capital intensivo'],
    },
    {
      icon: '🏗️',
      title: 'Desenvolvimento',
      desc: 'Terrenos e projectos de construção nova em zonas premium. Para family offices e investidores institucionais com ticket €1M+.',
      metrics: ['Ticket €1M+', 'IRR 15–25%', 'Prazo 24–48m'],
    },
  ]

  const FISCAL = [
    { regime: 'NHR / IFICI', desc: '10 anos de benefício fiscal. Taxa flat 20% sobre rendimentos de fonte portuguesa. Para novos residentes.', tag: 'Residentes' },
    { regime: 'IFICI Técnicos', desc: 'Regime especial para profissionais altamente qualificados. Isenção de IRS sobre rendimentos de actividades de valor acrescentado.', tag: 'Profissionais' },
    { regime: 'IMT — HPP', desc: 'Isenção de IMT (até €97.064 em 2026) para Habitação Própria Permanente. Poupança imediata na aquisição.', tag: 'Aquisição' },
    { regime: 'Mais-Valias', desc: 'Tributação reduzida (50% do ganho) para residentes sobre mais-valias imobiliárias. Reinvestimento isento para HPP.', tag: 'Venda' },
  ]

  const TESTIMONIALS = [
    { name: 'Mohammed A.', country: '🇸🇦 Arábia Saudita', quote: 'Penthouse no Príncipe Real como investimento. O retorno superou todas as projecções.', property: 'Penthouse T4 · Lisboa · €3.1M', yield: '4.8% yield' },
    { name: 'Marc & Isabelle F.', country: '🇫🇷 França', quote: '5.1% de rentabilidade no primeiro ano. Porto foi a melhor decisão de investimento da nossa vida.', property: 'Apartamento T3 · Porto · €890K', yield: '5.1% yield' },
    { name: 'Chen W. & Li M.', country: '🇨🇳 China', quote: 'A Comporta era o nosso sonho. Encontraram a propriedade certa. No dia da escritura soubemos que tínhamos chegado.', property: 'Quinta T6 · Comporta · €5.2M', yield: '+28% valorização' },
  ]

  return (
    <div style={{ background: '#0c1f15', minHeight: '100vh', color: '#f4f0e6' }}>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(12,31,21,.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: '68px' }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.25rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <Link href="/imoveis" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Imóveis</Link>
          <Link href="/vender" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Vender</Link>
          <Link href="/reports" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Reports</Link>
          <Link href="/contacto" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Contacto</Link>
          <Link href="/portal/login" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.58rem', letterSpacing: '.14em', color: '#0c1f15', background: '#c9a96e', padding: '10px 18px', textDecoration: 'none', textTransform: 'uppercase' }}>Área Agentes</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 40px 96px' }}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <div style={{ maxWidth: '800px', marginBottom: '96px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '20px' }}>
            Investimento Imobiliário · Portugal · AMI 22506
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.6rem, 5vw, 4.2rem)', color: '#f4f0e6', margin: '0 0 28px', lineHeight: 1.1, letterSpacing: '-.01em' }}>
            Portugal. O melhor mercado<br/>
            imobiliário da Europa <em>para investir.</em>
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.9rem', color: 'rgba(244,240,230,.6)', lineHeight: 1.75, marginBottom: '36px', maxWidth: '620px' }}>
            +17.6% de valorização em 2025. Yield médio 4–6%. Top 5 Mundial de Luxo (Savills). NHR/IFICI até 10 anos. A combinação perfeita para capital preservation e crescimento real.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a href="#consulta" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', background: '#c9a96e', color: '#0c1f15', padding: '14px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '48px', fontWeight: 600 }}>
              Consulta de Investimento →
            </a>
            <Link href="/reports" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', background: 'transparent', color: '#c9a96e', padding: '14px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '48px', border: '1px solid rgba(201,169,110,.35)' }}>
              Ver Relatórios de Mercado
            </Link>
          </div>
        </div>

        {/* ── YIELD TABLE ──────────────────────────────────── */}
        <div style={{ marginBottom: '96px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Yields por Zona · 2026
          </div>
          <div style={{ border: '1px solid rgba(201,169,110,.12)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr', background: 'rgba(201,169,110,.06)', padding: '12px 24px', borderBottom: '1px solid rgba(201,169,110,.12)' }}>
              {['Zona', 'Yield', 'Tipo', 'Nota'].map(h => (
                <div key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {YIELDS.map((y, i) => (
              <div key={y.zona} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr', padding: '18px 24px', borderBottom: i < YIELDS.length - 1 ? '1px solid rgba(201,169,110,.07)' : 'none', alignItems: 'center' }}>
                <div style={{ fontFamily: "'Jost', sans-serif", fontWeight: 500, fontSize: '.8rem', color: '#f4f0e6' }}>{y.zona}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', color: '#c9a96e', fontWeight: 300 }}>{y.yield}</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: 'rgba(244,240,230,.5)' }}>{y.tipo}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.35)', letterSpacing: '.06em' }}>{y.note}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', marginTop: '12px', lineHeight: 1.6 }}>
            Yields brutos anuais. Dados Agency Group Research 2026. Valores indicativos — sujeitos a localização exacta, tipologia e condição do imóvel.
          </p>
        </div>

        {/* ── STRATEGIES ───────────────────────────────────── */}
        <div style={{ marginBottom: '96px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Estratégias de Investimento
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {STRATEGIES.map(s => (
              <div key={s.title} style={{ background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)', padding: '28px' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '16px' }}>{s.icon}</div>
                <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.4rem', color: '#f4f0e6', margin: '0 0 12px' }}>{s.title}</h3>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.7, margin: '0 0 20px' }}>{s.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {s.metrics.map(m => (
                    <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '4px', height: '4px', background: '#c9a96e', flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase' }}>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FISCAL ───────────────────────────────────────── */}
        <div style={{ marginBottom: '96px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>
                Vantagens Fiscais
              </div>
              <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.2 }}>
                Portugal tem o regime<br/>fiscal <em>mais favorável</em><br/>da Europa Ocidental.
              </h2>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.75 }}>
                NHR/IFICI, isenções de IMT, tributação reduzida de mais-valias. Para investidores internacionais, Portugal é uma das jurisdições fiscais mais eficientes de toda a Europa.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {FISCAL.map(f => (
                <div key={f.regime} style={{ background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 500, fontSize: '.8rem', color: '#f4f0e6', margin: 0 }}>{f.regime}</h4>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.7)', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.18)', padding: '3px 8px', textTransform: 'uppercase', flexShrink: 0, marginLeft: '12px' }}>{f.tag}</span>
                  </div>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TESTIMONIALS ─────────────────────────────────── */}
        <div style={{ marginBottom: '96px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Investidores Agency Group
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(201,169,110,.1)', padding: '28px' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: 'rgba(201,169,110,.4)', marginBottom: '12px', lineHeight: 1 }}>&ldquo;</div>
                <p style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.1rem', color: 'rgba(244,240,230,.8)', lineHeight: 1.55, margin: '0 0 20px', fontStyle: 'italic' }}>{t.quote}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(201,169,110,.1)' }}>
                  <div>
                    <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: '#f4f0e6', marginBottom: '3px' }}>{t.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>{t.country}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: '#c9a96e' }}>{t.yield}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>{t.property.split('·').pop()?.trim()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FORM ─────────────────────────────────────────── */}
        <div id="consulta" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>
              Consulta de Investimento
            </div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.2 }}>
              Fale com um<br/><em>advisor de investimento</em>
            </h2>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.75, marginBottom: '28px' }}>
              Apresentamos oportunidades alinhadas com o seu perfil de risco, horizonte temporal e objectivos de retorno. Acesso a operações off-market não disponíveis ao público.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { icon: '🔐', text: 'Acesso a oportunidades off-market exclusivas' },
                { icon: '📊', text: 'Análise de rentabilidade personalizada por zona' },
                { icon: '⚖️', text: 'Coordenação com advogado e gestão fiscal' },
                { icon: '🌍', text: 'Suporte em EN, FR, PT, ES, ZH' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '.9rem', flexShrink: 0, marginTop: '2px' }}>{item.icon}</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.6 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {sent ? (
            <div style={{ background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '3rem', color: '#c9a96e', fontWeight: 300 }}>✓</div>
              <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.8rem', color: '#f4f0e6', margin: 0 }}>Consulta solicitada</h3>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.7, margin: 0 }}>
                Um advisor de investimento entrará em contacto em menos de 24 horas com oportunidades alinhadas ao seu perfil.
              </p>
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, acabei de submeter uma consulta de investimento no vosso site.')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '.58rem', letterSpacing: '.14em', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '12px 24px', textDecoration: 'none', textTransform: 'uppercase', marginTop: '8px' }}
              >
                WhatsApp para resposta imediata →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <IFormField label="Nome" name="nome" type="text" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required />
              <IFormField label="Email" name="email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
              <IFormField label="Telefone / WhatsApp" name="telefone" type="tel" value={form.telefone} onChange={v => setForm(f => ({ ...f, telefone: v }))} />
              <ISelectField label="Budget disponível" name="budget" value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} options={['€100K–€500K','€500K–€1M','€1M–€3M','€3M–€10M','€10M+']} />
              <ISelectField label="Perfil de investimento" name="perfil" value={form.perfil} onChange={v => setForm(f => ({ ...f, perfil: v }))} options={['Buy-to-Rent (yield estável)','Turismo premium (yield alto)','Value-Add (reabilitação)','Desenvolvimento / Terrenos','Portfolio diversificado']} />
              <ISelectField label="Zona preferencial" name="zona" value={form.zona} onChange={v => setForm(f => ({ ...f, zona: v }))} options={['Lisboa','Cascais','Comporta','Porto','Algarve','Madeira','Ericeira','Sem preferência']} />
              <button
                type="submit"
                disabled={loading}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', background: loading ? 'rgba(201,169,110,.5)' : '#c9a96e', color: '#0c1f15', padding: '16px 28px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, minHeight: '52px', marginTop: '8px' }}
              >
                {loading ? 'A enviar...' : 'Solicitar Consulta de Investimento →'}
              </button>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                Confidencialidade garantida. RGPD compliant. AMI 22506.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function IFormField({ label, name, type, value, onChange, required }: {
  label: string; name: string; type: string; value: string; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.5rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</label>
      <input
        type={type} name={name} value={value} required={required}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: 'rgba(244,240,230,.04)', border: '1px solid rgba(201,169,110,.18)', color: '#f4f0e6', fontFamily: "'Jost', sans-serif", fontSize: '.8rem', padding: '12px 14px', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function ISelectField({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.5rem', letterSpacing: '.16em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</label>
      <select
        name={name} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: '#0c1f15', border: '1px solid rgba(201,169,110,.18)', color: value ? '#f4f0e6' : 'rgba(244,240,230,.35)', fontFamily: "'Jost', sans-serif", fontSize: '.8rem', padding: '12px 14px', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
      >
        <option value="">Seleccionar</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
