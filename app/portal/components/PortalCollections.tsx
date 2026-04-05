'use client'
import { useState, useCallback } from 'react'
import { PORTAL_PROPERTIES } from './constants'
import { useCRMStore } from '../stores/crmStore'
import { exportToPDF } from './utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collection {
  id: string
  name: string
  description: string
  emoji: string
  color: string
  propertyIds: string[]
  contactId?: number
  createdAt: string
  shareToken: string
  isPublic: boolean
  views: number
  lastViewed?: string
  tags: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: 'col-1',
    name: 'Top Picks para James Mitchell',
    description: 'Villas premium Cascais · Budget €2-3M · Piscina + Jardim',
    emoji: '🏰',
    color: '#c9a96e',
    propertyIds: ['AG-2026-020', 'AG-2026-021', 'AG-2026-070'],
    contactId: 1,
    createdAt: '2026-04-01',
    shareToken: 'jm2026villa',
    isPublic: true,
    views: 7,
    lastViewed: '2026-04-03',
    tags: ['Villa', 'Cascais', 'VIP'],
  },
  {
    id: 'col-2',
    name: 'Lisboa Premium — Marie-Claire',
    description: 'Apartamentos históricos Lisboa · T3/T4 · Vista · Terraço',
    emoji: '🏛️',
    color: '#1c4a35',
    propertyIds: ['AG-2026-010', 'AG-2026-011', 'AG-2026-012'],
    contactId: 2,
    createdAt: '2026-04-02',
    shareToken: 'mc2026lisboa',
    isPublic: true,
    views: 12,
    lastViewed: '2026-04-04',
    tags: ['Lisboa', 'Apartamento', 'NHR'],
  },
  {
    id: 'col-3',
    name: 'Portfolio Khalid — Multi-Asset',
    description: 'Activos premium diversificados · €15M total · Algarve + Comporta + Lisboa',
    emoji: '💼',
    color: '#0c1f15',
    propertyIds: ['AG-2026-030', 'AG-2026-050', 'AG-2026-010'],
    contactId: 4,
    createdAt: '2026-03-28',
    shareToken: 'km2026portfolio',
    isPublic: false,
    views: 3,
    tags: ['Portfolio', 'Family Office', 'Off-Market'],
  },
  {
    id: 'col-4',
    name: 'Best Value Portugal 2026',
    description: 'Melhor ROI potencial · Yield + Valorização · Análise AG',
    emoji: '📈',
    color: '#3a7bd5',
    propertyIds: ['AG-2026-040', 'AG-2026-060', 'AG-2026-021'],
    contactId: undefined,
    createdAt: '2026-03-15',
    shareToken: 'ag2026value',
    isPublic: true,
    views: 34,
    tags: ['Investimento', 'Yield', 'Top Pick'],
  },
]

const EMOJI_OPTIONS = ['🏰', '🏛️', '💼', '📈', '🌊', '🌿', '🏖️', '🏡', '💎', '🔑']
const COLOR_OPTIONS = [
  { label: 'Gold', value: '#c9a96e' },
  { label: 'Green', value: '#1c4a35' },
  { label: 'Dark', value: '#0c1f15' },
  { label: 'Blue', value: '#3a7bd5' },
  { label: 'Slate', value: '#4a5568' },
]

