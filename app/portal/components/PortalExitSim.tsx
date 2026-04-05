'use client'
import { useState, useMemo } from 'react'

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ExitInputs {
  precoCompra: number
  anoCompra: number
  tipoImovel: string
  zona: string
  avmAtual: number
  renovacao: number
  rendaAnual: number
  hipotecaAtual: number
  anoSaida: number
  regimenFiscal: string
}

interface ScenarioResult {
  label: string
  anoSaida: number
  precoProjetado: number
  maisValia: number
  impostoMV: number
  custosTransacao: number
  procedimentoLiquido: number
  irr: number
  roiLiquido: number
  rentabilidadeLiquida: number
  isBest: boolean
}

interface YearPoint {
  year: number
  preco: number
  maisValia: number
  impostoMV: number
  liquido: number
  irr: number
}

// ─── ZONE CONFIG ─────────────────────────────────────────────────────────────
const ZONES_CONFIG: Record<string, { apreciacaoAnual: number; avm: number; label: string }> = {
  chiado:     { apreciacaoAnual: 0.092, avm: 8200, label: 'Chiado / Príncipe Real' },
  cascais:    { apreciacaoAnual: 0.078, avm: 4713, label: 'Cascais' },
  comporta:   { apreciacaoAnual: 0.14,  avm: 7600, label: 'Comporta / Melides' },
  algarve:    { apreciacaoAnual: 0.085, avm: 3941, label: 'Algarve Costa' },
  porto:      { apreciacaoAnual: 0.088, avm: 4100, label: 'Porto / Foz' },
  madeira:    { apreciacaoAnual: 0.076, avm: 3760, label: 'Madeira' },
  sintra:     { apreciacaoAnual: 0.065, avm: 2890, label: 'Sintra / Estoril' },
  setubal:    { apreciacaoAnual: 0.095, avm: 2340, label: 'Setúbal / Arrábida' },
  alfama:     { apreciacaoAnual: 0.072, avm: 5800, label: 'Alfama / Mouraria' },
  acores:     { apreciacaoAnual: 0.058, avm: 1952, label: 'Açores' },
}

// ─── TAX COEFFICIENTS AT 2026 ────────────────────────────────────────────────
const AT_COEFFICIENTS: Record<number, number> = {
  2000: 0.25, 2001: 0.28, 2002: 0.32, 2003: 0.35, 2004: 0.40,
  2005: 0.45, 2006: 0.50, 2007: 0.55, 2008: 0.61, 2009: 0.67,
  2010: 0.73, 2011: 0.78, 2012: 0.83, 2013: 0.88, 2014: 0.90,
  2015: 0.92, 2016: 0.93, 2017: 0.94, 2018: 0.95, 2019: 0.95,
  2020: 0.96, 2021: 0.97, 2022: 0.98, 2023: 0.99, 2024: 1.00,
  2025: 1.00, 2026: 1.00,
}

// ─── TAX RATES BY REGIME ─────────────────────────────────────────────────────
const TAX_RATES: Record<string, { label: string; mvRate: number; exclusion: number; note: string }> = {
  nhr:        { label: 'NHR / IFICI (PT)', mvRate: 0.28, exclusion: 0.50, note: '50% exclusão MV · Regime especial' },
  standard:   { label: 'Residente PT Standard', mvRate: 0.28, exclusion: 0.50, note: '50% exclusão MV · IRS escalonado' },
  naoResident: { label: 'Não-Residente', mvRate: 0.28, exclusion: 0.00, note: 'Taxa fixa 28% sobre MV total' },
  french:     { label: 'Residente Francês', mvRate: 0.36, exclusion: 0.00, note: '36% (IS + PS) · Acordo dupla tributação' },
  uk:         { label: 'Residente UK', mvRate: 0.28, exclusion: 0.00, note: 'CGT 28% imóveis não-residência' },
}

// ─── IRR NEWTON-RAPHSON ──────────────────────────────────────────────────────
function calcIRR(cashflows: number[]): number {
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    let npv = 0
    let dnpv = 0
    cashflows.forEach((cf, t) => {
      npv += cf / Math.pow(1 + rate, t)
      dnpv -= t * cf / Math.pow(1 + rate, t + 1)
    })
    if (Math.abs(dnpv) < 1e-12) break
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-7) { rate = newRate; break }
    rate = Math.max(-0.99, Math.min(10, newRate))
  }
  return isNaN(rate) || !isFinite(rate) ? 0 : rate
}

