'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { PORTAL_PROPERTIES } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type CollectionStatus = 'Activa' | 'Arquivada' | 'Partilhada'

interface CollectionProperty {
  id: string
  order: number
}

interface Collection {
  id: string
  name: string
  client: string
  nationality: string
  description: string
  coverColor: string
  propertyIds: CollectionProperty[]
  status: CollectionStatus
  createdAt: string
  updatedAt: string
  shareToken: string
  views: number
  lastViewedAt?: string
  shareDate?: string
}

type CollectionsTab = 'minhas' | 'editor' | 'partilhadas' | 'previa'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COVER_COLORS = [
  { id: 'green',  value: 'linear-gradient(135deg,#1c4a35 0%,#2d7a56 100%)', label: 'Verde AG' },
  { id: 'gold',   value: 'linear-gradient(135deg,#c9a96e 0%,#b8852a 100%)', label: 'Dourado' },
  { id: 'navy',   value: 'linear-gradient(135deg,#1a2744 0%,#2a3f6e 100%)', label: 'Azul Navy' },
  { id: 'black',  value: 'linear-gradient(135deg,#0e0e0d 0%,#2a2a28 100%)', label: 'Preto' },
  { id: 'slate',  value: 'linear-gradient(135deg,#334155 0%,#475569 100%)', label: 'Ardósia' },
  { id: 'copper', value: 'linear-gradient(135deg,#7c3d15 0%,#b25a1a 100%)', label: 'Cobre' },
]

const NATIONALITY_FLAGS: Record<string, string> = {
  'EUA': '🇺🇸', 'França': '🇫🇷', 'Reino Unido': '🇬🇧', 'China': '🇨🇳',
  'Brasil': '🇧🇷', 'Alemanha': '🇩🇪', 'EAU': '🇦🇪', 'Portugal': '🇵🇹',
  'Arábia Saudita': '🇸🇦', 'Suíça': '🇨🇭',
}

const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: 'col-1', name: 'Cascais Villas Premium', client: 'James Mitchell',
    nationality: 'EUA', description: 'Villas exclusivas Cascais · €2M–€4M · Piscina + Jardim + Vista Mar',
    coverColor: COVER_COLORS[0].value,
    propertyIds: [
      { id: 'AG-2026-020', order: 0 }, { id: 'AG-2026-021', order: 1 }, { id: 'AG-2026-070', order: 2 },
    ],
    status: 'Partilhada', createdAt: '2026-03-28', updatedAt: '2026-04-03',
    shareToken: 'jm-cascais-2026', views: 7, lastViewedAt: '2026-04-03T14:23:00Z',
    shareDate: '2026-04-01',
  },
  {
    id: 'col-2', name: 'Chiado Apartments Sélection', client: 'Pierre Dubois',
    nationality: 'França', description: 'Apartamentos históricos Lisboa · T3/T4 · Terraço · Vista',
    coverColor: COVER_COLORS[2].value,
    propertyIds: [
      { id: 'AG-2026-010', order: 0 }, { id: 'AG-2026-011', order: 1 }, { id: 'AG-2026-012', order: 2 },
    ],
    status: 'Partilhada', createdAt: '2026-04-01', updatedAt: '2026-04-04',
    shareToken: 'pd-chiado-2026', views: 12, lastViewedAt: '2026-04-04T09:11:00Z',
    shareDate: '2026-04-02',
  },
  {
    id: 'col-3', name: 'Algarve Golf & Sea', client: 'Sophie Hartmann',
    nationality: 'Alemanha', description: 'Villas golf resort Algarve · €3M+ · Vale do Lobo · Quinta do Lago',
    coverColor: COVER_COLORS[1].value,
    propertyIds: [
      { id: 'AG-2026-050', order: 0 }, { id: 'AG-2026-030', order: 1 },
    ],
    status: 'Activa', createdAt: '2026-04-02', updatedAt: '2026-04-02',
    shareToken: 'sh-algarve-2026', views: 0,
  },
  {
    id: 'col-4', name: 'Portfolio Multi-Activo', client: 'Khalid Al-Rashid',
    nationality: 'EAU', description: 'Activos diversificados · €12M total · Lisboa + Algarve + Comporta',
    coverColor: COVER_COLORS[3].value,
    propertyIds: [
      { id: 'AG-2026-030', order: 0 }, { id: 'AG-2026-050', order: 1 },
      { id: 'AG-2026-010', order: 2 }, { id: 'AG-2026-020', order: 3 },
    ],
    status: 'Activa', createdAt: '2026-03-20', updatedAt: '2026-04-01',
    shareToken: 'kar-portfolio-2026', views: 3, lastViewedAt: '2026-03-31T18:44:00Z',
  },
  {
    id: 'col-5', name: 'Madeira & Açores Rising', client: 'Charlotte Blake',
    nationality: 'Reino Unido', description: 'Ilhas atlânticas · Valorização 44% · Até €1.5M',
    coverColor: COVER_COLORS[4].value,
    propertyIds: [
      { id: 'AG-2026-060', order: 0 }, { id: 'AG-2026-040', order: 1 },
    ],
    status: 'Activa', createdAt: '2026-04-03', updatedAt: '2026-04-03',
    shareToken: 'cb-islands-2026', views: 0,
  },
  {
    id: 'col-6', name: 'Sintra Heritage Estates', client: 'Marco Aurelio Santos',
    nationality: 'Brasil', description: 'Quintas históricas Sintra · Natureza · Arquitectura única · €2M+',
    coverColor: COVER_COLORS[5].value,
    propertyIds: [
      { id: 'AG-2026-070', order: 0 }, { id: 'AG-2026-012', order: 1 },
    ],
    status: 'Arquivada', createdAt: '2026-02-10', updatedAt: '2026-03-01',
    shareToken: 'mas-sintra-2026', views: 5, lastViewedAt: '2026-03-02T11:30:00Z',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPreco(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toLocaleString('pt-PT', { minimumFractionDigits: v % 1_000_000 === 0 ? 0 : 1, maximumFractionDigits: 2 })}M`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`
  return `€${v}`
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (h < 1) return 'há poucos minutos'
  if (h < 24) return `há ${h} hora${h > 1 ? 's' : ''}`
  return `há ${d} dia${d > 1 ? 's' : ''}`
}

