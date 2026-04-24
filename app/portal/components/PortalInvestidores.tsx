'use client'
import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { PORTAL_PROPERTIES } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type InvestorType = 'yield_hunter' | 'value_add' | 'buy_hold' | 'flipper' | 'family_office' | 'hnwi' | 'fund'
type RiskProfile = 'conservador' | 'moderado' | 'agressivo'
type OcupacaoType = 'AL' | 'arrendamento_longa' | 'uso_proprio' | 'qualquer'
type InvestorStatus = 'activo' | 'dormiente' | 'fechado'
type DealStage = 'novo' | 'enviado' | 'interesse' | 'visita' | 'proposta' | 'fechado' | 'perdido'
type MainTab = 'investidores' | 'dealflow' | 'memo'
type InvestorSubTab = 'perfil' | 'matches' | 'pipeline' | 'historico'

interface Investor {
  id: number
  name: string
  nationality: string
  flag: string
  type: InvestorType
  capitalMin: number
  capitalMax: number
  yieldTarget: number
  horizonYears: number
  riskProfile: RiskProfile
  zonas: string[]
  tipoImovel: string[]
  ocupacao: OcupacaoType
  status: InvestorStatus
  lastContact: string
  totalInvested: number
  dealsHistory: number
  notes: string
  email: string
  phone: string
  tags: string[]
}

interface InvestorDeal {
  id: number
  investorId: number
  propertyRef: string
  propertyTitle: string
  propertyZona: string
  propertyPreco: number
  matchScore: number
  yieldEstimado: number
  irrEstimado: number
  stage: DealStage
  sentAt: string | null
  memo: string | null
  notas: string
}

