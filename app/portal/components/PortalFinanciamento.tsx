'use client'
import { useState, useMemo } from 'react'
import { exportToPDF } from '../utils/export'

// ─── Types ───────────────────────────────────────────────────────────────────

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
    melhor_cenario?: number
    pior_cenario?: number
  }
  acessibilidade?: { dsti_ok: boolean; nota: string }
  notas?: string[]
  islamic_finance?: boolean
  bancos_recomendados?: string[]
  error?: string
}

interface AmortPoint { year: number; balance: number; paid: number; interest: number }

// ─── Country Data (static reference) ────────────────────────────────────────

const COUNTRY_PROFILES = [
  { code: 'FR', flag: '🇫🇷', label: 'França', ltv: 80, spread: '1.2–1.8%', difficulty: 'Fácil', docs: ['Declaração fiscal', 'Contrato trabalho', 'Extratos 3M'] },
  { code: 'DE', flag: '🇩🇪', label: 'Alemanha', ltv: 80, spread: '1.4–2.0%', difficulty: 'Fácil', docs: ['Steuerbescheid', 'Gehaltsabrechnungen 3M', 'Kontoauszüge'] },
  { code: 'GB', flag: '🇬🇧', label: 'Reino Unido', ltv: 70, spread: '1.5–2.2%', difficulty: 'Moderado', docs: ['SA302 HMRC', 'Bank statements 6M', 'P60 tax year'] },
  { code: 'US', flag: '🇺🇸', label: 'EUA', ltv: 65, spread: '1.8–2.5%', difficulty: 'Moderado', docs: ['Federal tax returns 2Y', 'W2/1099', 'Bank statements 3M'] },
  { code: 'CN', flag: '🇨🇳', label: 'China', ltv: 60, spread: '2.0–2.8%', difficulty: 'Difícil', docs: ['华税证明', 'Extrato bancário 12M', 'Declaração rendimentos'] },
  { code: 'AE', flag: '🇦🇪', label: 'Emirados', ltv: 70, spread: '1.6–2.3%', difficulty: 'Moderado', docs: ['Salary certificate', 'Bank statements 6M', 'Passport + Visa'] },
  { code: 'BR', flag: '🇧🇷', label: 'Brasil', ltv: 80, spread: '1.3–1.9%', difficulty: 'Fácil', docs: ['IRPF completo', 'Holerites 3M', 'Extrato bancário 3M'] },
  { code: 'SA', flag: '🇸🇦', label: 'Arábia Saudita', ltv: 70, spread: '1.6–2.3%', difficulty: 'Moderado', docs: ['Salary certificate', 'Bank statements 6M', 'Employment letter'] },
  { code: 'CA', flag: '🇨🇦', label: 'Canadá', ltv: 65, spread: '1.8–2.5%', difficulty: 'Moderado', docs: ['T1 tax return 2Y', 'NOA CRA', 'Bank statements 3M'] },
  { code: 'AU', flag: '🇦🇺', label: 'Austrália', ltv: 65, spread: '1.8–2.5%', difficulty: 'Moderado', docs: ['ATO tax return 2Y', 'PAYG summary', 'Bank statements 3M'] },
  { code: 'OTHER', flag: '🌍', label: 'Outro país', ltv: 60, spread: '2.0–3.0%', difficulty: 'Difícil', docs: ['Documentação fiscal local', 'Extratos bancários 6M', 'Comprovativo rendimentos'] },
]

const BANKS_PT = ['Banco BPI', 'Millennium BCP', 'Novo Banco', 'Caixa Geral Depósitos', 'Santander PT', 'Bankinter PT']

// ─── Amortization Calculator ─────────────────────────────────────────────────

function calcAmortization(principal: number, annualRate: number, years: number): AmortPoint[] {
  const monthlyRate = annualRate / 100 / 12
  const nPayments = years * 12
  const monthlyPayment = monthlyRate === 0 ? principal / nPayments
    : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -nPayments))

  const points: AmortPoint[] = []
  let balance = principal
  let totalPaid = 0

  for (let y = 0; y <= years; y++) {
    points.push({ year: y, balance: Math.max(0, balance), paid: totalPaid, interest: totalPaid - (principal - balance) })
    for (let m = 0; m < 12 && balance > 0; m++) {
      const interest = balance * monthlyRate
      const principalPay = monthlyPayment - interest
      balance -= principalPay
      totalPaid += monthlyPayment
    }
  }
  return points
}

// ─── SVG Amortization Chart ───────────────────────────────────────────────────

