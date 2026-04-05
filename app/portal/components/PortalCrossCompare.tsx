'use client'
import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Market {
  id: string
  flag: string
  name: string
  country: string
  priceM2: number
  yoyChange: number
  rentalYield: number
  taxBuyer: number
  taxSeller: number
  visaOptions: string[]
  mortgageLTV: number
  foreignBuyerLimit: boolean
  currency: string
  marketLiquidity: string
  avgDaysMarket: number
  transactionCosts: number
  capitalGainsTax: number
  imt: boolean
  notesKey: string
  pros: string[]
  cons: string[]
  score: number
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const MARKETS: Market[] = [
  {
    id: 'PT-Lisboa', flag: '🇵🇹', name: 'Lisboa', country: 'Portugal',
    priceM2: 6800, yoyChange: 14.1, rentalYield: 4.2, taxBuyer: 6.5,
    taxSeller: 28, visaOptions: ['Golden Visa', 'D7', 'NHR/IFICI'],
    mortgageLTV: 80, foreignBuyerLimit: false, currency: 'EUR',
    marketLiquidity: 'Alta', avgDaysMarket: 145, transactionCosts: 8.5,
    capitalGainsTax: 28, imt: true, notesKey: 'Mercado mais líquido · Lusofonia · Gateway Europa',
    pros: ['Estabilidade política', 'NHR fiscal', 'Gateway UE', 'Qualidade de vida'],
    cons: ['Burocracia', 'Mercado aquecido', 'Habitação local sob pressão'],
    score: 88,
  },
  {
    id: 'PT-Cascais', flag: '🇵🇹', name: 'Cascais', country: 'Portugal',
    priceM2: 4713, yoyChange: 8.7, rentalYield: 3.8, taxBuyer: 6.5,
    taxSeller: 28, visaOptions: ['Golden Visa', 'D7', 'NHR/IFICI'],
    mortgageLTV: 80, foreignBuyerLimit: false, currency: 'EUR',
    marketLiquidity: 'Alta', avgDaysMarket: 89, transactionCosts: 8.5,
    capitalGainsTax: 28, imt: true, notesKey: 'Riviera portuguesa · Expat community · Golf',
    pros: ['Comunidade expat', 'Praia + golf', 'Escolas internacionais', 'Segurança'],
    cons: ['Preços em alta', 'Trânsito Lisboa', 'Oferta limitada'],
    score: 92,
  },
  {
    id: 'ES-Madrid', flag: '🇪🇸', name: 'Madrid', country: 'Espanha',
    priceM2: 4800, yoyChange: 11.2, rentalYield: 3.5, taxBuyer: 6.0,
    taxSeller: 19, visaOptions: ['Golden Visa (€500K)', 'Nómada Digital'],
    mortgageLTV: 70, foreignBuyerLimit: false, currency: 'EUR',
    marketLiquidity: 'Alta', avgDaysMarket: 120, transactionCosts: 10,
    capitalGainsTax: 19, imt: false, notesKey: 'Capital ibérica · Liquidez alta',
    pros: ['Grande mercado', 'Liquidez', 'Crescimento económico', 'Infraestrutura'],
    cons: ['Fiscalidade mais pesada', 'Burocracia', 'Sem NHR equivalente'],
    score: 78,
  },
  {
    id: 'FR-Paris', flag: '🇫🇷', name: 'Paris', country: 'França',
    priceM2: 9800, yoyChange: -3.2, rentalYield: 2.8, taxBuyer: 7.5,
    taxSeller: 36, visaOptions: ['Talent Visa', 'Investidor'],
    mortgageLTV: 80, foreignBuyerLimit: false, currency: 'EUR',
    marketLiquidity: 'Média', avgDaysMarket: 180, transactionCosts: 12,
    capitalGainsTax: 36, imt: false, notesKey: 'Mercado a corrigir · Sobretaxas',
    pros: ['Prestígio', 'Liquidez eventual', 'Euro zone'],
    cons: ['Preços altos', 'Queda 2023-24', 'Fiscalidade pesada', 'Controlo rendas'],
    score: 54,
  },
  {
    id: 'UK-London', flag: '🇬🇧', name: 'Londres', country: 'Reino Unido',
    priceM2: 11200, yoyChange: 1.8, rentalYield: 3.2, taxBuyer: 12,
    taxSeller: 28, visaOptions: ['Investor Visa (£2M)'],
    mortgageLTV: 75, foreignBuyerLimit: false, currency: 'GBP',
    marketLiquidity: 'Alta', avgDaysMarket: 95, transactionCosts: 15,
    capitalGainsTax: 28, imt: false, notesKey: 'Post-Brexit incerteza · Stamp duty pesado',
    pros: ['Liquidez máxima', 'Prestígio global', 'Serviços premium'],
    cons: ['Preços proibitivos', 'Stamp duty pesado', 'Volatilidade GBP', 'Sem Golden Visa'],
    score: 62,
  },
  {
    id: 'AE-Dubai', flag: '🇦🇪', name: 'Dubai', country: 'Emirados',
    priceM2: 3800, yoyChange: 20.1, rentalYield: 6.8, taxBuyer: 4,
    taxSeller: 0, visaOptions: ['Investor Visa', 'Golden Visa 10Y'],
    mortgageLTV: 70, foreignBuyerLimit: false, currency: 'AED',
    marketLiquidity: 'Alta', avgDaysMarket: 45, transactionCosts: 6,
    capitalGainsTax: 0, imt: false, notesKey: 'Zero impostos capital · Alta yield · Crescimento forte',
    pros: ['Zero capital gains', 'Alta yield', 'Crescimento forte', 'Golden Visa 10Y', 'Tax-free'],
    cons: ['Risco regulatório', 'Calor extremo', 'Cultura negócio diferente', 'Moeda AED'],
    score: 82,
  },
  {
    id: 'US-Miami', flag: '🇺🇸', name: 'Miami', country: 'EUA',
    priceM2: 8500, yoyChange: 4.2, rentalYield: 4.1, taxBuyer: 2,
    taxSeller: 20, visaOptions: ['EB-5 ($800K)', 'O-1', 'E-2'],
    mortgageLTV: 65, foreignBuyerLimit: false, currency: 'USD',
    marketLiquidity: 'Alta', avgDaysMarket: 78, transactionCosts: 5,
    capitalGainsTax: 20, imt: false, notesKey: 'Gateway América Latina · Tax-friendly Florida',
    pros: ['Florida sem imposto rendimento', 'Liquidez alta', 'Gateway LATAM', 'Infraestrutura'],
    cons: ['Câmbio USD', 'Property tax anual', 'Seguro caro (furacões)', 'Visa difícil'],
    score: 74,
  },
  {
    id: 'GR-Athens', flag: '🇬🇷', name: 'Atenas', country: 'Grécia',
    priceM2: 2800, yoyChange: 13.5, rentalYield: 5.2, taxBuyer: 3.09,
    taxSeller: 15, visaOptions: ['Golden Visa (€250K)', 'Digital Nomad'],
    mortgageLTV: 60, foreignBuyerLimit: false, currency: 'EUR',
    marketLiquidity: 'Média', avgDaysMarket: 210, transactionCosts: 8,
    capitalGainsTax: 15, imt: false, notesKey: 'Valorização forte · Golden Visa acessível',
    pros: ['Preço entrada baixo', 'Golden Visa €250K', 'Valorização forte', 'Clima'],
    cons: ['Liquidez média', 'Burocracia', 'Economia menos estável', 'Mercado pequeno'],
    score: 76,
  },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const BG = '#f4f0e6'
const GREEN = '#1c4a35'
const GOLD = '#c9a96e'
const TEXT = '#0e0e0d'
const GREEN_LIGHT = '#eaf2ec'
const RED_LIGHT = '#fdecea'
const GOLD_LIGHT = '#fdf6ec'

const CORMORANT = "'Cormorant', serif"
const DM_MONO = "'DM Mono', monospace"
const JOST = "'Jost', sans-serif"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBest<T extends keyof Market>(markets: Market[], key: T, higherIsBetter = true): string {
  if (markets.length === 0) return ''
  const vals = markets.map(m => Number(m[key]))
  const best = higherIsBetter ? Math.max(...vals) : Math.min(...vals)
  const bestMarket = markets.find(m => Number(m[key]) === best)
  return bestMarket?.id ?? ''
}

function getWorst<T extends keyof Market>(markets: Market[], key: T, higherIsBetter = true): string {
  if (markets.length === 0) return ''
  const vals = markets.map(m => Number(m[key]))
  const worst = higherIsBetter ? Math.min(...vals) : Math.max(...vals)
  const worstMarket = markets.find(m => Number(m[key]) === worst)
  return worstMarket?.id ?? ''
}

function fmt(val: number, suffix = '') {
  if (val === 0 && suffix === '%') return '0%'
  return `${val.toLocaleString('pt-PT')}${suffix}`
}

function scoreColor(score: number) {
  if (score >= 85) return GREEN
  if (score >= 70) return GOLD
  return '#b55'
}

// ─── Sub-score derivation ─────────────────────────────────────────────────────

function deriveSubScores(m: Market) {
  // Rendibilidade: yield 0–10% → 0–100
  const rendibilidade = Math.min(100, Math.round((m.rentalYield / 10) * 100))
  // Valorização: yoy -5 to +25 → 0–100
  const valorizacao = Math.min(100, Math.max(0, Math.round(((m.yoyChange + 5) / 30) * 100)))
  // Fiscalidade: capitalGains 0–40 → inverted 0–100
  const fiscalidade = Math.min(100, Math.max(0, Math.round(((40 - m.capitalGainsTax) / 40) * 100)))
  // Liquidez
  const liquidezMap: Record<string, number> = { 'Alta': 90, 'Média': 60, 'Baixa': 30 }
  const liquidez = liquidezMap[m.marketLiquidity] ?? 60
  // Facilidade: lower days + lower transaction costs = easier
  const facilidade = Math.min(100, Math.max(0, Math.round(100 - (m.avgDaysMarket / 210) * 50 - (m.transactionCosts / 15) * 50)))

  return { rendibilidade, valorizacao, fiscalidade, liquidez, facilidade }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          bottom: '120%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: GREEN,
          color: '#fff',
          fontFamily: JOST,
          fontSize: 11,
          padding: '6px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          zIndex: 100,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {text}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '5px solid transparent',
            borderTopColor: GREEN,
          }} />
        </span>
      )}
    </span>
  )
}

