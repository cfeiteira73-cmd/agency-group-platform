'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'

// Exact shape returned by /api/avm
interface AVMResult {
  success: boolean
  estimativa: number
  rangeMin: number
  rangeMax: number
  pm2: number
  pm2_zona: number
  pm2_ask_zona: number
  premium_discount: string
  confianca: 'alta' | 'média' | 'baixa'
  score_confianca: number
  fatores: Array<{ label: string; impacto: string; positivo: boolean }>
  metodologias: Array<{ valor: number; peso: number; label: string; descricao: string }>
  investimento: {
    renda_mensal_estimada: number
    renda_anual: number
    yield_bruta_pct: number
    custos_anuais: number
    renda_liquida_anual: number
    yield_liquida_pct: number
    imi_anual: number
    roi_5anos_pct: number
    roi_10anos_pct: number
    valor_5anos: number
    valor_10anos: number
    prestacao_credito_estimada: number
    euribor_6m: number
  }
  mercado: {
    trend_yoy_pct: number
    trend_qtq_pct: number
    days_market: number
    demand_score: number
    liquidez: string
    region: string
  }
  comparaveis: Array<{
    ref: string
    zona: string
    tipo: string
    area: number
    andar: string
    estado: string
    valor: number
    pm2: number
    meses_mercado: number
  }>
  formatted: {
    estimativa: string
    range: string
    pm2: string
    renda: string
    yield_bruta: string
  }
  forecast_6m: {
    priceMin: number
    priceMax: number
    pm2: number
    changePercent: number
    confidence: number
    methodology: string
  }
  accuracy: {
    mape: number
    label: string
    sampleSize: number
    lastCalibrated: string
    source: string
  }
  fonte: string
  data: string
}

