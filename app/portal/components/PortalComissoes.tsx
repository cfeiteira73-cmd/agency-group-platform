'use client'
import { exportToPDF } from '../utils/export'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Deal {
  imovel: string
  valor: string
  fase: string
  comprador?: string
  [key: string]: unknown
}

interface CommResult {
  forecast?: Record<string, string>
  insights?: string[]
  recommendations?: string[]
  [key: string]: unknown
}

export interface PortalComissoesProps {
  deals: Deal[]
  commResult: Record<string, unknown> | null
  setCommResult: (v: Record<string, unknown> | null) => void
  commLoading: boolean
  setCommLoading: (v: boolean) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_PCT_C: Record<string, number> = {
  'Angariação': 0.10,
  'Proposta Enviada': 0.20,
  'Proposta Aceite': 0.35,
  'Due Diligence': 0.50,
  'CPCV Assinado': 0.70,
  'Financiamento': 0.80,
  'Escritura Marcada': 0.90,
  'Escritura Concluída': 1.00,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PortalComissoes({
  deals,
  commResult, setCommResult,
  commLoading, setCommLoading,
}: PortalComissoesProps) {

  const parseValor = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 0

  const pipelineWeighted = deals.reduce((s, d) => {
    const val = parseValor(d.valor)
    const pct = STAGE_PCT_C[d.fase] || 0
    return s + val * 0.05 * pct
  }, 0)

  const realized = deals
    .filter(d => d.fase === 'Escritura Concluída')
    .reduce((s, d) => s + parseValor(d.valor) * 0.05, 0)

  const irsWithholding = pipelineWeighted * 0.25
  const netExpected = pipelineWeighted * 0.75
  const cpcvExpected = pipelineWeighted * 0.5
  const escrituraExpected = pipelineWeighted * 0.5

  const fmt2 = (n: number) => `€${Math.round(n).toLocaleString('pt-PT')}`

  const byStage = Object.entries(STAGE_PCT_C).map(([stage, pct]) => {
    const stageDeals = deals.filter(d => d.fase === stage)
    const stageVal = stageDeals.reduce((s, d) => s + parseValor(d.valor), 0)
    const stageComm = stageVal * 0.05 * pct
    return { stage, deals: stageDeals.length, value: stageVal, commission: stageComm, probability: pct }
  }).filter(s => s.deals > 0)

  const topDeal = deals.reduce((best, d) => {
    const v = parseValor(d.valor) * 0.05
    return v > best.v ? { d, v } : best
  }, { d: deals[0], v: 0 })

  const handleAIAnalysis = async () => {
    setCommLoading(true)
    try {
      const res = await fetch('/api/deal/commission-pl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deals, period: '2026' }),
      })
      const d = await res.json()
      if (d.forecast) setCommResult(d)
    } finally { setCommLoading(false) }
  }

  const handleExportPDF = () => {
    const html = `
      <div class="label">Pipeline & Comissões — Agency Group 2026</div>
      <div class="row">
        <div class="card"><div class="label">Pipeline Ponderado</div><div class="metric">${fmt2(pipelineWeighted)}</div></div>
        <div class="card"><div class="label">Realizado</div><div class="metric green">${fmt2(realized)}</div></div>
        <div class="card"><div class="label">Líquido Esperado</div><div class="metric gold">${fmt2(netExpected)}</div></div>
        <div class="card"><div class="label">IRS Retido</div><div class="metric" style="color:#e05454">${fmt2(irsWithholding)}</div></div>
      </div>
      <hr class="divider">
      <table>
        <thead><tr><th>Deal</th><th>Valor</th><th>Fase</th><th>Comissão Bruta</th><th>Prob.</th><th>Comissão Ponderada</th></tr></thead>
        <tbody>${deals.map(d => {
      const v = parseValor(d.valor)
      const pct = STAGE_PCT_C[d.fase] || 0
      return `<tr><td>${d.imovel}</td><td>${fmt2(v)}</td><td>${d.fase}</td><td>${fmt2(v * 0.05)}</td><td>${Math.round(pct * 100)}%</td><td>${fmt2(v * 0.05 * pct)}</td></tr>`
    }).join('')}</tbody>
      </table>
    `
    exportToPDF('Comissões & P&L — Agency Group', html)
  }

  const cr = commResult as CommResult | null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#0e0e0d', letterSpacing: '-.01em' }}>Comissões & P&L</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '4px' }}>5% Comissão · 50% CPCV + 50% Escritura · IRS 25% Retenção</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="p-btn" style={{ fontSize: '.44rem', padding: '8px 16px' }} onClick={handleAIAnalysis} disabled={commLoading}>
            {commLoading ? 'A analisar...' : '✦ Análise IA'}
          </button>
          <button className="p-btn p-btn-gold" style={{ fontSize: '.44rem', padding: '8px 16px' }} onClick={handleExportPDF}>
            ⬇ Exportar PDF
          </button>
        </div>
      </div>

      {/* Main KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Pipeline Ponderado', value: fmt2(pipelineWeighted), sub: 'Por probabilidade de fase', bg: '#0c1f15', textColor: '#c9a96e' },
          { label: 'Realizado', value: fmt2(realized), sub: 'Escrituras concluídas', bg: 'rgba(28,74,53,.06)', textColor: '#1c4a35' },
          { label: 'Comissão Líquida', value: fmt2(netExpected), sub: 'Após IRS 25% retido', bg: 'rgba(74,156,122,.06)', textColor: '#4a9c7a' },
          { label: 'IRS Retenção', value: fmt2(irsWithholding), sub: '25% retido na fonte', bg: 'rgba(224,84,84,.05)', textColor: '#e05454' },
        ].map(k => (
          <div key={k.label} style={{ padding: '20px 22px', background: k.bg === '#0c1f15' ? '#0c1f15' : '#fff', border: `1px solid ${k.bg === '#0c1f15' ? '#0c1f15' : 'rgba(14,14,13,.08)'}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: k.bg === '#0c1f15' ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 600, color: k.textColor, lineHeight: 1, marginBottom: '4px' }}>{k.value}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: k.bg === '#0c1f15' ? 'rgba(244,240,230,.3)' : 'rgba(14,14,13,.3)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* CPCV vs Escritura split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Comissão CPCV (50%)</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 600, color: '#c9a96e' }}>{fmt2(cpcvExpected)}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.3)', marginTop: '3px' }}>Recebível no CPCV</div>
        </div>
        <div style={{ padding: '16px 20px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.15)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Comissão Escritura (50%)</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 600, color: '#1c4a35' }}>{fmt2(escrituraExpected)}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.3)', marginTop: '3px' }}>Recebível na Escritura</div>
        </div>
        <div style={{ padding: '16px 20px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.08)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Top Deal</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: '#0e0e0d', lineHeight: 1.3 }}>{topDeal.d?.imovel?.split('·')[0]?.trim() || '—'}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: '#c9a96e', marginTop: '4px' }}>{fmt2(topDeal.v)}</div>
        </div>
      </div>

      {/* Pipeline visual bars */}
      <div style={{ background: '#fff', border: '1px solid rgba(14,14,13,.08)', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '16px' }}>Comissão por Fase do Pipeline</div>
        {byStage.map(s => (
          <div key={s.stage} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: '#0e0e0d' }}>{s.stage}</span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)' }}>{s.deals} deal{s.deals !== 1 ? 's' : ''} · {fmt2(s.value)}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', fontWeight: 600, color: '#1c4a35', minWidth: '70px', textAlign: 'right' }}>{fmt2(s.commission)}</span>
              </div>
            </div>
            <div style={{ height: '6px', background: 'rgba(14,14,13,.06)' }}>
              <div style={{ height: '100%', width: `${Math.min(100, s.probability * 100)}%`, background: 'linear-gradient(90deg,#1c4a35,#4a9c7a)', transition: 'width .8s ease' }} />
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.3)', marginTop: '2px' }}>Probabilidade: {Math.round(s.probability * 100)}%</div>
          </div>
        ))}
      </div>

      {/* AI Analysis */}
      {cr && (
        <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', padding: '20px', marginBottom: '20px', animation: 'fadeIn .3s ease' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#1c4a35', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '14px' }}>✦ Análise IA — Previsão de Comissões</div>
          {cr.forecast && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '14px' }}>
              {[['3 Meses', '3months'], ['6 Meses', '6months'], ['12 Meses', '12months']].map(([label, key]) => (
                <div key={key} style={{ padding: '12px 14px', background: '#fff', border: '1px solid rgba(28,74,53,.1)' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px' }}>Previsão {label}</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: '#1c4a35', lineHeight: 1.5 }}>{(cr.forecast as Record<string, string>)[key]}</div>
                </div>
              ))}
            </div>
          )}
          {cr.insights?.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ color: '#c9a96e', flexShrink: 0 }}>▸</span>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.6 }}>{ins}</span>
            </div>
          ))}
        </div>
      )}

      {/* Deal-by-deal table */}
      <div style={{ border: '1px solid rgba(14,14,13,.08)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', background: 'rgba(14,14,13,.03)', borderBottom: '1px solid rgba(14,14,13,.08)', padding: '10px 16px', gap: '8px' }}>
          {['Imóvel', 'Valor', 'Fase', 'Comissão Bruta', 'Prob.', 'Ponderado'].map(h => (
            <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
          ))}
        </div>
        {deals.map((d, i) => {
          const v = parseValor(d.valor)
          const comm = v * 0.05
          const pct = STAGE_PCT_C[d.fase] || 0
          const ponderado = comm * pct
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', gap: '8px', alignItems: 'center', borderBottom: '1px solid rgba(14,14,13,.04)', background: i % 2 === 0 ? '#fff' : 'rgba(14,14,13,.01)' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 500, color: '#0e0e0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.imovel}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.6)' }}>{fmt2(v)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', padding: '2px 6px', background: 'rgba(28,74,53,.07)', color: '#1c4a35', border: '1px solid rgba(28,74,53,.15)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fase}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.6)' }}>{fmt2(comm)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#c9a96e', fontWeight: 600 }}>{Math.round(pct * 100)}%</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: '#1c4a35', fontWeight: 600 }}>{fmt2(ponderado)}</div>
            </div>
          )
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 16px', gap: '8px', background: 'rgba(28,74,53,.04)', borderTop: '2px solid rgba(28,74,53,.15)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: '#1c4a35', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', gridColumn: '1/5' }}>TOTAL PIPELINE</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.4)' }}></div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 700, color: '#1c4a35' }}>{fmt2(pipelineWeighted)}</div>
        </div>
      </div>
    </div>
  )
}