// ─── CORE CALCULATION ────────────────────────────────────────────────────────
function calcularCenario(inputs: ExitInputs, targetYear: number): Omit<ScenarioResult, 'label' | 'isBest'> {
  const zoneConfig = ZONES_CONFIG[inputs.zona] ?? ZONES_CONFIG['cascais']
  const taxConfig = TAX_RATES[inputs.regimenFiscal] ?? TAX_RATES['standard']
  const anosHolding = targetYear - inputs.anoCompra
  const apreciacao = zoneConfig.apreciacaoAnual

  // Projected price
  const precoProjetado = inputs.avmAtual * Math.pow(1 + apreciacao, targetYear - 2026)

  // AT coefficient for purchase year
  const coefAT = AT_COEFFICIENTS[inputs.anoCompra] ?? 1.0
  const precoCompraCorrigido = inputs.precoCompra * coefAT

  // Mais-valias gross
  const custosEntrada = inputs.precoCompra * 0.085 // IMT + IS + notary
  const custosTotal = custosEntrada + inputs.renovacao
  const maisValiaBruta = precoProjetado - precoCompraCorrigido - custosTotal

  // Tax calculation
  const maisValiaExcluida = maisValiaBruta * taxConfig.exclusion
  const maisValiaTributada = Math.max(0, maisValiaBruta - maisValiaExcluida)
  const impostoMV = Math.max(0, maisValiaTributada * taxConfig.mvRate)

  // Transaction costs on exit: 1.5% agent + 0.5% notary + misc
  const custosTransacao = precoProjetado * 0.02

  // Net proceeds
  const procedimentoLiquido = precoProjetado - impostoMV - custosTransacao - inputs.hipotecaAtual

  // Total rental income over holding period
  const totalRendas = inputs.rendaAnual * anosHolding

  // IRR cashflows: initial outflow, annual rents, final exit
  const cashflows: number[] = [-inputs.precoCompra - custosEntrada - inputs.renovacao]
  for (let y = 1; y < anosHolding; y++) {
    cashflows.push(inputs.rendaAnual)
  }
  cashflows.push(procedimentoLiquido + (inputs.rendaAnual > 0 ? inputs.rendaAnual : 0))

  const irr = calcIRR(cashflows)

  const investimentoTotal = inputs.precoCompra + custosEntrada + inputs.renovacao
  const roiLiquido = ((procedimentoLiquido + totalRendas - investimentoTotal) / investimentoTotal) * 100
  const rentabilidadeLiquida = anosHolding > 0 ? roiLiquido / anosHolding : 0

  return {
    anoSaida: targetYear,
    precoProjetado,
    maisValia: maisValiaBruta,
    impostoMV,
    custosTransacao,
    procedimentoLiquido,
    irr,
    roiLiquido,
    rentabilidadeLiquida,
  }
}

function buildYearSeries(inputs: ExitInputs): YearPoint[] {
  return Array.from({ length: 11 }, (_, i) => {
    const year = 2025 + i
    const r = calcularCenario(inputs, year)
    return {
      year,
      preco: r.precoProjetado,
      maisValia: r.maisValia,
      impostoMV: r.impostoMV,
      liquido: r.procedimentoLiquido,
      irr: r.irr,
    }
  })
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
function fmt(n: number): string { return Math.round(n).toLocaleString('pt-PT') }
function fmtEur(n: number): string { return `€${fmt(n)}` }
function fmtPct(n: number): string { return `${(n * 100).toFixed(1)}%` }

// ─── SVG CHARTS ──────────────────────────────────────────────────────────────
function IrrLineChart({ points, highlightYear }: { points: YearPoint[]; highlightYear: number }) {
  const W = 420; const H = 110
  const irrVals = points.map(p => p.irr * 100)
  const min = Math.min(...irrVals); const max = Math.max(...irrVals)
  const range = max - min || 0.01
  const toX = (i: number) => (i / (points.length - 1)) * (W - 60) + 30
  const toY = (v: number) => H - 28 - ((v - min) / range) * (H - 50)
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.irr * 100).toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${toX(points.length - 1)},${H - 28} L${toX(0)},${H - 28} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id="irr-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c4a35" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1c4a35" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#irr-grad)" />
      <path d={pathD} fill="none" stroke="#1c4a35" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => {
        const isHighlight = p.year === highlightYear
        return (
          <g key={i}>
            <circle
              cx={toX(i)} cy={toY(p.irr * 100)} r={isHighlight ? 5 : 3}
              fill={isHighlight ? '#c9a96e' : '#1c4a35'}
              stroke={isHighlight ? '#1c4a35' : 'none'} strokeWidth="1.5"
            />
            {isHighlight && (
              <text x={toX(i)} y={toY(p.irr * 100) - 10} textAnchor="middle" fontSize="9" fill="#c9a96e" fontFamily="DM Mono, monospace" fontWeight="700">
                {fmtPct(p.irr)}
              </text>
            )}
            <text x={toX(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="#888" fontFamily="DM Mono, monospace">{p.year}</text>
          </g>
        )
      })}
      <text x={4} y={12} fontSize="9" fill="#888" fontFamily="DM Mono, monospace">IRR %</text>
    </svg>
  )
}

