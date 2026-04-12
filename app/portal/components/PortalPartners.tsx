'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerTipo =
  | 'advogado' | 'notario' | 'contabilista' | 'gestor_patrimonio'
  | 'family_office' | 'banco' | 'fundo_investimento'
  | 'mediador_parceiro' | 'promotor' | 'outro'

type PartnerEstado = 'prospect' | 'contactado' | 'reuniao_feita' | 'parceiro_activo' | 'dormente' | 'inactivo'
type Prioridade = 'A' | 'B' | 'C'

interface InstitutionalPartner {
  id: string
  nome: string
  empresa: string | null
  tipo: PartnerTipo
  email: string | null
  phone: string | null
  linkedin_url: string | null
  cidade: string | null
  segmento: string | null
  ticket_medio: number | null
  origem: string | null
  estado: PartnerEstado
  nivel_prioridade: Prioridade
  last_contact_at: string | null
  next_followup_at: string | null
  contact_attempts: number
  deals_referidos: number
  volume_referido: number
  owner: string | null
  notes: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<PartnerTipo, string> = {
  advogado: 'Advogado',
  notario: 'Notário',
  contabilista: 'Contabilista',
  gestor_patrimonio: 'Gestor Patrimônio',
  family_office: 'Family Office',
  banco: 'Banco',
  fundo_investimento: 'Fundo Investimento',
  mediador_parceiro: 'Mediador Parceiro',
  promotor: 'Promotor',
  outro: 'Outro',
}

const ESTADO_LABELS: Record<PartnerEstado, string> = {
  prospect: 'Prospect',
  contactado: 'Contactado',
  reuniao_feita: 'Reunião Feita',
  parceiro_activo: 'Activo ✓',
  dormente: 'Dormente',
  inactivo: 'Inactivo',
}

const ESTADO_COLORS: Record<PartnerEstado, string> = {
  prospect: '#c9a96e',
  contactado: '#4a90d9',
  reuniao_feita: '#9b59b6',
  parceiro_activo: '#27ae60',
  dormente: '#95a5a6',
  inactivo: '#7f8c8d',
}

const PRIORIDADE_COLORS: Record<Prioridade, string> = {
  A: '#27ae60',
  B: '#f39c12',
  C: '#95a5a6',
}

const TIPO_OPTS = Object.keys(TIPO_LABELS) as PartnerTipo[]
const CIDADE_OPTS = ['Lisboa', 'Cascais', 'Porto', 'Algarve', 'Funchal', 'Ponta Delgada', 'Madrid', 'Barcelona', 'Outra']
const ORIGEM_OPTS = ['evento', 'referral', 'linkedin', 'cold_outreach', 'portal', 'conference', 'introducao_directa', 'outro']

// ─── WhatsApp Templates ────────────────────────────────────────────────────────

const WA_TEMPLATE = 'Bom dia. Trabalhamos com operações off-market e clientes qualificados. Se surgir algum ativo que beneficie de venda discreta, conseguimos estruturar e executar rapidamente. Faz sentido alinharmos?'

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PortalPartners() {
  const darkMode = useUIStore(s => s.darkMode)

  const [partners, setPartners] = useState<InstitutionalPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterTipo, setFilterTipo] = useState<string>('all')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [filterCidade, setFilterCidade] = useState<string>('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [newPartner, setNewPartner] = useState({
    nome: '', empresa: '', tipo: '' as PartnerTipo | '',
    email: '', phone: '', linkedin_url: '',
    cidade: '', segmento: '', ticket_medio: '',
    origem: '', nivel_prioridade: 'B' as Prioridade,
    owner: '', notes: '',
  })

  const bg = darkMode ? '#0a1510' : '#f4f0e6'
  const cardBg = darkMode ? '#0f1e16' : '#fff'
  const border = darkMode ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'
  const textPrimary = darkMode ? '#f4f0e6' : '#0e0e0d'
  const textMuted = darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.45)'

  const loadPartners = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterTipo !== 'all') params.set('tipo', filterTipo)
      if (filterEstado !== 'all') params.set('estado', filterEstado)
      if (filterCidade) params.set('cidade', filterCidade)

      const res = await fetch(`/api/institutional-partners?${params}`)
      if (res.ok) {
        const d = await res.json()
        setPartners(d.data ?? [])
      }
    } catch (e) {
      setError('Erro ao carregar parceiros.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterTipo, filterEstado, filterCidade])

  useEffect(() => { loadPartners() }, [loadPartners])

  async function handleCreate() {
    if (!newPartner.nome.trim()) { setSaveMsg('Nome é obrigatório'); return }
    if (!newPartner.tipo) { setSaveMsg('Tipo é obrigatório'); return }
    setSaving(true)
    setSaveMsg('')
    try {
      const payload = {
        nome: newPartner.nome.trim(),
        empresa: newPartner.empresa || null,
        tipo: newPartner.tipo,
        email: newPartner.email || null,
        phone: newPartner.phone || null,
        linkedin_url: newPartner.linkedin_url || null,
        cidade: newPartner.cidade || null,
        segmento: newPartner.segmento || null,
        ticket_medio: newPartner.ticket_medio ? parseFloat(newPartner.ticket_medio) * 1000 : null,
        origem: newPartner.origem || null,
        nivel_prioridade: newPartner.nivel_prioridade,
        owner: newPartner.owner || null,
        notes: newPartner.notes || null,
        estado: 'prospect',
      }
      const res = await fetch('/api/institutional-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveMsg(err.error || 'Erro ao criar parceiro')
      } else {
        setSaveMsg('Parceiro criado ✓')
        setShowNewForm(false)
        setNewPartner({ nome: '', empresa: '', tipo: '', email: '', phone: '', linkedin_url: '', cidade: '', segmento: '', ticket_medio: '', origem: '', nivel_prioridade: 'B', owner: '', notes: '' })
        loadPartners()
      }
    } catch {
      setSaveMsg('Erro de rede')
    } finally {
      setSaving(false)
    }
  }

  async function patchPartner(id: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/institutional-partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setPartners(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
      }
    } catch (e) { console.error(e) }
  }

  const selected = partners.find(p => p.id === selectedId) ?? null

  function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  function formatPrice(n: number | null): string {
    if (!n) return '—'
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `€${Math.round(n / 1_000)}K`
    return `€${n}`
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', marginBottom: 6 }}>
            Rede Institucional
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontSize: '1.8rem', fontWeight: 300, color: textPrimary, margin: 0 }}>
            Parceiros Institucionais
          </h1>
        </div>
        <button type="button" onClick={() => setShowNewForm(true)}
          style={{ background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '10px 22px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Novo Parceiro
        </button>
      </div>

      {/* Stats strip */}
      {partners.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
          {([
            ['Total', String(partners.length), '#c9a96e'],
            ['Activos', String(partners.filter(p => p.estado === 'parceiro_activo').length), '#27ae60'],
            ['Prioridade A', String(partners.filter(p => p.nivel_prioridade === 'A').length), '#27ae60'],
            ['Prospect', String(partners.filter(p => p.estado === 'prospect').length), '#f39c12'],
            ['Volume Ref.', `€${Math.round(partners.reduce((a, p) => a + (p.volume_referido || 0), 0) / 1_000_000 * 10) / 10}M`, '#c9a96e'],
          ] as [string, string, string][]).map(([label, value, color]) => (
            <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, padding: '14px 16px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.14em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', fontWeight: 300, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>
          <option value="all">Todos os Tipos</option>
          {TIPO_OPTS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>
          <option value="all">Todos os Estados</option>
          {(Object.keys(ESTADO_LABELS) as PartnerEstado[]).map(s => <option key={s} value={s}>{ESTADO_LABELS[s]}</option>)}
        </select>
        <select value={filterCidade} onChange={e => setFilterCidade(e.target.value)}
          style={{ padding: '7px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>
          <option value="">Todas as Cidades</option>
          {CIDADE_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={loadPartners}
          style={{ padding: '7px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', cursor: 'pointer' }}>
          ↻
        </button>
      </div>

      {/* Layout: List + Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 400px' : '1fr', gap: 12 }}>

        {/* List */}
        <div style={{ background: cardBg, border: `1px solid ${border}` }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: textMuted, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>A carregar...</div>}
          {error && <div style={{ padding: '20px', color: '#e74c3c', fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>{error}</div>}
          {!loading && !error && partners.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: textMuted }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', fontWeight: 300, marginBottom: 8 }}>Sem parceiros</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }}>Adicione o primeiro parceiro institucional</div>
            </div>
          )}
          {!loading && partners.map(partner => (
            <div
              key={partner.id}
              onClick={() => setSelectedId(partner.id === selectedId ? null : partner.id)}
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr auto auto auto',
                alignItems: 'center', gap: 12, padding: '12px 16px',
                borderBottom: `1px solid ${border}`, cursor: 'pointer',
                background: partner.id === selectedId ? (darkMode ? 'rgba(201,169,110,.08)' : 'rgba(28,74,53,.04)') : 'transparent',
                borderLeft: partner.id === selectedId ? '3px solid #c9a96e' : '3px solid transparent',
              }}
            >
              {/* Priority badge */}
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${PRIORIDADE_COLORS[partner.nivel_prioridade]}22`, border: `1px solid ${PRIORIDADE_COLORS[partner.nivel_prioridade]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: PRIORIDADE_COLORS[partner.nivel_prioridade], fontWeight: 600 }}>
                {partner.nivel_prioridade}
              </div>
              {/* Name + details */}
              <div>
                <div style={{ fontSize: '.85rem', color: textPrimary, fontWeight: 500, marginBottom: 2 }}>{partner.nome}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: textMuted, letterSpacing: '.04em' }}>
                  {[TIPO_LABELS[partner.tipo], partner.empresa, partner.cidade].filter(Boolean).join(' · ')}
                </div>
              </div>
              {/* Ticket */}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', color: '#c9a96e', letterSpacing: '.04em', minWidth: 50, textAlign: 'right' }}>
                {formatPrice(partner.ticket_medio)}
              </div>
              {/* Follow-up indicator */}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', color: partner.next_followup_at && new Date(partner.next_followup_at) < new Date() ? '#e74c3c' : textMuted }}>
                {partner.next_followup_at ? formatDate(partner.next_followup_at) : '—'}
              </div>
              {/* Status */}
              <div style={{ padding: '2px 7px', background: `${ESTADO_COLORS[partner.estado]}22`, border: `1px solid ${ESTADO_COLORS[partner.estado]}55`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.06em', color: ESTADO_COLORS[partner.estado], textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {ESTADO_LABELS[partner.estado]}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedId && selected && (
          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto' }}>
            <div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', fontWeight: 300, color: textPrimary, marginBottom: 2 }}>{selected.nome}</div>
              {selected.empresa && <div style={{ fontSize: '.82rem', color: textMuted }}>{selected.empresa}</div>}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', color: 'rgba(201,169,110,.7)', letterSpacing: '.08em', marginTop: 4 }}>{TIPO_LABELS[selected.tipo]}</div>
            </div>

            {/* Estado buttons */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Estado</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(Object.keys(ESTADO_LABELS) as PartnerEstado[]).map(s => (
                  <button key={s} type="button"
                    onClick={() => patchPartner(selected.id, { estado: s, last_contact_at: s !== 'prospect' ? new Date().toISOString() : null })}
                    style={{ padding: '4px 10px', background: selected.estado === s ? ESTADO_COLORS[s] : 'transparent', color: selected.estado === s ? '#fff' : textMuted, border: `1px solid ${ESTADO_COLORS[s]}66`, fontFamily: "'DM Mono', monospace", fontSize: '.42rem', cursor: 'pointer', transition: 'all .15s' }}>
                    {ESTADO_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                ['Email', selected.email],
                ['Telefone', selected.phone],
                ['Cidade', selected.cidade],
                ['Segmento', selected.segmento],
                ['Ticket Médio', formatPrice(selected.ticket_medio)],
                ['Deals Ref.', String(selected.deals_referidos)],
                ['Volume Ref.', formatPrice(selected.volume_referido)],
                ['Origem', selected.origem],
                ['Último Contacto', formatDate(selected.last_contact_at)],
                ['Follow-up', formatDate(selected.next_followup_at)],
                ['Tentativas', String(selected.contact_attempts)],
                ['Owner', selected.owner],
              ] as [string, string | null][]).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: '.8rem', color: textPrimary }}>{value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Follow-up setter */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Próximo Follow-up</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="date" defaultValue={selected.next_followup_at ? selected.next_followup_at.slice(0, 10) : ''}
                  id={`p-followup-${selected.id}`}
                  style={{ flex: 1, padding: '6px 10px', border: `1px solid ${border}`, background: cardBg, color: textPrimary, fontFamily: "'DM Mono', monospace", fontSize: '.52rem' }} />
                <button type="button"
                  onClick={() => {
                    const el = document.getElementById(`p-followup-${selected.id}`) as HTMLInputElement
                    if (el?.value) patchPartner(selected.id, { next_followup_at: `${el.value}T09:00:00.000Z` })
                  }}
                  style={{ padding: '6px 14px', background: '#1c4a35', color: '#f4f0e6', border: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', cursor: 'pointer' }}>
                  Definir
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Notas</div>
              <PartnerNoteEditor value={selected.notes || ''} darkMode={darkMode} cardBg={cardBg} border={border} textPrimary={textPrimary}
                onSave={(notes) => patchPartner(selected.id, { notes })} />
            </div>

            {/* WhatsApp + LinkedIn quick actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.phone && (
                <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}?text=${encodeURIComponent(WA_TEMPLATE)}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => patchPartner(selected.id, { last_contact_at: new Date().toISOString(), contact_attempts: selected.contact_attempts + 1 })}
                  style={{ flex: 1, textAlign: 'center', background: '#25d366', color: '#fff', padding: '10px', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  WhatsApp
                </a>
              )}
              {selected.linkedin_url && (
                <a href={selected.linkedin_url} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', background: '#0077b5', color: '#fff', padding: '10px', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  LinkedIn
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}?subject=Agency Group — Parceria Off-Market&body=${encodeURIComponent('Estamos neste momento a acompanhar clientes qualificados com interesse na sua zona. Operamos com discrição e foco em execução. Podemos avaliar sem compromisso.')}`}
                  style={{ flex: 1, textAlign: 'center', background: '#1c4a35', color: '#f4f0e6', padding: '10px', textDecoration: 'none', fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  Email
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Partner Modal */}
      {showNewForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,14,9,.7)', backdropFilter: 'blur(10px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewForm(false) }}>
          <div style={{ background: cardBg, border: `1px solid ${border}`, padding: '32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.4rem', fontWeight: 300, color: textPrimary }}>Novo Parceiro</div>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: textMuted }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {([
                ['Nome *', 'nome'],
                ['Empresa', 'empresa'],
                ['Email', 'email'],
                ['Telefone', 'phone'],
                ['LinkedIn URL', 'linkedin_url'],
                ['Ticket Médio (K€)', 'ticket_medio'],
                ['Owner / Advisor', 'owner'],
              ] as [string, keyof typeof newPartner][]).map(([label, field]) => (
                <div key={field} style={{ gridColumn: ['nome', 'linkedin_url'].includes(field) ? '1 / -1' : 'auto' }}>
                  <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <input type="text" value={newPartner[field] as string} onChange={e => setNewPartner(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              {([
                ['Tipo *', 'tipo', TIPO_OPTS.map(t => ({ v: t, l: TIPO_LABELS[t] }))],
                ['Cidade', 'cidade', CIDADE_OPTS.map(c => ({ v: c, l: c }))],
                ['Origem', 'origem', ORIGEM_OPTS.map(o => ({ v: o, l: o }))],
                ['Prioridade', 'nivel_prioridade', [{ v: 'A', l: 'A — Alto' }, { v: 'B', l: 'B — Médio' }, { v: 'C', l: 'C — Baixo' }]],
              ] as [string, keyof typeof newPartner, { v: string; l: string }[]][]).map(([label, field, opts]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                  <select value={newPartner[field] as string} onChange={e => setNewPartner(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem' }}>
                    <option value="">Selecionar...</option>
                    {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Notas</label>
              <textarea value={newPartner.notes} onChange={e => setNewPartner(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${border}`, background: darkMode ? '#0a1510' : '#fff', color: textPrimary, fontFamily: "'Jost', sans-serif", fontSize: '.82rem', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {saveMsg && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: saveMsg.includes('✓') ? '#27ae60' : '#e74c3c', marginBottom: 10 }}>{saveMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleCreate} disabled={saving}
                style={{ flex: 1, background: '#1c4a35', color: '#f4f0e6', border: 'none', padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                {saving ? 'A guardar...' : 'Criar Parceiro'}
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

function PartnerNoteEditor({ value, darkMode, cardBg, border, textPrimary, onSave }: {
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
          Guardar
        </button>
        {saved && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: '#27ae60', padding: '5px 0' }}>✓</span>}
      </div>
    </div>
  )
}
