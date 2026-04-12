'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus =
  | 'new' | 'contacted' | 'interested' | 'meeting_scheduled'
  | 'valuation_done' | 'captation_active' | 'not_interested'
  | 'closed_won' | 'closed_lost'

type ScoreStatus = 'pending_score' | 'scored' | 'failed_score'
type Urgency = 'high' | 'medium' | 'low' | 'unknown'

interface OffmarketLead {
  id: string
  nome: string
  tipo_ativo: string | null
  localizacao: string | null
  cidade: string | null
  area_m2: number | null
  price_ask: number | null
  price_estimate: number | null
  score: number | null
  score_status: ScoreStatus
  score_reason: string | null
  contacto: string | null
  owner_type: string | null
  urgency: Urgency
  source: string
  status: LeadStatus
  assigned_to: string | null
  next_followup_at: string | null
  last_contact_at: string | null
  contact_attempts: number
  notes: string | null
  // Pre-close flags (FASE 13)
  preclose_candidate: boolean
  outreach_ready: boolean
  matched_to_buyers: boolean
  institutional_priority: boolean
  matched_buyers_count: number | null
  best_buyer_match_score: number | null
  buyer_match_notes: string | null
  created_at: string
  updated_at: string
}

interface KPISummary {
  total: number
  new_this_week: number
  high_score: number
  pending_score: number
  active: number
  avg_score: number
  preclose_candidates?: number
  outreach_ready?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contactado',
  interested: 'Interesse',
  meeting_scheduled: 'Reunião',
  valuation_done: 'Avaliado',
  captation_active: 'Captação Activa',
  not_interested: 'Sem Interesse',
  closed_won: 'Fechado ✓',
  closed_lost: 'Perdido',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: '#c9a96e',
  contacted: '#4a90d9',
  interested: '#2ecc71',
  meeting_scheduled: '#9b59b6',
  valuation_done: '#1c4a35',
  captation_active: '#27ae60',
  not_interested: '#95a5a6',
  closed_won: '#1abc9c',
  closed_lost: '#e74c3c',
}

const URGENCY_COLORS: Record<Urgency, string> = {
  high: '#e74c3c',
  medium: '#f39c12',
  low: '#27ae60',
  unknown: '#95a5a6',
}