function NetProceedsChart({ points, highlightYear }: { points: YearPoint[]; highlightYear: number }) {
  const W = 420; const H = 110
  const vals = points.map(p => p.liquido)
  const min = Math.min(0, ...vals); const max = Math.max(...vals)
  const range = max - min || 1
  const toX = (i: number) => (i / (points.length - 1)) * (W - 60) + 30
  const toY = (v: number) => H - 28 - ((v - min) / range) * (H - 50)
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.liquido).toFixed(1)}`).join(' ')
  const zeroY = toY(0)
  const areaD = `${pathD} L${toX(points.length - 1)},${zeroY} L${toX(0)},${zeroY} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id="np-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {min < 0 && <line x1={30} y1={zeroY} x2={W - 30} y2={zeroY} stroke="rgba(224,84,84,0.3)" strokeWidth="1" strokeDasharray="3,3" />}
      <path d={areaD} fill="url(#np-grad)" />
      <path d={pathD} fill="none" stroke="#c9a96e" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => {
        const isHighlight = p.year === highlightYear
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.liquido)} r={isHighlight ? 5 : 3} fill={isHighlight ? '#1c4a35' : '#c9a96e'} />
            {isHighlight && (
              <text x={toX(i)} y={toY(p.liquido) - 10} textAnchor="middle" fontSize="9" fill="#1c4a35" fontFamily="DM Mono, monospace" fontWeight="700">
                {fmtEur(p.liquido)}
              </text>
            )}
            <text x={toX(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="#888" fontFamily="DM Mono, monospace">{p.year}</text>
          </g>
        )
      })}
      <text x={4} y={12} fontSize="9" fill="#888" fontFamily="DM Mono, monospace">Líquido</text>
    </svg>
  )
}

function TimingOptimizer({ points }: { points: YearPoint[] }) {
  const best = points.reduce((a, b) => b.irr > a.irr ? b : a, points[0])
  const idx = points.findIndex(p => p.year === best.year)
  const W = 420; const H = 60
  const barW = (W - 60) / points.length
  const maxIrr = Math.max(...points.map(p => p.irr))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {points.map((p, i) => {
        const bH = Math.max(4, (p.irr / maxIrr) * 40)
        const x = 30 + i * barW + barW * 0.15
        const bWInner = barW * 0.7
        const isBest = p.year === best.year
        return (
          <g key={i}>
            <rect x={x} y={H - 18 - bH} width={bWInner} height={bH}
              fill={isBest ? '#c9a96e' : 'rgba(28,74,53,0.2)'} rx="2" />
            <text x={x + bWInner / 2} y={H - 4} textAnchor="middle" fontSize="8" fill={isBest ? '#c9a96e' : '#aaa'} fontFamily="DM Mono, monospace" fontWeight={isBest ? '700' : '400'}>{p.year}</text>
            {isBest && (
              <path d={`M${x + bWInner / 2},${H - 18 - bH - 4} L${x + bWInner / 2 - 6},${H - 18 - bH - 14} L${x + bWInner / 2 + 6},${H - 18 - bH - 14} Z`} fill="#c9a96e" />
            )}
          </g>
        )
      })}
      <text x={30 + idx * barW + (barW * 0.15) + (barW * 0.7 / 2)} y={14}
        textAnchor="middle" fontSize="9" fill="#c9a96e" fontFamily="DM Mono, monospace" fontWeight="700">
        Melhor ano
      </text>
    </svg>
  )
}

