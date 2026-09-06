'use client'
// =============================================================================
// Phase 2B.2 — Mandate Panel (CRM Integration)
// Self-contained mandate UI within the contact-detail experience.
// Operations: CREATE, VIEW, EDIT, LIFECYCLE, LOCATIONS, CRITERIA, PARTICIPANTS, HISTORY.
// Progressive disclosure: summary strip → full detail drawer.
// Preserves Agency visual quality (Cormorant, DM Mono, #1c4a35 palette).
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// ── Types (client-side view models) ──────────────────────────────────────────

interface MandateLocation {
  id: string
  geography_node_id: string
  mode: 'INCLUDE' | 'EXCLUDE'
  preference_weight: number
  provenance: string
  created_at: string
  geography_node?: { id: string; level: string; name_pt: string; name_en: string | null; code: string | null }
}

interface MandateCriterion {
  id: string
  criterion_key: string
  criterion_val: string
  constraint_type: 'HARD' | 'PREFERENCE' | 'EXCLUSION'
  provenance: string
  recorded_at: string
}

interface MandateHistory {
  id: string
  change_type: string
  changed_at: string
  changed_by: string | null
  previous_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

interface MandateParticipant {
  id: string
  contact_id: number
  role: string
  is_primary: boolean
  notes: string | null
}

interface BuyerDetails {
  typologies: string[] | null
  bedrooms_min: number | null
  bedrooms_max: number | null
  bathrooms_min: number | null
  area_min_m2: number | null
  area_max_m2: number | null
  required_features: string[] | null
  preferred_features: string[] | null
  financing_type: string | null
  timeline: string | null
  proof_of_funds: string
  golden_visa_required: boolean
  mortgage_preapproved: boolean
}

interface InvestorDetails {
  investment_strategy: string[] | null
  target_yield_min_pct: number | null
  target_yield_max_pct: number | null
  ticket_min: number | null
  ticket_max: number | null
  ticket_currency_code: string
  risk_tolerance: string | null
  asset_types: string[] | null
  requires_management: boolean
  open_to_off_market: boolean
  typical_decision_days: number | null
}

interface Mandate {
  id: string
  holder_contact_id: number
  owner_id: string
  transaction_mode: 'BUY' | 'RENT'
  purpose: string
  lifecycle_state: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
  origin?: string | null
  budget_min: number | null
  budget_max: number | null
  currency_code: string
  budget_provenance: string
  budget_stated: boolean
  budget_verified: boolean
  human_reviewed: boolean
  last_verified_at: string | null
  notes: string | null
  expires_at: string | null
  paused_reason: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
  locations?: MandateLocation[]
  criteria?: MandateCriterion[]
  participants?: MandateParticipant[]
  buyer_details?: BuyerDetails | null
  investor_details?: InvestorDetails | null
}

// ── Visual helpers ─────────────────────────────────────────────────────────────

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Rascunho',  color: '#888888',  bg: 'rgba(136,136,136,.1)' },
  ACTIVE:    { label: 'Activo',    color: '#4a9c7a',  bg: 'rgba(74,156,122,.1)'  },
  PAUSED:    { label: 'Suspenso',  color: '#c9a96e',  bg: 'rgba(201,169,110,.1)' },
  COMPLETED: { label: 'Concluído', color: '#3a7bd5',  bg: 'rgba(58,123,213,.1)'  },
  EXPIRED:   { label: 'Expirado',  color: '#999',     bg: 'rgba(0,0,0,.06)'      },
  CANCELLED: { label: 'Cancelado', color: '#e05252',  bg: 'rgba(224,82,82,.08)'  },
}

const PURPOSE_LABELS: Record<string, string> = {
  PRIMARY_RESIDENCE:   'Residência Principal',
  SECONDARY_RESIDENCE: 'Residência Secundária',
  HOLIDAY:             'Habitação Sazonal',
  INVESTMENT:          'Investimento',
  DEVELOPMENT:         'Promoção',
  OTHER:               'Outro',
}

const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  DRAFT:     ['ACTIVE', 'CANCELLED'],
  ACTIVE:    ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED:    ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  EXPIRED:   [],
  CANCELLED: [],
}

const CONSTRAINT_CONFIG: Record<string, { label: string; color: string }> = {
  HARD:       { label: 'Hard',       color: '#e05252' },
  PREFERENCE: { label: 'Preferência', color: '#4a9c7a' },
  EXCLUSION:  { label: 'Exclusão',   color: '#c9a96e' },
}

function fmtBudget(min: number | null, max: number | null, currency = 'EUR') {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency
  if (!min && !max) return '—'
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
  if (min && max) return `${sym}${fmt(min)} – ${sym}${fmt(max)}`
  if (min) return `${sym}${fmt(min)}+`
  if (max) return `até ${sym}${fmt(max!)}`
  return '—'
}

