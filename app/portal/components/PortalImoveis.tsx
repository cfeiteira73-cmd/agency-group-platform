'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { PORTAL_PROPERTIES } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list' | 'map'
type SortMode = 'preco_asc' | 'preco_desc' | 'recente' | 'antigo' | 'pm2'
type ImoveisTab = 'grelha' | 'detalhe'

interface ImovelFull {
  id: string
  ref: string
  nome: string
  zona: string
  bairro: string
  tipo: string
  preco: number
  area: number
  quartos: number
  casasBanho: number
  badge: string
  status: string
  piscina: boolean
  garagem: boolean
  jardim: boolean
  terraco: boolean
  listingDate: string
  viewsCount?: number
  isCustom?: boolean
  imagens?: string[]
  videoUrls?: string[]
  isFrontpage?: boolean
  descricao?: string
}

interface Filters {
  tipo: string[]
  zona: string[]
  precoMin: number
  precoMax: number
  tipologia: string[]
  estado: string[]
  features: string[]
}

// ─── Extend PORTAL_PROPERTIES with extra fields ───────────────────────────────

const ALL_PROPERTIES: ImovelFull[] = PORTAL_PROPERTIES.map((p, i) => ({
  ...p,
  casasBanho: p.casasBanho ?? Math.max(1, p.quartos - 1),
  viewsCount: [14, 32, 8, 27, 19, 5, 43, 12, 38, 21][i % 10],
}))

// ─── Map Data ─────────────────────────────────────────────────────────────────

const MAP_PINS: { id: string; x: number; y: number; zona: string }[] = [
  { id: 'AG-2026-010', x: 162, y: 256, zona: 'Lisboa' },
  { id: 'AG-2026-011', x: 158, y: 260, zona: 'Lisboa' },
  { id: 'AG-2026-012', x: 148, y: 262, zona: 'Lisboa' },
  { id: 'AG-2026-020', x: 128, y: 232, zona: 'Cascais' },
  { id: 'AG-2026-021', x: 138, y: 238, zona: 'Cascais' },
  { id: 'AG-2026-030', x: 152, y: 316, zona: 'Comporta' },
  { id: 'AG-2026-040', x: 188, y: 118, zona: 'Porto' },
  { id: 'AG-2026-050', x: 168, y: 378, zona: 'Algarve' },
  { id: 'AG-2026-060', x: 298, y: 208, zona: 'Madeira' },
  { id: 'AG-2026-070', x: 145, y: 248, zona: 'Sintra' },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONAS = ['Lisboa', 'Cascais', 'Porto', 'Algarve', 'Comporta', 'Madeira', 'Sintra', 'Setúbal', 'Braga', 'Açores']
const TIPOS = ['Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Comercial', 'Terreno', 'Herdade', 'Quinta']
const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']
const ESTADOS = ['Novo', 'Usado', 'Para Remodelação']
const FEATURES = ['Piscina', 'Garagem', 'Vista Mar', 'Jardim', 'Terraço']

const ZONE_GRADIENTS: Record<string, string> = {
  'Lisboa': 'linear-gradient(135deg,#1c4a35 0%,#2d6a50 100%)',
  'Cascais': 'linear-gradient(135deg,#1a3a5c 0%,#2a5a8c 100%)',
  'Algarve': 'linear-gradient(135deg,#7c3d15 0%,#c9610a 100%)',
  'Porto': 'linear-gradient(135deg,#4a1a6a 0%,#7a2a9a 100%)',
  'Madeira': 'linear-gradient(135deg,#1a4a3c 0%,#2a7a5a 100%)',
  'Comporta': 'linear-gradient(135deg,#5a4a15 0%,#8a7a2a 100%)',
  'Sintra': 'linear-gradient(135deg,#2a3a4a 0%,#3a5a7a 100%)',
  'Setúbal': 'linear-gradient(135deg,#3a1a5c 0%,#5a3a8c 100%)',
  'Braga': 'linear-gradient(135deg,#1a3a1a 0%,#3a6a3a 100%)',
  'Açores': 'linear-gradient(135deg,#1a4a4a 0%,#2a7a7a 100%)',
}

const BUYER_MATCHES = [
  { name: 'James Mitchell', nationality: '🇺🇸', budget: '€3M–€5M', score: 94 },
  { name: 'Pierre Dubois', nationality: '🇫🇷', budget: '€1M–€2M', score: 82 },
  { name: 'Sophie Hartmann', nationality: '🇩🇪', budget: '€2M–€4M', score: 78 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPreco(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toLocaleString('pt-PT', { minimumFractionDigits: v % 1_000_000 === 0 ? 0 : 1, maximumFractionDigits: 2 })}M`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`
  return `€${v}`
}

function fmtPm2(preco: number, area: number): string {
  return `€${Math.round(preco / area).toLocaleString('pt-PT')}/m²`
}

function dom(listingDate: string): number {
  return Math.floor((Date.now() - new Date(listingDate).getTime()) / 86_400_000)
}

function badgeSt(badge: string): { bg: string; color: string; border: string } {
  switch (badge) {
    case 'Exclusivo':  return { bg: 'rgba(201,169,110,.13)', color: '#b8945a', border: 'rgba(201,169,110,.4)' }
    case 'Off-Market': return { bg: 'rgba(28,74,53,.12)',    color: '#1c4a35', border: 'rgba(28,74,53,.35)' }
    case 'Destaque':   return { bg: 'rgba(74,156,122,.12)',  color: '#2a7a5a', border: 'rgba(74,156,122,.35)' }
    case 'Novo':       return { bg: 'rgba(58,123,213,.1)',   color: '#3a7bd5', border: 'rgba(58,123,213,.3)' }
    default:           return { bg: 'rgba(14,14,13,.07)',    color: 'rgba(14,14,13,.5)', border: 'rgba(14,14,13,.2)' }
  }
}

function statusSt(status: string): string {
  switch (status) {
    case 'Ativo':        return '#1c4a35'
    case 'Sob Proposta': return '#c9a96e'
    case 'Reservado':    return '#3a7bd5'
    case 'Vendido':      return '#888'
    default:             return '#888'
  }
}

function cardBorder(badge: string): string {
  if (badge === 'Exclusivo') return '#c9a96e'
  if (badge === 'Off-Market') return '#1c4a35'
  if (badge === 'Destaque') return '#4a9c7a'
  return 'rgba(14,14,13,.08)'
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconGrid = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IconList = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconMap = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
)
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconPool = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12h20M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
  </svg>
)
const IconCar = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 17H3v-2l2-5h14l2 5v2h-2m-1 0v3h1v-3m-15 0v3H3v-3m2-3h14"/>
    <circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>
  </svg>
)
const IconTree = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M17 21H7l-4-8h18l-4 8z"/><path d="M12 3v10M7.5 7L12 3l4.5 4"/>
  </svg>
)
const IconTerrace = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="13" width="20" height="8" rx="1"/><path d="M6 13V8M18 13V8M4 8h16"/>
  </svg>
)
const IconChevron = ({ dir }: { dir: 'down' | 'up' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {dir === 'down' ? <polyline points="6 9 12 15 18 9"/> : dir === 'up' ? <polyline points="18 15 12 9 6 15"/> : <polyline points="9 18 15 12 9 6"/>}
  </svg>
)
const IconSort = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 6h18M7 12h10M11 18h2"/>
  </svg>
)
const IconAI = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/>
  </svg>
)
const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconShare = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)
const IconPipeline = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
  </svg>
)
const IconCollection = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
  </svg>
)
const IconUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
)
const IconSparkle = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/>
  </svg>
)
const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ─── PropertyCard (Grid) ──────────────────────────────────────────────────────

interface PropertyCardProps {
  p: ImovelFull
  onSelect: (p: ImovelFull) => void
  onEdit?: (p: ImovelFull) => void
  onSelectAI?: (p: ImovelFull) => void
  onToggleFrontpage?: (id: string) => void
}

