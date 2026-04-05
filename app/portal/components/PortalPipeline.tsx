'use client'
import { useState, useMemo } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { PIPELINE_STAGES, STAGE_PCT, STAGE_COLOR, CHECKLISTS } from './constants'
import type { Deal } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalPipelineProps {
  onToggleCheck: (dealId: number, fase: string, idx: number) => void
  onChangeFase: (dealId: number, fase: string) => void
  onAddDeal: () => void
  onDealRisk: (dealId: number) => Promise<void>
  onDealNego: (dealId: number) => Promise<void>
  exportToPDF: (title: string, html: string) => void
}

type DealWithMeta = Deal & { createdAt?: string }

type DocStatus = 'obtido' | 'em_falta' | 'nao_aplicavel'

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMISSION_RATE = 0.05

// Weights for pipeline probability by stage
const STAGE_PROB: Record<string, number> = {
  'Angariação': 0.10,
  'Proposta Enviada': 0.20,
  'Proposta Aceite': 0.40,
  'Due Diligence': 0.55,
  'CPCV Assinado': 0.75,
  'Financiamento': 0.85,
  'Escritura Marcada': 0.95,
  'Escritura Concluída': 1.00,
}

const KANBAN_STAGES = [
  'Angariação',
  'Proposta Enviada',
  'Proposta Aceite',
  'Due Diligence',
  'CPCV Assinado',
  'Escritura Marcada',
]

const DOCS_BY_PHASE: Record<string, string[]> = {
  'Angariação': ['BI/Passaporte vendedor', 'Caderneta Predial', 'Certidão Predial', 'Planta do Imóvel', 'Licença de Habitação', 'Certificado Energético'],
  'Proposta Enviada': ['BI/Passaporte comprador', 'NIF comprador', 'Prova de Fundos', 'Carta de Oferta'],
  'Due Diligence': ['Relatório Técnico Vistoria', 'Declaração Débitos IMI', 'Certidão sem Ónus', 'Licença de Obras (se remodelado)'],
  'CPCV Assinado': ['CPCV Assinado', 'Recibo de Sinal', 'Procuração (se aplicável)'],
  'Financiamento': ['Aprovação Bancária', 'Avaliação Bancária', 'Seguro Multirriscos'],
  'Escritura Marcada': ['Comprovativo IMT Pago', 'Comprovativo IS Pago', 'Documentos Notariais'],
  'Escritura Concluída': ['Escritura Assinada', 'Registo Predial Atualizado', 'Recibo de Comissão'],
}

const TIPO_OPTIONS = ['Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Comercial'] as const

// ─── Health Score ─────────────────────────────────────────────────────────────

function dealHealthScore(deal: DealWithMeta): { score: number; issues: string[] } {
  let score = 100
  const issues: string[] = []
  const daysSinceCreated = (Date.now() - new Date(deal.createdAt || Date.now()).getTime()) / 86400000

  if (daysSinceCreated > 90) { score -= 20; issues.push('Deal aberto há 90+ dias') }
  if (!deal.comprador) { score -= 15; issues.push('Comprador não identificado') }
  const val = parseFloat(deal.valor.replace(/[^0-9.]/g, '')) || 0
  if (!deal.valor || val === 0) { score -= 20; issues.push('Valor não definido') }
  if (!deal.cpcvDate && STAGE_PCT[deal.fase] >= 70) { score -= 10; issues.push('Data CPCV em falta') }
  if (daysSinceCreated > 30 && deal.fase === 'Angariação') { score -= 15; issues.push('30+ dias sem avançar de Angariação') }

  return { score: Math.max(0, score), issues }
}

function healthColor(score: number): string {
  if (score >= 75) return '#4a9c7a'
  if (score >= 45) return '#c9a96e'
  return '#dc2626'
}

function healthEmoji(score: number): string {
  if (score >= 75) return '🟢'
  if (score >= 45) return '🟡'
  return '🔴'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDealValue(valor: string): number {
  return parseFloat(valor.replace(/[^0-9.]/g, '')) || 0
}

function dealDays(deal: DealWithMeta): number {
  return Math.ceil((Date.now() - new Date(deal.createdAt || Date.now()).getTime()) / 86400000)
}

function nextStage(fase: string): string | null {
  const idx = PIPELINE_STAGES.indexOf(fase)
  if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return null
  return PIPELINE_STAGES[idx + 1]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageBadge({ fase, darkMode }: { fase: string; darkMode: boolean }) {
  const color = STAGE_COLOR[fase] || '#888'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: color + '18',
      border: `1px solid ${color}40`,
      color,
      fontFamily: "'DM Mono',monospace",
      fontSize: '.36rem',
      letterSpacing: '.06em',
      borderRadius: '2px',
    }}>
      {fase}
    </span>
  )
}

function HealthBadge({ score }: { score: number }) {
  return (
    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: healthColor(score) }}>
      {healthEmoji(score)} {score}%
    </span>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: '3px', background: 'rgba(14,14,13,.07)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .3s ease' }} />
    </div>
  )
}

// ─── GCI Forecast Panel ───────────────────────────────────────────────────────

