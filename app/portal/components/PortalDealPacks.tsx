// =============================================================================
// PORTAL DEAL PACKS — Agency Group
// AI-generated investment dossiers: list, view, send, archive
// =============================================================================
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealPack {
  id: string
  title: string
  status: 'draft' | 'ready' | 'sent' | 'viewed' | 'archived'
  opportunity_score: number | null
  investment_thesis: string | null
  market_summary: string | null
  highlights: string[] | null
  financial_projections: {
    purchase_price?: number
    estimated_yield?: number
    estimated_irr?: number
    renovation_estimate?: number
    total_investment?: number
    annual_income?: number
    exit_value_5y?: number
  } | null
  property_id: string | null
  lead_id: string | null
  view_count: number
  generated_at: string | null
  sent_at: string | null
  viewed_at: string | null
  created_by: string | null
  created_at: string
}

interface GenerateForm {
  propertyRef: string
  buyerEmail: string
  dealTitle: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<DealPack['status'], { label: string; color: string; bg: string }> = {
  draft:    { label: 'Rascunho',  color: '#6b7280', bg: 'rgba(107,114,128,.12)' },
  ready:    { label: 'Pronto',    color: '#059669', bg: 'rgba(5,150,105,.12)'   },
  sent:     { label: 'Enviado',   color: '#2563eb', bg: 'rgba(37,99,235,.12)'   },
  viewed:   { label: 'Visto',     color: '#c9a96e', bg: 'rgba(201,169,110,.12)' },
  archived: { label: 'Arquivo',   color: '#9ca3af', bg: 'rgba(156,163,175,.10)' },
}

const fmt = (n: number | undefined | null, suffix = '') =>
  n != null ? `€${n.toLocaleString('pt-PT')}${suffix}` : '—'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalDealPacks() {
  const darkMode = useUIStore(s => s.darkMode)

  // State
  const [packs, setPacks]               = useState<DealPack[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [selected, setSelected]         = useState<DealPack | null>(null)
  const [filter, setFilter]             = useState<DealPack['status'] | 'all'>('all')
  const [showGenerate, setShowGenerate] = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [genError, setGenError]         = useState<string | null>(null)
  const [sendingId, setSendingId]       = useState<string | null>(null)
  const [toast, setToast]               = useState<string | null>(null)
  const [form, setForm]                 = useState<GenerateForm>({
    propertyRef: '',
    buyerEmail: '',
    dealTitle: '',
  })

  // Theme
  const bg       = darkMode ? '#0f1a13' : '#f8f5f0'
  const cardBg   = darkMode ? '#1a2a1e' : '#ffffff'
  const border   = darkMode ? 'rgba(201,169,110,.15)' : 'rgba(14,14,13,.10)'
  const text     = darkMode ? '#f4f0e6' : '#0e0e0d'
  const muted    = darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.45)'
  const gold     = '#c9a96e'
  const green    = '#1c4a35'

  // ── Helpers ──────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function getAgToken() {
    try { return JSON.parse(localStorage.getItem('ag_auth') || '{}').token || '' } catch { return '' }
  }

  // ── Load packs ────────────────────────────────────────────────────────────

