'use client'
import { useState } from 'react'

const ZONAS = ['Lisboa','Cascais','Sintra','Comporta','Algarve','Porto','Madeira','Açores','Ericeira','Alentejo','Douro','Outro']
const TIPOS = ['Apartamento','Moradia','Penthouse','Villa','Quinta','Herdade','Terreno','Comercial']

export default function ParceirosPage() {
  const [step, setStep] = useState<'landing'|'form'|'success'>('landing')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    agencyName: '', agencyAMI: '', agencyEmail: '', agencyPhone: '',
    nome: '', zona: '', bairro: '', tipo: 'Apartamento',
    preco: '', area: '', quartos: '', casasBanho: '',
    vista: '', piscina: false, garagem: false, jardim: false, terraco: false,
    desc: '', tourUrl: '', features: '',
  })

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.agencyName || !form.agencyAMI || !form.agencyEmail || !form.nome || !form.zona || !form.preco || !form.area) {
      setError('Por favor preenche todos os campos obrigatórios.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          preco: Number(form.preco),
          area: Number(form.area),
          quartos: Number(form.quartos) || 2,
          casasBanho: Number(form.casasBanho) || 1,
          features: form.features.split('\n').filter(Boolean),
        }),
      })
      const data = await res.json()
      if (data.success) setStep('success')
      else setError(data.error || 'Erro ao submeter. Tenta novamente.')
    } catch {
      setError('Erro de ligação. Tenta novamente.')
    } finally {
      setSending(false)
    }
  }

  const G = '#c9a96e'
  const BG = '#080f0a'
  const CARD = 'rgba(255,255,255,.04)'
  const BORDER = 'rgba(201,169,110,.15)'

  return (
    <main style={{ background: BG, minHeight: '100vh', color: '#f4f0e6', fontFamily: "'Jost', sans-serif" }}>
      <style>{`
        .pg-input { background: rgba(255,255,255,.04); border: 1px solid rgba(201,169,110,.2); color: #f4f0e6; padding: 12px 16px; font-family: 'Jost', sans-serif; font-size: .85rem; width: 100%; outline: none; transition: border .2s; box-sizing: border-box; }
        .pg-input:focus { border-color: rgba(201,169,110,.6); }
        .pg-input::placeholder { color: rgba(244,240,230,.3); }
        .pg-input option { background: #0a1a0e; color: #f4f0e6; }
        .pg-label { font-size: .7rem; letter-spacing: .12em; color: rgba(201,169,110,.7); text-transform: uppercase; margin-bottom: 6px; display: block; }
        .pg-btn { background: #c9a96e; color: #0c1f15; border: none; padding: 16px 40px; font-family: 'Jost', sans-serif; font-size: .8rem; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; cursor: pointer; transition: opacity .2s; }
        .pg-btn:hover { opacity: .88; }
        .pg-btn:disabled { opacity: .4; cursor: not-allowed; }
        .pg-btn-outline { background: transparent; color: #c9a96e; border: 1px solid rgba(201,169,110,.4); padding: 14px 36px; font-family: 'Jost', sans-serif; font-size: .75rem; font-weight: 600; letter-spacing: .15em; text-transform: uppercase; cursor: pointer; transition: all .2s; }
        .pg-btn-outline:hover { background: rgba(201,169,110,.08); border-color: rgba(201,169,110,.7); }
        .fade-in { animation: fadeIn .5s ease; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
        .stat-num { font-size: 2.2rem; font-weight: 700; color: #c9a96e; font-family: 'DM Mono', monospace; }
        .check-item::before { content: '✓'; color: #c9a96e; margin-right: 10px; font-weight: 700; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', fontWeight: 800, color: '#0c1f15', letterSpacing: '.1em' }}>AG</div>
          <span style={{ fontSize: '.75rem', letterSpacing: '.2em', color: 'rgba(244,240,230,.6)', textTransform: 'uppercase' }}>Agency Group · Parcerias</span>
        </a>
        <a href="tel:+351919948986" style={{ color: G, textDecoration: 'none', fontSize: '.75rem', letterSpacing: '.08em' }}>+351 919 948 986</a>
      </nav>

      {step === 'landing' && (
        <div className="fade-in">
          {/* ── HERO ── */}
          <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 40px 60px', textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', letterSpacing: '.25em', color: G, textTransform: 'uppercase', marginBottom: 20 }}>Programa de Parceria · Co-Mediação</div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 24 }}>
              Os seus imóveis.<br />
              <span style={{ color: G }}>Os nossos compradores internacionais.</span>
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'rgba(244,240,230,.65)', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 40px' }}>
              A Agency Group tem acesso directo a compradores americanos, franceses, britânicos e do Médio Oriente à procura de imóveis premium em Portugal. Partilhamos a comissão 50/50.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="pg-btn" onClick={() => setStep('form')}>Submeter Imóvel</button>
              <a href="https://wa.me/351919948986?text=Olá, gostaria de saber mais sobre parcerias" target="_blank" rel="noopener noreferrer" className="pg-btn-outline">Falar Connosco</a>
            </div>
          </section>

          {/* ── STATS ── */}
          <section style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 40, textAlign: 'center' }}>
              {[
                { n: '€500K–€3M', l: 'Segmento core' },
                { n: '16%', l: 'Compradores americanos' },
                { n: '13%', l: 'Compradores franceses' },
                { n: '2,5%', l: 'Comissão AG na partilha' },
                { n: '24/7', l: 'Avatar IA activo' },
                { n: '6', l: 'Línguas de atendimento' },
              ].map(s => (
                <div key={s.n}>
                  <div className="stat-num">{s.n}</div>
                  <div style={{ fontSize: '.7rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.45)', textTransform: 'uppercase', marginTop: 6 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section style={{ maxWidth: 900, margin: '0 auto', padding: '72px 40px' }}>
            <div style={{ fontSize: '.65rem', letterSpacing: '.25em', color: G, textTransform: 'uppercase', marginBottom: 16 }}>Como funciona</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 48 }}>3 passos. Sem complicações.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
              {[
                { n: '01', title: 'Submete o imóvel', desc: 'Preenche o formulário com os detalhes do imóvel. Revisão em 24h.' },
                { n: '02', title: 'Nós apresentamos', desc: 'O nosso avatar IA apresenta o imóvel aos compradores internacionais em 6 línguas, 24/7.' },
                { n: '03', title: 'Partilhamos o sucesso', desc: 'Negócio fechado = 2,5% para si + 2,5% para nós. Contrato de partilha assinado antes de qualquer visita.' },
              ].map(s => (
                <div key={s.n} style={{ background: CARD, border: `1px solid ${BORDER}`, padding: '32px 28px' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.65rem', color: G, letterSpacing: '.2em', marginBottom: 12 }}>{s.n}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 12 }}>{s.title}</div>
                  <div style={{ fontSize: '.85rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.65 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── WHAT YOU GET ── */}
          <section style={{ background: 'rgba(201,169,110,.04)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
              <div>
                <div style={{ fontSize: '.65rem', letterSpacing: '.25em', color: G, textTransform: 'uppercase', marginBottom: 16 }}>O que a sua agência recebe</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 32 }}>Exposição que não consegue sozinho.</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    'Acesso a compradores internacionais qualificados (EUA, França, UK, Médio Oriente)',
                    'Apresentação em vídeo IA em 6 línguas, disponível 24/7',
                    'Virtual tour e galeria de fotos em destaque',
                    'Qualificação prévia do comprador (orçamento, financiamento, timeline)',
                    'Contrato de co-mediação antes de qualquer contacto com cliente',
                    'Sem custos fixos — só pagamos na escritura',
                  ].map(item => (
                    <div key={item} className="check-item" style={{ fontSize: '.85rem', color: 'rgba(244,240,230,.75)', lineHeight: 1.55 }}>{item}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '.65rem', letterSpacing: '.25em', color: G, textTransform: 'uppercase', marginBottom: 16 }}>Termos da parceria</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 32 }}>Simples e transparente.</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Divisão comissão', value: '50% / 50%' },
                    { label: 'Comissão total ao cliente', value: '5% + IVA (cobrada por si)' },
                    { label: 'AG recebe', value: '2,5% líquido' },
                    { label: 'Contrato', value: 'Co-mediação assinado antes de visita' },
                    { label: 'Pagamento', value: 'Na escritura' },
                    { label: 'Exclusividade', value: 'Não obrigatória' },
                    { label: 'Requisito', value: 'AMI válido e activo' },
                  ].map(t => (
                    <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, paddingBottom: 12 }}>
                      <span style={{ fontSize: '.8rem', color: 'rgba(244,240,230,.5)' }}>{t.label}</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#f4f0e6' }}>{t.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── WHO WE TARGET ── */}
          <section style={{ maxWidth: 900, margin: '0 auto', padding: '72px 40px' }}>
            <div style={{ fontSize: '.65rem', letterSpacing: '.25em', color: G, textTransform: 'uppercase', marginBottom: 16 }}>O nosso comprador</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 40 }}>Quem compramos para si.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { flag: '🇺🇸', pais: 'Norte-Americanos', pct: '16%', budget: '€800K–€3M', note: 'NHR/IFICI + lifestyle' },
                { flag: '🇫🇷', pais: 'Franceses', pct: '13%', budget: '€600K–€2M', note: 'Fiscalidade + clima' },
                { flag: '🇬🇧', pais: 'Britânicos', pct: '9%', budget: '€500K–€1.5M', note: 'Algarve + Lisboa' },
                { flag: '🇨🇳', pais: 'Chineses', pct: '8%', budget: '€500K–€2M', note: 'Investimento + residência' },
                { flag: '🇧🇷', pais: 'Brasileiros', pct: '6%', budget: '€300K–€1M', note: 'Língua + cultura' },
                { flag: '🇸🇦', pais: 'Médio Oriente', pct: '8%', budget: '€1M–€10M', note: 'HNWI + family offices' },
              ].map(b => (
                <div key={b.pais} style={{ background: CARD, border: `1px solid ${BORDER}`, padding: '24px 20px' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{b.flag}</div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 4 }}>{b.pais}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.7rem', color: G, marginBottom: 6 }}>{b.pct} dos compradores</div>
                  <div style={{ fontSize: '.75rem', color: 'rgba(244,240,230,.45)' }}>{b.budget}</div>
                  <div style={{ fontSize: '.7rem', color: 'rgba(244,240,230,.35)', marginTop: 4 }}>{b.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <section style={{ background: `linear-gradient(135deg, rgba(201,169,110,.1), rgba(201,169,110,.03))`, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 40px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 16 }}>Pronto para crescer juntos?</h2>
              <p style={{ color: 'rgba(244,240,230,.55)', marginBottom: 40, lineHeight: 1.7 }}>
                Submeta o primeiro imóvel gratuitamente. Sem compromisso, sem custos fixos.<br />Só partilhamos quando o negócio fecha.
              </p>
              <button className="pg-btn" style={{ fontSize: '.85rem', padding: '18px 48px' }} onClick={() => setStep('form')}>
                Submeter Imóvel Agora →
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── FORM ── */}
      {step === 'form' && (
        <div className="fade-in" style={{ maxWidth: 760, margin: '0 auto', padding: '60px 40px' }}>
          <button onClick={() => setStep('landing')} style={{ background: 'none', border: 'none', color: 'rgba(244,240,230,.4)', cursor: 'pointer', fontSize: '.75rem', letterSpacing: '.1em', marginBottom: 32, padding: 0 }}>← Voltar</button>
          <div style={{ fontSize: '.65rem', letterSpacing: '.25em', color: G, textTransform: 'uppercase', marginBottom: 12 }}>Submissão de Imóvel</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 8 }}>Dados do Imóvel</h1>
          <p style={{ color: 'rgba(244,240,230,.45)', marginBottom: 48, fontSize: '.85rem' }}>Revemos em 24h. Após aprovação, o imóvel fica activo no nosso sistema e é apresentado pelo avatar IA.</p>

          {/* Agency Info */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: '.7rem', letterSpacing: '.2em', color: G, textTransform: 'uppercase', marginBottom: 20, paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>1. Dados da Agência</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="pg-label">Nome da Agência *</label>
                <input className="pg-input" placeholder="Ex: Imobiliária Lisboa" value={form.agencyName} onChange={e => set('agencyName', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Número AMI *</label>
                <input className="pg-input" placeholder="Ex: 12345" value={form.agencyAMI} onChange={e => set('agencyAMI', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Email *</label>
                <input className="pg-input" type="email" placeholder="geral@agencia.pt" value={form.agencyEmail} onChange={e => set('agencyEmail', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Telefone / WhatsApp</label>
                <input className="pg-input" placeholder="+351 9XX XXX XXX" value={form.agencyPhone} onChange={e => set('agencyPhone', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Property Info */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: '.7rem', letterSpacing: '.2em', color: G, textTransform: 'uppercase', marginBottom: 20, paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>2. Dados do Imóvel</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pg-label">Designação / Nome *</label>
                <input className="pg-input" placeholder="Ex: Villa Contemporânea com Piscina" value={form.nome} onChange={e => set('nome', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Zona *</label>
                <select className="pg-input" value={form.zona} onChange={e => set('zona', e.target.value)}>
                  <option value="">Selecionar zona</option>
                  {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="pg-label">Bairro / Localidade</label>
                <input className="pg-input" placeholder="Ex: Cascais Centro" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Tipo de Imóvel *</label>
                <select className="pg-input" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="pg-label">Preço (€) *</label>
                <input className="pg-input" type="number" placeholder="Ex: 1250000" value={form.preco} onChange={e => set('preco', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Área (m²) *</label>
                <input className="pg-input" type="number" placeholder="Ex: 180" value={form.area} onChange={e => set('area', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Quartos</label>
                <input className="pg-input" type="number" placeholder="Ex: 3" value={form.quartos} onChange={e => set('quartos', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Casas de banho</label>
                <input className="pg-input" type="number" placeholder="Ex: 2" value={form.casasBanho} onChange={e => set('casasBanho', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Vista principal</label>
                <input className="pg-input" placeholder="Ex: mar, jardim, cidade, golfe" value={form.vista} onChange={e => set('vista', e.target.value)} />
              </div>
              <div>
                <label className="pg-label">Link Virtual Tour / Matterport</label>
                <input className="pg-input" placeholder="https://..." value={form.tourUrl} onChange={e => set('tourUrl', e.target.value)} />
              </div>
            </div>

            {/* Checkboxes */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
              {[
                { k: 'piscina', l: '🏊 Piscina' },
                { k: 'garagem', l: '🚗 Garagem' },
                { k: 'jardim', l: '🌿 Jardim' },
                { k: 'terraco', l: '🏡 Terraço' },
              ].map(c => (
                <label key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.8rem', color: 'rgba(244,240,230,.7)' }}>
                  <input type="checkbox" checked={form[c.k as keyof typeof form] as boolean} onChange={e => set(c.k, e.target.checked)}
                    style={{ accentColor: G, width: 16, height: 16 }} />
                  {c.l}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="pg-label">Descrição</label>
              <textarea className="pg-input" rows={3} placeholder="Descrição breve do imóvel (opcional — podemos gerar com IA)" value={form.desc} onChange={e => set('desc', e.target.value)} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="pg-label">Características principais (uma por linha)</label>
              <textarea className="pg-input" rows={4} placeholder={'Piscina aquecida\nVista mar\nGaragem 2 carros\nRenovado 2024'} value={form.features} onChange={e => set('features', e.target.value)} style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Terms */}
          <div style={{ background: 'rgba(201,169,110,.05)', border: `1px solid ${BORDER}`, padding: 20, marginBottom: 32, fontSize: '.78rem', lineHeight: 1.65, color: 'rgba(244,240,230,.55)' }}>
            Ao submeter este imóvel, confirma que a sua agência detém AMI válido e activo, e que tem o mandato necessário para apresentar este imóvel a compradores. A Agency Group irá preparar um contrato de co-mediação antes de qualquer apresentação a clientes. A comissão será dividida 50/50 (2,5% + 2,5%) no momento da escritura.
          </div>

          {error && (
            <div style={{ background: 'rgba(231,76,60,.1)', border: '1px solid rgba(231,76,60,.3)', padding: '12px 16px', color: '#e74c3c', fontSize: '.8rem', marginBottom: 24 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button className="pg-btn" onClick={submit} disabled={sending}>
              {sending ? 'A enviar...' : 'Submeter Imóvel →'}
            </button>
            <button className="pg-btn-outline" onClick={() => setStep('landing')}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {step === 'success' && (
        <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto', padding: '100px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 24 }}>✅</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 16 }}>Imóvel Recebido!</h1>
          <p style={{ color: 'rgba(244,240,230,.55)', lineHeight: 1.7, marginBottom: 40 }}>
            A Agency Group irá rever os dados e contactá-lo em <strong style={{ color: '#f4f0e6' }}>24 horas</strong>.<br />
            Após aprovação, o imóvel fica activo no nosso sistema e é apresentado pelo avatar IA aos nossos compradores internacionais.
          </p>
          <div style={{ background: 'rgba(201,169,110,.05)', border: `1px solid ${BORDER}`, padding: '24px 28px', marginBottom: 40, textAlign: 'left' }}>
            <div style={{ fontSize: '.7rem', letterSpacing: '.15em', color: G, textTransform: 'uppercase', marginBottom: 16 }}>Próximos passos</div>
            {[
              'Receberá email de confirmação em breve',
              'Revisão e aprovação em até 24h',
              'Envio do contrato de co-mediação para assinatura',
              'Imóvel activo no sistema e apresentado pelo avatar IA',
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '.82rem', color: 'rgba(244,240,230,.65)' }}>
                <span style={{ color: G, fontFamily: "'DM Mono', monospace", fontSize: '.7rem', flexShrink: 0 }}>0{i + 1}</span>
                {s}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="pg-btn" onClick={() => { setStep('form'); setForm({ agencyName: form.agencyName, agencyAMI: form.agencyAMI, agencyEmail: form.agencyEmail, agencyPhone: form.agencyPhone, nome: '', zona: '', bairro: '', tipo: 'Apartamento', preco: '', area: '', quartos: '', casasBanho: '', vista: '', piscina: false, garagem: false, jardim: false, terraco: false, desc: '', tourUrl: '', features: '' }) }}>
              Submeter Outro Imóvel
            </button>
            <a href="/" className="pg-btn-outline" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Voltar ao Site</a>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontSize: '.7rem', color: 'rgba(244,240,230,.3)', letterSpacing: '.08em' }}>Agency Group · AMI 22506 · Co-Mediação Imobiliária</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="mailto:geral@agencygroup.pt" style={{ color: 'rgba(244,240,230,.3)', textDecoration: 'none', fontSize: '.7rem' }}>geral@agencygroup.pt</a>
          <a href="https://wa.me/351919948986" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(244,240,230,.3)', textDecoration: 'none', fontSize: '.7rem' }}>WhatsApp</a>
        </div>
      </footer>
    </main>
  )
}