interface PortalProperty {
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

interface Match {
  property: PortalProperty
  score: number
  yieldEstimado: number
  irrEstimado: number
}

interface MemoResult {
  executiveSummary: string
  investmentThesis: string
  financials: {
    precoCompra: number
    yieldBruto: number
    yieldLiquido: number
    irrEstimado: number
    exitValue: number
    capexEstimado: number
    roi5anos: number
  }
  risks: string[]
  nextSteps: string[]
  raw?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const G = '#1c4a35'
const GOLD = '#c9a96e'
const BG = '#f4f0e6'
const TXT = '#0e0e0d'

const TYPE_LABELS: Record<InvestorType, string> = {
  yield_hunter: 'Yield Hunter',
  value_add: 'Value Add',
  buy_hold: 'Buy & Hold',
  flipper: 'Flipper',
  family_office: 'Family Office',
  hnwi: 'HNWI',
  fund: 'Fund',
}

const TYPE_COLORS: Record<InvestorType, string> = {
  yield_hunter: '#16a34a',
  value_add: '#2563eb',
  buy_hold: '#1c4a35',
  flipper: '#dc2626',
  family_office: '#c9a96e',
  hnwi: '#7c3aed',
  fund: '#0891b2',
}

const RISK_COLORS: Record<RiskProfile, string> = {
  conservador: '#16a34a',
  moderado: '#c9a96e',
  agressivo: '#dc2626',
}

const DEAL_STAGES: DealStage[] = ['novo', 'enviado', 'interesse', 'visita', 'proposta', 'fechado', 'perdido']
const STAGE_LABELS: Record<DealStage, string> = {
  novo: 'Novo', enviado: 'Enviado', interesse: 'Interesse',
  visita: 'Visita', proposta: 'Proposta', fechado: 'Fechado', perdido: 'Perdido',
}
const STAGE_COLORS: Record<DealStage, string> = {
  novo: '#6b7280', enviado: '#3b82f6', interesse: '#f59e0b',
  visita: '#8b5cf6', proposta: '#f97316', fechado: '#16a34a', perdido: '#ef4444',
}

const DEAL_TYPES = ['Buy & Hold', 'Value-Add', 'Flip', 'Development']
const MEMO_LANGS = ['PT', 'EN', 'FR', 'DE', 'AR']

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_INVESTORS: Investor[] = [
  {
    id: 1, name: 'James Mitchell', nationality: 'UK', flag: '🇬🇧',
    type: 'family_office', capitalMin: 5000000, capitalMax: 20000000,
    yieldTarget: 3.5, horizonYears: 10, riskProfile: 'moderado',
    zonas: ['Lisboa'], tipoImovel: ['Apartamento', 'Moradia'],
    ocupacao: 'arrendamento_longa', status: 'activo',
    lastContact: '2026-04-01', totalInvested: 12500000, dealsHistory: 3,
    notes: 'Prefere imóveis prime Lisboa. Fundo familiar multi-geracional. Horizon 10+ anos.',
    email: 'james.mitchell@mitchellfamily.co.uk', phone: '+44 7700 900123',
    tags: ['Lisboa Prime', 'Long-term', 'Off-market'],
  },
  {
    id: 2, name: 'Marie-Claire Dubois', nationality: 'FR', flag: '🇫🇷',
    type: 'hnwi', capitalMin: 1000000, capitalMax: 3000000,
    yieldTarget: 4.5, horizonYears: 7, riskProfile: 'moderado',
    zonas: ['Comporta', 'Alentejo'], tipoImovel: ['Herdade', 'Moradia'],
    ocupacao: 'uso_proprio', status: 'activo',
    lastContact: '2026-03-28', totalInvested: 2200000, dealsHistory: 1,
    notes: 'Procura second home + AL. Francesa executiva. Quer lifestyle Comporta.',
    email: 'mc.dubois@gmail.com', phone: '+33 6 12 34 56 78',
    tags: ['Comporta', 'Lifestyle', 'NHR'],
  },
  {
    id: 3, name: 'Khalid Al-Rashidi', nationality: 'AE', flag: '🇦🇪',
    type: 'hnwi', capitalMin: 3000000, capitalMax: 10000000,
    yieldTarget: 4.0, horizonYears: 5, riskProfile: 'agressivo',
    zonas: ['Lisboa', 'Cascais'], tipoImovel: ['Apartamento', 'Moradia'],
    ocupacao: 'qualquer', status: 'activo',
    lastContact: '2026-04-02', totalInvested: 6800000, dealsHistory: 2,
    notes: 'Investidor Dubai. Golden Visa concluído. Quer portfolio diversificado PT.',
    email: 'khalid@alrashidi-inv.ae', phone: '+971 50 123 4567',
    tags: ['Golden Visa', 'Portfolio', 'UAE'],
  },
  {
    id: 4, name: 'Chen Wei', nationality: 'CN', flag: '🇨🇳',
    type: 'buy_hold', capitalMin: 2000000, capitalMax: 5000000,
    yieldTarget: 5.0, horizonYears: 8, riskProfile: 'moderado',
    zonas: ['Porto', 'Lisboa'], tipoImovel: ['Apartamento', 'Comercial'],
    ocupacao: 'arrendamento_longa', status: 'activo',
    lastContact: '2026-03-15', totalInvested: 3400000, dealsHistory: 2,
    notes: 'Investidor Shanghai. Foco yield + capital appreciation. Porto emergente.',
    email: 'chenwei@greatwall-cap.com', phone: '+86 135 0000 1234',
    tags: ['Porto', 'Yield', 'Buy & Hold'],
  },
  {
    id: 5, name: 'Francisco Santos', nationality: 'PT', flag: '🇵🇹',
    type: 'yield_hunter', capitalMin: 500000, capitalMax: 2000000,
    yieldTarget: 6.0, horizonYears: 5, riskProfile: 'moderado',
    zonas: ['Porto'], tipoImovel: ['Apartamento'],
    ocupacao: 'AL', status: 'activo',
    lastContact: '2026-04-03', totalInvested: 1200000, dealsHistory: 4,
    notes: 'Investidor português experiente. AL Porto Foz. Conhece bem o mercado.',
    email: 'francisco.santos@gmail.com', phone: '+351 912 345 678',
    tags: ['AL', 'Porto Foz', 'Experiente'],
  },
  {
    id: 6, name: 'Ahmed Al-Mansouri', nationality: 'SA', flag: '🇸🇦',
    type: 'family_office', capitalMin: 5000000, capitalMax: 15000000,
    yieldTarget: 3.8, horizonYears: 15, riskProfile: 'conservador',
    zonas: ['Algarve', 'Lisboa'], tipoImovel: ['Moradia', 'Herdade'],
    ocupacao: 'uso_proprio', status: 'activo',
    lastContact: '2026-03-20', totalInvested: 9500000, dealsHistory: 2,
    notes: 'Saudi family office. Segunda residência + estate. Prazo ultra longo.',
    email: 'ahmed@almansouri-family.sa', phone: '+966 50 123 4567',
    tags: ['Algarve Premium', 'Family Estate', 'Saudi'],
  },
  {
    id: 7, name: 'Klaus Weber', nationality: 'DE', flag: '🇩🇪',
    type: 'buy_hold', capitalMin: 1000000, capitalMax: 3000000,
    yieldTarget: 4.8, horizonYears: 6, riskProfile: 'conservador',
    zonas: ['Algarve'], tipoImovel: ['Moradia'],
    ocupacao: 'qualquer', status: 'activo',
    lastContact: '2026-03-10', totalInvested: 1800000, dealsHistory: 1,
    notes: 'Empresário Frankfurt. Resort Algarve. Quer gestão delegada turnkey.',
    email: 'k.weber@weber-ventures.de', phone: '+49 151 1234 5678',
    tags: ['Algarve Resort', 'Turnkey', 'Alemão'],
  },
  {
    id: 8, name: 'Robert Johnson', nationality: 'US', flag: '🇺🇸',
    type: 'fund', capitalMin: 10000000, capitalMax: 50000000,
    yieldTarget: 5.5, horizonYears: 7, riskProfile: 'agressivo',
    zonas: ['Lisboa', 'Porto', 'Algarve', 'Cascais'], tipoImovel: ['Apartamento', 'Moradia', 'Comercial'],
    ocupacao: 'qualquer', status: 'activo',
    lastContact: '2026-04-01', totalInvested: 28000000, dealsHistory: 6,
    notes: 'NYC family office. Portfolio PT diversificado. Quer 5-10 ativos por ano.',
    email: 'rjohnson@johnsoninvestments.com', phone: '+1 212 555 0100',
    tags: ['Fund', 'Portfolio PT', 'USA', 'IRR 12%+'],
  },
  {
    id: 9, name: 'Isabella Rodrigues', nationality: 'BR', flag: '🇧🇷',
    type: 'hnwi', capitalMin: 800000, capitalMax: 2500000,
    yieldTarget: 5.2, horizonYears: 5, riskProfile: 'moderado',
    zonas: ['Lisboa', 'Cascais'], tipoImovel: ['Apartamento'],
    ocupacao: 'AL', status: 'activo',
    lastContact: '2026-03-25', totalInvested: 1600000, dealsHistory: 2,
    notes: 'Empresária SP. NHR candidata. Lisboa Chiado ou Cascais. AL premium.',
    email: 'isabella.r@rodriguesgroup.com.br', phone: '+55 11 99999-1234',
    tags: ['NHR', 'Brasil', 'AL Premium', 'Cascais'],
  },
  {
    id: 10, name: 'Hamad bin Jassim', nationality: 'QA', flag: '🇶🇦',
    type: 'fund', capitalMin: 20000000, capitalMax: 999999999,
    yieldTarget: 4.0, horizonYears: 20, riskProfile: 'conservador',
    zonas: ['Lisboa', 'Cascais', 'Algarve', 'Comporta'],
    tipoImovel: ['Moradia', 'Herdade', 'Comercial'],
    ocupacao: 'qualquer', status: 'activo',
    lastContact: '2026-04-04', totalInvested: 75000000, dealsHistory: 4,
    notes: 'Qatar sovereign-linked fund. Institutional. Capital preservation + trophy assets.',
    email: 'hbj@qatarportfolio.qa', phone: '+974 5555 1234',
    tags: ['Institutional', 'Qatar', 'Trophy', 'Multi-100M'],
  },
]

const INITIAL_DEALS: InvestorDeal[] = [
  { id: 1, investorId: 1, propertyRef: 'AG-2026-012', propertyTitle: 'Moradia Belém com Jardim', propertyZona: 'Lisboa', propertyPreco: 3200000, matchScore: 87, yieldEstimado: 3.8, irrEstimado: 10.2, stage: 'proposta', sentAt: '2026-03-20', memo: null, notas: 'Cliente muito interessado. A aguardar proposta final.' },
  { id: 2, investorId: 3, propertyRef: 'AG-2026-020', propertyTitle: 'Villa Quinta da Marinha', propertyZona: 'Cascais', propertyPreco: 3800000, matchScore: 92, yieldEstimado: 4.1, irrEstimado: 11.5, stage: 'visita', sentAt: '2026-03-28', memo: null, notas: 'Visita agendada para dia 10 Abril.' },
  { id: 3, investorId: 5, propertyRef: 'AG-2026-040', propertyTitle: 'Apartamento Foz do Douro', propertyZona: 'Porto', propertyPreco: 980000, matchScore: 95, yieldEstimado: 6.2, irrEstimado: 14.1, stage: 'interesse', sentAt: '2026-04-01', memo: null, notas: 'Alto interesse. A calcular capex remodelação.' },
  { id: 4, investorId: 8, propertyRef: 'AG-2026-010', propertyTitle: 'Penthouse Príncipe Real', propertyZona: 'Lisboa', propertyPreco: 2850000, matchScore: 78, yieldEstimado: 4.8, irrEstimado: 12.3, stage: 'enviado', sentAt: '2026-04-03', memo: null, notas: 'Deal memo enviado. A aguardar feedback.' },
  { id: 5, investorId: 2, propertyRef: 'AG-2026-030', propertyTitle: 'Herdade Comporta Exclusiva', propertyZona: 'Comporta', propertyPreco: 6500000, matchScore: 88, yieldEstimado: 4.3, irrEstimado: 9.8, stage: 'novo', sentAt: null, memo: null, notas: 'Match excelente. Preparar deal memo.' },
  { id: 6, investorId: 7, propertyRef: 'AG-2026-050', propertyTitle: 'Villa Vale do Lobo Golf', propertyZona: 'Algarve', propertyPreco: 4200000, matchScore: 91, yieldEstimado: 4.6, irrEstimado: 11.0, stage: 'fechado', sentAt: '2026-02-15', memo: null, notas: 'Deal fechado. Escritura realizada.' },
]

// ─── Utility Functions ────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `€${(n / 1000).toFixed(0)}K`
  return `€${n.toLocaleString('pt-PT')}`
}

function fmtFull(n: number): string {
  return `€${n.toLocaleString('pt-PT')}`
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function activityScore(inv: Investor): number {
  const days = daysSince(inv.lastContact)
  const dealsBonus = Math.min(inv.dealsHistory * 10, 30)
  const contactScore = days < 7 ? 40 : days < 30 ? 25 : days < 90 ? 10 : 0
  const capitalScore = inv.capitalMax > 10000000 ? 20 : inv.capitalMax > 3000000 ? 15 : 10
  return Math.min(100, contactScore + dealsBonus + capitalScore)
}

// ─── Matching Engine ──────────────────────────────────────────────────────────

function calcYield(prop: PortalProperty): number {
  const baseYields: Record<string, number> = {
    Lisboa: 4.3, Cascais: 4.0, Porto: 5.1, Algarve: 4.6,
    Comporta: 4.1, Madeira: 4.8, Sintra: 4.2,
  }
  return baseYields[prop.zona] ?? 4.0
}

function calcIRR(prop: PortalProperty, horizonYears: number): number {
  const yld = calcYield(prop)
  const appreciation = prop.zona === 'Lisboa' ? 0.07 : prop.zona === 'Cascais' ? 0.06 : 0.05
  // Annualised IRR estimate: net yield + capital appreciation blended over horizon
  // Uses holding-period return formula: IRR ≈ yield + appreciation (both annualised)
  // The appreciation contributes more over longer horizons through compounding
  const compoundedAppreciation = (Math.pow(1 + appreciation, horizonYears) - 1) / horizonYears
  return parseFloat((yld + compoundedAppreciation * 100 * 0.8).toFixed(1))
}

function matchInvestorToProperties(investor: Investor, properties: PortalProperty[]): Match[] {
  return properties.map(prop => {
    let score = 0

    // Budget match (30 points)
    if (prop.preco >= investor.capitalMin && prop.preco <= investor.capitalMax) score += 30
    else if (prop.preco <= investor.capitalMax * 1.1) score += 15

    // Zona match (25 points)
    if (investor.zonas.some(z => prop.zona.includes(z) || z.includes(prop.zona))) score += 25

    // Tipo match (20 points)
    if (investor.tipoImovel.some(t => prop.tipo.includes(t) || t.includes(prop.tipo))) score += 20

    // Yield match (25 points)
    const yieldEstimado = calcYield(prop)
    if (yieldEstimado >= investor.yieldTarget) score += 25
    else if (yieldEstimado >= investor.yieldTarget * 0.8) score += 15

    const irrEstimado = calcIRR(prop, investor.horizonYears)

    return { property: prop, score, yieldEstimado, irrEstimado }
  }).filter(m => m.score > 30).sort((a, b) => b.score - a.score)
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const color = score >= 80 ? '#16a34a' : score >= 60 ? GOLD : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: size === 'lg' ? 100 : 60, height: size === 'lg' ? 8 : 5,
        background: '#d4cfc4', borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .4s ease' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: size === 'lg' ? 13 : 11, color, fontWeight: 600 }}>{score}</span>
    </div>
  )
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: InvestorType }) {
  return (
    <span style={{
      background: TYPE_COLORS[type] + '22', color: TYPE_COLORS[type],
      border: `1px solid ${TYPE_COLORS[type]}44`,
      borderRadius: 6, padding: '2px 8px',
      fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, fontWeight: 600, letterSpacing: '.04em',
    }}>
      {TYPE_LABELS[type].toUpperCase()}
    </span>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvestorStatus }) {
  const map = { activo: { c: '#16a34a', l: 'ACTIVO' }, dormiente: { c: '#f59e0b', l: 'DORMIENTE' }, fechado: { c: '#6b7280', l: 'FECHADO' } }
  const { c, l } = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c + '18', color: c, border: `1px solid ${c}33`,
      borderRadius: 6, padding: '2px 8px',
      fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, fontWeight: 700,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, display: 'inline-block' }} />
      {l}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = G }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid #e8e2d4`, borderRadius: 14,
      padding: '18px 22px', flex: 1, minWidth: 140,
      boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
    }}>
      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 11, color: '#8a8070', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Investor Card ────────────────────────────────────────────────────────────