// ─── SCENARIO CARD ────────────────────────────────────────────────────────────
function ScenarioCard({ s }: { s: ScenarioResult }) {
  return (
    <div style={{
      borderRadius: 16,
      border: s.isBest ? '2px solid #c9a96e' : '1.5px solid rgba(28,74,53,0.12)',
      background: s.isBest ? 'rgba(201,169,110,0.06)' : '#fff',
      padding: '20px',
      position: 'relative',
      transition: 'all 0.2s',
    }}>
      {s.isBest && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: '#c9a96e', color: '#1c4a35', fontSize: 10,
          fontFamily: 'DM Mono, monospace', fontWeight: 700, padding: '3px 14px', borderRadius: 12,
          letterSpacing: '0.1em', whiteSpace: 'nowrap',
        }}>MELHOR CENÁRIO</div>
      )}
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#888', marginBottom: 4 }}>{s.label}</div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: '#0e0e0d', marginBottom: 16 }}>Saída {s.anoSaida}</div>
      <div className="space-y-3">
        {[
          { label: 'Preço Projetado', value: fmtEur(s.precoProjetado), highlight: false },
          { label: 'Mais-Valia Bruta', value: fmtEur(s.maisValia), highlight: false },
          { label: 'Imposto MV', value: fmtEur(s.impostoMV), highlight: false, negative: true },
          { label: 'Custos Transacção', value: fmtEur(s.custosTransacao), highlight: false, negative: true },
          { label: 'Líquido Apurado', value: fmtEur(s.procedimentoLiquido), highlight: true },
          { label: 'IRR', value: fmtPct(s.irr), highlight: true, gold: true },
          { label: 'ROI Líquido', value: `${s.roiLiquido.toFixed(1)}%`, highlight: false },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between" style={{
            padding: '6px 10px',
            borderRadius: 8,
            background: row.highlight ? (row.gold ? 'rgba(201,169,110,0.1)' : 'rgba(28,74,53,0.06)') : 'transparent',
          }}>
            <span style={{ fontSize: 12, color: '#666', fontFamily: 'Jost, sans-serif' }}>{row.label}</span>
            <span style={{
              fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: row.highlight ? 700 : 500,
              color: row.gold ? '#c9a96e' : row.negative ? '#e05454' : row.highlight ? '#1c4a35' : '#0e0e0d'
            }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PortalExitSim() {
  const [inputs, setInputs] = useState<ExitInputs>({
    precoCompra: 650000,
    anoCompra: 2019,
    tipoImovel: 'Apartamento',
    zona: 'chiado',
    avmAtual: 950000,
    renovacao: 45000,
    rendaAnual: 0,
    hipotecaAtual: 0,
    anoSaida: 2027,
    regimenFiscal: 'nhr',
  })

  const [activeTab, setActiveTab] = useState<'cenarios' | 'analise' | 'reinvestimento'>('cenarios')

  const yearSeries = useMemo(() => buildYearSeries(inputs), [inputs])

  const scenarios: ScenarioResult[] = useMemo(() => {
    const raw = [
      { label: 'Vender Agora', year: 2026 },
      { label: 'Aguardar 2 anos', year: 2028 },
      { label: 'Aguardar 5 anos', year: 2031 },
    ].map(s => ({ ...calcularCenario(inputs, s.year), label: s.label, anoSaida: s.year, isBest: false }))
    const bestIrr = Math.max(...raw.map(s => s.irr))
    return raw.map(s => ({ ...s, isBest: s.irr === bestIrr }))
  }, [inputs])

  const bestYear = useMemo(() => yearSeries.reduce((a, b) => b.irr > a.irr ? b : a, yearSeries[0]), [yearSeries])

  const taxConfig = TAX_RATES[inputs.regimenFiscal] ?? TAX_RATES['standard']
  const zoneConfig = ZONES_CONFIG[inputs.zona] ?? ZONES_CONFIG['chiado']

  function setInput<K extends keyof ExitInputs>(key: K, value: ExitInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  function handleZoneChange(zona: string) {
    const zc = ZONES_CONFIG[zona]
    if (zc) {
      const anos = 2026 - inputs.anoCompra
      const estimatedAvm = inputs.precoCompra * Math.pow(1 + zc.apreciacaoAnual, anos)
      setInputs(prev => ({ ...prev, zona, avmAtual: Math.round(estimatedAvm) }))
    }
  }

  const TABS = [
    { id: 'cenarios', label: 'Cenários de Saída' },
    { id: 'analise', label: 'Análise Fiscal' },
    { id: 'reinvestimento', label: 'Reinvestimento' },
  ] as const

  // Reinvestment scenarios
  const liquidoCenarioBest = calcularCenario(inputs, bestYear.year).procedimentoLiquido
  const reinvestTable = [5, 7, 9, 12].map(rate => ({
    rate,
    v5: liquidoCenarioBest * Math.pow(1 + rate / 100, 5),
    v10: liquidoCenarioBest * Math.pow(1 + rate / 100, 10),
  }))

  return (
    <div style={{ background: '#f4f0e6', minHeight: '100vh', fontFamily: 'Jost, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ background: '#1c4a35', padding: '20px 28px' }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ fontFamily: 'Cormorant, serif', fontSize: 28, color: '#f4f0e6', fontWeight: 700, margin: 0 }}>
              Exit Strategy Simulator
            </h1>
            <p style={{ color: 'rgba(244,240,230,0.6)', fontSize: 13, marginTop: 4, fontFamily: 'DM Mono, monospace' }}>
              Optimiza o momento e estrutura da saída · IRR Newton-Raphson · AT Coeficientes 2026
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Melhor IRR', value: fmtPct(bestYear.irr), year: bestYear.year },
              { label: 'Líquido Estimado', value: fmtEur(bestYear.liquido) },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'rgba(244,240,230,0.1)', borderRadius: 10, padding: '10px 16px', border: '1px solid rgba(201,169,110,0.3)' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,240,230,0.5)', letterSpacing: '0.1em' }}>{kpi.label}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#c9a96e', fontWeight: 700 }}>
                  {kpi.value} {'year' in kpi ? `(${kpi.year})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-1 mt-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.05em', transition: 'all 0.2s',
              background: activeTab === t.id ? '#c9a96e' : 'rgba(244,240,230,0.1)',
              color: activeTab === t.id ? '#1c4a35' : 'rgba(244,240,230,0.7)',
              fontWeight: activeTab === t.id ? 700 : 400,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>

          {/* ── LEFT PANEL — Inputs ─────────────────────────────────── */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px', position: 'sticky', top: 20 }}>
              <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 18 }}>Parâmetros do Imóvel</h2>

              <div className="space-y-4">

                {/* Preco Compra */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Preço de Compra (€)
                  </label>
                  <input
                    type="number"
                    value={inputs.precoCompra}
                    onChange={e => setInput('precoCompra', Number(e.target.value))}
                    className="p-inp w-full"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                  />
                </div>

                {/* Ano Compra */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Ano de Compra
                  </label>
                  <select
                    value={inputs.anoCompra}
                    onChange={e => setInput('anoCompra', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13, appearance: 'none' }}
                  >
                    {Array.from({ length: 17 }, (_, i) => 2010 + i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {/* Tipo Imóvel */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Tipo de Imóvel
                  </label>
                  <select
                    value={inputs.tipoImovel}
                    onChange={e => setInput('tipoImovel', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13, appearance: 'none' }}
                  >
                    {['Apartamento', 'Moradia', 'Comercial', 'Terreno'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Zona */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Zona
                  </label>
                  <select
                    value={inputs.zona}
                    onChange={e => handleZoneChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13, appearance: 'none' }}
                  >
                    {Object.entries(ZONES_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>
                    Aprec. anual estimada: {(zoneConfig.apreciacaoAnual * 100).toFixed(1)}%
                  </div>
                </div>

                {/* AVM */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    AVM Actual (€)
                  </label>
                  <input
                    type="number"
                    value={inputs.avmAtual}
                    onChange={e => setInput('avmAtual', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                  />
                </div>

                {/* Renovação */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Renovação Investida (€)
                  </label>
                  <input
                    type="number"
                    value={inputs.renovacao}
                    onChange={e => setInput('renovacao', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                  />
                </div>

                {/* Renda Anual */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Renda Anual Líquida (€)
                  </label>
                  <input
                    type="number"
                    value={inputs.rendaAnual}
                    onChange={e => setInput('rendaAnual', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                    placeholder="0 = sem arrendamento"
                  />
                </div>

                {/* Hipoteca */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Hipoteca em Dívida (€)
                  </label>
                  <input
                    type="number"
                    value={inputs.hipotecaAtual}
                    onChange={e => setInput('hipotecaAtual', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                  />
                </div>

                {/* Regime Fiscal */}
                <div>
                  <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                    Regime Fiscal
                  </label>
                  <select
                    value={inputs.regimenFiscal}
                    onChange={e => setInput('regimenFiscal', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 12, appearance: 'none' }}
                  >
                    {Object.entries(TAX_RATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>
                    {taxConfig.note}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(28,74,53,0.1)', paddingTop: 16 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Ano de Saída Manual</div>
                  <input
                    type="range"
                    min={2025}
                    max={2035}
                    value={inputs.anoSaida}
                    onChange={e => setInput('anoSaida', Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#1c4a35' }}
                  />
                  <div style={{ textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 700, color: '#1c4a35' }}>{inputs.anoSaida}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT CONTENT ────────────────────────────────────────── */}
          <div className="flex-1 space-y-6" style={{ minWidth: 0 }}>

            {/* ── Tab: Cenários ─────────────────────────────────────── */}
            {activeTab === 'cenarios' && (
              <>
                {/* 3 Scenario Cards */}
                <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {scenarios.map(s => <ScenarioCard key={s.anoSaida} s={s} />)}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-2 gap-4">
                  <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                    <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 17, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>IRR vs Ano de Saída</h3>
                    <IrrLineChart points={yearSeries} highlightYear={inputs.anoSaida} />
                  </div>
                  <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                    <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 17, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>Montante Líquido vs Ano</h3>
                    <NetProceedsChart points={yearSeries} highlightYear={inputs.anoSaida} />
                  </div>
                </div>

                {/* Timing Optimizer */}
                <div style={{ background: '#fff', borderRadius: 16, border: '2px solid rgba(201,169,110,0.4)', padding: '20px 24px' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ background: '#c9a96e', borderRadius: 8, padding: '4px 12px' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#1c4a35', fontWeight: 700, letterSpacing: '0.1em' }}>TIMING OPTIMIZER</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#666' }}>
                      Melhor ano de saída: <strong style={{ color: '#c9a96e' }}>{bestYear.year}</strong> · IRR <strong style={{ color: '#1c4a35' }}>{fmtPct(bestYear.irr)}</strong> · Líquido <strong style={{ color: '#1c4a35' }}>{fmtEur(bestYear.liquido)}</strong>
                    </span>
                  </div>
                  <TimingOptimizer points={yearSeries} />
                </div>

                {/* Strategy Recommendation */}
                <div style={{ background: 'linear-gradient(135deg, #1c4a35, #0d2818)', borderRadius: 16, padding: '22px 28px' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,240,230,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Estratégia Recomendada</div>
                  <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, color: '#f4f0e6', lineHeight: 1.7, margin: 0 }}>
                    Com base no perfil fiscal <strong style={{ color: '#c9a96e' }}>{taxConfig.label}</strong>, zona <strong style={{ color: '#c9a96e' }}>{zoneConfig.label}</strong> e holding de <strong style={{ color: '#c9a96e' }}>{2026 - inputs.anoCompra} anos</strong>,
                    o ano óptimo de saída é <strong style={{ color: '#c9a96e' }}>{bestYear.year}</strong>.
                    A apreciação anual estimada de <strong style={{ color: '#c9a96e' }}>{(zoneConfig.apreciacaoAnual * 100).toFixed(1)}%</strong>
                    {inputs.rendaAnual > 0 ? ` combinada com rendas de ${fmtEur(inputs.rendaAnual)}/ano` : ''} gera
                    um IRR de <strong style={{ color: '#c9a96e' }}>{fmtPct(bestYear.irr)}</strong> —
                    {bestYear.irr > 0.12 ? ' performance excepcional para imobiliário europeu.' : bestYear.irr > 0.07 ? ' performance sólida para o perfil de risco imobiliário.' : ' aguardar mais anos pode melhorar o retorno.'}
                  </p>
                </div>
              </>
            )}

            {/* ── Tab: Análise Fiscal ───────────────────────────────── */}
            {activeTab === 'analise' && (
              <>
                {/* AT Coeficients breakdown */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                  <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>
                    Cálculo de Mais-Valias · Coeficientes AT 2026
                  </h2>
                  <div className="space-y-3">
                  </div>
                  {/* Render the rows */}
                  {(() => {
                    const coef = AT_COEFFICIENTS[inputs.anoCompra] ?? 1
                    const precoCorrigido = inputs.precoCompra * coef
                    const custosEntrada = inputs.precoCompra * 0.085
                    const base = precoCorrigido + custosEntrada + inputs.renovacao
                    const precoProj = calcularCenario(inputs, inputs.anoSaida).precoProjetado
                    const mvBruta = precoProj - base
                    const mvExcluida = mvBruta * taxConfig.exclusion
                    const mvTributada = Math.max(0, mvBruta - mvExcluida)
                    const imposto = mvTributada * taxConfig.mvRate
                    const rows = [
                      { label: 'Preço de Compra', value: fmtEur(inputs.precoCompra), note: '' },
                      { label: `Coeficiente AT (${inputs.anoCompra})`, value: coef.toFixed(2), note: 'Correcção monetária AT' },
                      { label: 'Preço Corrigido', value: fmtEur(precoCorrigido), note: 'Compra × Coeficiente' },
                      { label: 'Custos de Entrada', value: fmtEur(custosEntrada), note: 'IMT + IS + Notário ≈ 8.5%' },
                      { label: 'Obras / Renovação', value: fmtEur(inputs.renovacao), note: 'Dedutível com facturas' },
                      { label: 'Base Corrigida Total', value: fmtEur(base), note: 'Corrigido + Custos + Obras', highlight: true },
                      { label: `Preço Projetado (${inputs.anoSaida})`, value: fmtEur(precoProj), note: 'AVM × apreciação anual' },
                      { label: 'Mais-Valia Bruta', value: fmtEur(mvBruta), note: 'Venda − Base Corrigida', highlight: true },
                      { label: `Exclusão ${(taxConfig.exclusion * 100).toFixed(0)}%`, value: fmtEur(mvExcluida), note: taxConfig.note },
                      { label: 'MV Tributada', value: fmtEur(mvTributada), note: '' },
                      { label: `Imposto MV (${(taxConfig.mvRate * 100).toFixed(0)}%)`, value: fmtEur(imposto), note: '', negative: true },
                    ]
                    return (
                      <div className="space-y-2">
                        {rows.map(r => (
                          <div key={r.label} className="flex items-center justify-between" style={{ padding: '8px 12px', borderRadius: 8, background: r.highlight ? 'rgba(28,74,53,0.07)' : 'transparent' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: r.highlight ? 600 : 400, color: '#0e0e0d' }}>{r.label}</div>
                              {r.note && <div style={{ fontSize: 11, color: '#888', fontFamily: 'DM Mono, monospace' }}>{r.note}</div>}
                            </div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: r.highlight ? 700 : 500, color: r.negative ? '#e05454' : r.highlight ? '#1c4a35' : '#0e0e0d' }}>{r.value}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Tax Regime Comparison */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                  <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>
                    Comparação por Regime Fiscal
                  </h2>
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(28,74,53,0.1)' }}>
                          {['Regime', 'Taxa MV', 'Exclusão', 'Imposto Estimado', 'Líquido Estimado', 'IRR'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(TAX_RATES).map(([k, tax]) => {
                          const sim = calcularCenario({ ...inputs, regimenFiscal: k }, inputs.anoSaida)
                          const isActive = k === inputs.regimenFiscal
                          return (
                            <tr
                              key={k}
                              onClick={() => setInput('regimenFiscal', k)}
                              style={{
                                borderBottom: '1px solid rgba(28,74,53,0.06)',
                                background: isActive ? 'rgba(201,169,110,0.08)' : 'transparent',
                                cursor: 'pointer',
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: isActive ? 700 : 400, fontSize: 13 }}>
                                {tax.label}
                                {isActive && <span style={{ marginLeft: 8, background: '#c9a96e', color: '#1c4a35', fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>ACTIVO</span>}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{(tax.mvRate * 100).toFixed(0)}%</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{(tax.exclusion * 100).toFixed(0)}%</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: '#e05454' }}>{fmtEur(sim.impostoMV)}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1c4a35' }}>{fmtEur(sim.procedimentoLiquido)}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: '#c9a96e' }}>{fmtPct(sim.irr)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Reinvestimento ───────────────────────────────── */}
            {activeTab === 'reinvestimento' && (
              <>
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                  <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 8 }}>
                    Cenários de Reinvestimento
                  </h2>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
                    Se os <strong>{fmtEur(liquidoCenarioBest)}</strong> apurados no ano óptimo ({bestYear.year}) fossem reinvestidos:
                  </p>
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(28,74,53,0.1)' }}>
                          {['Taxa Reinvestimento', 'Capital Base', 'Valor 5 anos', 'Valor 10 anos', 'Ganho 10 anos'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reinvestTable.map((r) => (
                          <tr key={r.rate} style={{ borderBottom: '1px solid rgba(28,74,53,0.06)' }}>
                            <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 15, color: r.rate >= 9 ? '#1c4a35' : '#0e0e0d' }}>{r.rate}% a.a.</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{fmtEur(liquidoCenarioBest)}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#1c4a35', fontWeight: 600 }}>{fmtEur(r.v5)}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#1c4a35', fontWeight: 700 }}>{fmtEur(r.v10)}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#c9a96e', fontWeight: 700 }}>+{fmtEur(r.v10 - liquidoCenarioBest)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(28,74,53,0.06)', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, color: '#1c4a35', margin: 0 }}>
                      <strong>Nota:</strong> 5% a.a. = diversificação conservadora (bonds + dividendos). 7% = carteira diversificada moderada. 9–12% = imobiliário premium ou private equity. Reinvestimento imobiliário PT pode beneficiar de isenção de MV (art.10º CIRS) se aplicado em habitação própria.
                    </p>
                  </div>
                </div>

                {/* Reinvestment Bar Chart SVG */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                  <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Projecção Visual · 10 anos</h3>
                  <svg viewBox="0 0 480 140" style={{ width: '100%', height: 140 }}>
                    {reinvestTable.map((r, i) => {
                      const maxV = reinvestTable[reinvestTable.length - 1].v10
                      const baseH = (liquidoCenarioBest / maxV) * 80
                      const v5H = (r.v5 / maxV) * 80
                      const v10H = (r.v10 / maxV) * 80
                      const x = 40 + i * 108
                      const bW = 22
                      const gap = 4
                      return (
                        <g key={r.rate}>
                          <rect x={x} y={110 - baseH} width={bW} height={baseH} fill="rgba(28,74,53,0.2)" rx="3" />
                          <rect x={x + bW + gap} y={110 - v5H} width={bW} height={v5H} fill="#52b788" rx="3" />
                          <rect x={x + (bW + gap) * 2} y={110 - v10H} width={bW} height={v10H} fill="#1c4a35" rx="3" />
                          <text x={x + (bW + gap) * 1.5 - 2} y={126} textAnchor="middle" fontSize="10" fill="#0e0e0d" fontFamily="DM Mono, monospace" fontWeight="700">{r.rate}%</text>
                          <text x={x + (bW + gap) * 2 + bW / 2} y={110 - v10H - 4} textAnchor="middle" fontSize="8" fill="#1c4a35" fontFamily="DM Mono, monospace">{fmtEur(r.v10)}</text>
                        </g>
                      )
                    })}
                    <text x={20} y={12} fontSize="9" fill="#888" fontFamily="DM Mono, monospace">■ Base</text>
                    <text x={60} y={12} fontSize="9" fill="#52b788" fontFamily="DM Mono, monospace">■ 5 anos</text>
                    <text x={108} y={12} fontSize="9" fill="#1c4a35" fontFamily="DM Mono, monospace">■ 10 anos</text>
                  </svg>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