// ─── ScoreCircle ──────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const filled = (score / 100) * c
  const color = scoreColor(score)
  return (
    <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
      <svg width={68} height={68} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={34} cy={34} r={r} fill="none" stroke="#e5e0d5" strokeWidth={5} />
        <circle
          cx={34} cy={34} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: DM_MONO, fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: JOST, fontSize: 8, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>AG</span>
      </div>
    </div>
  )
}

// ─── SubScoreBar ──────────────────────────────────────────────────────────────

function SubScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: JOST, fontSize: 11, color: '#666', letterSpacing: 0.3 }}>{label}</span>
        <span style={{ fontFamily: DM_MONO, fontSize: 11, color, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: '#e5e0d5', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

// ─── MarketSelectorCard ───────────────────────────────────────────────────────

function MarketSelectorCard({
  market, selected, onToggle, disabled,
}: {
  market: Market
  selected: boolean
  onToggle: () => void
  disabled: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const color = scoreColor(market.score)

  return (
    <button
      onClick={onToggle}
      disabled={disabled && !selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '14px 10px',
        borderRadius: 12,
        border: selected ? `2px solid ${GOLD}` : '2px solid transparent',
        background: selected ? GOLD_LIGHT : hovered ? '#ece8de' : '#fff',
        cursor: (disabled && !selected) ? 'not-allowed' : 'pointer',
        opacity: (disabled && !selected) ? 0.45 : 1,
        transition: 'all 0.2s ease',
        boxShadow: selected ? `0 0 0 1px ${GOLD}` : hovered ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
        minWidth: 90,
        position: 'relative',
        outline: 'none',
      }}
    >
      {selected && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 16, height: 16, borderRadius: '50%',
          background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>
        </span>
      )}
      <span style={{ fontSize: 26 }}>{market.flag}</span>
      <span style={{ fontFamily: JOST, fontSize: 13, fontWeight: 600, color: TEXT }}>{market.name}</span>
      <span style={{ fontFamily: JOST, fontSize: 10, color: '#888', letterSpacing: 0.3 }}>{market.country}</span>
      <span style={{
        fontFamily: DM_MONO, fontSize: 11, fontWeight: 700,
        color, background: `${color}18`, padding: '2px 7px', borderRadius: 20,
      }}>
        {market.score}
      </span>
    </button>
  )
}

// ─── ComparisonTable ──────────────────────────────────────────────────────────

const TABLE_ROWS: {
  label: string
  key: keyof Market
  format: (m: Market) => string
  higherIsBetter: boolean
  tooltip: string
}[] = [
  {
    label: 'Preço/m²',
    key: 'priceM2',
    format: m => `${m.currency === 'EUR' ? '€' : m.currency === 'GBP' ? '£' : '$'}${m.priceM2.toLocaleString('pt-PT')}`,
    higherIsBetter: false,
    tooltip: 'Preço médio por m² no mercado prime',
  },
  {
    label: 'Variação YoY',
    key: 'yoyChange',
    format: m => `${m.yoyChange > 0 ? '+' : ''}${m.yoyChange}%`,
    higherIsBetter: true,
    tooltip: 'Variação de preço ano a ano',
  },
  {
    label: 'Yield Bruto',
    key: 'rentalYield',
    format: m => `${m.rentalYield}%`,
    higherIsBetter: true,
    tooltip: 'Rendimento bruto de arrendamento estimado',
  },
  {
    label: 'Custo Comprador',
    key: 'taxBuyer',
    format: m => `${m.taxBuyer}%`,
    higherIsBetter: false,
    tooltip: 'Impostos e custos de transação para o comprador',
  },
  {
    label: 'Mais-Valias',
    key: 'capitalGainsTax',
    format: m => m.capitalGainsTax === 0 ? '0% ✓' : `${m.capitalGainsTax}%`,
    higherIsBetter: false,
    tooltip: 'Taxa de imposto sobre mais-valias imobiliárias',
  },
  {
    label: 'LTV Máx.',
    key: 'mortgageLTV',
    format: m => `${m.mortgageLTV}%`,
    higherIsBetter: true,
    tooltip: 'Loan-to-Value máximo para não-residentes',
  },
  {
    label: 'Dias Mercado',
    key: 'avgDaysMarket',
    format: m => `${m.avgDaysMarket}d`,
    higherIsBetter: false,
    tooltip: 'Tempo médio até venda',
  },
  {
    label: 'Visto Investor',
    key: 'visaOptions',
    format: m => m.visaOptions.length > 0 ? `${m.visaOptions.length} opção${m.visaOptions.length > 1 ? 'ões' : ''}` : '—',
    higherIsBetter: true,
    tooltip: 'Número de opções de visto para investidores',
  },
  {
    label: 'Pontuação AG',
    key: 'score',
    format: m => `${m.score}/100`,
    higherIsBetter: true,
    tooltip: 'Score interno Agency Group (multifator)',
  },
]

function ComparisonTable({ markets }: { markets: Market[] }) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e5e0d5' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr style={{ background: GREEN }}>
            <th style={{
              fontFamily: JOST, fontSize: 11, fontWeight: 600, color: '#fff',
              letterSpacing: 1, textTransform: 'uppercase', padding: '12px 16px',
              textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)',
            }}>
              Métrica
            </th>
            {markets.map(m => (
              <th key={m.id} style={{
                fontFamily: JOST, fontSize: 12, fontWeight: 700, color: '#fff',
                padding: '12px 16px', textAlign: 'center',
                borderRight: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 18 }}>{m.flag}</span>
                  <span>{m.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_ROWS.map((row, ri) => {
            const bestId = row.key === 'visaOptions'
              ? markets.reduce((a, b) => (a.visaOptions.length >= b.visaOptions.length ? a : b), markets[0])?.id
              : getBest(markets, row.key, row.higherIsBetter)
            const worstId = row.key === 'visaOptions'
              ? markets.reduce((a, b) => (a.visaOptions.length <= b.visaOptions.length ? a : b), markets[0])?.id
              : getWorst(markets, row.key, row.higherIsBetter)

            return (
              <tr key={row.key} style={{ background: ri % 2 === 0 ? '#fff' : '#faf8f4' }}>
                <td style={{
                  padding: '11px 16px',
                  borderRight: '1px solid #eee',
                  borderBottom: '1px solid #eee',
                }}>
                  <Tooltip text={row.tooltip}>
                    <span style={{
                      fontFamily: JOST, fontSize: 12, fontWeight: 600, color: TEXT,
                      borderBottom: '1px dashed #ccc', cursor: 'help',
                    }}>
                      {row.label}
                    </span>
                  </Tooltip>
                </td>
                {markets.map(m => {
                  const cellKey = `${row.key}-${m.id}`
                  const isBest = m.id === bestId
                  const isWorst = m.id === worstId && markets.length > 1
                  const isHovered = hoveredCell === cellKey

                  return (
                    <td
                      key={m.id}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        padding: '11px 16px',
                        textAlign: 'center',
                        borderRight: '1px solid #eee',
                        borderBottom: '1px solid #eee',
                        background: isHovered
                          ? '#f0ece0'
                          : isBest
                            ? GREEN_LIGHT
                            : isWorst
                              ? RED_LIGHT
                              : 'transparent',
                        transition: 'background 0.15s ease',
                        position: 'relative',
                      }}
                    >
                      <span style={{
                        fontFamily: DM_MONO,
                        fontSize: 13,
                        fontWeight: isBest ? 700 : 400,
                        color: isBest ? GREEN : isWorst ? '#b55' : TEXT,
                      }}>
                        {row.format(m)}
                      </span>
                      {isBest && markets.length > 1 && (
                        <span style={{
                          position: 'absolute', top: 4, right: 4,
                          fontSize: 8, color: GREEN, fontWeight: 700,
                          fontFamily: JOST, letterSpacing: 0.5,
                        }}>
                          ▲
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── ScoreRadar (bar-based visual) ───────────────────────────────────────────

function ScorePanel({ markets }: { markets: Market[] }) {
  const DIMS = [
    { key: 'rendibilidade', label: 'Rendibilidade' },
    { key: 'valorizacao', label: 'Valorização' },
    { key: 'fiscalidade', label: 'Fiscalidade' },
    { key: 'liquidez', label: 'Liquidez' },
    { key: 'facilidade', label: 'Facilidade Compra' },
  ] as const

  const COLORS = [GOLD, GREEN, '#6a9ecf', '#b5836e', '#7cb58e']

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e5e0d5',
      padding: '24px 28px',
    }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: CORMORANT, fontSize: 22, fontWeight: 600, color: GREEN, margin: 0 }}>
          Score Multifator
        </h3>
        <p style={{ fontFamily: JOST, fontSize: 12, color: '#888', margin: '4px 0 0' }}>
          Análise dimensional por mercado — Agency Group methodology
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {markets.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
            <span style={{ fontFamily: JOST, fontSize: 12, color: TEXT }}>{m.flag} {m.name}</span>
          </div>
        ))}
      </div>

      {/* Dimension bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {DIMS.map(dim => (
          <div key={dim.key}>
            <div style={{
              fontFamily: JOST, fontSize: 11, fontWeight: 600, color: '#666',
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
            }}>
              {dim.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {markets.map((m, i) => {
                const subs = deriveSubScores(m)
                const val = subs[dim.key]
                const color = COLORS[i % COLORS.length]
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, flexShrink: 0, width: 22 }}>{m.flag}</span>
                    <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${val}%`,
                        background: color,
                        borderRadius: 4,
                        transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                    <span style={{
                      fontFamily: DM_MONO, fontSize: 11, fontWeight: 600,
                      color, width: 28, textAlign: 'right', flexShrink: 0,
                    }}>
                      {val}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Overall scores */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #eee' }}>
        <div style={{
          fontFamily: JOST, fontSize: 11, fontWeight: 600, color: '#666',
          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
        }}>
          Score Global AG
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {markets.map((m, i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <div key={m.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: '#faf8f4', borderRadius: 10, padding: '12px 16px',
                border: `2px solid ${color}30`,
                minWidth: 90,
              }}>
                <span style={{ fontSize: 22 }}>{m.flag}</span>
                <span style={{ fontFamily: DM_MONO, fontSize: 22, fontWeight: 700, color }}>{m.score}</span>
                <span style={{ fontFamily: JOST, fontSize: 10, color: '#888', letterSpacing: 0.5 }}>{m.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── DetailCard ───────────────────────────────────────────────────────────────

function DetailCard({ market }: { market: Market }) {
  const subs = deriveSubScores(market)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #e5e0d5',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${GREEN} 0%, #2a6649 100%)`,
        padding: '20px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <span style={{ fontSize: 36 }}>{market.flag}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: CORMORANT, fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            {market.name}
          </div>
          <div style={{ fontFamily: JOST, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, letterSpacing: 0.5 }}>
            {market.country} · {market.currency}
          </div>
          <div style={{ fontFamily: JOST, fontSize: 10, color: GOLD, marginTop: 4, letterSpacing: 0.3 }}>
            {market.notesKey}
          </div>
        </div>
        <ScoreCircle score={market.score} />
      </div>

      {/* Body */}
      <div style={{ padding: '18px 22px', flex: 1 }}>
        {/* Key stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
        }}>
          {[
            { label: 'Preço/m²', value: `${market.currency === 'EUR' ? '€' : market.currency === 'GBP' ? '£' : '$'}${market.priceM2.toLocaleString('pt-PT')}` },
            { label: 'Yield Bruto', value: `${market.rentalYield}%` },
            { label: 'YoY', value: `${market.yoyChange > 0 ? '+' : ''}${market.yoyChange}%` },
            { label: 'Mais-Valias', value: market.capitalGainsTax === 0 ? 'Zero ✓' : `${market.capitalGainsTax}%` },
            { label: 'LTV', value: `${market.mortgageLTV}%` },
            { label: 'Dias Venda', value: `${market.avgDaysMarket}d` },
          ].map(s => (
            <div key={s.label} style={{
              background: '#faf8f4', borderRadius: 8, padding: '10px 12px',
              border: '1px solid #eee',
            }}>
              <div style={{ fontFamily: JOST, fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>
                {s.label}
              </div>
              <div style={{ fontFamily: DM_MONO, fontSize: 14, fontWeight: 700, color: TEXT }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Sub-scores */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: JOST, fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Score Dimensional
          </div>
          <SubScoreBar label="Rendibilidade" value={subs.rendibilidade} color={GOLD} />
          <SubScoreBar label="Valorização" value={subs.valorizacao} color={GREEN} />
          <SubScoreBar label="Fiscalidade" value={subs.fiscalidade} color="#6a9ecf" />
          <SubScoreBar label="Liquidez" value={subs.liquidez} color="#7cb58e" />
          <SubScoreBar label="Facilidade Compra" value={subs.facilidade} color="#b5836e" />
        </div>

        {/* Pros / Cons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: JOST, fontSize: 10, fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              Vantagens
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {market.pros.map((p, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: GREEN, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>+</span>
                  <span style={{ fontFamily: JOST, fontSize: 11, color: TEXT, lineHeight: 1.4 }}>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontFamily: JOST, fontSize: 10, fontWeight: 600, color: '#b55', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              Limitações
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {market.cons.map((c, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#b55', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>−</span>
                  <span style={{ fontFamily: JOST, fontSize: 11, color: TEXT, lineHeight: 1.4 }}>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Visa pills */}
        <div>
          <div style={{ fontFamily: JOST, fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
            Vistos Disponíveis
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {market.visaOptions.map(v => (
              <span key={v} style={{
                fontFamily: JOST, fontSize: 10, fontWeight: 600,
                color: GREEN, background: GREEN_LIGHT,
                padding: '3px 9px', borderRadius: 20,
                border: `1px solid ${GREEN}30`,
              }}>
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── WhyPortugal ──────────────────────────────────────────────────────────────

function WhyPortugal() {
  const advantages = [
    {
      icon: '🏛️',
      title: 'Estabilidade Política & Jurídica',
      text: 'Democracia consolidada, membro UE, direito romano — quadro legal previsível para investidores internacionais.',
    },
    {
      icon: '📋',
      title: 'NHR / IFICI — Vantagem Fiscal Única',
      text: '10 anos de fiscalidade reduzida para novos residentes. Regime incomparável na Europa Ocidental.',
    },
    {
      icon: '🌍',
      title: 'Gateway Europa + Lusofonia',
      text: 'Acesso a 450M de consumidores UE + pontes com Brasil, Angola, Moçambique, Cabo Verde e Ásia.',
    },
    {
      icon: '🏖️',
      title: 'Qualidade de Vida Top Global',
      text: 'Lisboa top 5 luxo mundial 2026. Clima, gastronomia, segurança, saúde e custo de vida competitivo.',
    },
    {
      icon: '📈',
      title: 'Mercado em Valorização',
      text: '+17,6% estimado 2026 · 169.812 transacções · Procura internacional sustentada e oferta limitada.',
    },
    {
      icon: '✈️',
      title: 'Acessibilidade Internacional',
      text: 'Lisboa hub Europa-América. Voos directos NYC, Dubai, São Paulo, Londres, Frankfurt, Doha.',
    },
  ]

  return (
    <div style={{
      background: `linear-gradient(135deg, ${GREEN} 0%, #163828 100%)`,
      borderRadius: 16,
      padding: '36px 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: 'rgba(201,169,110,0.08)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: -30,
        width: 160, height: 160, borderRadius: '50%',
        background: 'rgba(201,169,110,0.05)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{
            fontFamily: JOST, fontSize: 10, fontWeight: 600, letterSpacing: 2,
            textTransform: 'uppercase', color: GOLD,
          }}>
            Agency Group · AMI 22506
          </span>
        </div>
        <h2 style={{
          fontFamily: CORMORANT, fontSize: 36, fontWeight: 700,
          color: '#fff', margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Por que Portugal <em style={{ color: GOLD }}>vence</em>
        </h2>
        <p style={{
          fontFamily: JOST, fontSize: 14, color: 'rgba(255,255,255,0.65)',
          margin: '0 0 32px', maxWidth: 560, lineHeight: 1.6,
        }}>
          Numa análise comparativa com 7 mercados globais, Portugal consolida-se como a escolha premium para investidores e famílias de alto rendimento em 2026.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}>
          {advantages.map((adv, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '18px 20px',
              border: '1px solid rgba(201,169,110,0.2)',
              backdropFilter: 'blur(4px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{adv.icon}</span>
                <div>
                  <div style={{
                    fontFamily: JOST, fontSize: 13, fontWeight: 700,
                    color: GOLD, marginBottom: 5,
                  }}>
                    {adv.title}
                  </div>
                  <div style={{
                    fontFamily: JOST, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5,
                  }}>
                    {adv.text}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom stat strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 1,
          background: 'rgba(201,169,110,0.15)',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(201,169,110,0.2)',
        }}>
          {[
            { label: 'Lisboa prime', value: '€6.800/m²' },
            { label: 'Cascais prime', value: '€4.713/m²' },
            { label: 'AG Score Lisboa', value: '88/100' },
            { label: 'AG Score Cascais', value: '92/100' },
            { label: 'Crescimento 2026', value: '+17,6%' },
            { label: 'Comissão AG', value: '5%' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '14px 16px', textAlign: 'center',
              background: 'rgba(0,0,0,0.15)',
            }}>
              <div style={{ fontFamily: DM_MONO, fontSize: 16, fontWeight: 700, color: GOLD }}>{s.value}</div>
              <div style={{ fontFamily: JOST, fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 3, letterSpacing: 0.5 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalCrossCompare() {
  const [selectedIds, setSelectedIds] = useState<string[]>(['PT-Cascais', 'PT-Lisboa'])
  const [activeTab, setActiveTab] = useState<'table' | 'score' | 'cards'>('table')

  const MAX_SELECTION = 4

  function toggleMarket(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id)
      }
      if (prev.length >= MAX_SELECTION) return prev
      return [...prev, id]
    })
  }

  const selectedMarkets = MARKETS.filter(m => selectedIds.includes(m.id))

  const tabs = [
    { key: 'table' as const, label: 'Tabela Comparativa' },
    { key: 'score' as const, label: 'Score Multifator' },
    { key: 'cards' as const, label: 'Detalhes' },
  ]

  return (
    <div style={{
      fontFamily: JOST,
      color: TEXT,
      background: BG,
      minHeight: '100vh',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 3, height: 32, background: GOLD, borderRadius: 2, flexShrink: 0,
            }} />
            <div>
              <span style={{
                fontFamily: JOST, fontSize: 10, fontWeight: 600,
                color: GOLD, letterSpacing: 2, textTransform: 'uppercase',
              }}>
                Agency Group · International
              </span>
            </div>
          </div>
          <h1 style={{
            fontFamily: CORMORANT, fontSize: 48, fontWeight: 700,
            color: GREEN, margin: 0, lineHeight: 1.05,
          }}>
            Comparar{' '}
            <em style={{ fontStyle: 'italic', color: GOLD }}>Mercados</em>
          </h1>
          <p style={{
            fontFamily: JOST, fontSize: 14, color: '#666',
            marginTop: 10, maxWidth: 520, lineHeight: 1.6,
          }}>
            8 mercados · Preço · Yield · Fiscal · Lifestyle — análise exclusiva Agency Group para decisões de investimento internacional.
          </p>
        </div>

        {/* ── Market Selector ── */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e5e0d5',
          padding: '24px 28px',
          marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontFamily: CORMORANT, fontSize: 20, fontWeight: 600, color: GREEN }}>
                Seleccionar Mercados
              </div>
              <div style={{ fontFamily: JOST, fontSize: 12, color: '#888', marginTop: 2 }}>
                Seleccione até {MAX_SELECTION} mercados para comparar
                {selectedIds.length > 0 && (
                  <span style={{ color: GOLD, fontWeight: 600, marginLeft: 8 }}>
                    · {selectedIds.length}/{MAX_SELECTION} seleccionados
                  </span>
                )}
              </div>
            </div>
            {selectedIds.length >= 2 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {tabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    style={{
                      fontFamily: JOST, fontSize: 12, fontWeight: 600,
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                      border: activeTab === t.key ? 'none' : '1px solid #e5e0d5',
                      background: activeTab === t.key ? GREEN : '#fff',
                      color: activeTab === t.key ? '#fff' : TEXT,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            {MARKETS.map(m => (
              <MarketSelectorCard
                key={m.id}
                market={m}
                selected={selectedIds.includes(m.id)}
                onToggle={() => toggleMarket(m.id)}
                disabled={selectedIds.length >= MAX_SELECTION}
              />
            ))}
          </div>

          {selectedIds.length === 0 && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: GOLD_LIGHT, borderRadius: 8,
              border: `1px solid ${GOLD}40`,
              fontFamily: JOST, fontSize: 12, color: '#9a7540',
            }}>
              Seleccione pelo menos 2 mercados para iniciar a comparação.
            </div>
          )}

          {selectedIds.length === 1 && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: GOLD_LIGHT, borderRadius: 8,
              border: `1px solid ${GOLD}40`,
              fontFamily: JOST, fontSize: 12, color: '#9a7540',
            }}>
              Seleccione mais 1 mercado (mínimo 2) para comparar.
            </div>
          )}
        </div>

        {/* ── Comparison Content ── */}
        {selectedMarkets.length >= 2 && (
          <div style={{ marginBottom: 36 }}>
            {/* Context line */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
              padding: '10px 16px', background: '#fff', borderRadius: 8,
              border: '1px solid #e5e0d5',
            }}>
              {selectedMarkets.map(m => (
                <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 16 }}>{m.flag}</span>
                  <span style={{ fontFamily: JOST, fontSize: 12, fontWeight: 600, color: TEXT }}>{m.name}</span>
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontFamily: JOST, fontSize: 11, color: '#888' }}>
                {selectedMarkets.length} mercados · Dados 2026
              </span>
            </div>

            {activeTab === 'table' && <ComparisonTable markets={selectedMarkets} />}
            {activeTab === 'score' && <ScorePanel markets={selectedMarkets} />}
            {activeTab === 'cards' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 20,
              }}>
                {selectedMarkets.map(m => (
                  <DetailCard key={m.id} market={m} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Why Portugal (always visible) ── */}
        <WhyPortugal />

        {/* ── Footer ── */}
        <div style={{
          marginTop: 24, textAlign: 'center',
          fontFamily: JOST, fontSize: 11, color: '#aaa', lineHeight: 1.6,
        }}>
          Agency Group · AMI 22506 · Dados indicativos 2026 · Não constituem aconselhamento financeiro ou fiscal.
          <br />
          Para análise personalizada contacte a nossa equipa de investment advisory.
        </div>
      </div>
    </div>
  )
}
