'use client'
import { useState } from 'react'
import { exportToPDF } from '../utils/export'

interface MaisValiasResult {
  ganho_bruto?: number
  prejuizo?: number
  imposto_estimado: number
  taxa_efetiva: number
  liquido_apos_imposto: number
  poupanca_reinvestimento?: number
  mensagem: string
  breakdown?: { label: string; valor: number; tipo: string }[]
  error?: string
}

export default function PortalMaisvalias() {
  const [precoCompra, setPrecoCompra] = useState('')
  const [anoCompra, setAnoCompra] = useState(2010)
  const [precoVenda, setPrecoVenda] = useState('')
  const [despAq, setDespAq] = useState('')
  const [despVd, setDespVd] = useState('')
  const [obras, setObras] = useState('')
  const [rendimento, setRendimento] = useState('')
  const [residente, setResidente] = useState(true)
  const [hpp, setHpp] = useState(true)
  const [reinvest, setReinvest] = useState(false)
  const [result, setResult] = useState<MaisValiasResult | null>(null)
  const [loading, setLoading] = useState(false)

  const eur = (n: number) => '€ ' + Math.abs(Math.round(n)).toLocaleString('pt-PT')

  async function calcular() {
    if (!precoCompra || !precoVenda) return
    setLoading(true)
    try {
      const res = await fetch('/api/mais-valias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preco_aquisicao: parseFloat(precoCompra),
          preco_venda: parseFloat(precoVenda),
          ano_aquisicao: anoCompra,
          despesas_aquisicao: parseFloat(despAq) || 0,
          despesas_venda: parseFloat(despVd) || 0,
          obras: parseFloat(obras) || 0,
          rendimento_anual: parseFloat(rendimento) || 40000,
          residente,
          habitacao_propria: hpp,
          reinvestimento: reinvest,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch { setResult({ error: 'Erro de ligação. Tenta novamente.', imposto_estimado: 0, taxa_efetiva: 0, liquido_apos_imposto: 0, mensagem: '' }) }
    finally { setLoading(false) }
  }

  function handleExportPDF() {
    if (!result || result.error) return
    const isLoss = (result.prejuizo || 0) > 0
    const html = `
      <div class="label">Simulação Mais-Valias Imobiliárias — ${new Date().toLocaleDateString('pt-PT')}</div>
      <div class="row">
        <div class="card"><div class="label">Mais-Valia Bruta</div><div class="metric" style="color:${isLoss ? '#e05252' : '#1c4a35'}">${isLoss ? '-' : '+'}${eur(isLoss ? (result.prejuizo || 0) : (result.ganho_bruto || 0))}</div></div>
        <div class="card"><div class="label">Imposto Estimado</div><div class="metric" style="color:#e05252">-${eur(result.imposto_estimado)}</div></div>
        <div class="card"><div class="label">Taxa Efectiva</div><div class="metric">${result.taxa_efetiva?.toFixed(1)}%</div></div>
        <div class="card"><div class="label">Líquido Final</div><div class="metric green">${eur(result.liquido_apos_imposto)}</div></div>
      </div>
      <hr class="divider">
      <div style="font-size:.85rem;color:rgba(14,14,13,.6);line-height:1.7;margin-top:12px">${result.mensagem}</div>
    `
    exportToPDF('Simulação Mais-Valias', html)
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>CIRS 2026 · Coeficientes AT · Isenções automáticas</div>
      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: '#0e0e0d', marginBottom: '24px' }}>Simulador <em style={{ color: '#1c4a35' }}>Mais-Valias</em></div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Form */}
        <div className="p-card" style={{ flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label className="p-label">Preço Compra (€)</label>
              <input className="p-inp" type="number" value={precoCompra} onChange={e => setPrecoCompra(e.target.value)} placeholder="ex: 250000" />
            </div>
            <div>
              <label className="p-label">Ano Compra</label>
              <select className="p-sel" value={anoCompra} onChange={e => setAnoCompra(parseInt(e.target.value))}>
                {Array.from({ length: 27 }, (_, i) => 2000 + i).reverse().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="p-label">Preço Venda (€)</label>
            <input className="p-inp" type="number" value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} placeholder="ex: 420000" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label className="p-label">Despesas Compra (€)</label>
              <input className="p-inp" type="number" value={despAq} onChange={e => setDespAq(e.target.value)} placeholder="IMT+IS+Notário" />
            </div>
            <div>
              <label className="p-label">Despesas Venda (€)</label>
              <input className="p-inp" type="number" value={despVd} onChange={e => setDespVd(e.target.value)} placeholder="Comissão+Notário" />
            </div>
          </div>
          <div>
            <label className="p-label">Obras c/ Factura — últimos 12 anos (€)</label>
            <input className="p-inp" type="number" value={obras} onChange={e => setObras(e.target.value)} placeholder="ex: 30000" />
          </div>
          <div>
            <label className="p-label">Rendimento Anual Colectável (€)</label>
            <input className="p-inp" type="number" value={rendimento} onChange={e => setRendimento(e.target.value)} placeholder="ex: 40000" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.75rem', color: 'rgba(14,14,13,.6)' }}>
              <input type="checkbox" checked={residente} onChange={e => setResidente(e.target.checked)} style={{ accentColor: '#1c4a35' }} />
              Residente Fiscal PT
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.75rem', color: 'rgba(14,14,13,.6)' }}>
              <input type="checkbox" checked={hpp} onChange={e => setHpp(e.target.checked)} style={{ accentColor: '#1c4a35' }} />
              Habitação Própria Permanente
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.75rem', color: 'rgba(14,14,13,.6)' }}>
              <input type="checkbox" checked={reinvest} onChange={e => setReinvest(e.target.checked)} style={{ accentColor: '#1c4a35' }} />
              Reinveste em nova HPP
            </label>
          </div>
          <button className="p-btn" onClick={calcular} disabled={loading || !precoCompra || !precoVenda}>
            {loading ? 'A calcular...' : '▶ Calcular Mais-Valias'}
          </button>

          {/* Results inline */}
          {result && !result.error && (() => {
            const isLoss = (result.prejuizo || 0) > 0
            return (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  {[
                    { label: 'Mais-Valia Bruta', val: `${isLoss ? '-' : '+'}${eur(isLoss ? (result.prejuizo || 0) : (result.ganho_bruto || 0))}`, color: isLoss ? '#e05252' : '#1c4a35' },
                    { label: 'Imposto Estimado', val: `-${eur(result.imposto_estimado)}`, color: '#e05252' },
                    { label: 'Taxa Efectiva', val: `${result.taxa_efetiva?.toFixed(1)}%`, color: '#0e0e0d' },
                    { label: 'Líquido Final', val: eur(result.liquido_apos_imposto), color: '#1c4a35' },
                  ].map(m => (
                    <div key={m.label} style={{ padding: '10px 12px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.08)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 600, color: m.color, lineHeight: 1 }}>{m.val}</div>
                    </div>
                  ))}
                  {(result.poupanca_reinvestimento || 0) > 0 && (
                    <div style={{ gridColumn: '1/-1', padding: '10px 12px', background: 'rgba(74,156,122,.06)', border: '1px solid rgba(74,156,122,.2)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Poupança c/ Reinvestimento</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 600, color: '#22c55e', lineHeight: 1 }}>+{eur(result.poupanca_reinvestimento || 0)}</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '.7rem', color: 'rgba(14,14,13,.4)', borderTop: '1px solid rgba(14,14,13,.08)', paddingTop: '10px', lineHeight: 1.6, marginBottom: '10px' }}>{result.mensagem}</div>
                {result.breakdown && result.breakdown.length > 0 && (
                  <details>
                    <summary style={{ fontSize: '.73rem', color: '#1c4a35', cursor: 'pointer' }}>Ver breakdown detalhado</summary>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {result.breakdown.map((b, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.73rem', padding: '5px 8px', background: 'rgba(14,14,13,.02)' }}>
                          <span style={{ color: 'rgba(14,14,13,.55)' }}>{b.label}</span>
                          <span style={{ color: b.tipo === 'positivo' ? '#22c55e' : b.tipo === 'negativo' || b.tipo === 'imposto' ? '#e05252' : b.tipo === 'resultado' ? '#1c4a35' : 'rgba(14,14,13,.6)' }}>
                            {b.valor >= 0 ? '+' : ''}{eur(b.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <button className="p-btn p-btn-gold" style={{ fontSize: '.44rem', padding: '8px 16px', marginTop: '10px' }} onClick={handleExportPDF}>⬇ Exportar PDF</button>
              </div>
            )
          })()}

          {result?.error && (
            <div style={{ color: '#e05252', padding: '12px', border: '1px solid rgba(224,82,82,.2)', fontSize: '.78rem', marginTop: '8px' }}>{result.error}</div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="p-card" style={{ padding: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.28)', marginBottom: '8px' }}>Referência Legal</div>
            {[
              'Coeficientes AT 2026 (Art. 47º CIRS)',
              'Isenção HPP + reinvestimento (Art. 10º/5)',
              'Taxa 28% não-residentes (Art. 72º CIRS)',
              '50% englobamento residentes (Art. 43º)',
              'Dedução obras c/ factura (Art. 51º)',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.73rem', color: 'rgba(14,14,13,.5)', padding: '4px 0', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                <div style={{ width: '5px', height: '5px', background: '#1c4a35', borderRadius: '50%', flexShrink: 0 }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
