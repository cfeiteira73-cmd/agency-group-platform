'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'
import {
  OUTREACH_TEMPLATES,
  PRE_CPCV_CHECKLIST,
  POST_CPCV_CHECKLIST,
  MEETING_PREP_CHECKLIST,
  MEETING_CAPTURE_FIELDS,
  SLA_RULES,
  getSLAStatus,
  RISK_FLAG_LABELS,
  type OutreachTemplate,
} from '@/lib/outreach-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

type NegotiationStatus = 'idle' | 'offer_received' | 'counter_proposed' | 'terms_agreed' | 'blocked' | 'withdrawn'
type RiskLevel = 'verde' | 'amarelo' | 'vermelho'

interface DealLead {
  id: string
  nome: string
  cidade: string | null
  score: number | null
  status: string
  contacto: string | null
  assigned_to: string | null
  sla_contacted_at: string | null
  created_at: string
  _priority?: string
  // Negotiation
  negotiation_status: NegotiationStatus
  offer_amount: number | null
  offer_date: string | null
  counter_offer_amount: number | null
  counter_offer_date: string | null
  cpcv_target_date: string | null
  cpcv_signed_at: string | null
  deposit_received: number | null
  legal_status: string | null
  docs_pending: string[] | null
  escritura_target_date: string | null
  escritura_done_at: string | null
  deal_risk_level: RiskLevel
  deal_risk_reason: string | null
  deal_owner: string | null
  deal_next_step: string | null
  deal_next_step_date: string | null
  score_reason: string | null
  matched_buyers_count: number | null
  best_buyer_match_score: number | null
  buyer_match_notes: string | null
  preclose_candidate: boolean
  outreach_ready: boolean
  // Buyer Intelligence (migration 007)
  deal_priority_score: number | null
  attack_recommendation: string | null
  buyer_triad_notes: string | null
  primary_buyer_id: string | null
  secondary_buyer_id: string | null
  tertiary_buyer_id: string | null
  // Price Intelligence (migration 009)
  price_ask: number | null
  area_m2: number | null
  price_ask_per_m2: number | null
  estimated_fair_value: number | null
  gross_discount_pct: number | null
  comp_confidence_score: number | null
  price_opportunity_score: number | null
  price_reason: string | null
  // Deal Evaluation Engine (migration 010)
  adjusted_discount_score: number | null
  liquidity_score: number | null
  liquidity_reason: string | null
  execution_probability: number | null
  execution_reason: string | null
  best_buyer_execution_score: number | null
  buyer_execution_reason: string | null
  upside_score: number | null
  friction_penalty: number | null
  risk_adjusted_upside_score: number | null
  upside_reason: string | null
  asset_quality_score: number | null
  source_quality_score: number | null
  deal_evaluation_score: number | null
  deal_evaluation_reason: string | null
  master_attack_rank: number | null
  master_attack_reason: string | null
}

interface RiskFlagLead {
  id: string
  nome: string
  score: number | null
  status: string
  risk_flags: string[]
  deal_risk_level: RiskLevel
  assigned_to: string | null
}

type DealDeskTab = 'execution' | 'negotiations' | 'cpcv' | 'risk' | 'templates' | 'checklists'

const NEG_STATUS_LABELS: Record<NegotiationStatus, string> = {
  idle: 'Aguarda',
  offer_received: 'Proposta Recebida',
  counter_proposed: 'Contraproposta',
  terms_agreed: 'Termos Alinhados',
  blocked: '⚠️ Bloqueado',
  withdrawn: 'Retirado',
}

const NEG_STATUS_COLORS: Record<NegotiationStatus, string> = {
  idle: '#95a5a6',
  offer_received: '#4a90d9',
  counter_proposed: '#f39c12',
  terms_agreed: '#27ae60',
  blocked: '#e74c3c',
  withdrawn: '#7f8c8d',
}

const RISK_COLORS: Record<RiskLevel, string> = {
  verde: '#27ae60',
  amarelo: '#f39c12',
  vermelho: '#e74c3c',
}

// Deal Evaluation helpers (migration 010)
function classifyDeal(rank: number | null, execProb: number | null, adjDiscount: number | null): string {
  const r = rank ?? 0; const e = execProb ?? 0; const d = adjDiscount ?? 0
  if (r >= 80 && e >= 70) return 'Ataque imediato'
  if (r >= 65 && d >= 40) return 'Oportunidade forte'
  if (r >= 50) return 'Boa mas não prioritária'
  if (d >= 40 && e < 40) return 'Produto bom, deal fraco'
  if (d <= 5 && r < 40) return 'Preço acima do mercado'
  return 'Dados insuficientes'
}

function getMasterAttackColor(rank: number | null): string {
  if (!rank) return '#95a5a6'
  if (rank >= 80) return '#e74c3c'
  if (rank >= 65) return '#f39c12'
  if (rank >= 50) return '#4a90d9'
  return '#95a5a6'
}

// Price intelligence helpers
function getPriceLabel(discountPct: number | null, confidence: number | null): { label: string; color: string } {
  if (discountPct === null || confidence === null || confidence < 20) {
    return { label: 'Dados insuficientes', color: '#95a5a6' }
  }
  if (discountPct >= 15) return { label: `↓${Math.round(discountPct)}% mercado`, color: '#27ae60' }
  if (discountPct >= 5)  return { label: `↓${Math.round(discountPct)}% mercado`, color: '#2ecc71' }
  if (discountPct >= 0)  return { label: 'Preço justo', color: '#4a90d9' }
  if (discountPct >= -10) return { label: `↑${Math.round(Math.abs(discountPct))}% mercado`, color: '#f39c12' }
  return { label: `↑${Math.round(Math.abs(discountPct))}% mercado`, color: '#e74c3c' }
}

