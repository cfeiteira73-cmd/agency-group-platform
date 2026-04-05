'use client'
import { useState, useCallback } from 'react'
import { PORTAL_PROPERTIES } from './constants'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import { exportToPDF } from './utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftResult {
  subject: string
  body: string
  keyTerms: { label: string; value: string }[]
  urgencyLevel: 'alta' | 'media' | 'baixa'
  negotiationAdvice: string
  redFlags: string[]
  strengths: string[]
  offerSummary: string
}

interface OfferHistory {
  id: string
  date: string
  propertyRef: string
  propertyName: string
  buyerName: string
  offerPrice: number
  listPrice: number
  offerType: string
  lang: string
  status: 'pendente' | 'enviada' | 'aceite' | 'recusada'
  draft: DraftResult
}

interface OfferConditions {
  financiamento: boolean
  inspecao: boolean
  prazoCondicao: string
  valorSinal: string
  dataCPCV: string
  dataEscritura: string
  includeMobilia: boolean
  includeVagaGaragem: boolean
}

// ─── Offer Type Config ────────────────────────────────────────────────────────

const OFFER_TYPES = [
  { id: 'compra',   label: 'Proposta Compra',  emoji: '📋', short: 'Compra' },
  { id: 'contra',   label: 'Contra-Proposta',  emoji: '↔️', short: 'Contra' },
  { id: 'loi',      label: 'LOI',              emoji: '📄', short: 'LOI' },
  { id: 'cpcv',     label: 'CPCV',             emoji: '✍️', short: 'CPCV' },
  { id: 'offmarket',label: 'Off-Market',       emoji: '🤫', short: 'Off-Mkt' },
] as const

type OfferTypeId = typeof OFFER_TYPES[number]['id']

const LANGUAGES = ['PT', 'EN', 'FR', 'DE', 'AR'] as const
type LangId = typeof LANGUAGES[number]

