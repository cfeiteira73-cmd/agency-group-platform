'use client'
import { useState } from 'react'
import { exportToPDF } from './utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExitResult {
  // Core metrics
  irr: number
  roi: number
  yieldBruto: number
  yieldLiquido: number
  lucroLiquido: number
  // Breakdown
  investimentoInicial: number
  totalRendas: number
  maisValiasImposto: number
  custosEntrada: number
  custosSaida: number
  exitValueLiquido: number
  // Detailed
  emprestimo: number
  prestacaoAnual: number
  rendaLiquidaAnual: number
  dscr: number
  // Holding periods
  timingData: TimingPoint[]
  anosHolding: number
}

interface TimingPoint {
  anos: number
  irr: number
  roi: number
  lucro: number
}

interface Cenario {
  label: string
  cor: string
  irr: number
  roi: number
  lucroLiquido: number
  yieldLiquido: number
}

// ─── IRR Newton-Raphson ───────────────────────────────────────────────────────

function calcIRR(cashflows: number[]): number {
  let rate = 0.1
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0
    let dnpv = 0
    for (let t = 0; t < cashflows.length; t++) {
      const disc = Math.pow(1 + rate, t)
      npv += cashflows[t] / disc
      dnpv -= t * cashflows[t] / (disc * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-12) break
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-8) { rate = newRate; break }
    rate = newRate
    if (rate < -0.999) rate = -0.5
    if (rate > 10) rate = 1
  }
  return rate
}

// ─── Core calculation engine ─────────────────────────────────────────────────