function getPropertyById(id: string) {
  return PORTAL_PROPERTIES.find(p => p.id === id)
}

function collectionTotalValue(col: Collection): number {
  return col.propertyIds.reduce((sum, cp) => {
    const p = getPropertyById(cp.id)
    return sum + (p?.preco ?? 0)
  }, 0)
}

function statusBadgeStyle(status: CollectionStatus): { bg: string; color: string; border: string } {
  if (status === 'Activa') return { bg: 'rgba(28,74,53,.12)', color: '#1c4a35', border: 'rgba(28,74,53,.3)' }
  if (status === 'Partilhada') return { bg: 'rgba(201,169,110,.15)', color: '#b8852a', border: 'rgba(201,169,110,.4)' }
  return { bg: 'rgba(14,14,13,.07)', color: 'rgba(14,14,13,.45)', border: 'rgba(14,14,13,.18)' }
}

function gradientBg(color: string): string {
  return color
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconShare = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconArchive = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
    <line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
)
const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
)
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconDrag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/>
    <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
    <circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>
  </svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconBell = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)
const IconRevoke = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
  </svg>
)
const IconCollection = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
  </svg>
)
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/>
  </svg>
)

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS: { id: CollectionsTab; label: string }[] = [
  { id: 'minhas', label: 'As Minhas Collections' },
  { id: 'editor', label: 'Editor de Collection' },
  { id: 'partilhadas', label: 'Partilhadas' },
  { id: 'previa', label: 'Prévia do Cliente' },
]

// ─── NewCollectionModal ────────────────────────────────────────────────────────

interface NewCollectionModalProps {
  onClose: () => void
  onCreate: (col: Collection) => void
}

