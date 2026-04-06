'use client'
import { useState, useCallback, useEffect } from 'react'
import { PORTAL_PROPERTIES } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type OfferType = 'compra' | 'financiamento' | 'venda' | 'arrendamento'
type OfferStatus = 'Enviada' | 'Vista' | 'Em Análise' | 'Contra-Proposta' | 'Aceite' | 'Recusada'
type DraftTab = 'nova' | 'activas' | 'historico' | 'templates'
type WizardStep = 1 | 2 | 3

interface FinancingCondition {
  enabled: boolean
  bank: string
  amount: string
  deadline: string
}

interface InspectionCondition {
  enabled: boolean
  deadline: string
}

interface OfferConditions {
  financing: FinancingCondition
  inspection: InspectionCondition
  subjectToValuation: boolean
  cpcvRequested: boolean
  cpcvDate: string
  escrituraDate: string
  exclusivity: boolean
  furnitureIncluded: boolean
  customConditions: string
}

interface TimelineEvent {
  date: string
  label: string
  status: 'done' | 'active' | 'pending'
}

interface ActiveOffer {
  id: string
  propertyId: string
  propertyName: string
  buyerName: string
  buyerNationality: string
  buyerNIF?: string
  offerAmount: number
  askingPrice: number
  offerType: OfferType
  submittedAt: string
  status: OfferStatus
  counterOfferAmount?: number
  counterOfferNote?: string
  timeline: TimelineEvent[]
  responseDeadline: string
}

interface HistoricalOffer {
  id: string
  propertyName: string
  buyerName: string
  offerAmount: number
  askingPrice: number
  result: 'Aceite' | 'Recusada'
  closedAt: string
  negotiationDays: number
}