function calcularSaida(params: {
  precoCompra: number
  precoVenda: number
  rendaAnual: number
  taxa: number
  ltv: number
  txOcupacao: number
  custosGestao: number
  obras: number
  anoCompra: number
}): ExitResult {
  const { precoCompra, precoVenda, rendaAnual, taxa, ltv, txOcupacao, custosGestao, obras, anoCompra } = params
  const anoAtual = 2026
  const anosHolding = Math.max(1, anoAtual - anoCompra)

  // Entry costs (Portuguese context)
  const imt = precoCompra * 0.065           // IMT ~6.5%
  const notarioRegisto = precoCompra * 0.015 // Notário + registo 1.5%
  const custosEntrada = imt + notarioRegisto
  const investimentoProprioCapital = precoCompra * (1 - ltv / 100)
  const investimentoInicial = investimentoProprioCapital + custosEntrada + obras

  // Financing
  const emprestimo = precoCompra * (ltv / 100)
  const taxaDecimal = taxa / 100
  // Annual mortgage payment (constant amortization, 25yr)
  const prazo = 25
  const prestacaoAnual = emprestimo > 0 && taxaDecimal > 0
    ? emprestimo * taxaDecimal / (1 - Math.pow(1 + taxaDecimal, -prazo))
    : 0

  // Annual net rent
  const rendaBruta = rendaAnual * (txOcupacao / 100)
  const rendaAposGestao = rendaBruta * (1 - custosGestao / 100)
  const rendaLiquidaAnual = rendaAposGestao - prestacaoAnual
  const totalRendas = rendaLiquidaAnual * anosHolding

  // DSCR
  const dscr = prestacaoAnual > 0 ? rendaBruta / prestacaoAnual : 999

  // Exit costs (agent 5% + IVA 23% = 6.15% effective; notário venda 0.5%)
  const comissaoAgente = precoVenda * 0.05 * 1.23   // 6.15%
  const notarioVenda = precoVenda * 0.005
  const custosSaida = comissaoAgente + notarioVenda

  // Mais-valias
  // Ganho = precoVenda - precoCompra - custosEntrada - obras - custosSaida
  const ganho = precoVenda - precoCompra - custosEntrada - obras - custosSaida
  const maisValiasImposto = ganho > 0 ? ganho * 0.28 : 0  // 28% non-residents / ~avg

  // Exit value net
  const exitValueLiquido = precoVenda - custosSaida - maisValiasImposto - emprestimo

  // Profit
  const lucroLiquido = exitValueLiquido + totalRendas - investimentoInicial + emprestimo
  // (add back emprestimo since investimentoInicial excludes it — equity return)

  // Yield metrics
  const yieldBruto = precoCompra > 0 ? (rendaAnual / precoCompra) * 100 : 0
  const yieldLiquido = precoCompra > 0 ? (rendaAposGestao / precoCompra) * 100 : 0

  // ROI
  const roi = investimentoInicial > 0 ? (lucroLiquido / investimentoInicial) * 100 : 0

  // IRR cashflows: year 0 = -investimentoInicial, years 1..n-1 = rendaLiquidaAnual, year n = rendaLiquidaAnual + exitValueLiquido
  const cashflows: number[] = [
    -investimentoInicial,
    ...Array.from({ length: anosHolding - 1 }, () => rendaLiquidaAnual),
    rendaLiquidaAnual + exitValueLiquido,
  ]
  const irrRaw = calcIRR(cashflows)
  const irr = isFinite(irrRaw) ? irrRaw * 100 : 0

  // Timing analysis across holding periods
  const holdingPeriods = [3, 5, 7, 10, 15]
  const apreciacaoAnual = anosHolding > 0 ? (precoVenda / precoCompra - 1) / anosHolding : 0.04

  const timingData: TimingPoint[] = holdingPeriods.map(anos => {
    const precoVendaEst = precoCompra * Math.pow(1 + apreciacaoAnual, anos)
    const ganhoT = precoVendaEst - precoCompra - custosEntrada - obras - (precoVendaEst * 0.0665)
    const impostoT = ganhoT > 0 ? ganhoT * 0.28 : 0
    const saldoRestante = emprestimo > 0
      ? emprestimo * (Math.pow(1 + taxaDecimal, prazo) - Math.pow(1 + taxaDecimal, anos)) / (Math.pow(1 + taxaDecimal, prazo) - 1)
      : 0
    const exitT = precoVendaEst - precoVendaEst * 0.0665 - impostoT - saldoRestante
    const totalRendasT = rendaLiquidaAnual * anos
    const lucroT = exitT + totalRendasT - investimentoInicial + saldoRestante
    const roiT = investimentoInicial > 0 ? (lucroT / investimentoInicial) * 100 : 0
    const cfT: number[] = [
      -investimentoInicial,
      ...Array.from({ length: anos - 1 }, () => rendaLiquidaAnual),
      rendaLiquidaAnual + exitT,
    ]
    const irrT = calcIRR(cfT)
    return { anos, irr: isFinite(irrT) ? irrT * 100 : 0, roi: roiT, lucro: lucroT }
  })

  return {
    irr, roi, yieldBruto, yieldLiquido, lucroLiquido,
    investimentoInicial, totalRendas, maisValiasImposto, custosEntrada, custosSaida,
    exitValueLiquido, emprestimo, prestacaoAnual, rendaLiquidaAnual, dscr,
    timingData, anosHolding,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const eur = (n: number) => {
  const abs = Math.abs(Math.round(n))
  const formatted = abs.toLocaleString('pt-PT')
  return `${n < 0 ? '-' : ''}€\u202f${formatted}`
}

const pct = (n: number, dec = 1) => `${n >= 0 ? '' : ''}${n.toFixed(dec)}%`

function irrColor(irr: number): string {
  if (irr < 5) return '#e05252'
  if (irr < 10) return '#c9a96e'
  if (irr < 15) return '#1c4a35'
  return '#0d7a47'
}

function irrLabel(irr: number): string {
  if (irr < 5) return 'Fraco'
  if (irr < 10) return 'Aceitável'
  if (irr < 15) return 'Bom'
  return 'Excelente'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalExitSim() {
  const [precoCompra, setPrecoCompra] = useState('')
  const [anoCompra, setAnoCompra] = useState(2022)
  const [precoVenda, setPrecoVenda] = useState('')
  const [rendaAnual, setRendaAnual] = useState('')
  const [taxa, setTaxa] = useState('4.5')
  const [ltv, setLtv] = useState('70')
  const [txOcupacao, setTxOcupacao] = useState('85')
  const [custosGestao, setCustosGestao] = useState('8')
  const [obras, setObras] = useState('')
  const [result, setResult] = useState<ExitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [cenarios, setCenarios] = useState<Cenario[]>([])
  const [showCenarios, setShowCenarios] = useState(false)
  const [animated, setAnimated] = useState(false)

  function calcular() {
    if (!precoCompra || !precoVenda) return
    setLoading(true)
    setAnimated(false)
    setTimeout(() => {
      const r = calcularSaida({
        precoCompra: parseFloat(precoCompra),
        precoVenda: parseFloat(precoVenda),
        rendaAnual: parseFloat(rendaAnual) || 0,
        taxa: parseFloat(taxa) || 4.5,
        ltv: parseFloat(ltv) || 70,
        txOcupacao: parseFloat(txOcupacao) || 85,
        custosGestao: parseFloat(custosGestao) || 8,
        obras: parseFloat(obras) || 0,
        anoCompra,
      })
      setResult(r)
      setCenarios([])
      setShowCenarios(false)
      setLoading(false)
      setTimeout(() => setAnimated(true), 30)
    }, 350)
  }

  function simularCenarios() {
    if (!precoCompra || !precoVenda) return
    const base = {
      precoCompra: parseFloat(precoCompra),
      rendaAnual: parseFloat(rendaAnual) || 0,
      taxa: parseFloat(taxa) || 4.5,
      ltv: parseFloat(ltv) || 70,
      custosGestao: parseFloat(custosGestao) || 8,
      obras: parseFloat(obras) || 0,
      anoCompra,
    }
    const precoBase = parseFloat(precoVenda)
    type RawCenario = ExitResult & { label: string; cor: string }
    const rawCenarios: RawCenario[] = [
      { label: 'Pessimista', cor: '#e05252', ...calcularSaida({ ...base, precoVenda: precoBase * 0.85, txOcupacao: 70 }) },
      { label: 'Base', cor: '#c9a96e', ...calcularSaida({ ...base, precoVenda: precoBase, txOcupacao: parseFloat(txOcupacao) || 85 }) },
      { label: 'Optimista', cor: '#1c4a35', ...calcularSaida({ ...base, precoVenda: precoBase * 1.15, txOcupacao: 95 }) },
    ]
    const cenariosCalc: Cenario[] = rawCenarios.map(c => ({
      label: c.label,
      cor: c.cor,
      irr: c.irr,
      roi: c.roi,
      lucroLiquido: c.lucroLiquido,
      yieldLiquido: c.yieldLiquido,
    }))
    setCenarios(cenariosCalc)
    setShowCenarios(true)
  }

  function handleExportPDF() {
    if (!result) return
    const irrC = irrColor(result.irr)
    const html = `
      <div class="row">
        <div class="card"><div class="label">IRR</div><div class="metric" style="color:${irrC}">${pct(result.irr)}</div><div style="font-size:.7rem;color:${irrC};margin-top:4px">${irrLabel(result.irr)}</div></div>
        <div class="card"><div class="label">ROI Total</div><div class="metric" style="color:#1c4a35">${pct(result.roi)}</div></div>
        <div class="card"><div class="label">Yield Líquido</div><div class="metric">${pct(result.yieldLiquido)}</div></div>
        <div class="card"><div class="label">Lucro Líquido</div><div class="metric" style="color:${result.lucroLiquido >= 0 ? '#1c4a35' : '#e05252'}">${eur(result.lucroLiquido)}</div></div>
      </div>
      <hr class="divider">
      <div class="label">Breakdown Detalhado · Holding ${result.anosHolding} anos</div>
      <table>
        <tr><th>Item</th><th style="text-align:right">Valor</th></tr>
        <tr><td>Investimento inicial (equity + entrada + obras)</td><td style="text-align:right;font-weight:600;color:#e05252">-${eur(result.investimentoInicial)}</td></tr>
        <tr><td>Total rendas líquidas (${result.anosHolding} anos)</td><td style="text-align:right;color:#1c4a35">+${eur(result.totalRendas)}</td></tr>
        <tr><td>Custos de entrada (IMT 6.5% + Notário 1.5%)</td><td style="text-align:right;color:#e05252">-${eur(result.custosEntrada)}</td></tr>
        <tr><td>Custos de saída (comissão 6.15% + notário)</td><td style="text-align:right;color:#e05252">-${eur(result.custosSaida)}</td></tr>
        <tr><td>Mais-valias estimadas (28%)</td><td style="text-align:right;color:#e05252">-${eur(result.maisValiasImposto)}</td></tr>
        <tr><td>Exit value líquido</td><td style="text-align:right;font-weight:600;color:#1c4a35">${eur(result.exitValueLiquido)}</td></tr>
        <tr style="background:rgba(28,74,53,.05)"><td style="font-weight:600">Lucro líquido final</td><td style="text-align:right;font-weight:700;font-size:1.1rem;color:${result.lucroLiquido >= 0 ? '#1c4a35' : '#e05252'}">${eur(result.lucroLiquido)}</td></tr>
      </table>
      <hr class="divider">
      <div class="label">Análise por Período de Holding</div>
      <table>
        <tr><th>Anos</th><th style="text-align:right">IRR</th><th style="text-align:right">ROI</th><th style="text-align:right">Lucro Estimado</th></tr>
        ${result.timingData.map(t => `<tr><td>${t.anos} anos</td><td style="text-align:right;color:${irrColor(t.irr)}">${pct(t.irr)}</td><td style="text-align:right">${pct(t.roi)}</td><td style="text-align:right">${eur(t.lucro)}</td></tr>`).join('')}
      </table>
      <hr class="divider">
      <div style="font-size:.7rem;color:rgba(14,14,13,.4);margin-top:12px;line-height:1.7">
        Nota: Simulação para fins indicativos. IMT 6.5%, notário/registo 1.5%, comissão agente 5%+IVA, mais-valias 28% (não-residentes).
        Yield Bruto: ${pct(result.yieldBruto)} · DSCR: ${result.dscr.toFixed(2)} · Prestação anual: ${eur(result.prestacaoAnual)}
      </div>
    `
    exportToPDF('Simulador de Saída — Exit Analysis', html)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(14,14,13,.03)',
    border: '1px solid rgba(14,14,13,.12)',
    padding: '9px 12px',
    fontSize: '.82rem',
    fontFamily: "'Jost',sans-serif",
    color: '#0e0e0d',
    outline: 'none',
    borderRadius: '2px',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: "'DM Mono',monospace",
    fontSize: '.38rem',
    letterSpacing: '.13em',
    textTransform: 'uppercase' as const,
    color: 'rgba(14,14,13,.38)',
    display: 'block',
    marginBottom: '4px',
  }
  const kpiCardStyle = (accent: string): React.CSSProperties => ({
    flex: '1',
    minWidth: '130px',
    padding: '14px 16px',
    background: 'rgba(14,14,13,.025)',
    border: `1px solid rgba(14,14,13,.08)`,
    borderTop: `3px solid ${accent}`,
  })

  const canCalc = !!precoCompra && !!precoVenda

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '6px', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.32)' }}>
        Portugal · IRR · ROI · Exit Timing · Mais-Valias
      </div>
      <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.85rem', color: '#0e0e0d', marginBottom: '22px', lineHeight: 1.15 }}>
        Simulador <em style={{ color: '#1c4a35', fontStyle: 'italic' }}>de Saída</em>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── LEFT: Input panel ─────────────────────────────────────────────── */}
        <div className="p-card" style={{ flex: '0 0 320px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '11px' }}>

          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.13em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '2px' }}>
            Dados do Investimento
          </div>

          {/* Preço Compra + Ano */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Preço Compra (€)</label>
              <input
                className="p-inp"
                type="number"
                value={precoCompra}
                onChange={e => setPrecoCompra(e.target.value)}
                placeholder="ex: 350000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Ano de Compra</label>
              <select
                className="p-sel"
                value={anoCompra}
                onChange={e => setAnoCompra(parseInt(e.target.value))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {Array.from({ length: 12 }, (_, i) => 2015 + i).reverse().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preço Venda */}
          <div>
            <label style={labelStyle}>Preço de Venda Esperado (€)</label>
            <input
              className="p-inp"
              type="number"
              value={precoVenda}
              onChange={e => setPrecoVenda(e.target.value)}
              placeholder="ex: 520000"
              style={inputStyle}
            />
          </div>

          {/* Renda Anual */}
          <div>
            <label style={labelStyle}>Renda Anual Esperada (€) — opcional</label>
            <input
              className="p-inp"
              type="number"
              value={rendaAnual}
              onChange={e => setRendaAnual(e.target.value)}
              placeholder="ex: 18000"
              style={inputStyle}
            />
          </div>

          {/* Taxa + LTV */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Taxa Juro Crédito (%)</label>
              <input
                className="p-inp"
                type="number"
                step="0.1"
                value={taxa}
                onChange={e => setTaxa(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>LTV (%)</label>
              <input
                className="p-inp"
                type="number"
                min="0"
                max="90"
                value={ltv}
                onChange={e => setLtv(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Ocupação + Gestão */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Taxa Ocupação (%)</label>
              <input
                className="p-inp"
                type="number"
                min="0"
                max="100"
                value={txOcupacao}
                onChange={e => setTxOcupacao(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Custos Gestão (%)</label>
              <input
                className="p-inp"
                type="number"
                min="0"
                max="30"
                value={custosGestao}
                onChange={e => setCustosGestao(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Obras */}
          <div>
            <label style={labelStyle}>Obras e Capex (€) — opcional</label>
            <input
              className="p-inp"
              type="number"
              value={obras}
              onChange={e => setObras(e.target.value)}
              placeholder="ex: 25000"
              style={inputStyle}
            />
          </div>

          {/* Submit */}
          <button
            className="p-btn"
            onClick={calcular}
            disabled={!canCalc || loading}
            style={{
              marginTop: '4px',
              padding: '12px 20px',
              background: canCalc && !loading ? '#1c4a35' : 'rgba(14,14,13,.08)',
              color: canCalc && !loading ? '#f4f0e6' : 'rgba(14,14,13,.3)',
              border: 'none',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.46rem',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              cursor: canCalc && !loading ? 'pointer' : 'not-allowed',
              transition: 'all .18s',
            }}
          >
            {loading ? '◌ A calcular...' : '▶ Calcular Saída'}
          </button>

          {/* Legal reference */}
          <div style={{ borderTop: '1px solid rgba(14,14,13,.06)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.28)', marginBottom: '4px' }}>
              Pressupostos PT 2026
            </div>
            {[
              'IMT: 6.5% sobre preço compra',
              'Notário + registo: 1.5%',
              'Comissão agente saída: 5% + IVA',
              'Mais-valias: 28% (não-residentes)',
              'Crédito: 25 anos, capital+juros',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '.68rem', color: 'rgba(14,14,13,.42)', lineHeight: 1.4 }}>
                <div style={{ width: '4px', height: '4px', background: '#c9a96e', borderRadius: '50%', flexShrink: 0, marginTop: '5px' }} />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Results panel ───────────────────────────────────────────── */}
        <div style={{ flex: '1', minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {!result && !loading && (
            <div style={{ padding: '48px 32px', textAlign: 'center', border: '1px dashed rgba(14,14,13,.12)', color: 'rgba(14,14,13,.25)', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Introduza os dados e calcule para ver a análise de saída
            </div>
          )}

          {loading && (
            <div style={{ padding: '48px 32px', textAlign: 'center', color: 'rgba(14,14,13,.3)', fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.12em' }}>
              A calcular IRR · ROI · Cash Flows...
            </div>
          )}

          {result && (
            <div style={{ opacity: animated ? 1 : 0, transform: animated ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity .35s ease, transform .35s ease' }}>

              {/* ── KPI Cards */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {/* IRR */}
                <div style={kpiCardStyle(irrColor(result.irr))}>
                  <div style={labelStyle}>IRR</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.2rem', fontWeight: 600, color: irrColor(result.irr), lineHeight: 1 }}>
                    {pct(result.irr)}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: irrColor(result.irr), marginTop: '4px', letterSpacing: '.08em' }}>
                    {irrLabel(result.irr)} · {result.anosHolding}a holding
                  </div>
                </div>

                {/* ROI */}
                <div style={kpiCardStyle('#1c4a35')}>
                  <div style={labelStyle}>ROI Total</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.2rem', fontWeight: 600, color: '#1c4a35', lineHeight: 1 }}>
                    {pct(result.roi)}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>
                    retorno s/ equity
                  </div>
                </div>

                {/* Yield Líquido */}
                <div style={kpiCardStyle('#c9a96e')}>
                  <div style={labelStyle}>Yield Líquido</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.2rem', fontWeight: 600, color: '#c9a96e', lineHeight: 1 }}>
                    {pct(result.yieldLiquido)}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>
                    bruto: {pct(result.yieldBruto)}
                  </div>
                </div>

                {/* Lucro Líquido */}
                <div style={kpiCardStyle(result.lucroLiquido >= 0 ? '#1c4a35' : '#e05252')}>
                  <div style={labelStyle}>Lucro Líquido</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: result.lucroLiquido >= 1e6 ? '1.55rem' : '2.2rem', fontWeight: 600, color: result.lucroLiquido >= 0 ? '#1c4a35' : '#e05252', lineHeight: 1 }}>
                    {eur(result.lucroLiquido)}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>
                    DSCR: {result.dscr.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* ── Breakdown Table */}
              <div className="p-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(14,14,13,.32)', marginBottom: '10px' }}>
                  Breakdown · Holding {result.anosHolding} anos
                </div>
                {[
                  { label: 'Investimento inicial (equity + entrada + obras)', val: eur(result.investimentoInicial), neg: true },
                  { label: `Total rendas líquidas (${result.anosHolding} anos × ${eur(result.rendaLiquidaAnual)}/a)`, val: `+${eur(result.totalRendas)}`, neg: result.totalRendas < 0, pos: result.totalRendas >= 0 },
                  { label: 'Custos de entrada (IMT + Notário + Registo)', val: `-${eur(result.custosEntrada)}`, neg: true },
                  { label: 'Custos de saída (comissão agente + notário)', val: `-${eur(result.custosSaida)}`, neg: true },
                  { label: 'Mais-valias estimadas (28%)', val: result.maisValiasImposto > 0 ? `-${eur(result.maisValiasImposto)}` : '—', neg: result.maisValiasImposto > 0 },
                  { label: 'Exit value líquido (após impostos e crédito)', val: eur(result.exitValueLiquido), pos: result.exitValueLiquido > 0, neg: result.exitValueLiquido < 0, bold: true },
                  { label: 'LUCRO LÍQUIDO FINAL', val: eur(result.lucroLiquido), pos: result.lucroLiquido >= 0, neg: result.lucroLiquido < 0, bold: true, accent: true },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderBottom: i < 6 ? '1px solid rgba(14,14,13,.05)' : 'none',
                    background: row.accent ? 'rgba(28,74,53,.05)' : i % 2 === 0 ? 'rgba(14,14,13,.015)' : 'transparent',
                    borderTop: row.accent ? '1px solid rgba(28,74,53,.15)' : 'none',
                  }}>
                    <span style={{ fontSize: '.72rem', color: row.bold ? '#0e0e0d' : 'rgba(14,14,13,.55)', fontWeight: row.bold ? 600 : 400, fontFamily: row.accent ? "'DM Mono',monospace" : "'Jost',sans-serif", letterSpacing: row.accent ? '.06em' : 'normal', textTransform: row.accent ? 'uppercase' as const : 'none' as const }}>
                      {row.label}
                    </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: row.accent ? '.78rem' : '.72rem', fontWeight: row.bold ? 700 : 500, color: row.neg ? '#e05252' : row.pos ? '#1c4a35' : 'rgba(14,14,13,.5)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      {row.val}
                    </span>
                  </div>
                ))}

                {/* Financing detail */}
                {result.emprestimo > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {[
                      { l: 'Empréstimo', v: eur(result.emprestimo) },
                      { l: 'Prestação anual', v: eur(result.prestacaoAnual) },
                      { l: 'LTV', v: `${ltv}%` },
                      { l: 'Renda líq./ano', v: eur(result.rendaLiquidaAnual) },
                    ].map(m => (
                      <div key={m.l}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.32)', marginBottom: '2px' }}>{m.l}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.62rem', color: '#c9a96e' }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Exit Timing Chart */}
              <div className="p-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(14,14,13,.32)', marginBottom: '12px' }}>
                  Exit Timing — IRR por período de holding
                </div>
                {(() => {
                  const maxIRR = Math.max(...result.timingData.map(t => Math.abs(t.irr)), 1)
                  const bestIdx = result.timingData.reduce((bi, t, i, a) => t.irr > a[bi].irr ? i : bi, 0)
                  return result.timingData.map((t, i) => {
                    const isBest = i === bestIdx
                    const barW = Math.max(2, Math.min(100, (Math.abs(t.irr) / maxIRR) * 100))
                    const c = irrColor(t.irr)
                    return (
                      <div key={t.anos} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: isBest ? '#1c4a35' : 'rgba(14,14,13,.4)', minWidth: '42px', fontWeight: isBest ? 700 : 400 }}>
                            {t.anos}a
                          </div>
                          <div style={{ flex: 1, height: '20px', background: 'rgba(14,14,13,.04)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                              width: `${barW}%`,
                              height: '100%',
                              background: isBest ? c : `${c}88`,
                              transition: 'width .5s ease',
                              borderRadius: '2px',
                            }} />
                            {isBest && (
                              <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: '#1c4a35', fontWeight: 700 }}>
                                ★ ÓPTIMO
                              </div>
                            )}
                          </div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', color: c, minWidth: '48px', textAlign: 'right', fontWeight: 600 }}>
                            {pct(t.irr)}
                          </div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.35)', minWidth: '90px', textAlign: 'right' }}>
                            {eur(t.lucro)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(14,14,13,.06)', flexWrap: 'wrap' }}>
                  {[{ c: '#e05252', l: 'IRR < 5%' }, { c: '#c9a96e', l: '5–10%' }, { c: '#1c4a35', l: '10–15%' }, { c: '#0d7a47', l: '> 15%' }].map(leg => (
                    <div key={leg.l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>
                      <div style={{ width: '10px', height: '10px', background: leg.c, borderRadius: '2px' }} />
                      {leg.l}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Scenarios */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button
                  className="p-btn"
                  onClick={simularCenarios}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(28,74,53,.08)',
                    color: '#1c4a35',
                    border: '1px solid rgba(28,74,53,.2)',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.42rem',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ⚡ Simular 3 Cenários
                </button>
                <button
                  className="p-btn p-btn-gold"
                  onClick={handleExportPDF}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(201,169,110,.1)',
                    color: '#c9a96e',
                    border: '1px solid rgba(201,169,110,.3)',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.42rem',
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ⬇ Exportar PDF
                </button>
              </div>

              {/* Scenarios comparison grid */}
              {showCenarios && cenarios.length === 3 && (
                <div className="p-card" style={{ padding: '16px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(14,14,13,.32)', marginBottom: '12px' }}>
                    Comparação de Cenários
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                    {cenarios.map(c => (
                      <div key={c.label} style={{
                        padding: '14px',
                        border: `1px solid ${c.cor}44`,
                        borderTop: `3px solid ${c.cor}`,
                        background: `${c.cor}08`,
                      }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: c.cor, fontWeight: 700, marginBottom: '10px' }}>
                          {c.label}
                        </div>
                        {[
                          { l: 'IRR', v: pct(c.irr), color: irrColor(c.irr) },
                          { l: 'ROI', v: pct(c.roi), color: 'rgba(14,14,13,.6)' },
                          { l: 'Yield Líq.', v: pct(c.yieldLiquido), color: 'rgba(14,14,13,.6)' },
                          { l: 'Lucro', v: eur(c.lucroLiquido), color: c.lucroLiquido >= 0 ? '#1c4a35' : '#e05252' },
                        ].map(m => (
                          <div key={m.l} style={{ marginBottom: '7px' }}>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '1px' }}>{m.l}</div>
                            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.15rem', fontWeight: 600, color: m.color, lineHeight: 1.1 }}>{m.v}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.06)', fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.38)', letterSpacing: '.06em', lineHeight: 1.6 }}>
                    Pessimista: preço venda −15%, ocupação 70% · Base: valores inseridos · Optimista: preço venda +15%, ocupação 95%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