function NewCollectionModal({ onClose, onCreate }: NewCollectionModalProps) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [nationality, setNationality] = useState('Portugal')
  const [description, setDescription] = useState('')
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0].value)

  function handleCreate() {
    if (!name.trim()) return
    const col: Collection = {
      id: `col-${Date.now()}`,
      name: name.trim(),
      client: client.trim() || 'Sem cliente',
      nationality,
      description: description.trim(),
      coverColor,
      propertyIds: [],
      status: 'Activa',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      shareToken: `ag-${Date.now()}`,
      views: 0,
    }
    onCreate(col)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,13,.6)', backdropFilter: 'blur(4px)' }} />
      <div className="p-card" style={{ position: 'relative', width: '100%', maxWidth: 520, zIndex: 1, padding: '2rem', border: '1px solid rgba(201,169,110,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.5rem', color: '#0e0e0d', fontWeight: 600 }}>
            Nova Collection
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.4)', padding: '4px' }}>
            <IconX />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="p-label">Nome da Collection</label>
            <input className="p-inp" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cascais Villas Premium" style={{ marginTop: '.35rem' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
            <div>
              <label className="p-label">Cliente</label>
              <input className="p-inp" value={client} onChange={e => setClient(e.target.value)} placeholder="Nome do cliente" style={{ marginTop: '.35rem' }} />
            </div>
            <div>
              <label className="p-label">Nacionalidade</label>
              <select className="p-sel" value={nationality} onChange={e => setNationality(e.target.value)} style={{ marginTop: '.35rem' }}>
                {Object.keys(NATIONALITY_FLAGS).map(n => <option key={n} value={n}>{NATIONALITY_FLAGS[n]} {n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="p-label">Descrição</label>
            <textarea className="p-inp" value={description} onChange={e => setDescription(e.target.value)} placeholder="Briefing rápido do cliente e critérios…" rows={2} style={{ marginTop: '.35rem', resize: 'vertical' }} />
          </div>
          <div>
            <label className="p-label">Cor de Capa</label>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
              {COVER_COLORS.map(c => (
                <button key={c.id} onClick={() => setCoverColor(c.value)} title={c.label}
                  style={{ width: 36, height: 36, borderRadius: 8, background: c.value, border: coverColor === c.value ? '2.5px solid #c9a96e' : '2px solid transparent', cursor: 'pointer', outline: 'none', flexShrink: 0 }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="p-btn" style={{ fontSize: '.8rem' }}>Cancelar</button>
          <button onClick={handleCreate} className="p-btn-gold" disabled={!name.trim()} style={{ fontSize: '.8rem', opacity: name.trim() ? 1 : .5 }}>
            Criar Collection
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CollectionCard ────────────────────────────────────────────────────────────

interface CollectionCardProps {
  col: Collection
  onView: (col: Collection) => void
  onEdit: (col: Collection) => void
  onShare: (col: Collection) => void
  onArchive: (id: string) => void
}

function CollectionCard({ col, onView, onEdit, onShare, onArchive }: CollectionCardProps) {
  const [hovered, setHovered] = useState(false)
  const status = col.status
  const bs = statusBadgeStyle(status)
  const total = collectionTotalValue(col)

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', borderRadius: 14, border: '1px solid rgba(14,14,13,.08)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: hovered ? '0 8px 32px rgba(14,14,13,.1)' : '0 2px 8px rgba(14,14,13,.05)',
        transition: 'box-shadow .2s, transform .2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Cover */}
      <div style={{ height: 110, background: gradientBg(col.coverColor), position: 'relative', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
          <span style={{ background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`, borderRadius: 20, padding: '2px 10px', fontSize: '.68rem', fontFamily: 'var(--font-dm-mono)', fontWeight: 500 }}>
            {status}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.25rem', color: '#fff', fontWeight: 600, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
          {col.name}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
        {/* Client */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <span style={{ fontSize: '1rem' }}>{NATIONALITY_FLAGS[col.nationality] ?? '🌍'}</span>
          <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600 }}>{col.client}</span>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)', marginLeft: 'auto' }}>{col.nationality}</span>
        </div>

        {/* Description */}
        {col.description && (
          <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: 'rgba(14,14,13,.55)', margin: 0, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {col.description}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <div style={{ background: 'rgba(14,14,13,.04)', borderRadius: 8, padding: '.35rem .6rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)' }}>IMÓVEIS</div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', color: '#0e0e0d', fontWeight: 600 }}>{col.propertyIds.length}</div>
          </div>
          <div style={{ background: 'rgba(201,169,110,.08)', borderRadius: 8, padding: '.35rem .6rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)' }}>VALOR TOTAL</div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(total)}</div>
          </div>
          {col.views > 0 && (
            <div style={{ background: 'rgba(28,74,53,.06)', borderRadius: 8, padding: '.35rem .6rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)' }}>VISTAS</div>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', color: '#1c4a35', fontWeight: 600 }}>{col.views}</div>
            </div>
          )}
        </div>

        {/* Dates */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '.35rem', borderTop: '1px solid rgba(14,14,13,.06)' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.35)' }}>
            Criada {fmtDate(col.createdAt)}
          </span>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.35)' }}>
            Actualizada {fmtDate(col.updatedAt)}
          </span>
        </div>

        {col.lastViewedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', background: 'rgba(201,169,110,.08)', borderRadius: 8, padding: '.4rem .6rem' }}>
            <IconBell />
            <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.76rem', color: '#b8852a' }}>
              Cliente abriu {timeAgo(col.lastViewedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '.75rem 1.25rem', borderTop: '1px solid rgba(14,14,13,.06)', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => onView(col)} className="p-btn" style={{ fontSize: '.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '.35rem', flex: 1 }}>
          <IconEye /> Ver
        </button>
        <button onClick={() => onShare(col)} className="p-btn" style={{ fontSize: '.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <IconShare />
        </button>
        <button onClick={() => onEdit(col)} className="p-btn" style={{ fontSize: '.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <IconEdit />
        </button>
        {col.status !== 'Arquivada' && (
          <button onClick={() => onArchive(col.id)} className="p-btn" style={{ fontSize: '.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '.35rem', color: 'rgba(14,14,13,.4)' }}>
            <IconArchive />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ShareLinkModal ────────────────────────────────────────────────────────────

function ShareLinkModal({ col, onClose }: { col: Collection; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `https://collections.agencygroup.pt/${col.shareToken}`

  function copy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,13,.6)', backdropFilter: 'blur(4px)' }} />
      <div className="p-card" style={{ position: 'relative', width: '100%', maxWidth: 480, zIndex: 1, padding: '2rem', border: '1px solid rgba(201,169,110,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.4rem', color: '#0e0e0d', fontWeight: 600 }}>Partilhar Collection</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}><IconX /></button>
        </div>
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: 'rgba(14,14,13,.6)', marginBottom: '1rem' }}>
          Partilhe este link exclusivo com <strong>{col.client}</strong>. Só pessoas com o link podem aceder.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', background: 'rgba(14,14,13,.04)', borderRadius: 10, padding: '.75rem 1rem', marginBottom: '1rem' }}>
          <IconLink />
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.78rem', color: '#0e0e0d', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</span>
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button onClick={copy} className="p-btn-gold" style={{ flex: 1, fontSize: '.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}>
            {copied ? <><IconCheck /> Copiado!</> : <><IconLink /> Copiar Link</>}
          </button>
          <button onClick={onClose} className="p-btn" style={{ fontSize: '.82rem' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: As Minhas Collections ────────────────────────────────────────────────

interface MinhasCollectionsProps {
  collections: Collection[]
  onNewCollection: () => void
  onView: (col: Collection) => void
  onEdit: (col: Collection) => void
  onShare: (col: Collection) => void
  onArchive: (id: string) => void
}

function MinhasCollections({ collections, onNewCollection, onView, onEdit, onShare, onArchive }: MinhasCollectionsProps) {
  const [filter, setFilter] = useState<'Todas' | CollectionStatus>('Todas')

  const filtered = filter === 'Todas' ? collections : collections.filter(c => c.status === filter)

  return (
    <div>
      {/* Filter Pills */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['Todas', 'Activa', 'Partilhada', 'Arquivada'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', padding: '5px 14px', borderRadius: 20,
              border: `1px solid ${filter === f ? '#1c4a35' : 'rgba(14,14,13,.15)'}`,
              background: filter === f ? '#1c4a35' : 'transparent',
              color: filter === f ? '#fff' : 'rgba(14,14,13,.55)', cursor: 'pointer',
            }}>
            {f === 'Todas' ? `Todas (${collections.length})` : f}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {filtered.map(col => (
          <CollectionCard key={col.id} col={col} onView={onView} onEdit={onEdit} onShare={onShare} onArchive={onArchive} />
        ))}

        {/* Add New Card */}
        <button onClick={onNewCollection}
          style={{
            background: 'rgba(201,169,110,.05)', borderRadius: 14,
            border: '1.5px dashed rgba(201,169,110,.4)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '.75rem', padding: '2.5rem', minHeight: 220, color: '#c9a96e',
            transition: 'background .2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,169,110,.05)')}
        >
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(201,169,110,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconPlus />
          </div>
          <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', fontWeight: 600 }}>Nova Collection</span>
          <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: 'rgba(14,14,13,.4)' }}>Criar portfólio personalizado</span>
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Editor de Collection ─────────────────────────────────────────────────

interface EditorCollectionProps {
  collections: Collection[]
  editingCol: Collection | null
  onSave: (col: Collection) => void
}

function EditorCollection({ collections, editingCol, onSave }: EditorCollectionProps) {
  const [name, setName] = useState(editingCol?.name ?? '')
  const [client, setClient] = useState(editingCol?.client ?? '')
  const [nationality, setNationality] = useState(editingCol?.nationality ?? 'Portugal')
  const [description, setDescription] = useState(editingCol?.description ?? '')
  const [coverColor, setCoverColor] = useState(editingCol?.coverColor ?? COVER_COLORS[0].value)
  const [selectedIds, setSelectedIds] = useState<string[]>(editingCol?.propertyIds.map(p => p.id) ?? [])
  const [linkPreview, setLinkPreview] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleProperty(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function removeProperty(id: string) {
    setSelectedIds(prev => prev.filter(i => i !== id))
  }

  function handleSave() {
    const col: Collection = {
      id: editingCol?.id ?? `col-${Date.now()}`,
      name: name.trim() || 'Nova Collection',
      client: client.trim() || 'Sem cliente',
      nationality,
      description: description.trim(),
      coverColor,
      propertyIds: selectedIds.map((id, order) => ({ id, order })),
      status: editingCol?.status ?? 'Activa',
      createdAt: editingCol?.createdAt ?? new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      shareToken: editingCol?.shareToken ?? `ag-${Date.now()}`,
      views: editingCol?.views ?? 0,
      lastViewedAt: editingCol?.lastViewedAt,
      shareDate: editingCol?.shareDate,
    }
    onSave(col)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectedProperties = selectedIds.map(id => getPropertyById(id)).filter(Boolean)
  const totalValue = selectedProperties.reduce((s, p) => s + (p?.preco ?? 0), 0)
  const shareUrl = `https://collections.agencygroup.pt/${editingCol?.shareToken ?? 'nova'}`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: '1.25rem', alignItems: 'start' }}>
      {/* Settings panel */}
      <div className="p-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: '#0e0e0d', fontWeight: 600, margin: 0 }}>Configurações</h3>

        <div>
          <label className="p-label">Nome</label>
          <input className="p-inp" value={name} onChange={e => setName(e.target.value)} placeholder="Nome da collection" style={{ marginTop: '.35rem' }} />
        </div>
        <div>
          <label className="p-label">Cliente</label>
          <input className="p-inp" value={client} onChange={e => setClient(e.target.value)} placeholder="Nome do cliente" style={{ marginTop: '.35rem' }} />
        </div>
        <div>
          <label className="p-label">Nacionalidade</label>
          <select className="p-sel" value={nationality} onChange={e => setNationality(e.target.value)} style={{ marginTop: '.35rem' }}>
            {Object.keys(NATIONALITY_FLAGS).map(n => <option key={n} value={n}>{NATIONALITY_FLAGS[n]} {n}</option>)}
          </select>
        </div>
        <div>
          <label className="p-label">Descrição</label>
          <textarea className="p-inp" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Critérios e notas…" style={{ marginTop: '.35rem', resize: 'vertical' }} />
        </div>
        <div>
          <label className="p-label">Cor de Capa</label>
          <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
            {COVER_COLORS.map(c => (
              <button key={c.id} onClick={() => setCoverColor(c.value)} title={c.label}
                style={{ width: 32, height: 32, borderRadius: 6, background: c.value, border: coverColor === c.value ? '2.5px solid #c9a96e' : '2px solid transparent', cursor: 'pointer', outline: 'none' }} />
            ))}
          </div>
        </div>

        {/* Preview cover */}
        <div style={{ height: 80, borderRadius: 10, background: coverColor, display: 'flex', alignItems: 'flex-end', padding: '.75rem', marginTop: '.25rem' }}>
          <span style={{ fontFamily: 'var(--font-cormorant)', color: '#fff', fontSize: '.95rem', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.5)', lineHeight: 1.2 }}>{name || 'Nome da Collection'}</span>
        </div>

        <button onClick={handleSave} className="p-btn-gold" style={{ fontSize: '.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem', marginTop: '.25rem' }}>
          {saved ? <><IconCheck /> Guardado!</> : 'Guardar Collection'}
        </button>
      </div>

      {/* Property grid */}
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: '#0e0e0d', fontWeight: 600, margin: '0 0 .25rem' }}>
            Seleccionar Imóveis
          </h3>
          <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', color: 'rgba(14,14,13,.5)', margin: 0 }}>
            {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''} · Clique para adicionar
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '.75rem' }}>
          {PORTAL_PROPERTIES.map(p => {
            const isSelected = selectedIds.includes(p.id)
            const gradients: Record<string, string> = {
              'Lisboa': 'linear-gradient(135deg,#1c4a35 0%,#2d6a50 100%)',
              'Cascais': 'linear-gradient(135deg,#1a3a5c 0%,#2a5a8c 100%)',
              'Algarve': 'linear-gradient(135deg,#7c3d15 0%,#c9610a 100%)',
              'Porto': 'linear-gradient(135deg,#4a1a6a 0%,#7a2a9a 100%)',
              'Madeira': 'linear-gradient(135deg,#1a4a3c 0%,#2a7a5a 100%)',
              'Comporta': 'linear-gradient(135deg,#5a4a15 0%,#8a7a2a 100%)',
              'Sintra': 'linear-gradient(135deg,#2a3a4a 0%,#3a5a7a 100%)',
            }
            const grad = gradients[p.zona] ?? 'linear-gradient(135deg,#334155 0%,#475569 100%)'

            return (
              <div key={p.id} onClick={() => toggleProperty(p.id)}
                style={{
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                  border: isSelected ? '2px solid #c9a96e' : '1.5px solid rgba(14,14,13,.08)',
                  boxShadow: isSelected ? '0 0 0 3px rgba(201,169,110,.2)' : 'none',
                  background: '#fff', position: 'relative', transition: 'all .15s',
                }}
              >
                <div style={{ height: 80, background: grad, position: 'relative' }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(255,255,255,.8)', position: 'absolute', bottom: '.4rem', left: '.5rem' }}>{p.zona}</span>
                  {isSelected && (
                    <div style={{ position: 'absolute', top: '.35rem', right: '.35rem', width: 20, height: 20, borderRadius: '50%', background: '#c9a96e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck />
                    </div>
                  )}
                </div>
                <div style={{ padding: '.6rem .75rem' }}>
                  <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: '#0e0e0d', fontWeight: 600, lineHeight: 1.3, marginBottom: '.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nome}
                  </div>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '.95rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(p.preco)}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginTop: '.15rem' }}>T{p.quartos} · {p.area}m²</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected list */}
      <div style={{ position: 'sticky', top: '1rem' }}>
        <div className="p-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: '#0e0e0d', fontWeight: 600, margin: '0 0 1rem' }}>
            Collection ({selectedIds.length})
          </h3>

          {selectedIds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(14,14,13,.35)' }}>
              <IconCollection />
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', marginTop: '.5rem' }}>Seleccione imóveis da grelha</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem' }}>
              {selectedIds.map((id, idx) => {
                const p = getPropertyById(id)
                if (!p) return null
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .6rem', background: 'rgba(14,14,13,.03)', borderRadius: 8, border: '1px solid rgba(14,14,13,.07)' }}>
                    <div style={{ color: 'rgba(14,14,13,.3)', cursor: 'grab', flexShrink: 0 }}><IconDrag /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.76rem', color: '#0e0e0d', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                      <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '.88rem', color: '#c9a96e' }}>{fmtPreco(p.preco)}</div>
                    </div>
                    <button onClick={() => removeProperty(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.35)', padding: '2px', flexShrink: 0 }}>
                      <IconX />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(14,14,13,.08)', paddingTop: '.75rem', marginTop: '.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(14,14,13,.45)' }}>VALOR TOTAL</span>
                <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(totalValue)}</span>
              </div>
            </div>
          )}

          <button onClick={() => setLinkPreview(!linkPreview)} className="p-btn-gold" style={{ width: '100%', fontSize: '.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.4rem' }}>
            <IconShare /> Partilhar Collection
          </button>

          {linkPreview && (
            <div style={{ marginTop: '1rem', padding: '.75rem', background: 'rgba(28,74,53,.06)', borderRadius: 8, border: '1px solid rgba(28,74,53,.2)' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.45)', marginBottom: '.3rem' }}>LINK PARTILHÁVEL</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: '#1c4a35', wordBreak: 'break-all' }}>{shareUrl}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Partilhadas ──────────────────────────────────────────────────────────

function Partilhadas({ collections, onRevoke }: { collections: Collection[]; onRevoke: (id: string) => void }) {
  const shared = collections.filter(c => c.status === 'Partilhada')

  return (
    <div>
      {/* Notification banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.3)', borderRadius: 10, padding: '.75rem 1rem', marginBottom: '1.5rem' }}>
        <div style={{ color: '#c9a96e', flexShrink: 0 }}><IconBell /></div>
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.84rem', color: '#b8852a', margin: 0 }}>
          <strong>James Mitchell</strong> abriu a collection "Cascais Villas Premium" <strong>há 2 horas</strong> — boa altura para fazer follow-up.
        </p>
      </div>

      {shared.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(14,14,13,.35)' }}>
          <IconShare />
          <p style={{ fontFamily: 'var(--font-jost)', marginTop: '1rem' }}>Nenhuma collection partilhada ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {shared.map(col => {
            const total = collectionTotalValue(col)
            const shareUrl = `https://collections.agencygroup.pt/${col.shareToken}`

            return (
              <div key={col.id} className="p-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                {/* Cover mini */}
                <div style={{ width: 72, height: 56, borderRadius: 8, background: gradientBg(col.coverColor), flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: '.35rem .45rem' }}>
                  <span style={{ fontFamily: 'var(--font-cormorant)', color: '#fff', fontSize: '.72rem', fontWeight: 600, lineHeight: 1.2, textShadow: '0 1px 3px rgba(0,0,0,.5)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{col.name}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                    <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: '#0e0e0d', fontWeight: 600 }}>{col.name}</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.4)' }}>·</span>
                    <span style={{ fontSize: '.85rem' }}>{NATIONALITY_FLAGS[col.nationality] ?? '🌍'}</span>
                    <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: 'rgba(14,14,13,.6)' }}>{col.client}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)', wordBreak: 'break-all', marginBottom: '.4rem' }}>{shareUrl}</div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)' }}>
                      Partilhado: {col.shareDate ? fmtDate(col.shareDate) : '—'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: '#1c4a35', fontWeight: 600 }}>
                      Link visitado {col.views} {col.views === 1 ? 'vez' : 'vezes'}
                    </span>
                    {col.lastViewedAt && (
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: '#c9a96e' }}>
                        Última visita: {timeAgo(col.lastViewedAt)}
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.45)' }}>
                      {col.propertyIds.length} imóveis · {fmtPreco(total)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0 }}>
                  <button className="p-btn" style={{ fontSize: '.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                    <IconEye /> Ver
                  </button>
                  <button onClick={() => onRevoke(col.id)} className="p-btn" style={{ fontSize: '.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '.35rem', color: '#c0392b', borderColor: 'rgba(192,57,43,.3)' }}>
                    <IconRevoke />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Prévia do Cliente ────────────────────────────────────────────────────

function PreviaCliente({ collections }: { collections: Collection[] }) {
  const [selectedColId, setSelectedColId] = useState<string>(collections[0]?.id ?? '')
  const col = collections.find(c => c.id === selectedColId) ?? collections[0]

  if (!col) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(14,14,13,.4)' }}>
      <p style={{ fontFamily: 'var(--font-jost)' }}>Nenhuma collection disponível para prévia.</p>
    </div>
  )

  const properties = col.propertyIds
    .sort((a, b) => a.order - b.order)
    .map(cp => getPropertyById(cp.id))
    .filter(Boolean)

  const gradients: Record<string, string> = {
    'Lisboa': 'linear-gradient(135deg,#0f2318 0%,#1a3d28 100%)',
    'Cascais': 'linear-gradient(135deg,#0f1e35 0%,#1a3560 100%)',
    'Algarve': 'linear-gradient(135deg,#3d1a05 0%,#6a300a 100%)',
    'Porto': 'linear-gradient(135deg,#200f35 0%,#3a1a55 100%)',
    'Madeira': 'linear-gradient(135deg,#0a2015 0%,#153525 100%)',
    'Comporta': 'linear-gradient(135deg,#28200a 0%,#3d3015 100%)',
    'Sintra': 'linear-gradient(135deg,#101520 0%,#1a2535 100%)',
  }

  return (
    <div>
      {/* Collection Selector */}
      <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {collections.map(c => (
          <button key={c.id} onClick={() => setSelectedColId(c.id)}
            style={{
              fontFamily: 'var(--font-jost)', fontSize: '.82rem', padding: '6px 16px', borderRadius: 20,
              border: `1px solid ${selectedColId === c.id ? '#c9a96e' : 'rgba(14,14,13,.15)'}`,
              background: selectedColId === c.id ? 'rgba(201,169,110,.12)' : 'transparent',
              color: selectedColId === c.id ? '#b8852a' : 'rgba(14,14,13,.55)', cursor: 'pointer',
            }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Client View */}
      <div style={{ background: '#1c4a35', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(201,169,110,.2)' }}>
        {/* Banner */}
        <div style={{ background: 'rgba(201,169,110,.15)', borderBottom: '1px solid rgba(201,169,110,.2)', padding: '.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <IconEye />
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: '#c9a96e' }}>
            Está a visualizar como cliente — {col.client} {NATIONALITY_FLAGS[col.nationality] ?? ''}
          </span>
        </div>

        {/* Header */}
        <div style={{ padding: '2.5rem 2rem 1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(201,169,110,.7)', letterSpacing: '.12em', marginBottom: '.5rem' }}>
            AGENCY GROUP · COLECÇÃO EXCLUSIVA
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '2.2rem', color: '#fff', fontWeight: 600, margin: '0 0 .5rem' }}>
            {col.name}
          </h2>
          <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: 'rgba(255,255,255,.6)', margin: '0 0 .25rem' }}>
            {col.description}
          </p>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(201,169,110,.7)', marginTop: '.5rem' }}>
            {properties.length} imóveis seleccionados para si
          </div>
        </div>

        {/* Property Cards */}
        <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {properties.map(p => {
            if (!p) return null
            const grad = gradients[p.zona] ?? 'linear-gradient(135deg,#1a2a3a 0%,#2a3a4a 100%)'
            return (
              <div key={p.id}
                style={{ background: 'rgba(255,255,255,.05)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(201,169,110,.15)', backdropFilter: 'blur(8px)' }}>
                {/* Photo placeholder */}
                <div style={{ height: 160, background: grad, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '1rem' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(255,255,255,.6)', display: 'block', marginBottom: '.2rem' }}>{p.zona} · {p.bairro}</span>
                    <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.6rem', color: '#c9a96e', fontWeight: 600, display: 'block' }}>{fmtPreco(p.preco)}</span>
                  </div>
                  {p.badge && (
                    <div style={{ position: 'absolute', top: '.75rem', right: '.75rem', background: 'rgba(201,169,110,.9)', borderRadius: 20, padding: '2px 10px' }}>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: '#fff' }}>{p.badge}</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: '.9rem 1rem' }}>
                  <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.88rem', color: '#fff', fontWeight: 600, marginBottom: '.4rem', lineHeight: 1.3 }}>{p.nome}</div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(255,255,255,.5)' }}>T{p.quartos}</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(255,255,255,.5)' }}>{p.area}m²</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(255,255,255,.5)' }}>€{Math.round(p.preco / p.area).toLocaleString('pt-PT')}/m²</span>
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
                    {p.piscina && <span style={{ background: 'rgba(201,169,110,.15)', color: '#c9a96e', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem' }}>Piscina</span>}
                    {p.jardim && <span style={{ background: 'rgba(201,169,110,.15)', color: '#c9a96e', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem' }}>Jardim</span>}
                    {p.terraco && <span style={{ background: 'rgba(201,169,110,.15)', color: '#c9a96e', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem' }}>Terraço</span>}
                    {p.garagem && <span style={{ background: 'rgba(201,169,110,.15)', color: '#c9a96e', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem' }}>Garagem</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer / CTA */}
        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1rem', color: 'rgba(255,255,255,.7)' }}>Agency Group · AMI 22506</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(255,255,255,.4)' }}>geral@agencygroup.pt · +351 910 000 000</div>
          </div>
          <button className="p-btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem', padding: '10px 20px' }}>
            <IconPhone /> Contactar Consultor
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PortalCollections() {
  const [tab, setTab] = useState<CollectionsTab>('minhas')
  const [collections, setCollections] = useState<Collection[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLLECTIONS
    try {
      const stored = localStorage.getItem('ag_collections')
      return stored ? (JSON.parse(stored) as Collection[]) : DEFAULT_COLLECTIONS
    } catch {
      return DEFAULT_COLLECTIONS
    }
  })
  const [showNewModal, setShowNewModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareTarget, setShareTarget] = useState<Collection | null>(null)
  const [editingCol, setEditingCol] = useState<Collection | null>(null)

  useEffect(() => {
    try { localStorage.setItem('ag_collections', JSON.stringify(collections)) } catch { /* ignore */ }
  }, [collections])

  const handleCreateCollection = useCallback((col: Collection) => {
    setCollections(prev => [col, ...prev])
    setShowNewModal(false)
    setTab('editor')
    setEditingCol(col)
  }, [])

  const handleSaveCollection = useCallback((col: Collection) => {
    setCollections(prev => {
      const idx = prev.findIndex(c => c.id === col.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = col; return n }
      return [col, ...prev]
    })
  }, [])

  const handleArchive = useCallback((id: string) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, status: 'Arquivada' as CollectionStatus } : c))
  }, [])

  const handleShare = useCallback((col: Collection) => {
    setShareTarget(col)
    setShowShareModal(true)
    setCollections(prev => prev.map(c => c.id === col.id ? { ...c, status: 'Partilhada' as CollectionStatus, shareDate: new Date().toISOString().split('T')[0] } : c))
  }, [])

  const handleView = useCallback((col: Collection) => {
    setEditingCol(col)
    setTab('editor')
  }, [])

  const handleEdit = useCallback((col: Collection) => {
    setEditingCol(col)
    setTab('editor')
  }, [])

  const handleRevoke = useCallback((id: string) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, status: 'Activa' as CollectionStatus } : c))
  }, [])

  const activeCount = collections.filter(c => c.status === 'Activa').length
  const sharedCount = collections.filter(c => c.status === 'Partilhada').length
  const totalViews = collections.reduce((s, c) => s + c.views, 0)

  return (
    <div style={{ padding: '0 0 3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '2rem', color: '#0e0e0d', fontWeight: 600, margin: '0 0 .25rem' }}>
            Collections
          </h1>
          <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: 'rgba(14,14,13,.5)', margin: 0 }}>
            Portfólios exclusivos para clientes seleccionados
          </p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="p-btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
          <IconPlus /> Nova Collection
        </button>
      </div>

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '.75rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Collections', value: collections.length, color: '#0e0e0d' },
          { label: 'Activas', value: activeCount, color: '#1c4a35' },
          { label: 'Partilhadas', value: sharedCount, color: '#c9a96e' },
          { label: 'Visualizações', value: totalViews, color: '#3a7bd5' },
        ].map(s => (
          <div key={s.label} className="p-card" style={{ padding: '.9rem 1rem' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.2rem' }}>{s.label.toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.8rem', color: s.color, fontWeight: 600, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '1.75rem', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              fontFamily: 'var(--font-jost)', fontSize: '.875rem', padding: '.75rem 1.25rem',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              color: tab === t.id ? '#1c4a35' : 'rgba(14,14,13,.45)',
              borderBottom: tab === t.id ? '2px solid #1c4a35' : '2px solid transparent',
              fontWeight: tab === t.id ? 600 : 400, marginBottom: '-1px',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'minhas' && (
        <MinhasCollections
          collections={collections}
          onNewCollection={() => setShowNewModal(true)}
          onView={handleView}
          onEdit={handleEdit}
          onShare={handleShare}
          onArchive={handleArchive}
        />
      )}
      {tab === 'editor' && (
        <EditorCollection collections={collections} editingCol={editingCol} onSave={handleSaveCollection} />
      )}
      {tab === 'partilhadas' && (
        <Partilhadas collections={collections} onRevoke={handleRevoke} />
      )}
      {tab === 'previa' && (
        <PreviaCliente collections={collections} />
      )}

      {/* Modals */}
      {showNewModal && (
        <NewCollectionModal onClose={() => setShowNewModal(false)} onCreate={handleCreateCollection} />
      )}
      {showShareModal && shareTarget && (
        <ShareLinkModal col={shareTarget} onClose={() => { setShowShareModal(false); setShareTarget(null) }} />
      )}
    </div>
  )
}