const TIPO_ATIVO_OPTS = ['moradia', 'apartamento', 'quinta', 'herdade', 'terreno', 'comercial', 'prédio', 'outro']
const SOURCE_OPTS = ['manual', 'referral', 'apify_idealista', 'apify_olx', 'apify_imovirtual', 'google_maps', 'linkedin', 'portal']
const CIDADE_OPTS = ['Lisboa', 'Cascais', 'Oeiras', 'Sintra', 'Porto', 'Algarve', 'Comporta', 'Funchal', 'Ponta Delgada', 'Madeira', 'Açores', 'Outra']

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PortalOffmarketLeads() {
  const darkMode = useUIStore(s => s.darkMode)

  const [leads, setLeads] = useState<OffmarketLead[]>([])
  const [kpi, setKpi] = useState<KPISummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCidade, setFilterCidade] = useState<string>('')
  const [filterMinScore, setFilterMinScore] = useState<string>('')

  // Selected lead
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  // New lead form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLead, setNewLead] = useState({
    nome: '', tipo_ativo: '', localizacao: '', cidade: '', area_m2: '',
    price_ask: '', contacto: '', owner_type: 'individual', urgency: 'unknown',
    source: 'manual', notes: '', assigned_to: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const bg = darkMode ? '#0a1510' : '#f4f0e6'
  const cardBg = darkMode ? '#0f1e16' : '#fff'
  const border = darkMode ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'
  const textPrimary = darkMode ? '#f4f0e6' : '#0e0e0d'
  const textMuted = darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.45)'

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterCidade) params.set('cidade', filterCidade)
      if (filterMinScore) params.set('min_score', filterMinScore)

      const [leadsRes, kpiRes] = await Promise.all([
        fetch(`/api/offmarket-leads?${params}`),
        fetch('/api/kpi/offmarket'),
      ])

      if (leadsRes.ok) {
        const d = await leadsRes.json()
        setLeads(d.data ?? [])
      }
      if (kpiRes.ok) {
        const d = await kpiRes.json()
        setKpi(d.offmarket ?? null)
      }
    } catch (e) {
      setError('Erro ao carregar leads. Verifique a ligação.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterCidade, filterMinScore])

  useEffect(() => { loadLeads() }, [loadLeads])

  // ── Create lead ─────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newLead.nome.trim()) { setSaveMsg('Nome é obrigatório'); return }
    setSaving(true)
    setSaveMsg('')
    try {
      const payload: Record<string, unknown> = {
        nome: newLead.nome.trim(),
        tipo_ativo: newLead.tipo_ativo || null,
        localizacao: newLead.localizacao || null,
        cidade: newLead.cidade || null,
        area_m2: newLead.area_m2 ? parseFloat(newLead.area_m2) : null,
        price_ask: newLead.price_ask ? parseFloat(newLead.price_ask) * 1000 : null, // input in K€
        contacto: newLead.contacto || null,
        owner_type: newLead.owner_type,
        urgency: newLead.urgency,
        source: newLead.source,
        notes: newLead.notes || null,
        assigned_to: newLead.assigned_to || null,
        score_status: 'pending_score',
      }
      const res = await fetch('/api/offmarket-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveMsg(err.error || 'Erro ao criar lead')
      } else {
        setSaveMsg('Lead criado com sucesso ✓')
        setShowNewForm(false)
        setNewLead({ nome: '', tipo_ativo: '', localizacao: '', cidade: '', area_m2: '', price_ask: '', contacto: '', owner_type: 'individual', urgency: 'unknown', source: 'manual', notes: '', assigned_to: '' })
        loadLeads()
      }
    } catch {
      setSaveMsg('Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  // ── Patch lead ──────────────────────────────────────────────────────────────

  async function patchLead(id: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/offmarket-leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
      }
    } catch (e) {
      console.error('Patch error', e)
    }
  }

  const selected = leads.find(l => l.id === selectedId) ?? null

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function scoreColor(score: number | null): string {
    if (score === null) return textMuted
    if (score >= 70) return '#27ae60'
    if (score >= 40) return '#f39c12'
    return '#e74c3c'
  }

  function formatPrice(n: number | null): string {
    if (!n) return '—'
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `€${Math.round(n / 1_000)}K`
    return `€${n}`
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', marginBottom: 6 }}>
            Off-Market · Sourcing
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontSize: '1.8rem', fontWeight: 300, color: textPrimary, margin: 0 }}>
            Leads Off-Market
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          style={{ background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '10px 22px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          + Novo Lead
        </button>
      </div>

      {/* ── KPI Strip ── */}
      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
          {([
            ['Total',        String(kpi.total),                           '#c9a96e'],
            ['Esta Semana',  String(kpi.new_this_week),                   '#4a90d9'],
            ['Score ≥ 70',   String(kpi.high_score),                     '#27ae60'],
            ['Por Avaliar',  String(kpi.pending_score),                   '#f39c12'],
            ['Pré-Fecho',    String(kpi.preclose_candidates ?? 0),        '#9b59b6'],
            ['Outreach OK',  String(kpi.outreach_ready ?? 0),             '#1abc9c'],
            ['Score Médio',  String(kpi.avg_score),                       '#c9a96e'],
          ] as [string, string, string][]).map(([label, value, color]) => (
            <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.14em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.5rem', fontWeight: 300, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em' }}>
          <option value="all">Todos os Status</option>
          {(Object.keys(STATUS_LABELS) as LeadStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterCidade} onChange={e => setFilterCidade(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em' }}>
          <option value="">Todas as Zonas</option>
          {CIDADE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em' }}>
          <option value="">Score: Todos</option>
          <option value="70">Score ≥ 70 (Hot)</option>
          <option value="40">Score ≥ 40 (Warm)</option>
          <option value="1">Com score</option>
        </select>
        <button type="button" onClick={loadLeads}
          style={{ padding: '7px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ↻
        </button>
      </div>

      {/* ── Layout: List + Detail ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 400px' : '1fr', gap: 12 }}>

        {/* List */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, overflow: 'hidden' }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>A carregar...</div>}
          {error && <div style={{ padding: '20px', color: '#e74c3c', fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>{error}</div>}
          {!loading && !error && leads.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: textMuted }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', fontWeight: 300, marginBottom: 8 }}>Sem leads para mostrar</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em' }}>Adicione o primeiro lead off-market</div>
            </div>
          )}
          {!loading && leads.map(lead => (
            <div
              key={lead.id}
              onClick={() => { setSelectedId(lead.id === selectedId ? null : lead.id); setEditMode(false) }}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
                alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: `1px solid ${border}`,
                cursor: 'pointer',
                background: lead.id === selectedId ? (darkMode ? 'rgba(201,169,110,.08)' : 'rgba(28,74,53,.04)') : 'transparent',
                borderLeft: lead.id === selectedId ? '3px solid #c9a96e' : '3px solid transparent',
                transition: 'background .15s',
              }}
            >
              {/* Name + location */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</span>
                  {lead.preclose_candidate && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', padding: '1px 5px', background: '#9b59b622', border: '1px solid #9b59b655', color: '#9b59b6', letterSpacing: '.08em' }}>PRÉ-FECHO</span>}
                  {lead.outreach_ready && !lead.preclose_candidate && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', padding: '1px 5px', background: '#1abc9c22', border: '1px solid #1abc9c55', color: '#1abc9c', letterSpacing: '.08em' }}>PRONTO</span>}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: textMuted, letterSpacing: '.06em' }}>
                  {[lead.tipo_ativo, lead.cidade || lead.localizacao].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              {/* Score */}
              <div style={{ textAlign: 'right', minWidth: 36 }}>
                {lead.score !== null
                  ? <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.65rem', color: scoreColor(lead.score), fontWeight: 600 }}>{lead.score}</span>
                  : <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: textMuted }}>—</span>
                }
              </div>
              {/* Urgency */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: URGENCY_COLORS[lead.urgency], flexShrink: 0 }} title={lead.urgency} />
              {/* Price */}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', color: '#c9a96e', letterSpacing: '.04em', minWidth: 50, textAlign: 'right' }}>
                {formatPrice(lead.price_estimate || lead.price_ask)}
              </div>
              {/* Status */}
              <div style={{ padding: '2px 7px', background: `${STATUS_COLORS[lead.status]}22`, border: `1px solid ${STATUS_COLORS[lead.status]}55`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.08em', color: STATUS_COLORS[lead.status], textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {STATUS_LABELS[lead.status]}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedId && selected && (
          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', fontWeight: 300, color: textPrimary, marginBottom: 4 }}>{selected.nome}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: textMuted, letterSpacing: '.08em' }}>{selected.source} · {formatDate(selected.created_at)}</div>
              </div>
              <button type="button" onClick={() => setEditMode(!editMode)}
                style={{ background: editMode ? '#1c4a35' : 'transparent', color: editMode ? '#f4f0e6' : textMuted, border: `1px solid ${border}`, padding: '5px 12px', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', cursor: 'pointer', textTransform: 'uppercase' }}>
                {editMode ? '✓ Guardar' : 'Editar'}
              </button>
            </div>

            {/* Score badge + pre-close flags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ padding: '4px 12px', background: `${scoreColor(selected.score)}22`, border: `1px solid ${scoreColor(selected.score)}55`, fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: scoreColor(selected.score) }}>
                Score: {selected.score ?? 'Pendente'}
              </div>
              <div style={{ padding: '4px 12px', background: `${STATUS_COLORS[selected.status]}22`, border: `1px solid ${STATUS_COLORS[selected.status]}55`, fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: STATUS_COLORS[selected.status], textTransform: 'uppercase' }}>
                {STATUS_LABELS[selected.status]}
              </div>
              <div style={{ padding: '4px 12px', background: `${URGENCY_COLORS[selected.urgency]}22`, border: `1px solid ${URGENCY_COLORS[selected.urgency]}55`, fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: URGENCY_COLORS[selected.urgency] }}>
                {selected.urgency}
              </div>
              {selected.preclose_candidate && <div style={{ padding: '4px 12px', background: '#9b59b622', border: '1px solid #9b59b655', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: '#9b59b6' }}>⭐ PRÉ-FECHO</div>}
              {selected.outreach_ready && <div style={{ padding: '4px 12px', background: '#1abc9c22', border: '1px solid #1abc9c55', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: '#1abc9c' }}>✓ PRONTO OUTREACH</div>}
              {selected.institutional_priority && <div style={{ padding: '4px 12px', background: '#c9a96e22', border: '1px solid #c9a96e55', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: '#c9a96e' }}>🏛 INSTITUCIONAL</div>}
            </div>

            {/* Score reason */}
            {selected.score_reason && (
              <div style={{ padding: '10px 14px', background: darkMode ? 'rgba(201,169,110,.06)' : 'rgba(28,74,53,.04)', border: `1px solid ${border}` }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Razão do Score</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', color: textPrimary, lineHeight: 1.5 }}>{selected.score_reason}</div>
              </div>
            )}

            {/* Buyer match info */}
            {selected.matched_to_buyers && (
              <div style={{ padding: '10px 14px', background: '#9b59b611', border: '1px solid #9b59b633' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', color: '#9b59b6', textTransform: 'uppercase', marginBottom: 4 }}>Compradores Matched</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', color: textPrimary, lineHeight: 1.5 }}>
                  {selected.matched_buyers_count} matches · Best: {selected.best_buyer_match_score}/100
                </div>
                {selected.buyer_match_notes && (
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: textMuted, marginTop: 4, lineHeight: 1.5 }}>{selected.buyer_match_notes}</div>
                )}
              </div>
            )}

            {/* Action buttons: Score + Match Buyers */}
            <div style={{ display: 'flex', gap: 6 }}>
              <ScoreButton leadId={selected.id} darkMode={darkMode} onScored={(s, r) => {
                setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, score: s, score_reason: r, score_status: 'scored' } : l))
              }} />
              <MatchBuyersButton leadId={selected.id} darkMode={darkMode} onMatched={(count, best, notes) => {
                setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, matched_buyers_count: count, best_buyer_match_score: best, buyer_match_notes: notes, matched_to_buyers: count > 0 && best >= 60 } : l))
              }} />
              <button
                type="button"
                onClick={() => patchLead(selected.id, { institutional_priority: !selected.institutional_priority })}
                style={{ padding: '6px 12px', background: selected.institutional_priority ? '#c9a96e' : 'transparent', color: selected.institutional_priority ? '#0e0e0d' : textMuted, border: `1px solid #c9a96e55`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.08em', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                🏛 Institucional
              </button>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                ['Tipo Ativo', selected.tipo_ativo],
                ['Localização', selected.localizacao],
                ['Cidade', selected.cidade],
                ['Área', selected.area_m2 ? `${selected.area_m2}m²` : null],
                ['Preço Pedido', formatPrice(selected.price_ask)],
                ['Estimativa', formatPrice(selected.price_estimate)],
                ['Contacto', selected.contacto],
                ['Owner Type', selected.owner_type],
                ['Tentativas', String(selected.contact_attempts)],
                ['Último Contacto', formatDate(selected.last_contact_at)],
                ['Follow-up', formatDate(selected.next_followup_at)],
                ['Advisor', selected.assigned_to],
              ] as [string, string | null][]).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: '.8rem', color: textPrimary }}>{value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Quick Status Update */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Actualizar Status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(Object.keys(STATUS_LABELS) as LeadStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patchLead(selected.id, { status: s })}
                    style={{
                      padding: '4px 10px',
                      background: selected.status === s ? STATUS_COLORS[s] : 'transparent',
                      color: selected.status === s ? '#fff' : textMuted,
                      border: `1px solid ${STATUS_COLORS[s]}66`,
                      fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
                      letterSpacing: '.06em', cursor: 'pointer', textTransform: 'uppercase',
                      transition: 'all .15s',
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Notas</div>
              <NoteEditor
                value={selected.notes || ''}
                darkMode={darkMode}
                cardBg={cardBg}
                border={border}
                textPrimary={textPrimary}
                onSave={(notes) => patchLead(selected.id, { notes })}
              />
            </div>

            {/* Follow-up date */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Próximo Follow-up</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="date"
                  defaultValue={selected.next_followup_at ? selected.next_followup_at.slice(0, 10) : ''}
                  id={`followup-${selected.id}`}
                  style={{ flex: 1, padding: '6px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`followup-${selected.id}`) as HTMLInputElement
                    if (el?.value) patchLead(selected.id, { next_followup_at: `${el.value}T09:00:00.000Z` })
                  }}
                  style={{ padding: '6px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', cursor: 'pointer' }}
                >
                  Definir
                </button>
              </div>
            </div>

            {/* WhatsApp quick action */}
            {selected.contacto && (
              <a
                href={`https://wa.me/${selected.contacto.replace(/\D/g, '')}?text=${encodeURIComponent('Bom dia, falo da Agency Group. Temos atualmente clientes à procura de ativos na sua zona. Trabalhamos com total discrição. Faz sentido avaliarmos sem compromisso?')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', background: '#25d366', color: '#fff', padding: '10px', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase' }}
                onClick={() => patchLead(selected.id, { last_contact_at: new Date().toISOString(), contact_attempts: selected.contact_attempts + 1 })}
              >
                WhatsApp →
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── New Lead Modal ── */}
      {showNewForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,14,9,.7)', backdropFilter: 'blur(10px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewForm(false) }}
        >
          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', fontWeight: 300, color: textPrimary }}>Novo Lead Off-Market</div>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: textMuted }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {([
                ['Nome / Proprietário *', 'nome', 'text'],
                ['Contacto', 'contacto', 'text'],
              ] as [string, keyof typeof newLead, string][]).map(([label, field, type]) => (
                <div key={field} style={{ gridColumn: field === 'nome' ? '1 / -1' : 'auto' }}>
                  <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={newLead[field] as string} onChange={e => setNewLead(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              {([
                ['Tipo de Ativo', 'tipo_ativo', TIPO_ATIVO_OPTS],
                ['Cidade / Zona', 'cidade', CIDADE_OPTS],
                ['Fonte', 'source', SOURCE_OPTS],
                ['Urgência', 'urgency', ['high', 'medium', 'low', 'unknown']],
              ] as [string, keyof typeof newLead, string[]][]).map(([label, field, opts]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <select value={newLead[field] as string} onChange={e => setNewLead(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem' }}>
                    <option value="">Selecionar...</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              {([
                ['Localização (rua / zona)', 'localizacao'],
                ['Preço Pedido (K€)', 'price_ask'],
                ['Área (m²)', 'area_m2'],
                ['Advisor', 'assigned_to'],
              ] as [string, keyof typeof newLead][]).map(([label, field]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <input type="text" value={newLead[field] as string} onChange={e => setNewLead(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Notas</label>
              <textarea value={newLead.notes} onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {saveMsg && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: saveMsg.includes('✓') ? '#27ae60' : '#e74c3c', marginBottom: 10 }}>{saveMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleCreate} disabled={saving}
                style={{ flex: 1, background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                {saving ? 'A guardar...' : 'Criar Lead'}
              </button>
              <button type="button" onClick={() => setShowNewForm(false)}
                style={{ padding: '12px 20px', background: 'transparent', border: `1px solid ${border}`, color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.52rem', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Score Button ─────────────────────────────────────────────────────────────

function ScoreButton({ leadId, darkMode, onScored }: {
  leadId: string
  darkMode: boolean
  onScored: (score: number, reason: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleScore() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/offmarket-leads/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✓ ${data.score}/100`)
        onScored(data.score, data.score_reason)
      } else {
        setMsg(data.error || 'Erro')
      }
    } catch {
      setMsg('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={handleScore}
        disabled={loading}
        style={{ padding: '6px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1 }}
      >
        {loading ? '...' : '⚡ Score'}
      </button>
      {msg && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: msg.startsWith('✓') ? '#27ae60' : '#e74c3c' }}>{msg}</span>}
    </div>
  )
}

// ─── Match Buyers Button ──────────────────────────────────────────────────────

function MatchBuyersButton({ leadId, darkMode, onMatched }: {
  leadId: string
  darkMode: boolean
  onMatched: (count: number, best: number, notes: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ total: number; best: number } | null>(null)

  async function handleMatch() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/offmarket-leads/${leadId}/match-buyers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ total: data.total_matches, best: data.best_match_score })
        onMatched(data.total_matches, data.best_match_score, data.buyer_match_notes ?? '')
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={handleMatch}
        disabled={loading}
        style={{ padding: '6px 14px', background: '#4a2880', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1 }}
      >
        {loading ? '...' : '🎯 Match Buyers'}
      </button>
      {result !== null && (
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: result.total > 0 ? '#9b59b6' : '#95a5a6' }}>
          {result.total} matches · {result.best}/100
        </span>
      )}
    </div>
  )
}

// ─── Note Editor ──────────────────────────────────────────────────────────────

function NoteEditor({ value, darkMode, cardBg, border, textPrimary, onSave }: {
  value: string; darkMode: boolean; cardBg: string; border: string; textPrimary: string; onSave: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setDraft(value); setSaved(false) }, [value])

  return (
    <div>
      <textarea value={draft} onChange={e => { setDraft(e.target.value); setSaved(false) }} rows={3}
        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#f8f8f6', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem', resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button type="button" onClick={() => { onSave(draft); setSaved(true) }}
          style={{ padding: '5px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', cursor: 'pointer' }}>
          Guardar nota
        </button>
        {saved && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: '#27ae60', padding: '5px 0' }}>✓ guardado</span>}
      </div>
    </div>
  )
}