function GCIForecastPanel({ deals, darkMode }: { deals: Deal[]; darkMode: boolean }) {
  const pipelineWeighted = deals.reduce((sum, d) => {
    const val = parseDealValue(d.valor)
    const prob = STAGE_PROB[d.fase] || 0.1
    return sum + val * prob
  }, 0)

  const gciWeighted = pipelineWeighted * COMMISSION_RATE

  const forecast30 = deals
    .filter(d => ['CPCV Assinado', 'Escritura Marcada'].includes(d.fase))
    .reduce((sum, d) => sum + parseDealValue(d.valor) * 0.5 * COMMISSION_RATE, 0)

  const forecast90 = deals
    .filter(d => STAGE_PCT[d.fase] >= 35)
    .reduce((sum, d) => sum + parseDealValue(d.valor) * 0.30 * COMMISSION_RATE, 0)

  const totalPipeline = deals.reduce((sum, d) => sum + parseDealValue(d.valor), 0)

  const fmtK = (v: number) => v >= 1e6
    ? `€${(v / 1e6).toFixed(2)}M`
    : `€${Math.round(v / 1000)}k`

  const stageDist = PIPELINE_STAGES.map(s => {
    const stageVal = deals.filter(d => d.fase === s).reduce((sum, d) => sum + parseDealValue(d.valor), 0)
    return { stage: s, pct: totalPipeline > 0 ? (stageVal / totalPipeline) * 100 : 0, color: STAGE_COLOR[s] || '#888' }
  }).filter(s => s.pct > 0)

  const bg = darkMode ? 'rgba(28,74,53,.12)' : 'rgba(28,74,53,.04)'
  const border = darkMode ? 'rgba(201,169,110,.12)' : 'rgba(28,74,53,.1)'

  return (
    <div style={{ marginBottom: '20px', padding: '16px 20px', background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.15em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '14px' }}>
        GCI Forecast
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Pipeline Ponderado', value: fmtK(pipelineWeighted), sub: 'valor × prob. stage' },
          { label: 'GCI Ponderado (5%)', value: fmtK(gciWeighted), sub: 'comissão esperada', gold: true },
          { label: 'Forecast 30 dias', value: fmtK(forecast30), sub: 'CPCV + Escritura' },
          { label: 'Forecast 90 dias', value: fmtK(forecast90), sub: 'Proposta Aceite+' },
        ].map(m => (
          <div key={m.label} style={{ padding: '12px 14px', background: darkMode ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.6)', border: `1px solid ${border}` }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.35rem', color: m.gold ? '#c9a96e' : (darkMode ? '#f4f0e6' : '#0e0e0d'), fontWeight: 300 }}>{m.value}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: 'rgba(14,14,13,.3)', marginTop: '2px' }}>{m.sub}</div>
          </div>
        ))}
      </div>
      {stageDist.length > 0 && (
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.35)', marginBottom: '6px', letterSpacing: '.06em' }}>DISTRIBUIÇÃO POR STAGE</div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '1px' }}>
            {stageDist.map(s => (
              <div key={s.stage} title={`${s.stage}: ${s.pct.toFixed(0)}%`} style={{ flex: s.pct, background: s.color, minWidth: '2px' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '6px' }}>
            {stageDist.map(s => (
              <span key={s.stage} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                {s.stage} {s.pct.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  isActive,
  darkMode,
  onClick,
  onAdvance,
  compact = false,
}: {
  deal: DealWithMeta
  isActive: boolean
  darkMode: boolean
  onClick: () => void
  onAdvance?: () => void
  compact?: boolean
}) {
  const pct = STAGE_PCT[deal.fase] || 10
  const color = STAGE_COLOR[deal.fase] || '#888'
  const days = dealDays(deal)
  const isStale = days > 30
  const { score } = dealHealthScore(deal)
  const ns = nextStage(deal.fase)

  return (
    <div
      className={`deal-card${isActive ? ' active' : ''}`}
      onClick={onClick}
      style={{ marginBottom: compact ? '0' : '8px', cursor: 'pointer', position: 'relative' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.32)', letterSpacing: '.06em' }}>{deal.ref}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {isStale && (
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.32rem', color: '#dc2626', background: '#dc262612', padding: '1px 5px', border: '1px solid #dc262630', borderRadius: '2px' }}>
              Parado
            </span>
          )}
          <HealthBadge score={score} />
        </div>
      </div>

      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d', marginBottom: '3px', lineHeight: 1.3 }}>
        {deal.imovel}
      </div>

      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.05rem', color: '#c9a96e', fontWeight: 300, marginBottom: '4px' }}>
        {deal.valor}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
        <StageBadge fase={deal.fase} darkMode={darkMode} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: isStale ? '#dc2626' : 'rgba(14,14,13,.3)' }}>
          {days}d
        </span>
      </div>

      {deal.comprador && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.38)', marginTop: '4px' }}>
          👤 {deal.comprador}
        </div>
      )}

      <ProgressBar pct={pct} color={color} />

      {onAdvance && ns && (
        <button
          onClick={e => { e.stopPropagation(); onAdvance() }}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '5px 0',
            background: 'transparent',
            border: `1px solid ${color}50`,
            color,
            fontFamily: "'DM Mono',monospace",
            fontSize: '.36rem',
            cursor: 'pointer',
            letterSpacing: '.06em',
          }}
        >
          → {ns}
        </button>
      )}
    </div>
  )
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({
  deals,
  activeDeal,
  darkMode,
  onSelectDeal,
  onChangeFase,
}: {
  deals: Deal[]
  activeDeal: number | null
  darkMode: boolean
  onSelectDeal: (id: number | null) => void
  onChangeFase: (dealId: number, fase: string) => void
}) {
  const headerBg = (stage: string) => {
    if (['Angariação', 'Proposta Enviada'].includes(stage)) return '#1c4a35'
    if (['Proposta Aceite', 'Due Diligence'].includes(stage)) return '#4a9c7a'
    if (['CPCV Assinado'].includes(stage)) return '#c9a96e'
    return '#1c4a35'
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', minWidth: `${KANBAN_STAGES.length * 220}px` }}>
        {KANBAN_STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.fase === stage)
          const stageTotal = stageDeals.reduce((sum, d) => sum + parseDealValue(d.valor), 0)
          const fmtTotal = stageTotal >= 1e6
            ? `€${(stageTotal / 1e6).toFixed(1)}M`
            : stageTotal > 0 ? `€${Math.round(stageTotal / 1000)}k` : '—'

          return (
            <div key={stage} style={{ width: '210px', flexShrink: 0 }}>
              {/* Column header */}
              <div style={{
                background: headerBg(stage),
                padding: '10px 12px',
                marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(244,240,230,.7)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {stage}
                  </div>
                  <span style={{
                    background: 'rgba(244,240,230,.15)',
                    color: '#f4f0e6',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.34rem',
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '.95rem', color: '#f4f0e6', fontWeight: 300, opacity: .9 }}>
                  {fmtTotal}
                </div>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {stageDeals.length === 0 && (
                  <div style={{
                    padding: '16px 12px',
                    border: `1px dashed rgba(14,14,13,.12)`,
                    textAlign: 'center',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.36rem',
                    color: 'rgba(14,14,13,.2)',
                  }}>
                    Sem deals
                  </div>
                )}
                {stageDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal as DealWithMeta}
                    isActive={activeDeal === deal.id}
                    darkMode={darkMode}
                    compact
                    onClick={() => onSelectDeal(activeDeal === deal.id ? null : deal.id)}
                    onAdvance={() => {
                      const ns = nextStage(deal.fase)
                      if (ns) onChangeFase(deal.id, ns)
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: number
  date: string
  tipo: string
  nota: string
}

function TimelineTab({ deal, darkMode }: { deal: DealWithMeta; darkMode: boolean }) {
  const [events, setEvents] = useState<TimelineEvent[]>(() => {
    const base: TimelineEvent[] = []
    if (deal.createdAt) {
      base.push({ id: 1, date: deal.createdAt.slice(0, 10), tipo: 'Criado', nota: 'Deal criado no pipeline' })
    }
    if (deal.cpcvDate) {
      base.push({ id: 2, date: deal.cpcvDate, tipo: 'CPCV', nota: 'Data CPCV registada' })
    }
    if (deal.escrituraDate) {
      base.push({ id: 3, date: deal.escrituraDate, tipo: 'Escritura', nota: 'Data escritura registada' })
    }
    base.push({ id: 4, date: new Date().toISOString().slice(0, 10), tipo: 'Fase', nota: `Fase actual: ${deal.fase}` })
    return base.sort((a, b) => a.date.localeCompare(b.date))
  })

  const [newNote, setNewNote] = useState('')

  const addNote = () => {
    if (!newNote.trim()) return
    setEvents(prev => [...prev, {
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      tipo: 'Nota',
      nota: newNote.trim(),
    }].sort((a, b) => a.date.localeCompare(b.date)))
    setNewNote('')
  }

  const tipoColor: Record<string, string> = {
    'Criado': '#888',
    'CPCV': '#c9a96e',
    'Escritura': '#1c4a35',
    'Fase': '#4a9c7a',
    'Nota': '#3a7bd5',
  }

  return (
    <div>
      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: '6px', top: 0, bottom: 0, width: '1px', background: 'rgba(14,14,13,.1)' }} />
        {events.map(ev => (
          <div key={ev.id} style={{ position: 'relative', marginBottom: '16px' }}>
            <div style={{
              position: 'absolute',
              left: '-17px',
              top: '3px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: tipoColor[ev.tipo] || '#888',
              border: '2px solid #f4f0e6',
            }} />
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: tipoColor[ev.tipo] || '#888', letterSpacing: '.06em', marginBottom: '2px' }}>
              {ev.tipo} · {ev.date}
            </div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: darkMode ? 'rgba(244,240,230,.8)' : '#0e0e0d', lineHeight: 1.4 }}>
              {ev.nota}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <input
          className="p-inp"
          placeholder="Adicionar nota à timeline..."
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
          style={{ flex: 1 }}
        />
        <button className="p-btn" onClick={addNote}>Adicionar</button>
      </div>
    </div>
  )
}

// ─── Documentos Tab ───────────────────────────────────────────────────────────

function DocumentosTab({ deal, darkMode }: { deal: DealWithMeta; darkMode: boolean }) {
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({})

  const allDocs: { fase: string; doc: string }[] = []
  const currentStageIdx = PIPELINE_STAGES.indexOf(deal.fase)
  const relevantStages = PIPELINE_STAGES.slice(0, currentStageIdx + 1)

  relevantStages.forEach(s => {
    const docs = DOCS_BY_PHASE[s] || []
    docs.forEach(doc => allDocs.push({ fase: s, doc }))
  })

  const toggleStatus = (key: string) => {
    setDocStatus(prev => {
      const cur = prev[key] || 'em_falta'
      const next: DocStatus = cur === 'em_falta' ? 'obtido' : cur === 'obtido' ? 'nao_aplicavel' : 'em_falta'
      return { ...prev, [key]: next }
    })
  }

  const statusIcon: Record<DocStatus, string> = {
    obtido: '✅',
    em_falta: '⬜',
    nao_aplicavel: '➖',
  }

  const statusColor: Record<DocStatus, string> = {
    obtido: '#4a9c7a',
    em_falta: 'rgba(14,14,13,.3)',
    nao_aplicavel: 'rgba(14,14,13,.2)',
  }

  const grouped: Record<string, typeof allDocs> = {}
  allDocs.forEach(d => {
    if (!grouped[d.fase]) grouped[d.fase] = []
    grouped[d.fase].push(d)
  })

  return (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(14,14,13,.3)', marginBottom: '12px', letterSpacing: '.06em' }}>
        Clique para alternar: ⬜ Em falta → ✅ Obtido → ➖ N/A
      </div>
      {Object.entries(grouped).map(([fase, docs]) => (
        <div key={fase} style={{ marginBottom: '14px' }}>
          <div style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.38rem',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: fase === deal.fase ? '#c9a96e' : 'rgba(14,14,13,.3)',
            marginBottom: '6px',
          }}>
            {fase}
          </div>
          {docs.map(({ doc }) => {
            const key = `${fase}::${doc}`
            const status = docStatus[key] || 'em_falta'
            return (
              <div
                key={key}
                onClick={() => toggleStatus(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  background: status === 'obtido' ? 'rgba(74,156,122,.06)' : 'transparent',
                  border: `1px solid ${status === 'obtido' ? 'rgba(74,156,122,.2)' : 'rgba(14,14,13,.07)'}`,
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: '.75rem' }}>{statusIcon[status]}</span>
                <span style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.78rem',
                  color: statusColor[status],
                  textDecoration: status === 'nao_aplicavel' ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {doc}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Deal Detail Panel ────────────────────────────────────────────────────────

function DealDetailPanel({
  deal,
  darkMode,
  onChangeFase,
  onToggleCheck,
  onDealRisk,
  onDealNego,
  dealTab,
  setDealTab,
  dealRiskLoading,
  dealRiskAnalysis,
  dealNegoLoading,
  dealNego,
  investorData,
  setInvestorData,
  invScenario,
  setInvScenario,
  taxRegime,
  setTaxRegime,
  tipoImovelInv,
  setTipoImovelInv,
}: {
  deal: DealWithMeta
  darkMode: boolean
  onChangeFase: (dealId: number, fase: string) => void
  onToggleCheck: (dealId: number, fase: string, idx: number) => void
  onDealRisk: (dealId: number) => Promise<void>
  onDealNego: (dealId: number) => Promise<void>
  dealTab: 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos'
  setDealTab: (t: 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos') => void
  dealRiskLoading: boolean
  dealRiskAnalysis: Record<string, unknown> | null
  dealNegoLoading: boolean
  dealNego: Record<string, unknown> | null
  investorData: { rendaMensal: string; apreciacao: string; horizonte: string; ltv: string; spread: string }
  setInvestorData: (d: Partial<typeof investorData>) => void
  invScenario: 'bear' | 'base' | 'bull'
  setInvScenario: (s: 'bear' | 'base' | 'bull') => void
  taxRegime: 'standard' | 'ifici'
  setTaxRegime: (r: 'standard' | 'ifici') => void
  tipoImovelInv: 'residencial' | 'comercial'
  setTipoImovelInv: (t: 'residencial' | 'comercial') => void
}) {
  const { score, issues } = dealHealthScore(deal)
  const days = dealDays(deal)

  const TABS = [
    { id: 'checklist', label: 'Checklist' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'investor', label: 'Investidor' },
    { id: 'nego', label: 'Negociação' },
  ] as const

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', fontWeight: 300, marginBottom: '4px', lineHeight: 1.2 }}>
          {deal.imovel}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#c9a96e', fontWeight: 300 }}>{deal.valor}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.3)' }}>·</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>{deal.ref}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.3)' }}>·</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.36rem', color: 'rgba(14,14,13,.4)' }}>{days}d no pipeline</span>
        </div>

        {/* Health score */}
        <div style={{
          marginTop: '8px',
          padding: '8px 12px',
          background: `${healthColor(score)}10`,
          border: `1px solid ${healthColor(score)}30`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: healthColor(score), fontWeight: 'bold' }}>
            {healthEmoji(score)} Health Score: {score}%
          </span>
          {issues.map(issue => (
            <span key={issue} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.45)', background: 'rgba(14,14,13,.05)', padding: '1px 6px' }}>
              {issue}
            </span>
          ))}
        </div>
      </div>

      {/* Phase selector */}
      <div style={{ marginBottom: '14px' }}>
        <label className="p-label">Fase do Negócio</label>
        <select className="p-sel" value={deal.fase} onChange={e => onChangeFase(deal.id, e.target.value)}>
          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '16px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`deal-tab${dealTab === t.id ? ' active' : ''}`}
            onClick={() => setDealTab(t.id as typeof dealTab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Checklist */}
      {dealTab === 'checklist' && (
        <div>
          {Object.entries(deal.checklist).map(([fase, items]) => (
            <div key={fase} style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.1em', textTransform: 'uppercase', color: fase === deal.fase ? '#c9a96e' : 'rgba(14,14,13,.3)', marginBottom: '6px' }}>{fase}</div>
              {(CHECKLISTS[fase] || []).map((item: string, idx: number) => (
                <div key={idx} className={`check-item${(items as boolean[])[idx] ? ' done' : ''}`} onClick={() => onToggleCheck(deal.id, fase, idx)}>
                  <div style={{ width: '16px', height: '16px', border: `1.5px solid ${(items as boolean[])[idx] ? '#1c4a35' : 'rgba(14,14,13,.2)'}`, background: (items as boolean[])[idx] ? '#1c4a35' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(items as boolean[])[idx] && <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" width="8" height="8"><path d="M2 6l3 3 5-5" /></svg>}
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Documentos */}
      {dealTab === 'documentos' && <DocumentosTab deal={deal} darkMode={darkMode} />}

      {/* Timeline */}
      {dealTab === 'timeline' && <TimelineTab deal={deal} darkMode={darkMode} />}

      {/* Negociação */}
      {dealTab === 'nego' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button className="p-btn" onClick={() => onDealRisk(deal.id)} disabled={dealRiskLoading}>
              {dealRiskLoading ? '✦ A analisar...' : '🔍 Análise de Risco'}
            </button>
            <button className="p-btn p-btn-gold" onClick={() => onDealNego(deal.id)} disabled={dealNegoLoading}>
              {dealNegoLoading ? '✦ A preparar...' : '⚡ Estratégia Negociação'}
            </button>
          </div>
          {dealRiskAnalysis && (
            <div className="p-card" style={{ marginBottom: '12px' }}>
              <div className="p-label" style={{ marginBottom: '8px' }}>Análise de Risco</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                {String(dealRiskAnalysis.summary || '')}
              </div>
            </div>
          )}
          {dealNego && (
            <div className="p-card">
              <div className="p-label" style={{ marginBottom: '8px' }}>Estratégia de Negociação</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                {String(dealNego.estrategia || '')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Investor */}
      {dealTab === 'investor' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="p-label">Renda Mensal (€)</label>
              <input className="p-inp" type="number" value={investorData.rendaMensal} onChange={e => setInvestorData({ rendaMensal: e.target.value })} placeholder="ex: 3500" />
            </div>
            <div>
              <label className="p-label">Apreciação Anual (%)</label>
              <input className="p-inp" type="number" value={investorData.apreciacao} onChange={e => setInvestorData({ apreciacao: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Horizonte (anos)</label>
              <select className="p-sel" value={investorData.horizonte} onChange={e => setInvestorData({ horizonte: e.target.value })}>
                {['5', '10', '15', '20'].map(h => <option key={h} value={h}>{h} anos</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {(['bear', 'base', 'bull'] as const).map(s => (
              <div key={s} className={`inv-scenario${invScenario === s ? ' best' : ''}`} onClick={() => setInvScenario(s)} style={{ cursor: 'pointer' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: s === 'bull' ? '#4a9c7a' : s === 'bear' ? '#dc2626' : '#c9a96e', textTransform: 'uppercase', letterSpacing: '.08em' }}>{s}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.34rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>{s === 'bull' ? '+4% anual' : s === 'base' ? '+2.5% anual' : '+0.5% anual'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['standard', 'ifici'] as const).map(r => (
              <button key={r} style={{ padding: '6px 14px', background: taxRegime === r ? '#1c4a35' : 'transparent', border: `1px solid ${taxRegime === r ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: taxRegime === r ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }} onClick={() => setTaxRegime(r)}>
                {r === 'standard' ? 'Regime Geral' : 'IFICI/NHR'}
              </button>
            ))}
            {(['residencial', 'comercial'] as const).map(t => (
              <button key={t} style={{ padding: '6px 14px', background: tipoImovelInv === t ? '#c9a96e' : 'transparent', border: `1px solid ${tipoImovelInv === t ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: tipoImovelInv === t ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }} onClick={() => setTipoImovelInv(t)}>
                {t}
              </button>
            ))}
          </div>
          {investorData.rendaMensal && (() => {
            const preco = parseDealValue(deal.valor)
            const renda = parseFloat(investorData.rendaMensal) || 0
            const aprecBase = parseFloat(investorData.apreciacao) || 3
            const aprecMult = invScenario === 'bull' ? 1.4 : invScenario === 'bear' ? 0.3 : 1
            const aprec = aprecBase * aprecMult
            const anos = parseInt(investorData.horizonte) || 10
            const yieldBruto = preco > 0 ? (renda * 12 / preco * 100) : 0
            const taxRate = taxRegime === 'ifici' ? 0.20 : tipoImovelInv === 'residencial' ? 0.28 : 0.25
            const yieldLiquido = yieldBruto * (1 - taxRate)
            const valorFinal = preco * Math.pow(1 + aprec / 100, anos)
            const totalReturn = preco > 0 ? ((valorFinal - preco + renda * 12 * anos) / preco * 100) : 0
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '8px' }}>
                {[
                  { l: 'Yield Bruto', v: `${yieldBruto.toFixed(1)}%` },
                  { l: `Yield Líquido (${taxRegime === 'ifici' ? '20%' : '28%'})`, v: `${yieldLiquido.toFixed(1)}%` },
                  { l: `Valorização Anual (${invScenario})`, v: `+${aprec.toFixed(1)}%` },
                  { l: `Retorno Total ${anos}a`, v: `+${totalReturn.toFixed(0)}%` },
                  { l: 'Valor Final Estimado', v: `€${Math.round(valorFinal).toLocaleString('pt-PT')}` },
                  { l: 'Rendimento Total Acumulado', v: `€${Math.round(renda * 12 * anos).toLocaleString('pt-PT')}` },
                ].map(m => (
                  <div key={m.l} style={{ padding: '12px 14px', background: darkMode ? 'rgba(28,74,53,.15)' : 'rgba(28,74,53,.04)', border: `1px solid ${darkMode ? 'rgba(201,169,110,.1)' : 'rgba(28,74,53,.1)'}` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{m.l}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: '#c9a96e', fontWeight: 300 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── New Deal Form ────────────────────────────────────────────────────────────

interface NewDealFormData {
  imovel: string
  valor: string
  comprador: string
  compradorEmail: string
  compradorTelefone: string
  vendedor: string
  vendedorEmail: string
  zona: string
  tipo: typeof TIPO_OPTIONS[number]
  dataInicioNegociacao: string
  observacoes: string
}

const EMPTY_NEW_DEAL: NewDealFormData = {
  imovel: '',
  valor: '',
  comprador: '',
  compradorEmail: '',
  compradorTelefone: '',
  vendedor: '',
  vendedorEmail: '',
  zona: '',
  tipo: 'Apartamento',
  dataInicioNegociacao: '',
  observacoes: '',
}

function NewDealForm({
  darkMode,
  onAdd,
  onCancel,
}: {
  darkMode: boolean
  onAdd: (data: NewDealFormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<NewDealFormData>(EMPTY_NEW_DEAL)
  const set = (k: keyof NewDealFormData, v: string) => setForm(prev => ({ ...prev, [k]: v }))
  const canSubmit = form.imovel.trim() && form.valor.trim()

  const bg = darkMode ? '#122a1a' : 'rgba(28,74,53,.04)'

  return (
    <div style={{ padding: '18px 20px', background: bg, border: '1px solid rgba(28,74,53,.15)', marginBottom: '18px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '16px' }}>Novo Deal</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label className="p-label">Imóvel *</label>
          <input className="p-inp" placeholder="Nome / Referência do imóvel" value={form.imovel} onChange={e => set('imovel', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Valor *</label>
          <input className="p-inp" placeholder="€ 500.000" value={form.valor} onChange={e => set('valor', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Comprador</label>
          <input className="p-inp" placeholder="Nome do comprador" value={form.comprador} onChange={e => set('comprador', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Email Comprador</label>
          <input className="p-inp" type="email" placeholder="email@exemplo.com" value={form.compradorEmail} onChange={e => set('compradorEmail', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Telefone Comprador</label>
          <input className="p-inp" placeholder="+351 9XX XXX XXX" value={form.compradorTelefone} onChange={e => set('compradorTelefone', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Vendedor</label>
          <input className="p-inp" placeholder="Nome do vendedor" value={form.vendedor} onChange={e => set('vendedor', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Email Vendedor</label>
          <input className="p-inp" type="email" placeholder="email@exemplo.com" value={form.vendedorEmail} onChange={e => set('vendedorEmail', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Zona</label>
          <input className="p-inp" placeholder="Lisboa, Cascais, Algarve..." value={form.zona} onChange={e => set('zona', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Tipo de Imóvel</label>
          <select className="p-sel" value={form.tipo} onChange={e => set('tipo', e.target.value as NewDealFormData['tipo'])}>
            {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="p-label">Data Início Negociação</label>
          <input className="p-inp" type="date" value={form.dataInicioNegociacao} onChange={e => set('dataInicioNegociacao', e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label className="p-label">Observações</label>
        <textarea
          className="p-inp"
          rows={3}
          placeholder="Notas adicionais sobre o deal..."
          value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)}
          style={{ resize: 'vertical', minHeight: '64px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="p-btn" onClick={() => { if (canSubmit) onAdd(form) }} disabled={!canSubmit}>
          Adicionar Deal
        </button>
        <button style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.44rem', cursor: 'pointer' }} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Export Pipeline PDF ──────────────────────────────────────────────────────

function buildPipelineHTML(deals: Deal[]): string {
  const totalVal = deals.reduce((s, d) => s + parseDealValue(d.valor), 0)
  const gci = totalVal * COMMISSION_RATE
  const rows = deals.map(d => `
    <tr>
      <td>${d.ref}</td>
      <td>${d.imovel}</td>
      <td>${d.valor}</td>
      <td>${d.comprador || '—'}</td>
      <td>${d.fase}</td>
      <td>${STAGE_PCT[d.fase] || 0}%</td>
    </tr>`).join('')

  return `
    <h2 style="font-family:Georgia,serif;color:#1c4a35;">Pipeline CPCV — Agency Group</h2>
    <p style="font-family:monospace;font-size:12px;color:#888;">Gerado em ${new Date().toLocaleDateString('pt-PT')}</p>
    <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
      <thead>
        <tr style="background:#1c4a35;color:#fff;">
          <th style="padding:8px;text-align:left;">Ref</th>
          <th style="padding:8px;text-align:left;">Imóvel</th>
          <th style="padding:8px;text-align:left;">Valor</th>
          <th style="padding:8px;text-align:left;">Comprador</th>
          <th style="padding:8px;text-align:left;">Fase</th>
          <th style="padding:8px;text-align:left;">Progress</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;font-family:monospace;font-size:13px;">
      <strong>Total Pipeline:</strong> €${totalVal.toLocaleString('pt-PT')}<br/>
      <strong>GCI Previsto (5%):</strong> €${Math.round(gci).toLocaleString('pt-PT')}<br/>
      <strong>Total Deals:</strong> ${deals.length}
    </div>`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalPipeline({
  onToggleCheck,
  onChangeFase,
  onAddDeal,
  onDealRisk,
  onDealNego,
  exportToPDF,
}: PortalPipelineProps) {
  const { darkMode } = useUIStore()
  const {
    deals,
    activeDeal, setActiveDeal,
    showNewDeal, setShowNewDeal,
    newDeal, setNewDeal,
    pipelineView, setPipelineView,
    pipelineSearch, setPipelineSearch,
    dealTab, setDealTab,
    dealRiskLoading, dealRiskAnalysis,
    dealNegoLoading, dealNego,
    investorData, setInvestorData,
    invScenario, setInvScenario,
    taxRegime, setTaxRegime,
    tipoImovelInv, setTipoImovelInv,
  } = useDealStore()

  // Extended tab type (adds 'documentos')
  const [extDealTab, setExtDealTab] = useState<'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos'>('checklist')

  const [showNewDealForm, setShowNewDealForm] = useState(false)
  const [newDealForm, setNewDealForm] = useState<NewDealFormData>(EMPTY_NEW_DEAL)

  const pipelineTotal = useMemo(() =>
    deals.reduce((s, d) => s + parseDealValue(d.valor), 0),
    [deals]
  )

  const activeDealObj = useMemo(() =>
    deals.find(d => d.id === activeDeal) as DealWithMeta | undefined || null,
    [deals, activeDeal]
  )

  const filteredDeals = useMemo(() =>
    deals.filter(d =>
      !pipelineSearch ||
      d.imovel.toLowerCase().includes(pipelineSearch.toLowerCase()) ||
      d.comprador.toLowerCase().includes(pipelineSearch.toLowerCase()) ||
      d.ref.toLowerCase().includes(pipelineSearch.toLowerCase())
    ),
    [deals, pipelineSearch]
  )

  function handleAddDealFromForm(data: NewDealFormData) {
    // Update the store's newDeal and call onAddDeal
    setNewDeal({ imovel: data.imovel, valor: data.valor })
    // The parent handler reads from newDeal store, so we trigger it after state update
    setTimeout(() => {
      onAddDeal()
      setShowNewDealForm(false)
      setNewDealForm(EMPTY_NEW_DEAL)
    }, 0)
  }

  const fmtM = (v: number) => v >= 1e6 ? `€${(v / 1e6).toFixed(1)}M` : `€${Math.round(v / 1000)}k`

  // Sync extDealTab with store dealTab (for nego/investor/checklist/dealroom/timeline)
  function handleSetDealTab(t: 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos') {
    setExtDealTab(t)
    if (t !== 'documentos') {
      setDealTab(t as 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego')
    }
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.46rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '4px' }}>
            Gestão de Negócios
          </div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>
            Pipeline CPCV · <span style={{ color: '#c9a96e' }}>{fmtM(pipelineTotal)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(14,14,13,.1)' }}>
            {(['lista', 'kanban'] as const).map(v => (
              <button key={v}
                style={{ padding: '6px 14px', background: pipelineView === v ? '#1c4a35' : 'transparent', color: pipelineView === v ? '#f4f0e6' : 'rgba(14,14,13,.45)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', border: 'none', cursor: 'pointer', letterSpacing: '.08em' }}
                onClick={() => setPipelineView(v)}>
                {v === 'lista' ? '☰ Lista' : '⠿ Kanban'}
              </button>
            ))}
          </div>
          {/* Export PDF */}
          <button
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer', color: 'rgba(14,14,13,.55)', letterSpacing: '.06em' }}
            onClick={() => exportToPDF('Pipeline CPCV — Agency Group', buildPipelineHTML(deals))}
          >
            ⬇ Exportar PDF
          </button>
          {/* New Deal */}
          <button className="p-btn p-btn-gold" style={{ padding: '6px 14px' }} onClick={() => setShowNewDealForm(true)}>
            + Novo Deal
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <input
        className="p-inp"
        style={{ marginBottom: '16px' }}
        placeholder="Pesquisar deals por nome, comprador ou referência..."
        value={pipelineSearch}
        onChange={e => setPipelineSearch(e.target.value)}
      />

      {/* ── GCI Forecast Panel ── */}
      <GCIForecastPanel deals={filteredDeals} darkMode={darkMode} />

      {/* ── New Deal Form ── */}
      {showNewDealForm && (
        <NewDealForm
          darkMode={darkMode}
          onAdd={handleAddDealFromForm}
          onCancel={() => { setShowNewDealForm(false); setNewDealForm(EMPTY_NEW_DEAL) }}
        />
      )}

      {/* ── Kanban View ── */}
      {pipelineView === 'kanban' && (
        <div>
          <KanbanView
            deals={filteredDeals}
            activeDeal={activeDeal}
            darkMode={darkMode}
            onSelectDeal={setActiveDeal}
            onChangeFase={onChangeFase}
          />
          {/* Deal detail panel below kanban when a deal is selected */}
          {activeDealObj && (
            <div style={{
              marginTop: '20px',
              padding: '20px',
              background: darkMode ? '#122a1a' : 'rgba(255,255,255,.6)',
              border: '1px solid rgba(28,74,53,.15)',
            }}>
              <DealDetailPanel
                deal={activeDealObj}
                darkMode={darkMode}
                onChangeFase={onChangeFase}
                onToggleCheck={onToggleCheck}
                onDealRisk={onDealRisk}
                onDealNego={onDealNego}
                dealTab={extDealTab}
                setDealTab={handleSetDealTab}
                dealRiskLoading={dealRiskLoading}
                dealRiskAnalysis={dealRiskAnalysis}
                dealNegoLoading={dealNegoLoading}
                dealNego={dealNego}
                investorData={investorData}
                setInvestorData={setInvestorData}
                invScenario={invScenario}
                setInvScenario={setInvScenario}
                taxRegime={taxRegime}
                setTaxRegime={setTaxRegime}
                tipoImovelInv={tipoImovelInv}
                setTipoImovelInv={setTipoImovelInv}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Lista View ── */}
      {pipelineView === 'lista' && (
        <div style={{ display: 'flex', gap: '20px', minHeight: 0 }}>
          {/* Deal List */}
          <div style={{ width: '280px', flexShrink: 0 }}>
            {filteredDeals.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.25)', border: '1px dashed rgba(14,14,13,.1)' }}>
                Sem deals encontrados
              </div>
            )}
            {filteredDeals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal as DealWithMeta}
                isActive={activeDeal === deal.id}
                darkMode={darkMode}
                onClick={() => setActiveDeal(activeDeal === deal.id ? null : deal.id)}
                onAdvance={() => {
                  const ns = nextStage(deal.fase)
                  if (ns) onChangeFase(deal.id, ns)
                }}
              />
            ))}
          </div>

          {/* Deal Detail */}
          {activeDealObj && (
            <DealDetailPanel
              deal={activeDealObj}
              darkMode={darkMode}
              onChangeFase={onChangeFase}
              onToggleCheck={onToggleCheck}
              onDealRisk={onDealRisk}
              onDealNego={onDealNego}
              dealTab={extDealTab}
              setDealTab={handleSetDealTab}
              dealRiskLoading={dealRiskLoading}
              dealRiskAnalysis={dealRiskAnalysis}
              dealNegoLoading={dealNegoLoading}
              dealNego={dealNego}
              investorData={investorData}
              setInvestorData={setInvestorData}
              invScenario={invScenario}
              setInvScenario={setInvScenario}
              taxRegime={taxRegime}
              setTaxRegime={setTaxRegime}
              tipoImovelInv={tipoImovelInv}
              setTipoImovelInv={setTipoImovelInv}
            />
          )}

          {!activeDeal && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'rgba(14,14,13,.2)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem' }}>
                Selecione um deal para ver os detalhes
              </div>
              <div style={{ color: 'rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.38rem' }}>
                {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''} no pipeline
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
