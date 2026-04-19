'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function VenderClient() {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', zona: '', tipologia: '', valor: '', urgencia: '' })
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
          zona: form.zona, source: 'vender-page', intent: 'seller' as const,
          message: `Tipologia: ${form.tipologia} | Valor: ${form.valor} | Urgência: ${form.urgencia}`,
          utm_source: 'direct',
        }),
      })
      setSent(true)
    } catch {
      // fail silently — WhatsApp fallback below
    } finally {
      setLoading(false)
    }
  }

  const PROCESS = [
    { n: '01', title: 'Avaliação Confidencial', desc: 'Análise do imóvel, dados de mercado actuais e estimativa de preço fundamentada. Sem compromisso, sem partilha de dados.' },
    { n: '02', title: 'Estratégia de Venda', desc: 'Decidimos juntos: off-market exclusivo, portfólio selecto ou mercado aberto. Nunca exposição desnecessária.' },
    { n: '03', title: 'Compradores Qualificados', desc: 'Apresentamos apenas compradores verificados — financeiramente qualificados, com interesse real no perfil do imóvel.' },
    { n: '04', title: 'Negociação e CPCV', desc: 'Conduzimos a negociação. Redigimos ou coordenamos o CPCV. Garantimos 50% na assinatura.' },
    { n: '05', title: 'Escritura', desc: 'Acompanhamos até ao último passo. Coordenação com notário, advogado e banco. Restantes 50% na escritura.' },
  ]

  const STATS = [
    { val: '94', sup: 'dias', label: 'Tempo médio de venda' },
    { val: '€42', sup: 'M+', label: 'Em vendas concluídas' },
    { val: '4.8', sup: '/5', label: 'Avaliação dos clientes' },
    { val: '100', sup: '%', label: 'CPCV sem falha' },
  ]

  const BUYERS = [
    { flag: '🇺🇸', country: 'EUA', pct: '16%', zone: 'Lisboa · Cascais · Algarve' },
    { flag: '🇫🇷', country: 'França', pct: '13%', zone: 'Lisboa · Porto · Costa' },
    { flag: '🇬🇧', country: 'Reino Unido', pct: '9%', zone: 'Cascais · Algarve · Madeira' },
    { flag: '🇨🇳', country: 'China', pct: '8%', zone: 'Lisboa · Cascais' },
    { flag: '🇧🇷', country: 'Brasil', pct: '6%', zone: 'Lisboa · Porto · Madeira' },
    { flag: '🇩🇪', country: 'Alemanha', pct: '5%', zone: 'Algarve · Porto · Lisboa' },
    { flag: '🇸🇦', country: 'Médio Oriente', pct: '—', zone: 'Lisboa Prime · Comporta' },
    { flag: '🇧🇪', country: 'Outros Europa', pct: '—', zone: 'Todas as zonas' },
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
          <Link href="/off-market" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Off-Market</Link>
          <Link href="/reports" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Reports</Link>
          <Link href="/contacto" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>Contacto</Link>
          <Link href="/portal/login" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.58rem', letterSpacing: '.14em', color: '#0c1f15', background: '#c9a96e', padding: '10px 18px', textDecoration: 'none', textTransform: 'uppercase' }}>Área Agentes</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 40px 96px' }}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <div style={{ maxWidth: '720px', marginBottom: '96px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '20px' }}>
            Venda exclusiva · Agency Group · AMI 22506
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.6rem, 5vw, 4.2rem)', color: '#f4f0e6', margin: '0 0 28px', lineHeight: 1.1, letterSpacing: '-.01em' }}>
            Venda ao preço certo.<br/>
            <em>Sem exposição</em> desnecessária.
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.9rem', color: 'rgba(244,240,230,.6)', lineHeight: 1.75, marginBottom: '36px', maxWidth: '560px' }}>
            Compradores de 40+ países verificados na nossa base. Processo discreto do início à escritura. Comissão de 5% — 50% no CPCV, 50% na escritura.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a href="#avaliacao" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', background: '#c9a96e', color: '#0c1f15', padding: '14px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '48px', fontWeight: 600 }}>
              Pedir Avaliação Gratuita
            </a>
            <a href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, gostaria de saber mais sobre vender o meu imóvel com a Agency Group.')}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', background: 'transparent', color: '#c9a96e', padding: '14px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '48px', border: '1px solid rgba(201,169,110,.35)' }}>
              WhatsApp Directo →
            </a>
          </div>
        </div>

        {/* ── STATS ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'rgba(201,169,110,.1)', marginBottom: '96px', border: '1px solid rgba(201,169,110,.1)' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ background: '#0c1f15', padding: '36px 28px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '2.8rem', color: '#c9a96e', lineHeight: 1 }}>
                {s.val}<span style={{ fontSize: '1.2rem', color: 'rgba(201,169,110,.6)' }}>{s.sup}</span>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase', marginTop: '8px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── PROCESS ──────────────────────────────────────── */}
        <div style={{ marginBottom: '96px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '48px' }}>
            O Nosso Processo
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {PROCESS.map((p, i) => (
              <div key={p.n} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '32px', padding: '32px 0', borderTop: i === 0 ? '1px solid rgba(201,169,110,.12)' : 'none', borderBottom: '1px solid rgba(201,169,110,.12)', alignItems: 'start' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '3rem', color: 'rgba(201,169,110,.2)', lineHeight: 1, paddingTop: '4px' }}>{p.n}</div>
                <div>
                  <h3 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 500, fontSize: '.8rem', letterSpacing: '.08em', color: '#f4f0e6', margin: '0 0 10px', textTransform: 'uppercase' }}>{p.title}</h3>
                  <p style={{ fontFamily: "'Jost', sans-serif", fontWeight: 300, fontSize: '.8rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.7, margin: 0 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BUYERS ───────────────────────────────────────── */}
        <div style={{ marginBottom: '96px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>
                A Nossa Base de Compradores
              </div>
              <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.2 }}>
                44% dos compradores<br/>são <em>internacionais</em>
              </h2>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.75, marginBottom: '28px' }}>
                Portugal é hoje um dos mercados imobiliários mais internacionalizados da Europa. A Agency Group tem acesso directo a compradores verificados em 40+ países — antes de sequer publicar o seu imóvel.
              </p>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.58rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.7)', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.15)', padding: '16px 20px', lineHeight: 1.6 }}>
                Os seus compradores já existem. <br/>Nós temos os seus contactos.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(201,169,110,.1)' }}>
              {BUYERS.map(b => (
                <div key={b.country} style={{ background: '#0c1f15', display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '16px', padding: '14px 20px', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.2rem' }}>{b.flag}</span>
                  <div>
                    <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: '#f4f0e6', marginBottom: '2px' }}>{b.country}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>{b.zone}</div>
                  </div>
                  {b.pct !== '—' && <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: '#c9a96e' }}>{b.pct}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── FORM ─────────────────────────────────────────── */}
        <div id="avaliacao" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>
              Avaliação Gratuita
            </div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.2 }}>
              Quanto vale<br/>o seu imóvel <em>hoje</em>?
            </h2>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.75, marginBottom: '32px' }}>
              Resposta em menos de 24 horas. Avaliação fundamentada com dados de mercado reais — não estimativas automáticas. Sem compromisso.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: '🔒', text: 'Confidencialidade total — os seus dados nunca são partilhados' },
                { icon: '📊', text: 'Comparáveis reais, não AVMs automáticos' },
                { icon: '⚡', text: 'Resposta em menos de 24h por um advisor senior' },
                { icon: '💶', text: 'Sem custos, sem compromisso' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.6 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {sent ? (
            <div style={{ background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '3rem', color: '#c9a96e', fontWeight: 300 }}>✓</div>
              <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.8rem', color: '#f4f0e6', margin: 0 }}>Pedido recebido</h3>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.7, margin: 0 }}>
                Um advisor senior entrará em contacto em menos de 24 horas com a avaliação fundamentada do seu imóvel.
              </p>
              <a
                href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, acabei de submeter um pedido de avaliação no vosso site.')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '.58rem', letterSpacing: '.14em', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '12px 24px', textDecoration: 'none', textTransform: 'uppercase', marginTop: '8px' }}
              >
                WhatsApp para resposta imediata →
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField label="Nome completo" name="nome" type="text" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required />
              <FormField label="Telefone" name="telefone" type="tel" value={form.telefone} onChange={v => setForm(f => ({ ...f, telefone: v }))} required />
              <FormField label="Email" name="email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <SelectField label="Tipologia" name="tipologia" value={form.tipologia} onChange={v => setForm(f => ({ ...f, tipologia: v }))} options={['T1','T2','T3','T4','T5','T6+','Moradia','Villa','Quinta','Penthouse','Terreno']} />
                <SelectField label="Zona" name="zona" value={form.zona} onChange={v => setForm(f => ({ ...f, zona: v }))} options={['Lisboa','Cascais','Comporta','Porto','Algarve','Madeira','Sintra','Ericeira','Arrábida','Outra']} />
              </div>
              <SelectField label="Valor estimado" name="valor" value={form.valor} onChange={v => setForm(f => ({ ...f, valor: v }))} options={['<€500K','€500K–€1M','€1M–€2M','€2M–€5M','€5M–€10M','>€10M','Não sei']} />
              <SelectField label="Quando pretende vender?" name="urgencia" value={form.urgencia} onChange={v => setForm(f => ({ ...f, urgencia: v }))} options={['Urgente (<3 meses)','Em 3–6 meses','Em 6–12 meses','Ainda a avaliar']} />
              <button
                type="submit"
                disabled={loading}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', background: loading ? 'rgba(201,169,110,.5)' : '#c9a96e', color: '#0c1f15', padding: '16px 28px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, minHeight: '52px', marginTop: '8px' }}
              >
                {loading ? 'A enviar...' : 'Pedir Avaliação Gratuita →'}
              </button>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                Os seus dados são tratados com confidencialidade absoluta. RGPD compliant.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, name, type, value, onChange, required }: {
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

function SelectField({ label, name, value, onChange, options }: {
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