  const loadPacks = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = getAgToken()
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/deal-packs${params}`, {
        headers: token ? { 'X-AG-Token': token } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPacks(data.deal_packs ?? [])
    } catch (e) {
      setError('Erro ao carregar Deal Packs. Verifique a ligação.')
      console.error('[PortalDealPacks] load error:', e)
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { loadPacks() }, [loadPacks])

  // ── Generate ──────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!form.propertyRef.trim() || !form.buyerEmail.trim()) {
      setGenError('Referência do imóvel e email do comprador são obrigatórios.')
      return
    }
    setGenerating(true); setGenError(null)
    try {
      const token = getAgToken()
      const res = await fetch('/api/deal-packs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-AG-Token': token } : {}),
        },
        body: JSON.stringify({
          property_ref: form.propertyRef.trim(),
          buyer_email:  form.buyerEmail.trim(),
          title:        form.dealTitle.trim() || `Deal Pack — ${form.propertyRef}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      showToast('Deal Pack gerado com sucesso!')
      setShowGenerate(false)
      setForm({ propertyRef: '', buyerEmail: '', dealTitle: '' })
      await loadPacks()
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Erro ao gerar Deal Pack.')
    } finally { setGenerating(false) }
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  async function handleSend(pack: DealPack) {
    if (!pack.lead_id && !pack.property_id) {
      showToast('Sem destinatário associado a este pack.')
      return
    }
    setSendingId(pack.id)
    try {
      const token = getAgToken()
      const res = await fetch(`/api/deal-packs/${pack.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-AG-Token': token } : {}),
        },
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('Deal Pack marcado como enviado.')
      await loadPacks()
      if (selected?.id === pack.id) {
        setSelected(prev => prev ? { ...prev, status: 'sent', sent_at: new Date().toISOString() } : prev)
      }
    } catch (e) {
      showToast('Erro ao actualizar estado.')
      console.error(e)
    } finally { setSendingId(null) }
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  async function handleArchive(pack: DealPack) {
    const token = getAgToken()
    try {
      const res = await fetch(`/api/deal-packs/${pack.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-AG-Token': token } : {}),
        },
        body: JSON.stringify({ status: 'archived' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('Arquivado.')
      if (selected?.id === pack.id) setSelected(null)
      await loadPacks()
    } catch { showToast('Erro ao arquivar.') }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = filter === 'all' ? packs : packs.filter(p => p.status === filter)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', background: bg, minHeight: '100vh', color: text, fontFamily: 'var(--font-jost, sans-serif)' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: green, color: gold,
          padding: '12px 20px', fontFamily: 'var(--font-dm-mono, monospace)',
          fontSize: '.55rem', letterSpacing: '.1em', textTransform: 'uppercase',
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '1.8rem', fontWeight: 300, margin: 0 }}>
            Deal Packs
          </h1>
          <p style={{ color: muted, fontSize: '.8rem', margin: '4px 0 0', fontFamily: 'var(--font-dm-mono, monospace)' }}>
            Dossiers de investimento gerados por IA · {packs.length} total
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          style={{
            background: green, color: gold,
            border: 'none', padding: '10px 20px', cursor: 'pointer',
            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.55rem',
            letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700,
          }}
        >
          + Gerar Deal Pack
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['all', 'draft', 'ready', 'sent', 'viewed', 'archived'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 14px',
              background: filter === s ? green : 'transparent',
              color: filter === s ? gold : muted,
              border: `1px solid ${filter === s ? green : border}`,
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)',
              fontSize: '.5rem',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              transition: 'all .15s',
            }}
          >
            {s === 'all' ? `Todos (${packs.length})` : `${STATUS_CONFIG[s].label} (${packs.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Main area: list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '360px 1fr' : '1fr', gap: 20 }}>

        {/* List */}
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: muted }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>⟳</div>
              <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.55rem' }}>A carregar...</div>
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', padding: 20, color: '#ef4444', fontSize: '.8rem' }}>
              {error}
              <button onClick={loadPacks} style={{ marginLeft: 12, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 10px', cursor: 'pointer', fontSize: '.7rem' }}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: muted }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
              <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '1.1rem', fontWeight: 300, marginBottom: 8 }}>
                Nenhum Deal Pack {filter !== 'all' ? `com estado "${STATUS_CONFIG[filter as DealPack['status']].label}"` : ''}
              </div>
              <div style={{ fontSize: '.75rem', color: muted }}>
                Clique em "+ Gerar Deal Pack" para criar o primeiro.
              </div>
            </div>
          )}
          {!loading && filtered.map(pack => (
            <PackCard
              key={pack.id}
              pack={pack}
              isSelected={selected?.id === pack.id}
              darkMode={darkMode}
              cardBg={cardBg}
              border={border}
              text={text}
              muted={muted}
              gold={gold}
              green={green}
              sendingId={sendingId}
              onSelect={() => setSelected(prev => prev?.id === pack.id ? null : pack)}
              onSend={handleSend}
              onArchive={handleArchive}
            />
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <DetailPanel
            pack={selected}
            darkMode={darkMode}
            cardBg={cardBg}
            border={border}
            text={text}
            muted={muted}
            gold={gold}
            green={green}
            sendingId={sendingId}
            onClose={() => setSelected(null)}
            onSend={handleSend}
            onArchive={handleArchive}
          />
        )}
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <GenerateModal
          form={form}
          generating={generating}
          genError={genError}
          darkMode={darkMode}
          cardBg={cardBg}
          border={border}
          text={text}
          muted={muted}
          gold={gold}
          green={green}
          onChange={(k, v) => setForm(prev => ({ ...prev, [k]: v }))}
          onGenerate={handleGenerate}
          onClose={() => { setShowGenerate(false); setGenError(null) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PackCard
// ---------------------------------------------------------------------------

function PackCard({
  pack, isSelected, darkMode, cardBg, border, text, muted, gold, green, sendingId,
  onSelect, onSend, onArchive,
}: {
  pack: DealPack
  isSelected: boolean
  darkMode: boolean
  cardBg: string
  border: string
  text: string
  muted: string
  gold: string
  green: string
  sendingId: string | null
  onSelect: () => void
  onSend: (p: DealPack) => void
  onArchive: (p: DealPack) => void
}) {
  const st = STATUS_CONFIG[pack.status]
  const score = pack.opportunity_score ?? 0
  const scoreColor = score >= 75 ? '#059669' : score >= 55 ? '#c9a96e' : '#ef4444'

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? (darkMode ? 'rgba(201,169,110,.08)' : 'rgba(28,74,53,.04)')
          : cardBg,
        border: `1px solid ${isSelected ? gold : border}`,
        padding: '16px 20px',
        marginBottom: 10,
        cursor: 'pointer',
        transition: 'all .15s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, marginRight: 12 }}>
          <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '1rem', fontWeight: 400, color: text, lineHeight: 1.3 }}>
            {pack.title}
          </div>
          <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.45rem', color: muted, letterSpacing: '.08em', marginTop: 3 }}>
            {pack.created_at ? new Date(pack.created_at).toLocaleDateString('pt-PT') : '—'}
            {pack.view_count > 0 && ` · ${pack.view_count} view${pack.view_count !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{
            background: st.bg, color: st.color,
            padding: '2px 8px',
            fontFamily: 'var(--font-dm-mono, monospace)',
            fontSize: '.42rem', letterSpacing: '.08em', textTransform: 'uppercase',
          }}>
            {st.label}
          </span>
          {pack.opportunity_score != null && (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: `2px solid ${scoreColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.5rem',
              color: scoreColor, fontWeight: 700,
            }}>
              {score}
            </div>
          )}
        </div>
      </div>

      {/* Financial highlights */}
      {pack.financial_projections && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {pack.financial_projections.purchase_price && (
            <Kpi label="Preço" value={fmt(pack.financial_projections.purchase_price)} muted={muted} text={text} />
          )}
          {pack.financial_projections.estimated_yield != null && (
            <Kpi label="Yield" value={`${pack.financial_projections.estimated_yield.toFixed(1)}%`} muted={muted} text={text} />
          )}
          {pack.financial_projections.estimated_irr != null && (
            <Kpi label="IRR" value={`${pack.financial_projections.estimated_irr.toFixed(1)}%`} muted={muted} text={text} />
          )}
        </div>
      )}

      {/* Actions */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {(pack.status === 'ready' || pack.status === 'draft') && (
          <button
            onClick={() => onSend(pack)}
            disabled={sendingId === pack.id}
            style={{
              background: green, color: gold, border: 'none',
              padding: '5px 12px', cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.45rem',
              letterSpacing: '.08em', textTransform: 'uppercase',
              opacity: sendingId === pack.id ? .6 : 1,
            }}
          >
            {sendingId === pack.id ? '...' : '✉ Enviar'}
          </button>
        )}
        {pack.status !== 'archived' && (
          <button
            onClick={() => onArchive(pack)}
            style={{
              background: 'transparent', color: muted,
              border: `1px solid ${muted}`,
              padding: '5px 12px', cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.45rem',
              letterSpacing: '.08em', textTransform: 'uppercase',
            }}
          >
            Arquivar
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------

function DetailPanel({
  pack, cardBg, border, text, muted, gold, green, sendingId,
  onClose, onSend, onArchive,
}: {
  pack: DealPack
  darkMode: boolean
  cardBg: string
  border: string
  text: string
  muted: string
  gold: string
  green: string
  sendingId: string | null
  onClose: () => void
  onSend: (p: DealPack) => void
  onArchive: (p: DealPack) => void
}) {
  const st = STATUS_CONFIG[pack.status]
  const fp = pack.financial_projections

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${border}`,
      padding: '24px',
      position: 'sticky',
      top: 20,
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '1.3rem', fontWeight: 300, margin: 0, color: text }}>
            {pack.title}
          </h2>
          <span style={{
            background: st.bg, color: st.color,
            padding: '2px 8px', marginTop: 6, display: 'inline-block',
            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.42rem',
            letterSpacing: '.08em', textTransform: 'uppercase',
          }}>
            {st.label}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '1.2rem' }}>
          ×
        </button>
      </div>

      {/* Score */}
      {pack.opportunity_score != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'rgba(201,169,110,.06)', border: `1px solid rgba(201,169,110,.2)` }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: `3px solid ${gold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.9rem', color: gold, fontWeight: 700,
          }}>
            {pack.opportunity_score}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.42rem', color: muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>Opportunity Score</div>
            <div style={{ fontSize: '.75rem', color: text, marginTop: 2 }}>
              {pack.opportunity_score >= 80 ? 'Excelente oportunidade' : pack.opportunity_score >= 60 ? 'Boa oportunidade' : 'Oportunidade moderada'}
            </div>
          </div>
        </div>
      )}

      {/* Financial projections */}
      {fp && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel label="Projecções Financeiras" muted={muted} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Kpi label="Preço Aquisição"  value={fmt(fp.purchase_price)}              muted={muted} text={text} />
            <Kpi label="Investimento Total" value={fmt(fp.total_investment)}           muted={muted} text={text} />
            <Kpi label="Yield Estimado"   value={fp.estimated_yield != null ? `${fp.estimated_yield.toFixed(1)}%` : '—'} muted={muted} text={text} />
            <Kpi label="IRR Estimado"     value={fp.estimated_irr   != null ? `${fp.estimated_irr.toFixed(1)}%`   : '—'} muted={muted} text={text} />
            <Kpi label="Rend. Anual"      value={fmt(fp.annual_income)}               muted={muted} text={text} />
            <Kpi label="Valor Saída 5 Anos" value={fmt(fp.exit_value_5y)}             muted={muted} text={text} />
          </div>
        </div>
      )}

      {/* Investment thesis */}
      {pack.investment_thesis && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel label="Tese de Investimento" muted={muted} />
          <p style={{ fontSize: '.8rem', lineHeight: 1.7, color: text, margin: 0 }}>
            {pack.investment_thesis}
          </p>
        </div>
      )}

      {/* Market summary */}
      {pack.market_summary && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel label="Contexto de Mercado" muted={muted} />
          <p style={{ fontSize: '.8rem', lineHeight: 1.7, color: text, margin: 0 }}>
            {pack.market_summary}
          </p>
        </div>
      )}

      {/* Highlights */}
      {pack.highlights && pack.highlights.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel label="Pontos-Chave" muted={muted} />
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {pack.highlights.map((h, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: '.78rem', color: text, lineHeight: 1.5 }}>
                <span style={{ color: gold, flexShrink: 0 }}>◆</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta */}
      <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetaItem label="Gerado"  value={pack.generated_at ? new Date(pack.generated_at).toLocaleDateString('pt-PT') : '—'} muted={muted} text={text} />
          <MetaItem label="Enviado" value={pack.sent_at       ? new Date(pack.sent_at).toLocaleDateString('pt-PT')       : '—'} muted={muted} text={text} />
          <MetaItem label="Visto"   value={pack.viewed_at     ? new Date(pack.viewed_at).toLocaleDateString('pt-PT')     : '—'} muted={muted} text={text} />
          <MetaItem label="Views"   value={String(pack.view_count)} muted={muted} text={text} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {(pack.status === 'ready' || pack.status === 'draft') && (
          <button
            onClick={() => onSend(pack)}
            disabled={sendingId === pack.id}
            style={{
              flex: 1, background: green, color: gold, border: 'none',
              padding: '10px 0', cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.5rem',
              letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700,
              opacity: sendingId === pack.id ? .6 : 1,
            }}
          >
            {sendingId === pack.id ? 'A enviar...' : '✉ Marcar como Enviado'}
          </button>
        )}
        {pack.status !== 'archived' && (
          <button
            onClick={() => onArchive(pack)}
            style={{
              background: 'transparent', color: muted,
              border: `1px solid ${muted}`, padding: '10px 16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.5rem',
              letterSpacing: '.08em', textTransform: 'uppercase',
            }}
          >
            Arquivar
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GenerateModal
// ---------------------------------------------------------------------------

function GenerateModal({
  form, generating, genError, cardBg, border, text, muted, gold, green,
  onChange, onGenerate, onClose,
}: {
  form: GenerateForm
  generating: boolean
  genError: string | null
  darkMode: boolean
  cardBg: string
  border: string
  text: string
  muted: string
  gold: string
  green: string
  onChange: (k: keyof GenerateForm, v: string) => void
  onGenerate: () => void
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 32, width: 480, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '1.4rem', fontWeight: 300, margin: 0, color: text }}>
            Gerar Deal Pack IA
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted, fontSize: '1.4rem' }}>×</button>
        </div>

        <p style={{ fontSize: '.8rem', color: muted, marginBottom: 20, lineHeight: 1.6 }}>
          O Claude Haiku irá gerar uma tese de investimento, análise de mercado, projecções financeiras e pontos-chave personalizados.
        </p>

        {[
          { key: 'propertyRef' as const, label: 'Referência do Imóvel *', placeholder: 'ex: AG-2024-0042 ou ID Supabase' },
          { key: 'buyerEmail'  as const, label: 'Email do Comprador / Investidor *', placeholder: 'ex: investor@email.com' },
          { key: 'dealTitle'   as const, label: 'Título do Deal Pack (opcional)', placeholder: 'ex: T2 Príncipe Real · Inv. Premium' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.45rem', color: muted, letterSpacing: '.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              {label}
            </label>
            <input
              value={form[key]}
              onChange={e => onChange(key, e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'transparent', border: `1px solid ${border}`,
                color: text, fontSize: '.8rem',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {genError && (
          <div style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', padding: '10px 14px', color: '#ef4444', fontSize: '.75rem', marginBottom: 16 }}>
            {genError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={onGenerate}
            disabled={generating}
            style={{
              flex: 1, background: green, color: gold, border: 'none',
              padding: '12px 0', cursor: generating ? 'default' : 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.55rem',
              letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700,
              opacity: generating ? .7 : 1,
            }}
          >
            {generating ? '⟳ A gerar...' : '⚡ Gerar com IA'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: muted,
              border: `1px solid ${muted}`, padding: '12px 20px',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.55rem',
              letterSpacing: '.1em', textTransform: 'uppercase',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Kpi({ label, value, muted, text }: { label: string; value: string; muted: string; text: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.42rem', color: muted, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.65rem', color: text, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function SectionLabel({ label, muted }: { label: string; muted: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.42rem', color: muted, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid rgba(201,169,110,.15)` }}>
      {label}
    </div>
  )
}

function MetaItem({ label, value, muted, text }: { label: string; value: string; muted: string; text: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-dm-mono, monospace)', fontSize: '.4rem', color: muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '.72rem', color: text, marginTop: 1 }}>{value}</div>
    </div>
  )
}