const OFFER_TEMPLATES = [
  {
    id: 'agressiva',
    name: 'Oferta Agressiva',
    desc: '15% abaixo da listagem. Sinal 10%. Condições financiamento.',
    discount: 15,
    successRate: 38,
    offerType: 'compra' as OfferTypeId,
    color: '#e05454',
  },
  {
    id: 'mercado',
    name: 'Oferta a Mercado',
    desc: 'Preço de listagem. Condições normais. Alta probabilidade de aceitação.',
    discount: 0,
    successRate: 78,
    offerType: 'compra' as OfferTypeId,
    color: '#1c4a35',
  },
  {
    id: 'premium',
    name: 'Proposta Premium',
    desc: 'Acima do preço de listagem. Sem condições suspensivas. Prazo rápido.',
    discount: -3,
    successRate: 92,
    offerType: 'compra' as OfferTypeId,
    color: '#c9a96e',
  },
  {
    id: 'offmarket_touch',
    name: 'Off-Market First Touch',
    desc: 'Primeira abordagem informal. Tom discreto. Sinal de interesse.',
    discount: 10,
    successRate: 55,
    offerType: 'offmarket' as OfferTypeId,
    color: '#3a7bd5',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEuro(v: number): string {
  if (!v || isNaN(v)) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

function calcDiscount(list: number, offer: number): number {
  if (!list || !offer) return 0
  return ((list - offer) / list) * 100
}

function discountColor(pct: number): string {
  if (pct <= 0) return '#1c4a35'
  if (pct <= 5) return '#1c4a35'
  if (pct <= 10) return '#c9a96e'
  if (pct <= 15) return '#d97706'
  return '#e05454'
}

function acceptanceProbability(discountPct: number): number {
  if (discountPct <= 0) return 92
  if (discountPct <= 3) return 85
  if (discountPct <= 5) return 74
  if (discountPct <= 8) return 60
  if (discountPct <= 12) return 44
  if (discountPct <= 15) return 30
  if (discountPct <= 20) return 18
  return 8
}

function probColor(prob: number): string {
  if (prob >= 70) return '#1c4a35'
  if (prob >= 45) return '#c9a96e'
  if (prob >= 25) return '#d97706'
  return '#e05454'
}

function statusBadgeStyle(status: OfferHistory['status']): React.CSSProperties {
  const map: Record<OfferHistory['status'], { bg: string; color: string }> = {
    pendente:  { bg: 'rgba(14,14,13,.08)',       color: 'rgba(14,14,13,.5)' },
    enviada:   { bg: 'rgba(58,123,213,.12)',      color: '#3a7bd5' },
    aceite:    { bg: 'rgba(28,74,53,.12)',        color: '#1c4a35' },
    recusada:  { bg: 'rgba(224,84,84,.12)',       color: '#e05454' },
  }
  const s = map[status]
  return {
    display: 'inline-block',
    padding: '3px 10px',
    background: s.bg,
    color: s.color,
    fontFamily: "'DM Mono',monospace",
    fontSize: '.48rem',
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    borderRadius: '2px',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalDraftOffer() {
  const { crmContacts } = useCRMStore()
  const { deals } = useDealStore()

  // Core form state
  const [offerType, setOfferType] = useState<OfferTypeId>('compra')
  const [lang, setLang] = useState<LangId>('PT')
  const [selectedProperty, setSelectedProperty] = useState('')
  const [selectedContact, setSelectedContact] = useState<number | null>(null)
  const [offerPrice, setOfferPrice] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [conditions, setConditions] = useState<OfferConditions>({
    financiamento: true,
    inspecao: false,
    prazoCondicao: '30',
    valorSinal: '10',
    dataCPCV: '',
    dataEscritura: '',
    includeMobilia: false,
    includeVagaGaragem: true,
  })

  // UI state
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [selectedTab, setSelectedTab] = useState<'draft' | 'history' | 'templates'>('draft')
  const [copySuccess, setCopySuccess] = useState(false)
  const [history, setHistory] = useState<OfferHistory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)

  // Derived values
  const listNum = parseFloat(listPrice.replace(/[^\d.]/g, '')) || 0
  const offerNum = parseFloat(offerPrice.replace(/[^\d.]/g, '')) || 0
  const discountPct = calcDiscount(listNum, offerNum)
  const sinalNum = listNum > 0
    ? offerNum * (parseFloat(conditions.valorSinal) / 100)
    : 0
  const acceptanceProb = acceptanceProbability(discountPct)

  const selectedPropertyObj = PORTAL_PROPERTIES.find(p => p.id === selectedProperty)
  const selectedContactObj = crmContacts.find(c => c.id === selectedContact)

  // Auto-fill list price from property
  const handlePropertyChange = useCallback((id: string) => {
    setSelectedProperty(id)
    const prop = PORTAL_PROPERTIES.find(p => p.id === id)
    if (prop) setListPrice(String(prop.preco))
  }, [])

  // Template apply
  const applyTemplate = useCallback((tpl: typeof OFFER_TEMPLATES[number]) => {
    setOfferType(tpl.offerType)
    if (listNum > 0) {
      const newOffer = Math.round(listNum * (1 - tpl.discount / 100))
      setOfferPrice(String(newOffer))
    }
    setSelectedTab('draft')
  }, [listNum])

  // Reload history draft
  const reloadHistoryDraft = useCallback((entry: OfferHistory) => {
    setSelectedProperty(entry.propertyRef)
    const prop = PORTAL_PROPERTIES.find(p => p.id === entry.propertyRef)
    if (prop) setListPrice(String(prop.preco))
    setOfferPrice(String(entry.offerPrice))
    setDraft(entry.draft)
    setSelectedTab('draft')
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    } catch {
      setCopySuccess(false)
    }
  }, [draft])

  // Email vendor
  const handleEmailVendedor = useCallback(() => {
    if (!draft) return
    const subject = encodeURIComponent(draft.subject)
    const body = encodeURIComponent(draft.body)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }, [draft])

  // PDF export
  const handlePDF = useCallback(() => {
    if (!draft || !selectedPropertyObj) return
    const html = `
      <div class="label">Proposta</div>
      <div class="metric">${draft.subject}</div>
      <hr class="divider"/>
      <div style="white-space:pre-wrap;font-size:.85rem;line-height:1.8;font-family:var(--font-jost),sans-serif;margin-top:16px">${draft.body}</div>
      <hr class="divider"/>
      <table>
        <thead><tr>${draft.keyTerms.map(t => `<th>${t.label}</th>`).join('')}</tr></thead>
        <tbody><tr>${draft.keyTerms.map(t => `<td>${t.value}</td>`).join('')}</tr></tbody>
      </table>
      ${draft.negotiationAdvice ? `<div style="margin-top:20px;padding:14px 18px;background:rgba(201,169,110,.1);border-left:3px solid #c9a96e;font-size:.8rem;line-height:1.7"><strong>Conselho de Negociação</strong><br/>${draft.negotiationAdvice}</div>` : ''}
    `
    exportToPDF(draft.subject, html)
  }, [draft, selectedPropertyObj])

  // AI generate
  const handleGenerate = useCallback(async () => {
    if (!selectedPropertyObj) { setError('Seleccione um imóvel primeiro.'); return }
    setError(null)
    setGenerating(true)
    setDraft(null)

    try {
      const res = await fetch('/api/draft-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: offerType,
          lang,
          property: {
            nome: selectedPropertyObj.nome,
            preco: selectedPropertyObj.preco,
            ref: selectedPropertyObj.ref,
            zona: selectedPropertyObj.zona,
            area: selectedPropertyObj.area,
            quartos: selectedPropertyObj.quartos,
          },
          contact: selectedContactObj
            ? { name: selectedContactObj.name, nationality: selectedContactObj.nationality }
            : null,
          offerPrice: offerNum,
          listPrice: listNum,
          discountPct: parseFloat(discountPct.toFixed(2)),
          conditions,
          agentName: 'Carlos',
          amiNumber: '22506',
        }),
      })

      if (!res.ok) throw new Error(`Erro API: ${res.status}`)
      const data = await res.json() as DraftResult

      setDraft(data)

      // Save to history
      const entry: OfferHistory = {
        id: `of_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        propertyRef: selectedPropertyObj.ref,
        propertyName: selectedPropertyObj.nome,
        buyerName: selectedContactObj?.name ?? 'Comprador',
        offerPrice: offerNum,
        listPrice: listNum,
        offerType,
        lang,
        status: 'pendente',
        draft: data,
      }
      setHistory(prev => [entry, ...prev.slice(0, 19)])

      // Confetti hint
      setConfetti(true)
      setTimeout(() => setConfetti(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }, [
    offerType, lang, selectedPropertyObj, selectedContactObj,
    offerNum, listNum, discountPct, conditions,
  ])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      fontFamily: "'Jost',sans-serif",
      color: '#0e0e0d',
      background: '#f4f0e6',
      minHeight: '100vh',
      padding: '28px 24px',
    }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            letterSpacing: '.22em',
            textTransform: 'uppercase',
            color: '#c9a96e',
            marginBottom: '6px',
          }}>
            Agency Group · AMI 22506
          </div>
          <h1 style={{
            fontFamily: "'Cormorant',serif",
            fontSize: '2.1rem',
            fontWeight: 300,
            color: '#0e0e0d',
            lineHeight: 1.1,
          }}>
            Redigir <em style={{ fontStyle: 'italic', color: '#1c4a35' }}>Proposta IA</em>
          </h1>
          <p style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            letterSpacing: '.1em',
            color: 'rgba(14,14,13,.4)',
            marginTop: '6px',
          }}>
            Claude · 5 línguas · CPCV · LOI · Off-Market
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['draft', 'templates', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              style={{
                padding: '8px 18px',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                border: '1px solid',
                borderColor: selectedTab === tab ? '#1c4a35' : 'rgba(14,14,13,.12)',
                background: selectedTab === tab ? '#1c4a35' : 'transparent',
                color: selectedTab === tab ? '#f4f0e6' : 'rgba(14,14,13,.5)',
                cursor: 'pointer',
                transition: 'all .18s',
              }}
            >
              {tab === 'draft' ? '✦ Redigir' : tab === 'templates' ? '⊞ Templates' : `⏱ Histórico (${history.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: DRAFT ── */}
      {selectedTab === 'draft' && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Left Panel ── */}
          <div style={{ width: '400px', minWidth: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Offer type pills */}
            <div className="p-card" style={{ padding: '20px' }}>
              <span className="p-label">Tipo de Proposta</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                {OFFER_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setOfferType(t.id)}
                    style={{
                      padding: '7px 13px',
                      border: '1px solid',
                      borderColor: offerType === t.id ? '#1c4a35' : 'rgba(14,14,13,.12)',
                      background: offerType === t.id ? '#1c4a35' : '#fff',
                      color: offerType === t.id ? '#f4f0e6' : 'rgba(14,14,13,.65)',
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.46rem',
                      letterSpacing: '.1em',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: '2px',
                    }}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.short}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="p-card" style={{ padding: '20px' }}>
              <span className="p-label">Idioma</span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                {LANGUAGES.map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      width: '46px',
                      height: '34px',
                      border: '1px solid',
                      borderColor: lang === l ? '#c9a96e' : 'rgba(14,14,13,.12)',
                      background: lang === l ? '#c9a96e' : '#fff',
                      color: lang === l ? '#0c1f15' : 'rgba(14,14,13,.5)',
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.5rem',
                      fontWeight: lang === l ? 700 : 400,
                      letterSpacing: '.1em',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      borderRadius: '2px',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Property + Contact */}
            <div className="p-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="p-label">Imóvel</label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="p-sel"
                    value={selectedProperty}
                    onChange={e => handlePropertyChange(e.target.value)}
                    style={{ paddingRight: '32px' }}
                  >
                    <option value="">— Seleccionar imóvel —</option>
                    {PORTAL_PROPERTIES.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.ref} · {p.nome} · {fmtEuro(p.preco)}
                      </option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(14,14,13,.35)', fontSize: '.8rem' }}>▾</span>
                </div>
                {selectedPropertyObj && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    background: 'rgba(28,74,53,.04)',
                    borderLeft: '2px solid #1c4a35',
                    fontSize: '.75rem',
                    color: 'rgba(14,14,13,.6)',
                    lineHeight: 1.6,
                  }}>
                    {selectedPropertyObj.zona} · {selectedPropertyObj.area}m² · {selectedPropertyObj.quartos} quartos
                    {selectedPropertyObj.badge && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 7px',
                        background: 'rgba(201,169,110,.15)',
                        color: '#c9a96e',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.42rem',
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                      }}>{selectedPropertyObj.badge}</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="p-label">Comprador</label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="p-sel"
                    value={selectedContact ?? ''}
                    onChange={e => setSelectedContact(e.target.value ? Number(e.target.value) : null)}
                    style={{ paddingRight: '32px' }}
                  >
                    <option value="">— Seleccionar contacto —</option>
                    {crmContacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.nationality}
                      </option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(14,14,13,.35)', fontSize: '.8rem' }}>▾</span>
                </div>
              </div>
            </div>

            {/* Valores */}
            <div className="p-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span className="p-label" style={{ marginBottom: 0 }}>Valores</span>
                {discountPct !== 0 && listNum > 0 && offerNum > 0 && (
                  <span style={{
                    padding: '3px 10px',
                    background: discountColor(discountPct) + '18',
                    color: discountColor(discountPct),
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.48rem',
                    letterSpacing: '.1em',
                    fontWeight: 700,
                    borderRadius: '2px',
                    border: `1px solid ${discountColor(discountPct)}40`,
                  }}>
                    {discountPct > 0 ? `-${discountPct.toFixed(1)}%` : `+${Math.abs(discountPct).toFixed(1)}%`}
                  </span>
                )}
              </div>

              <div>
                <label className="p-label">Valor de Listagem (€)</label>
                <input
                  className="p-inp"
                  type="text"
                  value={listPrice}
                  onChange={e => setListPrice(e.target.value)}
                  placeholder="Ex: 2850000"
                />
              </div>

              <div>
                <label className="p-label">Valor da Proposta (€)</label>
                <input
                  className="p-inp"
                  type="text"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                  placeholder="Ex: 2650000"
                />
              </div>

              {/* Sinal */}
              <div>
                <label className="p-label">Valor do Sinal (%)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    className="p-inp"
                    type="number"
                    min={1}
                    max={30}
                    value={conditions.valorSinal}
                    onChange={e => setConditions(c => ({ ...c, valorSinal: e.target.value }))}
                    style={{ width: '80px', flex: 'none' }}
                  />
                  <span style={{ fontSize: '.78rem', color: 'rgba(14,14,13,.5)' }}>%</span>
                  {sinalNum > 0 && (
                    <span style={{
                      fontFamily: "'Cormorant',serif",
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#1c4a35',
                    }}>
                      = {fmtEuro(sinalNum)}
                    </span>
                  )}
                </div>
              </div>

              {/* Acceptance probability meter */}
              {listNum > 0 && offerNum > 0 && (
                <div style={{
                  marginTop: '4px',
                  padding: '12px 14px',
                  background: '#fff',
                  border: '1px solid rgba(14,14,13,.08)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)' }}>
                      Prob. Aceitação
                    </span>
                    <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 600, color: probColor(acceptanceProb) }}>
                      {acceptanceProb}%
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(14,14,13,.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${acceptanceProb}%`,
                      background: probColor(acceptanceProb),
                      borderRadius: '2px',
                      transition: 'width .4s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Condições */}
            <div className="p-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span className="p-label">Condições</span>

              {/* Financiamento */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '.8rem', color: 'rgba(14,14,13,.75)' }}>
                <input
                  type="checkbox"
                  checked={conditions.financiamento}
                  onChange={e => setConditions(c => ({ ...c, financiamento: e.target.checked }))}
                  style={{ accentColor: '#1c4a35', width: '15px', height: '15px' }}
                />
                Sujeito a financiamento
                {conditions.financiamento && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em' }}>PRAZO</span>
                    <input
                      type="number"
                      value={conditions.prazoCondicao}
                      onChange={e => setConditions(c => ({ ...c, prazoCondicao: e.target.value }))}
                      style={{
                        width: '48px',
                        border: '1px solid rgba(14,14,13,.12)',
                        background: '#fff',
                        padding: '4px 8px',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.5rem',
                        color: '#0e0e0d',
                        outline: 'none',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)' }}>d</span>
                  </span>
                )}
              </label>

              {/* Inspecção */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '.8rem', color: 'rgba(14,14,13,.75)' }}>
                <input
                  type="checkbox"
                  checked={conditions.inspecao}
                  onChange={e => setConditions(c => ({ ...c, inspecao: e.target.checked }))}
                  style={{ accentColor: '#1c4a35', width: '15px', height: '15px' }}
                />
                Inspecção técnica
              </label>

              {/* Vaga garagem */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '.8rem', color: 'rgba(14,14,13,.75)' }}>
                <input
                  type="checkbox"
                  checked={conditions.includeVagaGaragem}
                  onChange={e => setConditions(c => ({ ...c, includeVagaGaragem: e.target.checked }))}
                  style={{ accentColor: '#1c4a35', width: '15px', height: '15px' }}
                />
                Vaga de garagem incluída
              </label>

              {/* Mobília */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '.8rem', color: 'rgba(14,14,13,.75)' }}>
                <input
                  type="checkbox"
                  checked={conditions.includeMobilia}
                  onChange={e => setConditions(c => ({ ...c, includeMobilia: e.target.checked }))}
                  style={{ accentColor: '#1c4a35', width: '15px', height: '15px' }}
                />
                Mobília incluída
              </label>

              {/* Datas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                <div>
                  <label className="p-label">Data CPCV</label>
                  <input
                    className="p-inp"
                    type="date"
                    value={conditions.dataCPCV}
                    onChange={e => setConditions(c => ({ ...c, dataCPCV: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="p-label">Data Escritura</label>
                  <input
                    className="p-inp"
                    type="date"
                    value={conditions.dataEscritura}
                    onChange={e => setConditions(c => ({ ...c, dataEscritura: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(224,84,84,.08)',
                borderLeft: '3px solid #e05454',
                fontSize: '.78rem',
                color: '#e05454',
                lineHeight: 1.6,
              }}>
                {error}
              </div>
            )}

            {/* Generate button */}
            <button
              className="p-btn"
              onClick={handleGenerate}
              disabled={generating || !selectedProperty}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '.54rem',
                letterSpacing: '.22em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                position: 'relative',
                overflow: 'hidden',
                background: generating ? '#163d2c' : '#1c4a35',
              }}
            >
              {generating ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '.7rem' }}>⟳</span>
                  A GERAR PROPOSTA...
                </>
              ) : (
                <>✦ GERAR PROPOSTA IA</>
              )}
            </button>
          </div>

          {/* ── Right Panel: Output ── */}
          <div style={{ flex: 1, minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Negotiation Context — always shown if we have prices */}
            {listNum > 0 && offerNum > 0 && (
              <div className="p-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)' }}>
                    Análise de Negociação
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(14,14,13,.06)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <AnalysisPill label="Listagem" value={fmtEuro(listNum)} sub="preço vendedor" />
                  <AnalysisPill label="Proposta" value={fmtEuro(offerNum)} sub="valor oferta" />
                  <AnalysisPill
                    label="Spread"
                    value={discountPct === 0 ? '0%' : discountPct > 0 ? `-${discountPct.toFixed(1)}%` : `+${Math.abs(discountPct).toFixed(1)}%`}
                    sub="desconto"
                    valueColor={discountColor(discountPct)}
                  />
                  <AnalysisPill
                    label="Aceitação Est."
                    value={`${acceptanceProb}%`}
                    sub="probabilidade"
                    valueColor={probColor(acceptanceProb)}
                  />
                  {sinalNum > 0 && <AnalysisPill label="Sinal" value={fmtEuro(sinalNum)} sub={`${conditions.valorSinal}%`} />}
                  {selectedPropertyObj && (
                    <AnalysisPill
                      label="DOM"
                      value={`${Math.max(1, Math.floor((Date.now() - new Date(selectedPropertyObj.listingDate).getTime()) / 86400000))}d`}
                      sub="dias no mercado"
                    />
                  )}
                </div>
                {/* Strategy hint */}
                <div style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  background: 'rgba(201,169,110,.07)',
                  borderLeft: '2px solid #c9a96e',
                  fontSize: '.77rem',
                  color: 'rgba(14,14,13,.65)',
                  lineHeight: 1.65,
                  fontStyle: 'italic',
                }}>
                  {discountPct > 15
                    ? 'Desconto superior a 15% — possível recusa. Considere aumentar proposta ou reforçar condições de rapidez.'
                    : discountPct > 8
                    ? 'Desconto moderado. Justifique com condição do imóvel, prazo de decisão ou ausência de condições suspensivas.'
                    : discountPct > 0
                    ? 'Oferta competitiva. Boa probabilidade de contra-proposta favorável. Mantenha flexibilidade.'
                    : discountPct === 0
                    ? 'Oferta a mercado. Máxima probabilidade de aceitação directa.'
                    : 'Oferta acima de listagem. Sinaliza urgência e compromisso — ideal para propriedades com múltiplas propostas.'}
                </div>
              </div>
            )}

            {/* Draft output */}
            {!draft && !generating && (
              <div className="p-card" style={{
                padding: '48px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                minHeight: '280px',
                borderStyle: 'dashed',
              }}>
                <div style={{ fontSize: '2rem', opacity: .25 }}>📋</div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.48rem',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(14,14,13,.25)',
                }}>
                  Configure os parâmetros e clique "Gerar Proposta IA"
                </div>
              </div>
            )}

            {generating && (
              <div className="p-card" style={{
                padding: '48px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                minHeight: '280px',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '2px solid rgba(28,74,53,.1)',
                  borderTop: '2px solid #1c4a35',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.48rem',
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(14,14,13,.35)',
                }}>
                  Claude a redigir proposta em {lang}...
                </div>
              </div>
            )}

            {draft && (
              <>
                {/* Confetti animation hint */}
                {confetti && (
                  <div style={{
                    padding: '10px 16px',
                    background: 'rgba(28,74,53,.08)',
                    borderLeft: '3px solid #1c4a35',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.46rem',
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: '#1c4a35',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    ✓ Proposta gerada e guardada no histórico
                  </div>
                )}

                {/* Subject line */}
                <div className="p-card" style={{ padding: '20px' }}>
                  <span className="p-label">Assunto</span>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    color: '#0e0e0d',
                    lineHeight: 1.3,
                  }}>
                    {draft.subject}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <UrgencyBadge level={draft.urgencyLevel} />
                    <span style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.44rem',
                      letterSpacing: '.1em',
                      color: 'rgba(14,14,13,.35)',
                    }}>
                      {draft.offerSummary}
                    </span>
                  </div>
                </div>

                {/* Letter body */}
                <div className="p-card" style={{ padding: '28px 32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <span className="p-label" style={{ marginBottom: 0 }}>Carta Formal</span>
                    <div style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.42rem',
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(14,14,13,.3)',
                    }}>
                      Agency Group · AMI 22506
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1rem',
                    lineHeight: 1.9,
                    color: '#0e0e0d',
                    maxHeight: '420px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    borderTop: '1px solid rgba(14,14,13,.06)',
                    paddingTop: '18px',
                  }}>
                    {draft.body}
                  </div>
                </div>

                {/* Key Terms table */}
                <div className="p-card" style={{ padding: '20px' }}>
                  <span className="p-label">Termos Principais</span>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                    <thead>
                      <tr>
                        {draft.keyTerms.map(t => (
                          <th key={t.label} style={{
                            padding: '8px 12px',
                            background: 'rgba(14,14,13,.03)',
                            fontFamily: "'DM Mono',monospace",
                            fontSize: '.42rem',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            color: 'rgba(14,14,13,.4)',
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(14,14,13,.08)',
                          }}>
                            {t.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {draft.keyTerms.map(t => (
                          <td key={t.label} style={{
                            padding: '10px 12px',
                            fontSize: '.78rem',
                            color: '#0e0e0d',
                            borderBottom: '1px solid rgba(14,14,13,.04)',
                            fontWeight: 500,
                          }}>
                            {t.value}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Negotiation advice */}
                {draft.negotiationAdvice && (
                  <div style={{
                    padding: '18px 20px',
                    background: 'rgba(201,169,110,.08)',
                    border: '1px solid rgba(201,169,110,.25)',
                    borderLeft: '3px solid #c9a96e',
                  }}>
                    <div style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.44rem',
                      letterSpacing: '.16em',
                      textTransform: 'uppercase',
                      color: '#c9a96e',
                      marginBottom: '8px',
                    }}>
                      ✦ Conselho de Negociação
                    </div>
                    <div style={{ fontSize: '.8rem', lineHeight: 1.7, color: 'rgba(14,14,13,.7)' }}>
                      {draft.negotiationAdvice}
                    </div>
                  </div>
                )}

                {/* Red flags */}
                {draft.redFlags.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {draft.redFlags.map((flag, i) => (
                      <div key={i} style={{
                        padding: '12px 16px',
                        background: 'rgba(224,84,84,.06)',
                        borderLeft: '3px solid #e05454',
                        fontSize: '.78rem',
                        color: 'rgba(14,14,13,.7)',
                        lineHeight: 1.6,
                      }}>
                        <span style={{ color: '#e05454', fontWeight: 700, marginRight: '8px' }}>⚠</span>
                        {flag}
                      </div>
                    ))}
                  </div>
                )}

                {/* Strengths */}
                {draft.strengths.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="p-label">Pontos Fortes da Proposta</span>
                    {draft.strengths.map((s, i) => (
                      <div key={i} style={{
                        padding: '10px 14px',
                        background: 'rgba(28,74,53,.05)',
                        borderLeft: '2px solid #1c4a35',
                        fontSize: '.78rem',
                        color: 'rgba(14,14,13,.7)',
                        lineHeight: 1.6,
                      }}>
                        <span style={{ color: '#1c4a35', fontWeight: 700, marginRight: '8px' }}>✓</span>
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="p-btn"
                    onClick={handleCopy}
                    style={{ flex: 1, minWidth: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {copySuccess ? '✓ COPIADO' : '📋 COPIAR'}
                  </button>
                  <button
                    className="p-btn p-btn-gold"
                    onClick={handlePDF}
                    style={{ flex: 1, minWidth: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    ⬇ PDF
                  </button>
                  <button
                    className="p-btn"
                    onClick={handleEmailVendedor}
                    style={{ flex: 1, minWidth: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#163d2c' }}
                  >
                    ✉ EMAIL AO VENDEDOR
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: TEMPLATES ── */}
      {selectedTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {OFFER_TEMPLATES.map(tpl => (
            <div key={tpl.id} className="p-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: `3px solid ${tpl.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    color: '#0e0e0d',
                    lineHeight: 1.2,
                    marginBottom: '6px',
                  }}>
                    {tpl.name}
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.44rem',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(14,14,13,.35)',
                  }}>
                    {OFFER_TYPES.find(t => t.id === tpl.offerType)?.emoji} {tpl.offerType}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '.78rem', color: 'rgba(14,14,13,.6)', lineHeight: 1.65 }}>
                {tpl.desc}
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.06)', textAlign: 'center' }}>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.4rem',
                    fontWeight: 600,
                    color: tpl.color,
                    lineHeight: 1,
                  }}>
                    {tpl.discount > 0 ? `-${tpl.discount}%` : tpl.discount < 0 ? `+${Math.abs(tpl.discount)}%` : '0%'}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', color: 'rgba(14,14,13,.35)', marginTop: '4px', textTransform: 'uppercase' }}>
                    Desconto
                  </div>
                </div>
                <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.06)', textAlign: 'center' }}>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.4rem',
                    fontWeight: 600,
                    color: probColor(tpl.successRate),
                    lineHeight: 1,
                  }}>
                    {tpl.successRate}%
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.1em', color: 'rgba(14,14,13,.35)', marginTop: '4px', textTransform: 'uppercase' }}>
                    Sucesso Est.
                  </div>
                </div>
              </div>

              <div style={{ height: '4px', background: 'rgba(14,14,13,.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${tpl.successRate}%`,
                  background: tpl.color,
                  borderRadius: '2px',
                }} />
              </div>

              <button
                className="p-btn"
                onClick={() => applyTemplate(tpl)}
                style={{
                  width: '100%',
                  background: tpl.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                ⊞ USAR TEMPLATE
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: HISTORY ── */}
      {selectedTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {history.length === 0 ? (
            <div className="p-card" style={{
              padding: '48px',
              textAlign: 'center',
              borderStyle: 'dashed',
            }}>
              <div style={{ fontSize: '1.8rem', opacity: .2, marginBottom: '12px' }}>⏱</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.25)' }}>
                Nenhuma proposta gerada ainda
              </div>
            </div>
          ) : (
            history.map(entry => (
              <div key={entry.id} className="p-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#0e0e0d',
                    marginBottom: '4px',
                  }}>
                    {entry.propertyName}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'rgba(14,14,13,.5)' }}>
                    {entry.buyerName} · {OFFER_TYPES.find(t => t.id === entry.offerType)?.emoji} {entry.offerType} · {entry.lang}
                  </div>
                </div>

                <div style={{ textAlign: 'right', minWidth: '120px' }}>
                  <div style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#1c4a35',
                  }}>
                    {fmtEuro(entry.offerPrice)}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'rgba(14,14,13,.35)', marginTop: '2px' }}>
                    vs {fmtEuro(entry.listPrice)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', minWidth: '100px' }}>
                  <span style={statusBadgeStyle(entry.status)}>
                    {entry.status}
                  </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.08em' }}>
                    {entry.date}
                  </span>
                </div>

                {/* Status change buttons */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['enviada', 'aceite', 'recusada'] as OfferHistory['status'][]).map(s => (
                    <button
                      key={s}
                      onClick={() => setHistory(prev => prev.map(h => h.id === entry.id ? { ...h, status: s } : h))}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid',
                        borderColor: entry.status === s ? '#1c4a35' : 'rgba(14,14,13,.1)',
                        background: entry.status === s ? '#1c4a35' : 'transparent',
                        color: entry.status === s ? '#f4f0e6' : 'rgba(14,14,13,.45)',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.42rem',
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    className="p-btn p-btn-gold"
                    onClick={() => reloadHistoryDraft(entry)}
                    style={{ padding: '4px 14px', fontSize: '.42rem', letterSpacing: '.1em' }}
                  >
                    VER →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .p-card { background: #fff; border: 1px solid rgba(14,14,13,.08); padding: 24px; }
        .p-btn { background: #1c4a35; color: #f4f0e6; border: none; padding: 12px 24px; font-family: 'DM Mono', monospace; font-size: .55rem; letter-spacing: .2em; text-transform: uppercase; cursor: pointer; transition: background .2s; }
        .p-btn:hover:not(:disabled) { background: #163d2c; }
        .p-btn:disabled { opacity: .5; cursor: not-allowed; }
        .p-btn-gold { background: #c9a96e; color: #0c1f15; }
        .p-btn-gold:hover:not(:disabled) { background: #b8945a; }
        .p-inp { width: 100%; background: #fff; border: 1px solid rgba(14,14,13,.12); padding: 10px 14px; font-family: 'Jost', sans-serif; font-size: .83rem; color: #0e0e0d; outline: none; transition: border .2s; }
        .p-inp:focus { border-color: #1c4a35; }
        .p-sel { width: 100%; background: #fff; border: 1px solid rgba(14,14,13,.12); padding: 10px 14px; font-family: 'Jost', sans-serif; font-size: .83rem; color: #0e0e0d; outline: none; cursor: pointer; appearance: none; }
        .p-label { font-family: 'DM Mono', monospace; font-size: .5rem; letter-spacing: .18em; text-transform: uppercase; color: rgba(14,14,13,.4); margin-bottom: 6px; display: block; }
      `}</style>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnalysisPill({
  label,
  value,
  sub,
  valueColor = '#1c4a35',
}: {
  label: string
  value: string
  sub: string
  valueColor?: string
}) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(14,14,13,.02)',
      border: '1px solid rgba(14,14,13,.07)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{
        fontFamily: "'DM Mono',monospace",
        fontSize: '.42rem',
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'rgba(14,14,13,.35)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'Cormorant',serif",
        fontSize: '1.2rem',
        fontWeight: 600,
        color: valueColor,
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        fontFamily: "'DM Mono',monospace",
        fontSize: '.42rem',
        color: 'rgba(14,14,13,.3)',
        letterSpacing: '.06em',
      }}>
        {sub}
      </span>
    </div>
  )
}

function UrgencyBadge({ level }: { level: 'alta' | 'media' | 'baixa' }) {
  const config = {
    alta:  { bg: 'rgba(224,84,84,.1)',        color: '#e05454', label: 'Urgência Alta' },
    media: { bg: 'rgba(201,169,110,.12)',      color: '#c9a96e', label: 'Urgência Média' },
    baixa: { bg: 'rgba(28,74,53,.08)',         color: '#1c4a35', label: 'Urgência Baixa' },
  }
  const c = config[level]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      background: c.bg,
      color: c.color,
      fontFamily: "'DM Mono',monospace",
      fontSize: '.44rem',
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      borderRadius: '2px',
      fontWeight: 600,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.color, display: 'inline-block' }} />
      {c.label}
    </span>
  )
}