export default function AVMPage() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<AVMResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')
    setResult(null)

    const form = e.currentTarget

    // Map form fields to the exact field names the API expects (AVMSchema)
    const zona     = (form.elements.namedItem('zona')     as HTMLInputElement).value.trim()
    const tipo     = (form.elements.namedItem('tipo')     as HTMLSelectElement).value
    const area     = Number((form.elements.namedItem('area') as HTMLInputElement).value)
    const estado   = (form.elements.namedItem('estado')   as HTMLSelectElement).value
    const lead_name  = (form.elements.namedItem('lead_name')  as HTMLInputElement).value.trim()
    const lead_email = (form.elements.namedItem('lead_email') as HTMLInputElement).value.trim()

    const payload: Record<string, unknown> = { zona, tipo, area, estado }
    if (lead_name)  payload.lead_name  = lead_name
    if (lead_email) payload.lead_email = lead_email

    try {
      const res = await fetch('/api/avm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'server_error')
      }
      setResult(json as AVMResult)
      setState('success')
    } catch (err) {
      setState('error')
      setErrorMsg(
        err instanceof Error && err.message !== 'server_error'
          ? err.message
          : 'Erro ao processar avaliação. Verifique os dados e tente novamente.'
      )
    }
  }

  // ─── Shared styles ───────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '0.88rem',
    fontWeight: 300,
    color: '#f4f0e6',
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(201,169,110,0.25)',
    borderRadius: '3px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-dm-mono), monospace',
    fontSize: '0.58rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(201,169,110,0.8)',
    marginBottom: '6px',
  }

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column' as const,
  }

  const navNode = (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '18px 48px', backgroundColor: 'rgba(12,31,21,0.96)',
      backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', lineHeight: 1, gap: '1px' }}>
        <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 300, fontSize: '0.88rem', letterSpacing: '0.44em', textTransform: 'uppercase', color: '#c9a96e' }}>Agency</span>
        <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 300, fontSize: '0.54rem', letterSpacing: '0.68em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.55)' }}>Group</span>
      </Link>
      <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.5rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,0.3)' }}>
        AMI 22506
      </span>
    </nav>
  )

  // ─── Success state ───────────────────────────────────────────────────────────

  if (state === 'success' && result) {
    const fmt = (n: number) =>
      new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

    const confiancaColor = result.confianca === 'alta'
      ? '#4ade80'
      : result.confianca === 'média'
        ? '#facc15'
        : '#f87171'

    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#0c1f15', paddingTop: '80px' }}>
        {navNode}

        <section style={{ maxWidth: '680px', margin: '0 auto', padding: '80px 32px 60px' }}>
          {/* Success header */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '64px', height: '64px', borderRadius: '50%',
              backgroundColor: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)',
              marginBottom: '24px',
            }}>
              <span style={{ fontSize: '1.6rem' }}>✓</span>
            </div>
            <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.5)', marginBottom: '12px' }}>
              Avaliação Concluída
            </div>
            <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 300, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: '#f4f0e6', margin: 0, lineHeight: 1.1 }}>
              Valor Estimado do Imóvel
            </h1>
          </div>

          {/* Main value card */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,110,0.25)',
            padding: '40px', marginBottom: '16px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,0.35)', marginBottom: '16px' }}>
              Intervalo de Avaliação
            </div>
            {/* Range */}
            <div style={{
              fontFamily: 'var(--font-cormorant), serif', fontWeight: 300,
              fontSize: 'clamp(1.6rem, 4vw, 2.6rem)', color: '#c9a96e', lineHeight: 1, marginBottom: '8px',
            }}>
              {fmt(result.rangeMin)} — {fmt(result.rangeMax)}
            </div>
            {/* Mid (estimativa) */}
            <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 300, fontSize: '0.82rem', color: 'rgba(244,240,230,0.45)', marginBottom: '28px' }}>
              Valor central:{' '}
              <strong style={{ color: '#f4f0e6', fontWeight: 500 }}>{fmt(result.estimativa)}</strong>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'rgba(201,169,110,0.1)' }}>
              {[
                { label: '€/m² estimado',      val: result.formatted.pm2 },
                { label: 'Confiança',            val: result.confianca, color: confiancaColor },
                { label: 'Zona / Região',        val: result.mercado.region },
                { label: 'Margem de erro',       val: result.accuracy.label },
                { label: 'Renda est. mensal',    val: result.formatted.renda },
                { label: 'Yield bruta',          val: result.formatted.yield_bruta },
                { label: 'Valor em 5 anos',      val: fmt(result.investimento.valor_5anos) },
                { label: 'Dias em mercado (zona)', val: `~${result.mercado.days_market} dias` },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ backgroundColor: 'rgba(12,31,21,0.8)', padding: '16px' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.5)', marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 500, fontSize: '0.82rem', color: color ?? '#f4f0e6' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Forecast card */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,110,0.15)',
            padding: '24px', marginBottom: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.45)', marginBottom: '14px' }}>
              Previsão 6 Meses
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-jost)', fontSize: '0.82rem', color: 'rgba(244,240,230,0.5)' }}>
                  {fmt(result.forecast_6m.priceMin)} — {fmt(result.forecast_6m.priceMax)}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.62rem', fontWeight: 600,
                color: result.forecast_6m.changePercent >= 0 ? '#4ade80' : '#f87171',
                letterSpacing: '0.08em',
              }}>
                {result.forecast_6m.changePercent >= 0 ? '+' : ''}{result.forecast_6m.changePercent}% tendência
              </div>
            </div>
          </div>

          {/* Premium/discount vs zone */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,110,0.12)',
            padding: '16px 20px', marginBottom: '24px',
          }}>
            <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.4)', marginBottom: '6px' }}>
              Posicionamento na zona
            </div>
            <div style={{ fontFamily: 'var(--font-jost)', fontSize: '0.82rem', color: 'rgba(244,240,230,0.65)' }}>
              {result.premium_discount}
            </div>
          </div>

          {/* Disclaimer */}
          <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.08em', color: 'rgba(244,240,230,0.25)', textAlign: 'center', lineHeight: 1.7, marginBottom: '32px' }}>
            {result.fonte}<br />
            Avaliação automática — não substitui avaliação presencial certificada.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a
              href="https://wa.me/351919948986?text=Ol%C3%A1%2C%20fiz%20uma%20avalia%C3%A7%C3%A3o%20AVM%20e%20gostaria%20de%20uma%20avalia%C3%A7%C3%A3o%20presencial"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                backgroundColor: '#25d366', color: '#ffffff', textDecoration: 'none',
                padding: '15px 32px', fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
                borderRadius: '3px',
              }}
            >
              <span aria-hidden="true">💬</span> Avaliação Presencial Gratuita
            </a>
            <button
              type="button"
              onClick={() => { setState('idle'); setResult(null) }}
              style={{
                display: 'block', width: '100%', background: 'none',
                border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(244,240,230,0.45)',
                padding: '13px 32px', fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
                borderRadius: '3px',
              }}
            >
              Nova Avaliação
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ─── Main form ───────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0c1f15' }}>
      {navNode}

      {/* Hero */}
      <section style={{
        backgroundColor: '#0c1f15', paddingTop: '120px', paddingBottom: '72px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 80% at 20% 50%, rgba(201,169,110,0.06), transparent), radial-gradient(ellipse 40% 60% at 80% 20%, rgba(28,74,53,0.3), transparent)',
        }} />
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', backgroundColor: 'rgba(201,169,110,0.1)',
            border: '1px solid rgba(201,169,110,0.25)', color: '#c9a96e',
            fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.48rem', letterSpacing: '0.22em',
            textTransform: 'uppercase', padding: '5px 16px', marginBottom: '24px',
          }}>
            IA · Dados Reais · Gratuito
          </div>
          <h1 style={{
            fontFamily: 'var(--font-cormorant), serif', fontWeight: 300,
            fontSize: 'clamp(2rem, 5vw, 3.4rem)', color: '#f4f0e6',
            lineHeight: 1.08, margin: '0 0 20px',
          }}>
            Avaliação Automática<br />
            <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>de Imóvel</em>
          </h1>
          <p style={{
            fontFamily: 'var(--font-jost), sans-serif', fontWeight: 300,
            fontSize: '0.92rem', color: 'rgba(244,240,230,0.5)', lineHeight: 1.8,
            maxWidth: '520px', margin: '0 auto 36px',
          }}>
            O nosso modelo de IA analisa mais de 169.000 transacções reais do mercado português para
            estimar o valor do seu imóvel com uma margem de ±4,2%. Resultado imediato, sem compromisso.
          </p>

          {/* Trust strip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' }}>
            {['Baseado em +169.000 transacções', 'Margem ±4,2%', '100% Gratuito'].map((item, i) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {i > 0 && <span style={{ color: 'rgba(201,169,110,0.3)', fontSize: '0.7rem' }}>·</span>}
                <span style={{
                  fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.55)',
                }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form section */}
      <section style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(201,169,110,0.08)', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '56px 32px 0' }}>
          <div style={{
            fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(201,169,110,0.45)', marginBottom: '32px', textAlign: 'center',
          }}>
            Preencha os dados do imóvel
          </div>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Zona */}
            <div style={fieldStyle}>
              <label htmlFor="avm-zona" style={labelStyle}>Zona / Localização *</label>
              <input
                id="avm-zona"
                name="zona"
                type="text"
                required
                placeholder="Ex: Lisboa — Príncipe Real"
                list="avm-zona-list"
                style={inputStyle}
                aria-label="Zona ou localização do imóvel"
              />
              <datalist id="avm-zona-list">
                {[
                  'Lisboa','Lisboa — Chiado','Lisboa — Príncipe Real','Lisboa — Bairro Alto',
                  'Lisboa — Estrela / Lapa','Lisboa — Santos','Lisboa — Alfama / Mouraria',
                  'Lisboa — Campo de Ourique','Lisboa — Avenidas Novas','Lisboa — Alvalade',
                  'Lisboa — Parque das Nações','Lisboa — Belém / Restelo','Lisboa — Beato / Marvila',
                  'Lisboa — Alcântara','Cascais','Cascais — Centro','Cascais — Quinta da Marinha',
                  'Estoril','Sintra','Oeiras','Porto','Porto — Foz do Douro','Porto — Boavista',
                  'Porto — Bonfim','Porto — Cedofeita','Porto — Ribeira / Miragaia','Matosinhos',
                  'Matosinhos — Mar','Vila Nova de Gaia','Algarve','Quinta do Lago','Vale do Lobo',
                  'Vilamoura','Loulé / Almancil','Lagos','Portimão','Albufeira','Tavira','Faro',
                  'Comporta','Melides','Madeira','Madeira — Funchal','Madeira — Funchal Centro',
                  'Madeira — Calheta','Açores','Açores — Ponta Delgada','Braga','Coimbra','Aveiro',
                ].map(z => <option key={z} value={z} />)}
              </datalist>
            </div>

            {/* Tipo + Area grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={fieldStyle}>
                <label htmlFor="avm-tipo" style={labelStyle}>Tipologia *</label>
                <select
                  id="avm-tipo"
                  name="tipo"
                  required
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  aria-label="Tipologia do imóvel"
                >
                  <option value="">— Seleccionar —</option>
                  <option value="T0">T0</option>
                  <option value="T1">T1</option>
                  <option value="T2">T2</option>
                  <option value="T3">T3</option>
                  <option value="T4">T4</option>
                  <option value="T4+">T4+</option>
                  <option value="T5+">T5+</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Villa">Villa</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="Terreno">Terreno</option>
                </select>
              </div>

              <div style={fieldStyle}>
                <label htmlFor="avm-area" style={labelStyle}>Área Bruta (m²) *</label>
                <input
                  id="avm-area"
                  name="area"
                  type="number"
                  min="10"
                  max="50000"
                  required
                  placeholder="120"
                  style={inputStyle}
                  aria-label="Área em metros quadrados"
                />
              </div>
            </div>

            {/* Estado */}
            <div style={fieldStyle}>
              <label htmlFor="avm-estado" style={labelStyle}>Estado de Conservação *</label>
              <select
                id="avm-estado"
                name="estado"
                required
                style={{ ...inputStyle, cursor: 'pointer' }}
                aria-label="Estado de conservação do imóvel"
              >
                <option value="">— Seleccionar —</option>
                <option value="Nova Construção">Nova Construção</option>
                <option value="Recém Remodelado">Recém Remodelado</option>
                <option value="Excelente">Excelente</option>
                <option value="Bom">Bom</option>
                <option value="Médio">Médio</option>
                <option value="Para Recuperar">Para Recuperar</option>
                <option value="Ruína">Ruína</option>
              </select>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(201,169,110,0.1)', paddingTop: '4px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(244,240,230,0.2)', marginBottom: '16px' }}>
                Enviar resultado para (opcional)
              </div>
            </div>

            {/* Name + Email grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={fieldStyle}>
                <label htmlFor="avm-lead-name" style={labelStyle}>Nome</label>
                <input
                  id="avm-lead-name"
                  name="lead_name"
                  type="text"
                  placeholder="João Silva"
                  style={inputStyle}
                  aria-label="Nome"
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="avm-lead-email" style={labelStyle}>Email</label>
                <input
                  id="avm-lead-email"
                  name="lead_email"
                  type="email"
                  placeholder="joao@email.com"
                  style={inputStyle}
                  aria-label="Email"
                />
              </div>
            </div>

            {/* Error */}
            {state === 'error' && (
              <p style={{
                fontFamily: 'var(--font-jost), sans-serif', fontSize: '0.82rem',
                color: '#f87171', margin: 0,
              }}>
                {errorMsg}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={state === 'loading'}
              style={{
                width: '100%', padding: '16px 32px',
                backgroundColor: state === 'loading' ? 'rgba(201,169,110,0.5)' : '#c9a96e',
                color: '#0c1f15', border: 'none', borderRadius: '3px',
                fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.72rem',
                fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                marginTop: '4px',
              }}
            >
              {state === 'loading' ? 'A calcular valor…' : 'Obter Avaliação Gratuita →'}
            </button>

            {/* Disclaimer */}
            <p style={{
              fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.52rem',
              letterSpacing: '0.08em', color: 'rgba(244,240,230,0.2)',
              textAlign: 'center', lineHeight: 1.7, margin: 0,
            }}>
              Confidencial · Sem compromisso · Resultado imediato<br />
              Baseado em dados reais do mercado português 2026
            </p>
          </form>
        </div>
      </section>

      {/* Bottom trust strip */}
      <section style={{
        backgroundColor: '#0c1f15', borderTop: '1px solid rgba(201,169,110,0.08)',
        padding: '32px',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '32px' }}>
          {[
            { num: '169K+', label: 'Transacções analisadas' },
            { num: '±4,2%', label: 'Margem de erro' },
            { num: '100%', label: 'Gratuito e imediato' },
            { num: 'AMI 22506', label: 'Licenciado IMPIC' },
          ].map(({ num, label }) => (
            <div key={num} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 300, fontSize: '1.6rem', color: '#c9a96e', lineHeight: 1 }}>
                {num}
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.46rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(244,240,230,0.3)', marginTop: '4px' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#040806', padding: '32px',
        textAlign: 'center', borderTop: '1px solid rgba(201,169,110,0.06)',
      }}>
        <p style={{
          fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.44rem',
          letterSpacing: '0.1em', color: 'rgba(244,240,230,0.18)', lineHeight: 2, margin: 0,
        }}>
          <Link href="/" style={{ color: 'rgba(201,169,110,0.4)', textDecoration: 'none' }}>Agency Group</Link>
          {' '}· AMI 22506 · +351 919 948 986 ·{' '}
          <a href="mailto:geral@agencygroup.pt" style={{ color: 'rgba(201,169,110,0.4)', textDecoration: 'none' }}>geral@agencygroup.pt</a>
          <br />
          © 2026 Agency Group – Mediação Imobiliária Lda · Avaliação automática com margem ±4,2% · Não substitui avaliação certificada
        </p>
      </footer>
    </main>
  )
}
