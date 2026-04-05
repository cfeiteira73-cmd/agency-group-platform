'use client'
import { useState } from 'react'

interface FinResult {
  country?: { flag: string; difficulty: string }
  financiamento?: {
    ltv_max_pct: number
    entrada_minima: number
    capital_maximo: number
    spread_tipico_pct: number
    prazo_max_anos: number
  }
  prestacoes?: {
    cenario_tipico: number
  }
  acessibilidade?: { dsti_ok: boolean; nota: string }
  notas?: string[]
  islamic_finance?: boolean
  bancos_recomendados?: string[]
  error?: string
}

export default function PortalFinanciamento() {
  const [pais, setPais] = useState('FR')
  const [montante, setMontante] = useState('')
  const [prazo, setPrazo] = useState(25)
  const [rendimento, setRendimento] = useState('')
  const [result, setResult] = useState<FinResult | null>(null)
  const [loading, setLoading] = useState(false)

  const eur = (n: number) => '€ ' + Math.round(n).toLocaleString('pt-PT')

  async function calcular() {
    if (!montante) return
    setLoading(true)
    try {
      const res = await fetch('/api/financing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: pais,
          montante: parseFloat(montante),
          prazo,
          rendimento_anual: parseFloat(rendimento) || undefined,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch { setResult({ error: 'Erro de ligação. Tenta novamente.' }) }
    finally { setLoading(false) }
  }

  const PAISES = [
    { value: 'FR', label: '🇫🇷 França' },
    { value: 'DE', label: '🇩🇪 Alemanha' },
    { value: 'GB', label: '🇬🇧 Reino Unido' },
    { value: 'US', label: '🇺🇸 Estados Unidos' },
    { value: 'CN', label: '🇨🇳 China' },
    { value: 'AE', label: '🇦🇪 Emirados Árabes' },
    { value: 'BR', label: '🇧🇷 Brasil' },
    { value: 'SA', label: '🇸🇦 Arábia Saudita' },
    { value: 'CA', label: '🇨🇦 Canadá' },
    { value: 'AU', label: '🇦🇺 Austrália' },
    { value: 'OTHER', label: '🌍 Outro país' },
  ]

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>10 Países · LTV · Spreads · Islamic Finance</div>
      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: '#0e0e0d', marginBottom: '24px' }}>Crédito <em style={{ color: '#1c4a35' }}>para Estrangeiros</em></div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Form */}
        <div className="p-card" style={{ flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label className="p-label">País de Residência</label>
            <select className="p-sel" value={pais} onChange={e => setPais(e.target.value)}>
              {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label className="p-label">Valor do Imóvel (€)</label>
              <input className="p-inp" type="number" value={montante} onChange={e => setMontante(e.target.value)} placeholder="ex: 500000" />
            </div>
            <div>
              <label className="p-label">Prazo (anos)</label>
              <select className="p-sel" value={prazo} onChange={e => setPrazo(parseInt(e.target.value))}>
                {[10, 15, 20, 25, 30].map(y => <option key={y} value={y}>{y} anos</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="p-label">Rendimento Anual Bruto (€) — opcional</label>
            <input className="p-inp" type="number" value={rendimento} onChange={e => setRendimento(e.target.value)} placeholder="ex: 80000" />
          </div>
          <button className="p-btn" onClick={calcular} disabled={loading || !montante}>
            {loading ? 'A calcular...' : '▶ Calcular Crédito'}
          </button>

          {result && result.error && (
            <div style={{ color: '#e05252', padding: '12px', border: '1px solid rgba(224,82,82,.2)', fontSize: '.78rem', marginTop: '8px' }}>{result.error}</div>
          )}

          {result && !result.error && result.financiamento && result.prestacoes && (() => {
            const f = result.financiamento!
            const p = result.prestacoes!
            const diff = result.country?.difficulty || ''
            const diffColor = diff === 'Fácil' ? '#22c55e' : diff === 'Moderado' ? '#c6a868' : diff === 'Difícil' ? '#e09552' : '#e05252'
            return (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.4rem' }}>{result.country?.flag}</span>
                  <span style={{ fontSize: '.72rem', color: diffColor, border: `1px solid ${diffColor}`, padding: '2px 10px', borderRadius: '20px' }}>{diff}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'LTV Máximo', val: `${f.ltv_max_pct}%`, color: '#1c4a35' },
                    { label: 'Entrada Mínima', val: eur(f.entrada_minima), color: '#0e0e0d' },
                    { label: 'Capital Máximo', val: eur(f.capital_maximo), color: '#0e0e0d' },
                    { label: 'Spread Típico', val: `${f.spread_tipico_pct}%`, color: '#0e0e0d' },
                    { label: 'Prestação/mês', val: eur(p.cenario_tipico), color: '#1c4a35' },
                    { label: 'Prazo Máximo', val: `${f.prazo_max_anos} anos`, color: '#0e0e0d' },
                  ].map(m => (
                    <div key={m.label} style={{ padding: '10px 12px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.08)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 600, color: m.color, lineHeight: 1 }}>{m.val}</div>
                    </div>
                  ))}
                </div>
                {result.acessibilidade && (
                  <div style={{ padding: '8px', background: `rgba(${result.acessibilidade.dsti_ok ? '34,197,94' : '224,82,82'},.07)`, fontSize: '.73rem', color: 'rgba(14,14,13,.6)', marginBottom: '10px', borderRadius: '4px' }}>
                    {result.acessibilidade.nota}
                  </div>
                )}
                {result.notas && result.notas.length > 0 && (
                  <details style={{ marginBottom: '10px' }}>
                    <summary style={{ fontSize: '.72rem', color: '#1c4a35', cursor: 'pointer' }}>Documentação necessária</summary>
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {result.notas.map((n, i) => (
                        <div key={i} style={{ fontSize: '.72rem', color: 'rgba(14,14,13,.5)', display: 'flex', gap: '7px' }}>
                          <span style={{ color: '#1c4a35', flexShrink: 0 }}>›</span>{n}
                        </div>
                      ))}
                      {result.islamic_finance && (
                        <div style={{ fontSize: '.72rem', color: '#c6a868', background: 'rgba(198,168,104,.08)', padding: '5px 8px', borderRadius: '3px', marginTop: '3px' }}>☽ Islamic Finance disponível</div>
                      )}
                    </div>
                  </details>
                )}
                {result.bancos_recomendados && (
                  <div style={{ fontSize: '.68rem', color: 'rgba(14,14,13,.3)', borderTop: '1px solid rgba(14,14,13,.06)', paddingTop: '7px' }}>
                    Bancos: {result.bancos_recomendados.join(' · ')}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Info panel */}
        <div style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="p-card" style={{ padding: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.28)', marginBottom: '8px' }}>LTV por Origem</div>
            {[
              { flags: '🇫🇷🇩🇪🇧🇷', label: 'França · Alemanha · Brasil', ltv: 'até 80%' },
              { flags: '🇬🇧🇦🇪🇸🇦', label: 'UK · Emirados · Arábia Saudita', ltv: 'até 70%' },
              { flags: '🇺🇸🇨🇦🇦🇺', label: 'EUA · Canadá · Austrália', ltv: '65–70%' },
              { flags: '🇨🇳', label: 'China', ltv: 'até 60%' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.73rem', padding: '5px 0', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                <div style={{ color: 'rgba(14,14,13,.5)' }}>{r.flags} {r.label}</div>
                <div style={{ color: '#1c4a35', fontWeight: 600 }}>{r.ltv}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