function AmortChart({ points, width = 480, height = 160 }: { points: AmortPoint[]; width?: number; height?: number }) {
  const pad = { top: 16, right: 16, bottom: 32, left: 56 }
  const W = width - pad.left - pad.right
  const H = height - pad.top - pad.bottom
  const maxBalance = points[0]?.balance || 1
  const maxPaid = points[points.length - 1]?.paid || 1
  const maxY = Math.max(maxBalance, maxPaid)

  const scaleX = (i: number) => pad.left + (i / (points.length - 1)) * W
  const scaleY = (v: number) => pad.top + H - (v / maxY) * H

  const balancePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(p.balance)}`).join(' ')
  const paidPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(p.paid)}`).join(' ')

  const fmt = (n: number) => n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : `€${Math.round(n / 1000)}K`
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxY)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" aria-label="Amortização do crédito">
      {/* Grid */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} y1={scaleY(v)} x2={pad.left + W} y2={scaleY(v)} stroke="rgba(14,14,13,.06)" strokeWidth="1" />
          <text x={pad.left - 4} y={scaleY(v) + 4} textAnchor="end" fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.35)">{fmt(v)}</text>
        </g>
      ))}
      {/* X axis labels */}
      {points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1).map((p, i) => (
        <text key={i} x={scaleX(points.indexOf(p))} y={height - 6} textAnchor="middle" fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.35)">A{p.year}</text>
      ))}
      {/* Balance line (green) */}
      <path d={balancePath} fill="none" stroke="#1c4a35" strokeWidth="2" />
      {/* Total paid line (gold) */}
      <path d={paidPath} fill="none" stroke="#c9a96e" strokeWidth="2" strokeDasharray="4,2" />
      {/* Legend */}
      <line x1={pad.left} y1={height - 6} x2={pad.left + W} y2={height - 6} stroke="rgba(14,14,13,.1)" strokeWidth="1" />
    </svg>
  )
}

// ─── Affordability Meter ───────────────────────────────────────────────────────