function InvestorCard({ inv, onClick, isSelected }: { inv: Investor; onClick: () => void; isSelected: boolean }) {
  const score = activityScore(inv)
  const days = daysSince(inv.lastContact)
  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? '#1c4a35' : '#fff',
        border: `1.5px solid ${isSelected ? G : '#e8e2d4'}`,
        borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
        transition: 'all .2s ease', boxShadow: isSelected ? `0 4px 20px ${G}33` : '0 1px 4px #0000000a',
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px #0000001a' }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px #0000000a' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>{inv.flag}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 17, fontWeight: 700, color: isSelected ? '#fff' : TXT }}>{inv.name}</span>
            <TypeBadge type={inv.type} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={inv.status} />
          </div>
        </div>
        <ScoreBar score={score} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 10 }}>
        <Stat label="Capital" value={`${fmt(inv.capitalMin)} – ${fmt(inv.capitalMax)}`} inv={isSelected} />
        <Stat label="Yield Target" value={`${inv.yieldTarget}%`} inv={isSelected} />
        <Stat label="Horizonte" value={`${inv.horizonYears} anos`} inv={isSelected} />
        <Stat label="Último contacto" value={days === 0 ? 'Hoje' : `${days}d atrás`} inv={isSelected} color={days > 30 ? '#ef4444' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {inv.zonas.slice(0, 3).map(z => (
          <span key={z} style={{ background: isSelected ? '#ffffff22' : '#f4f0e6', color: isSelected ? '#c9a96e' : '#5a4f3a', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10 }}>{z}</span>
        ))}
        {inv.zonas.length > 3 && <span style={{ color: isSelected ? '#ffffff88' : '#8a8070', fontSize: 10, fontFamily: 'var(--font-dm-mono),monospace' }}>+{inv.zonas.length - 3}</span>}
      </div>
    </div>
  )
}

function Stat({ label, value, inv, color }: { label: string; value: string; inv?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: inv ? '#ffffff66' : '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, fontWeight: 600, color: color ?? (inv ? '#ffffffcc' : TXT) }}>{value}</div>
    </div>
  )
}

// ─── Investor Drawer ──────────────────────────────────────────────────────────

