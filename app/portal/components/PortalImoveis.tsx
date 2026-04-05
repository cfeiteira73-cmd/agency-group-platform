'use client'
import { useState } from 'react'
import { PORTAL_PROPERTIES } from './constants'
import { exportToPDF } from './utils'
import { useUIStore } from '../stores/uiStore'
import { useCRMStore } from '../stores/crmStore'

// ─── Types ────────────────────────────────────────────────────────────────────
type PropertyStatus = 'Ativo' | 'Sob Proposta' | 'Reservado' | 'Vendido'
type BadgeType = 'Exclusivo' | 'Off-Market' | 'Destaque' | 'Novo'
type ImoveisTab = 'lista' | 'adicionar' | 'stats' | 'comparar'

type ImovelItem = {
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPreco(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toLocaleString('pt-PT', { minimumFractionDigits: v % 1_000_000 === 0 ? 0 : 1, maximumFractionDigits: 2 })}M`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`
  return `€${v}`
}

function fmtPm2(preco: number, area: number): string {
  return `€${Math.round(preco / area).toLocaleString('pt-PT')}/m²`
}

function daysOnMarket(listingDate: string): number {
  const d = new Date(listingDate)
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function badgeColor(badge: string): { bg: string; color: string; border: string } {
  switch (badge) {
    case 'Exclusivo':  return { bg: 'rgba(201,169,110,.13)', color: '#b8945a', border: 'rgba(201,169,110,.4)' }
    case 'Off-Market': return { bg: 'rgba(28,74,53,.12)',    color: '#1c4a35', border: 'rgba(28,74,53,.35)' }
    case 'Destaque':   return { bg: 'rgba(74,156,122,.12)',  color: '#2a7a5a', border: 'rgba(74,156,122,.35)' }
    case 'Novo':       return { bg: 'rgba(58,123,213,.1)',   color: '#3a7bd5', border: 'rgba(58,123,213,.3)' }
    default:           return { bg: 'rgba(14,14,13,.07)',    color: 'rgba(14,14,13,.5)', border: 'rgba(14,14,13,.2)' }
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'Ativo':        return '#2a7a5a'
    case 'Sob Proposta': return '#c9a96e'
    case 'Reservado':    return '#3a7bd5'
    case 'Vendido':      return '#888'
    default:             return '#888'
  }
}

function cardBorderColor(badge: string): string {
  if (badge === 'Exclusivo') return '#c9a96e'
  if (badge === 'Off-Market') return '#1c4a35'
  if (badge === 'Destaque') return '#4a9c7a'
  return 'rgba(14,14,13,.08)'
}

// ─── Icon Components ──────────────────────────────────────────────────────────
const IconPool = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12h20M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
  </svg>
)
const IconCar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="1" y="11" width="22" height="8" rx="2"/><path d="M16 11l-1.8-5H9.8L8 11M5 19v2M19 19v2"/>
  </svg>
)
const IconGarden = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 22V12M12 12C12 7 7 4 3 5c1 4 4 7 9 7M12 12c0-5 5-8 9-7-1 4-4 7-9 7"/>
  </svg>
)
const IconTerrace = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="14" width="20" height="4" rx="1"/><path d="M6 14V7l3-3 3 3 3-3 3 3v7"/>
  </svg>
)
const IconBed = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 4v16M2 8h18a2 2 0 012 2v6H2M2 16h20M6 8v4"/>
  </svg>
)
const IconBath = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 6a3 3 0 114.24 2.76A3 3 0 019 6zM3 14a9 9 0 0018 0H3z"/>
  </svg>
)
const IconArea = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="1"/>
    <path d="M3 9h18M9 3v18"/>
  </svg>
)
const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
)
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
)

// ─── Badge Pill ───────────────────────────────────────────────────────────────
function BadgePill({ badge }: { badge: string }) {
  const c = badgeColor(badge)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '2px',
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      fontFamily: "'DM Mono',monospace", fontSize: '.42rem',
      letterSpacing: '.12em', textTransform: 'uppercase' as const, fontWeight: 400,
    }}>
      {badge}
    </span>
  )
}

// ─── Feature Pill ─────────────────────────────────────────────────────────────
function FeaturePill({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '2px',
      background: active ? 'rgba(28,74,53,.1)' : 'rgba(14,14,13,.05)',
      color: active ? '#1c4a35' : 'rgba(14,14,13,.3)',
      border: `1px solid ${active ? 'rgba(28,74,53,.25)' : 'rgba(14,14,13,.1)'}`,
      fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
      letterSpacing: '.08em', textTransform: 'uppercase' as const,
    }}>
      {icon}
      {label}
    </span>
  )
}