function formatPSM(psm: number | null): string {
  if (!psm) return '—'
  return `€${Math.round(psm).toLocaleString('pt-PT')}/m²`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalDealDesk() {
  const darkMode = useUIStore(s => s.darkMode)

  const [tab, setTab] = useState<DealDeskTab>('execution')
  const [dailyReport, setDailyReport] = useState<Record<string, unknown> | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<Record<string, unknown> | null>(null)
  const [riskFlags, setRiskFlags] = useState<RiskFlagLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<DealLead | null>(null)
  const [dealEditorOpen, setDealEditorOpen] = useState(false)
  const [templateFilter, setTemplateFilter] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const bg = darkMode ? '#0a1510' : '#f4f0e6'
  const cardBg = darkMode ? '#0f1e16' : '#fff'
  const border = darkMode ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'
  const textPrimary = darkMode ? '#f4f0e6' : '#0e0e0d'
  const textMuted = darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.45)'

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dailyRes, weeklyRes, riskRes] = await Promise.all([
        fetch('/api/reporting/daily'),
        fetch('/api/reporting/weekly-negotiation'),
        fetch('/api/offmarket-leads/risk-flags?severity=all&limit=50'),
      ])
      if (dailyRes.ok) setDailyReport(await dailyRes.json())
      if (weeklyRes.ok) setWeeklyReport(await weeklyRes.json())
      if (riskRes.ok) {
        const d = await riskRes.json()
        setRiskFlags(d.data ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Patch deal fields ──────────────────────────────────────────────────────

  async function patchDeal(id: string, patch: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/offmarket-leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedLead(prev => prev ? { ...prev, ...updated } : prev)
        loadAll()
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Template copy ──────────────────────────────────────────────────────────

  function copyTemplate(tpl: OutreachTemplate) {
    const text = tpl.subject ? `Assunto: ${tpl.subject}\n\n${tpl.body}` : tpl.body
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(tpl.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function formatMoney(n: number | null): string {
    if (!n) return '—'
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `€${Math.round(n / 1_000)}K`
    return `€${n}`
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  function daysUntil(iso: string | null): number | null {
    if (!iso) return null
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  }

  const summary = (dailyReport?.summary ?? {}) as Record<string, number>
  const weeklySummary = (weeklyReport?.summary ?? {}) as Record<string, number>
  const executionQueue = (dailyReport?.execution_queue ?? []) as DealLead[]
  const followupsDue = (dailyReport?.followups_due ?? []) as DealLead[]
  const activeNegotiations = (dailyReport?.active_negotiations ?? []) as DealLead[]
  const cpcvPipeline = (dailyReport?.cpcv_pipeline ?? []) as DealLead[]
  const slaBreach = (dailyReport?.sla_breaches ?? []) as DealLead[]
  const redDeals = (weeklyReport?.red_risk_deals ?? []) as DealLead[]
  const top5Unlock = (weeklyReport?.top5_to_unlock ?? []) as DealLead[]

  const filteredTemplates = templateFilter === 'all'
    ? OUTREACH_TEMPLATES
    : OUTREACH_TEMPLATES.filter(t => t.tags.includes(templateFilter))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '28px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', marginBottom: 6 }}>
          Deal Desk · Execução Comercial
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontSize: '1.8rem', fontWeight: 300, color: textPrimary, margin: 0 }}>
            Deal Desk & Pipeline
          </h1>
          <button type="button" onClick={loadAll}
            style={{ padding: '8px 16px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* ── Command Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 20 }}>
        {[
          ['P0 Urgente',     String(summary.p0_uncontacted ?? 0),    '#e74c3c'],
          ['P1 Alta Prior.', String(summary.p1_uncontacted ?? 0),    '#f39c12'],
          ['Pré-Fecho',      String(summary.preclose_candidates ?? 0), '#9b59b6'],
          ['Follow-ups Hoje',String(summary.followups_due_today ?? 0), '#4a90d9'],
          ['SLA Breach',     String(summary.sla_breaches ?? 0),       '#e74c3c'],
          ['Negoc. Ativas',  String(summary.active_negotiations ?? 0), '#27ae60'],
          ['CPCV Ativos',    String(summary.cpcv_in_progress ?? 0),   '#c9a96e'],
          ['Risco 🔴',       String(weeklySummary.deals_red_risk ?? 0), '#e74c3c'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 14px' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
            <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', fontWeight: 300, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── SLA Rules Strip ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {SLA_RULES.map(rule => (
          <div key={rule.priority} style={{ padding: '5px 14px', background: `${rule.color}18`, border: `1px solid ${rule.color}44`, fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: rule.color, letterSpacing: '.08em' }}>
            {rule.label} — {rule.limitLabel}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${border}` }}>
        {([
          ['execution', 'Execução Diária'],
          ['negotiations', 'Negociações'],
          ['cpcv', 'CPCV · Escritura'],
          ['risk', 'Risk Flags'],
          ['templates', 'Scripts'],
          ['checklists', 'Checklists'],
        ] as [DealDeskTab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: tab === id ? '2px solid #c9a96e' : '2px solid transparent',
              color: tab === id ? '#c9a96e' : textMuted,
              fontFamily: "'DM Mono', monospace",
              fontSize: '.48rem',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>A carregar...</div>}

      {/* ── EXECUTION DAILY TAB ── */}
      {!loading && tab === 'execution' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* P0/P1 Attack Queue */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 20 }}>
            <SectionHeader title="🔴 Ataque Imediato (P0 + P1)" textMuted={textMuted} />
            {executionQueue.length === 0 && <EmptyMsg msg="Sem leads urgentes" textMuted={textMuted} />}
            {executionQueue.map(lead => (
              <LeadRow
                key={lead.id}
                lead={lead}
                darkMode={darkMode}
                cardBg={cardBg}
                border={border}
                textPrimary={textPrimary}
                textMuted={textMuted}
                onSelect={() => { setSelectedLead(lead); setDealEditorOpen(true) }}
                showSLA
              />
            ))}
          </div>

          {/* Follow-ups Due Today */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 20 }}>
            <SectionHeader title="📅 Follow-ups Hoje" textMuted={textMuted} />
            {followupsDue.length === 0 && <EmptyMsg msg="Sem follow-ups para hoje" textMuted={textMuted} />}
            {followupsDue.map(lead => (
              <LeadRow
                key={lead.id}
                lead={lead}
                darkMode={darkMode}
                cardBg={cardBg}
                border={border}
                textPrimary={textPrimary}
                textMuted={textMuted}
                onSelect={() => { setSelectedLead(lead); setDealEditorOpen(true) }}
              />
            ))}
          </div>

          {/* SLA Breaches */}
          {slaBreach.length > 0 && (
            <div style={{ background: cardBg, border: '1px solid #e74c3c44', padding: 20, gridColumn: '1/-1' }}>
              <SectionHeader title="⚠️ SLA Violado — Ação Imediata" textMuted={textMuted} color="#e74c3c" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                {slaBreach.map(lead => (
                  <div key={lead.id} style={{ padding: '10px 14px', border: '1px solid #e74c3c44', background: '#e74c3c08' }}>
                    <div style={{ fontSize: '.8rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: '#e74c3c', marginTop: 3 }}>
                      Score {lead.score} · {lead.cidade ?? '—'} · {lead.assigned_to ?? 'sem advisor'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attack Recommendations — leads with deal_priority_score + attack_recommendation */}
          {executionQueue.filter(l => l.attack_recommendation).length > 0 && (
            <div style={{ background: cardBg, border: '1px solid #c9a96e44', padding: 20, gridColumn: '1/-1' }}>
              <SectionHeader title="🎯 Recomendações de Ataque" textMuted={textMuted} color="#c9a96e" />
              {executionQueue.filter(l => l.attack_recommendation).slice(0, 5).map(lead => (
                <div key={lead.id} style={{ padding: '12px 0', borderBottom: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
                    <div style={{ fontSize: '.82rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                    {lead.deal_priority_score != null && (
                      <div style={{ padding: '2px 10px', background: lead.deal_priority_score >= 70 ? '#e74c3c22' : lead.deal_priority_score >= 50 ? '#f39c1222' : '#4a90d922', border: `1px solid ${lead.deal_priority_score >= 70 ? '#e74c3c' : lead.deal_priority_score >= 50 ? '#f39c12' : '#4a90d9'}55`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: lead.deal_priority_score >= 70 ? '#e74c3c' : lead.deal_priority_score >= 50 ? '#f39c12' : '#4a90d9', whiteSpace: 'nowrap' }}>
                        DPS {lead.deal_priority_score}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: '#c9a96e', lineHeight: 1.5 }}>{lead.attack_recommendation}</div>
                  {lead.buyer_triad_notes && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: textMuted, marginTop: 6, whiteSpace: 'pre-line', opacity: .8 }}>{lead.buyer_triad_notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEGOTIATIONS TAB ── */}
      {!loading && tab === 'negotiations' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 20 }}>
            {[
              ['Propostas Ativas', weeklySummary.offers_active],
              ['Contrapropostas', weeklySummary.counter_proposals],
              ['Termos Alinhados', weeklySummary.terms_agreed],
              ['CPCV Assinados', weeklySummary.cpcv_signed],
              ['Bloqueados', weeklySummary.blocked],
              ['Concluídos Semana', weeklySummary.completed_this_week],
            ].map(([label, value]) => (
              <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 16px' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', fontWeight: 300, color: '#c9a96e' }}>{value ?? 0}</div>
              </div>
            ))}
          </div>

          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 20, marginBottom: 16 }}>
            <SectionHeader title="⚡ Negociações Ativas" textMuted={textMuted} />
            {activeNegotiations.length === 0 && <EmptyMsg msg="Sem negociações ativas" textMuted={textMuted} />}
            {activeNegotiations.map(lead => (
              <div
                key={lead.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
                onClick={() => { setSelectedLead(lead); setDealEditorOpen(true) }}
              >
                <div>
                  <div style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: textMuted, marginTop: 2 }}>
                    {lead.cidade ?? '—'} · Score {lead.score ?? '—'}
                    {lead.deal_next_step && <span style={{ color: '#f39c12' }}> · ↳ {lead.deal_next_step}</span>}
                  </div>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', color: '#c9a96e' }}>
                  {lead.offer_amount ? formatMoney(lead.offer_amount) : '—'}
                </div>
                <div style={{ padding: '3px 10px', background: `${NEG_STATUS_COLORS[lead.negotiation_status]}22`, border: `1px solid ${NEG_STATUS_COLORS[lead.negotiation_status]}55`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: NEG_STATUS_COLORS[lead.negotiation_status], textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {NEG_STATUS_LABELS[lead.negotiation_status]}
                </div>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: RISK_COLORS[lead.deal_risk_level ?? 'verde'], flexShrink: 0 }} title={lead.deal_risk_level ?? 'verde'} />
              </div>
            ))}
          </div>

          {/* Top 5 to Unlock */}
          {top5Unlock.length > 0 && (
            <div style={{ background: cardBg, border: `1px solid #c9a96e44`, padding: 20 }}>
              <SectionHeader title="🔑 Top 5 a Destravar" textMuted={textMuted} color="#c9a96e" />
              {top5Unlock.map((lead: DealLead, i: number) => (
                <div key={lead.id} style={{ padding: '10px 0', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '.8rem', color: textPrimary }}>{i + 1}. {lead.nome}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, marginTop: 2 }}>
                      {lead.cidade ?? '—'} · Score {lead.score ?? '—'}
                      {lead.deal_risk_reason && <span style={{ color: '#f39c12' }}> · {lead.deal_risk_reason}</span>}
                    </div>
                    {lead.deal_next_step && (
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#4a90d9', marginTop: 2 }}>↳ {lead.deal_next_step}</div>
                    )}
                  </div>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: RISK_COLORS[lead.deal_risk_level ?? 'verde'], flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CPCV / ESCRITURA TAB ── */}
      {!loading && tab === 'cpcv' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 20 }}>
            <SectionHeader title="📋 CPCV em Curso" textMuted={textMuted} />
            {cpcvPipeline.filter(l => l.cpcv_signed_at).length === 0 && <EmptyMsg msg="Sem CPCVs ativos" textMuted={textMuted} />}
            {cpcvPipeline.filter(l => l.cpcv_signed_at).map(lead => {
              const daysLeft = daysUntil(lead.escritura_target_date)
              return (
                <div key={lead.id} style={{ padding: '12px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
                  onClick={() => { setSelectedLead(lead); setDealEditorOpen(true) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: textMuted, marginTop: 2 }}>
                        Sinal: {formatMoney(lead.deposit_received)} · CPCV: {formatDate(lead.cpcv_signed_at)}
                      </div>
                      {lead.legal_status && (
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#f39c12', marginTop: 2 }}>{lead.legal_status}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: daysLeft !== null && daysLeft < 14 ? '#e74c3c' : '#27ae60' }}>
                        {daysLeft !== null ? `${daysLeft}d` : '—'}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: textMuted }}>escritura</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 3, background: border, marginTop: 8 }}>
                    <div style={{ height: 3, background: '#c9a96e', width: lead.cpcv_signed_at ? '70%' : '40%' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 20 }}>
            <SectionHeader title="🎯 Próximas Escrituras" textMuted={textMuted} />
            {(weeklyReport?.escritura_upcoming as DealLead[] ?? []).length === 0 && <EmptyMsg msg="Sem escrituras previstas" textMuted={textMuted} />}
            {(weeklyReport?.escritura_upcoming as DealLead[] ?? []).map(lead => {
              const daysLeft = daysUntil(lead.escritura_target_date)
              return (
                <div key={lead.id} style={{ padding: '12px 0', borderBottom: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: textMuted }}>{lead.cidade ?? '—'} · {lead.assigned_to ?? '—'}</div>
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: daysLeft !== null && daysLeft < 7 ? '#e74c3c' : '#c9a96e', fontWeight: 600 }}>
                      {daysLeft !== null ? `${daysLeft} dias` : '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── RISK FLAGS TAB ── */}
      {!loading && tab === 'risk' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 20 }}>
            <div style={{ background: cardBg, border: '1px solid #e74c3c44', padding: '12px 16px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, textTransform: 'uppercase', marginBottom: 3 }}>Risco Vermelho</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', color: '#e74c3c' }}>{weeklySummary.deals_red_risk ?? 0}</div>
            </div>
            <div style={{ background: cardBg, border: '1px solid #f39c1244', padding: '12px 16px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, textTransform: 'uppercase', marginBottom: 3 }}>Risco Amarelo</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', color: '#f39c12' }}>{weeklySummary.deals_yellow_risk ?? 0}</div>
            </div>
            <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '12px 16px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, textTransform: 'uppercase', marginBottom: 3 }}>Total com Flags</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', color: '#c9a96e' }}>{riskFlags.length}</div>
            </div>
          </div>

          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: 20 }}>
            <SectionHeader title="⚠️ Leads com Risk Flags Ativos" textMuted={textMuted} />
            {riskFlags.length === 0 && <EmptyMsg msg="Sem flags de risco ativas" textMuted={textMuted} />}
            {riskFlags.map(lead => (
              <div key={lead.id} style={{ padding: '14px 0', borderBottom: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: textMuted, marginTop: 2 }}>
                      Score {lead.score ?? '—'} · {lead.status} · {lead.assigned_to ?? 'sem advisor'}
                    </div>
                  </div>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: RISK_COLORS[lead.deal_risk_level ?? 'verde'], flexShrink: 0, marginTop: 4 }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {lead.risk_flags.map(flag => {
                    const info = RISK_FLAG_LABELS[flag]
                    if (!info) return null
                    return (
                      <span key={flag} style={{ padding: '2px 8px', background: `${info.color}18`, border: `1px solid ${info.color}44`, fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: info.color, letterSpacing: '.06em' }}>
                        {info.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Red risk detail */}
          {redDeals.length > 0 && (
            <div style={{ marginTop: 16, background: cardBg, border: '1px solid #e74c3c44', padding: 20 }}>
              <SectionHeader title="🔴 Deals em Risco Vermelho" textMuted={textMuted} color="#e74c3c" />
              {redDeals.map(lead => (
                <div key={lead.id} style={{ padding: '12px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
                  onClick={() => { setSelectedLead(lead); setDealEditorOpen(true) }}>
                  <div style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: '#e74c3c', marginTop: 2 }}>
                    {lead.deal_risk_reason ?? 'Motivo não definido'}
                  </div>
                  {lead.deal_next_step && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#4a90d9', marginTop: 2 }}>↳ {lead.deal_next_step}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === 'templates' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              ['all',        'Todos'],
              ['seller',     'Seller'],
              ['parceiro',   'Parceiro'],
              ['comprador',  'Comprador'],
              ['negociacao', 'Negociação'],
              ['objeccao',   'Objeção'],
              ['fecho',      'Fecho'],
              ['reativacao', 'Reativação'],
              ['pos-reuniao','Pós-Reunião'],
              ['pre-fecho',  'Pré-Fecho'],
              ['off-market', 'Off-Market'],
            ].map(([tag, label]) => (
              <button key={tag} type="button"
                onClick={() => setTemplateFilter(tag)}
                style={{ padding: '5px 14px', background: templateFilter === tag ? '#1c4a35' : 'transparent', color: templateFilter === tag ? '#f4f0e6' : textMuted, border: `1px solid ${border}`, fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.08em', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredTemplates.map(tpl => (
              <div key={tpl.id} style={{ background: cardBg, border: `1px solid ${border}`, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: textPrimary, letterSpacing: '.06em', marginBottom: 4 }}>{tpl.label}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ padding: '1px 6px', background: '#4a90d922', border: '1px solid #4a90d944', fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: '#4a90d9' }}>{tpl.channel}</span>
                      {tpl.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{ padding: '1px 6px', background: `${border}`, fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => copyTemplate(tpl)}
                    style={{ padding: '5px 12px', background: copiedId === tpl.id ? '#27ae60' : '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.08em', cursor: 'pointer', flexShrink: 0 }}>
                    {copiedId === tpl.id ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                {tpl.subject && (
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: '#c9a96e', marginBottom: 6 }}>Assunto: {tpl.subject}</div>
                )}
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: textPrimary, lineHeight: 1.6, whiteSpace: 'pre-line', background: darkMode ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)', padding: '10px 12px', borderLeft: '2px solid rgba(201,169,110,.3)' }}>
                  {tpl.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHECKLISTS TAB ── */}
      {tab === 'checklists' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { title: '📋 Preparação Reunião', items: MEETING_PREP_CHECKLIST, prefix: 'prep' },
            { title: '📝 Captura Reunião', items: MEETING_CAPTURE_FIELDS, prefix: 'capture' },
            { title: '⚠️ Pré-CPCV — Validar Antes', items: PRE_CPCV_CHECKLIST, prefix: 'precpcv' },
            { title: '✅ Pós-CPCV — Até Escritura', items: POST_CPCV_CHECKLIST, prefix: 'postcpcv' },
          ].map(({ title, items, prefix }) => (
            <div key={prefix} style={{ background: cardBg, border: `1px solid ${border}`, padding: 20 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
              {items.map((item, i) => {
                const key = `${prefix}-${i}`
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checklistState[key] ?? false}
                      onChange={e => setChecklistState(prev => ({ ...prev, [key]: e.target.checked }))}
                      style={{ marginTop: 3, flexShrink: 0, accentColor: '#1c4a35' }}
                    />
                    <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: checklistState[key] ? textMuted : textPrimary, textDecoration: checklistState[key] ? 'line-through' : 'none', lineHeight: 1.4 }}>
                      {item}
                    </span>
                  </label>
                )
              })}
              <button type="button"
                onClick={() => {
                  const reset: Record<string, boolean> = {}
                  items.forEach((_, i) => { reset[`${prefix}-${i}`] = false })
                  setChecklistState(prev => ({ ...prev, ...reset }))
                }}
                style={{ marginTop: 10, padding: '4px 12px', background: 'transparent', border: `1px solid ${border}`, color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', cursor: 'pointer' }}>
                Limpar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Deal Editor Modal ── */}
      {dealEditorOpen && selectedLead && (
        <DealEditorModal
          lead={selectedLead}
          darkMode={darkMode}
          cardBg={cardBg}
          border={border}
          textPrimary={textPrimary}
          textMuted={textMuted}
          saving={saving}
          onClose={() => setDealEditorOpen(false)}
          onPatch={(patch) => patchDeal(selectedLead.id, patch)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, textMuted, color }: { title: string; textMuted: string; color?: string }) {
  return (
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.12em', color: color ?? textMuted, textTransform: 'uppercase', marginBottom: 14 }}>
      {title}
    </div>
  )
}

function EmptyMsg({ msg, textMuted }: { msg: string; textMuted: string }) {
  return (
    <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: textMuted }}>{msg}</div>
  )
}

function LeadRow({ lead, darkMode, cardBg, border, textPrimary, textMuted, onSelect, showSLA }: {
  lead: DealLead
  darkMode: boolean
  cardBg: string
  border: string
  textPrimary: string
  textMuted: string
  onSelect: () => void
  showSLA?: boolean
}) {
  const sla = showSLA ? getSLAStatus(lead.score, lead.created_at, lead.sla_contacted_at) : null
  const priorityColor = lead._priority === 'P0' ? '#e74c3c' : lead._priority === 'P1' ? '#f39c12' : '#9b59b6'

  return (
    <div
      onClick={onSelect}
      style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
    >
      {/* Priority badge */}
      <div style={{ padding: '2px 8px', background: `${priorityColor}22`, border: `1px solid ${priorityColor}55`, fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: priorityColor, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {lead._priority ?? '—'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.82rem', color: textPrimary, fontWeight: 500 }}>{lead.nome}</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, marginTop: 1 }}>
          Score {lead.score ?? '—'} · {lead.cidade ?? '—'} · {lead.contacto ?? '⚠️ sem contacto'}
          {lead.price_ask != null && ` · €${(lead.price_ask / 1000).toFixed(0)}K`}
          {lead.price_ask_per_m2 != null && ` · ${formatPSM(lead.price_ask_per_m2)}`}
        </div>
        {/* Badges row: Price Intel + Master Attack Rank */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
          {(lead.gross_discount_pct !== null && lead.gross_discount_pct !== undefined) && (() => {
            const pi = getPriceLabel(lead.gross_discount_pct, lead.comp_confidence_score)
            return (
              <div style={{ padding: '1px 7px', background: `${pi.color}18`, border: `1px solid ${pi.color}44`, fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: pi.color }}>
                {pi.label}
              </div>
            )
          })()}
          {lead.master_attack_rank != null && (() => {
            const mc = getMasterAttackColor(lead.master_attack_rank)
            const cl = classifyDeal(lead.master_attack_rank, lead.execution_probability, lead.adjusted_discount_score)
            return (
              <div style={{ padding: '1px 7px', background: `${mc}18`, border: `1px solid ${mc}55`, fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: mc, fontWeight: 600 }}>
                ★ {lead.master_attack_rank} · {cl}
              </div>
            )
          })()}
          {lead.execution_probability != null && lead.master_attack_rank == null && (
            <div style={{ padding: '1px 7px', background: 'rgba(74,144,217,.1)', border: '1px solid rgba(74,144,217,.3)', fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: '#4a90d9' }}>
              Exec {lead.execution_probability}%
            </div>
          )}
        </div>
        {sla && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: sla.color, marginTop: 2 }}>{sla.label}</div>
        )}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {lead.assigned_to?.split('@')[0] ?? '—'}
      </div>
    </div>
  )
}

// ─── Deal Editor Modal ────────────────────────────────────────────────────────

function DealEditorModal({ lead, darkMode, cardBg, border, textPrimary, textMuted, saving, onClose, onPatch }: {
  lead: DealLead
  darkMode: boolean
  cardBg: string
  border: string
  textPrimary: string
  textMuted: string
  saving: boolean
  onClose: () => void
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState({
    negotiation_status: lead.negotiation_status ?? 'idle',
    offer_amount: lead.offer_amount ? String(lead.offer_amount / 1000) : '',
    counter_offer_amount: lead.counter_offer_amount ? String(lead.counter_offer_amount / 1000) : '',
    cpcv_target_date: lead.cpcv_target_date?.slice(0, 10) ?? '',
    cpcv_signed_at: lead.cpcv_signed_at?.slice(0, 10) ?? '',
    deposit_received: lead.deposit_received ? String(lead.deposit_received / 1000) : '',
    legal_status: lead.legal_status ?? '',
    escritura_target_date: lead.escritura_target_date?.slice(0, 10) ?? '',
    escritura_done_at: lead.escritura_done_at?.slice(0, 10) ?? '',
    deal_risk_level: lead.deal_risk_level ?? 'verde',
    deal_risk_reason: lead.deal_risk_reason ?? '',
    deal_owner: lead.deal_owner ?? '',
    deal_next_step: lead.deal_next_step ?? '',
    deal_next_step_date: lead.deal_next_step_date?.slice(0, 10) ?? '',
  })

  function handleSave() {
    const patch: Record<string, unknown> = {
      negotiation_status: form.negotiation_status,
      deal_risk_level: form.deal_risk_level,
      deal_risk_reason: form.deal_risk_reason || null,
      deal_owner: form.deal_owner || null,
      deal_next_step: form.deal_next_step || null,
      legal_status: form.legal_status || null,
    }
    if (form.offer_amount) patch.offer_amount = parseFloat(form.offer_amount) * 1000
    if (form.counter_offer_amount) patch.counter_offer_amount = parseFloat(form.counter_offer_amount) * 1000
    if (form.cpcv_target_date) patch.cpcv_target_date = `${form.cpcv_target_date}T12:00:00.000Z`
    if (form.cpcv_signed_at) patch.cpcv_signed_at = `${form.cpcv_signed_at}T12:00:00.000Z`
    if (form.deposit_received) patch.deposit_received = parseFloat(form.deposit_received) * 1000
    if (form.escritura_target_date) patch.escritura_target_date = `${form.escritura_target_date}T12:00:00.000Z`
    if (form.escritura_done_at) patch.escritura_done_at = `${form.escritura_done_at}T12:00:00.000Z`
    if (form.deal_next_step_date) patch.deal_next_step_date = `${form.deal_next_step_date}T12:00:00.000Z`
    onPatch(patch)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: `1px solid ${border}`,
    background: darkMode ? '#0a1510' : '#fff', color: textPrimary,
    fontFamily: "'Jost', sans-serif", fontSize: '.82rem', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
    letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,14,9,.75)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '32px', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', fontWeight: 300, color: textPrimary }}>{lead.nome}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: textMuted, marginTop: 3 }}>
              Score {lead.score ?? '—'} · {lead.cidade ?? '—'}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: textMuted }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Negotiation status */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Status de Negociação</label>
            <select value={form.negotiation_status} onChange={e => setForm(p => ({ ...p, negotiation_status: e.target.value as NegotiationStatus }))} style={{ ...inputStyle }}>
              {(Object.keys(NEG_STATUS_LABELS) as NegotiationStatus[]).map(s => (
                <option key={s} value={s}>{NEG_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Offer amounts */}
          <div>
            <label style={labelStyle}>Proposta Recebida (K€)</label>
            <input type="number" value={form.offer_amount} onChange={e => setForm(p => ({ ...p, offer_amount: e.target.value }))} style={inputStyle} placeholder="ex: 850" />
          </div>
          <div>
            <label style={labelStyle}>Contraproposta (K€)</label>
            <input type="number" value={form.counter_offer_amount} onChange={e => setForm(p => ({ ...p, counter_offer_amount: e.target.value }))} style={inputStyle} placeholder="ex: 920" />
          </div>

          {/* CPCV dates */}
          <div>
            <label style={labelStyle}>Prazo CPCV</label>
            <input type="date" value={form.cpcv_target_date} onChange={e => setForm(p => ({ ...p, cpcv_target_date: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CPCV Assinado em</label>
            <input type="date" value={form.cpcv_signed_at} onChange={e => setForm(p => ({ ...p, cpcv_signed_at: e.target.value }))} style={inputStyle} />
          </div>

          {/* Deposit + legal */}
          <div>
            <label style={labelStyle}>Sinal Recebido (K€)</label>
            <input type="number" value={form.deposit_received} onChange={e => setForm(p => ({ ...p, deposit_received: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Estado Jurídico</label>
            <input type="text" value={form.legal_status} onChange={e => setForm(p => ({ ...p, legal_status: e.target.value }))} style={inputStyle} placeholder="ex: certidão pendente, sem ónus" />
          </div>

          {/* Escritura */}
          <div>
            <label style={labelStyle}>Prazo Escritura</label>
            <input type="date" value={form.escritura_target_date} onChange={e => setForm(p => ({ ...p, escritura_target_date: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Escritura Concluída em</label>
            <input type="date" value={form.escritura_done_at} onChange={e => setForm(p => ({ ...p, escritura_done_at: e.target.value }))} style={inputStyle} />
          </div>

          {/* Risk control */}
          <div style={{ gridColumn: '1/-1', borderTop: `1px solid ${border}`, paddingTop: 16, marginTop: 8 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 12 }}>Controlo de Risco</div>
          </div>

          <div>
            <label style={labelStyle}>Semáforo de Risco</label>
            <select value={form.deal_risk_level} onChange={e => setForm(p => ({ ...p, deal_risk_level: e.target.value as RiskLevel }))} style={{ ...inputStyle, color: RISK_COLORS[form.deal_risk_level as RiskLevel] }}>
              <option value="verde">🟢 Verde</option>
              <option value="amarelo">🟡 Amarelo</option>
              <option value="vermelho">🔴 Vermelho</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Advisor Responsável (Owner)</label>
            <input type="text" value={form.deal_owner} onChange={e => setForm(p => ({ ...p, deal_owner: e.target.value }))} style={inputStyle} placeholder="email do advisor" />
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Motivo do Risco</label>
            <input type="text" value={form.deal_risk_reason} onChange={e => setForm(p => ({ ...p, deal_risk_reason: e.target.value }))} style={inputStyle} placeholder="ex: hipoteca por resolver, comprador silencioso" />
          </div>

          <div>
            <label style={labelStyle}>Próximo Passo</label>
            <input type="text" value={form.deal_next_step} onChange={e => setForm(p => ({ ...p, deal_next_step: e.target.value }))} style={inputStyle} placeholder="ex: enviar minuta ao advogado" />
          </div>
          <div>
            <label style={labelStyle}>Data-Limite Próximo Passo</label>
            <input type="date" value={form.deal_next_step_date} onChange={e => setForm(p => ({ ...p, deal_next_step_date: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        {/* ── Deal Evaluation Engine Panel ── */}
        {lead.deal_evaluation_score != null && (
          <div style={{ marginTop: 20, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase' }}>
                Deal Evaluation Engine
              </div>
              {lead.master_attack_rank != null && (() => {
                const mc = getMasterAttackColor(lead.master_attack_rank)
                const cl = classifyDeal(lead.master_attack_rank, lead.execution_probability, lead.adjusted_discount_score)
                return (
                  <div style={{ padding: '3px 12px', background: `${mc}22`, border: `1px solid ${mc}66`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: mc, fontWeight: 700 }}>
                    ★ Rank {lead.master_attack_rank}/100 — {cl}
                  </div>
                )
              })()}
            </div>

            {/* 8-layer score grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
              {[
                { label: 'Desconto Adj.', value: lead.adjusted_discount_score, max: 100, color: '#27ae60' },
                { label: 'Liquidez', value: lead.liquidity_score, max: 100, color: '#4a90d9' },
                { label: 'Exec. Prob.', value: lead.execution_probability, max: 100, color: '#9b59b6' },
                { label: 'Comprador', value: lead.best_buyer_execution_score, max: 100, color: '#e67e22' },
                { label: 'Upside Adj.', value: lead.risk_adjusted_upside_score, max: 100, color: '#1abc9c' },
                { label: 'Qualid. Activo', value: lead.asset_quality_score, max: 100, color: '#c9a96e' },
                { label: 'Qualid. Fonte', value: lead.source_quality_score, max: 100, color: '#7f8c8d' },
                { label: 'Deal Eval', value: lead.deal_evaluation_score, max: 100, color: '#e74c3c' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '7px 8px', background: darkMode ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', border: `1px solid ${border}`, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.35rem', color: textMuted, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', color: value != null ? color : textMuted, fontWeight: 600 }}>
                    {value != null ? value : '—'}
                  </div>
                </div>
              ))}
            </div>

            {/* Friction penalty */}
            {lead.friction_penalty != null && lead.friction_penalty > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ padding: '3px 10px', background: '#e74c3c18', border: '1px solid #e74c3c44', fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: '#e74c3c' }}>
                  ⚠ Fricção: −{lead.friction_penalty}pts
                </div>
                {lead.upside_score != null && (
                  <div style={{ padding: '3px 10px', background: 'rgba(0,0,0,.04)', border: `1px solid ${border}`, fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: textMuted }}>
                    Upside bruto {lead.upside_score} → adj. {lead.risk_adjusted_upside_score}
                  </div>
                )}
              </div>
            )}

            {/* Reason narratives */}
            {lead.deal_evaluation_reason && (
              <div style={{ padding: '7px 12px', background: darkMode ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderLeft: `3px solid ${border}`, fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: textMuted, lineHeight: 1.5, marginBottom: 6 }}>
                {lead.deal_evaluation_reason}
              </div>
            )}
            {lead.liquidity_reason && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted, opacity: .7, marginBottom: 3 }}>
                Liquidez: {lead.liquidity_reason}
              </div>
            )}
            {lead.execution_reason && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted, opacity: .7, marginBottom: 3 }}>
                Execução: {lead.execution_reason}
              </div>
            )}
            {lead.buyer_execution_reason && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted, opacity: .7 }}>
                Comprador: {lead.buyer_execution_reason}
              </div>
            )}
          </div>
        )}

        {/* ── Price Intelligence Panel ── */}
        <div style={{ marginTop: 20, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
            Price Intelligence
          </div>

          {/* Price summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            <div style={{ padding: '8px 10px', background: darkMode ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', border: `1px solid ${border}` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Preço Pedido</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: textPrimary }}>
                {lead.price_ask ? `€${(lead.price_ask / 1000).toFixed(0)}K` : '—'}
              </div>
            </div>
            <div style={{ padding: '8px 10px', background: darkMode ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', border: `1px solid ${border}` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted, textTransform: 'uppercase', marginBottom: 2 }}>€/m² Pedido</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: textPrimary }}>
                {formatPSM(lead.price_ask_per_m2)}
              </div>
            </div>
            <div style={{ padding: '8px 10px', background: darkMode ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)', border: `1px solid ${border}` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', color: textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Fair Value Est.</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: textPrimary }}>
                {lead.estimated_fair_value ? `€${(lead.estimated_fair_value / 1000).toFixed(0)}K` : '—'}
              </div>
            </div>
          </div>

          {/* Discount + confidence + opportunity score */}
          {(lead.gross_discount_pct !== null && lead.gross_discount_pct !== undefined) && (() => {
            const pi = getPriceLabel(lead.gross_discount_pct, lead.comp_confidence_score)
            return (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ padding: '4px 12px', background: `${pi.color}18`, border: `1px solid ${pi.color}44`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: pi.color }}>
                  {lead.gross_discount_pct >= 0 ? `−${lead.gross_discount_pct.toFixed(1)}%` : `+${Math.abs(lead.gross_discount_pct).toFixed(1)}%`} vs mercado
                </div>
                {lead.comp_confidence_score != null && (
                  <div style={{ padding: '4px 12px', background: '#4a90d918', border: '1px solid #4a90d944', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#4a90d9' }}>
                    Confiança: {lead.comp_confidence_score}/100
                  </div>
                )}
                {lead.price_opportunity_score != null && (
                  <div style={{ padding: '4px 12px', background: '#9b59b618', border: '1px solid #9b59b644', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#9b59b6' }}>
                    Oportunidade Preço: {lead.price_opportunity_score}/25
                  </div>
                )}
              </div>
            )
          })()}

          {/* Price reason text */}
          {lead.price_reason ? (
            <div style={{ padding: '8px 12px', background: darkMode ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', borderLeft: `3px solid ${border}`, fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: textMuted, lineHeight: 1.5 }}>
              {lead.price_reason}
            </div>
          ) : (
            <div style={{ padding: '8px 12px', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted, opacity: .6 }}>
              {lead.price_ask && !lead.price_ask_per_m2
                ? 'Adicionar área (m²) para activar análise de preço.'
                : 'Price intelligence ainda não calculado para este lead.'}
            </div>
          )}
        </div>

        {/* ── Buyer Intelligence Panel ── */}
        {(lead.attack_recommendation || lead.buyer_triad_notes || lead.matched_buyers_count) && (
          <div style={{ marginTop: 20, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
              Buyer Intelligence
            </div>
            {lead.deal_priority_score != null && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ padding: '4px 12px', background: '#c9a96e18', border: '1px solid #c9a96e44', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#c9a96e' }}>
                  Deal Priority Score: {lead.deal_priority_score}/100
                </div>
                {lead.best_buyer_match_score != null && (
                  <div style={{ padding: '4px 12px', background: '#27ae6018', border: '1px solid #27ae6044', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: '#27ae60' }}>
                    Best Buyer Match: {lead.best_buyer_match_score}/100
                  </div>
                )}
                {lead.matched_buyers_count != null && (
                  <div style={{ padding: '4px 12px', background: `${border}`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textMuted }}>
                    {lead.matched_buyers_count} compradores
                  </div>
                )}
              </div>
            )}
            {lead.attack_recommendation && (
              <div style={{ padding: '10px 14px', background: '#c9a96e0a', borderLeft: '3px solid #c9a96e', marginBottom: 10 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: '#c9a96e', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Recomendação de Ataque</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: textPrimary, lineHeight: 1.5 }}>{lead.attack_recommendation}</div>
              </div>
            )}
            {lead.buyer_triad_notes && (
              <div style={{ padding: '10px 14px', background: darkMode ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)', border: `1px solid ${border}` }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', color: textMuted, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Top Compradores</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: textPrimary, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{lead.buyer_triad_notes}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {/* Parse buyer names from triad notes: "A: Name | ..." */}
              {lead.buyer_triad_notes && lead.buyer_triad_notes.split('\n').map((line, i) => {
                const nameMatch = line.match(/^[ABC]:\s*([^|]+)/)
                const name = nameMatch ? nameMatch[1].trim() : null
                if (!name) return null
                const tplBody = `Bom dia, ${name}.\nFalo da Agency Group. Tenho neste momento um ativo off-market com perfil que pode encaixar no que procura: ${lead.nome}.\nTrabalhamos com total discrição. Faz sentido partilhar os detalhes consigo?`
                return (
                  <button key={`buyer-${i}`} type="button"
                    onClick={() => { navigator.clipboard.writeText(tplBody) }}
                    style={{ padding: '6px 14px', background: '#1c4a3522', border: '1px solid #1c4a3555', color: '#27ae60', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', cursor: 'pointer', letterSpacing: '.06em' }}>
                    📱 Buyer {['A','B','C'][i]} — {name.split(' ')[0]}
                  </button>
                )
              })}
              <button type="button"
                onClick={() => {
                  const tpl = `Bom dia, falo da Agency Group.\nTemos atualmente procura ativa para ativos com este perfil na sua zona.\nFaz sentido fazermos uma avaliação sem compromisso?`
                  navigator.clipboard.writeText(tpl)
                }}
                style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${border}`, color: '#4a90d9', fontFamily: "'DM Mono', monospace", fontSize: '.42rem', cursor: 'pointer' }}>
                📞 Seller
              </button>
              <button type="button"
                onClick={async () => {
                  try {
                    const r = await fetch(`/api/offmarket-leads/${lead.id}/match-buyers`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    })
                    if (r.ok) {
                      const d = await r.json()
                      onPatch({
                        matched_buyers_count:   d.total_matches,
                        best_buyer_match_score: d.best_match_score,
                        buyer_match_notes:      d.buyer_match_notes ?? null,
                        deal_priority_score:    d.deal_priority_score ?? null,
                        attack_recommendation:  d.attack_recommendation ?? null,
                        buyer_triad_notes:      d.buyer_triad_notes ?? null,
                        matched_to_buyers:      (d.total_matches ?? 0) > 0 && (d.best_match_score ?? 0) >= 60,
                      })
                    }
                  } catch { /* silent */ }
                }}
                style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${border}`, color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', cursor: 'pointer' }}>
                ↺ Re-Match
              </button>
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 14 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 10 }}>Ações Rápidas</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button"
              onClick={() => onPatch({ negotiation_status: 'offer_received', sla_contacted_at: new Date().toISOString(), deal_next_step: 'Confirmar proposta com vendedor', deal_next_step_date: new Date(Date.now() + 2 * 86400000).toISOString() })}
              style={{ padding: '8px 16px', background: '#4a90d918', border: '1px solid #4a90d955', color: '#4a90d9', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', cursor: 'pointer', letterSpacing: '.06em' }}>
              ✉️ Proposta Enviada
            </button>
            <button type="button"
              onClick={() => onPatch({ negotiation_status: 'terms_agreed', deal_next_step: 'Preparar minuta CPCV', deal_path: 'preclose', deal_next_step_date: new Date(Date.now() + 3 * 86400000).toISOString() })}
              style={{ padding: '8px 16px', background: '#9b59b618', border: '1px solid #9b59b655', color: '#9b59b6', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', cursor: 'pointer', letterSpacing: '.06em' }}>
              📄 CPCV em Preparação
            </button>
            <button type="button"
              onClick={() => onPatch({ cpcv_signed_at: new Date().toISOString(), deal_next_step: 'Preparar documentação escritura', deal_next_step_date: new Date(Date.now() + 7 * 86400000).toISOString() })}
              style={{ padding: '8px 16px', background: '#c9a96e18', border: '1px solid #c9a96e55', color: '#c9a96e', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', cursor: 'pointer', letterSpacing: '.06em' }}>
              ✅ CPCV Assinado
            </button>
            <button type="button"
              onClick={() => onPatch({ status: 'closed_won', escritura_done_at: new Date().toISOString(), deal_next_step: null })}
              style={{ padding: '8px 16px', background: '#27ae6018', border: '1px solid #27ae6055', color: '#27ae60', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', cursor: 'pointer', letterSpacing: '.06em' }}>
              🏆 Escritura Concluída
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ flex: 1, background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
            {saving ? 'A guardar...' : 'Guardar Deal'}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: '12px 20px', background: 'transparent', border: `1px solid ${border}`, color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.52rem', cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