const BADGE_COLOR: Record<string, string> = {
  'Destaque': '#c9a96e',
  'Off-Market': '#1c4a35',
  'Exclusivo': '#7c3aed',
  'Novo': '#0ea5e9',
}

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(14,14,13,0.55)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: '14px',
    padding: '28px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '88vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 60px rgba(14,14,13,0.18)',
  },
  modalLg: {
    background: '#f4f0e6',
    borderRadius: '14px',
    padding: '0',
    maxWidth: '860px',
    width: '100%',
    maxHeight: '92vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 60px rgba(14,14,13,0.22)',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalCollections() {
  const { crmContacts } = useCRMStore()

  const [collections, setCollections] = useState<Collection[]>(DEFAULT_COLLECTIONS)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showPropertySelector, setShowPropertySelector] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Partial<Collection>[] | null>(null)
  const [tagInput, setTagInput] = useState('')

  // Create form state
  const emptyForm = {
    name: '',
    description: '',
    emoji: '🏡',
    color: '#c9a96e',
    contactId: undefined as number | undefined,
    propertyIds: [] as string[],
    tags: [] as string[],
    isPublic: true,
  }
  const [form, setForm] = useState({ ...emptyForm })

  // Edit form state (inline within collection card)
  const [editForm, setEditForm] = useState<Partial<Collection>>({})

  const openCollection = useCallback((id: string) => {
    setCollections(prev =>
      prev.map(c => c.id === id ? { ...c, views: c.views + 1, lastViewed: '2026-04-05' } : c)
    )
    setOpenId(id)
  }, [])

  const activeCollection = collections.find(c => c.id === openId)

  const removePropertyFromCollection = useCallback((colId: string, propId: string) => {
    setCollections(prev =>
      prev.map(c => c.id === colId ? { ...c, propertyIds: c.propertyIds.filter(p => p !== propId) } : c)
    )
  }, [])

  const addPropertyToCollection = useCallback((colId: string, propId: string) => {
    setCollections(prev =>
      prev.map(c => c.id === colId
        ? { ...c, propertyIds: c.propertyIds.includes(propId) ? c.propertyIds : [...c.propertyIds, propId] }
        : c
      )
    )
  }, [])

  const togglePublic = useCallback((colId: string) => {
    setCollections(prev =>
      prev.map(c => c.id === colId ? { ...c, isPublic: !c.isPublic } : c)
    )
  }, [])

  const deleteCollection = useCallback((colId: string) => {
    setCollections(prev => prev.filter(c => c.id !== colId))
    if (openId === colId) setOpenId(null)
  }, [openId])

  const copyShareLink = useCallback((token: string) => {
    const url = `https://agencygroup.pt/collections/${token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }, [])

  const createCollection = useCallback(() => {
    if (!form.name.trim()) return
    const newCol: Collection = {
      id: `col-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      emoji: form.emoji,
      color: form.color,
      propertyIds: form.propertyIds,
      contactId: form.contactId,
      createdAt: '2026-04-05',
      shareToken: form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20) + Date.now().toString(36),
      isPublic: form.isPublic,
      views: 0,
      tags: form.tags,
    }
    setCollections(prev => [newCol, ...prev])
    setForm({ ...emptyForm })
    setTagInput('')
    setShowCreate(false)
  }, [form, emptyForm])

  const saveEdit = useCallback((colId: string) => {
    setCollections(prev => prev.map(c => c.id === colId ? { ...c, ...editForm } : c))
    setEditId(null)
    setEditForm({})
  }, [editForm])

  const startEdit = useCallback((col: Collection) => {
    setEditId(col.id)
    setEditForm({
      name: col.name,
      description: col.description,
      emoji: col.emoji,
      color: col.color,
      tags: [...col.tags],
      isPublic: col.isPublic,
    })
  }, [])

  const handleAISuggest = useCallback(async () => {
    setAiLoading(true)
    setAiSuggestions(null)
    try {
      const res = await fetch('/api/collections/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: crmContacts, properties: PORTAL_PROPERTIES }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiSuggestions(data.suggestions || [])
      } else {
        // Fallback mock suggestions
        setAiSuggestions([
          {
            name: 'Seleção Sophie Weber — Porto Investment',
            description: 'Apartamentos Porto Foz · Yield 4%+ · T3 · Budget €1.2M',
            emoji: '🏖️',
            color: '#3a7bd5',
            propertyIds: ['AG-2026-040'],
            contactId: 5,
            tags: ['Porto', 'Investimento', 'Arrendamento'],
            isPublic: false,
          },
          {
            name: 'Carlos Ferreira — HPP Urgente',
            description: 'Moradias Cascais + Sintra · Crédito aprovado · Budget €900K',
            emoji: '🔑',
            color: '#4a5568',
            propertyIds: ['AG-2026-021', 'AG-2026-070'],
            contactId: 3,
            tags: ['HPP', 'Cascais', 'Urgente'],
            isPublic: false,
          },
        ])
      }
    } catch {
      setAiSuggestions([
        {
          name: 'Seleção Sophie Weber — Porto Investment',
          description: 'Apartamentos Porto Foz · Yield 4%+ · T3 · Budget €1.2M',
          emoji: '🏖️',
          color: '#3a7bd5',
          propertyIds: ['AG-2026-040'],
          contactId: 5,
          tags: ['Porto', 'Investimento', 'Arrendamento'],
          isPublic: false,
        },
      ])
    } finally {
      setAiLoading(false)
    }
  }, [crmContacts])

  const applyAISuggestion = useCallback((s: Partial<Collection>) => {
    setForm({
      name: s.name || '',
      description: s.description || '',
      emoji: s.emoji || '🏡',
      color: s.color || '#c9a96e',
      contactId: s.contactId,
      propertyIds: s.propertyIds || [],
      tags: s.tags || [],
      isPublic: s.isPublic ?? false,
    })
    setAiSuggestions(null)
    setShowCreate(true)
  }, [])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalProps = collections.reduce((acc, c) => acc + c.propertyIds.length, 0)
  const totalViews = collections.reduce((acc, c) => acc + c.views, 0)
  const publicShares = collections.filter(c => c.isPublic).length

  const contactName = (id?: number) => {
    if (!id) return null
    return crmContacts.find(c => c.id === id)?.name || null
  }

  const getPropertiesForCollection = (col: Collection) =>
    PORTAL_PROPERTIES.filter(p => col.propertyIds.includes(p.id))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Jost',sans-serif", color: '#0e0e0d', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              Collections <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>IA</em>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'rgba(14,14,13,0.55)', fontFamily: "'DM Mono',monospace" }}>
              Boards curados · Partilha com clientes · Tracking views
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleAISuggest}
              disabled={aiLoading}
              style={{
                background: aiLoading ? 'rgba(201,169,110,0.4)' : '#c9a96e',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '0.82rem',
                fontFamily: "'Jost',sans-serif",
                fontWeight: 600,
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {aiLoading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> A analisar...
                </>
              ) : '✨ IA Suggest Collection'}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: '#1c4a35',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '0.82rem',
                fontFamily: "'Jost',sans-serif",
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Nova Collection
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Collections', value: collections.length, icon: '🗂️' },
          { label: 'Imóveis guardados', value: totalProps, icon: '🏠' },
          { label: 'Views totais', value: totalViews, icon: '👁️' },
          { label: 'Shares activos', value: publicShares, icon: '🔗' },
        ].map(k => (
          <div key={k.label} style={{
            background: '#fff',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 4px rgba(14,14,13,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '1.4rem' }}>{k.icon}</span>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(14,14,13,0.5)', marginTop: '2px' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── AI Suggestions Banner ── */}
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg,rgba(201,169,110,0.12),rgba(28,74,53,0.08))',
          border: '1px solid rgba(201,169,110,0.3)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              ✨ Sugestões IA — {aiSuggestions.length} colecção{aiSuggestions.length !== 1 ? 'ões' : ''} identificada{aiSuggestions.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => setAiSuggestions(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'rgba(14,14,13,0.4)' }}
            >✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {aiSuggestions.map((s, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.4rem' }}>{s.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.77rem', color: 'rgba(14,14,13,0.55)' }}>{s.description}</div>
                    {s.contactId && (
                      <div style={{ fontSize: '0.72rem', color: '#1c4a35', marginTop: '2px' }}>
                        → {contactName(s.contactId)}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => applyAISuggestion(s)}
                  style={{
                    background: '#1c4a35',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 14px',
                    fontSize: '0.78rem',
                    fontFamily: "'Jost',sans-serif",
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  Usar → Criar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Collections Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
        gap: '20px',
      }}>
        {collections.map(col => {
          const cName = contactName(col.contactId)
          const props = getPropertiesForCollection(col)
          const isEditing = editId === col.id

          return (
            <div key={col.id} style={{
              background: '#fff',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(14,14,13,0.08)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'box-shadow 0.2s',
            }}>
              {/* Card header */}
              <div style={{
                background: col.color,
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '2rem', lineHeight: 1 }}>{col.emoji}</span>
                  <div>
                    {isEditing ? (
                      <input
                        value={editForm.name || ''}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        style={{
                          fontFamily: "'Cormorant',serif",
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#fff',
                          background: 'rgba(255,255,255,0.15)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          width: '100%',
                        }}
                      />
                    ) : (
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.05rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                        {col.name}
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
                      {col.propertyIds.length} imóveis · {col.createdAt}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{
                    background: col.isPublic ? 'rgba(20,184,166,0.85)' : 'rgba(107,114,128,0.75)',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                  }}>
                    {col.isPublic ? '🔗 Public' : '🔒 Private'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span>👁️</span> {col.views}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '14px 18px', flex: 1 }}>
                {isEditing ? (
                  <input
                    value={editForm.description || ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    style={{
                      fontSize: '0.8rem',
                      color: 'rgba(14,14,13,0.7)',
                      background: '#f4f0e6',
                      border: '1px solid rgba(14,14,13,0.1)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      width: '100%',
                      marginBottom: '8px',
                    }}
                  />
                ) : (
                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'rgba(14,14,13,0.65)', lineHeight: 1.5 }}>
                    {col.description}
                  </p>
                )}

                {/* Contact badge */}
                {cName && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(28,74,53,0.07)',
                    color: '#1c4a35',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    marginBottom: '10px',
                  }}>
                    👤 {cName}
                  </div>
                )}

                {/* Property mini-cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                  {props.slice(0, 3).map(p => (
                    <div key={p.id} style={{
                      height: '52px',
                      background: '#f4f0e6',
                      borderRadius: '6px',
                      padding: '0 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: BADGE_COLOR[p.badge] || '#888',
                          flexShrink: 0,
                        }} />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.nome}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'rgba(14,14,13,0.5)' }}>{p.zona} · {p.area}m²</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: "'DM Mono',monospace", flexShrink: 0, color: '#1c4a35' }}>
                        {fmtPrice(p.preco)}
                      </div>
                    </div>
                  ))}
                  {col.propertyIds.length > 3 && (
                    <div style={{ fontSize: '0.72rem', color: 'rgba(14,14,13,0.4)', textAlign: 'center', padding: '4px' }}>
                      + {col.propertyIds.length - 3} mais
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px', marginBottom: '12px' }}>
                  {col.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'rgba(201,169,110,0.12)',
                      color: '#7a5c20',
                      borderRadius: '20px',
                      padding: '2px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                    }}>{tag}</span>
                  ))}
                </div>

                {/* Action buttons */}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => saveEdit(col.id)}
                      style={{
                        flex: 1,
                        background: '#1c4a35',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '0.78rem',
                        fontFamily: "'Jost',sans-serif",
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => { setEditId(null); setEditForm({}) }}
                      style={{
                        background: '#f4f0e6',
                        color: 'rgba(14,14,13,0.6)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '0.78rem',
                        fontFamily: "'Jost',sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                    <button
                      onClick={() => openCollection(col.id)}
                      style={{
                        flex: 1,
                        background: '#1c4a35',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '0.78rem',
                        fontFamily: "'Jost',sans-serif",
                        fontWeight: 600,
                        cursor: 'pointer',
                        minWidth: '70px',
                      }}
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => copyShareLink(col.shareToken)}
                      style={{
                        background: copiedToken === col.shareToken ? 'rgba(20,184,166,0.1)' : '#f4f0e6',
                        color: copiedToken === col.shareToken ? '#0d9488' : 'rgba(14,14,13,0.7)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '0.78rem',
                        fontFamily: "'Jost',sans-serif",
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedToken === col.shareToken ? '✓ Copiado' : '🔗 Partilhar'}
                    </button>
                    <button
                      onClick={() => startEdit(col)}
                      style={{
                        background: '#f4f0e6',
                        color: 'rgba(14,14,13,0.7)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteCollection(col.id)}
                      style={{
                        background: '#f4f0e6',
                        color: 'rgba(220,38,38,0.7)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                      title="Apagar"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {/* Last viewed */}
              {col.lastViewed && (
                <div style={{
                  borderTop: '1px solid rgba(14,14,13,0.06)',
                  padding: '7px 18px',
                  fontSize: '0.68rem',
                  color: 'rgba(14,14,13,0.4)',
                  fontFamily: "'DM Mono',monospace",
                }}>
                  Última vista: {col.lastViewed}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Collection Detail Modal ── */}
      {openId && activeCollection && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setOpenId(null) }}>
          <div style={S.modalLg}>
            {/* Detail header */}
            <div style={{
              background: activeCollection.color,
              padding: '24px 28px',
              position: 'sticky' as const,
              top: 0,
              zIndex: 10,
              borderRadius: '14px 14px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '2.4rem' }}>{activeCollection.emoji}</span>
                  <div>
                    <h2 style={{ fontFamily: "'Cormorant',serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                      {activeCollection.name}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>
                      {activeCollection.description}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                        👁️ {activeCollection.views} views
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                        🏠 {activeCollection.propertyIds.length} imóveis
                      </span>
                      {activeCollection.lastViewed && (
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontFamily: "'DM Mono',monospace" }}>
                          Visto: {activeCollection.lastViewed}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpenId(null)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#fff',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >✕</button>
              </div>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {/* Share panel */}
              <div style={{
                background: '#fff',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap' as const,
                gap: '10px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', letterSpacing: '0.05em' }}>
                    SHARE LINK
                  </div>
                  <code style={{
                    fontSize: '0.78rem',
                    fontFamily: "'DM Mono',monospace",
                    color: '#1c4a35',
                    background: 'rgba(28,74,53,0.06)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}>
                    https://agencygroup.pt/collections/{activeCollection.shareToken}
                  </code>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => togglePublic(activeCollection.id)}
                    style={{
                      background: activeCollection.isPublic ? 'rgba(20,184,166,0.1)' : 'rgba(107,114,128,0.1)',
                      color: activeCollection.isPublic ? '#0d9488' : '#6b7280',
                      border: `1px solid ${activeCollection.isPublic ? 'rgba(20,184,166,0.3)' : 'rgba(107,114,128,0.3)'}`,
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontFamily: "'Jost',sans-serif",
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {activeCollection.isPublic ? '🔗 Public' : '🔒 Private'}
                  </button>
                  <button
                    onClick={() => copyShareLink(activeCollection.shareToken)}
                    style={{
                      background: copiedToken === activeCollection.shareToken ? '#0d9488' : '#1c4a35',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '0.78rem',
                      fontFamily: "'Jost',sans-serif",
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedToken === activeCollection.shareToken ? '✓ Copiado!' : '📋 Copiar Link'}
                  </button>
                  <button
                    onClick={() => exportToPDF?.(`collection-${activeCollection.id}`, activeCollection.name)}
                    style={{
                      background: '#f4f0e6',
                      color: 'rgba(14,14,13,0.7)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '0.78rem',
                      fontFamily: "'Jost',sans-serif",
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📄 PDF
                  </button>
                </div>
              </div>

              {/* Properties grid */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  Imóveis na Collection
                </h3>
                <button
                  onClick={() => setShowPropertySelector(true)}
                  style={{
                    background: 'rgba(28,74,53,0.08)',
                    color: '#1c4a35',
                    border: '1px dashed rgba(28,74,53,0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontFamily: "'Jost',sans-serif",
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Adicionar Imóvel
                </button>
              </div>

              {getPropertiesForCollection(activeCollection).length === 0 ? (
                <div style={{
                  background: '#fff',
                  borderRadius: '10px',
                  padding: '32px',
                  textAlign: 'center' as const,
                  color: 'rgba(14,14,13,0.4)',
                  fontSize: '0.85rem',
                }}>
                  Nenhum imóvel nesta collection. Adicione um acima.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '14px' }}>
                  {getPropertiesForCollection(activeCollection).map(p => (
                    <div key={p.id} style={{
                      background: '#fff',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 4px rgba(14,14,13,0.07)',
                    }}>
                      {/* Property card header */}
                      <div style={{
                        background: 'linear-gradient(135deg,rgba(28,74,53,0.08),rgba(201,169,110,0.08))',
                        padding: '12px 14px 8px',
                        borderBottom: '1px solid rgba(14,14,13,0.06)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.3, fontFamily: "'Cormorant',serif" }}>
                              {p.nome}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(14,14,13,0.5)', marginTop: '2px' }}>
                              {p.zona} · {p.bairro}
                            </div>
                          </div>
                          <span style={{
                            background: BADGE_COLOR[p.badge] || '#888',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap' as const,
                            flexShrink: 0,
                          }}>
                            {p.badge}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: "'DM Mono',monospace", color: '#1c4a35', marginBottom: '6px' }}>
                          {fmtPrice(p.preco)}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', color: 'rgba(14,14,13,0.55)', marginBottom: '10px' }}>
                          <span>📐 {p.area}m²</span>
                          <span>🛏 {p.quartos}Q</span>
                          <span>🛁 {p.casasBanho}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' as const, marginBottom: '10px' }}>
                          {p.piscina && <span style={{ background: 'rgba(14,165,233,0.1)', color: '#0369a1', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>Piscina</span>}
                          {p.jardim && <span style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>Jardim</span>}
                          {p.terraco && <span style={{ background: 'rgba(201,169,110,0.12)', color: '#7a5c20', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>Terraço</span>}
                          {p.garagem && <span style={{ background: 'rgba(107,114,128,0.1)', color: '#374151', borderRadius: '4px', padding: '1px 5px', fontSize: '0.65rem' }}>Garagem</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{
                            background: '#f4f0e6',
                            color: 'rgba(14,14,13,0.55)',
                            borderRadius: '4px',
                            padding: '2px 7px',
                            fontSize: '0.68rem',
                            flex: 1,
                            textAlign: 'center' as const,
                          }}>{p.tipo}</span>
                          <button
                            onClick={() => removePropertyFromCollection(activeCollection.id, p.id)}
                            style={{
                              background: 'rgba(220,38,38,0.07)',
                              color: 'rgba(220,38,38,0.8)',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              fontFamily: "'Jost',sans-serif",
                              cursor: 'pointer',
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags row in detail */}
              {activeCollection.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const, marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(14,14,13,0.08)' }}>
                  {activeCollection.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'rgba(201,169,110,0.12)',
                      color: '#7a5c20',
                      borderRadius: '20px',
                      padding: '3px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Property Selector Modal (for detail view) ── */}
      {showPropertySelector && openId && (
        <div style={{ ...S.overlay, zIndex: 300 }} onClick={e => { if (e.target === e.currentTarget) setShowPropertySelector(false) }}>
          <div style={{ ...S.modal, maxHeight: '70vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                Adicionar Imóvel
              </h3>
              <button onClick={() => setShowPropertySelector(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'rgba(14,14,13,0.4)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PORTAL_PROPERTIES.filter(p => !activeCollection?.propertyIds.includes(p.id)).map(p => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f4f0e6',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  gap: '10px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.nome}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(14,14,13,0.5)' }}>{p.zona} · {fmtPrice(p.preco)} · {p.area}m²</div>
                  </div>
                  <button
                    onClick={() => { addPropertyToCollection(openId, p.id); setShowPropertySelector(false) }}
                    style={{
                      background: '#1c4a35',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontFamily: "'Jost',sans-serif",
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    + Adicionar
                  </button>
                </div>
              ))}
              {PORTAL_PROPERTIES.filter(p => !activeCollection?.propertyIds.includes(p.id)).length === 0 && (
                <div style={{ textAlign: 'center' as const, padding: '24px', color: 'rgba(14,14,13,0.4)', fontSize: '0.85rem' }}>
                  Todos os imóveis já foram adicionados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Collection Modal ── */}
      {showCreate && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setForm({ ...emptyForm }) } }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                Nova Collection
              </h3>
              <button onClick={() => { setShowCreate(false); setForm({ ...emptyForm }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'rgba(14,14,13,0.4)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                  NOME
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Top Picks para James"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid rgba(14,14,13,0.15)',
                    borderRadius: '7px',
                    fontSize: '0.85rem',
                    fontFamily: "'Jost',sans-serif",
                    outline: 'none',
                    boxSizing: 'border-box' as const,
                    background: '#f9f8f4',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                  DESCRIÇÃO
                </label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Villas premium Cascais · Budget €2–3M"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid rgba(14,14,13,0.15)',
                    borderRadius: '7px',
                    fontSize: '0.85rem',
                    fontFamily: "'Jost',sans-serif",
                    outline: 'none',
                    boxSizing: 'border-box' as const,
                    background: '#f9f8f4',
                  }}
                />
              </div>

              {/* Emoji + Color */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                    EMOJI
                  </label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' as const }}>
                    {EMOJI_OPTIONS.map(em => (
                      <button
                        key={em}
                        onClick={() => setForm(f => ({ ...f, emoji: em }))}
                        style={{
                          fontSize: '1.2rem',
                          background: form.emoji === em ? 'rgba(201,169,110,0.2)' : 'transparent',
                          border: form.emoji === em ? '2px solid #c9a96e' : '2px solid transparent',
                          borderRadius: '6px',
                          padding: '4px 5px',
                          cursor: 'pointer',
                          lineHeight: 1,
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                    COR
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setForm(f => ({ ...f, color: c.value }))}
                        title={c.label}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: c.value,
                          border: form.color === c.value ? '3px solid #0e0e0d' : '3px solid transparent',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                  CLIENTE (OPCIONAL)
                </label>
                <select
                  value={form.contactId ?? ''}
                  onChange={e => setForm(f => ({ ...f, contactId: e.target.value ? Number(e.target.value) : undefined }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid rgba(14,14,13,0.15)',
                    borderRadius: '7px',
                    fontSize: '0.85rem',
                    fontFamily: "'Jost',sans-serif",
                    outline: 'none',
                    background: '#f9f8f4',
                    color: '#0e0e0d',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">— Sem cliente associado —</option>
                  {crmContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} · {c.nationality}</option>
                  ))}
                </select>
              </div>

              {/* Property selector checklist */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                  IMÓVEIS ({form.propertyIds.length} seleccionados)
                </label>
                <div style={{
                  border: '1px solid rgba(14,14,13,0.12)',
                  borderRadius: '7px',
                  maxHeight: '180px',
                  overflowY: 'auto' as const,
                  background: '#f9f8f4',
                }}>
                  {PORTAL_PROPERTIES.map(p => {
                    const checked = form.propertyIds.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(14,14,13,0.05)',
                          background: checked ? 'rgba(28,74,53,0.05)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm(f => ({
                            ...f,
                            propertyIds: checked
                              ? f.propertyIds.filter(id => id !== p.id)
                              : [...f.propertyIds, p.id],
                          }))}
                          style={{ accentColor: '#1c4a35', width: '14px', height: '14px', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.nome}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'rgba(14,14,13,0.5)' }}>
                            {p.zona} · {fmtPrice(p.preco)} · {p.area}m²
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(14,14,13,0.5)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                  TAGS
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const, marginBottom: '6px' }}>
                  {form.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'rgba(201,169,110,0.15)',
                      color: '#7a5c20',
                      borderRadius: '20px',
                      padding: '2px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {tag}
                      <button
                        onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(122,92,32,0.6)', fontSize: '0.7rem', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                      >✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault()
                        setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }))
                        setTagInput('')
                      }
                    }}
                    placeholder="Adicionar tag..."
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      border: '1px solid rgba(14,14,13,0.15)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontFamily: "'Jost',sans-serif",
                      outline: 'none',
                      background: '#f9f8f4',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (tagInput.trim()) {
                        setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }))
                        setTagInput('')
                      }
                    }}
                    style={{
                      background: '#f4f0e6',
                      border: '1px solid rgba(14,14,13,0.15)',
                      borderRadius: '6px',
                      padding: '7px 12px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      color: '#0e0e0d',
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Visibility toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))}
                  style={{
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    background: form.isPublic ? '#1c4a35' : 'rgba(14,14,13,0.15)',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative' as const,
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute' as const,
                    top: '2px',
                    left: form.isPublic ? '20px' : '2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <span style={{ fontSize: '0.8rem', color: 'rgba(14,14,13,0.65)' }}>
                  {form.isPublic ? '🔗 Pública — link de partilha activo' : '🔒 Privada — apenas visível internamente'}
                </span>
              </div>

              {/* Preview strip */}
              <div style={{
                background: form.color,
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{ fontSize: '1.6rem' }}>{form.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                    {form.name || 'Nome da collection'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                    {form.description || 'Descrição da collection'}
                  </div>
                </div>
              </div>

              {/* Create button */}
              <button
                onClick={createCollection}
                disabled={!form.name.trim()}
                style={{
                  background: form.name.trim() ? '#1c4a35' : 'rgba(28,74,53,0.3)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.88rem',
                  fontFamily: "'Jost',sans-serif",
                  fontWeight: 700,
                  cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.02em',
                }}
              >
                Criar Collection
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
