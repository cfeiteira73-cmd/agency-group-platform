// ─── Shared Types for Agency Group Portal ────────────────────────────────────

export interface Activity {
  id: number
  type: 'call' | 'whatsapp' | 'email' | 'visit' | 'note' | 'proposal' | 'cpcv'
  date: string
  note: string
  duration?: number
}

export interface Task {
  id: number
  title: string
  dueDate: string
  done: boolean
  type: 'call' | 'visit' | 'email' | 'proposal' | 'other'
}

export interface CRMContact {
  id: number
  name: string
  email: string
  phone: string
  nationality: string
  budgetMin: number
  budgetMax: number
  tipos: string[]
  zonas: string[]
  status: 'lead' | 'prospect' | 'cliente' | 'vip'
  notes: string
  lastContact: string
  nextFollowUp: string
  dealRef: string
  origin: string
  createdAt: string
  language?: 'PT' | 'EN' | 'FR' | 'DE' | 'AR' | 'ZH'
  activities?: Activity[]
  tasks?: Task[]
  notionId?: string
  source?: string
  zone?: string
  type?: string
}

export interface Deal {
  id: number
  ref: string
  imovel: string
  valor: string
  fase: string
  comprador: string
  cpcvDate: string
  escrituraDate: string
  checklist: Record<string, boolean[]>
  notas?: string
  propertyId?: string | null
}

export interface Drip {
  id: string
  name: string
  status: 'active' | 'paused' | 'draft'
  emails: number
  days: number
  openRate: string
}

export interface Visita {
  id: number
  propertyId: string
  propertyName: string
  contactId: number
  contactName: string
  date: string
  time: string
  status: 'agendada' | 'realizada' | 'cancelada'
  notes: string
  interestScore?: number
  feedback?: string
  aiSuggestion?: Record<string, unknown>
}

export interface PortfolioProperty {
  id: string
  name: string
  currentValue: number
  downPayment: number
  rentalYield: number
  appreciation: number
}

export interface JurMsg {
  role: 'user' | 'assistant'
  content: string
  webSearch?: boolean
  ts: string
  mode?: 'memo'
}

export interface AiPhoto {
  url: string
  b64: string
  analysis?: Record<string, unknown>
}

export interface NavItem {
  id: string
  label: string
  icon: string
  group: string
}

export type SectionId =
  | 'dashboard' | 'crm' | 'pipeline' | 'radar' | 'avm'
  | 'marketing' | 'homestaging' | 'investorpitch' | 'sofia'
  | 'juridico' | 'credito' | 'nhr' | 'maisvalias' | 'financiamento'
  | 'portfolio' | 'documentos' | 'imoveis' | 'campanhas'
  | 'agenda' | 'visitas' | 'imt' | 'comissoes' | 'exitSim'
  | 'pulse' | 'crossCompare' | 'voz' | 'collections' | 'draftOffer'
  | 'analytics' | 'investidores' | 'outbound' | 'videoStudio'
  | 'photos' | 'agentai'
  | 'offmarket' | 'partners' | 'dealdesk'