function daysSince(iso: string | null) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function VerificationBadge({ mandate }: { mandate: Mandate }) {
  const days = daysSince(mandate.last_verified_at)
  if (mandate.budget_verified) {
    const stale = days !== null && days > 90
    return (
      <span title={`Verificado há ${days ?? '?'}d`} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '2px 6px', background: stale ? 'rgba(201,169,110,.12)' : 'rgba(74,156,122,.1)', color: stale ? '#c9a96e' : '#4a9c7a', borderRadius: '3px', letterSpacing: '.06em' }}>
        {stale ? `⚠ ${days}d sem verificação` : `✓ Verificado${days !== null ? ` (${days}d)` : ''}`}
      </span>
    )
  }
  if (mandate.budget_stated) {
    return <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '2px 6px', background: 'rgba(58,123,213,.08)', color: '#3a7bd5', borderRadius: '3px' }}>Orçamento declarado</span>
  }
  return <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '2px 6px', background: 'rgba(0,0,0,.05)', color: '#aaa', borderRadius: '3px' }}>Sem verificação</span>
}

// ── MandateCard — summary strip ───────────────────────────────────────────────

function MandateCard({ mandate, onSelect }: { mandate: Mandate; onSelect: () => void }) {
  const lc = LIFECYCLE_CONFIG[mandate.lifecycle_state] ?? LIFECYCLE_CONFIG.DRAFT
  const primaryGeo = mandate.locations?.find(l => l.mode === 'INCLUDE')
  const hardCriteria = mandate.criteria?.filter(c => c.constraint_type === 'HARD').slice(0, 3) ?? []

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: '#fff', border: '1px solid rgba(14,14,13,.08)',
        borderLeft: `4px solid ${lc.color}`,
        padding: '14px 16px', marginBottom: '8px',
        cursor: 'pointer', transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(14,14,13,.08)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
    >
      {/* Row 1: mode + purpose + lifecycle badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', fontWeight: 700, color: '#0e0e0d', letterSpacing: '.08em' }}>
            {mandate.transaction_mode}
          </span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.04em' }}>
            {PURPOSE_LABELS[mandate.purpose] ?? mandate.purpose}
          </span>
        </div>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '2px 8px', background: lc.bg, color: lc.color, borderRadius: '3px', letterSpacing: '.06em', flexShrink: 0 }}>
          {lc.label}
        </span>
      </div>

      {/* Row 2: budget + geography */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Cormorant',serif", fontWeight: 400, fontSize: '1rem', color: '#1c4a35' }}>
          {fmtBudget(mandate.budget_min, mandate.budget_max, mandate.currency_code)}
        </span>
        {primaryGeo && (
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', borderLeft: '1px solid rgba(14,14,13,.15)', paddingLeft: '10px' }}>
            {primaryGeo.geography_node?.name_pt ?? primaryGeo.geography_node_id}
          </span>
        )}
      </div>

      {/* Row 3: hard criteria tags */}
      {hardCriteria.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {hardCriteria.map(c => (
            <span key={c.id} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', padding: '1px 6px', background: 'rgba(224,82,82,.07)', color: '#c04a4a', borderRadius: '3px' }}>
              {c.criterion_val}
            </span>
          ))}
          {(mandate.criteria?.filter(c => c.constraint_type === 'HARD').length ?? 0) > 3 && (
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.35)' }}>
              +{(mandate.criteria?.filter(c => c.constraint_type === 'HARD').length ?? 0) - 3}
            </span>
          )}
        </div>
      )}

      {/* Row 4: verification + created */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <VerificationBadge mandate={mandate} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.3)' }}>
          Criado {new Date(mandate.created_at).toLocaleDateString('pt-PT')}
        </span>
      </div>
    </button>
  )
}

// ── Create Mandate Modal ───────────────────────────────────────────────────────

interface CreateMandateForm {
  transaction_mode: string
  purpose: string
  budget_min: string
  budget_max: string
  currency_code: string
  notes: string
  expires_at: string
}