function PropertyCard({ p, onSelect, onEdit, onSelectAI, onToggleFrontpage }: PropertyCardProps) {
  const [hovered, setHovered] = useState(false)
  const bs = badgeSt(p.badge)
  const grad = ZONE_GRADIENTS[p.zona] ?? 'linear-gradient(135deg,#334155 0%,#475569 100%)'
  const days = dom(p.listingDate)

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', borderRadius: 14, border: `1.5px solid ${cardBorder(p.badge)}`,
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: hovered ? '0 12px 40px rgba(14,14,13,.12)' : '0 2px 8px rgba(14,14,13,.06)',
        transform: hovered ? 'translateY(-3px)' : 'none', transition: 'all .2s',
      }}
      onClick={() => onSelect(p)}
    >
      {/* Photo */}
      <div style={{ height: 160, background: grad, backgroundImage: p.imagens?.[0] ? `url(${p.imagens[0]})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, rgba(0,0,0,.4), transparent)' }} />
        <div style={{ position: 'absolute', top: '.6rem', left: '.65rem', display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
          {p.badge && (
            <span style={{ background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`, borderRadius: 20, padding: '2px 9px', fontSize: '.67rem', fontFamily: 'var(--font-dm-mono)', fontWeight: 600, backdropFilter: 'blur(6px)' }}>
              {p.badge}
            </span>
          )}
        </div>
        <div style={{ position: 'absolute', top: '.6rem', right: '.65rem' }}>
          <span style={{ background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 20, padding: '2px 9px', fontSize: '.67rem', fontFamily: 'var(--font-dm-mono)', color: '#fff' }}>
            {p.status}
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: '.5rem', left: '.65rem' }}>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.5rem', color: '#fff', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
            {fmtPreco(p.preco)}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '.6rem', right: '.65rem' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(255,255,255,.7)' }}>{p.zona}</span>
        </div>

        {/* AI hover overlay */}
        {hovered && (
          <div
            onClick={e => { if (onSelectAI) { e.stopPropagation(); onSelectAI(p) } }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(28,74,53,.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .2s', cursor: 'pointer' }}>
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <IconAI />
              <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', marginTop: '.3rem', fontWeight: 600 }}>Analisar com IA</div>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '.9rem 1rem' }}>
        <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600, marginBottom: '.2rem', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.nome}
        </div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.4)', marginBottom: '.5rem' }}>
          {p.bairro} · {p.ref}
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: '#0e0e0d', fontWeight: 600 }}>T{p.quartos}</span>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.35)' }}>·</span>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.55)' }}>{p.area}m²</span>
          </div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.4)', marginLeft: 'auto' }}>
            {fmtPm2(p.preco, p.area)}
          </div>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', gap: '.3rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
          {p.piscina && <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.5)' }}><IconPool />Piscina</span>}
          {p.garagem && <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.5)' }}><IconCar />Garagem</span>}
          {p.jardim && <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.5)' }}><IconTree />Jardim</span>}
          {p.terraco && <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.5)' }}><IconTerrace />Terraço</span>}
        </div>

        {/* DOM + Frontpage */}
        <div style={{ marginTop: '.5rem', paddingTop: '.5rem', borderTop: '1px solid rgba(14,14,13,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: days > 90 ? '#c9a96e' : 'rgba(14,14,13,.35)' }}>
            {days} dias no mercado
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.35)' }}>
              {p.viewsCount ?? 0} vistas
            </span>
            {onEdit && (
              <button
                type="button"
                title="Editar imóvel"
                onClick={e => { e.stopPropagation(); onEdit(p) }}
                style={{
                  background: 'rgba(28,74,53,.08)',
                  border: '1.5px solid rgba(28,74,53,.3)',
                  borderRadius: 6, cursor: 'pointer', padding: '2px 8px',
                  display: 'flex', alignItems: 'center', gap: '.25rem',
                  transition: 'all .15s',
                  color: '#1c4a35',
                  fontFamily: 'var(--font-jost)',
                  fontSize: '.65rem', fontWeight: 600,
                }}>
                <IconEdit /> Editar
              </button>
            )}
            {onToggleFrontpage && (
              <button
                type="button"
                title={p.isFrontpage ? 'Remover da frontpage' : 'Colocar na frontpage'}
                onClick={e => { e.stopPropagation(); onToggleFrontpage(p.id) }}
                style={{
                  background: p.isFrontpage ? '#1c4a35' : 'transparent',
                  border: `1.5px solid ${p.isFrontpage ? '#1c4a35' : 'rgba(14,14,13,.18)'}`,
                  borderRadius: 6, width: 22, height: 22, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', transition: 'all .15s', padding: 0,
                  color: p.isFrontpage ? '#fff' : 'rgba(14,14,13,.4)',
                }}>
                🌐
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PropertyRow (List) ───────────────────────────────────────────────────────

function PropertyRow({ p, onSelect, onEdit }: PropertyCardProps) {
  const [hovered, setHovered] = useState(false)
  const bs = badgeSt(p.badge)
  const grad = ZONE_GRADIENTS[p.zona] ?? 'linear-gradient(135deg,#334155 0%,#475569 100%)'
  const days = dom(p.listingDate)

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(p)}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1.25rem',
        background: hovered ? 'rgba(14,14,13,.03)' : '#fff', cursor: 'pointer',
        borderBottom: '1px solid rgba(14,14,13,.06)', transition: 'all .2s',
      }}>
      {/* Photo thumbnail */}
      <div style={{ width: 72, height: 52, borderRadius: 8, background: grad, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: '.25rem', left: '.3rem' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.6rem', color: 'rgba(255,255,255,.8)' }}>{p.zona}</span>
        </div>
      </div>

      {/* Name + ref */}
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.4)' }}>{p.bairro} · {p.ref}</div>
      </div>

      {/* Type */}
      <div style={{ flex: 1, fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.55)' }}>{p.tipo}</div>

      {/* Typologia + area */}
      <div style={{ flex: 1, fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.55)' }}>T{p.quartos} · {p.area}m²</div>

      {/* Price */}
      <div style={{ flex: 1.2, textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.15rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(p.preco)}</div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)' }}>{fmtPm2(p.preco, p.area)}</div>
      </div>

      {/* DOM */}
      <div style={{ flex: .8, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: days > 90 ? '#c9a96e' : 'rgba(14,14,13,.5)' }}>{days}d</div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.3)' }}>no mercado</div>
      </div>

      {/* Badge + status */}
      <div style={{ flex: 1, display: 'flex', gap: '.35rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        {p.badge && (
          <span style={{ background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`, borderRadius: 20, padding: '2px 8px', fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)' }}>
            {p.badge}
          </span>
        )}
        <span style={{ background: 'rgba(14,14,13,.06)', color: statusSt(p.status), borderRadius: 20, padding: '2px 8px', fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)' }}>
          {p.status}
        </span>
        {onEdit && (
          <button type="button" onClick={e => { e.stopPropagation(); onEdit(p) }}
            style={{ background: 'rgba(28,74,53,.08)', border: '1.5px solid rgba(28,74,53,.3)', borderRadius: 6, cursor: 'pointer', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '.25rem', color: '#1c4a35', fontFamily: 'var(--font-jost)', fontSize: '.68rem', fontWeight: 600, transition: 'all .15s', flexShrink: 0 }}>
            <IconEdit /> Editar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Filters Bar ──────────────────────────────────────────────────────────────

interface FiltersBarProps {
  filters: Filters
  setFilters: (f: Filters) => void
  sort: SortMode
  setSort: (s: SortMode) => void
  open: boolean
}

function FiltersBar({ filters, setFilters, sort, setSort, open }: FiltersBarProps) {
  if (!open) return null

  function toggleArr<K extends keyof Filters>(key: K, val: string) {
    const arr = filters[key] as string[]
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
    setFilters({ ...filters, [key]: next })
  }

  function PillGroup({ label, items, field }: { label: string; items: string[]; field: keyof Filters }) {
    const selected = filters[field] as string[]
    return (
      <div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.35rem', letterSpacing: '.08em' }}>{label.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
          {items.map(item => (
            <button type="button" key={item} onClick={() => toggleArr(field, item)}
              style={{
                fontFamily: 'var(--font-jost)', fontSize: '.76rem', padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${selected.includes(item) ? '#1c4a35' : 'rgba(14,14,13,.15)'}`,
                background: selected.includes(item) ? '#1c4a35' : 'transparent',
                color: selected.includes(item) ? '#fff' : 'rgba(14,14,13,.6)',
                transition: 'all .15s',
              }}>
              {item}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-card" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        <PillGroup label="Tipo" items={TIPOS} field="tipo" />
        <PillGroup label="Zona" items={ZONAS} field="zona" />
        <PillGroup label="Tipologia" items={TIPOLOGIAS} field="tipologia" />
        <PillGroup label="Estado" items={ESTADOS} field="estado" />
        <PillGroup label="Features" items={FEATURES} field="features" />
      </div>

      {/* Price range */}
      <div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.35rem', letterSpacing: '.08em' }}>PREÇO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.78rem', color: 'rgba(14,14,13,.4)' }}>€</span>
            <input className="p-inp" style={{ width: 120, fontSize: '.8rem' }} value={filters.precoMin.toLocaleString('pt-PT')}
              onChange={e => setFilters({ ...filters, precoMin: Number(e.target.value.replace(/\D/g, '')) })} placeholder="100.000" />
          </div>
          <span style={{ color: 'rgba(14,14,13,.3)' }}>—</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.78rem', color: 'rgba(14,14,13,.4)' }}>€</span>
            <input className="p-inp" style={{ width: 120, fontSize: '.8rem' }} value={filters.precoMax.toLocaleString('pt-PT')}
              onChange={e => setFilters({ ...filters, precoMax: Number(e.target.value.replace(/\D/g, '')) })} placeholder="10.000.000" />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <IconSort />
            <select className="p-sel" style={{ fontSize: '.8rem' }} value={sort} onChange={e => setSort(e.target.value as SortMode)}>
              <option value="preco_asc">Preço ↑</option>
              <option value="preco_desc">Preço ↓</option>
              <option value="recente">Mais Recente</option>
              <option value="antigo">Mais Antigo</option>
              <option value="pm2">€/m²</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Property Drawer ──────────────────────────────────────────────────────────

type DrawerTab = 'info' | 'ia' | 'avm' | 'matching' | 'editar'

function PropertyDrawer({ p, onClose, onUpdate, initialTab }: { p: ImovelFull; onClose: () => void; onUpdate?: (updated: ImovelFull) => void; initialTab?: DrawerTab }) {
  const [dtab, setDtab] = useState<DrawerTab>(initialTab ?? 'info')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [actionToast, setActionToast] = useState('')
  const drawerScrollRef = useRef<HTMLDivElement>(null)

  function switchTab(tab: DrawerTab) {
    setDtab(tab)
    setTimeout(() => {
      drawerScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 30)
  }

  // Edit state — mirrors all ImovelFull fields
  const [editNome, setEditNome]     = useState(p.nome)
  const [editRef, setEditRef]       = useState(p.ref)
  const [editZona, setEditZona]     = useState(p.zona)
  const [editBairro, setEditBairro] = useState(p.bairro)
  const [editTipo, setEditTipo]     = useState(p.tipo)
  const [editPreco, setEditPreco]   = useState(p.preco.toString())
  const [editArea, setEditArea]     = useState(p.area.toString())
  const [editQuartos, setEditQuartos]   = useState(p.quartos)
  const [editWcs, setEditWcs]           = useState(p.casasBanho)
  const [editBadge, setEditBadge]       = useState(p.badge)
  const [editStatus, setEditStatus]     = useState(p.status)
  const [editPiscina, setEditPiscina]   = useState(p.piscina)
  const [editGaragem, setEditGaragem]   = useState(p.garagem)
  const [editJardim, setEditJardim]     = useState(p.jardim)
  const [editTerraco, setEditTerraco]   = useState(p.terraco)
  const [editPhotos, setEditPhotos]     = useState<string[]>(p.imagens ?? [])
  const [editDescricao, setEditDescricao] = useState(p.descricao ?? '')
  const [editDragIdx, setEditDragIdx]   = useState<number | null>(null)
  const [editDropIdx, setEditDropIdx]   = useState<number | null>(null)
  const [editSaved, setEditSaved]       = useState(false)
  const editPhotoRef = useRef<HTMLInputElement>(null)
  const [editUploading, setEditUploading] = useState(false)

  const grad = ZONE_GRADIENTS[editZona] ?? 'linear-gradient(135deg,#334155 0%,#475569 100%)'
  const days = dom(p.listingDate)

  async function uploadEditPhoto(files: FileList | null) {
    if (!files || !files.length) return
    setEditUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/properties/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (res.ok && json.type !== 'video') urls.push(json.url)
      } catch { /* ignore */ }
    }
    setEditPhotos(prev => [...prev, ...urls])
    setEditUploading(false)
  }

  function handleSave() {
    const updated: ImovelFull = {
      ...p,
      nome: editNome.trim() || p.nome,
      ref: editRef.trim() || p.ref,
      zona: editZona, bairro: editBairro.trim() || editZona,
      tipo: editTipo,
      preco: Number(editPreco.replace(/\D/g, '')) || p.preco,
      area: Number(editArea) || p.area,
      quartos: editQuartos, casasBanho: editWcs,
      badge: editBadge, status: editStatus,
      piscina: editPiscina, garagem: editGaragem,
      jardim: editJardim, terraco: editTerraco,
      imagens: editPhotos,
      descricao: editDescricao.trim() || undefined,
      isCustom: true,
    }
    onUpdate?.(updated)
    setEditSaved(true)
    setTimeout(() => setEditSaved(false), 2500)
  }

  function runAI() {
    if (aiDone) return
    setAiLoading(true)
    setTimeout(() => { setAiLoading(false); setAiDone(true) }, 1800)
  }

  useEffect(() => { if (dtab === 'ia') runAI() }, [dtab])

  // SVG price history mini chart
  const priceHistory = [
    { date: 'Jan', value: p.preco * 0.94 },
    { date: 'Fev', value: p.preco * 0.97 },
    { date: 'Mar', value: p.preco },
  ]
  const minV = Math.min(...priceHistory.map(h => h.value))
  const maxV = Math.max(...priceHistory.map(h => h.value))
  const range = maxV - minV || 1
  const svgW = 200, svgH = 50
  const pts = priceHistory.map((h, i) => ({
    x: (i / (priceHistory.length - 1)) * svgW,
    y: svgH - ((h.value - minV) / range) * (svgH - 8) - 4,
  }))
  const pathD = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
  const areaD = `${pathD} L ${svgW} ${svgH} L 0 ${svgH} Z`

  const radarScore = Math.floor(68 + (p.preco / 100000) % 25)
  const avmValue = Math.round(p.preco * (0.94 + Math.random() * 0.12))
  const avmDiff = Math.round(((avmValue - p.preco) / p.preco) * 100)

  const DTABS: { id: DrawerTab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'ia', label: 'Análise IA' },
    { id: 'avm', label: 'AVM' },
    { id: 'matching', label: 'Matching' },
    { id: 'editar', label: 'Editar' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(14,14,13,.45)', backdropFilter: 'blur(3px)' }} />
      <div style={{ width: 480, background: '#f4f0e6', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', boxShadow: '-16px 0 48px rgba(14,14,13,.2)' }}>
        {/* Photo area */}
        <div style={{ height: 200, background: grad, backgroundImage: editPhotos[0] ? `url(${editPhotos[0]})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.35)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <IconClose />
          </button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(0,0,0,.5), transparent)' }} />
          <div style={{ position: 'absolute', bottom: '1rem', left: '1.25rem' }}>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.75rem', color: '#fff', fontWeight: 600, textShadow: '0 2px 8px rgba(0,0,0,.5)', lineHeight: 1.2 }}>{p.nome}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(255,255,255,.7)', marginTop: '.2rem' }}>{p.bairro} · {p.zona} · {p.ref}</div>
          </div>

          {/* Gallery dots */}
          <div style={{ position: 'absolute', bottom: '4.5rem', right: '1.25rem', display: 'flex', gap: '.3rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: i === 0 ? 16 : 6, height: 6, borderRadius: 3, background: i === 0 ? '#c9a96e' : 'rgba(255,255,255,.4)' }} />
            ))}
          </div>
        </div>

        {/* Price + key stats */}
        <div style={{ padding: '1.25rem', background: '#fff', borderBottom: '1px solid rgba(14,14,13,.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '2rem', color: '#c9a96e', fontWeight: 600, lineHeight: 1 }}>{fmtPreco(p.preco)}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(14,14,13,.45)', marginTop: '.2rem' }}>{fmtPm2(p.preco, p.area)}</div>
            </div>
            <div style={{ display: 'flex', gap: '.35rem' }}>
              {p.badge && (
                <span style={{ background: badgeSt(p.badge).bg, color: badgeSt(p.badge).color, border: `1px solid ${badgeSt(p.badge).border}`, borderRadius: 20, padding: '3px 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem' }}>{p.badge}</span>
              )}
              <span style={{ background: 'rgba(14,14,13,.06)', color: statusSt(p.status), borderRadius: 20, padding: '3px 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem' }}>{p.status}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem', marginTop: '.9rem' }}>
            {[
              { label: 'Tipologia', value: `T${p.quartos}` },
              { label: 'Área', value: `${p.area}m²` },
              { label: 'WCs', value: `${p.casasBanho}` },
              { label: 'Mercado', value: `${days}d` },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(14,14,13,.04)', borderRadius: 10, padding: '.5rem .6rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: '#0e0e0d', fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Drawer Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', background: '#fff', overflowX: 'auto', flexShrink: 0 }}>
          {DTABS.map(t => (
            <button type="button" key={t.id} onClick={() => setDtab(t.id)}
              style={{
                fontFamily: 'var(--font-jost)', fontSize: '.8rem', padding: '.65rem .9rem',
                background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                color: dtab === t.id ? '#1c4a35' : 'rgba(14,14,13,.45)',
                borderBottom: dtab === t.id ? '2px solid #1c4a35' : '2px solid transparent',
                fontWeight: dtab === t.id ? 600 : 400, marginBottom: '-1px',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Drawer Content — scrollable area only */}
        <div ref={drawerScrollRef} style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
          {/* INFO */}
          {dtab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.5rem', letterSpacing: '.06em' }}>CARACTERÍSTICAS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' }}>
                  {[
                    { k: 'Tipo', v: p.tipo },
                    { k: 'Zona', v: `${p.bairro}, ${p.zona}` },
                    { k: 'Referência', v: p.ref },
                    { k: 'Listado em', v: new Date(p.listingDate).toLocaleDateString('pt-PT') },
                    { k: 'Piscina', v: p.piscina ? 'Sim' : 'Não' },
                    { k: 'Garagem', v: p.garagem ? 'Sim' : 'Não' },
                    { k: 'Jardim', v: p.jardim ? 'Sim' : 'Não' },
                    { k: 'Terraço', v: p.terraco ? 'Sim' : 'Não' },
                  ].map(row => (
                    <div key={row.k} style={{ padding: '.45rem .6rem', background: 'rgba(14,14,13,.03)', borderRadius: 6 }}>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)' }}>{row.k}</div>
                      <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', color: '#0e0e0d', fontWeight: 600 }}>{row.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price history chart */}
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.5rem', letterSpacing: '.06em' }}>EVOLUÇÃO DE PREÇO</div>
                <div style={{ background: '#fff', borderRadius: 10, padding: '1rem', border: '1px solid rgba(14,14,13,.08)', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                  <svg width="100%" height={svgH + 20} viewBox={`0 0 ${svgW} ${svgH + 20}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id={`pg-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c9a96e" stopOpacity=".3" />
                        <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaD} fill={`url(#pg-${p.id})`} />
                    <path d={pathD} stroke="#c9a96e" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                    {pts.map((pt, i) => (
                      <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#c9a96e" />
                    ))}
                    {priceHistory.map((h, i) => (
                      <text key={i} x={pts[i].x} y={svgH + 16} textAnchor="middle" fontSize="9" fill="rgba(14,14,13,.4)" fontFamily="monospace">
                        {h.date}
                      </text>
                    ))}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.25rem' }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)' }}>{fmtPreco(minV)}</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(p.preco)} actual</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IA */}
          {dtab === 'ia' && (
            <div>
              {aiLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#1c4a35' }}>
                  <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', marginBottom: '1rem' }}>A analisar com Deal Radar 16D…</div>
                  <div style={{ width: 200, height: 4, background: 'rgba(14,14,13,.1)', borderRadius: 2, margin: '0 auto', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#1c4a35', borderRadius: 2, animation: 'slideRight 1.5s ease infinite', width: '60%' }} />
                  </div>
                </div>
              ) : aiDone ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div style={{ padding: '.9rem 1rem', background: 'rgba(28,74,53,.06)', borderRadius: 10, border: '1px solid rgba(28,74,53,.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>RADAR SCORE</span>
                      <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.8rem', color: '#1c4a35', fontWeight: 700 }}>{radarScore}/100</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(14,14,13,.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${radarScore}%`, background: radarScore > 80 ? '#1c4a35' : radarScore > 60 ? '#c9a96e' : '#c0392b', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ padding: '.85rem 1rem', background: 'rgba(201,169,110,.08)', borderRadius: 10, border: '1px solid rgba(201,169,110,.2)' }}>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.35rem' }}>OPORTUNIDADE</div>
                    <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: '#0e0e0d', lineHeight: 1.55, margin: 0 }}>
                      Imóvel {days > 90 ? 'há muito tempo em mercado — leverage negocial alto' : 'com boa liquidez para a zona'}. Preço por m² de {fmtPm2(p.preco, p.area)} {p.preco / p.area > 5000 ? 'acima' : 'abaixo'} da mediana de {p.zona}. {p.piscina && p.jardim ? 'Combinação piscina + jardim altamente valorizada por compradores internacionais.' : ''}
                    </p>
                  </div>
                  <div style={{ padding: '.85rem 1rem', background: 'rgba(14,14,13,.03)', borderRadius: 10, border: '1px solid rgba(14,14,13,.08)' }}>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.35rem' }}>PERFIL DE COMPRADOR IDEAL</div>
                    <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: '#0e0e0d', lineHeight: 1.55, margin: 0 }}>
                      {p.preco > 2000000 ? 'HNWI internacional — norte-americano, britânico ou médio-oriente. Family office interessado em diversificação europeia.' : 'Comprador premium — francês, brasileiro ou alemão. Lifestyle + valorização a longo prazo.'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* AVM */}
          {dtab === 'avm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <div style={{ padding: '1rem', background: '#fff', borderRadius: 10, border: '1px solid rgba(14,14,13,.08)', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.5rem' }}>AVALIAÇÃO AUTOMÁTICA (AVM)</div>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.8rem', color: '#1c4a35', fontWeight: 600 }}>{fmtPreco(avmValue)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.3rem' }}>
                  <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: avmDiff >= 0 ? '#1c4a35' : '#c0392b', fontWeight: 600 }}>
                    {avmDiff >= 0 ? '+' : ''}{avmDiff}% vs. pedido
                  </span>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)' }}>
                    {avmDiff > 5 ? '— preço abaixo de mercado' : avmDiff < -5 ? '— preço acima de mercado' : '— preço justo de mercado'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                <div style={{ padding: '.75rem', background: 'rgba(28,74,53,.05)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)' }}>VALOR MÍNIMO</div>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: '#0e0e0d', fontWeight: 600 }}>{fmtPreco(Math.round(avmValue * 0.93))}</div>
                </div>
                <div style={{ padding: '.75rem', background: 'rgba(201,169,110,.08)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)' }}>VALOR MÁXIMO</div>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(Math.round(avmValue * 1.07))}</div>
                </div>
              </div>
              <div style={{ padding: '.75rem', background: 'rgba(14,14,13,.03)', borderRadius: 8 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.25rem' }}>YIELD ESTIMADO (AL)</div>
                <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600 }}>
                  {(3.5 + (p.preco % 1000) / 1000).toFixed(1)}% bruto anual
                </div>
              </div>
            </div>
          )}

          {/* MATCHING */}
          {dtab === 'matching' && (
            <div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.75rem', letterSpacing: '.06em' }}>
                TOP COMPRADORES COMPATÍVEIS (CRM)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {BUYER_MATCHES.map((b, i) => (
                  <div key={i} style={{ padding: '.85rem 1rem', background: '#fff', borderRadius: 10, border: '1px solid rgba(14,14,13,.08)', display: 'flex', alignItems: 'center', gap: '.75rem', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(28,74,53,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      {b.nationality}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600 }}>{b.name}</div>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.45)' }}>Budget {b.budget}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.3rem', color: b.score >= 90 ? '#1c4a35' : '#c9a96e', fontWeight: 600 }}>{b.score}%</div>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.35)' }}>match</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EDITAR */}
          {dtab === 'editar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Basic fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Nome</label>
                  <input className="p-inp" value={editNome} onChange={e => setEditNome(e.target.value)} />
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Referência</label>
                  <input className="p-inp" value={editRef} onChange={e => setEditRef(e.target.value)} />
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Tipo</label>
                  <select className="p-sel" value={editTipo} onChange={e => setEditTipo(e.target.value)}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Zona</label>
                  <select className="p-sel" value={editZona} onChange={e => setEditZona(e.target.value)}>
                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Bairro</label>
                  <input className="p-inp" value={editBairro} onChange={e => setEditBairro(e.target.value)} />
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Preço (€)</label>
                  <input className="p-inp" value={editPreco} onChange={e => setEditPreco(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Área (m²)</label>
                  <input className="p-inp" type="number" value={editArea} onChange={e => setEditArea(e.target.value)} />
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Quartos</label>
                  <select className="p-sel" value={editQuartos} onChange={e => setEditQuartos(Number(e.target.value))}>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>T{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Casas de Banho</label>
                  <select className="p-sel" value={editWcs} onChange={e => setEditWcs(Number(e.target.value))}>
                    {[0,1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Badge</label>
                  <select className="p-sel" value={editBadge} onChange={e => setEditBadge(e.target.value)}>
                    {['', 'Novo', 'Destaque', 'Exclusivo', 'Off-Market', 'Redução', 'Urgente'].map(b => <option key={b} value={b}>{b || '— Nenhum —'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Status</label>
                  <select className="p-sel" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    {['Ativo', 'Sob Proposta', 'Reservado', 'Vendido'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Feature toggles */}
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)', marginBottom: '.4rem', letterSpacing: '.06em' }}>CARACTERÍSTICAS</div>
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                  {([
                    ['Piscina', editPiscina, setEditPiscina],
                    ['Garagem', editGaragem, setEditGaragem],
                    ['Jardim', editJardim, setEditJardim],
                    ['Terraço', editTerraco, setEditTerraco],
                  ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
                    <button key={label} type="button" onClick={() => setter(!val)}
                      style={{
                        fontFamily: 'var(--font-jost)', fontSize: '.76rem', padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                        border: `1.5px solid ${val ? '#1c4a35' : 'rgba(14,14,13,.15)'}`,
                        background: val ? '#1c4a35' : 'transparent',
                        color: val ? '#fff' : 'rgba(14,14,13,.55)', transition: 'all .15s',
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Descrição do Imóvel</label>
                <textarea
                  value={editDescricao}
                  onChange={e => setEditDescricao(e.target.value)}
                  placeholder="Descrição completa para partilha com clientes (aparece no link de partilha)…"
                  rows={5}
                  style={{
                    width: '100%', fontFamily: 'var(--font-jost)', fontSize: '.82rem',
                    border: '1px solid rgba(14,14,13,.15)', borderRadius: 8, padding: '.55rem .7rem',
                    background: '#fafafa', color: '#0e0e0d', resize: 'vertical', lineHeight: 1.5,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Photos management */}
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)', marginBottom: '.4rem', letterSpacing: '.06em' }}>FOTOS (arrasta para reordenar)</div>
                <input ref={editPhotoRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => uploadEditPhoto(e.target.files)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.4rem' }}>
                  {editPhotos.map((url, i) => (
                    <div key={url} draggable
                      onDragStart={() => { setEditDragIdx(i); setEditDropIdx(null) }}
                      onDragOver={e => { e.preventDefault(); if (editDropIdx !== i) setEditDropIdx(i) }}
                      onDragLeave={() => setEditDropIdx(null)}
                      onDrop={e => {
                        e.preventDefault()
                        if (editDragIdx === null || editDragIdx === i) { setEditDragIdx(null); setEditDropIdx(null); return }
                        setEditPhotos(prev => { const n=[...prev]; const [m]=n.splice(editDragIdx,1); n.splice(i,0,m); return n })
                        setEditDragIdx(null); setEditDropIdx(null)
                      }}
                      onDragEnd={() => { setEditDragIdx(null); setEditDropIdx(null) }}
                      style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', cursor: 'grab', opacity: editDragIdx === i ? 0.5 : 1, outline: editDropIdx === i ? '2px solid #c9a96e' : 'none' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                      {i === 0 && <div style={{ position: 'absolute', top: 3, left: 3, background: '#c9a96e', borderRadius: 3, padding: '1px 5px', fontFamily: 'var(--font-jost)', fontSize: '.58rem', fontWeight: 700, color: '#fff' }}>CAPA</div>}
                      <button type="button" onClick={() => setEditPhotos(prev => prev.filter((_,j) => j !== i))}
                        style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(14,14,13,.75)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                  <div onClick={() => editPhotoRef.current?.click()}
                    style={{ aspectRatio: '4/3', borderRadius: 6, border: '2px dashed rgba(14,14,13,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: editUploading ? 'wait' : 'pointer', background: 'rgba(14,14,13,.02)' }}>
                    <span style={{ fontSize: editUploading ? '.65rem' : '1.1rem', color: 'rgba(14,14,13,.3)' }}>{editUploading ? 'A carregar…' : '＋'}</span>
                  </div>
                </div>
              </div>

              {/* Save */}
              <button type="button" onClick={handleSave}
                className="p-btn-gold"
                style={{ marginTop: '.25rem', fontSize: '.85rem', fontWeight: 600, background: editSaved ? '#1c4a35' : undefined, borderColor: editSaved ? '#1c4a35' : undefined }}>
                {editSaved ? '✓ Guardado' : 'Guardar Alterações'}
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(14,14,13,.08)', background: '#fff', flexShrink: 0 }}>
          {actionToast && (
            <div style={{ marginBottom: '.65rem', padding: '.45rem .75rem', background: '#1c4a35', borderRadius: 8, fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: '#fff', textAlign: 'center' }}>
              {actionToast}
            </div>
          )}
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="p-btn-gold"
              onClick={() => { switchTab('matching'); setActionToast('A abrir Pipeline…'); setTimeout(() => setActionToast(''), 1800) }}
              style={{ fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <IconPipeline /> Pipeline
            </button>
            <button type="button" className="p-btn"
              onClick={async () => {
                const shareData = {
                  ref: p.ref, nome: p.nome, zona: p.zona, bairro: p.bairro,
                  tipo: p.tipo, preco: p.preco, area: p.area,
                  quartos: p.quartos, casasBanho: p.casasBanho,
                  badge: p.badge, status: p.status,
                  piscina: p.piscina, garagem: p.garagem,
                  jardim: p.jardim, terraco: p.terraco,
                  listingDate: p.listingDate,
                  imagens: p.imagens,
                  descricao: p.descricao,
                }
                try {
                  const res = await fetch('/api/partilhar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(shareData),
                  })
                  const json = await res.json()
                  const shareUrl = json.id
                    ? `${window.location.origin}/partilhar/${json.id}`
                    : `${window.location.origin}/partilhar?d=${encodeURIComponent(JSON.stringify(shareData))}`
                  navigator.clipboard.writeText(shareUrl).catch(() => {})
                } catch {
                  const encoded = encodeURIComponent(JSON.stringify(shareData))
                  navigator.clipboard.writeText(`${window.location.origin}/partilhar?d=${encoded}`).catch(() => {})
                }
                setCopiedLink(true)
                setActionToast(`✓ Link copiado: ${p.ref}`)
                setTimeout(() => { setCopiedLink(false); setActionToast('') }, 2500)
              }}
              style={{ fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: '.35rem', background: copiedLink ? '#eaf4ee' : undefined, borderColor: copiedLink ? '#1c4a35' : undefined, color: copiedLink ? '#1c4a35' : undefined }}>
              <IconShare /> {copiedLink ? '✓ Copiado' : 'Partilhar'}
            </button>
            <button type="button" className="p-btn"
              onClick={async () => {
                const shareData = {
                  ref: p.ref, nome: p.nome, zona: p.zona, bairro: p.bairro,
                  tipo: p.tipo, preco: p.preco, area: p.area,
                  quartos: p.quartos, casasBanho: p.casasBanho,
                  badge: p.badge, status: p.status,
                  piscina: p.piscina, garagem: p.garagem,
                  jardim: p.jardim, terraco: p.terraco,
                  imagens: p.imagens,
                  descricao: p.descricao,
                }
                try {
                  const res = await fetch('/api/partilhar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(shareData),
                  })
                  const json = await res.json()
                  const shareUrl = json.id
                    ? `${window.location.origin}/partilhar/${json.id}`
                    : `${window.location.origin}/partilhar?d=${encodeURIComponent(JSON.stringify(shareData))}`
                  window.open(shareUrl, '_blank')
                } catch {
                  const encoded = encodeURIComponent(JSON.stringify(shareData))
                  window.open(`${window.location.origin}/partilhar?d=${encoded}`, '_blank')
                }
                setActionToast('A abrir página pública…')
                setTimeout(() => setActionToast(''), 1800)
              }}
              style={{ fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <IconEye /> Ver no Site
            </button>
            <button type="button" className="p-btn"
              onClick={() => { switchTab('editar'); setActionToast('A abrir editor…'); setTimeout(() => setActionToast(''), 1800) }}
              style={{ fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <IconEdit /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── AddImovelModal ─────────────────────────────────────────────────────────

// ── Step progress bar ──────────────────────────────────────────────────────────
function StepBar({ step, total }: { step: number; total: number }) {
  const labels = ['Identificação', 'Detalhes', 'Média']
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.6rem' }}>
        {labels.map((l, i) => (
          <span key={l} style={{
            fontFamily: 'var(--font-jost)', fontSize: '.7rem', letterSpacing: '.06em', textTransform: 'uppercase',
            color: i + 1 === step ? '#1c4a35' : i + 1 < step ? '#c9a96e' : 'rgba(14,14,13,.3)',
            fontWeight: i + 1 === step ? 600 : 400, transition: 'color .25s',
          }}>{i + 1}. {l}</span>
        ))}
      </div>
      {/* Track */}
      <div style={{ height: 3, background: 'rgba(14,14,13,.08)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${((step - 1) / (total - 1)) * 100}%`,
          background: 'linear-gradient(90deg,#1c4a35,#c9a96e)',
          borderRadius: 2, transition: 'width .4s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.4rem' }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', transition: 'all .25s',
            background: i + 1 <= step ? (i + 1 < step ? '#c9a96e' : '#1c4a35') : 'rgba(14,14,13,.12)',
            boxShadow: i + 1 === step ? '0 0 0 3px rgba(28,74,53,.15)' : 'none',
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Visual selector (quartos / wcs) ───────────────────────────────────────────
function NumSelector({ value, onChange, min = 0, max = 6, prefix = '' }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; prefix?: string
}) {
  return (
    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{
            fontFamily: 'var(--font-jost)', fontSize: '.8rem', fontWeight: 500,
            width: 40, height: 36, borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
            border: `1.5px solid ${value === n ? '#1c4a35' : 'rgba(14,14,13,.12)'}`,
            background: value === n ? '#1c4a35' : 'transparent',
            color: value === n ? '#fff' : 'rgba(14,14,13,.6)',
          }}>{prefix}{n}</button>
      ))}
    </div>
  )
}

// ── Energia badge ─────────────────────────────────────────────────────────────
const ENERGIA_COLORS: Record<string, string> = {
  'A+': '#006400', 'A': '#00a000', 'B': '#50c000',
  'B-': '#c0e000', 'C': '#e0c000', 'D': '#e08000',
  'E': '#e04000', 'F': '#c00000', 'Isento': '#888',
}

function AddImovelModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: ImovelFull) => void }) {
  const TOTAL_STEPS = 3
  const [step, setStep] = useState(1)

  // ── Step 1: Identificação ──────────────────────────────────────────────────
  const [nome, setNome]   = useState('')
  const [zona, setZona]   = useState('Lisboa')
  const [bairro, setBairro] = useState('')
  const [tipo, setTipo]   = useState('Apartamento')
  const [badge, setBadge] = useState('Novo')

  // ── Step 2: Detalhes ───────────────────────────────────────────────────────
  const [preco, setPreco]   = useState('')
  const [area, setArea]     = useState('')
  const [quartos, setQuartos] = useState(2)
  const [wcs, setWcs]         = useState(2)
  const [andar, setAndar]     = useState('')
  const [anoConstrucao, setAnoConstrucao] = useState('')
  const [energia, setEnergia] = useState('B')
  const [vista, setVista]     = useState('')
  const [piscina, setPiscina] = useState(false)
  const [piscinaAquecida, setPiscinaAquecida] = useState(false)
  const [garagem, setGaragem] = useState(false)
  const [jardim, setJardim]   = useState(false)
  const [terraco, setTerraco] = useState(false)
  const [vistaMar, setVistaMar] = useState(false)
  const [spa, setSpa]           = useState(false)
  const [ginasio, setGinasio]   = useState(false)
  const [lareira, setLareira]   = useState(false)
  const [domotica, setDomotica] = useState(false)
  const [elevador, setElevador] = useState(false)
  const [arCondicionado, setArCondicionado] = useState(false)
  const [descr, setDescr]         = useState('')
  const [generating, setGenerating] = useState(false)
  const [refExterna, setRefExterna] = useState('')

  // ── Step 3: Média ──────────────────────────────────────────────────────────
  const [photos, setPhotos]     = useState<string[]>([])
  const [videoUrls, setVideoUrls] = useState<string[]>([])
  const [tourUrl, setTourUrl]   = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploading, setUploading]   = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [draggingPhotos, setDraggingPhotos] = useState(false)
  const [draggingVideos, setDraggingVideos] = useState(false)
  const [dragPhotoIdx, setDragPhotoIdx] = useState<number | null>(null)
  const [dropPhotoIdx, setDropPhotoIdx] = useState<number | null>(null)
  const [mediaTab, setMediaTab] = useState<'fotos' | 'videos' | 'tour'>('fotos')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // ── Validation ─────────────────────────────────────────────────────────────
  const step1Valid = nome.trim().length > 0
  const step2Valid = preco.replace(/\D/g, '').length > 0 && area.length > 0
  const canSubmit  = step1Valid && step2Valid

  // ── Format price ───────────────────────────────────────────────────────────
  function formatPrice(raw: string) {
    const n = raw.replace(/\D/g, '')
    return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // ── Generate description ───────────────────────────────────────────────────
  function generateDesc() {
    if (!nome) return
    setGenerating(true)
    const feats = [
      piscina && 'piscina privada', piscinaAquecida && 'piscina aquecida', jardim && 'jardim',
      terraco && 'terraço panorâmico', vistaMar && 'vista mar', spa && 'spa', garagem && 'garagem',
    ].filter(Boolean).join(', ')
    setTimeout(() => {
      setDescr(`${nome} — imóvel ${tipo.toLowerCase()} de referência em ${bairro || zona}. ${area}m² distribuídos por T${quartos}, ${wcs} casas de banho.${feats ? ` Equipado com ${feats}.` : ''} Acabamentos premium, arquitectura contemporânea. Certificado energético ${energia}. Localização privilegiada em ${zona}. Referência única para investidores e compradores de lifestyle exigente.`)
      setGenerating(false)
    }, 1400)
  }

  // ── Upload files ───────────────────────────────────────────────────────────
  async function uploadFiles(files: FileList | File[], kind: 'photos' | 'videos') {
    const arr = Array.from(files)
    if (!arr.length) return
    setUploading(true)
    setUploadError('')
    setUploadProgress(0)
    const newPhotos: string[] = []
    const newVideos: string[] = []
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/properties/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) { setUploadError(json.error ?? 'Erro no upload'); continue }
        if (json.type === 'video') newVideos.push(json.url)
        else newPhotos.push(json.url)
        setUploadProgress(Math.round(((i + 1) / arr.length) * 100))
      } catch {
        setUploadError('Erro de ligação. Tente novamente.')
      }
    }
    if (kind === 'photos') setPhotos(prev => [...prev, ...newPhotos])
    else setVideoUrls(prev => [...prev, ...newVideos])
    setUploading(false)
    setUploadProgress(0)
  }

  // ── Handle submit ──────────────────────────────────────────────────────────
  function handleAdd() {
    if (!canSubmit) return
    const features: string[] = [
      piscina && 'Piscina', piscinaAquecida && 'Piscina Aquecida', garagem && 'Garagem',
      jardim && 'Jardim', terraco && 'Terraço', vistaMar && 'Vista Mar', spa && 'Spa',
      ginasio && 'Ginásio', lareira && 'Lareira', domotica && 'Domótica',
      elevador && 'Elevador', arCondicionado && 'Ar Condicionado',
    ].filter(Boolean) as string[]

    const p: ImovelFull = {
      id: `custom-${Date.now()}`,
      ref: refExterna || `AG-CUSTOM-${Date.now().toString().slice(-4)}`,
      nome: nome.trim(),
      zona, bairro: bairro.trim() || zona,
      tipo, preco: Number(preco.replace(/\D/g, '')),
      area: Number(area), quartos, casasBanho: wcs, badge,
      status: 'Ativo', piscina, garagem, jardim, terraco,
      listingDate: new Date().toISOString(),
      viewsCount: 0, isCustom: true,
      imagens: photos, videoUrls,
    }
    onAdd(p)
    onClose()
  }

  // ── Shared input style ─────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-jost)', fontSize: '.85rem',
    background: 'rgba(14,14,13,.03)', border: '1.5px solid rgba(14,14,13,.12)', borderRadius: 10,
    padding: '9px 13px', color: '#0e0e0d', outline: 'none', transition: 'border-color .15s',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-jost)', fontSize: '.72rem', fontWeight: 600,
    letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(14,14,13,.45)', marginBottom: '.35rem',
  }
  const feat = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--font-jost)', fontSize: '.78rem', padding: '6px 13px', borderRadius: 20,
    cursor: 'pointer', border: `1.5px solid ${active ? '#1c4a35' : 'rgba(14,14,13,.12)'}`,
    background: active ? '#1c4a35' : 'transparent', color: active ? '#fff' : 'rgba(14,14,13,.55)',
    transition: 'all .15s', whiteSpace: 'nowrap' as const,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,13,.65)', backdropFilter: 'blur(6px)' }} />

      {/* Modal card */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 680, maxHeight: '92vh', zIndex: 1,
        background: '#fafaf8', borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(201,169,110,.2)',
        boxShadow: '0 24px 64px rgba(14,14,13,.18), 0 8px 24px rgba(14,14,13,.1)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '1.5rem 1.75rem 0', background: '#fff',
          borderBottom: '1px solid rgba(14,14,13,.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.75rem', color: '#0e0e0d', fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
                Novo Imóvel
              </h3>
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: 'rgba(14,14,13,.4)', margin: '4px 0 0' }}>
                Passo {step} de {TOTAL_STEPS} —&nbsp;
                {step === 1 ? 'Identificação & Localização' : step === 2 ? 'Detalhes & Características' : 'Média & Publicação'}
              </p>
            </div>
            <button type="button" onClick={onClose} style={{
              background: 'rgba(14,14,13,.06)', border: 'none', borderRadius: 8, width: 32, height: 32,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(14,14,13,.5)', marginTop: 2,
            }}>
              <IconClose />
            </button>
          </div>
          <StepBar step={step} total={TOTAL_STEPS} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem', position: 'relative' }}>

          {/* Hidden file inputs — always mounted so refs stay stable */}
          <input ref={photoInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
            style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
            onChange={e => { if (e.target.files) { uploadFiles(e.target.files, 'photos'); e.target.value = '' } }} />
          <input ref={videoInputRef} type="file" multiple accept="video/mp4,video/quicktime,video/webm"
            style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
            onChange={e => { if (e.target.files) { uploadFiles(e.target.files, 'videos'); e.target.value = '' } }} />

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Nome */}
              <div>
                <label style={lbl}>Nome do Imóvel *</label>
                <input
                  style={{ ...inp, ...(nome ? { borderColor: '#1c4a35' } : {}) }}
                  value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Penthouse Príncipe Real com Vista Rio"
                  autoFocus
                />
              </div>

              {/* Zona grid */}
              <div>
                <label style={lbl}>Zona</label>
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                  {ZONAS.map(z => (
                    <button key={z} type="button" onClick={() => setZona(z)} style={feat(zona === z)}>{z}</button>
                  ))}
                </div>
              </div>

              {/* Bairro */}
              <div>
                <label style={lbl}>Bairro / Localidade</label>
                <input style={inp} value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Chiado, Quinta da Marinha, Vilamoura…" />
              </div>

              {/* Tipo */}
              <div>
                <label style={lbl}>Tipo de Imóvel</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem' }}>
                  {[
                    { label: 'Apartamento', icon: '🏢' }, { label: 'Moradia', icon: '🏠' },
                    { label: 'Villa', icon: '🏛️' }, { label: 'Penthouse', icon: '✨' },
                    { label: 'Comercial', icon: '🏬' }, { label: 'Terreno', icon: '🌿' },
                    { label: 'Herdade', icon: '🌾' }, { label: 'Quinta', icon: '🍷' },
                  ].map(t => (
                    <button key={t.label} type="button" onClick={() => setTipo(t.label)}
                      style={{
                        fontFamily: 'var(--font-jost)', fontSize: '.75rem', padding: '8px 6px', borderRadius: 10,
                        cursor: 'pointer', transition: 'all .15s', textAlign: 'center',
                        border: `1.5px solid ${tipo === t.label ? '#1c4a35' : 'rgba(14,14,13,.1)'}`,
                        background: tipo === t.label ? '#1c4a35' : '#fff',
                        color: tipo === t.label ? '#fff' : 'rgba(14,14,13,.6)',
                        boxShadow: tipo === t.label ? '0 2px 8px rgba(28,74,53,.2)' : 'none',
                      }}>
                      <div style={{ fontSize: '1.1rem', marginBottom: 3 }}>{t.icon}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Badge + Referência */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label style={lbl}>Badge de Destaque</label>
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    {['Novo', 'Destaque', 'Exclusivo', 'Off-Market'].map(b => (
                      <button key={b} type="button" onClick={() => setBadge(b)} style={feat(badge === b)}>{b}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Referência Interna</label>
                  <input style={inp} value={refExterna} onChange={e => setRefExterna(e.target.value)} placeholder="Ex: AG-2026-001" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Preço + Área */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label style={lbl}>Preço (€) *</label>
                  <input style={{ ...inp, ...(preco ? { borderColor: '#c9a96e' } : {}) }}
                    value={preco} onChange={e => setPreco(formatPrice(e.target.value))} placeholder="1.500.000" />
                </div>
                <div>
                  <label style={lbl}>Área Total (m²) *</label>
                  <input style={inp} value={area} onChange={e => setArea(e.target.value.replace(/\D/g, ''))} placeholder="180" />
                </div>
              </div>

              {/* Quartos */}
              <div>
                <label style={lbl}>Tipologia</label>
                <NumSelector value={quartos} onChange={setQuartos} min={0} max={6} prefix="T" />
              </div>

              {/* WCs */}
              <div>
                <label style={lbl}>Casas de Banho</label>
                <NumSelector value={wcs} onChange={setWcs} min={1} max={6} />
              </div>

              {/* Andar + Ano + Energia + Vista */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label style={lbl}>Andar</label>
                  <input style={inp} value={andar} onChange={e => setAndar(e.target.value)} placeholder="Ex: 4º, Rés-do-chão…" />
                </div>
                <div>
                  <label style={lbl}>Ano de Construção</label>
                  <input style={inp} value={anoConstrucao} onChange={e => setAnoConstrucao(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="Ex: 2022" />
                </div>
                <div>
                  <label style={lbl}>Certificado Energético</label>
                  <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                    {Object.keys(ENERGIA_COLORS).map(e => (
                      <button key={e} type="button" onClick={() => setEnergia(e)}
                        style={{
                          fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', fontWeight: 700,
                          padding: '5px 9px', borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
                          background: energia === e ? ENERGIA_COLORS[e] : 'transparent',
                          border: `1.5px solid ${energia === e ? ENERGIA_COLORS[e] : 'rgba(14,14,13,.12)'}`,
                          color: energia === e ? '#fff' : 'rgba(14,14,13,.55)',
                        }}>{e}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Vista</label>
                  <input style={inp} value={vista} onChange={e => setVista(e.target.value)} placeholder="Ex: Vista Rio, Vista Mar…" />
                </div>
              </div>

              {/* Features grid */}
              <div>
                <label style={lbl}>Características & Equipamentos</label>
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Piscina', val: piscina, set: setPiscina },
                    { label: 'Piscina Aquecida', val: piscinaAquecida, set: setPiscinaAquecida },
                    { label: 'Garagem', val: garagem, set: setGaragem },
                    { label: 'Jardim', val: jardim, set: setJardim },
                    { label: 'Terraço', val: terraco, set: setTerraco },
                    { label: 'Vista Mar', val: vistaMar, set: setVistaMar },
                    { label: 'Spa', val: spa, set: setSpa },
                    { label: 'Ginásio', val: ginasio, set: setGinasio },
                    { label: 'Lareira', val: lareira, set: setLareira },
                    { label: 'Domótica', val: domotica, set: setDomotica },
                    { label: 'Elevador', val: elevador, set: setElevador },
                    { label: 'Ar Condicionado', val: arCondicionado, set: setArCondicionado },
                  ].map(f => (
                    <button key={f.label} type="button" onClick={() => f.set(!f.val)} style={feat(f.val)}>{f.label}</button>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                  <label style={{ ...lbl, margin: 0 }}>Descrição</label>
                  <button type="button" onClick={generateDesc} disabled={!nome.trim() || generating}
                    style={{
                      fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', background: 'none',
                      border: '1px solid rgba(201,169,110,.5)', borderRadius: 20, padding: '4px 12px',
                      cursor: nome.trim() ? 'pointer' : 'not-allowed', color: '#c9a96e',
                      display: 'flex', alignItems: 'center', gap: '.3rem', opacity: nome.trim() ? 1 : .4,
                    }}>
                    <IconSparkle /> {generating ? 'A gerar…' : 'Gerar com IA'}
                  </button>
                </div>
                <textarea style={{ ...inp, resize: 'vertical' }} value={descr} onChange={e => setDescr(e.target.value)}
                  rows={4} placeholder="Descrição premium do imóvel para apresentar a clientes e portais…" />
                {descr && (
                  <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.7rem', color: 'rgba(14,14,13,.35)', marginTop: '.25rem', textAlign: 'right' }}>
                    {descr.length} caracteres
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Media tabs */}
              <div style={{ display: 'flex', gap: '.5rem', borderBottom: '1px solid rgba(14,14,13,.08)', paddingBottom: '.75rem' }}>
                {([
                  { id: 'fotos' as const, label: `📷 Fotos${photos.length ? ` (${photos.length})` : ''}` },
                  { id: 'videos' as const, label: `🎬 Vídeos${videoUrls.length ? ` (${videoUrls.length})` : ''}` },
                  { id: 'tour' as const, label: '🔗 Links Externos' },
                ]).map(t => (
                  <button key={t.id} type="button" onClick={() => setMediaTab(t.id)}
                    style={{
                      fontFamily: 'var(--font-jost)', fontSize: '.8rem', fontWeight: mediaTab === t.id ? 600 : 400,
                      padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                      background: mediaTab === t.id ? '#1c4a35' : 'transparent',
                      color: mediaTab === t.id ? '#fff' : 'rgba(14,14,13,.5)',
                      border: `1.5px solid ${mediaTab === t.id ? '#1c4a35' : 'rgba(14,14,13,.12)'}`,
                      transition: 'all .15s',
                    }}>{t.label}</button>
                ))}
              </div>

              {/* ─ Photos tab ─ */}
              {mediaTab === 'fotos' && (
                <div>
                  {/* Drop zone */}
                  <div
                    onClick={e => { e.stopPropagation(); if (!uploading) photoInputRef.current?.click() }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDraggingPhotos(true) }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggingPhotos(true) }}
                    onDragLeave={e => { e.stopPropagation(); setDraggingPhotos(false) }}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); setDraggingPhotos(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files, 'photos') }}
                    style={{
                      borderRadius: 12, border: `2px dashed ${draggingPhotos ? '#c9a96e' : 'rgba(14,14,13,.15)'}`,
                      background: draggingPhotos ? 'rgba(201,169,110,.05)' : 'rgba(14,14,13,.02)',
                      minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: '.5rem', cursor: uploading ? 'wait' : 'pointer',
                      transition: 'all .2s', padding: '1.5rem',
                    }}>
                    {uploading ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#c9a96e', marginBottom: '.5rem' }}>A carregar fotos… {uploadProgress}%</div>
                        <div style={{ height: 4, background: 'rgba(14,14,13,.08)', borderRadius: 2, width: 200, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'linear-gradient(90deg,#1c4a35,#c9a96e)', borderRadius: 2, transition: 'width .3s' }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '2rem' }}>📷</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: 'rgba(14,14,13,.6)', fontWeight: 500 }}>
                            {draggingPhotos ? 'Soltar para carregar…' : 'Clique ou arraste as fotos aqui'}
                          </div>
                          <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.35)', marginTop: '.25rem' }}>
                            JPG · PNG · WEBP · HEIC · AVIF · máx. 50 MB/ficheiro
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {uploadError && mediaTab === 'fotos' && (
                    <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.75rem', color: '#e53e3e', marginTop: '.5rem', padding: '8px 12px', background: 'rgba(229,62,62,.06)', borderRadius: 8 }}>{uploadError}</div>
                  )}
                  {/* Photo grid */}
                  {photos.length > 0 && (
                    <div>
                      <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.4)', margin: '.75rem 0 .4rem', letterSpacing: '.04em' }}>
                        {photos.length} foto{photos.length > 1 ? 's' : ''} · primeira = capa principal
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem' }}>
                        {photos.map((url, i) => (
                          <div
                            key={url}
                            draggable
                            onDragStart={() => { setDragPhotoIdx(i); setDropPhotoIdx(null) }}
                            onDragOver={e => { e.preventDefault(); if (dropPhotoIdx !== i) setDropPhotoIdx(i) }}
                            onDragLeave={() => setDropPhotoIdx(null)}
                            onDrop={e => {
                              e.preventDefault()
                              if (dragPhotoIdx === null || dragPhotoIdx === i) { setDragPhotoIdx(null); setDropPhotoIdx(null); return }
                              setPhotos(prev => {
                                const n = [...prev]
                                const [moved] = n.splice(dragPhotoIdx, 1)
                                n.splice(i, 0, moved)
                                return n
                              })
                              setDragPhotoIdx(null); setDropPhotoIdx(null)
                            }}
                            onDragEnd={() => { setDragPhotoIdx(null); setDropPhotoIdx(null) }}
                            style={{
                              position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3',
                              cursor: 'grab', outline: dropPhotoIdx === i ? '2px solid #c9a96e' : 'none',
                              opacity: dragPhotoIdx === i ? 0.5 : 1, transition: 'opacity .15s, outline .1s',
                            }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                            {i === 0 && (
                              <div style={{ position: 'absolute', top: 4, left: 4, background: '#c9a96e', borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--font-jost)', fontSize: '.62rem', fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>CAPA</div>
                            )}
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,13,0)', transition: 'background .15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14,14,13,.25)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(14,14,13,0)')}>
                              <button type="button"
                                onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                                style={{
                                  position: 'absolute', top: 4, right: 4, background: 'rgba(14,14,13,.75)', border: 'none',
                                  borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', color: '#fff', fontSize: 12,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>×</button>
                            </div>
                          </div>
                        ))}
                        {/* Add more */}
                        <div onClick={e => { e.stopPropagation(); photoInputRef.current?.click() }}
                          style={{
                            borderRadius: 8, border: '2px dashed rgba(14,14,13,.12)', aspectRatio: '4/3',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            background: 'rgba(14,14,13,.02)', transition: 'border-color .15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#c9a96e')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(14,14,13,.12)')}>
                          <span style={{ fontSize: '1.2rem', color: 'rgba(14,14,13,.3)' }}>＋</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─ Videos tab ─ */}
              {mediaTab === 'videos' && (
                <div>
                  <div
                    onClick={e => { e.stopPropagation(); if (!uploading) videoInputRef.current?.click() }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDraggingVideos(true) }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggingVideos(true) }}
                    onDragLeave={e => { e.stopPropagation(); setDraggingVideos(false) }}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); setDraggingVideos(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files, 'videos') }}
                    style={{
                      borderRadius: 12, border: `2px dashed ${draggingVideos ? '#c9a96e' : 'rgba(14,14,13,.15)'}`,
                      background: draggingVideos ? 'rgba(201,169,110,.05)' : 'rgba(14,14,13,.02)',
                      minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: '.5rem', cursor: uploading ? 'wait' : 'pointer',
                      transition: 'all .2s', padding: '1.5rem',
                    }}>
                    {uploading ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#c9a96e', marginBottom: '.5rem' }}>A carregar vídeo… {uploadProgress}%</div>
                        <div style={{ height: 4, background: 'rgba(14,14,13,.08)', borderRadius: 2, width: 200, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'linear-gradient(90deg,#1c4a35,#c9a96e)', borderRadius: 2, transition: 'width .3s' }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '2rem' }}>🎬</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: 'rgba(14,14,13,.6)', fontWeight: 500 }}>
                            {draggingVideos ? 'Soltar para carregar…' : 'Clique ou arraste vídeos aqui'}
                          </div>
                          <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.35)', marginTop: '.25rem' }}>
                            MP4 · MOV · WEBM · máx. 50 MB/ficheiro
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {uploadError && mediaTab === 'videos' && (
                    <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.75rem', color: '#e53e3e', marginTop: '.5rem', padding: '8px 12px', background: 'rgba(229,62,62,.06)', borderRadius: 8 }}>{uploadError}</div>
                  )}
                  {videoUrls.length > 0 && (
                    <div style={{ marginTop: '.75rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                      {videoUrls.map((url, i) => (
                        <div key={url} style={{
                          display: 'flex', alignItems: 'center', gap: '.75rem', padding: '10px 14px',
                          background: 'rgba(14,14,13,.03)', borderRadius: 10, border: '1px solid rgba(14,14,13,.08)',
                        }}>
                          <span style={{ fontSize: '1.1rem' }}>🎬</span>
                          <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', color: 'rgba(14,14,13,.7)', flex: 1 }}>Vídeo {i + 1}</span>
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: '#c9a96e', textDecoration: 'none' }}>ver</a>
                          <button type="button" onClick={() => setVideoUrls(p => p.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.4)', fontSize: 16 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─ External links tab ─ */}
              {mediaTab === 'tour' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={lbl}>Tour Virtual (Matterport / 360°)</label>
                    <input style={inp} value={tourUrl} onChange={e => setTourUrl(e.target.value)}
                      placeholder="https://my.matterport.com/show/?m=…" />
                    <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.7rem', color: 'rgba(14,14,13,.35)', marginTop: '.3rem' }}>Matterport, Kuula, 360Cities, etc.</div>
                  </div>
                  <div>
                    <label style={lbl}>Vídeo YouTube</label>
                    <input style={inp} value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…" />
                  </div>
                  {(tourUrl || youtubeUrl) && (
                    <div style={{ padding: '12px 16px', background: 'rgba(28,74,53,.05)', borderRadius: 10, border: '1px solid rgba(28,74,53,.15)' }}>
                      <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.75rem', color: '#1c4a35', fontWeight: 600 }}>✓ Links configurados</div>
                      {tourUrl && <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)', marginTop: '.2rem' }}>Tour: {tourUrl.slice(0, 50)}…</div>}
                      {youtubeUrl && <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)', marginTop: '.2rem' }}>YouTube: {youtubeUrl.slice(0, 50)}…</div>}
                    </div>
                  )}
                  {/* Media summary */}
                  <div style={{ padding: '14px 16px', background: 'rgba(14,14,13,.02)', borderRadius: 10, border: '1px solid rgba(14,14,13,.08)' }}>
                    <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', fontWeight: 600, color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.5rem' }}>Resumo de Média</div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {[
                        { icon: '📷', count: photos.length, label: 'fotos' },
                        { icon: '🎬', count: videoUrls.length, label: 'vídeos' },
                        { icon: '🔗', count: (tourUrl ? 1 : 0) + (youtubeUrl ? 1 : 0), label: 'links' },
                      ].map(m => (
                        <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                          <span style={{ fontSize: '.9rem' }}>{m.icon}</span>
                          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.85rem', fontWeight: 700, color: m.count > 0 ? '#1c4a35' : 'rgba(14,14,13,.25)' }}>{m.count}</span>
                          <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.75rem', color: 'rgba(14,14,13,.4)' }}>{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div style={{
          padding: '1.1rem 1.75rem', borderTop: '1px solid rgba(14,14,13,.08)',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button type="button" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            style={{
              fontFamily: 'var(--font-jost)', fontSize: '.82rem', padding: '9px 20px', borderRadius: 10,
              border: '1.5px solid rgba(14,14,13,.12)', background: 'transparent', cursor: 'pointer',
              color: 'rgba(14,14,13,.6)', transition: 'all .15s',
            }}>
            {step === 1 ? 'Cancelar' : '← Anterior'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            {/* Step validation hint */}
            {step === 1 && !step1Valid && (
              <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.35)' }}>Nome obrigatório</span>
            )}
            {step === 2 && !step2Valid && (
              <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.35)' }}>Preço e área obrigatórios</span>
            )}
            {step === 3 && photos.length === 0 && (
              <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.72rem', color: 'rgba(14,14,13,.35)' }}>Fotos recomendadas</span>
            )}

            {step < TOTAL_STEPS ? (
              <button type="button"
                onClick={() => { if (step === 1 && !step1Valid) return; if (step === 2 && !step2Valid) return; setStep(s => s + 1) }}
                disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : false}
                style={{
                  fontFamily: 'var(--font-jost)', fontSize: '.82rem', fontWeight: 600,
                  padding: '9px 24px', borderRadius: 10, cursor: (step === 1 ? step1Valid : step2Valid) ? 'pointer' : 'not-allowed',
                  background: 'linear-gradient(135deg,#1c4a35,#2d6b50)',
                  border: 'none', color: '#fff', transition: 'all .2s',
                  opacity: (step === 1 ? step1Valid : step2Valid) ? 1 : .4,
                  boxShadow: (step === 1 ? step1Valid : step2Valid) ? '0 2px 8px rgba(28,74,53,.3)' : 'none',
                }}>
                Seguinte →
              </button>
            ) : (
              <button type="button" onClick={handleAdd} disabled={!canSubmit || uploading}
                style={{
                  fontFamily: 'var(--font-jost)', fontSize: '.82rem', fontWeight: 600,
                  padding: '9px 24px', borderRadius: 10, cursor: canSubmit && !uploading ? 'pointer' : 'not-allowed',
                  background: 'linear-gradient(135deg,#b8852a,#c9a96e)',
                  border: 'none', color: '#fff', transition: 'all .2s',
                  opacity: canSubmit && !uploading ? 1 : .45,
                  boxShadow: canSubmit ? '0 2px 8px rgba(201,169,110,.35)' : 'none',
                }}>
                ✓ Adicionar Imóvel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Map View ─────────────────────────────────────────────────────────────────

function MapView({ properties, onSelect }: { properties: ImovelFull[]; onSelect: (p: ImovelFull) => void }) {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const [heatMap, setHeatMap] = useState(false)

  const heatZones = [
    { x: 148, y: 248, r: 35, zone: 'Lisboa', intensity: 0.7 },
    { x: 128, y: 234, r: 22, zone: 'Cascais', intensity: 0.55 },
    { x: 188, y: 118, r: 25, zone: 'Porto', intensity: 0.6 },
    { x: 168, y: 378, r: 28, zone: 'Algarve', intensity: 0.5 },
    { x: 298, y: 208, r: 18, zone: 'Madeira', intensity: 0.45 },
  ]

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: 'rgba(14,14,13,.55)' }}>
          {properties.length} imóveis no mapa
        </div>
        <button type="button" onClick={() => setHeatMap(!heatMap)}
          style={{
            fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1px solid ${heatMap ? '#c9a96e' : 'rgba(14,14,13,.15)'}`,
            background: heatMap ? 'rgba(201,169,110,.12)' : 'transparent',
            color: heatMap ? '#b8852a' : 'rgba(14,14,13,.55)',
            transition: 'all .2s',
          }}>
          Heat Map {heatMap ? 'Activo' : 'Inactivo'}
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(14,14,13,.1)', overflow: 'hidden', position: 'relative', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
        <svg viewBox="0 0 400 480" style={{ width: '100%', maxHeight: 520 }}>
          {/* Portugal mainland + islands outline (simplified) */}
          <defs>
            <radialGradient id="hg1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background */}
          <rect width="400" height="480" fill="#eef2f7" />

          {/* Atlantic */}
          <rect width="400" height="480" fill="#dbeafe" opacity=".3" />

          {/* Portugal mainland — simplified polygon */}
          <path
            d="M100 60 L105 58 L115 55 L125 52 L135 50 L145 48 L155 47 L165 45 L175 44 L185 45 L195 47 L200 50 L202 55 L203 62 L204 70 L205 80 L207 90 L208 100 L210 110 L212 120 L213 130 L213 140 L212 150 L210 160 L208 170 L206 180 L205 190 L204 200 L204 210 L205 220 L206 230 L207 240 L207 250 L206 260 L204 270 L202 280 L200 290 L198 300 L196 310 L194 320 L193 330 L194 340 L196 350 L197 360 L196 370 L193 380 L189 388 L184 393 L178 395 L172 394 L166 390 L161 384 L157 376 L155 368 L154 360 L154 350 L155 340 L157 330 L158 320 L157 310 L154 300 L150 292 L145 285 L140 280 L134 276 L128 273 L122 270 L116 267 L110 263 L105 258 L102 252 L100 244 L100 234 L101 224 L103 215 L106 207 L108 200 L110 193 L110 185 L108 178 L106 170 L105 162 L105 153 L106 143 L106 133 L105 123 L104 113 L103 103 L102 93 L101 83 L100 73 Z"
            fill="#e8f0e4" stroke="#c8d8c0" strokeWidth=".8"
          />

          {/* Zone highlight circles */}
          {heatMap && heatZones.map((hz, i) => (
            <circle key={i} cx={hz.x} cy={hz.y} r={hz.r} fill="url(#hg1)" opacity={hz.intensity} />
          ))}

          {/* Zone labels */}
          {[
            { x: 168, y: 270, label: 'Lisboa' },
            { x: 128, y: 220, label: 'Cascais' },
            { x: 192, y: 110, label: 'Porto' },
            { x: 170, y: 392, label: 'Algarve' },
            { x: 298, y: 215, label: 'Madeira' },
            { x: 155, y: 330, label: 'Comporta' },
            { x: 145, y: 255, label: 'Sintra' },
          ].map((z, i) => (
            <text key={i} x={z.x} y={z.y} textAnchor="middle" fontSize="8.5" fill="rgba(28,74,53,.5)" fontFamily="sans-serif" fontWeight="500">{z.label}</text>
          ))}

          {/* Madeira island */}
          <ellipse cx="298" cy="202" rx="22" ry="12" fill="#e8f0e4" stroke="#c8d8c0" strokeWidth=".8" />
          {/* Azores island (small) */}
          <ellipse cx="50" cy="260" rx="12" ry="8" fill="#e8f0e4" stroke="#c8d8c0" strokeWidth=".8" />
          <text x="50" y="278" textAnchor="middle" fontSize="7.5" fill="rgba(28,74,53,.4)" fontFamily="sans-serif">Açores</text>

          {/* Property pins */}
          {MAP_PINS.map(pin => {
            const property = properties.find(p => p.id === pin.id)
            if (!property) return null
            const isHovered = hoveredPin === pin.id
            const bs = badgeSt(property.badge)

            return (
              <g key={pin.id} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPin(pin.id)}
                onMouseLeave={() => setHoveredPin(null)}
                onClick={() => onSelect(property)}>
                {/* Pin shadow */}
                <circle cx={pin.x} cy={pin.y + 2} r={isHovered ? 10 : 7} fill="rgba(0,0,0,.12)" />
                {/* Pin body */}
                <circle cx={pin.x} cy={pin.y} r={isHovered ? 10 : 7}
                  fill={property.badge === 'Exclusivo' ? '#c9a96e' : property.badge === 'Off-Market' ? '#1c4a35' : '#3a7bd5'}
                  stroke="#fff" strokeWidth="1.5" />
                {/* Pin dot */}
                <circle cx={pin.x} cy={pin.y} r="2.5" fill="rgba(255,255,255,.9)" />

                {/* Popup on hover */}
                {isHovered && (
                  <g>
                    <rect x={pin.x - 55} y={pin.y - 58} width={110} height={50} rx="6" fill="#0e0e0d" opacity=".9" />
                    <text x={pin.x} y={pin.y - 42} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.7)" fontFamily="sans-serif">
                      {property.nome.length > 20 ? property.nome.slice(0, 18) + '…' : property.nome}
                    </text>
                    <text x={pin.x} y={pin.y - 28} textAnchor="middle" fontSize="11" fill="#c9a96e" fontFamily="sans-serif" fontWeight="bold">
                      {fmtPreco(property.preco)}
                    </text>
                    <text x={pin.x} y={pin.y - 15} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.5)" fontFamily="sans-serif">
                      T{property.quartos} · {property.area}m²
                    </text>
                    {/* Arrow */}
                    <polygon points={`${pin.x - 5},${pin.y - 8} ${pin.x + 5},${pin.y - 8} ${pin.x},${pin.y - 2}`} fill="#0e0e0d" opacity=".9" />
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {[
            { color: '#c9a96e', label: 'Exclusivo' },
            { color: '#1c4a35', label: 'Off-Market' },
            { color: '#3a7bd5', label: 'Outros' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', background: 'rgba(255,255,255,.9)', borderRadius: 20, padding: '3px 10px', backdropFilter: 'blur(4px)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: '#0e0e0d' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PortalImoveis({ onSave }: { onSave?: (list: any[]) => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    tipo: [], zona: [], precoMin: 0, precoMax: 10_000_000, tipologia: [], estado: [], features: [],
  })
  const [sort, setSort] = useState<SortMode>('recente')
  const [selectedProperty, setSelectedProperty] = useState<ImovelFull | null>(null)
  const [drawerInitialTab, setDrawerInitialTab] = useState<DrawerTab>('info')
  const [showAddModal, setShowAddModal] = useState(false)
  const [customProperties, setCustomProperties] = useState<ImovelFull[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const s = localStorage.getItem('ag_imoveis')
      return s ? (JSON.parse(s) as ImovelFull[]) : []
    } catch { return [] }
  })
  const [liveProperties, setLiveProperties] = useState<ImovelFull[]>([])
  const [frontpageIds, setFrontpageIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const s = localStorage.getItem('ag_frontpage')
      return s ? new Set(JSON.parse(s) as string[]) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    try { localStorage.setItem('ag_imoveis', JSON.stringify(customProperties)) } catch { /* ignore */ }
    if (onSave) onSave(customProperties)
  }, [customProperties, onSave])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function loadProperties() {
      try {
        const res = await fetch('/api/properties', { signal: controller.signal })
        if (res.ok) {
          const { data } = await res.json()
          if (!cancelled && data && data.length > 0) {
            const mapped: ImovelFull[] = data.map((p: {
              id: string; nome: string; zona: string; bairro?: string; tipo: string;
              preco: number; area: number; quartos: number; casasBanho?: number;
              status: string; features?: string[]; gradient?: string;
            }, i: number) => ({
              id: p.id,
              ref: `AG-LIVE-${String(i + 1).padStart(3, '0')}`,
              nome: p.nome,
              zona: p.zona,
              bairro: p.bairro ?? p.zona,
              tipo: p.tipo,
              preco: p.preco,
              area: p.area,
              quartos: p.quartos,
              casasBanho: p.casasBanho ?? Math.max(1, p.quartos - 1),
              badge: '',
              status: p.status,
              piscina: p.features?.includes('Piscina') ?? false,
              garagem: p.features?.includes('Garagem') ?? false,
              jardim: p.features?.includes('Jardim') ?? false,
              terraco: p.features?.includes('Terraço') ?? false,
              listingDate: new Date().toISOString().slice(0, 10),
              viewsCount: 0,
            }))
            setLiveProperties(mapped)
          }
        }
      } catch { /* use static data */ }
    }
    loadProperties()
    return () => { cancelled = true; controller.abort() }
  }, [])

  const baseProperties = liveProperties.length > 0 ? liveProperties : ALL_PROPERTIES
  const customIds = new Set(customProperties.map(p => p.id))
  const allProps = [...customProperties, ...baseProperties.filter(p => !customIds.has(p.id))]

  const filtered = allProps
    .filter(p => {
      if (search && !p.nome.toLowerCase().includes(search.toLowerCase()) && !p.zona.toLowerCase().includes(search.toLowerCase()) && !p.bairro.toLowerCase().includes(search.toLowerCase())) return false
      if (filters.tipo.length > 0 && !filters.tipo.includes(p.tipo)) return false
      if (filters.zona.length > 0 && !filters.zona.includes(p.zona)) return false
      if (p.preco < filters.precoMin || p.preco > filters.precoMax) return false
      if (filters.tipologia.length > 0 && !filters.tipologia.includes(`T${p.quartos}`)) return false
      if (filters.features.includes('Piscina') && !p.piscina) return false
      if (filters.features.includes('Garagem') && !p.garagem) return false
      if (filters.features.includes('Jardim') && !p.jardim) return false
      if (filters.features.includes('Terraço') && !p.terraco) return false
      return true
    })
    .sort((a, b) => {
      if (sort === 'preco_asc') return a.preco - b.preco
      if (sort === 'preco_desc') return b.preco - a.preco
      if (sort === 'recente') return new Date(b.listingDate).getTime() - new Date(a.listingDate).getTime()
      if (sort === 'antigo') return new Date(a.listingDate).getTime() - new Date(b.listingDate).getTime()
      if (sort === 'pm2') return (a.preco / a.area) - (b.preco / b.area)
      return 0
    })

  const activeFilterCount = filters.tipo.length + filters.zona.length + filters.tipologia.length + filters.estado.length + filters.features.length +
    (filters.precoMin > 0 ? 1 : 0) + (filters.precoMax < 10_000_000 ? 1 : 0)

  const totalValue = filtered.reduce((s, p) => s + p.preco, 0)

  function handleAddProperty(p: ImovelFull) {
    setCustomProperties(prev => [p, ...prev])
  }

  function handleUpdateProperty(updated: ImovelFull) {
    setCustomProperties(prev => {
      const exists = prev.some(p => p.id === updated.id)
      return exists
        ? prev.map(p => p.id === updated.id ? updated : p)
        : [updated, ...prev]
    })
    if (selectedProperty?.id === updated.id) setSelectedProperty(updated)
  }

  function handleToggleFrontpage(id: string) {
    setFrontpageIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('ag_frontpage', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  function clearFilters() {
    setFilters({ tipo: [], zona: [], precoMin: 0, precoMax: 10_000_000, tipologia: [], estado: [], features: [] })
    setSearch('')
  }

  return (
    <div style={{ padding: '0 0 3rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '2rem', color: '#0e0e0d', fontWeight: 600, margin: '0 0 .25rem' }}>
            Imóveis
          </h1>
          <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: 'rgba(14,14,13,.5)', margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            {filtered.length} imóveis · Valor total {fmtPreco(totalValue)}
            {liveProperties.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', background: 'rgba(28,74,53,.08)', border: '1px solid rgba(28,74,53,.2)', borderRadius: 20, padding: '1px 9px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: '#1c4a35', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1c4a35', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                LIVE · Supabase
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} className="p-btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
          <IconPlus /> Adicionar Imóvel
        </button>
      </div>

      {/* Search + controls */}
      <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <div style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(14,14,13,.4)', pointerEvents: 'none' }}>
            <IconSearch />
          </div>
          <input className="p-inp" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, zona, bairro…"
            style={{ paddingLeft: '2.25rem', width: '100%' }} />
          {search && (
            <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(14,14,13,.4)' }}>
              <IconX />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button type="button" onClick={() => setFiltersOpen(!filtersOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '.4rem', fontFamily: 'var(--font-jost)', fontSize: '.84rem',
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${filtersOpen || activeFilterCount > 0 ? '#1c4a35' : 'rgba(14,14,13,.18)'}`,
            background: filtersOpen || activeFilterCount > 0 ? 'rgba(28,74,53,.07)' : '#fff',
            color: filtersOpen || activeFilterCount > 0 ? '#1c4a35' : 'rgba(14,14,13,.6)',
            transition: 'all .2s',
          }}>
          <IconFilter />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ background: '#1c4a35', color: '#fff', borderRadius: 20, padding: '1px 7px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', fontWeight: 700 }}>{activeFilterCount}</span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button type="button" onClick={clearFilters} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', background: 'none', border: '1px solid rgba(14,14,13,.15)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'rgba(14,14,13,.5)', display: 'flex', alignItems: 'center', gap: '.3rem', transition: 'all .2s' }}>
            <IconX /> Limpar
          </button>
        )}

        {/* View mode */}
        <div style={{ display: 'flex', border: '1px solid rgba(14,14,13,.15)', borderRadius: 8, overflow: 'hidden' }}>
          {([
            { id: 'grid' as ViewMode, icon: <IconGrid /> },
            { id: 'list' as ViewMode, icon: <IconList /> },
            { id: 'map' as ViewMode, icon: <IconMap /> },
          ]).map(v => (
            <button type="button" key={v.id} onClick={() => setViewMode(v.id)}
              style={{
                padding: '7px 12px', border: 'none', cursor: 'pointer',
                background: viewMode === v.id ? '#1c4a35' : '#fff',
                color: viewMode === v.id ? '#fff' : 'rgba(14,14,13,.45)',
                transition: 'all .15s',
              }}>
              {v.icon}
            </button>
          ))}
        </div>

        {/* Sort (when not using filters bar) */}
        {!filtersOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <IconSort />
            <select className="p-sel" value={sort} onChange={e => setSort(e.target.value as SortMode)} style={{ fontSize: '.8rem' }}>
              <option value="recente">Mais Recente</option>
              <option value="antigo">Mais Antigo</option>
              <option value="preco_desc">Preço ↓</option>
              <option value="preco_asc">Preço ↑</option>
              <option value="pm2">€/m²</option>
            </select>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <FiltersBar filters={filters} setFilters={setFilters} sort={sort} setSort={setSort} open={filtersOpen} />

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {[
          { label: 'Total', value: filtered.length.toString(), color: '#0e0e0d' },
          { label: 'Activos', value: filtered.filter(p => p.status === 'Ativo').length.toString(), color: '#1c4a35' },
          { label: 'Sob Proposta', value: filtered.filter(p => p.status === 'Sob Proposta').length.toString(), color: '#c9a96e' },
          { label: 'Off-Market', value: filtered.filter(p => p.badge === 'Off-Market').length.toString(), color: '#1c4a35' },
          { label: 'Exclusivos', value: filtered.filter(p => p.badge === 'Exclusivo').length.toString(), color: '#c9a96e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '.5rem .85rem', border: '1px solid rgba(14,14,13,.08)', flexShrink: 0, boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)' }}>{s.label.toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.3rem', color: s.color, fontWeight: 600, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {filtered.map(p => (
            <PropertyCard key={p.id} p={{ ...p, isFrontpage: frontpageIds.has(p.id) }} onSelect={p => { setDrawerInitialTab('info'); setSelectedProperty(p) }} onEdit={p => { setDrawerInitialTab('editar'); setSelectedProperty(p) }} onSelectAI={p => { setDrawerInitialTab('ia'); setSelectedProperty(p) }} onToggleFrontpage={handleToggleFrontpage} />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'rgba(14,14,13,.35)' }}>
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem' }}>Nenhum imóvel encontrado. Tente ajustar os filtros.</p>
              <button type="button" onClick={clearFilters} className="p-btn" style={{ marginTop: '1rem', fontSize: '.82rem' }}>Limpar Filtros</button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(14,14,13,.08)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.65rem 1.25rem', background: 'rgba(14,14,13,.03)', borderBottom: '1px solid rgba(14,14,13,.07)' }}>
            <div style={{ width: 72, flexShrink: 0 }} />
            <div style={{ flex: 2, fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>NOME</div>
            <div style={{ flex: 1, fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>TIPO</div>
            <div style={{ flex: 1, fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>TIP · ÁREA</div>
            <div style={{ flex: 1.2, fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', textAlign: 'right' }}>PREÇO</div>
            <div style={{ flex: .8, fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', textAlign: 'center' }}>DOM</div>
            <div style={{ flex: 1, fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em', textAlign: 'right' }}>BADGE</div>
          </div>
          {filtered.map(p => (
            <PropertyRow key={p.id} p={p} onSelect={p => { setDrawerInitialTab('info'); setSelectedProperty(p) }} onEdit={p => { setDrawerInitialTab('editar'); setSelectedProperty(p) }} />
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(14,14,13,.35)' }}>
              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem' }}>Nenhum imóvel encontrado.</p>
            </div>
          )}
        </div>
      )}

      {viewMode === 'map' && (
        <MapView properties={filtered} onSelect={setSelectedProperty} />
      )}

      {/* Drawer */}
      {selectedProperty && (
        <PropertyDrawer key={selectedProperty.id} p={selectedProperty} onClose={() => setSelectedProperty(null)} onUpdate={handleUpdateProperty} initialTab={drawerInitialTab} />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddImovelModal onClose={() => setShowAddModal(false)} onAdd={handleAddProperty} />
      )}
    </div>
  )
}
