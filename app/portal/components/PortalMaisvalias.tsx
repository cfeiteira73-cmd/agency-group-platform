'use client'
import { useState } from 'react'
import { exportToPDF } from '../utils/export'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── SVG Waterfall Chart ──────────────────────────────────────────────────────

interface WaterfallBar {
  label: string
  value: number
  type: 'start' | 'positive' | 'negative' | 'total'
  color: string
  sublabel?: string
}

function WaterfallChart({ bars }: { bars: WaterfallBar[] }) {
  const W = 520, H = 200
  const padL = 56, padR = 16, padT = 12, padB = 36
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const maxVal = Math.max(...bars.map(b => Math.abs(b.value)))
  const fmt = (n: number) => {
    const abs = Math.abs(n)
    return abs >= 1e6 ? `€${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `€${Math.round(abs / 1000)}K` : `€${Math.round(abs)}`
  }

  const barW = Math.min(60, (chartW / bars.length) * 0.65)
  const barGap = chartW / bars.length

  // Compute running y positions
  let running = 0
  const computed = bars.map(b => {
    const start = b.type === 'start' ? 0 : b.type === 'total' ? 0 : running
    const end = b.type === 'start' ? b.value : b.type === 'total' ? b.value : running + b.value
    if (b.type !== 'total') running = end
    const top = Math.min(start, end)
    const bot = Math.max(start, end)
    return { ...b, start, end, top, bot }
  })

  const allVals = computed.flatMap(b => [b.top, b.bot])
  const dataMax = Math.max(...allVals, 1)
  const dataMin = Math.min(...allVals, 0)
  const dataRange = dataMax - dataMin || 1

  const sy = (v: number) => padT + chartH - ((v - dataMin) / dataRange) * chartH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-label="Cálculo mais-valias em cascata">
      {/* Y axis gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const v = dataMin + f * dataRange
        const y = sy(v)
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(14,14,13,.06)" strokeWidth="1" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.35)">{fmt(v)}</text>
          </g>
        )
      })}

      {/* Zero line */}
      {dataMin < 0 && dataMax > 0 && (
        <line x1={padL} y1={sy(0)} x2={W - padR} y2={sy(0)} stroke="rgba(14,14,13,.2)" strokeWidth="1" strokeDasharray="3,2" />
      )}

      {/* Bars */}
      {computed.map((b, i) => {
        const x = padL + i * barGap + (barGap - barW) / 2
        const topY = sy(b.top)
        const botY = sy(b.bot)
        const barH = Math.max(2, Math.abs(topY - botY))
        const yPos = Math.min(topY, botY)
        const valY = b.value >= 0 ? yPos - 3 : yPos + barH + 10

        return (
          <g key={i}>
            {/* Connector line to previous */}
            {i > 0 && b.type !== 'start' && b.type !== 'total' && (
              <line
                x1={padL + (i - 1) * barGap + (barGap + barW) / 2}
                y1={sy(computed[i - 1].end)}
                x2={x}
                y2={sy(computed[i - 1].end)}
                stroke="rgba(14,14,13,.15)"
                strokeWidth="1"
                strokeDasharray="3,2"
              />
            )}
            {/* Bar */}
            <rect x={x} y={yPos} width={barW} height={barH} fill={b.color} opacity={b.type === 'total' ? 1 : 0.85} />
            {/* Value label */}
            <text x={x + barW / 2} y={valY} textAnchor="middle" fontFamily="'DM Mono',monospace" fontSize="8" fill={b.color} fontWeight="600">
              {b.value >= 0 ? '+' : ''}{fmt(b.value)}
            </text>
            {/* X label */}
            <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontFamily="'DM Mono',monospace" fontSize="7.5" fill="rgba(14,14,13,.45)">
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // AT Coefficient for devaluation (approximate multiplier by year)
  const atCoeff: Record<number, number> = {
    2000: 1.73, 2001: 1.70, 2002: 1.65, 2003: 1.61, 2004: 1.58, 2005: 1.55,
    2006: 1.52, 2007: 1.48, 2008: 1.44, 2009: 1.43, 2010: 1.41, 2011: 1.39,
    2012: 1.37, 2013: 1.36, 2014: 1.35, 2015: 1.34, 2016: 1.33, 2017: 1.32,
    2018: 1.30, 2019: 1.28, 2020: 1.26, 2021: 1.22, 2022: 1.12, 2023: 1.06,
    2024: 1.03, 2025: 1.01, 2026: 1.00,
  }

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
    } catch {
      setResult({ error: 'Erro de ligação. Tenta novamente.', imposto_estimado: 0, taxa_efetiva: 0, liquido_apos_imposto: 0, mensagem: '' })
    } finally { setLoading(false) }
  }

  // Build waterfall bars from result
  const waterfallBars: WaterfallBar[] | null = result && !result.error ? (() => {
    const venda = parseFloat(precoVenda) || 0
    const compra = parseFloat(precoCompra) || 0
    const coeff = atCoeff[anoCompra] || 1
    const compraAjustada = compra * coeff
    const despesasAq = parseFloat(despAq) || 0
    const despesasVd = parseFloat(despVd) || 0
    const obrasVal = parseFloat(obras) || 0
    const ganho = result.ganho_bruto || 0
    const imposto = result.imposto_estimado || 0
    const liquido = result.liquido_apos_imposto || 0
    const isLoss = (result.prejuizo || 0) > 0

    return [
      { label: 'Venda', value: venda, type: 'start' as const, color: '#1c4a35', sublabel: 'Preço venda' },
      { label: 'Compra×coeff', value: -compraAjustada, type: 'negative' as const, color: '#e05454' },
      { label: 'Despesas', value: -(despesasAq + despesasVd + obrasVal), type: 'negative' as const, color: '#e05454' },
      { label: isLoss ? 'Prejuízo' : 'Mais-Valia', value: isLoss ? -(result.prejuizo || 0) : ganho, type: 'total' as const, color: isLoss ? '#e05454' : '#4a9c7a' },
      { label: 'Imposto', value: -imposto, type: 'negative' as const, color: '#c9a96e' },
      { label: 'Líquido', value: liquido, type: 'total' as const, color: '#1c4a35' },
    ]
  })() : null

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

  const isLoss = result && !result.error && (result.prejuizo || 0) > 0

  return (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '8px' }}>
        CIRS 2026 · Coeficientes AT · Isenções automáticas · Englobamento 50%
      </div>
      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: '#0e0e0d', marginBottom: '24px' }}>
        Simulador <em style={{ color: '#1c4a35' }}>Mais-Valias</em>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '24px', alignItems: 'start' }}>
        {/* ─── LEFT: Form ─── */}
        <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label className="p-label">Preço Compra (€)</label>
              <input className="p-inp" type="number" value={precoCompra} onChange={e => setPrecoCompra(e.target.value)} placeholder="ex: 250000" />
            </div>
            <div>
              <label className="p-label">Ano Compra</label>
              <select className="p-sel" value={anoCompra} onChange={e => setAnoCompra(parseInt(e.target.value))}>
                {Array.from({ length: 27 }, (_, i) => 2000 + i).reverse().map(y => (
                  <option key={y} value={y}>{y} · ×{(atCoeff[y] || 1).toFixed(2)}</option>
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
            <input className="p-inp" type="number" value={rendimento} onChange={e => setRendimento(e.target.value)} placeholder="ex: 40000 (para taxa marginal IRS)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'residente', label: 'Residente Fiscal PT', val: residente, set: setResidente },
              { id: 'hpp', label: 'Habitação Própria Permanente', val: hpp, set: setHpp },
              { id: 'reinvest', label: 'Reinveste em nova HPP (isenção parcial)', val: reinvest, set: setReinvest },
            ].map(f => (
              <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.78rem', color: 'rgba(14,14,13,.65)' }}>
                <input type="checkbox" checked={f.val} onChange={e => f.set(e.target.checked)} style={{ accentColor: '#1c4a35' }} />
                {f.label}
              </label>
            ))}
          </div>

          <button className="p-btn" onClick={calcular} disabled={loading || !precoCompra || !precoVenda}>
            {loading ? 'A calcular...' : '▶ Calcular Mais-Valias'}
          </button>

          {result?.error && (
            <div style={{ color: '#e05252', padding: '12px', border: '1px solid rgba(224,82,82,.2)', fontSize: '.78rem' }}>{result.error}</div>
          )}

          {/* AT Coefficient reference */}
          <div style={{ marginTop: '4px', padding: '10px 12px', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px' }}>Coeficiente AT seleccionado</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#c9a96e', fontWeight: 600 }}>
              ×{(atCoeff[anoCompra] || 1).toFixed(2)} <span style={{ fontSize: '.7rem', color: 'rgba(14,14,13,.4)' }}>({anoCompra})</span>
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.3)', marginTop: '3px' }}>
              Compra ajustada: €{precoCompra ? Math.round(parseFloat(precoCompra) * (atCoeff[anoCompra] || 1)).toLocaleString('pt-PT') : '—'}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Results ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!result && !loading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: 'rgba(14,14,13,.35)' }}>Preenche os dados e calcula</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.2)', marginTop: '6px' }}>Resultado em tempo real com coeficientes AT 2026</div>
            </div>
          )}

          {loading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>A calcular...</div>
            </div>
          )}

          {result && !result.error && (
            <>
              {/* Main KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {[
                  {
                    label: isLoss ? 'Menos-Valia' : 'Mais-Valia Bruta',
                    val: `${isLoss ? '-' : '+'}${eur(isLoss ? (result.prejuizo || 0) : (result.ganho_bruto || 0))}`,
                    color: isLoss ? '#e05252' : '#1c4a35',
                    bg: isLoss ? 'rgba(224,82,82,.04)' : '#0c1f15',
                    textOnDark: !isLoss,
                  },
                  { label: 'Imposto Estimado', val: `-${eur(result.imposto_estimado)}`, color: '#e05252', bg: 'rgba(224,82,82,.04)', textOnDark: false },
                  { label: 'Taxa Efectiva', val: `${result.taxa_efetiva?.toFixed(1)}%`, color: '#0e0e0d', bg: '#fff', textOnDark: false },
                  { label: 'Líquido Final', val: eur(result.liquido_apos_imposto), color: '#4a9c7a', bg: 'rgba(74,156,122,.06)', textOnDark: false },
                ].map(m => (
                  <div key={m.label} style={{ padding: '14px 16px', background: m.bg, border: `1px solid ${m.textOnDark ? m.bg : 'rgba(14,14,13,.08)'}` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: m.textOnDark ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 600, color: m.color, lineHeight: 1 }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* Reinvestment savings */}
              {(result.poupanca_reinvestimento || 0) > 0 && (
                <div style={{ padding: '12px 16px', background: 'rgba(74,156,122,.06)', border: '1px solid rgba(74,156,122,.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>Poupança c/ Reinvestimento HPP</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.5)' }}>Isenção total ou parcial ao reinvestir em nova HPP</div>
                  </div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 700, color: '#22c55e' }}>+{eur(result.poupanca_reinvestimento || 0)}</div>
                </div>
              )}

              {/* Waterfall chart */}
              {waterfallBars && (
                <div className="p-card" style={{ padding: '16px 18px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
                    Fluxo de Cálculo — Cascata Fiscal
                  </div>
                  <WaterfallChart bars={waterfallBars} />
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[
                      { color: '#1c4a35', label: 'Valor positivo' },
                      { color: '#e05454', label: 'Dedução' },
                      { color: '#c9a96e', label: 'Imposto' },
                      { color: '#4a9c7a', label: 'Resultado líquido' },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '10px', height: '10px', background: l.color }} />
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div style={{ fontSize: '.75rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.7, padding: '12px 16px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.06)' }}>
                {result.mensagem}
              </div>

              {/* Breakdown details */}
              {result.breakdown && result.breakdown.length > 0 && (
                <div className="p-card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>Desdobramento Detalhado</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {result.breakdown.map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', padding: '6px 10px', background: 'rgba(14,14,13,.02)', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                        <span style={{ color: 'rgba(14,14,13,.55)' }}>{b.label}</span>
                        <span style={{ fontWeight: 600, color: b.tipo === 'positivo' ? '#22c55e' : b.tipo === 'negativo' || b.tipo === 'imposto' ? '#e05252' : b.tipo === 'resultado' ? '#1c4a35' : 'rgba(14,14,13,.6)' }}>
                          {b.valor >= 0 ? '+' : ''}{eur(b.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="p-btn p-btn-gold" style={{ fontSize: '.44rem', padding: '9px 20px' }} onClick={handleExportPDF}>⬇ Exportar PDF</button>
                <button className="p-btn" style={{ fontSize: '.44rem', padding: '9px 20px' }} onClick={() => navigator.clipboard.writeText(`Mais-Valia: ${eur(result.ganho_bruto || 0)} | Imposto: ${eur(result.imposto_estimado)} | Líquido: ${eur(result.liquido_apos_imposto)}`)}>📋 Copiar</button>
              </div>
            </>
          )}

          {/* Legal reference (always visible on right) */}
          {!result && (
            <div className="p-card" style={{ padding: '16px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.28)', marginBottom: '10px' }}>Referência Legal</div>
              {[
                { art: 'Art. 47º CIRS', desc: 'Coeficientes de desvalorização monetária AT 2026' },
                { art: 'Art. 10º/5 CIRS', desc: 'Isenção HPP + reinvestimento total/parcial' },
                { art: 'Art. 72º CIRS', desc: 'Taxa 28% para não residentes fiscais' },
                { art: 'Art. 43º CIRS', desc: '50% englobamento obrigatório para residentes' },
                { art: 'Art. 51º CIRS', desc: 'Dedução obras c/ factura (últimos 12 anos)' },
              ].map(r => (
                <div key={r.art} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(14,14,13,.05)' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: '#1c4a35', flexShrink: 0, marginTop: '1px' }}>{r.art}</span>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.5 }}>{r.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