function CreateMandateModal({ contactId, onClose, onCreated }: {
  contactId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<CreateMandateForm>({
    transaction_mode: 'BUY',
    purpose: 'INVESTMENT',
    budget_min: '',
    budget_max: '',
    currency_code: 'EUR',
    notes: '',
    expires_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        holder_contact_id: contactId,
        transaction_mode: form.transaction_mode,
        purpose: form.purpose,
        currency_code: form.currency_code,
      }
      if (form.budget_min) body.budget_min = Number(form.budget_min)
      if (form.budget_max) body.budget_max = Number(form.budget_max)
      if (form.notes.trim()) body.notes = form.notes.trim()
      if (form.expires_at) body.expires_at = form.expires_at

      const res = await fetch('/api/mandates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Erro ${res.status}`)
        return
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '5px' }}>{label}</div>
      {node}
    </div>
  )

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid rgba(14,14,13,.15)', background: '#faf9f5', fontFamily: "'DM Mono',monospace", fontSize: '.72rem', color: '#0e0e0d', outline: 'none', boxSizing: 'border-box' }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#f4f0e6', maxWidth: '520px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(14,14,13,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.25rem', color: '#0e0e0d' }}>Novo Mandato</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {field('Modo', (
            <select value={form.transaction_mode} onChange={e => setForm(f => ({ ...f, transaction_mode: e.target.value }))} style={selectStyle}>
              <option value="BUY">Compra (BUY)</option>
              <option value="RENT">Arrendamento (RENT)</option>
            </select>
          ))}
          {field('Finalidade', (
            <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} style={selectStyle}>
              <option value="PRIMARY_RESIDENCE">Residência Principal</option>
              <option value="SECONDARY_RESIDENCE">Residência Secundária</option>
              <option value="HOLIDAY">Habitação Sazonal</option>
              <option value="INVESTMENT">Investimento</option>
              <option value="DEVELOPMENT">Promoção</option>
              <option value="OTHER">Outro</option>
            </select>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '5px' }}>Orçamento Mín</div>
              <input type="number" value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} placeholder="ex: 500000" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '5px' }}>Orçamento Máx</div>
              <input type="number" value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} placeholder="ex: 1500000" style={inputStyle} />
            </div>
          </div>
          {field('Moeda', (
            <select value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))} style={selectStyle}>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Libra Esterlina</option>
              <option value="USD">USD — Dólar Americano</option>
              <option value="AED">AED — Dirham</option>
              <option value="CHF">CHF — Franco Suíço</option>
            </select>
          ))}
          {field('Validade', (
            <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={inputStyle} />
          ))}
          {field('Notas', (
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Requisitos comerciais, contexto, observações…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          ))}
          {error && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#e05252', padding: '8px 12px', background: 'rgba(224,82,82,.06)', border: '1px solid rgba(224,82,82,.2)', marginBottom: '12px' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(14,14,13,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', cursor: 'pointer', color: 'rgba(14,14,13,.6)' }}>Cancelar</button>
            <button type="button" onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', background: saving ? 'rgba(28,74,53,.6)' : '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '.08em' }}>
              {saving ? 'A criar…' : 'Criar Mandato'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Lifecycle Transition Modal ─────────────────────────────────────────────────

function LifecycleModal({ mandate, onClose, onDone }: { mandate: Mandate; onClose: () => void; onDone: () => void }) {
  const targets = LIFECYCLE_TRANSITIONS[mandate.lifecycle_state] ?? []
  const [target, setTarget] = useState(targets[0] ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTransition() {
    if (!target) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/mandates/${mandate.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_state: target, reason: reason.trim() || undefined }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? `Erro ${res.status}`); return }
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  if (targets.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#f4f0e6', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(14,14,13,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem' }}>Alterar Ciclo de Vida</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Estado actual</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.72rem', color: LIFECYCLE_CONFIG[mandate.lifecycle_state]?.color ?? '#888', marginBottom: '16px' }}>
            {LIFECYCLE_CONFIG[mandate.lifecycle_state]?.label}
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Novo estado</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {targets.map(t => {
              const cfg = LIFECYCLE_CONFIG[t]
              return (
                <button type="button" key={t} onClick={() => setTarget(t)}
                  style={{ padding: '6px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', border: `1px solid ${t === target ? cfg?.color : 'rgba(14,14,13,.2)'}`, background: t === target ? cfg?.bg : 'transparent', color: t === target ? cfg?.color : 'rgba(14,14,13,.5)', cursor: 'pointer', borderRadius: '3px' }}>
                  {cfg?.label ?? t}
                </button>
              )
            })}
          </div>
          {(target === 'PAUSED' || target === 'CANCELLED') && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Motivo {target === 'CANCELLED' ? '(obrigatório)' : '(opcional)'}</div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Motivo da alteração…"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(14,14,13,.15)', background: '#faf9f5', fontFamily: "'DM Mono',monospace", fontSize: '.65rem', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          )}
          {error && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.58rem', color: '#e05252', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(14,14,13,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', cursor: 'pointer', color: 'rgba(14,14,13,.6)' }}>Cancelar</button>
            <button type="button" onClick={handleTransition} disabled={saving || !target}
              style={{ padding: '7px 18px', background: saving ? 'rgba(28,74,53,.5)' : '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: 'pointer' }}>
              {saving ? 'A actualizar…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Criterion Modal ────────────────────────────────────────────────────────

function AddCriterionModal({ mandateId, onClose, onAdded }: { mandateId: string; onClose: () => void; onAdded: () => void }) {
  const [key, setKey] = useState('feature')
  const [val, setVal] = useState('')
  const [constraintType, setConstraintType] = useState<'HARD' | 'PREFERENCE' | 'EXCLUSION'>('HARD')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!val.trim()) { setError('Valor obrigatório'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/mandates/${mandateId}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterion_key: key, criterion_val: val.trim(), constraint_type: constraintType }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? `Erro ${res.status}`); return }
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid rgba(14,14,13,.15)', background: '#faf9f5', fontFamily: "'DM Mono',monospace", fontSize: '.72rem', color: '#0e0e0d', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#f4f0e6', maxWidth: '420px', width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(14,14,13,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem' }}>Adicionar Critério</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Tipo de Critério</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['HARD', 'PREFERENCE', 'EXCLUSION'] as const).map(ct => (
                <button type="button" key={ct} onClick={() => setConstraintType(ct)}
                  style={{ padding: '5px 12px', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', border: `1px solid ${ct === constraintType ? CONSTRAINT_CONFIG[ct].color : 'rgba(14,14,13,.2)'}`, background: ct === constraintType ? `rgba(${ct === 'HARD' ? '224,82,82' : ct === 'PREFERENCE' ? '74,156,122' : '201,169,110'},.08)` : 'transparent', color: ct === constraintType ? CONSTRAINT_CONFIG[ct].color : 'rgba(14,14,13,.5)', cursor: 'pointer', borderRadius: '3px' }}>
                  {CONSTRAINT_CONFIG[ct].label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Chave</div>
            <select value={key} onChange={e => setKey(e.target.value)} style={inputStyle}>
              <option value="feature">feature — Característica</option>
              <option value="view">view — Vista</option>
              <option value="proximity">proximity — Proximidade</option>
              <option value="condition">condition — Condição</option>
              <option value="keyword">keyword — Palavra-chave</option>
              <option value="custom">custom — Personalizado</option>
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Valor</div>
            <input value={val} onChange={e => setVal(e.target.value)} placeholder="ex: piscina, vista mar, t3+" style={inputStyle} onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
          </div>
          {error && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.58rem', color: '#e05252', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', cursor: 'pointer', color: 'rgba(14,14,13,.6)' }}>Cancelar</button>
            <button type="button" onClick={handleAdd} disabled={saving}
              style={{ padding: '7px 16px', background: saving ? 'rgba(28,74,53,.5)' : '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: 'pointer' }}>
              {saving ? 'A adicionar…' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add Location Modal ─────────────────────────────────────────────────────────

interface GeographyNode { id: string; name_pt: string; level: string; parent_id: string | null }

function AddLocationModal({ mandateId, onClose, onAdded }: { mandateId: string; onClose: () => void; onAdded: () => void }) {
  const [nodes, setNodes] = useState<GeographyNode[]>([])
  const [selected, setSelected] = useState('')
  const [mode, setMode] = useState<'INCLUDE' | 'EXCLUDE'>('INCLUDE')
  const [weight, setWeight] = useState('50')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/geography/nodes?level=DISTRICT,AUTONOMOUS_REGION,MUNICIPALITY')
      .then(r => r.json())
      .then((d: { nodes?: GeographyNode[] }) => { if (d.nodes) setNodes(d.nodes) })
      .catch(() => {})
  }, [])

  async function handleAdd() {
    if (!selected) { setError('Selecciona uma localização'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/mandates/${mandateId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geography_node_id: selected, mode, preference_weight: Number(weight) }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? `Erro ${res.status}`); return }
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid rgba(14,14,13,.15)', background: '#faf9f5', fontFamily: "'DM Mono',monospace", fontSize: '.7rem', color: '#0e0e0d', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#f4f0e6', maxWidth: '440px', width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(14,14,13,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem' }}>Adicionar Localização</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Modo</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['INCLUDE', 'EXCLUDE'] as const).map(m => (
                <button type="button" key={m} onClick={() => setMode(m)}
                  style={{ padding: '5px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', border: `1px solid ${m === mode ? (m === 'INCLUDE' ? '#4a9c7a' : '#e05252') : 'rgba(14,14,13,.2)'}`, background: m === mode ? (m === 'INCLUDE' ? 'rgba(74,156,122,.1)' : 'rgba(224,82,82,.07)') : 'transparent', color: m === mode ? (m === 'INCLUDE' ? '#4a9c7a' : '#e05252') : 'rgba(14,14,13,.5)', cursor: 'pointer', borderRadius: '3px' }}>
                  {m === 'INCLUDE' ? 'Incluir' : 'Excluir'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Localização</div>
            <select value={selected} onChange={e => setSelected(e.target.value)} style={inputStyle}>
              <option value="">— Seleccionar —</option>
              {nodes.filter(n => n.level === 'AUTONOMOUS_REGION').map(n => (
                <option key={n.id} value={n.id}>🏝 {n.name_pt} (Região Autónoma)</option>
              ))}
              {nodes.filter(n => n.level === 'DISTRICT').map(n => (
                <option key={n.id} value={n.id}>◎ {n.name_pt}</option>
              ))}
              {nodes.filter(n => n.level === 'MUNICIPALITY').map(n => (
                <option key={n.id} value={n.id}>  · {n.name_pt}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Peso de Preferência (0–100)</div>
            <input type="number" min="0" max="100" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.58rem', color: '#e05252', marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.2)', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', cursor: 'pointer', color: 'rgba(14,14,13,.6)' }}>Cancelar</button>
            <button type="button" onClick={handleAdd} disabled={saving}
              style={{ padding: '7px 16px', background: saving ? 'rgba(28,74,53,.5)' : '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: 'pointer' }}>
              {saving ? 'A adicionar…' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mandate Detail Drawer ──────────────────────────────────────────────────────

type DrawerTab = 'detail' | 'locations' | 'criteria' | 'history'

function MandateDetailDrawer({ mandateId, onClose, onMutated }: {
  mandateId: string
  onClose: () => void
  onMutated: () => void
}) {
  const [mandate, setMandate] = useState<Mandate | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('detail')
  const [showLifecycle, setShowLifecycle] = useState(false)
  const [showAddCriterion, setShowAddCriterion] = useState(false)
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [history, setHistory] = useState<MandateHistory[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/mandates/${mandateId}`)
      const data = await res.json() as { ok?: boolean; mandate?: Mandate; error?: string }
      if (!res.ok || !data.ok) { setLoadError(data.error ?? 'Erro a carregar mandato'); return }
      setMandate(data.mandate ?? null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setLoading(false)
    }
  }, [mandateId])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await fetch(`/api/mandates/${mandateId}/history`)
      const data = await res.json() as { ok?: boolean; history?: MandateHistory[] }
      if (res.ok && data.ok) setHistory(data.history ?? [])
    } catch { /* silent */ } finally {
      setHistLoading(false)
    }
  }, [mandateId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (drawerTab === 'history') void loadHistory() }, [drawerTab, loadHistory])

  async function removeLocation(locId: string) {
    await fetch(`/api/mandates/${mandateId}/locations/${locId}`, { method: 'DELETE' })
    void load()
  }

  async function removeCriterion(critId: string) {
    await fetch(`/api/mandates/${mandateId}/criteria/${critId}`, { method: 'DELETE' })
    void load()
  }

  const lc = mandate ? (LIFECYCLE_CONFIG[mandate.lifecycle_state] ?? LIFECYCLE_CONFIG.DRAFT) : null

  const historyChangeLabel: Record<string, string> = {
    CREATED: 'Mandato criado',
    LIFECYCLE_CHANGE: 'Ciclo de vida alterado',
    BUDGET_CHANGE: 'Orçamento actualizado',
    BUDGET_VERIFIED: 'Orçamento verificado',
    GEOGRAPHY_CHANGE: 'Geografia alterada',
    CRITERIA_CHANGE: 'Critérios actualizados',
    OWNERSHIP_CHANGE: 'Proprietário alterado',
    VERIFICATION: 'Verificação registada',
    EXTENSION_CHANGE: 'Extensão actualizada',
    NOTE_CHANGE: 'Notas actualizadas',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 350, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '560px', maxWidth: '100vw', height: '100%', background: '#f4f0e6', boxShadow: '-8px 0 32px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(14,14,13,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {loading ? (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.4)' }}>A carregar…</span>
            ) : mandate ? (
              <>
                <span style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem', color: '#0e0e0d' }}>
                  {mandate.transaction_mode} · {PURPOSE_LABELS[mandate.purpose] ?? mandate.purpose}
                </span>
                {lc && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', padding: '2px 8px', background: lc.bg, color: lc.color, borderRadius: '3px' }}>{lc.label}</span>}
              </>
            ) : <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#e05252' }}>Mandato não encontrado</span>}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>×</button>
        </div>

        {loadError && (
          <div style={{ padding: '12px 24px', background: 'rgba(224,82,82,.06)', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#e05252' }}>
            {loadError}
          </div>
        )}

        {mandate && !loading && (
          <>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.08)', padding: '0 24px', flexShrink: 0 }}>
              {([['detail', 'Detalhes'], ['locations', 'Localizações'], ['criteria', 'Critérios'], ['history', 'Histórico']] as [DrawerTab, string][]).map(([t, l]) => (
                <button type="button" key={t} onClick={() => setDrawerTab(t)}
                  style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: drawerTab === t ? '2px solid #1c4a35' : '2px solid transparent', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: drawerTab === t ? '#1c4a35' : 'rgba(14,14,13,.45)', cursor: 'pointer', letterSpacing: '.06em', transition: 'color .15s', marginBottom: '-1px' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Actions bar */}
            {drawerTab === 'detail' && (
              <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(14,14,13,.06)', display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                {LIFECYCLE_TRANSITIONS[mandate.lifecycle_state]?.length > 0 && (
                  <button type="button" onClick={() => setShowLifecycle(true)} style={{ padding: '6px 14px', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', background: 'transparent', border: '1px solid rgba(14,14,13,.2)', cursor: 'pointer', color: 'rgba(14,14,13,.6)', borderRadius: '3px' }}>
                    ⟳ Ciclo de Vida
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* DETAIL TAB */}
              {drawerTab === 'detail' && (
                <div>
                  {/* Budget section */}
                  <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#fff', border: '1px solid rgba(14,14,13,.08)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '6px' }}>Orçamento</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#1c4a35', marginBottom: '4px' }}>
                      {fmtBudget(mandate.budget_min, mandate.budget_max, mandate.currency_code)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <VerificationBadge mandate={mandate} />
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.4)' }}>
                        Proveniência: {mandate.budget_provenance}
                      </span>
                      {mandate.human_reviewed && (
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '2px 6px', background: 'rgba(28,74,53,.07)', color: '#1c4a35', borderRadius: '3px' }}>
                          Revisto por agente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Core details grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    {[
                      ['Modo', mandate.transaction_mode],
                      ['Finalidade', PURPOSE_LABELS[mandate.purpose] ?? mandate.purpose],
                      ['Moeda', mandate.currency_code],
                      ['Origem', mandate.origin ?? '—'],
                      ['Criado', new Date(mandate.created_at).toLocaleDateString('pt-PT')],
                      ['Actualizado', new Date(mandate.updated_at).toLocaleDateString('pt-PT')],
                      ['Validade', mandate.expires_at ? new Date(mandate.expires_at).toLocaleDateString('pt-PT') : '—'],
                      ['Verificação', mandate.last_verified_at ? `${daysSince(mandate.last_verified_at)}d atrás` : 'Nunca'],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: '10px 12px', background: '#fff', border: '1px solid rgba(14,14,13,.07)' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.35)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.08em' }}>{lbl}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.65rem', color: '#0e0e0d' }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Pause/Cancel reason */}
                  {mandate.lifecycle_state === 'PAUSED' && mandate.paused_reason && (
                    <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Motivo de Suspensão</div>
                      <div style={{ fontSize: '.8rem', color: 'rgba(14,14,13,.6)' }}>{mandate.paused_reason}</div>
                    </div>
                  )}
                  {mandate.lifecycle_state === 'CANCELLED' && mandate.cancelled_reason && (
                    <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(224,82,82,.05)', border: '1px solid rgba(224,82,82,.15)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#e05252', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Motivo de Cancelamento</div>
                      <div style={{ fontSize: '.8rem', color: 'rgba(14,14,13,.6)' }}>{mandate.cancelled_reason}</div>
                    </div>
                  )}

                  {/* Notes */}
                  {mandate.notes && (
                    <div style={{ marginBottom: '20px', padding: '12px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.07)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Notas</div>
                      <div style={{ fontSize: '.83rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.6 }}>{mandate.notes}</div>
                    </div>
                  )}

                  {/* Buyer details */}
                  {mandate.buyer_details && (
                    <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.07)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Detalhes Comprador</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '.75rem', color: 'rgba(14,14,13,.65)' }}>
                        {mandate.buyer_details.bedrooms_min !== null && <div>Quartos: T{mandate.buyer_details.bedrooms_min}{mandate.buyer_details.bedrooms_max ? `–T${mandate.buyer_details.bedrooms_max}` : '+'}</div>}
                        {mandate.buyer_details.area_min_m2 !== null && <div>Área: {mandate.buyer_details.area_min_m2}–{mandate.buyer_details.area_max_m2 ?? '?'}m²</div>}
                        {mandate.buyer_details.financing_type && <div>Financiamento: {mandate.buyer_details.financing_type}</div>}
                        {mandate.buyer_details.timeline && <div>Timeline: {mandate.buyer_details.timeline}</div>}
                        <div>POF: {mandate.buyer_details.proof_of_funds}</div>
                        {mandate.buyer_details.golden_visa_required && <div style={{ color: '#c9a96e' }}>✓ Golden Visa</div>}
                        {mandate.buyer_details.mortgage_preapproved && <div style={{ color: '#4a9c7a' }}>✓ Pré-aprovado</div>}
                      </div>
                      {mandate.buyer_details.required_features && mandate.buyer_details.required_features.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.35)', marginBottom: '4px' }}>CARACTERÍSTICAS OBRIGATÓRIAS</div>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {mandate.buyer_details.required_features.map(f => (
                              <span key={f} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '2px 6px', background: 'rgba(224,82,82,.07)', color: '#c04a4a', borderRadius: '3px' }}>{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Investor details */}
                  {mandate.investor_details && (
                    <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.07)' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Detalhes Investidor</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '.75rem', color: 'rgba(14,14,13,.65)' }}>
                        {mandate.investor_details.target_yield_min_pct !== null && (
                          <div>Yield: {mandate.investor_details.target_yield_min_pct}%–{mandate.investor_details.target_yield_max_pct ?? '?'}%</div>
                        )}
                        {mandate.investor_details.ticket_min !== null && (
                          <div>Ticket: {fmtBudget(mandate.investor_details.ticket_min, mandate.investor_details.ticket_max, mandate.investor_details.ticket_currency_code)}</div>
                        )}
                        {mandate.investor_details.risk_tolerance && <div>Risco: {mandate.investor_details.risk_tolerance}</div>}
                        {mandate.investor_details.typical_decision_days && <div>Decisão: ~{mandate.investor_details.typical_decision_days}d</div>}
                        {mandate.investor_details.open_to_off_market && <div style={{ color: '#4a9c7a' }}>✓ Off-Market</div>}
                        {mandate.investor_details.requires_management && <div>✓ Gestão necessária</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LOCATIONS TAB */}
              {drawerTab === 'locations' && (
                <div>
                  <button type="button" onClick={() => setShowAddLocation(true)}
                    style={{ marginBottom: '14px', padding: '7px 16px', background: '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: 'pointer', letterSpacing: '.06em' }}>
                    + Adicionar Localização
                  </button>
                  {(!mandate.locations || mandate.locations.length === 0) && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.3)', textAlign: 'center', padding: '24px' }}>Sem localizações definidas</div>
                  )}
                  {mandate.locations?.map(loc => (
                    <div key={loc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.07)', marginBottom: '6px', borderLeft: `3px solid ${loc.mode === 'INCLUDE' ? '#4a9c7a' : '#e05252'}` }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.65rem', color: '#0e0e0d', marginBottom: '2px' }}>{loc.geography_node?.name_pt ?? loc.geography_node_id}</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', padding: '1px 6px', background: loc.mode === 'INCLUDE' ? 'rgba(74,156,122,.1)' : 'rgba(224,82,82,.07)', color: loc.mode === 'INCLUDE' ? '#4a9c7a' : '#e05252', borderRadius: '2px' }}>{loc.mode}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.3)' }}>w:{loc.preference_weight}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.44rem', color: 'rgba(14,14,13,.3)' }}>{loc.geography_node?.level}</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeLocation(loc.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.3)', fontSize: '1rem', padding: '4px 8px' }}
                        title="Remover">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* CRITERIA TAB */}
              {drawerTab === 'criteria' && (
                <div>
                  <button type="button" onClick={() => setShowAddCriterion(true)}
                    style={{ marginBottom: '14px', padding: '7px 16px', background: '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: 'pointer', letterSpacing: '.06em' }}>
                    + Adicionar Critério
                  </button>
                  {/* HARD first, then PREFERENCE, then EXCLUSION */}
                  {(['HARD', 'PREFERENCE', 'EXCLUSION'] as const).map(ct => {
                    const group = mandate.criteria?.filter(c => c.constraint_type === ct) ?? []
                    if (group.length === 0) return null
                    const cfg = CONSTRAINT_CONFIG[ct]
                    return (
                      <div key={ct} style={{ marginBottom: '14px' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.1em', textTransform: 'uppercase', color: cfg.color, marginBottom: '6px' }}>{cfg.label}</div>
                        {group.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', border: '1px solid rgba(14,14,13,.07)', marginBottom: '4px', borderLeft: `2px solid ${cfg.color}` }}>
                            <div>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.58rem', color: 'rgba(14,14,13,.4)', marginRight: '6px' }}>{c.criterion_key}</span>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.65rem', color: '#0e0e0d' }}>{c.criterion_val}</span>
                            </div>
                            <button type="button" onClick={() => removeCriterion(c.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.3)', fontSize: '1rem', padding: '2px 6px' }}>×</button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {(!mandate.criteria || mandate.criteria.length === 0) && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.3)', textAlign: 'center', padding: '24px' }}>Sem critérios definidos</div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {drawerTab === 'history' && (
                <div>
                  {histLoading && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.4)', padding: '16px' }}>A carregar histórico…</div>}
                  {!histLoading && history.length === 0 && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.3)', textAlign: 'center', padding: '24px' }}>Sem histórico registado</div>}
                  {history.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '2px', background: i < history.length - 1 ? 'rgba(14,14,13,.1)' : 'transparent', alignSelf: 'stretch', marginLeft: '7px', marginTop: '8px', flexShrink: 0 }} />
                      <div style={{ flex: 1, padding: '10px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.07)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#0e0e0d', fontWeight: 500 }}>{historyChangeLabel[h.change_type] ?? h.change_type}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: 'rgba(14,14,13,.35)' }}>{new Date(h.changed_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        {h.new_values && Object.keys(h.new_values).length > 0 && (
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.6 }}>
                            {Object.entries(h.new_values).map(([k, v]) => (
                              <span key={k} style={{ marginRight: '10px' }}>{k}: <strong>{String(v ?? '—')}</strong></span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showLifecycle && mandate && (
        <LifecycleModal mandate={mandate} onClose={() => setShowLifecycle(false)} onDone={() => { setShowLifecycle(false); void load(); onMutated() }} />
      )}
      {showAddCriterion && (
        <AddCriterionModal mandateId={mandateId} onClose={() => setShowAddCriterion(false)} onAdded={() => { setShowAddCriterion(false); void load() }} />
      )}
      {showAddLocation && (
        <AddLocationModal mandateId={mandateId} onClose={() => setShowAddLocation(false)} onAdded={() => { setShowAddLocation(false); void load() }} />
      )}
    </div>
  )
}

// ── Main MandatePanel ─────────────────────────────────────────────────────────

export default function MandatePanel({ contactId }: { contactId: number }) {
  const [mandates, setMandates] = useState<Mandate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedMandateId, setSelectedMandateId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'CLOSED'>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/mandates?contact_id=${contactId}`)
      const data = await res.json() as { ok?: boolean; mandates?: Mandate[]; error?: string }
      if (!res.ok) {
        if (res.status === 401) { setLoadError('Sessão expirada — faz login novamente'); return }
        if (res.status === 403) { setLoadError('Sem acesso a este contacto'); return }
        setLoadError(data.error ?? `Erro ${res.status}`)
        return
      }
      setMandates(data.mandates ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void load() }, [load])

  const filtered = mandates.filter(m => {
    if (filter === 'ALL') return true
    if (filter === 'ACTIVE') return m.lifecycle_state === 'ACTIVE'
    if (filter === 'PAUSED') return m.lifecycle_state === 'PAUSED'
    if (filter === 'CLOSED') return ['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(m.lifecycle_state)
    return true
  })

  const activeMandates = mandates.filter(m => m.lifecycle_state === 'ACTIVE')
  const pausedMandates = mandates.filter(m => m.lifecycle_state === 'PAUSED')

  return (
    <div>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '2px' }}>
            Mandatos de Procura
          </div>
          {!loading && mandates.length > 0 && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.55rem', color: 'rgba(14,14,13,.4)' }}>
              {activeMandates.length > 0 && <span style={{ color: '#4a9c7a', marginRight: '8px' }}>● {activeMandates.length} activo{activeMandates.length !== 1 ? 's' : ''}</span>}
              {pausedMandates.length > 0 && <span style={{ color: '#c9a96e', marginRight: '8px' }}>● {pausedMandates.length} suspenso{pausedMandates.length !== 1 ? 's' : ''}</span>}
              {mandates.length - activeMandates.length - pausedMandates.length > 0 && <span style={{ color: 'rgba(14,14,13,.3)' }}>● {mandates.length - activeMandates.length - pausedMandates.length} encerrado{mandates.length - activeMandates.length - pausedMandates.length !== 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          style={{ padding: '7px 16px', background: '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.58rem', color: '#f4f0e6', cursor: 'pointer', letterSpacing: '.06em' }}>
          + Novo Mandato
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.3)' }}>
          A carregar mandatos…
        </div>
      )}

      {/* Error state */}
      {!loading && loadError && (
        <div style={{ padding: '14px 16px', background: 'rgba(224,82,82,.05)', border: '1px solid rgba(224,82,82,.15)', marginBottom: '12px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#e05252', marginBottom: '6px' }}>{loadError}</div>
          <button type="button" onClick={load} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.55rem', color: '#1c4a35', background: 'none', border: '1px solid rgba(28,74,53,.3)', padding: '4px 10px', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )}

      {/* No mandates state */}
      {!loading && !loadError && mandates.length === 0 && (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed rgba(14,14,13,.15)' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem', color: 'rgba(14,14,13,.3)', marginBottom: '8px' }}>Sem mandatos registados</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.55rem', color: 'rgba(14,14,13,.25)', marginBottom: '16px' }}>Cria um mandato para registar a procura estruturada deste contacto</div>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ padding: '8px 20px', background: '#1c4a35', border: 'none', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: '#f4f0e6', cursor: 'pointer', letterSpacing: '.08em' }}>
            Criar Primeiro Mandato
          </button>
        </div>
      )}

      {/* Filter bar (shown when has mandates) */}
      {!loading && !loadError && mandates.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {([['ALL', 'Todos'], ['ACTIVE', 'Activos'], ['PAUSED', 'Suspensos'], ['CLOSED', 'Encerrados']] as const).map(([v, l]) => (
            <button type="button" key={v} onClick={() => setFilter(v)}
              style={{ padding: '4px 12px', fontFamily: "'DM Mono',monospace", fontSize: '.55rem', background: filter === v ? '#0e0e0d' : 'transparent', color: filter === v ? '#f4f0e6' : 'rgba(14,14,13,.5)', border: '1px solid rgba(14,14,13,.15)', cursor: 'pointer', borderRadius: '3px', transition: 'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Mandate list */}
      {!loading && !loadError && filtered.map(mandate => (
        <MandateCard key={mandate.id} mandate={mandate} onSelect={() => setSelectedMandateId(mandate.id)} />
      ))}

      {/* Empty filter result */}
      {!loading && !loadError && mandates.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.6rem', color: 'rgba(14,14,13,.35)' }}>
          Nenhum mandato com este filtro
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateMandateModal contactId={contactId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load() }} />
      )}

      {/* Mandate detail drawer */}
      {selectedMandateId && (
        <MandateDetailDrawer mandateId={selectedMandateId} onClose={() => setSelectedMandateId(null)} onMutated={() => void load()} />
      )}
    </div>
  )
}