function AffordabilityMeter({ dsti }: { dsti: number }) {
  const pct = Math.min(100, dsti)
  const color = pct < 33 ? '#1c4a35' : pct < 45 ? '#c9a96e' : '#e05454'
  const label = pct < 33 ? 'Confortável' : pct < 45 ? 'Aceitável' : 'Elevado'
  const W = 200, H = 16

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" aria-label={`DSTI ${dsti.toFixed(1)}%`}>
        <rect x="0" y="4" width={W} height={H} rx="2" fill="rgba(14,14,13,.06)" />
        <rect x="0" y="4" width={Math.min(W, W * pct / 100)} height={H} rx="2" fill={color} />
        <text x={Math.min(W - 2, W * pct / 100 + 4)} y={H - 2} fontFamily="'DM Mono',monospace" fontSize="9" fill={color} fontWeight="600">{dsti.toFixed(1)}%</text>
        <text x="0" y={H + 16} fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.4)">0%</text>
        <text x={W * 0.33} y={H + 16} fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.4)">33%</text>
        <text x={W * 0.45} y={H + 16} fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.4)">45%</text>
        <text x={W - 2} y={H + 16} textAnchor="end" fontFamily="'DM Mono',monospace" fontSize="8" fill="rgba(14,14,13,.4)">80%</text>
      </svg>
      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: '2px' }}>
        DSTI {dsti.toFixed(1)}% — {label}
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PortalFinanciamento() {
  const [pais, setPais] = useState('FR')
  const [montante, setMontante] = useState('')
  const [prazo, setPrazo] = useState(25)
  const [rendimento, setRendimento] = useState('')
  const [tab, setTab] = useState<'calculadora' | 'comparar' | 'documentos'>('calculadora')
  const [result, setResult] = useState<FinResult | null>(null)
  const [loading, setLoading] = useState(false)

  const eur = (n: number) => '€ ' + Math.round(n).toLocaleString('pt-PT')
  const countryProfile = COUNTRY_PROFILES.find(c => c.code === pais) || COUNTRY_PROFILES[COUNTRY_PROFILES.length - 1]

  // Local mortgage calc (real-time, no API needed)
  const localCalc = useMemo(() => {
    const principal = parseFloat(montante) || 0
    if (!principal) return null
    const ltv = countryProfile.ltv / 100
    const loanAmount = principal * ltv
    const entrada = principal * (1 - ltv)
    const euribor = 2.95 // Euribor 6M — alinhado com API (BCE Março 2026)
    const spread = 1.5 // Mid spread
    const annualRate = euribor + spread
    const monthlyRate = annualRate / 100 / 12
    const n = prazo * 12
    const monthlyPayment = monthlyRate === 0 ? loanAmount / n
      : loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n))
    const totalPaid = monthlyPayment * n
    const totalInterest = totalPaid - loanAmount
    const annualPayment = monthlyPayment * 12
    const incomeNeeded = annualPayment / 0.33 // DSTI 33%
    const rendimentoN = parseFloat(rendimento) || 0
    const dsti = rendimentoN > 0 ? (annualPayment / rendimentoN) * 100 : 0
    const amortPoints = calcAmortization(loanAmount, annualRate, prazo)

    return { loanAmount, entrada, monthlyPayment, totalPaid, totalInterest, annualRate, incomeNeeded, dsti, amortPoints }
  }, [montante, prazo, pais, rendimento, countryProfile])

  async function calcularAPI() {
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

  function handleExportPDF() {
    if (!localCalc) return
    const html = `
      <div class="label">Simulação Crédito Habitação — ${countryProfile.flag} ${countryProfile.label}</div>
      <div class="row">
        <div class="card"><div class="label">Valor Imóvel</div><div class="metric">${eur(parseFloat(montante))}</div></div>
        <div class="card"><div class="label">Entrada (${100 - countryProfile.ltv}%)</div><div class="metric">${eur(localCalc.entrada)}</div></div>
        <div class="card"><div class="label">Capital Emprestado</div><div class="metric">${eur(localCalc.loanAmount)}</div></div>
        <div class="card"><div class="label">Prestação Mensal</div><div class="metric green">${eur(localCalc.monthlyPayment)}/mês</div></div>
      </div>
      <hr class="divider">
      <div class="row">
        <div class="card"><div class="label">Taxa Total (Euribor+Spread)</div><div class="metric">${localCalc.annualRate.toFixed(2)}%</div></div>
        <div class="card"><div class="label">Total Juros</div><div class="metric" style="color:#e05454">${eur(localCalc.totalInterest)}</div></div>
        <div class="card"><div class="label">Total Pago</div><div class="metric">${eur(localCalc.totalPaid)}</div></div>
        ${localCalc.dsti > 0 ? `<div class="card"><div class="label">DSTI</div><div class="metric">${localCalc.dsti.toFixed(1)}%</div></div>` : ''}
      </div>
      <div style="margin-top:16px;font-size:.8rem;color:rgba(14,14,13,.45)">Baseado em Euribor 6M 2.95% + Spread 1.5%. Simulação indicativa — confirmar com banco.</div>
    `
    exportToPDF(`Simulação Crédito — ${countryProfile.flag} ${countryProfile.label}`, html)
  }

  const TABS = [
    { id: 'calculadora', label: '⚙ Calculadora' },
    { id: 'comparar', label: '📊 Comparar Países' },
    { id: 'documentos', label: '📋 Documentação' },
  ] as const

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '6px' }}>
          Euribor 6M 2.95% · 11 Países · LTV · Islamic Finance · DSTI
        </div>
        <div style={{ fontFamily: 'var(--font-cormorant),serif', fontWeight: 300, fontSize: '1.8rem', color: '#0e0e0d' }}>
          Crédito <em style={{ color: '#1c4a35' }}>para Estrangeiros</em>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '24px' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#1c4a35' : 'transparent'}`, color: tab === t.id ? '#1c4a35' : 'rgba(14,14,13,.45)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', letterSpacing: '.06em', transition: 'all .2s', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: CALCULADORA ─── */}
      {tab === 'calculadora' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left: Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="p-card" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '14px' }}>Parâmetros</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="p-label">País de Residência</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {COUNTRY_PROFILES.slice(0, 8).map(c => (
                      <button key={c.code}
                        onClick={() => setPais(c.code)}
                        style={{ padding: '8px 4px', textAlign: 'center', background: pais === c.code ? '#1c4a35' : 'transparent', border: `1px solid ${pais === c.code ? '#1c4a35' : 'rgba(14,14,13,.1)'}`, color: pais === c.code ? '#f4f0e6' : 'rgba(14,14,13,.6)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', transition: 'all .15s', borderRadius: '6px' }}>
                        <div style={{ fontSize: '1rem' }}>{c.flag}</div>
                        <div style={{ marginTop: '2px', letterSpacing: '.04em' }}>{c.code}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                  <label className="p-label">Rendimento Anual Bruto (€) — para DSTI</label>
                  <input className="p-inp" type="number" value={rendimento} onChange={e => setRendimento(e.target.value)} placeholder="ex: 80000 (opcional)" />
                </div>

                {/* Country LTV badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>{countryProfile.flag}</span>
                  <div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', fontWeight: 500, color: '#0e0e0d' }}>{countryProfile.label}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#1c4a35' }}>LTV {countryProfile.ltv}%</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.5)' }}>Spread {countryProfile.spread}</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: countryProfile.difficulty === 'Fácil' ? '#22c55e' : countryProfile.difficulty === 'Moderado' ? '#c9a96e' : '#e05454' }}>{countryProfile.difficulty}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="p-btn" style={{ flex: 1 }} onClick={calcularAPI} disabled={loading || !montante}>
                    {loading ? '✦ A consultar...' : '✦ Análise IA Completa'}
                  </button>
                  <button className="p-btn p-btn-gold" style={{ padding: '10px 16px' }} onClick={handleExportPDF} disabled={!localCalc}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </div>

            {/* API result notes */}
            {result && !result.error && result.notas && (
              <div className="p-card" style={{ padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#1c4a35', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '10px' }}>✦ Recomendações IA</div>
                {result.notas.map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ color: '#c9a96e', flexShrink: 0, marginTop: '1px' }}>▸</span>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.65)', lineHeight: 1.6 }}>{n}</span>
                  </div>
                ))}
                {result.islamic_finance && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#c9a96e', borderRadius: '4px' }}>
                    ☽ Islamic Finance disponível para este perfil
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!localCalc ? (
              <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏦</div>
                <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: '1.2rem', color: 'rgba(14,14,13,.35)' }}>Introduza o valor do imóvel</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.25)', marginTop: '6px' }}>Calculadora em tempo real</div>
              </div>
            ) : (
              <>
                {/* Main KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Entrada Mínima', val: eur(localCalc.entrada), sub: `${100 - countryProfile.ltv}% do valor`, color: '#c9a96e', bg: '#0c1f15', light: false },
                    { label: 'Capital Emprestado', val: eur(localCalc.loanAmount), sub: `LTV ${countryProfile.ltv}%`, color: '#f4f0e6', bg: '#0c1f15', light: false },
                    { label: 'Prestação/Mês', val: `${eur(localCalc.monthlyPayment)}/mês`, sub: `Taxa ${localCalc.annualRate.toFixed(2)}%`, color: '#1c4a35', bg: '#fff', light: true },
                    { label: 'Total Juros', val: eur(localCalc.totalInterest), sub: `em ${prazo} anos`, color: '#e05454', bg: '#fff', light: true },
                  ].map(k => (
                    <div key={k.label} style={{ padding: '16px 18px', background: k.bg, border: `1px solid ${k.light ? 'rgba(14,14,13,.08)' : k.bg}`, borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: k.light ? 'rgba(14,14,13,.35)' : 'rgba(244,240,230,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>{k.label}</div>
                      <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: '1.3rem', fontWeight: 600, color: k.color, lineHeight: 1 }}>{k.val}</div>
                      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: k.light ? 'rgba(14,14,13,.3)' : 'rgba(244,240,230,.3)', marginTop: '4px' }}>{k.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Income needed */}
                <div className="p-card" style={{ padding: '14px 18px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Acessibilidade (DSTI)</div>
                    <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>Rendimento mínimo: <strong style={{ color: '#1c4a35' }}>{eur(localCalc.incomeNeeded)}/ano</strong></div>
                  </div>
                  {localCalc.dsti > 0 ? (
                    <AffordabilityMeter dsti={localCalc.dsti} />
                  ) : (
                    <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>
                      Introduza o rendimento para calcular DSTI
                    </div>
                  )}
                </div>

                {/* Amortization chart */}
                <div className="p-card" style={{ padding: '16px 18px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                    Amortização ao Longo do Tempo
                  </div>
                  <AmortChart points={localCalc.amortPoints} height={150} />
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '16px', height: '2px', background: '#1c4a35' }} />
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>Capital em dívida</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '16px', height: '2px', background: '#c9a96e', backgroundImage: 'repeating-linear-gradient(90deg, #c9a96e 0, #c9a96e 4px, transparent 4px, transparent 6px)' }} />
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>Total pago acumulado</span>
                    </div>
                  </div>
                </div>

                {/* Euribor note */}
                <div style={{ padding: '10px 14px', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.45)', lineHeight: 1.6, borderRadius: '8px' }}>
                  💡 Euribor 6M: <strong>3.15%</strong> (Abril 2026) + Spread estimado <strong>1.50%</strong> = Taxa <strong>{localCalc.annualRate.toFixed(2)}%</strong>. Valores indicativos — confirmar com banco.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: COMPARAR PAÍSES ─── */}
      {tab === 'comparar' && (
        <div>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: '1.1rem', color: '#0e0e0d', marginBottom: '16px', fontWeight: 300 }}>
            Condições de Financiamento por País de Residência
          </div>
          <div style={{ border: '1px solid rgba(14,14,13,.08)', overflow: 'hidden', marginBottom: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: 'rgba(14,14,13,.03)', borderBottom: '1px solid rgba(14,14,13,.08)', padding: '10px 16px', gap: '8px' }}>
              {['País', 'LTV Máx', 'Spread Típico', 'Dificuldade', 'Islamic'].map(h => (
                <div key={h} style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
              ))}
            </div>
            {COUNTRY_PROFILES.map((c, i) => (
              <div key={c.code} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 16px', gap: '8px', alignItems: 'center', borderBottom: '1px solid rgba(14,14,13,.04)', background: c.code === pais ? 'rgba(28,74,53,.03)' : i % 2 === 0 ? '#fff' : 'rgba(14,14,13,.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{c.flag}</span>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: '#0e0e0d', fontWeight: c.code === pais ? 600 : 400 }}>{c.label}</span>
                  {c.code === pais && <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#1c4a35', border: '1px solid #1c4a35', padding: '1px 6px', borderRadius: '4px' }}>SELECCIONADO</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#1c4a35', fontWeight: 600 }}>{c.ltv}%</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.55)' }}>{c.spread}</div>
                <div>
                  <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', padding: '2px 8px', border: `1px solid ${c.difficulty === 'Fácil' ? 'rgba(34,197,94,.3)' : c.difficulty === 'Moderado' ? 'rgba(201,169,110,.3)' : 'rgba(224,82,82,.3)'}`, color: c.difficulty === 'Fácil' ? '#22c55e' : c.difficulty === 'Moderado' ? '#c9a96e' : '#e05454', borderRadius: '4px' }}>
                    {c.difficulty}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: ['AE', 'SA'].includes(c.code) ? '#c9a96e' : 'rgba(14,14,13,.2)' }}>
                  {['AE', 'SA'].includes(c.code) ? '☽ Sim' : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart: LTV comparison */}
          <div className="p-card" style={{ borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '14px' }}>LTV por País (Máximo)</div>
            {COUNTRY_PROFILES.slice(0, 10).map(c => (
              <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '20px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', textAlign: 'center' }}>{c.flag}</div>
                <div style={{ flex: 1, height: '12px', background: 'rgba(14,14,13,.05)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${c.ltv}%`, background: c.code === pais ? '#1c4a35' : '#c9a96e', transition: 'width .6s ease' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: c.code === pais ? '#1c4a35' : 'rgba(14,14,13,.5)', minWidth: '32px', fontWeight: c.code === pais ? 600 : 400 }}>{c.ltv}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: DOCUMENTAÇÃO ─── */}
      {tab === 'documentos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {COUNTRY_PROFILES.filter(c => c.code !== 'OTHER').map(c => (
            <div key={c.code} className="p-card" style={{ padding: '16px', borderLeft: c.code === pais ? '3px solid #1c4a35' : '3px solid transparent', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.3rem' }}>{c.flag}</span>
                <div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.88rem', fontWeight: 600, color: '#0e0e0d' }}>{c.label}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#1c4a35' }}>LTV {c.ltv}%</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: c.difficulty === 'Fácil' ? '#22c55e' : c.difficulty === 'Moderado' ? '#c9a96e' : '#e05454' }}>{c.difficulty}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {c.docs.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '.78rem', color: 'rgba(14,14,13,.6)' }}>
                    <div style={{ width: '5px', height: '5px', background: '#1c4a35', borderRadius: '50%', flexShrink: 0, marginTop: '6px' }} />
                    {d}
                  </div>
                ))}
              </div>
              {['AE', 'SA'].includes(c.code) && (
                <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#c9a96e', borderRadius: '4px' }}>
                  ☽ Islamic Finance disponível
                </div>
              )}
            </div>
          ))}

          {/* Common docs for all */}
          <div className="p-card" style={{ padding: '16px', gridColumn: '1/-1', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>Documentos Comuns — Todos os Países</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                'Passaporte válido',
                'NIF Português',
                'Prova de morada',
                'IBAN conta bancária PT',
                'Contrato CPCV',
                'Certificado Energético',
                'Caderneta Predial',
                'Certidão Permanente',
                'Planta Habitacional',
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '.78rem', color: 'rgba(14,14,13,.55)' }}>
                  <div style={{ width: '5px', height: '5px', background: '#c9a96e', borderRadius: '50%', flexShrink: 0, marginTop: '6px' }} />
                  {d}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)', fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.6)', lineHeight: 1.6 }}>
              🏦 <strong>Bancos parceiros:</strong> {BANKS_PT.join(' · ')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