interface OfferTemplate {
  id: string
  name: string
  tagline: string
  whenToUse: string
  exampleLanguage: string
  successRate: number
  discountPct: number
  color: string
  textColor: string
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const OFFER_TEMPLATES: OfferTemplate[] = [
  {
    id: 'firme',
    name: 'Oferta Firme',
    tagline: 'Abaixo de mercado — leverage alto',
    whenToUse: 'Imóvel com mais de 120 dias de mercado. Vendedor motivado. Sem outros interessados confirmados.',
    exampleLanguage: '"Apresentamos uma proposta firme e não condicionada de [X], válida por 72 horas. O nosso cliente demonstra capacidade financeira comprovada e disponibilidade para escritura rápida."',
    successRate: 38,
    discountPct: 12,
    color: '#fef2f2',
    textColor: '#b91c1c',
  },
  {
    id: 'estrategica',
    name: 'Oferta Estratégica',
    tagline: 'A preço de mercado com condições favoráveis',
    whenToUse: 'Imóvel com 30–90 dias. Vendedor normal. Bom imóvel sem urgência.',
    exampleLanguage: '"Proposta ao preço solicitado, com condição de financiamento bancário a confirmar em 21 dias. Sinal de 10% na assinatura do CPCV, escritura em 90 dias."',
    successRate: 72,
    discountPct: 0,
    color: '#f0fdf4',
    textColor: '#15803d',
  },
  {
    id: 'premium',
    name: 'Oferta Premium',
    tagline: 'Acima de mercado — limpa, rápida',
    whenToUse: 'Imóvel excepcional com múltiplos interessados. Cliente com capital próprio. Urgência de fecho.',
    exampleLanguage: '"Proposta acima do preço solicitado, sem condições suspensivas. Sinal de 20% disponível imediatamente. Escritura em 45 dias a conveniência do vendedor."',
    successRate: 89,
    discountPct: -5,
    color: 'rgba(201,169,110,.1)',
    textColor: '#b8852a',
  },
  {
    id: 'escalation',
    name: 'Multi-Oferta',
    tagline: 'Cláusula de escalação automática',
    whenToUse: 'Leilão informal. Múltiplos compradores. Vendedor receptivo a melhor oferta.',
    exampleLanguage: '"Propomos [X], com cláusula de escalação: se receber oferta superior entre [X] e [MAX], a nossa proposta sobe automaticamente €5.000 acima, até ao máximo de [MAX]."',
    successRate: 61,
    discountPct: 0,
    color: 'rgba(58,123,213,.08)',
    textColor: '#1d4ed8',
  },
  {
    id: 'cash',
    name: 'All-Cash',
    tagline: 'Velocidade como vantagem competitiva',
    whenToUse: 'Vendedor quer rapidez. Situação de herança ou urgência financeira. Capital próprio disponível.',
    exampleLanguage: '"Oferta a pronto pagamento, sem financiamento, sem condições. Sinal de 30% na assinatura do CPCV esta semana. Escritura em 30 dias. Zero risco de incumprimento."',
    successRate: 84,
    discountPct: 8,
    color: '#fafaf9',
    textColor: '#1c4a35',
  },
  {
    id: 'preaprovacao',
    name: 'Pré-Aprovação Bancária',
    tagline: 'Financiamento confirmado — credibilidade máxima',
    whenToUse: 'Comprador com pré-aprovação bancária. Vendedor preocupado com risco de incumprimento.',
    exampleLanguage: '"Acompanha esta proposta carta de pré-aprovação bancária pelo Banco [X] para [Y]€. O nosso cliente tem aprovação formal e está pronto para avançar imediatamente após aceitação."',
    successRate: 78,
    discountPct: 3,
    color: 'rgba(28,74,53,.06)',
    textColor: '#1c4a35',
  },
]

const MOCK_ACTIVE_OFFERS: ActiveOffer[] = [
  {
    id: 'off-001',
    propertyId: 'AG-2026-020',
    propertyName: 'Villa Quinta da Marinha',
    buyerName: 'James Mitchell',
    buyerNationality: 'EUA',
    offerAmount: 3610000,
    askingPrice: 3800000,
    offerType: 'compra',
    submittedAt: '2026-04-02T10:30:00Z',
    status: 'Contra-Proposta',
    counterOfferAmount: 3700000,
    counterOfferNote: 'Vendedor aceita mas solicita prazo de escritura mínimo de 90 dias e manutenção de todo o recheio.',
    timeline: [
      { date: '02 Abr 10:30', label: 'Proposta enviada — €3.610.000', status: 'done' },
      { date: '02 Abr 14:15', label: 'Vendedor viu a proposta', status: 'done' },
      { date: '03 Abr 09:00', label: 'Em análise com advogado vendedor', status: 'done' },
      { date: '04 Abr 11:20', label: 'Contra-proposta recebida — €3.700.000', status: 'active' },
      { date: '—', label: 'Aguarda resposta do comprador', status: 'pending' },
    ],
    responseDeadline: '2026-04-07',
  },
  {
    id: 'off-002',
    propertyId: 'AG-2026-010',
    propertyName: 'Penthouse Príncipe Real',
    buyerName: 'Pierre Dubois',
    buyerNationality: 'França',
    offerAmount: 2750000,
    askingPrice: 2850000,
    offerType: 'financiamento',
    submittedAt: '2026-04-03T09:00:00Z',
    status: 'Em Análise',
    timeline: [
      { date: '03 Abr 09:00', label: 'Proposta enviada — €2.750.000', status: 'done' },
      { date: '03 Abr 16:45', label: 'Confirmação de recepção', status: 'done' },
      { date: '04 Abr 10:00', label: 'Em análise — prazo: 72h', status: 'active' },
      { date: '—', label: 'Resposta esperada até 6 Abr', status: 'pending' },
    ],
    responseDeadline: '2026-04-06',
  },
  {
    id: 'off-003',
    propertyId: 'AG-2026-050',
    propertyName: 'Villa Vale do Lobo Golf',
    buyerName: 'Khalid Al-Rashid',
    buyerNationality: 'EAU',
    offerAmount: 4200000,
    askingPrice: 4200000,
    offerType: 'compra',
    submittedAt: '2026-04-04T14:00:00Z',
    status: 'Vista',
    timeline: [
      { date: '04 Abr 14:00', label: 'Proposta enviada — €4.200.000', status: 'done' },
      { date: '04 Abr 18:30', label: 'Vendedor viu a proposta', status: 'active' },
      { date: '—', label: 'Aguarda resposta formal', status: 'pending' },
    ],
    responseDeadline: '2026-04-07',
  },
  {
    id: 'off-004',
    propertyId: 'AG-2026-040',
    propertyName: 'Apartamento Foz do Douro',
    buyerName: 'Charlotte Blake',
    buyerNationality: 'Reino Unido',
    offerAmount: 940000,
    askingPrice: 980000,
    offerType: 'financiamento',
    submittedAt: '2026-04-01T11:00:00Z',
    status: 'Aceite',
    timeline: [
      { date: '01 Abr 11:00', label: 'Proposta enviada — €940.000', status: 'done' },
      { date: '01 Abr 15:20', label: 'Vendedor analisou', status: 'done' },
      { date: '02 Abr 10:00', label: 'Proposta ACEITE', status: 'done' },
      { date: '05 Abr', label: 'CPCV previsto', status: 'active' },
    ],
    responseDeadline: '2026-04-05',
  },
  {
    id: 'off-005',
    propertyId: 'AG-2026-060',
    propertyName: 'Apartamento Funchal Prime',
    buyerName: 'Marco Aurelio Santos',
    buyerNationality: 'Brasil',
    offerAmount: 890000,
    askingPrice: 980000,
    offerType: 'compra',
    submittedAt: '2026-03-28T09:00:00Z',
    status: 'Enviada',
    timeline: [
      { date: '28 Mar 09:00', label: 'Proposta enviada — €890.000', status: 'done' },
      { date: '—', label: 'Aguarda primeira resposta', status: 'active' },
    ],
    responseDeadline: '2026-04-05',
  },
]

const MOCK_HISTORICAL: HistoricalOffer[] = [
  { id: 'h-001', propertyName: 'Moradia Belém com Jardim', buyerName: 'Sophie Hartmann', offerAmount: 3100000, askingPrice: 3200000, result: 'Aceite', closedAt: '2026-03-20', negotiationDays: 8 },
  { id: 'h-002', propertyName: 'Herdade Comporta Exclusiva', buyerName: 'Ahmed Al-Farsi', offerAmount: 5900000, askingPrice: 6500000, result: 'Recusada', closedAt: '2026-03-10', negotiationDays: 14 },
  { id: 'h-003', propertyName: 'Quinta Histórica Sintra', buyerName: 'David Chen', offerAmount: 2700000, askingPrice: 2800000, result: 'Aceite', closedAt: '2026-02-28', negotiationDays: 6 },
  { id: 'h-004', propertyName: 'Moradia Estoril Frente Mar', buyerName: 'Isabelle Martin', offerAmount: 2050000, askingPrice: 2100000, result: 'Aceite', closedAt: '2026-02-15', negotiationDays: 4 },
  { id: 'h-005', propertyName: 'Apartamento Chiado Premium', buyerName: 'Robert Wilson', offerAmount: 1300000, askingPrice: 1450000, result: 'Recusada', closedAt: '2026-02-05', negotiationDays: 10 },
  { id: 'h-006', propertyName: 'Villa Vale do Lobo Golf', buyerName: 'Omar Hassan', offerAmount: 3950000, askingPrice: 4200000, result: 'Aceite', closedAt: '2026-01-30', negotiationDays: 12 },
]

const NATIONALITY_FLAGS: Record<string, string> = {
  'Portugal': '🇵🇹', 'EUA': '🇺🇸', 'França': '🇫🇷', 'Reino Unido': '🇬🇧',
  'Alemanha': '🇩🇪', 'Brasil': '🇧🇷', 'China': '🇨🇳', 'EAU': '🇦🇪',
  'Suíça': '🇨🇭', 'Arábia Saudita': '🇸🇦',
}

const BANKS = ['Millennium BCP', 'Caixa Geral de Depósitos', 'Novo Banco', 'Santander', 'BPI', 'Bankinter', 'Deutsche Bank', 'BNP Paribas', 'HSBC', 'Outro']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPreco(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toLocaleString('pt-PT', { minimumFractionDigits: v % 1_000_000 === 0 ? 0 : 1, maximumFractionDigits: 2 })}M`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`
  return `€${v}`
}