// ─── Property Card ────────────────────────────────────────────────────────────
function PropertyCard({
  imovel,
  selected,
  compareIds,
  onToggleCompare,
  onClick,
}: {
  imovel: ImovelItem
  selected: boolean
  compareIds: string[]
  onToggleCompare: (id: string) => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isInCompare = compareIds.includes(imovel.id)
  const canAddCompare = compareIds.length < 3 || isInCompare
  const borderLeft = selected
    ? '3px solid #c9a96e'
    : `3px solid ${cardBorderColor(imovel.badge)}`

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderLeft,
        border: `1px solid ${hovered ? 'rgba(28,74,53,.25)' : 'rgba(14,14,13,.08)'}`,
        borderLeft: selected ? '3px solid #c9a96e' : `3px solid ${cardBorderColor(imovel.badge)}`,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'box-shadow .2s, border .2s',
        boxShadow: hovered ? '0 4px 20px rgba(14,14,13,.08)' : '0 1px 4px rgba(14,14,13,.04)',
        position: 'relative',
      }}
    >
      {/* Compare checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); if (canAddCompare) onToggleCompare(imovel.id) }}
        style={{
          position: 'absolute', top: '12px', right: '12px',
          width: '18px', height: '18px',
          border: `1.5px solid ${isInCompare ? '#1c4a35' : 'rgba(14,14,13,.2)'}`,
          background: isInCompare ? '#1c4a35' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: canAddCompare ? 'pointer' : 'not-allowed',
          opacity: !canAddCompare ? 0.4 : 1,
          transition: 'all .2s',
          borderRadius: '2px',
        }}
        title={isInCompare ? 'Remover da comparação' : 'Adicionar à comparação'}
      >
        {isInCompare && <span style={{ color: '#fff' }}><IconCheck /></span>}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', paddingRight: '28px' }}>
        <BadgePill badge={imovel.badge} />
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.4rem',
          letterSpacing: '.1em', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase' as const,
          marginLeft: 'auto', paddingRight: '4px',
        }}>
          {imovel.ref}
        </span>
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Cormorant',serif", fontSize: '1.1rem',
        fontWeight: 400, color: '#0e0e0d', lineHeight: 1.2, marginBottom: '3px',
      }}>
        {imovel.nome}
      </div>

      {/* Location */}
      <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: '.72rem',
        color: 'rgba(14,14,13,.45)', marginBottom: '12px',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <span>{imovel.zona}</span>
        {imovel.bairro && imovel.bairro !== imovel.zona && (
          <><span style={{ opacity: .3 }}>·</span><span>{imovel.bairro}</span></>
        )}
        <span style={{
          marginLeft: 'auto',
          padding: '1px 6px', borderRadius: '1px',
          background: statusColor(imovel.status) + '18',
          color: statusColor(imovel.status),
          fontFamily: "'DM Mono',monospace", fontSize: '.38rem',
          letterSpacing: '.08em', textTransform: 'uppercase' as const,
        }}>
          {imovel.status}
        </span>
      </div>

      {/* Price */}
      <div style={{
        fontFamily: "'Cormorant',serif", fontSize: '1.4rem',
        fontWeight: 300, color: '#c9a96e', lineHeight: 1, marginBottom: '10px',
      }}>
        {fmtPreco(imovel.preco)}
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.45rem',
          color: 'rgba(14,14,13,.35)', marginLeft: '8px',
          letterSpacing: '.06em',
        }}>
          {fmtPm2(imovel.preco, imovel.area)}
        </span>
      </div>

      {/* Specs */}
      <div style={{
        display: 'flex', gap: '14px', marginBottom: '12px',
        fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
        letterSpacing: '.06em', color: 'rgba(14,14,13,.6)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconArea /> {imovel.area}m²
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconBed /> T{imovel.quartos}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconBath /> {imovel.casasBanho} WC
        </span>
      </div>

      {/* Feature icons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
        {imovel.piscina && (
          <span title="Piscina" style={{ color: '#3a7bd5', opacity: .8 }}><IconPool /></span>
        )}
        {imovel.garagem && (
          <span title="Garagem" style={{ color: 'rgba(14,14,13,.45)' }}><IconCar /></span>
        )}
        {imovel.jardim && (
          <span title="Jardim" style={{ color: '#2a7a5a' }}><IconGarden /></span>
        )}
        {imovel.terraco && (
          <span title="Terraço" style={{ color: '#c9a96e' }}><IconTerrace /></span>
        )}
      </div>

      {/* Days on market */}
      <div style={{
        marginTop: '10px', paddingTop: '10px',
        borderTop: '1px solid rgba(14,14,13,.06)',
        fontFamily: "'DM Mono',monospace", fontSize: '.42rem',
        color: 'rgba(14,14,13,.3)', letterSpacing: '.06em',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{imovel.tipo}</span>
        <span>{daysOnMarket(imovel.listingDate)}d em carteira</span>
      </div>
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  imovel,
  onClose,
  onStatusChange,
  setSection,
  crmContacts,
}: {
  imovel: ImovelItem
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
  setSection: (s: 'avm') => void
  crmContacts: Array<{ id: number; name: string; phone: string; email: string; budgetMin: number; budgetMax: number; nationality: string; status: string }>
}) {
  const STATUSES: PropertyStatus[] = ['Ativo', 'Sob Proposta', 'Reservado', 'Vendido']
  const pm2 = Math.round(imovel.preco / imovel.area)
  const dom = daysOnMarket(imovel.listingDate)

  // Matching buyers: budget overlaps price ±20%
  const priceLow = imovel.preco * 0.8
  const priceHigh = imovel.preco * 1.2
  const matchingBuyers = crmContacts.filter(
    c => c.budgetMax >= priceLow && c.budgetMin <= priceHigh
  )

  const htmlForPDF = `
    <div class="row">
      <div class="card"><div class="label">Preço</div><div class="metric">${fmtPreco(imovel.preco)}</div></div>
      <div class="card"><div class="label">Área</div><div class="metric">${imovel.area}m²</div></div>
      <div class="card"><div class="label">Preço/m²</div><div class="metric">€${pm2.toLocaleString('pt-PT')}</div></div>
    </div>
    <div class="row">
      <div class="card"><div class="label">Quartos</div><div class="metric">T${imovel.quartos}</div></div>
      <div class="card"><div class="label">WC</div><div class="metric">${imovel.casasBanho}</div></div>
      <div class="card"><div class="label">Dias Carteira</div><div class="metric">${dom}</div></div>
    </div>
    <div class="label">Zona</div><p>${imovel.zona} · ${imovel.bairro}</p>
    <div class="label">Características</div>
    <p>
      ${imovel.piscina ? '<span class="tag">Piscina</span>' : ''}
      ${imovel.garagem ? '<span class="tag">Garagem</span>' : ''}
      ${imovel.jardim ? '<span class="tag">Jardim</span>' : ''}
      ${imovel.terraco ? '<span class="tag">Terraço</span>' : ''}
    </p>
  `

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 'min(520px, 100vw)',
      background: '#fff',
      boxShadow: '-8px 0 40px rgba(14,14,13,.12)',
      zIndex: 999,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        background: '#0c1f15', padding: '24px 28px',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(244,240,230,.1)', border: 'none',
            color: '#f4f0e6', cursor: 'pointer', padding: '6px',
            display: 'flex', borderRadius: '2px',
          }}
        >
          <IconClose />
        </button>

        <div style={{ marginBottom: '8px' }}>
          <BadgePill badge={imovel.badge} />
        </div>
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '1.6rem',
          fontWeight: 300, color: '#f4f0e6', lineHeight: 1.2, marginBottom: '4px',
        }}>
          {imovel.nome}
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.45rem',
          color: 'rgba(244,240,230,.5)', letterSpacing: '.1em', textTransform: 'uppercase' as const,
          marginBottom: '16px',
        }}>
          {imovel.ref} · {imovel.zona} · {imovel.bairro}
        </div>

        {/* Price */}
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '2rem',
          fontWeight: 300, color: '#c9a96e', lineHeight: 1,
        }}>
          {fmtPreco(imovel.preco)}
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
            color: 'rgba(244,240,230,.4)', marginLeft: '10px',
          }}>
            {fmtPm2(imovel.preco, imovel.area)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Status toggle */}
        <div style={{ marginBottom: '20px' }}>
          <span className="p-label">Status</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(imovel.id, s)}
                style={{
                  padding: '6px 12px',
                  background: imovel.status === s ? statusColor(s) : 'transparent',
                  color: imovel.status === s ? '#fff' : 'rgba(14,14,13,.5)',
                  border: `1px solid ${imovel.status === s ? statusColor(s) : 'rgba(14,14,13,.15)'}`,
                  fontFamily: "'DM Mono',monospace", fontSize: '.45rem',
                  letterSpacing: '.08em', textTransform: 'uppercase' as const,
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Preço', value: fmtPreco(imovel.preco) },
            { label: 'Área', value: `${imovel.area}m²` },
            { label: 'Preço/m²', value: `€${pm2.toLocaleString('pt-PT')}` },
            { label: 'Quartos', value: `T${imovel.quartos}` },
            { label: 'WC', value: String(imovel.casasBanho) },
            { label: 'Dias Cart.', value: String(dom) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(14,14,13,.03)', border: '1px solid rgba(14,14,13,.07)',
              padding: '12px 14px',
            }}>
              <span className="p-label">{label}</span>
              <div style={{
                fontFamily: "'Cormorant',serif", fontSize: '1.3rem',
                fontWeight: 300, color: '#1c4a35', lineHeight: 1,
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div style={{ marginBottom: '20px' }}>
          <span className="p-label">Características</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
            <FeaturePill icon={<IconPool />} label="Piscina" active={imovel.piscina} />
            <FeaturePill icon={<IconCar />} label="Garagem" active={imovel.garagem} />
            <FeaturePill icon={<IconGarden />} label="Jardim" active={imovel.jardim} />
            <FeaturePill icon={<IconTerrace />} label="Terraço" active={imovel.terraco} />
          </div>
        </div>

        {/* Days on market */}
        <div style={{
          padding: '12px 16px',
          background: dom > 90 ? 'rgba(201,169,110,.08)' : 'rgba(28,74,53,.06)',
          border: `1px solid ${dom > 90 ? 'rgba(201,169,110,.25)' : 'rgba(28,74,53,.15)'}`,
          marginBottom: '20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.08em', color: 'rgba(14,14,13,.5)' }}>
            DIAS EM CARTEIRA
          </span>
          <span style={{
            fontFamily: "'Cormorant',serif", fontSize: '1.8rem',
            fontWeight: 300, color: dom > 90 ? '#c9a96e' : '#1c4a35',
          }}>
            {dom}d
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '24px' }}>
          <button
            className="p-btn"
            onClick={() => setSection('avm')}
          >
            Ver AVM
          </button>
          <button
            className="p-btn p-btn-gold"
            onClick={() => exportToPDF(`Ficha ${imovel.ref}`, htmlForPDF)}
          >
            Exportar PDF
          </button>
          <button
            className="p-btn"
            style={{ background: 'rgba(14,14,13,.07)', color: '#0e0e0d' }}
            onClick={() => {/* CMA placeholder */}}
          >
            Pedir CMA
          </button>
        </div>

        {/* Matching buyers */}
        <div>
          <span className="p-label">
            Matching CRM — Compradores ({matchingBuyers.length})
          </span>
          {matchingBuyers.length === 0 ? (
            <div style={{
              padding: '16px', background: 'rgba(14,14,13,.03)',
              border: '1px solid rgba(14,14,13,.07)',
              fontFamily: "'Jost',sans-serif", fontSize: '.8rem',
              color: 'rgba(14,14,13,.4)', textAlign: 'center' as const,
            }}>
              Sem compradores com budget compatível
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {matchingBuyers.map(buyer => (
                <div key={buyer.id} style={{
                  background: '#fff', border: '1px solid rgba(14,14,13,.08)',
                  padding: '12px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{
                      fontFamily: "'Jost',sans-serif", fontSize: '.85rem',
                      fontWeight: 500, color: '#0e0e0d', marginBottom: '2px',
                    }}>
                      {buyer.name}
                    </div>
                    <div style={{
                      fontFamily: "'DM Mono',monospace", fontSize: '.44rem',
                      color: 'rgba(14,14,13,.4)', letterSpacing: '.06em',
                    }}>
                      {buyer.nationality} · {fmtPreco(buyer.budgetMin)}–{fmtPreco(buyer.budgetMax)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <a
                      href={`tel:${buyer.phone}`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        padding: '5px 10px', background: 'rgba(28,74,53,.08)',
                        color: '#1c4a35', border: '1px solid rgba(28,74,53,.2)',
                        fontFamily: "'DM Mono',monospace", fontSize: '.42rem',
                        letterSpacing: '.08em', textDecoration: 'none',
                        textTransform: 'uppercase' as const,
                      }}
                    >
                      Ligar
                    </a>
                    <a
                      href={`https://wa.me/${buyer.phone.replace(/\s+/g, '').replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        padding: '5px 10px', background: 'rgba(201,169,110,.1)',
                        color: '#b8945a', border: '1px solid rgba(201,169,110,.3)',
                        fontFamily: "'DM Mono',monospace", fontSize: '.42rem',
                        letterSpacing: '.08em', textDecoration: 'none',
                        textTransform: 'uppercase' as const,
                      }}
                    >
                      WA
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({ imoveisList }: { imoveisList: ImovelItem[] }) {
  const totalValue = imoveisList.reduce((a, p) => a + p.preco, 0)
  const avgPm2 = Math.round(imoveisList.reduce((a, p) => a + p.preco / p.area, 0) / imoveisList.length)
  const maxDom = Math.max(...imoveisList.map(p => daysOnMarket(p.listingDate)))
  const avgDom = Math.round(imoveisList.reduce((a, p) => a + daysOnMarket(p.listingDate), 0) / imoveisList.length)

  // By zona
  const zonaMap: Record<string, { count: number; value: number }> = {}
  imoveisList.forEach(p => {
    if (!zonaMap[p.zona]) zonaMap[p.zona] = { count: 0, value: 0 }
    zonaMap[p.zona].count++
    zonaMap[p.zona].value += p.preco
  })
  const zonas = Object.entries(zonaMap).sort((a, b) => b[1].count - a[1].count)
  const maxCount = Math.max(...zonas.map(([, v]) => v.count))

  // By tipo
  const tipoMap: Record<string, number> = {}
  imoveisList.forEach(p => {
    tipoMap[p.tipo] = (tipoMap[p.tipo] || 0) + 1
  })
  const tipos = Object.entries(tipoMap).sort((a, b) => b[1] - a[1])

  // By status
  const statusMap: Record<string, number> = {}
  imoveisList.forEach(p => {
    statusMap[p.status] = (statusMap[p.status] || 0) + 1
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px' }}>
      {/* KPI cards */}
      <div className="p-card">
        <span className="p-label">Carteira Total</span>
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '2.4rem',
          fontWeight: 300, color: '#1c4a35', lineHeight: 1,
        }}>
          {fmtPreco(totalValue)}
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
          color: 'rgba(14,14,13,.4)', marginTop: '4px', letterSpacing: '.06em',
        }}>
          {imoveisList.length} imóveis · {fmtPreco(totalValue / imoveisList.length)} médio
        </div>
      </div>

      <div className="p-card">
        <span className="p-label">Preço Médio/m²</span>
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '2.4rem',
          fontWeight: 300, color: '#c9a96e', lineHeight: 1,
        }}>
          €{avgPm2.toLocaleString('pt-PT')}
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
          color: 'rgba(14,14,13,.4)', marginTop: '4px', letterSpacing: '.06em',
        }}>
          Mercado Lisboa 2026: €5.000/m²
        </div>
      </div>

      <div className="p-card">
        <span className="p-label">Dias em Carteira</span>
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '2.4rem',
          fontWeight: 300, color: '#0e0e0d', lineHeight: 1,
        }}>
          {avgDom}d
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
          color: 'rgba(14,14,13,.4)', marginTop: '4px', letterSpacing: '.06em',
        }}>
          Máx: {maxDom}d · Média mercado: 210d
        </div>
      </div>

      {/* By status */}
      <div className="p-card">
        <span className="p-label">Por Status</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {Object.entries(statusMap).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: statusColor(status), flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
                color: 'rgba(14,14,13,.6)', letterSpacing: '.06em',
                textTransform: 'uppercase' as const, width: '100px', flexShrink: 0,
              }}>
                {status}
              </span>
              <div style={{
                flex: 1, height: '6px', background: 'rgba(14,14,13,.06)', borderRadius: '2px',
              }}>
                <div style={{
                  height: '100%', width: `${(count / imoveisList.length) * 100}%`,
                  background: statusColor(status), borderRadius: '2px',
                  transition: 'width .4s',
                }} />
              </div>
              <span style={{
                fontFamily: "'Cormorant',serif", fontSize: '1.1rem',
                color: '#0e0e0d', fontWeight: 300, minWidth: '24px', textAlign: 'right' as const,
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By zona */}
      <div className="p-card" style={{ gridColumn: 'span 2' as const }}>
        <span className="p-label">Distribuição por Zona</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {zonas.map(([zona, data]) => (
            <div key={zona} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
                color: 'rgba(14,14,13,.6)', letterSpacing: '.06em',
                textTransform: 'uppercase' as const, width: '90px', flexShrink: 0,
              }}>
                {zona}
              </span>
              <div style={{
                flex: 1, height: '8px', background: 'rgba(14,14,13,.06)', borderRadius: '2px',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(data.count / maxCount) * 100}%`,
                  background: 'linear-gradient(90deg,#1c4a35,#4a9c7a)',
                  borderRadius: '2px', transition: 'width .4s',
                }} />
              </div>
              <div style={{
                fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
                color: 'rgba(14,14,13,.5)', letterSpacing: '.04em', minWidth: '90px',
                textAlign: 'right' as const,
              }}>
                {data.count} · {fmtPreco(data.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By tipo */}
      <div className="p-card">
        <span className="p-label">Por Tipo</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {tipos.map(([tipo, count]) => (
            <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
                color: 'rgba(14,14,13,.6)', letterSpacing: '.06em',
                textTransform: 'uppercase' as const, width: '90px', flexShrink: 0,
              }}>
                {tipo}
              </span>
              <div style={{ flex: 1, height: '6px', background: 'rgba(14,14,13,.06)', borderRadius: '2px' }}>
                <div style={{
                  height: '100%', width: `${(count / imoveisList.length) * 100}%`,
                  background: '#c9a96e', borderRadius: '2px',
                }} />
              </div>
              <span style={{
                fontFamily: "'Cormorant',serif", fontSize: '1.1rem',
                color: '#0e0e0d', fontWeight: 300,
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Compare Tab ──────────────────────────────────────────────────────────────
function CompareTab({ compareIds, imoveisList, onClear }: {
  compareIds: string[]
  imoveisList: ImovelItem[]
  onClear: () => void
}) {
  const props = compareIds.map(id => imoveisList.find(p => p.id === id)).filter((p): p is ImovelItem => !!p)

  if (props.length < 2) {
    return (
      <div className="p-card" style={{ textAlign: 'center' as const, padding: '60px 40px' }}>
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '1.4rem',
          color: 'rgba(14,14,13,.35)', marginBottom: '8px',
        }}>
          Selecione 2 a 3 imóveis para comparar
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
          color: 'rgba(14,14,13,.3)', letterSpacing: '.08em',
        }}>
          USE A CHECKBOX NOS CARTÕES DO SEPARADOR LISTA
        </div>
      </div>
    )
  }

  // Find best value (lowest price/m²)
  const pm2s = props.map(p => Math.round(p.preco / p.area))
  const bestValueIdx = pm2s.indexOf(Math.min(...pm2s))

  const rows: Array<{ label: string; values: (string | React.ReactNode)[] }> = [
    { label: 'Referência',   values: props.map(p => p.ref) },
    { label: 'Tipo',         values: props.map(p => p.tipo) },
    { label: 'Zona',         values: props.map(p => p.zona) },
    { label: 'Bairro',       values: props.map(p => p.bairro) },
    { label: 'Badge',        values: props.map(p => <BadgePill key={p.id} badge={p.badge} />) },
    { label: 'Status',       values: props.map(p => p.status) },
    { label: 'Preço',        values: props.map(p => fmtPreco(p.preco)) },
    { label: 'Área',         values: props.map(p => `${p.area}m²`) },
    { label: 'Quartos',      values: props.map(p => `T${p.quartos}`) },
    { label: 'Casa de Banho',values: props.map(p => String(p.casasBanho)) },
    {
      label: 'Preço/m²',
      values: props.map((p, i) => (
        <span key={i} style={{
          color: i === bestValueIdx ? '#1c4a35' : undefined,
          fontWeight: i === bestValueIdx ? 600 : undefined,
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          €{pm2s[i].toLocaleString('pt-PT')}
          {i === bestValueIdx && (
            <span style={{
              background: 'rgba(28,74,53,.1)', color: '#1c4a35',
              fontFamily: "'DM Mono',monospace", fontSize: '.38rem',
              padding: '1px 5px', letterSpacing: '.06em', borderRadius: '2px',
            }}>
              BEST
            </span>
          )}
        </span>
      )),
    },
    { label: 'Piscina',    values: props.map(p => p.piscina ? '✓' : '—') },
    { label: 'Garagem',    values: props.map(p => p.garagem ? '✓' : '—') },
    { label: 'Jardim',     values: props.map(p => p.jardim ? '✓' : '—') },
    { label: 'Terraço',    values: props.map(p => p.terraco ? '✓' : '—') },
    { label: 'Dias Cart.', values: props.map(p => `${daysOnMarket(p.listingDate)}d`) },
  ]

  return (
    <div className="p-card" style={{ overflowX: 'auto' as const }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{
          fontFamily: "'Cormorant',serif", fontSize: '1.3rem',
          fontWeight: 300, color: '#0e0e0d',
        }}>
          Comparação de Imóveis
        </div>
        <button className="p-btn" onClick={onClear} style={{ fontSize: '.4rem' }}>
          Limpar
        </button>
      </div>

      {/* Property names header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `180px repeat(${props.length},1fr)`,
        gap: '0',
        marginBottom: '2px',
      }}>
        <div />
        {props.map(p => (
          <div key={p.id} style={{
            padding: '12px 16px',
            background: '#0c1f15',
            fontFamily: "'Cormorant',serif", fontSize: '1rem',
            color: '#f4f0e6', fontWeight: 300, lineHeight: 1.2,
          }}>
            {p.nome}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, ri) => (
        <div key={row.label} style={{
          display: 'grid',
          gridTemplateColumns: `180px repeat(${props.length},1fr)`,
          gap: '0',
          background: ri % 2 === 0 ? 'rgba(14,14,13,.02)' : '#fff',
          borderBottom: '1px solid rgba(14,14,13,.06)',
        }}>
          <div style={{
            padding: '10px 16px',
            fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
            color: 'rgba(14,14,13,.4)', letterSpacing: '.08em',
            textTransform: 'uppercase' as const,
            display: 'flex', alignItems: 'center',
            background: 'rgba(14,14,13,.03)', borderRight: '1px solid rgba(14,14,13,.06)',
          }}>
            {row.label}
          </div>
          {row.values.map((val, vi) => (
            <div key={vi} style={{
              padding: '10px 16px',
              fontFamily: "'Jost',sans-serif", fontSize: '.83rem',
              color: '#0e0e0d', display: 'flex', alignItems: 'center',
              borderRight: vi < row.values.length - 1 ? '1px solid rgba(14,14,13,.06)' : undefined,
            }}>
              {val}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Add Form Tab ─────────────────────────────────────────────────────────────
type NewImovelState = {
  ref: string; nome: string; zona: string; bairro: string; tipo: string
  preco: string; area: string; quartos: string; casasBanho: string
  badge: string; status: string
  piscina: boolean; garagem: boolean; jardim: boolean; terraco: boolean
  listingDate: string
}

function AddFormTab({ onAdd }: { onAdd: (imovel: ImovelItem) => void }) {
  const today = new Date().toISOString().split('T')[0]
  const empty: NewImovelState = {
    ref: '', nome: '', zona: '', bairro: '', tipo: 'Apartamento',
    preco: '', area: '', quartos: '', casasBanho: '',
    badge: 'Novo', status: 'Ativo',
    piscina: false, garagem: false, jardim: false, terraco: false,
    listingDate: today,
  }
  const [form, setForm] = useState<NewImovelState>(empty)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)

  function upd(k: keyof NewImovelState, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors([])
    setSuccess(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!form.nome.trim())   errs.push('Nome obrigatório')
    if (!form.zona.trim())   errs.push('Zona obrigatória')
    if (!form.preco || isNaN(Number(form.preco)) || Number(form.preco) <= 0) errs.push('Preço inválido')
    if (!form.area  || isNaN(Number(form.area))  || Number(form.area) <= 0)  errs.push('Área inválida')
    if (!form.quartos || isNaN(Number(form.quartos))) errs.push('Quartos inválidos')
    if (!form.casasBanho || isNaN(Number(form.casasBanho))) errs.push('WC inválido')
    if (errs.length) { setErrors(errs); return }

    const ref = form.ref.trim() || `AG-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`
    const newProp: ImovelItem = {
      id: ref,
      ref,
      nome: form.nome.trim(),
      zona: form.zona.trim(),
      bairro: form.bairro.trim() || form.zona.trim(),
      tipo: form.tipo,
      preco: Number(form.preco),
      area: Number(form.area),
      quartos: Number(form.quartos),
      casasBanho: Number(form.casasBanho),
      badge: form.badge,
      status: form.status,
      piscina: form.piscina,
      garagem: form.garagem,
      jardim: form.jardim,
      terraco: form.terraco,
      listingDate: form.listingDate || today,
    }
    onAdd(newProp)
    setForm(empty)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', background: '#fff',
    border: '1px solid rgba(14,14,13,.12)',
    padding: '10px 14px',
    fontFamily: "'Jost',sans-serif", fontSize: '.83rem',
    color: '#0e0e0d', outline: 'none',
  }
  const selStyle: React.CSSProperties = { ...inpStyle, cursor: 'pointer', appearance: 'none' as const }

  return (
    <div className="p-card" style={{ maxWidth: '720px' }}>
      <div style={{
        fontFamily: "'Cormorant',serif", fontSize: '1.5rem',
        fontWeight: 300, color: '#0e0e0d', marginBottom: '24px',
      }}>
        Adicionar Imóvel
      </div>

      {errors.length > 0 && (
        <div style={{
          background: 'rgba(224,84,84,.08)', border: '1px solid rgba(224,84,84,.25)',
          padding: '12px 16px', marginBottom: '20px',
          fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
          color: '#c0392b', letterSpacing: '.06em',
        }}>
          {errors.join(' · ')}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(28,74,53,.08)', border: '1px solid rgba(28,74,53,.25)',
          padding: '12px 16px', marginBottom: '20px',
          fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
          color: '#1c4a35', letterSpacing: '.08em',
        }}>
          IMÓVEL ADICIONADO COM SUCESSO
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Ref */}
          <div>
            <label className="p-label">Referência (opcional)</label>
            <input className="p-inp" style={inpStyle} value={form.ref}
              onChange={e => upd('ref', e.target.value)}
              placeholder="AG-2026-XXX" />
          </div>
          {/* Nome */}
          <div>
            <label className="p-label">Nome *</label>
            <input className="p-inp" style={inpStyle} value={form.nome}
              onChange={e => upd('nome', e.target.value)}
              placeholder="Penthouse Príncipe Real" required />
          </div>
          {/* Zona */}
          <div>
            <label className="p-label">Zona *</label>
            <select className="p-sel" style={selStyle} value={form.zona}
              onChange={e => upd('zona', e.target.value)} required>
              <option value="">Selecionar zona</option>
              {['Lisboa','Cascais','Porto','Algarve','Madeira','Sintra','Comporta','Alentejo','Açores','Outro'].map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          {/* Bairro */}
          <div>
            <label className="p-label">Bairro</label>
            <input className="p-inp" style={inpStyle} value={form.bairro}
              onChange={e => upd('bairro', e.target.value)}
              placeholder="Chiado, Foz, Vale do Lobo..." />
          </div>
          {/* Tipo */}
          <div>
            <label className="p-label">Tipo *</label>
            <select className="p-sel" style={selStyle} value={form.tipo}
              onChange={e => upd('tipo', e.target.value)}>
              {['Apartamento','Moradia','Villa','Penthouse','Herdade','Quinta','Terreno'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {/* Badge */}
          <div>
            <label className="p-label">Badge</label>
            <select className="p-sel" style={selStyle} value={form.badge}
              onChange={e => upd('badge', e.target.value)}>
              {['Novo','Destaque','Exclusivo','Off-Market'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          {/* Preco */}
          <div>
            <label className="p-label">Preço (€) *</label>
            <input className="p-inp" style={inpStyle} type="number" min="0" step="1000"
              value={form.preco} onChange={e => upd('preco', e.target.value)}
              placeholder="2850000" required />
          </div>
          {/* Area */}
          <div>
            <label className="p-label">Área (m²) *</label>
            <input className="p-inp" style={inpStyle} type="number" min="1" step="1"
              value={form.area} onChange={e => upd('area', e.target.value)}
              placeholder="220" required />
          </div>
          {/* Quartos */}
          <div>
            <label className="p-label">Quartos *</label>
            <select className="p-sel" style={selStyle} value={form.quartos}
              onChange={e => upd('quartos', e.target.value)}>
              <option value="">—</option>
              {[1,2,3,4,5,6,7].map(n => (
                <option key={n} value={n}>T{n}</option>
              ))}
            </select>
          </div>
          {/* Casas de banho */}
          <div>
            <label className="p-label">Casas de Banho *</label>
            <select className="p-sel" style={selStyle} value={form.casasBanho}
              onChange={e => upd('casasBanho', e.target.value)}>
              <option value="">—</option>
              {[1,2,3,4,5,6].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {/* Status */}
          <div>
            <label className="p-label">Status</label>
            <select className="p-sel" style={selStyle} value={form.status}
              onChange={e => upd('status', e.target.value)}>
              {['Ativo','Sob Proposta','Reservado','Vendido'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {/* Listing date */}
          <div>
            <label className="p-label">Data de Angariação</label>
            <input className="p-inp" style={inpStyle} type="date"
              value={form.listingDate}
              onChange={e => upd('listingDate', e.target.value)} />
          </div>
        </div>

        {/* Features */}
        <div style={{ marginTop: '20px', marginBottom: '24px' }}>
          <label className="p-label">Características</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
            {([
              { key: 'piscina', label: 'Piscina', icon: <IconPool /> },
              { key: 'garagem', label: 'Garagem', icon: <IconCar /> },
              { key: 'jardim', label: 'Jardim', icon: <IconGarden /> },
              { key: 'terraco', label: 'Terraço', icon: <IconTerrace /> },
            ] as const).map(({ key, label, icon }) => (
              <label
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  cursor: 'pointer', userSelect: 'none' as const,
                  padding: '8px 14px',
                  background: form[key] ? 'rgba(28,74,53,.1)' : 'rgba(14,14,13,.04)',
                  border: `1px solid ${form[key] ? 'rgba(28,74,53,.3)' : 'rgba(14,14,13,.1)'}`,
                  color: form[key] ? '#1c4a35' : 'rgba(14,14,13,.5)',
                  transition: 'all .2s',
                }}
                onClick={() => upd(key, !form[key])}
              >
                {icon}
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
                  letterSpacing: '.08em', textTransform: 'uppercase' as const,
                }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="p-btn p-btn-gold" style={{ padding: '14px 32px' }}>
          Adicionar à Carteira
        </button>
      </form>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalImoveis() {
  const { setSection } = useUIStore()
  const { crmContacts } = useCRMStore()

  // State
  const [imoveisTab, setImoveisTab] = useState<ImoveisTab>('lista')
  const [imoveisSearch, setImoveisSearch] = useState('')
  const [imoveisZonaFilter, setImoveisZonaFilter] = useState('')
  const [imoveisTypeFilter, setImoveisTypeFilter] = useState('')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [imoveisList, setImoveisList] = useState<ImovelItem[]>(PORTAL_PROPERTIES)
  const [selectedImovel, setSelectedImovel] = useState<ImovelItem | null>(null)

  // Derived
  const zonas = Array.from(new Set(imoveisList.map(p => p.zona))).sort()
  const tipos = Array.from(new Set(imoveisList.map(p => p.tipo))).sort()

  const filtered = imoveisList.filter(p => {
    const q = imoveisSearch.toLowerCase()
    const matchSearch = !q || p.nome.toLowerCase().includes(q) || p.zona.toLowerCase().includes(q) || p.bairro.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q)
    const matchZona = !imoveisZonaFilter || p.zona === imoveisZonaFilter
    const matchType = !imoveisTypeFilter || p.tipo === imoveisTypeFilter
    return matchSearch && matchZona && matchType
  })

  // Handlers
  function toggleCompare(id: string) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  function handleStatusChange(id: string, status: string) {
    setImoveisList(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    if (selectedImovel?.id === id) {
      setSelectedImovel(prev => prev ? { ...prev, status } : null)
    }
  }

  function handleAddImovel(imovel: ImovelItem) {
    setImoveisList(prev => [imovel, ...prev])
    setImoveisTab('lista')
  }

  const TABS: { id: ImoveisTab; label: string }[] = [
    { id: 'lista', label: 'Lista' },
    { id: 'stats', label: 'Stats' },
    { id: 'comparar', label: `Comparar${compareIds.length > 0 ? ` (${compareIds.length})` : ''}` },
    { id: 'adicionar', label: 'Adicionar' },
  ]

  return (
    <div style={{ padding: '32px', background: '#f4f0e6', minHeight: '100vh', fontFamily: "'Jost',sans-serif" }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '.45rem',
            letterSpacing: '.18em', color: 'rgba(14,14,13,.4)',
            textTransform: 'uppercase' as const, marginBottom: '6px',
          }}>
            Agency Group · AMI 22506
          </div>
          <h1 style={{
            fontFamily: "'Cormorant',serif", fontSize: '2.2rem',
            fontWeight: 300, color: '#0e0e0d', lineHeight: 1,
          }}>
            Carteira de Imóveis
          </h1>
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
          color: 'rgba(14,14,13,.35)', letterSpacing: '.06em', textAlign: 'right' as const,
        }}>
          <div style={{
            fontFamily: "'Cormorant',serif", fontSize: '1.6rem',
            fontWeight: 300, color: '#1c4a35', lineHeight: 1,
          }}>
            {imoveisList.length}
          </div>
          imóveis em carteira
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(14,14,13,.1)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setImoveisTab(tab.id)}
            style={{
              padding: '10px 20px',
              fontFamily: "'DM Mono',monospace", fontSize: '.5rem',
              letterSpacing: '.14em', textTransform: 'uppercase' as const,
              border: 'none', background: 'none', cursor: 'pointer',
              color: imoveisTab === tab.id ? '#1c4a35' : 'rgba(14,14,13,.4)',
              borderBottom: `2px solid ${imoveisTab === tab.id ? '#1c4a35' : 'transparent'}`,
              transition: 'all .2s', marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Lista Tab ── */}
      {imoveisTab === 'lista' && (
        <>
          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: '1 1 220px', position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(14,14,13,.3)', pointerEvents: 'none',
              }}>
                <IconSearch />
              </span>
              <input
                className="p-inp"
                style={{ paddingLeft: '36px' }}
                placeholder="Pesquisar imóveis..."
                value={imoveisSearch}
                onChange={e => setImoveisSearch(e.target.value)}
              />
            </div>
            <div style={{ flex: '0 1 160px' }}>
              <select
                className="p-sel"
                value={imoveisZonaFilter}
                onChange={e => setImoveisZonaFilter(e.target.value)}
              >
                <option value="">Todas as zonas</option>
                {zonas.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 160px' }}>
              <select
                className="p-sel"
                value={imoveisTypeFilter}
                onChange={e => setImoveisTypeFilter(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(imoveisSearch || imoveisZonaFilter || imoveisTypeFilter) && (
              <button
                className="p-btn"
                style={{ background: 'rgba(14,14,13,.08)', color: '#0e0e0d', padding: '10px 16px' }}
                onClick={() => { setImoveisSearch(''); setImoveisZonaFilter(''); setImoveisTypeFilter('') }}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Compare bar */}
          {compareIds.length > 0 && (
            <div style={{
              background: '#0c1f15', padding: '12px 20px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '.48rem',
                color: 'rgba(244,240,230,.6)', letterSpacing: '.08em',
                textTransform: 'uppercase' as const,
              }}>
                {compareIds.length} imóvel(is) selecionado(s) para comparar
              </span>
              <button
                className="p-btn p-btn-gold"
                style={{ padding: '8px 16px', fontSize: '.45rem', marginLeft: 'auto' }}
                onClick={() => setImoveisTab('comparar')}
              >
                Comparar
              </button>
              <button
                style={{
                  background: 'none', border: 'none', color: 'rgba(244,240,230,.4)',
                  cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '.45rem',
                  letterSpacing: '.06em',
                }}
                onClick={() => setCompareIds([])}
              >
                Limpar
              </button>
            </div>
          )}

          {/* Results count */}
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '.46rem',
            color: 'rgba(14,14,13,.35)', letterSpacing: '.06em',
            marginBottom: '16px',
          }}>
            {filtered.length} de {imoveisList.length} imóveis
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="p-card" style={{ textAlign: 'center' as const, padding: '60px', color: 'rgba(14,14,13,.35)' }}>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', marginBottom: '8px' }}>
                Nenhum imóvel encontrado
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', letterSpacing: '.08em' }}>
                TENTE AJUSTAR OS FILTROS
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
              gap: '16px',
            }}>
              {filtered.map(imovel => (
                <PropertyCard
                  key={imovel.id}
                  imovel={imovel}
                  selected={selectedImovel?.id === imovel.id}
                  compareIds={compareIds}
                  onToggleCompare={toggleCompare}
                  onClick={() => setSelectedImovel(selectedImovel?.id === imovel.id ? null : imovel)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Stats Tab ── */}
      {imoveisTab === 'stats' && (
        <StatsTab imoveisList={imoveisList} />
      )}

      {/* ── Comparar Tab ── */}
      {imoveisTab === 'comparar' && (
        <CompareTab
          compareIds={compareIds}
          imoveisList={imoveisList}
          onClear={() => setCompareIds([])}
        />
      )}

      {/* ── Adicionar Tab ── */}
      {imoveisTab === 'adicionar' && (
        <AddFormTab onAdd={handleAddImovel} />
      )}

      {/* ── Detail Panel (overlay) ── */}
      {selectedImovel && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedImovel(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(14,14,13,.35)',
              zIndex: 998,
            }}
          />
          <DetailPanel
            imovel={selectedImovel}
            onClose={() => setSelectedImovel(null)}
            onStatusChange={handleStatusChange}
            setSection={setSection as (s: 'avm') => void}
            crmContacts={crmContacts}
          />
        </>
      )}
    </div>
  )
}