function InvestorDrawer({
  investor, onClose, deals, onDealStageChange, onAddDeal, onSave,
  allProperties,
}: {
  investor: Investor
  onClose: () => void
  deals: InvestorDeal[]
  onDealStageChange: (dealId: number, stage: DealStage) => void
  onAddDeal: (deal: InvestorDeal) => void
  onSave: (inv: Investor) => void
  allProperties: PortalProperty[]
}) {
  const [subTab, setSubTab] = useState<InvestorSubTab>('perfil')
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<Investor>(investor)
  const myDeals = deals.filter(d => d.investorId === investor.id)
  const closedDeals = myDeals.filter(d => d.stage === 'fechado')
  const activeDeals = myDeals.filter(d => d.stage !== 'fechado' && d.stage !== 'perdido')
  const matches = useMemo(() => matchInvestorToProperties(investor, allProperties), [investor, allProperties])

  function handleSave() {
    onSave(draft)
    setEditMode(false)
  }

  const SUB_TABS: { id: InvestorSubTab; label: string }[] = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'matches', label: `Matches (${matches.length})` },
    { id: 'pipeline', label: `Pipeline (${activeDeals.length})` },
    { id: 'historico', label: `Histórico (${closedDeals.length})` },
  ]

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 520,
      background: BG, borderLeft: `1px solid #d4cfc4`, zIndex: 200,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px #0000001a',
      animation: 'slideInRight .25s ease',
    }}>
      {/* Header */}
      <div style={{ background: G, padding: '20px 24px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 28 }}>{investor.flag}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 700 }}>{investor.name}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#ffffff88', marginTop: 2 }}>{investor.email}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#ffffff22', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TypeBadge type={investor.type} />
          <StatusBadge status={investor.status} />
          <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#c9a96e', background: '#c9a96e22', border: '1px solid #c9a96e44', borderRadius: 6, padding: '2px 8px' }}>
            {fmt(investor.capitalMin)} – {fmt(investor.capitalMax)}
          </span>
        </div>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e8e2d4' }}>
        {SUB_TABS.map(t => (
          <button type="button" key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, padding: '12px 4px', border: 'none', cursor: 'pointer',
            background: 'none', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10,
            color: subTab === t.id ? G : '#8a8070',
            borderBottom: subTab === t.id ? `2px solid ${G}` : '2px solid transparent',
            fontWeight: subTab === t.id ? 700 : 400, transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {subTab === 'perfil' && (
          <DrawerPerfil investor={draft} editMode={editMode} onChange={setDraft} onToggleEdit={() => setEditMode(!editMode)} onSave={handleSave} />
        )}
        {subTab === 'matches' && (
          <DrawerMatches matches={matches} investor={investor} onAddDeal={onAddDeal} existingDeals={myDeals} />
        )}
        {subTab === 'pipeline' && (
          <DrawerPipeline deals={activeDeals} onStageChange={onDealStageChange} />
        )}
        {subTab === 'historico' && (
          <DrawerHistorico investor={investor} deals={closedDeals} />
        )}
      </div>
    </div>
  )
}

// ─── Drawer: Perfil ───────────────────────────────────────────────────────────

function DrawerPerfil({ investor, editMode, onChange, onToggleEdit, onSave }: {
  investor: Investor; editMode: boolean; onChange: (inv: Investor) => void; onToggleEdit: () => void; onSave: () => void
}) {
  const inp = (field: keyof Investor, label: string, type: string = 'text') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>{label}</label>
      {editMode ? (
        <input
          type={type} value={String(investor[field] ?? '')}
          onChange={e => onChange({ ...investor, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
          style={{ width: '100%', background: '#fff', border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none', boxSizing: 'border-box' }}
        />
      ) : (
        <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, padding: '8px 0' }}>{String(investor[field] ?? '—')}</div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: G }}>Perfil do Investidor</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {editMode && <button type="button" onClick={onSave} style={{ background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, cursor: 'pointer', fontWeight: 600, transition: 'all .2s' }}>Guardar</button>}
          <button type="button" onClick={onToggleEdit} style={{ background: editMode ? '#f4f0e6' : GOLD, color: editMode ? '#8a8070' : '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, cursor: 'pointer', fontWeight: 600, transition: 'all .2s' }}>{editMode ? 'Cancelar' : 'Editar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
        {inp('name', 'Nome')}
        {inp('nationality', 'Nacionalidade')}
        {inp('email', 'Email')}
        {inp('phone', 'Telefone')}
        {inp('capitalMin', 'Capital Mínimo (€)', 'number')}
        {inp('capitalMax', 'Capital Máximo (€)', 'number')}
        {inp('yieldTarget', 'Yield Target (%)', 'number')}
        {inp('horizonYears', 'Horizonte (anos)', 'number')}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Perfil de Risco</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['conservador', 'moderado', 'agressivo'] as RiskProfile[]).map(r => (
            <button type="button" key={r} onClick={() => editMode && onChange({ ...investor, riskProfile: r })} style={{
              padding: '6px 12px', borderRadius: 8, border: `1px solid ${investor.riskProfile === r ? RISK_COLORS[r] : '#d4cfc4'}`,
              background: investor.riskProfile === r ? RISK_COLORS[r] + '18' : '#fff',
              color: investor.riskProfile === r ? RISK_COLORS[r] : '#8a8070',
              fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, cursor: editMode ? 'pointer' : 'default', fontWeight: 600,
              textTransform: 'capitalize',
            }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Notas</label>
        {editMode ? (
          <textarea
            value={investor.notes} rows={4}
            onChange={e => onChange({ ...investor, notes: e.target.value })}
            style={{ width: '100%', background: '#fff', border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        ) : (
          <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, lineHeight: 1.5 }}>{investor.notes}</div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Tags</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {investor.tags.map(t => (
            <span key={t} style={{ background: '#f4f0e6', color: '#5a4f3a', borderRadius: 6, padding: '3px 10px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10 }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e8e2d4', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Métricas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 24, fontWeight: 700, color: G }}>{fmt(investor.totalInvested)}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>TOTAL INVESTIDO</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 24, fontWeight: 700, color: GOLD }}>{investor.dealsHistory}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>DEALS HIST.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 24, fontWeight: 700, color: '#2563eb' }}>{investor.yieldTarget}%</div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>YIELD TARGET</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer: Matches ──────────────────────────────────────────────────────────

function DrawerMatches({ matches, investor, onAddDeal, existingDeals }: {
  matches: Match[]; investor: Investor; onAddDeal: (deal: InvestorDeal) => void; existingDeals: InvestorDeal[]
}) {
  const [aiMatches, setAiMatches] = useState<Array<{
    match_score: number; explanation: string; estimated_yield: number | null
    property: { id: string; title?: string; nome?: string; price?: number; preco?: number; zone?: string; zona?: string; type?: string; tipo?: string; bedrooms?: number; area_m2?: number }
  }>>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiRan, setAiRan] = useState(false)

  const existingRefs = new Set(existingDeals.map(d => d.propertyRef))

  async function runAIMatch() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/portal/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget_min:        investor.capitalMin,
          budget_max:        investor.capitalMax,
          locations:         investor.zonas,
          typology:          investor.tipoImovel[0] ?? undefined,
          features_required: investor.ocupacao === 'AL' ? ['al_license'] : [],
          use_type:          'investment',
        }),
      })
      if (res.ok) {
        const { matches: m } = await res.json()
        if (Array.isArray(m)) setAiMatches(m)
      }
    } catch { /* silent */ }
    finally { setAiLoading(false); setAiRan(true) }
  }

  return (
    <div>
      {/* AI Match button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: G }}>
          {aiRan && aiMatches.length > 0 ? `${aiMatches.length} Matches AI (pgvector)` : `${matches.length} Matches Locais`}
        </div>
        <button type="button" onClick={runAIMatch} disabled={aiLoading}
          style={{ padding: '6px 14px', background: aiRan ? '#1c4a3522' : G, color: aiRan ? G : '#fff', border: `1px solid ${G}`, borderRadius: 8, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, fontWeight: 600, cursor: aiLoading ? 'default' : 'pointer', transition: 'all .2s' }}>
          {aiLoading ? '⟳ A processar...' : aiRan ? '🔄 Re-run AI' : '🔍 AI Match (pgvector)'}
        </button>
      </div>

      {/* AI results */}
      {aiRan && aiMatches.length === 0 && !aiLoading && (
        <div style={{ textAlign: 'center', color: '#8a8070', padding: '20px 0', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11 }}>
          Nenhum match AI encontrado. A carteira pode precisar de embeddings — corre /api/embeddings/sync.
        </div>
      )}

      {aiRan && aiMatches.map((m, idx) => {
        const p = m.property
        const propTitle = p.title || p.nome || `Imóvel ${idx + 1}`
        const propPrice = p.price || p.preco || 0
        const propZone  = p.zone  || p.zona  || ''
        const propType  = p.type  || p.tipo  || ''
        const yieldVal  = m.estimated_yield ?? investor.yieldTarget
        const irrVal    = yieldVal + 1.5 + (investor.horizonYears > 7 ? 1 : 0)
        const ref       = `ai-${p.id}`
        return (
          <div key={p.id ?? idx} style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '12px', padding: '14px 16px', marginBottom: 10, borderLeft: `4px solid ${G}`, boxShadow: '0 1px 3px rgba(14,14,13,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 14, fontWeight: 600, color: TXT, marginBottom: 2 }}>{propTitle}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070' }}>{propZone}{propType ? ` · ${propType}` : ''}{propPrice ? ` · ${fmt(propPrice)}` : ''}</div>
              </div>
              <ScoreBar score={m.match_score} size="lg" />
            </div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>{m.explanation}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: '#f4f0e6', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>YIELD EST.</div>
                <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{yieldVal.toFixed(1)}%</div>
              </div>
              <div style={{ background: '#f4f0e6', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>IRR EST.</div>
                <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{irrVal.toFixed(1)}%</div>
              </div>
            </div>
            <button type="button"
              disabled={existingRefs.has(ref)}
              onClick={() => onAddDeal({ id: Date.now(), investorId: investor.id, propertyRef: ref, propertyTitle: propTitle, propertyZona: propZone, propertyPreco: propPrice, matchScore: m.match_score, yieldEstimado: yieldVal, irrEstimado: irrVal, stage: 'novo', sentAt: null, memo: null, notas: '' })}
              style={{ width: '100%', padding: '8px', borderRadius: 8, background: existingRefs.has(ref) ? '#f4f0e6' : G, color: existingRefs.has(ref) ? '#8a8070' : '#fff', border: 'none', cursor: existingRefs.has(ref) ? 'default' : 'pointer', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, fontWeight: 600 }}>
              {existingRefs.has(ref) ? 'JÁ NO PIPELINE' : 'ADICIONAR AO PIPELINE'}
            </button>
          </div>
        )
      })}

      {/* Local results (always shown as fallback) */}
      {(!aiRan || aiMatches.length === 0) && matches.length === 0 && (
        <div style={{ textAlign: 'center', color: '#8a8070', fontFamily: 'var(--font-jost),sans-serif', padding: '40px 0' }}>Nenhum match encontrado. Clique em &quot;AI Match&quot; para pesquisa completa.</div>
      )}
      {(!aiRan || aiMatches.length === 0) && matches.map(m => (
        <div key={m.property.id} style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '12px', padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 14, fontWeight: 600, color: TXT, marginBottom: 2 }}>{m.property.nome}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070' }}>{m.property.zona} · {m.property.tipo} · {fmt(m.property.preco)}</div>
            </div>
            <ScoreBar score={m.score} size="lg" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: '#f4f0e6', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>YIELD EST.</div>
              <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{m.yieldEstimado.toFixed(1)}%</div>
            </div>
            <div style={{ background: '#f4f0e6', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>IRR EST.</div>
              <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{m.irrEstimado.toFixed(1)}%</div>
            </div>
          </div>
          <button type="button"
            disabled={existingRefs.has(m.property.ref)}
            onClick={() => onAddDeal({ id: Date.now(), investorId: investor.id, propertyRef: m.property.ref, propertyTitle: m.property.nome, propertyZona: m.property.zona, propertyPreco: m.property.preco, matchScore: m.score, yieldEstimado: m.yieldEstimado, irrEstimado: m.irrEstimado, stage: 'novo', sentAt: null, memo: null, notas: '' })}
            style={{ width: '100%', padding: '8px', borderRadius: 8, background: existingRefs.has(m.property.ref) ? '#f4f0e6' : G, color: existingRefs.has(m.property.ref) ? '#8a8070' : '#fff', border: 'none', cursor: existingRefs.has(m.property.ref) ? 'default' : 'pointer', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, fontWeight: 600 }}>
            {existingRefs.has(m.property.ref) ? 'JÁ NO PIPELINE' : 'ADICIONAR AO PIPELINE'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Drawer: Pipeline ─────────────────────────────────────────────────────────

function DrawerPipeline({ deals, onStageChange }: { deals: InvestorDeal[]; onStageChange: (id: number, stage: DealStage) => void }) {
  if (deals.length === 0) {
    return <div style={{ textAlign: 'center', color: '#8a8070', fontFamily: 'var(--font-jost),sans-serif', padding: '40px 0' }}>Nenhum deal activo. Use os Matches para iniciar.</div>
  }

  const stages: DealStage[] = ['novo', 'enviado', 'interesse', 'visita', 'proposta']

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: G, marginBottom: 16 }}>Pipeline Activo</div>
      {deals.map(deal => (
        <div key={deal.id} style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '12px', padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 14, fontWeight: 600, color: TXT }}>{deal.propertyTitle}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070' }}>{deal.propertyZona} · {fmt(deal.propertyPreco)}</div>
            </div>
            <ScoreBar score={deal.matchScore} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {stages.map(s => (
              <button type="button" key={s} onClick={() => onStageChange(deal.id, s)} style={{
                padding: '4px 10px', borderRadius: 6, border: `1px solid ${deal.stage === s ? STAGE_COLORS[s] : '#d4cfc4'}`,
                background: deal.stage === s ? STAGE_COLORS[s] : '#fff',
                color: deal.stage === s ? '#fff' : '#8a8070',
                fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}>{STAGE_LABELS[s]}</button>
            ))}
          </div>
          {deal.notas && <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, color: '#5a4f3a', fontStyle: 'italic' }}>{deal.notas}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Drawer: Histórico ────────────────────────────────────────────────────────

function DrawerHistorico({ investor, deals }: { investor: Investor; deals: InvestorDeal[] }) {
  const totalInvested = deals.reduce((acc, d) => acc + d.propertyPreco, 0)
  const avgYield = deals.length > 0 ? deals.reduce((acc, d) => acc + d.yieldEstimado, 0) / deals.length : 0

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: G, marginBottom: 16 }}>Histórico de Deals</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '12px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 300, color: G }}>{fmt(investor.totalInvested)}</div>
          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>TOTAL INVESTIDO</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '12px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 300, color: '#16a34a' }}>{avgYield.toFixed(1)}%</div>
          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>YIELD MÉDIO</div>
        </div>
      </div>

      {deals.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8a8070', fontFamily: 'var(--font-jost),sans-serif', padding: '20px 0' }}>Nenhum deal concluído ainda.</div>
      ) : (
        deals.map(deal => (
          <div key={deal.id} style={{ background: '#fff', border: `1px solid #16a34a44`, borderRadius: '12px', padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 14, fontWeight: 600, color: TXT }}>{deal.propertyTitle}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070' }}>{deal.propertyZona}</div>
              </div>
              <span style={{ background: '#16a34a18', color: '#16a34a', border: '1px solid #16a34a33', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, fontWeight: 700 }}>FECHADO</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>PREÇO</div><div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, fontWeight: 600 }}>{fmt(deal.propertyPreco)}</div></div>
              <div><div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>YIELD</div><div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{deal.yieldEstimado.toFixed(1)}%</div></div>
              <div><div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>IRR</div><div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{deal.irrEstimado.toFixed(1)}%</div></div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Tab: Deal Flow ───────────────────────────────────────────────────────────

function TabDealFlow({ deals, investors, onStageChange }: {
  deals: InvestorDeal[]
  investors: Investor[]
  onStageChange: (id: number, stage: DealStage) => void
}) {
  const stages: DealStage[] = ['novo', 'enviado', 'interesse', 'visita', 'proposta', 'fechado']

  function getInvestorName(id: number): string {
    return investors.find(i => i.id === id)?.name ?? 'Desconhecido'
  }

  // Conversion rates
  const total = deals.length
  const convRates = stages.map((stage, i) => {
    const count = deals.filter(d => d.stage === stage).length
    const rate = total > 0 ? ((count / total) * 100).toFixed(0) : '0'
    return { stage, count, rate }
  })

  return (
    <div>
      {/* Funnel KPIs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {convRates.map(({ stage, count, rate }) => (
          <div key={stage} style={{
            background: '#fff', border: `1px solid ${STAGE_COLORS[stage]}33`,
            borderRadius: '10px', padding: '10px 14px', minWidth: 100, textAlign: 'center', flex: 1,
            boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
          }}>
            <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 700, color: STAGE_COLORS[stage] }}>{count}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070', textTransform: 'uppercase' }}>{STAGE_LABELS[stage]}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: STAGE_COLORS[stage], marginTop: 2 }}>{rate}%</div>
          </div>
        ))}
      </div>

      {/* Kanban Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, overflowX: 'auto' }}>
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const nextStage = stages[stages.indexOf(stage) + 1]
          return (
            <div key={stage} style={{ minWidth: 160 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                padding: '6px 10px', borderRadius: 8, background: STAGE_COLORS[stage] + '18',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[stage], display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: STAGE_COLORS[stage], fontWeight: 700 }}>{STAGE_LABELS[stage].toUpperCase()}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: STAGE_COLORS[stage] }}>{stageDeals.length}</span>
              </div>

              {stageDeals.map(deal => {
                const inv = investors.find(i => i.id === deal.investorId)
                return (
                  <div key={deal.id} style={{
                    background: '#fff', border: `1px solid #e8e2d4`, borderRadius: '10px',
                    padding: '12px', marginBottom: 8,
                    boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
                  }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{inv?.flag ?? '🌍'}</span>
                      <div>
                        <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 11, fontWeight: 600, color: TXT }}>{getInvestorName(deal.investorId)}</div>
                        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070' }}>{deal.propertyZona}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 11, color: '#5a4f3a', marginBottom: 8, lineHeight: 1.3 }}>{deal.propertyTitle}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: G, fontWeight: 700 }}>{fmt(deal.propertyPreco)}</span>
                      <ScoreBar score={deal.matchScore} />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#16a34a', background: '#16a34a18', borderRadius: 4, padding: '2px 6px' }}>{deal.yieldEstimado.toFixed(1)}% Y</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#2563eb', background: '#2563eb18', borderRadius: 4, padding: '2px 6px' }}>{deal.irrEstimado.toFixed(1)}% IRR</span>
                    </div>
                    {nextStage && (
                      <button type="button" onClick={() => onStageChange(deal.id, nextStage)} style={{
                        width: '100%', marginTop: 8, padding: '5px', borderRadius: 6,
                        background: STAGE_COLORS[nextStage] + '18', color: STAGE_COLORS[nextStage],
                        border: `1px solid ${STAGE_COLORS[nextStage]}44`,
                        fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, cursor: 'pointer', fontWeight: 700,
                      }}>→ {STAGE_LABELS[nextStage].toUpperCase()}</button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Deal Memo ───────────────────────────────────────────────────────────

function TabDealMemo({ investors, properties }: { investors: Investor[]; properties: PortalProperty[] }) {
  const [selInvestor, setSelInvestor] = useState<number | null>(null)
  const [selProperty, setSelProperty] = useState<string | null>(null)
  const [dealType, setDealType] = useState('Buy & Hold')
  const [language, setLanguage] = useState('PT')
  const [yieldEst, setYieldEst] = useState('')
  const [capexEst, setCapexEst] = useState('')
  const [timeline, setTimeline] = useState('')
  const [loading, setLoading] = useState(false)
  const [memo, setMemo] = useState<MemoResult | null>(null)
  const [error, setError] = useState('')

  const investor = investors.find(i => i.id === selInvestor)
  const property = properties.find(p => p.ref === selProperty)

  async function generateMemo() {
    if (!investor || !property) { setError('Seleccione um investidor e um imóvel.'); return }
    setError(''); setLoading(true); setMemo(null)
    try {
      const res = await fetch('/api/investors/deal-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investor, property, dealType, language,
          additionalData: { yieldEstimado: yieldEst, capexEstimado: capexEst, timeline },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMemo(data)
    } catch {
      // Fallback structured memo
      const yld = yieldEst ? parseFloat(yieldEst) : calcYield(property)
      const irr = calcIRR(property, investor.horizonYears)
      setMemo({
        executiveSummary: `${property.nome} representa uma oportunidade de investimento ${dealType} em ${property.zona}, Portugal. Com um preço de ${fmtFull(property.preco)} e yield estimado de ${yld.toFixed(1)}%, este ativo alinha-se com o perfil de ${investor.name} (${TYPE_LABELS[investor.type]}).`,
        investmentThesis: `O imóvel está posicionado num mercado com forte procura internacional. A zona de ${property.zona} registou crescimento YoY acima de 15%. O horizonte de ${investor.horizonYears} anos permite capturar valorização significativa.`,
        financials: {
          precoCompra: property.preco,
          yieldBruto: yld,
          yieldLiquido: yld * 0.72,
          irrEstimado: irr,
          exitValue: Math.round(property.preco * Math.pow(1.065, investor.horizonYears)),
          capexEstimado: capexEst ? parseFloat(capexEst) : 0,
          roi5anos: Math.round(((irr / 100) * 5) * 100),
        },
        risks: [
          'Risco de liquidez em cenário de downturn de mercado',
          'Alterações regulatórias AL / fiscalidade',
          'Risco cambial para investidores fora da zona Euro',
          'Custo de financiamento e evolução da Euribor',
        ],
        nextSteps: [
          'Agendar visita ao imóvel',
          'Due diligence jurídica e técnica',
          'Estruturar proposta formal',
          'CPCV com sinal de 10%',
          'Escritura notarial',
        ],
      })
    } finally {
      setLoading(false)
    }
  }

  function exportTxt() {
    if (!memo || !investor || !property) return
    const content = `DEAL MEMO — ${property.nome}\n${'='.repeat(50)}\n\nEXECUTIVE SUMMARY\n${memo.executiveSummary}\n\nINVESTMENT THESIS\n${memo.investmentThesis}\n\nFINANCIALS\nPreço: ${fmtFull(memo.financials.precoCompra)}\nYield Bruto: ${memo.financials.yieldBruto.toFixed(2)}%\nYield Líquido: ${memo.financials.yieldLiquido.toFixed(2)}%\nIRR: ${memo.financials.irrEstimado.toFixed(2)}%\nExit Value: ${fmtFull(memo.financials.exitValue)}\nROI 5 anos: ${memo.financials.roi5anos}%\n\nRISKS\n${memo.risks.map(r => `• ${r}`).join('\n')}\n\nNEXT STEPS\n${memo.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n— Agency Group · AMI 22506`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `deal-memo-${property.ref}-${investor.name.replace(/\s+/g, '-')}.txt`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: memo ? '420px 1fr' : '1fr', gap: 24 }}>
      {/* Form */}
      <div style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
        <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 300, color: G, marginBottom: 20 }}>
          Gerar Deal Memo IA
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Investidor</label>
          <select value={selInvestor ?? ''} onChange={e => setSelInvestor(Number(e.target.value) || null)}
            style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none' }}>
            <option value="">Seleccionar investidor...</option>
            {investors.map(i => <option key={i.id} value={i.id}>{i.flag} {i.name} · {fmt(i.capitalMin)}–{fmt(i.capitalMax)}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Imóvel</label>
          <select value={selProperty ?? ''} onChange={e => setSelProperty(e.target.value || null)}
            style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none' }}>
            <option value="">Seleccionar imóvel...</option>
            {properties.map(p => <option key={p.id} value={p.ref}>{p.ref} · {p.nome} · {fmt(p.preco)}</option>)}
          </select>
        </div>

        {investor && property && (
          <div style={{ background: '#f4f0e6', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070', marginBottom: 4 }}>MATCH SCORE</div>
            {(() => {
              const m = matchInvestorToProperties(investor, [property])
              const score = m[0]?.score ?? 0
              return <ScoreBar score={score} size="lg" />
            })()}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Tipo de Deal</label>
            <select value={dealType} onChange={e => setDealType(e.target.value)}
              style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none' }}>
              {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Idioma</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none' }}>
              {MEMO_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Yield Est. (%)', val: yieldEst, set: setYieldEst, ph: '4.5' },
            { label: 'CAPEX Est. (€)', val: capexEst, set: setCapexEst, ph: '50000' },
            { label: 'Timeline', val: timeline, set: setTimeline, ph: '5 anos' },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>

        {error && <div style={{ background: '#ef444418', border: '1px solid #ef444433', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, color: '#dc2626' }}>{error}</div>}

        <button type="button" onClick={generateMemo} disabled={loading || !selInvestor || !selProperty} style={{
          width: '100%', padding: '14px', borderRadius: 10,
          background: loading || !selInvestor || !selProperty ? '#d4cfc4' : G,
          color: '#fff', border: 'none', cursor: loading || !selInvestor || !selProperty ? 'default' : 'pointer',
          fontFamily: 'var(--font-dm-mono),monospace', fontSize: 13, fontWeight: 700, letterSpacing: '.05em',
          transition: 'background .2s',
        }}>
          {loading ? '⏳ A GERAR MEMO...' : 'GERAR DEAL MEMO IA'}
        </button>
      </div>

      {/* Memo Result */}
      {memo && investor && property && (
        <div style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: '16px', padding: '24px', overflowY: 'auto', maxHeight: '80vh', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          {/* Memo Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', letterSpacing: '.06em', marginBottom: 4 }}>AGENCY GROUP · AMI 22506 · DEAL MEMO</div>
              <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 24, fontWeight: 700, color: TXT }}>{property.nome}</div>
              <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: '#8a8070', marginTop: 2 }}>{investor.flag} {investor.name} · {dealType} · {language}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={exportTxt} style={{ background: '#f4f0e6', color: G, border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 14px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>EXPORTAR</button>
              <button type="button" onClick={() => window.open(`mailto:${investor.email}?subject=Deal Memo: ${property.nome}&body=...`)} style={{ background: G, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>EMAIL</button>
              <button type="button" onClick={() => window.open(`https://wa.me/${investor.phone.replace(/\D/g, '')}?text=Deal Memo: ${property.nome}`)} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>WA</button>
            </div>
          </div>

          <div style={{ borderTop: `2px solid ${GOLD}`, marginBottom: 20 }} />

          {/* Executive Summary */}
          <MemoSection title="Executive Summary">
            <p style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 14, color: TXT, lineHeight: 1.6, margin: 0 }}>{memo.executiveSummary}</p>
          </MemoSection>

          {/* Investment Thesis */}
          <MemoSection title="Investment Thesis">
            <p style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 14, color: TXT, lineHeight: 1.6, margin: 0 }}>{memo.investmentThesis}</p>
          </MemoSection>

          {/* Financial Projections */}
          <MemoSection title="Financial Projections">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f4f0e6' }}>
                    {['Métrica', 'Valor'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e8e2d4' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { k: 'Preço de Compra', v: fmtFull(memo.financials.precoCompra) },
                    { k: 'CAPEX Estimado', v: memo.financials.capexEstimado > 0 ? fmtFull(memo.financials.capexEstimado) : '—' },
                    { k: 'Yield Bruto', v: `${memo.financials.yieldBruto.toFixed(2)}%` },
                    { k: 'Yield Líquido', v: `${memo.financials.yieldLiquido.toFixed(2)}%` },
                    { k: 'IRR Estimado', v: `${memo.financials.irrEstimado.toFixed(2)}%` },
                    { k: 'Exit Value (estimado)', v: fmtFull(memo.financials.exitValue) },
                    { k: 'ROI 5 Anos', v: `${memo.financials.roi5anos}%` },
                  ].map(({ k, v }, i) => (
                    <tr key={k} style={{ background: i % 2 === 0 ? '#fff' : '#f9f7f2' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: '#5a4f3a', borderBottom: '1px solid #f0ece2' }}>{k}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 13, fontWeight: 700, color: G, borderBottom: '1px solid #f0ece2' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MemoSection>

          {/* Risk Factors */}
          <MemoSection title="Risk Factors">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {memo.risks.map((r, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2 }}>▲</span>
                  <span style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, lineHeight: 1.5 }}>{r}</span>
                </li>
              ))}
            </ul>
          </MemoSection>

          {/* Next Steps */}
          <MemoSection title="Next Steps">
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', counterReset: 'steps' }}>
              {memo.nextSteps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ background: G, color: '#fff', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, lineHeight: 1.5, paddingTop: 2 }}>{s}</span>
                </li>
              ))}
            </ol>
          </MemoSection>

          <div style={{ borderTop: '1px solid #e8e2d4', marginTop: 20, paddingTop: 16, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070' }}>Agency Group · AMI 22506 · Gerado em {new Date('2026-04-05').toLocaleDateString('pt-PT')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function MemoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 16, fontWeight: 300, color: G, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 3, height: 16, background: GOLD, borderRadius: 2, display: 'inline-block' }} />
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── New Investor Modal ───────────────────────────────────────────────────────

function NewInvestorModal({ onClose, onSave }: { onClose: () => void; onSave: (inv: Investor) => void }) {
  const [form, setForm] = useState<Partial<Investor>>({
    type: 'hnwi', riskProfile: 'moderado', status: 'activo', ocupacao: 'qualquer',
    zonas: [], tipoImovel: [], tags: [], dealsHistory: 0, totalInvested: 0,
    lastContact: '2026-04-05', notes: '',
  })

  function set<K extends keyof Investor>(k: K, v: Investor[K]) { setForm(f => ({ ...f, [k]: v })) }
  function toggleArr(field: 'zonas' | 'tipoImovel', val: string) {
    const arr = (form[field] ?? []) as string[]
    set(field, (arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]) as Investor[typeof field])
  }

  const zonaOpts = ['Lisboa', 'Cascais', 'Porto', 'Algarve', 'Comporta', 'Madeira', 'Sintra', 'Alentejo']
  const tipoOpts = ['Apartamento', 'Moradia', 'Herdade', 'Comercial', 'Quinta']

  function handleSubmit() {
    if (!form.name || !form.email) return
    const nationalities: Record<string, string> = { PT: '🇵🇹', UK: '🇬🇧', US: '🇺🇸', FR: '🇫🇷', DE: '🇩🇪', AE: '🇦🇪', CN: '🇨🇳', SA: '🇸🇦', BR: '🇧🇷', QA: '🇶🇦' }
    const nationality = form.nationality ?? 'PT'
    onSave({
      id: Date.now(),
      name: form.name ?? '',
      nationality,
      flag: nationalities[nationality] ?? '🌍',
      type: form.type ?? 'hnwi',
      capitalMin: form.capitalMin ?? 0,
      capitalMax: form.capitalMax ?? 0,
      yieldTarget: form.yieldTarget ?? 4,
      horizonYears: form.horizonYears ?? 5,
      riskProfile: form.riskProfile ?? 'moderado',
      zonas: form.zonas ?? [],
      tipoImovel: form.tipoImovel ?? [],
      ocupacao: form.ocupacao ?? 'qualquer',
      status: form.status ?? 'activo',
      lastContact: form.lastContact ?? '2026-04-05',
      totalInvested: 0,
      dealsHistory: 0,
      notes: form.notes ?? '',
      email: form.email ?? '',
      phone: form.phone ?? '',
      tags: form.tags ?? [],
    })
  }

  const inp = (label: string, field: keyof Investor, type: string = 'text') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={type} value={String(form[field] ?? '')}
        onChange={e => set(field, (type === 'number' ? Number(e.target.value) : e.target.value) as Investor[typeof field])}
        style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: BG, borderRadius: 20, padding: '28px', width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px #00000033' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 22, fontWeight: 300, color: G }}>Novo Investidor</span>
          <button type="button" onClick={onClose} style={{ background: '#f4f0e6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {inp('Nome', 'name')}
          {inp('Email', 'email', 'email')}
          {inp('Telefone', 'phone')}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Nacionalidade</label>
            <select value={form.nationality ?? 'PT'} onChange={e => set('nationality', e.target.value as Investor['nationality'])}
              style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none' }}>
              {[['PT','🇵🇹'],['UK','🇬🇧'],['US','🇺🇸'],['FR','🇫🇷'],['DE','🇩🇪'],['AE','🇦🇪'],['CN','🇨🇳'],['SA','🇸🇦'],['BR','🇧🇷'],['QA','🇶🇦']].map(([code, flag]) => (
                <option key={code} value={code}>{flag} {code}</option>
              ))}
            </select>
          </div>
          {inp('Capital Mín. (€)', 'capitalMin', 'number')}
          {inp('Capital Máx. (€)', 'capitalMax', 'number')}
          {inp('Yield Target (%)', 'yieldTarget', 'number')}
          {inp('Horizonte (anos)', 'horizonYears', 'number')}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Tipo</label>
          <select value={form.type ?? 'hnwi'} onChange={e => set('type', e.target.value as InvestorType)}
            style={{ width: '100%', background: '#f4f0e6', border: '1px solid #d4cfc4', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT, outline: 'none' }}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Zonas de Interesse</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {zonaOpts.map(z => (
              <button type="button" key={z} onClick={() => toggleArr('zonas', z)} style={{
                padding: '5px 12px', borderRadius: 6,
                background: (form.zonas ?? []).includes(z) ? G : '#fff',
                color: (form.zonas ?? []).includes(z) ? '#fff' : '#5a4f3a',
                border: `1px solid ${(form.zonas ?? []).includes(z) ? G : '#d4cfc4'}`,
                fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, cursor: 'pointer', fontWeight: 600,
              }}>{z}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#8a8070', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Tipo de Imóvel</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tipoOpts.map(t => (
              <button type="button" key={t} onClick={() => toggleArr('tipoImovel', t)} style={{
                padding: '5px 12px', borderRadius: 6,
                background: (form.tipoImovel ?? []).includes(t) ? GOLD : '#fff',
                color: (form.tipoImovel ?? []).includes(t) ? '#fff' : '#5a4f3a',
                border: `1px solid ${(form.tipoImovel ?? []).includes(t) ? GOLD : '#d4cfc4'}`,
                fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, cursor: 'pointer', fontWeight: 600,
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: '#f4f0e6', color: '#5a4f3a', border: '1px solid #d4cfc4', borderRadius: 10, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>CANCELAR</button>
          <button type="button" onClick={handleSubmit} style={{ flex: 2, padding: '12px', background: G, color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>CRIAR INVESTIDOR</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalInvestidores() {
  const [investors, setInvestors] = useState<Investor[]>(() => {
    if (typeof window === 'undefined') return INITIAL_INVESTORS
    try {
      const stored = localStorage.getItem('ag_investors')
      return stored ? JSON.parse(stored) : INITIAL_INVESTORS
    } catch { return INITIAL_INVESTORS }
  })

  const [deals, setDeals] = useState<InvestorDeal[]>(() => {
    if (typeof window === 'undefined') return INITIAL_DEALS
    try {
      const stored = localStorage.getItem('ag_investor_deals')
      return stored ? JSON.parse(stored) : INITIAL_DEALS
    } catch { return INITIAL_DEALS }
  })

  const [mainTab, setMainTab] = useState<MainTab>('investidores')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterZona, setFilterZona] = useState('')
  const [filterCapital, setFilterCapital] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiSource, setApiSource] = useState<'supabase' | 'mock' | null>(null)

  const properties = PORTAL_PROPERTIES as PortalProperty[]

  // ── Fetch investors from API on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function fetchInvestors() {
      setApiLoading(true)
      try {
        const res = await fetch('/api/investidores', { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { data: Investor[]; source: 'supabase' | 'mock' }
        if (!cancelled && json.data && json.data.length > 0) {
          // Merge: prefer API data but keep any local additions not in API response
          const apiIds = new Set(json.data.map(i => i.id))
          setInvestors(prev => {
            const localOnly = prev.filter(i => !apiIds.has(i.id))
            return [...json.data, ...localOnly]
          })
          setApiSource(json.source)
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          setApiError(err.message)
        }
      } finally {
        if (!cancelled) setApiLoading(false)
      }
    }
    fetchInvestors()
    return () => { cancelled = true; controller.abort() }
  }, [])

  // Persist to localStorage as local cache
  useEffect(() => {
    try { localStorage.setItem('ag_investors', JSON.stringify(investors)) } catch {}
  }, [investors])

  useEffect(() => {
    try { localStorage.setItem('ag_investor_deals', JSON.stringify(deals)) } catch {}
  }, [deals])

  // Computed KPIs
  const totalCapital = investors.filter(i => i.status === 'activo').reduce((acc, i) => acc + i.totalInvested, 0)
  const activeDealsCount = deals.filter(d => d.stage !== 'fechado' && d.stage !== 'perdido').length
  const avgYield = investors.length > 0 ? investors.reduce((acc, i) => acc + i.yieldTarget, 0) / investors.length : 0

  // Filtered investors
  const filteredInvestors = useMemo(() => {
    return investors.filter(inv => {
      if (filterType && inv.type !== filterType) return false
      if (filterStatus && inv.status !== filterStatus) return false
      if (filterZona && !inv.zonas.some(z => z === filterZona)) return false
      if (filterCapital === 'under1M' && inv.capitalMax >= 1000000) return false
      if (filterCapital === '1M-5M' && (inv.capitalMin > 5000000 || inv.capitalMax < 1000000)) return false
      if (filterCapital === '5M+' && inv.capitalMax < 5000000) return false
      return true
    })
  }, [investors, filterType, filterStatus, filterZona, filterCapital])

  const selectedInvestor = investors.find(i => i.id === selectedId) ?? null

  function handleDealStageChange(dealId: number, stage: DealStage) {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage, sentAt: stage === 'enviado' ? new Date().toISOString().slice(0, 10) : d.sentAt } : d))
  }

  function handleAddDeal(deal: InvestorDeal) {
    setDeals(prev => [...prev, deal])
  }

  function handleSaveInvestor(inv: Investor) {
    setInvestors(prev => prev.map(i => i.id === inv.id ? inv : i))
  }

  async function handleNewInvestor(inv: Investor) {
    setInvestors(prev => [...prev, inv])
    setShowNewModal(false)
    // Persist to Supabase via API (fire-and-forget, errors are non-critical)
    try {
      await fetch('/api/investidores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inv),
      })
    } catch {
      // Non-critical: investor already added to local state
    }
  }

  const allZonas = Array.from(new Set(investors.flatMap(i => i.zonas))).sort()

  const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: 'investidores', label: `Investidores (${investors.length})` },
    { id: 'dealflow', label: `Deal Flow (${deals.filter(d => d.stage !== 'perdido').length})` },
    { id: 'memo', label: 'Deal Memo IA' },
  ]

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: 'var(--font-jost),sans-serif', color: TXT, position: 'relative' }}>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4cfc4; border-radius: 4px; }
      `}</style>

      {/* API status banner */}
      {apiError && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '8px 16px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#856404' }}>
          Investidores API: dados mock em uso ({apiError})
        </div>
      )}
      {apiSource === 'supabase' && (
        <div style={{ background: '#f0faf4', border: '1px solid #a3d9b1', padding: '6px 16px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#1c4a35' }}>
          ● Supabase · dados em tempo real
        </div>
      )}

      {/* Header */}
      <div style={{ background: G, padding: '24px 32px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: '#c9a96e', letterSpacing: '.1em', marginBottom: 4 }}>AGENCY GROUP · AMI 22506</div>
            <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 32, fontWeight: 300, letterSpacing: '-.02em' }}>Investor Intelligence OS</div>
            <div style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: '#ffffff88', marginTop: 4 }}>
              Motor de Gestão de Investidores Imobiliários{apiLoading ? ' · a carregar...' : ''}
            </div>
          </div>
          <button type="button" onClick={() => setShowNewModal(true)} style={{
            background: GOLD, color: '#fff', border: 'none', borderRadius: 10,
            padding: '12px 20px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12,
            cursor: 'pointer', fontWeight: 700, letterSpacing: '.05em',
            boxShadow: '0 4px 16px #c9a96e44',
          }}>
            + NOVO INVESTIDOR
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Investidores Activos', value: String(investors.filter(i => i.status === 'activo').length), color: '#c9a96e' },
            { label: 'Capital Sob Gestão', value: fmt(totalCapital), color: '#4ade80' },
            { label: 'Deals Activos', value: String(activeDealsCount), color: '#60a5fa' },
            { label: 'Yield Médio Target', value: `${avgYield.toFixed(1)}%`, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#ffffff12', borderRadius: 10, padding: '12px 18px', flex: 1, minWidth: 120, backdropFilter: 'blur(4px)' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#ffffff66', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 24, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e2d4', padding: '0 32px' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {MAIN_TABS.map(t => (
            <button type="button" key={t.id} onClick={() => setMainTab(t.id)} style={{
              padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, fontWeight: mainTab === t.id ? 700 : 400,
              color: mainTab === t.id ? G : '#8a8070',
              borderBottom: mainTab === t.id ? `2px solid ${G}` : '2px solid transparent',
              transition: 'all .15s', letterSpacing: '.04em',
            }}>{t.label.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 32px' }}>

        {/* Tab: Investidores */}
        {mainTab === 'investidores' && (
          <div style={{ display: 'flex', gap: 24, animation: 'fadeIn .3s ease' }}>
            {/* Left: Filters + List */}
            <div style={{ flex: 1 }}>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  style={{ background: '#fff', border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: filterType ? G : '#8a8070', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Todos os Tipos</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ background: '#fff', border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: filterStatus ? G : '#8a8070', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Todos os Status</option>
                  <option value="activo">Activo</option>
                  <option value="dormiente">Dormiente</option>
                  <option value="fechado">Fechado</option>
                </select>

                <select value={filterZona} onChange={e => setFilterZona(e.target.value)}
                  style={{ background: '#fff', border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: filterZona ? G : '#8a8070', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Todas as Zonas</option>
                  {allZonas.map(z => <option key={z} value={z}>{z}</option>)}
                </select>

                <select value={filterCapital} onChange={e => setFilterCapital(e.target.value)}
                  style={{ background: '#fff', border: '1px solid #d4cfc4', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: filterCapital ? G : '#8a8070', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Todos os Capitais</option>
                  <option value="under1M">Até €1M</option>
                  <option value="1M-5M">€1M – €5M</option>
                  <option value="5M+">€5M+</option>
                </select>

                {(filterType || filterStatus || filterZona || filterCapital) && (
                  <button type="button" onClick={() => { setFilterType(''); setFilterStatus(''); setFilterZona(''); setFilterCapital('') }}
                    style={{ background: '#ef444418', color: '#dc2626', border: '1px solid #ef444433', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    LIMPAR FILTROS
                  </button>
                )}

                <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-dm-mono),monospace', fontSize: 11, color: '#8a8070', padding: '8px 0' }}>
                  {filteredInvestors.length} de {investors.length}
                </div>
              </div>

              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {filteredInvestors.map(inv => (
                  <InvestorCard
                    key={inv.id} inv={inv}
                    isSelected={selectedId === inv.id}
                    onClick={() => setSelectedId(selectedId === inv.id ? null : inv.id)}
                  />
                ))}
              </div>

              {filteredInvestors.length === 0 && (
                <div style={{ textAlign: 'center', color: '#8a8070', padding: '60px 0', fontFamily: 'var(--font-jost),sans-serif' }}>
                  Nenhum investidor encontrado com estes filtros.
                </div>
              )}
            </div>

            {/* Right: KPI sidebar when no drawer */}
            {!selectedId && (
              <div style={{ width: 280, flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: G, marginBottom: 14 }}>Carteira</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(TYPE_LABELS).map(([type, label]) => {
                    const count = investors.filter(i => i.type === type).length
                    if (count === 0) return null
                    return (
                      <div key={type} style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                        <span style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 13, color: TXT }}>{label}</span>
                        <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 12, color: TYPE_COLORS[type as InvestorType], fontWeight: 700 }}>{count}</span>
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontFamily: 'var(--font-cormorant),serif', fontSize: 18, fontWeight: 300, color: G, marginTop: 24, marginBottom: 14 }}>Top Zonas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allZonas.slice(0, 6).map(z => {
                    const cnt = investors.filter(i => i.zonas.includes(z)).length
                    const pct = Math.round((cnt / investors.length) * 100)
                    return (
                      <div key={z} style={{ background: '#fff', border: '1px solid #e8e2d4', borderRadius: 10, padding: '10px 14px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontFamily: 'var(--font-jost),sans-serif', fontSize: 12, color: TXT }}>{z}</span>
                          <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: 10, color: G, fontWeight: 700 }}>{cnt}</span>
                        </div>
                        <div style={{ height: 4, background: '#f4f0e6', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: G, borderRadius: 4 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Deal Flow */}
        {mainTab === 'dealflow' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>
            <TabDealFlow deals={deals} investors={investors} onStageChange={handleDealStageChange} />
          </div>
        )}

        {/* Tab: Deal Memo */}
        {mainTab === 'memo' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>
            <TabDealMemo investors={investors} properties={properties} />
          </div>
        )}
      </div>

      {/* Investor Drawer */}
      {selectedInvestor && mainTab === 'investidores' && (
        <>
          <div
            onClick={() => setSelectedId(null)}
            style={{ position: 'fixed', inset: 0, background: '#00000033', zIndex: 150 }}
          />
          <InvestorDrawer
            investor={selectedInvestor}
            onClose={() => setSelectedId(null)}
            deals={deals}
            onDealStageChange={handleDealStageChange}
            onAddDeal={handleAddDeal}
            onSave={handleSaveInvestor}
            allProperties={properties}
          />
        </>
      )}

      {/* New Investor Modal */}
      {showNewModal && (
        <NewInvestorModal onClose={() => setShowNewModal(false)} onSave={handleNewInvestor} />
      )}
    </div>
  )
}