function pctDiff(offer: number, asking: number): number {
  return Math.round(((offer - asking) / asking) * 100)
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function statusColor(status: OfferStatus): { bg: string; color: string; border: string } {
  const map: Record<OfferStatus, { bg: string; color: string; border: string }> = {
    'Enviada': { bg: 'rgba(58,123,213,.1)', color: '#1d4ed8', border: 'rgba(58,123,213,.3)' },
    'Vista': { bg: 'rgba(201,169,110,.1)', color: '#b8852a', border: 'rgba(201,169,110,.3)' },
    'Em Análise': { bg: 'rgba(74,156,122,.1)', color: '#2a7a5a', border: 'rgba(74,156,122,.3)' },
    'Contra-Proposta': { bg: 'rgba(234,179,8,.1)', color: '#b45309', border: 'rgba(234,179,8,.3)' },
    'Aceite': { bg: 'rgba(28,74,53,.12)', color: '#1c4a35', border: 'rgba(28,74,53,.3)' },
    'Recusada': { bg: 'rgba(192,57,43,.1)', color: '#c0392b', border: 'rgba(192,57,43,.3)' },
  }
  return map[status]
}

function generateOfferLetter(
  property: typeof PORTAL_PROPERTIES[0] | undefined,
  buyerName: string,
  offerAmount: number,
  offerType: OfferType,
  conditions: OfferConditions,
  deadline: string,
  depositAmount: number
): string {
  if (!property) return ''
  const typeLabels: Record<OfferType, string> = {
    compra: 'Compra Simples',
    financiamento: 'Compra com Condição de Financiamento',
    venda: 'Compra Condicionada a Venda',
    arrendamento: 'Arrendamento com Opção de Compra',
  }
  const pct = pctDiff(offerAmount, property.preco)
  const pctLabel = pct === 0 ? 'ao preço solicitado' : pct > 0 ? `${Math.abs(pct)}% acima do preço solicitado` : `${Math.abs(pct)}% abaixo do preço solicitado`

  return `PROPOSTA DE ${offerType === 'arrendamento' ? 'ARRENDAMENTO' : 'AQUISIÇÃO'}

Exmo(a). Senhor(a) Proprietário(a),

Venho por este meio, em representação de ${buyerName || '[COMPRADOR]'}, apresentar uma proposta formal de ${typeLabels[offerType].toLowerCase()} para o imóvel:

REFERÊNCIA: ${property.ref}
DESIGNAÇÃO: ${property.nome}
LOCALIZAÇÃO: ${property.bairro}, ${property.zona}
PREÇO SOLICITADO: ${fmtPreco(property.preco)}

─────────────────────────────────────

TERMOS DA PROPOSTA

Valor proposto: ${fmtPreco(offerAmount)} (${pctLabel})
Tipologia: ${typeLabels[offerType]}
Sinal proposto: ${fmtPreco(depositAmount)} (na assinatura do CPCV)
${conditions.cpcvRequested && conditions.cpcvDate ? `Data CPCV proposta: ${conditions.cpcvDate}` : ''}
${conditions.escrituraDate ? `Data de Escritura proposta: ${conditions.escrituraDate}` : ''}

─────────────────────────────────────

CONDIÇÕES${conditions.financing.enabled || conditions.inspection.enabled || conditions.subjectToValuation || conditions.exclusivity ? '' : '\n\nSem condições suspensivas.'}

${conditions.financing.enabled ? `▸ Condição de Financiamento: Crédito bancário junto do ${conditions.financing.bank || '[BANCO]'}, no valor de ${conditions.financing.amount ? fmtPreco(Number(conditions.financing.amount)) : '[VALOR]'}. Prazo para confirmação: ${conditions.financing.deadline || '[PRAZO]'}.` : ''}
${conditions.inspection.enabled ? `▸ Condição de Vistoria Técnica: Prazo para realização: ${conditions.inspection.deadline || '[PRAZO]'}. Caso a vistoria revele anomalias estruturais graves, o comprador poderá renegociar ou desistir sem penalização.` : ''}
${conditions.subjectToValuation ? '▸ Sujeito a Avaliação Bancária: Caso a avaliação bancária seja inferior em mais de 5% ao valor proposto, a proposta fica sem efeito, sem penalização para o comprador.' : ''}
${conditions.exclusivity ? '▸ Exclusividade: Solicitamos que o imóvel seja retirado do mercado após aceitação desta proposta.' : ''}
${conditions.furnitureIncluded ? '▸ Recheio: A presente proposta inclui o recheio e equipamentos existentes no imóvel, conforme inventário a estabelecer.' : ''}
${conditions.customConditions ? `▸ Condições Adicionais: ${conditions.customConditions}` : ''}

─────────────────────────────────────

Esta proposta é válida até ${deadline ? new Date(deadline).toLocaleDateString('pt-PT') : '[PRAZO]'}.

Aguardando a vossa resposta com toda a consideração,

Agency Group · AMI 22506
Em representação de ${buyerName || '[COMPRADOR]'}`
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconWizardDot = ({ active, done }: { active: boolean; done: boolean }) => (
  <div style={{
    width: 28, height: 28, borderRadius: '50%',
    background: done ? '#1c4a35' : active ? '#c9a96e' : 'rgba(14,14,13,.1)',
    border: `2px solid ${done ? '#1c4a35' : active ? '#c9a96e' : 'rgba(14,14,13,.15)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    transition: 'all .2s',
  }}>
    {done ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    ) : (
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#fff' : 'rgba(14,14,13,.3)' }} />
    )}
  </div>
)

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
)
const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
)
const IconWhatsapp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.38 1.26 4.8L2 22l5.44-1.43a9.87 9.87 0 004.6 1.14h.01c5.45 0 9.9-4.46 9.9-9.91C22 6.45 17.5 2 12.04 2zm5.52 14.19c-.23.64-1.36 1.22-1.86 1.27-.5.05-.97.24-3.26-.68-2.74-1.1-4.5-3.88-4.63-4.06-.13-.18-1.07-1.43-1.07-2.73 0-1.3.68-1.94.93-2.2.25-.26.54-.32.72-.32.18 0 .36.01.52.01.16.01.38-.06.6.46l.86 2.09c.07.18.12.38.01.58-.1.2-.16.32-.31.5-.15.17-.32.38-.45.5-.15.14-.3.29-.13.58.17.28.77 1.27 1.65 2.06.97.87 1.8 1.14 2.06 1.27.27.13.42.11.58-.07.17-.18.7-.82.89-1.1.18-.28.37-.23.62-.14l2.01.95c.24.11.38.17.44.26.06.1.06.55-.17 1.07z"/>
  </svg>
)
const IconPDF = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
)
const IconArrow = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {dir === 'right' ? <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></> : <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>}
  </svg>
)
const IconTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="8 21 12 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/>
    <path d="M7 4H17v5a5 5 0 01-10 0V4z"/><path d="M17 5h3v3a3 3 0 01-3 3"/><path d="M7 5H4v3a3 3 0 003 3"/>
  </svg>
)
const IconLightbulb = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/>
  </svg>
)
const IconWarning = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconSlider = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
    <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
    <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
)

// ─── Toggle Component ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.6rem 0' }}>
      <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.875rem', color: '#0e0e0d' }}>{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? '#1c4a35' : 'rgba(14,14,13,.15)', padding: 0, position: 'relative',
          transition: 'background .2s', flexShrink: 0,
        }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

interface Step1Props {
  selectedPropertyId: string
  setSelectedPropertyId: (id: string) => void
  offerPct: number
  setOfferPct: (v: number) => void
  offerAmount: number
  setOfferAmount: (v: number) => void
  offerType: OfferType
  setOfferType: (v: OfferType) => void
  buyerName: string
  setBuyerName: (v: string) => void
  buyerNationality: string
  setBuyerNationality: (v: string) => void
  buyerNIF: string
  setBuyerNIF: (v: string) => void
  responseDeadline: string
  setResponseDeadline: (v: string) => void
  depositAmount: number
  setDepositAmount: (v: number) => void
  onNext: () => void
}

function Step1({
  selectedPropertyId, setSelectedPropertyId, offerPct, setOfferPct,
  offerAmount, setOfferAmount, offerType, setOfferType,
  buyerName, setBuyerName, buyerNationality, setBuyerNationality,
  buyerNIF, setBuyerNIF, responseDeadline, setResponseDeadline,
  depositAmount, setDepositAmount, onNext,
}: Step1Props) {
  const property = PORTAL_PROPERTIES.find(p => p.id === selectedPropertyId)
  const asking = property?.preco ?? 0
  const pct = pctDiff(offerAmount, asking)

  function handlePctChange(v: number) {
    setOfferPct(v)
    if (asking > 0) {
      const amt = Math.round(asking * v / 100)
      setOfferAmount(amt)
      setDepositAmount(Math.round(amt * 0.1))
    }
  }

  function handleAmountChange(raw: string) {
    const v = Number(raw.replace(/\D/g, ''))
    setOfferAmount(v)
    if (asking > 0) setOfferPct(Math.round((v / asking) * 100))
    setDepositAmount(Math.round(v * 0.1))
  }

  const canNext = !!selectedPropertyId && offerAmount > 0 && buyerName.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Property Selector */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Imóvel</label>
        <select className="p-sel" value={selectedPropertyId} onChange={e => {
          setSelectedPropertyId(e.target.value)
          const p = PORTAL_PROPERTIES.find(pr => pr.id === e.target.value)
          if (p) {
            const amt = Math.round(p.preco * offerPct / 100)
            setOfferAmount(amt)
            setDepositAmount(Math.round(amt * 0.1))
          }
        }}>
          <option value="">Seleccionar imóvel…</option>
          {PORTAL_PROPERTIES.map(p => (
            <option key={p.id} value={p.id}>{p.nome} — {fmtPreco(p.preco)}</option>
          ))}
        </select>
        {property && (
          <div style={{ display: 'flex', gap: '.75rem', marginTop: '.15rem', padding: '.75rem', background: 'rgba(28,74,53,.05)', borderRadius: '10px', border: '1px solid rgba(28,74,53,.12)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: '#0e0e0d', fontWeight: 600 }}>{property.nome}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.45)' }}>{property.bairro} · T{property.quartos} · {property.area}m²</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)' }}>PREÇO PEDIDO</div>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.25rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(property.preco)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Offer Slider */}
      {property && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.3rem' }}>
            <label className="p-label" style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}><IconSlider /> Valor da Oferta</label>
            <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.3rem', color: pct > 0 ? '#1c4a35' : pct < -8 ? '#c0392b' : '#c9a96e', fontWeight: 600 }}>
              {pct > 0 ? '+' : ''}{pct}% vs. pedido
            </span>
          </div>
          <input type="range" min={70} max={110} value={offerPct} onChange={e => handlePctChange(Number(e.target.value))}
            style={{ width: '100%', marginBottom: '.3rem', accentColor: '#1c4a35' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.35)' }}>70% — {fmtPreco(Math.round(asking * 0.7))}</span>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.35)' }}>110% — {fmtPreco(Math.round(asking * 1.1))}</span>
          </div>
          <div>
            <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Valor Manual</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.9rem', color: 'rgba(14,14,13,.4)' }}>€</span>
              <input className="p-inp" value={offerAmount.toLocaleString('pt-PT')}
                onChange={e => handleAmountChange(e.target.value)}
                style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.3rem', fontWeight: 600, color: '#0e0e0d' }} />
            </div>
          </div>
        </div>
      )}

      {/* Offer Type */}
      <div>
        <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Tipo de Oferta</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.4rem' }}>
          {([
            { id: 'compra' as OfferType, label: 'Compra Simples', sub: 'Sem condições' },
            { id: 'financiamento' as OfferType, label: 'Com Financiamento', sub: 'Condição de crédito' },
            { id: 'venda' as OfferType, label: 'Com Venda', sub: 'Condicionada a venda' },
            { id: 'arrendamento' as OfferType, label: 'Arrendamento', sub: 'Com opção de compra' },
          ]).map(t => (
            <button type="button" key={t.id} onClick={() => setOfferType(t.id)}
              style={{
                borderRadius: 8, padding: '.6rem .75rem', cursor: 'pointer', textAlign: 'left',
                border: `1.5px solid ${offerType === t.id ? '#1c4a35' : 'rgba(14,14,13,.12)'}`,
                background: offerType === t.id ? 'rgba(28,74,53,.06)' : '#fff',
                transition: 'all .15s',
              }}>
              <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', fontWeight: 600, color: offerType === t.id ? '#1c4a35' : '#0e0e0d' }}>{t.label}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginTop: '.15rem' }}>{t.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Buyer Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Nome do Comprador</label>
          <input className="p-inp" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div>
          <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Nacionalidade</label>
          <select className="p-sel" value={buyerNationality} onChange={e => setBuyerNationality(e.target.value)}>
            {Object.entries(NATIONALITY_FLAGS).map(([n, f]) => <option key={n} value={n}>{f} {n}</option>)}
          </select>
        </div>
        <div>
          <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>NIF (opcional)</label>
          <input className="p-inp" value={buyerNIF} onChange={e => setBuyerNIF(e.target.value)} placeholder="000 000 000" />
        </div>
      </div>

      {/* Deadline & Deposit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
        <div>
          <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Prazo de Resposta</label>
          <input className="p-inp" type="date" value={responseDeadline} onChange={e => setResponseDeadline(e.target.value)} />
          <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginTop: '.15rem' }}>
            {responseDeadline ? `${daysUntil(responseDeadline)} dias a partir de hoje` : 'Padrão: +72 horas'}
          </p>
        </div>
        <div>
          <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Sinal Proposto</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.85rem', color: 'rgba(14,14,13,.4)' }}>€</span>
            <input className="p-inp" value={depositAmount.toLocaleString('pt-PT')}
              onChange={e => setDepositAmount(Number(e.target.value.replace(/\D/g, '')))} />
          </div>
          <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginTop: '.15rem' }}>
            {offerAmount > 0 ? `${Math.round((depositAmount / offerAmount) * 100)}% do valor da oferta` : '10% padrão'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '.25rem' }}>
        <button type="button" onClick={onNext} className="p-btn-gold" disabled={!canNext}
          style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem', opacity: canNext ? 1 : .45 }}>
          Condições <IconArrow dir="right" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ conditions, setConditions, onBack, onNext }: {
  conditions: OfferConditions
  setConditions: (c: OfferConditions) => void
  onBack: () => void
  onNext: () => void
}) {
  function update<K extends keyof OfferConditions>(key: K, value: OfferConditions[K]) {
    setConditions({ ...conditions, [key]: value })
  }

  function updateFinancing<K extends keyof FinancingCondition>(key: K, value: FinancingCondition[K]) {
    setConditions({ ...conditions, financing: { ...conditions.financing, [key]: value } })
  }

  function updateInspection<K extends keyof InspectionCondition>(key: K, value: InspectionCondition[K]) {
    setConditions({ ...conditions, inspection: { ...conditions.inspection, [key]: value } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <Toggle value={conditions.financing.enabled} onChange={v => updateFinancing('enabled', v)} label="Condição de Financiamento" />
        {conditions.financing.enabled && (
          <div style={{ paddingTop: '.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Banco</label>
              <select className="p-sel" value={conditions.financing.bank} onChange={e => updateFinancing('bank', e.target.value)}>
                <option value="">Seleccionar…</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Montante</label>
              <input className="p-inp" value={conditions.financing.amount} onChange={e => updateFinancing('amount', e.target.value)} placeholder="ex: 800000" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Prazo para confirmar crédito</label>
              <input className="p-inp" type="date" value={conditions.financing.deadline} onChange={e => updateFinancing('deadline', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <Toggle value={conditions.inspection.enabled} onChange={v => updateInspection('enabled', v)} label="Condição de Vistoria Técnica" />
        {conditions.inspection.enabled && (
          <div style={{ paddingTop: '.75rem' }}>
            <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Prazo para vistoria</label>
            <input className="p-inp" type="date" value={conditions.inspection.deadline} onChange={e => updateInspection('deadline', e.target.value)} />
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <Toggle value={conditions.subjectToValuation} onChange={v => update('subjectToValuation', v)} label="Sujeito a Avaliação Bancária (±5%)" />
      </div>

      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <Toggle value={conditions.cpcvRequested} onChange={v => update('cpcvRequested', v)} label="Solicitar CPCV" />
        {conditions.cpcvRequested && (
          <div style={{ paddingTop: '.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.6rem' }}>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Data CPCV proposta</label>
              <input className="p-inp" type="date" value={conditions.cpcvDate} onChange={e => update('cpcvDate', e.target.value)} />
            </div>
            <div>
              <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Data Escritura proposta</label>
              <input className="p-inp" type="date" value={conditions.escrituraDate} onChange={e => update('escrituraDate', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <Toggle value={conditions.exclusivity} onChange={v => update('exclusivity', v)} label="Solicitar Exclusividade (retirar do mercado)" />
      </div>

      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <Toggle value={conditions.furnitureIncluded} onChange={v => update('furnitureIncluded', v)} label="Recheio Incluído" />
      </div>

      <div className="p-card" style={{ padding: '1rem 1.25rem' }}>
        <label className="p-label" style={{ display: 'block', marginBottom: '.3rem' }}>Condições Personalizadas</label>
        <textarea className="p-inp" value={conditions.customConditions} onChange={e => update('customConditions', e.target.value)}
          placeholder="Adicione quaisquer condições específicas…" rows={3} style={{ resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '.25rem' }}>
        <button type="button" onClick={onBack} className="p-btn" style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem' }}>
          <IconArrow dir="left" /> Voltar
        </button>
        <button type="button" onClick={onNext} className="p-btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem' }}>
          Gerar Proposta <IconArrow dir="right" />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({
  property, buyerName, offerAmount, offerType, conditions, responseDeadline, depositAmount, onBack,
}: {
  property: typeof PORTAL_PROPERTIES[0] | undefined
  buyerName: string
  offerAmount: number
  offerType: OfferType
  conditions: OfferConditions
  responseDeadline: string
  depositAmount: number
  onBack: () => void
}) {
  const [copied, setCopied] = useState(false)
  const letterText = generateOfferLetter(property, buyerName, offerAmount, offerType, conditions, responseDeadline, depositAmount)

  function copy() {
    navigator.clipboard.writeText(letterText).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!property) return null

  const pct = pctDiff(offerAmount, property.preco)
  const dom = Math.floor((Date.now() - new Date(property.listingDate).getTime()) / 86_400_000)
  const leverage = dom > 120 ? 'ALTO' : dom > 60 ? 'MÉDIO' : 'BAIXO'
  const leverageColor = dom > 120 ? '#1c4a35' : dom > 60 ? '#c9a96e' : '#c0392b'
  const marginLow = 5, marginHigh = 8
  const recommendedPct = Math.max(pct, -7)
  const recommendedPrice = Math.round(property.preco * (1 + recommendedPct / 100))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start' }}>
      {/* Letter preview */}
      <div>
        <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.25rem', color: '#0e0e0d', fontWeight: 300, margin: '0 0 .75rem' }}>
          Prévia da Proposta
        </h3>
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid rgba(14,14,13,.1)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)', fontFamily: 'var(--font-dm-mono)', fontSize: '.78rem', color: '#0e0e0d', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 520, overflowY: 'auto' }}>
          {letterText}
        </div>
        <div style={{ display: 'flex', gap: '.4rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={copy} className="p-btn" style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            {copied ? <><IconCheck /> Copiado!</> : <><IconCopy /> Copiar Proposta</>}
          </button>
          <button type="button" className="p-btn" style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <IconMail /> Enviar por Email
          </button>
          <button type="button" className="p-btn" style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.4rem', color: '#16a34a', borderColor: 'rgba(22,163,74,.3)' }}>
            <IconWhatsapp /> WhatsApp
          </button>
          <button type="button" className="p-btn" style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.4rem', color: '#c0392b', borderColor: 'rgba(192,57,43,.3)' }}>
            <IconPDF /> Gerar PDF
          </button>
        </div>
        <div style={{ marginTop: '.75rem' }}>
          <button type="button" onClick={onBack} className="p-btn" style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <IconArrow dir="left" /> Editar Condições
          </button>
        </div>
      </div>

      {/* Strategy panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
        <div className="p-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '1rem' }}>
            <IconLightbulb />
            <h4 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', color: '#0e0e0d', fontWeight: 300, margin: 0 }}>Estratégia de Negociação</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            <div style={{ padding: '.7rem .9rem', background: 'rgba(14,14,13,.04)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.3rem' }}>MARGEM ESTIMADA NESTA ZONA</div>
              <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.88rem', color: '#0e0e0d', fontWeight: 600 }}>{marginLow}–{marginHigh}%</div>
            </div>

            <div style={{ padding: '.7rem .9rem', background: leverage === 'ALTO' ? 'rgba(28,74,53,.08)' : leverage === 'MÉDIO' ? 'rgba(201,169,110,.08)' : 'rgba(192,57,43,.06)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.3rem' }}>IMÓVEL NO MERCADO HÁ</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.88rem', color: '#0e0e0d', fontWeight: 600 }}>{dom} dias</span>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', fontWeight: 700, color: leverageColor }}>LEVERAGE: {leverage}</span>
              </div>
            </div>

            <div style={{ padding: '.7rem .9rem', background: 'rgba(201,169,110,.08)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.3rem' }}>OUTROS INTERESSADOS</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.88rem', color: '#0e0e0d', fontWeight: 600 }}>3 reportados</span>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', fontWeight: 700, color: '#c9a96e' }}>URGÊNCIA: MÉDIA</span>
              </div>
            </div>

            <div style={{ padding: '.85rem .9rem', background: 'rgba(28,74,53,.06)', borderRadius: 8, border: '1px solid rgba(28,74,53,.15)' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.3rem' }}>PREÇO RECOMENDADO</div>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.5rem', color: '#1c4a35', fontWeight: 600 }}>{fmtPreco(recommendedPrice)}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.45)', marginTop: '.15rem' }}>
                {recommendedPct}% vs. pedido · boa chance de aceitação
              </div>
            </div>
          </div>
        </div>

        {pct < -10 && (
          <div style={{ padding: '.9rem 1rem', background: 'rgba(192,57,43,.06)', borderRadius: 10, border: '1px solid rgba(192,57,43,.2)', display: 'flex', gap: '.6rem' }}>
            <div style={{ color: '#c0392b', flexShrink: 0, paddingTop: '.25rem' }}><IconWarning /></div>
            <div>
              <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: '#c0392b', fontWeight: 600, marginBottom: '.3rem' }}>Oferta muito abaixo</div>
              <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: 'rgba(14,14,13,.55)', lineHeight: 1.5 }}>
                Uma oferta {Math.abs(pct)}% abaixo pode ofender o vendedor. Considere aumentar ou reforçar com condições favoráveis.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Nova Proposta ────────────────────────────────────────────────────────

function NovaPropostaTab() {
  const [step, setStep] = useState<WizardStep>(1)
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [offerPct, setOfferPct] = useState(95)
  const [offerAmount, setOfferAmount] = useState(0)
  const [offerType, setOfferType] = useState<OfferType>('compra')
  const [buyerName, setBuyerName] = useState('')
  const [buyerNationality, setBuyerNationality] = useState('Portugal')
  const [buyerNIF, setBuyerNIF] = useState('')
  const [responseDeadline, setResponseDeadline] = useState('')
  const [depositAmount, setDepositAmount] = useState(0)
  const [conditions, setConditions] = useState<OfferConditions>({
    financing: { enabled: false, bank: '', amount: '', deadline: '' },
    inspection: { enabled: false, deadline: '' },
    subjectToValuation: false, cpcvRequested: true,
    cpcvDate: '', escrituraDate: '', exclusivity: false,
    furnitureIncluded: false, customConditions: '',
  })

  useEffect(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    setResponseDeadline(d.toISOString().split('T')[0])
  }, [])

  const property = PORTAL_PROPERTIES.find(p => p.id === selectedPropertyId)

  const STEPS = [
    { n: 1 as WizardStep, label: 'Dados Básicos' },
    { n: 2 as WizardStep, label: 'Condições' },
    { n: 3 as WizardStep, label: 'Gerar & Enviar' },
  ]

  return (
    <div>
      {/* Wizard stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2rem' }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: step > s.n ? 'pointer' : 'default' }}
              onClick={() => { if (step > s.n) setStep(s.n) }}>
              <IconWizardDot active={step === s.n} done={step > s.n} />
              <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: step === s.n ? '#0e0e0d' : step > s.n ? '#1c4a35' : 'rgba(14,14,13,.4)', fontWeight: step === s.n ? 600 : 400, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > s.n ? '#1c4a35' : 'rgba(14,14,13,.12)', margin: '0 .75rem', minWidth: 20, transition: 'background .3s' }} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Step1
          selectedPropertyId={selectedPropertyId} setSelectedPropertyId={setSelectedPropertyId}
          offerPct={offerPct} setOfferPct={setOfferPct}
          offerAmount={offerAmount} setOfferAmount={setOfferAmount}
          offerType={offerType} setOfferType={setOfferType}
          buyerName={buyerName} setBuyerName={setBuyerName}
          buyerNationality={buyerNationality} setBuyerNationality={setBuyerNationality}
          buyerNIF={buyerNIF} setBuyerNIF={setBuyerNIF}
          responseDeadline={responseDeadline} setResponseDeadline={setResponseDeadline}
          depositAmount={depositAmount} setDepositAmount={setDepositAmount}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2 conditions={conditions} setConditions={setConditions} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <Step3
          property={property} buyerName={buyerName} offerAmount={offerAmount}
          offerType={offerType} conditions={conditions} responseDeadline={responseDeadline}
          depositAmount={depositAmount} onBack={() => setStep(2)}
        />
      )}
    </div>
  )
}

// ─── Tab: Propostas Activas ────────────────────────────────────────────────────

function PropostasActivasTab() {
  const [expandedId, setExpandedId] = useState<string | null>('off-001')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {MOCK_ACTIVE_OFFERS.map(offer => {
        const pct = pctDiff(offer.offerAmount, offer.askingPrice)
        const sc = statusColor(offer.status)
        const isExpanded = expandedId === offer.id
        const days = daysUntil(offer.responseDeadline)

        return (
          <div key={offer.id} className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
              onClick={() => setExpandedId(isExpanded ? null : offer.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.3rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: '#0e0e0d', fontWeight: 600 }}>{offer.propertyName}</span>
                  <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '2px 10px', fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', fontWeight: 600 }}>{offer.status}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)' }}>
                    {NATIONALITY_FLAGS[offer.buyerNationality] ?? '🌍'} {offer.buyerName}
                  </span>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)' }}>
                    Enviada: {new Date(offer.submittedAt).toLocaleDateString('pt-PT')}
                  </span>
                  {days > 0 && days <= 3 && (
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: '#c0392b', fontWeight: 600 }}>
                      Prazo em {days} dia{days > 1 ? 's' : ''}!
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.3rem', color: '#c9a96e', fontWeight: 600 }}>{fmtPreco(offer.offerAmount)}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: pct >= 0 ? '#1c4a35' : '#c0392b' }}>
                  {pct >= 0 ? '+' : ''}{pct}% vs. {fmtPreco(offer.askingPrice)}
                </div>
              </div>
              <div style={{ color: 'rgba(14,14,13,.3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
                <IconArrow dir="right" />
              </div>
            </div>

            {/* Expanded */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid rgba(14,14,13,.07)', padding: '1rem 1.25rem', background: 'rgba(14,14,13,.02)' }}>
                {/* Counter-offer */}
                {offer.status === 'Contra-Proposta' && offer.counterOfferAmount && (
                  <div style={{ padding: '.9rem 1rem', background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.25)', borderRadius: 10, marginBottom: '1rem' }}>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: '#b45309', marginBottom: '.3rem' }}>CONTRA-PROPOSTA DO VENDEDOR</div>
                    <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.4rem', color: '#b45309', fontWeight: 600 }}>{fmtPreco(offer.counterOfferAmount)}</div>
                    {offer.counterOfferNote && (
                      <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', color: 'rgba(14,14,13,.65)', margin: '.4rem 0 0', lineHeight: 1.5 }}>{offer.counterOfferNote}</p>
                    )}
                    <button type="button" className="p-btn-gold" style={{ marginTop: '.75rem', fontSize: '.8rem' }}>Responder à Contra-Proposta</button>
                  </div>
                )}

                {/* Timeline */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.4)', marginBottom: '.6rem', letterSpacing: '.06em' }}>TIMELINE</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                    {offer.timeline.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem' }}>
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%', marginTop: 3,
                            background: ev.status === 'done' ? '#1c4a35' : ev.status === 'active' ? '#c9a96e' : 'rgba(14,14,13,.2)',
                            border: `2px solid ${ev.status === 'done' ? '#1c4a35' : ev.status === 'active' ? '#c9a96e' : 'rgba(14,14,13,.15)'}`,
                          }} />
                          {i < offer.timeline.length - 1 && (
                            <div style={{ width: 1, flex: 1, minHeight: 16, background: ev.status === 'done' ? 'rgba(28,74,53,.25)' : 'rgba(14,14,13,.1)', margin: '2px 0' }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: '.25rem' }}>
                          <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', color: ev.status === 'pending' ? 'rgba(14,14,13,.35)' : '#0e0e0d', fontStyle: ev.status === 'pending' ? 'italic' : 'normal' }}>{ev.label}</div>
                          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.35)' }}>{ev.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {offer.status !== 'Aceite' && offer.status !== 'Recusada' && (
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    <button type="button" className="p-btn-gold" style={{ fontSize: '.8rem' }}>Responder</button>
                    <button type="button" className="p-btn" style={{ fontSize: '.8rem' }}>Actualizar Estado</button>
                    <button type="button" className="p-btn" style={{ fontSize: '.8rem' }}>Enviar Follow-up</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Histórico ────────────────────────────────────────────────────────────

function HistoricoTab() {
  const accepted = MOCK_HISTORICAL.filter(h => h.result === 'Aceite')
  const rejected = MOCK_HISTORICAL.filter(h => h.result === 'Recusada')
  const total = MOCK_HISTORICAL.length
  const winRate = Math.round((accepted.length / total) * 100)
  const avgDiscount = Math.round(MOCK_HISTORICAL.reduce((s, h) => s + Math.abs(pctDiff(h.offerAmount, h.askingPrice)), 0) / total)
  const avgDays = Math.round(MOCK_HISTORICAL.reduce((s, h) => s + h.negotiationDays, 0) / total)

  const best = [...MOCK_HISTORICAL].sort((a, b) => Math.abs(pctDiff(b.offerAmount, b.askingPrice)) - Math.abs(pctDiff(a.offerAmount, a.askingPrice)))[0]
  const worst = [...MOCK_HISTORICAL].filter(h => h.result === 'Recusada').sort((a, b) => pctDiff(a.offerAmount, a.askingPrice) - pctDiff(b.offerAmount, b.askingPrice))[0]

  return (
    <div>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '.75rem', marginBottom: '1.75rem' }}>
        {[
          { label: 'Taxa de Sucesso', value: `${winRate}%`, sub: `${accepted.length} aceites / ${total} total`, color: '#1c4a35' },
          { label: 'Desconto Médio', value: `${avgDiscount}%`, sub: 'Média negociada', color: '#c9a96e' },
          { label: 'Tempo Médio', value: `${avgDays} dias`, sub: 'Do envio ao fecho', color: '#3a7bd5' },
          { label: 'Recusadas', value: rejected.length.toString(), sub: `${Math.round((rejected.length / total) * 100)}% das propostas`, color: '#c0392b' },
        ].map(k => (
          <div key={k.label} className="p-card" style={{ padding: '.9rem 1rem' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.3rem' }}>{k.label.toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.8rem', color: k.color, fontWeight: 600, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.35)', marginTop: '.15rem' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Best & Worst */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1.5rem' }}>
        {best && (
          <div style={{ padding: '.9rem 1rem', background: 'rgba(28,74,53,.06)', borderRadius: 10, border: '1px solid rgba(28,74,53,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.3rem' }}>
              <IconTrophy />
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: '#1c4a35', fontWeight: 600 }}>MELHOR NEGOCIAÇÃO</span>
            </div>
            <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600 }}>{best.propertyName}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)', marginTop: '.15rem' }}>
              {Math.abs(pctDiff(best.offerAmount, best.askingPrice))}% negociado · {fmtPreco(best.offerAmount)}
            </div>
          </div>
        )}
        {worst && (
          <div style={{ padding: '.9rem 1rem', background: 'rgba(192,57,43,.05)', borderRadius: 10, border: '1px solid rgba(192,57,43,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.3rem' }}>
              <IconWarning />
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: '#c0392b', fontWeight: 600 }}>MAIS ABAIXO DE MERCADO</span>
            </div>
            <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600 }}>{worst.propertyName}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.72rem', color: 'rgba(14,14,13,.5)', marginTop: '.15rem' }}>
              {Math.abs(pctDiff(worst.offerAmount, worst.askingPrice))}% abaixo · Recusada
            </div>
          </div>
        )}
      </div>

      {/* History list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
        {MOCK_HISTORICAL.map(h => {
          const pct = pctDiff(h.offerAmount, h.askingPrice)
          const isAccepted = h.result === 'Aceite'
          return (
            <div key={h.id} className="p-card" style={{ padding: '.9rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: isAccepted ? '#1c4a35' : '#c0392b',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-jost)', fontSize: '.85rem', color: '#0e0e0d', fontWeight: 600 }}>{h.propertyName}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.45)', marginTop: '.15rem' }}>
                  {h.buyerName} · {new Date(h.closedAt).toLocaleDateString('pt-PT')} · {h.negotiationDays} dias
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', color: isAccepted ? '#1c4a35' : '#c0392b', fontWeight: 600 }}>{fmtPreco(h.offerAmount)}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', color: 'rgba(14,14,13,.45)' }}>
                  {pct === 0 ? '=' : pct > 0 ? `+${pct}%` : `${pct}%`} vs. pedido
                </div>
              </div>
              <div>
                <span style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: '.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: isAccepted ? 'rgba(28,74,53,.12)' : 'rgba(192,57,43,.1)',
                  color: isAccepted ? '#1c4a35' : '#c0392b',
                  border: `1px solid ${isAccepted ? 'rgba(28,74,53,.3)' : 'rgba(192,57,43,.3)'}`,
                }}>
                  {h.result}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Templates ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
      {OFFER_TEMPLATES.map(t => {
        const isExpanded = expandedId === t.id
        return (
          <div key={t.id}
            style={{
              background: t.color, borderRadius: 12, border: `1.5px solid ${t.textColor}22`,
              overflow: 'hidden', transition: 'box-shadow .2s',
              boxShadow: isExpanded ? `0 8px 24px ${t.textColor}22` : '0 2px 8px rgba(14,14,13,.06)',
            }}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: t.textColor, fontWeight: 700, margin: '0 0 .2rem' }}>{t.name}</h3>
                  <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: 'rgba(14,14,13,.55)', margin: 0 }}>{t.tagline}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.4rem', color: t.textColor, fontWeight: 700, lineHeight: 1 }}>{t.successRate}%</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', color: 'rgba(14,14,13,.4)' }}>taxa sucesso</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.75rem' }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(14,14,13,.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${t.successRate}%`, background: t.textColor, borderRadius: 3, transition: 'width .6s ease' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: t.textColor, fontWeight: 600, flexShrink: 0 }}>
                  {t.discountPct === 0 ? 'A preço' : t.discountPct < 0 ? `+${Math.abs(t.discountPct)}% acima` : `${t.discountPct}% abaixo`}
                </span>
              </div>

              <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.8rem', color: 'rgba(14,14,13,.6)', margin: '0 0 .75rem', lineHeight: 1.5 }}>
                <strong style={{ color: 'rgba(14,14,13,.75)' }}>Quando usar: </strong>{t.whenToUse}
              </p>

              <button type="button" onClick={() => setExpandedId(isExpanded ? null : t.id)}
                className="p-btn" style={{ fontSize: '.78rem', color: t.textColor, borderColor: `${t.textColor}44`, width: '100%' }}>
                {isExpanded ? 'Ocultar Linguagem' : 'Ver Linguagem de Exemplo'}
              </button>
            </div>

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${t.textColor}22`, padding: '1rem 1.25rem', background: 'rgba(14,14,13,.03)' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.68rem', color: 'rgba(14,14,13,.4)', marginBottom: '.3rem', letterSpacing: '.06em' }}>LINGUAGEM SUGERIDA</div>
                <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.82rem', color: '#0e0e0d', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>{t.exampleLanguage}</p>
                <button type="button" className="p-btn-gold" style={{ marginTop: '.75rem', fontSize: '.78rem', width: '100%' }}>
                  Usar Este Template
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

const TABS: { id: DraftTab; label: string; badge?: number }[] = [
  { id: 'nova', label: 'Nova Proposta' },
  { id: 'activas', label: 'Propostas Activas', badge: MOCK_ACTIVE_OFFERS.filter(o => o.status !== 'Aceite' && o.status !== 'Recusada').length },
  { id: 'historico', label: 'Histórico' },
  { id: 'templates', label: 'Templates de Negociação' },
]

export default function PortalDraftOffer() {
  const [tab, setTab] = useState<DraftTab>('nova')

  return (
    <div style={{ padding: '0 0 3rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '2rem', color: '#0e0e0d', fontWeight: 300, margin: '0 0 .25rem' }}>
          Redigir Proposta IA
        </h1>
        <p style={{ fontFamily: 'var(--font-jost)', fontSize: '.9rem', color: 'rgba(14,14,13,.5)', margin: 0 }}>
          Assistente de negociação · Propostas formais · Estratégia de fecho
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '1.75rem', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button type="button" key={t.id} onClick={() => setTab(t.id)}
            style={{
              fontFamily: 'var(--font-jost)', fontSize: '.875rem', padding: '.75rem 1.25rem',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              color: tab === t.id ? '#1c4a35' : 'rgba(14,14,13,.45)',
              borderBottom: tab === t.id ? '2px solid #1c4a35' : '2px solid transparent',
              fontWeight: tab === t.id ? 600 : 400, marginBottom: '-1px',
              display: 'flex', alignItems: 'center', gap: '.4rem',
            }}>
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span style={{ background: '#c9a96e', color: '#fff', borderRadius: 20, padding: '1px 7px', fontFamily: 'var(--font-dm-mono)', fontSize: '.65rem', fontWeight: 700 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'nova' && <NovaPropostaTab />}
      {tab === 'activas' && <PropostasActivasTab />}
      {tab === 'historico' && <HistoricoTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  )
}
