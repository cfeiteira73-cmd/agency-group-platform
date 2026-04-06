import { create } from 'zustand'
import type { Deal } from '../components/types'
import { CHECKLISTS } from '../components/constants'

interface DealState {
  deals: Deal[]
  activeDeal: number | null
  showNewDeal: boolean
  newDeal: { imovel: string; valor: string }
  pipelineView: 'lista' | 'kanban'
  pipelineSearch: string
  dealTab: 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos'
  dealRiskLoading: boolean
  dealRiskAnalysis: Record<string, unknown> | null
  dealNegoLoading: boolean
  dealNego: Record<string, unknown> | null
  makeOfferOpen: boolean
  offerMsg: string
  dealRoomMsg: string
  investorData: { rendaMensal: string; apreciacao: string; horizonte: string; ltv: string; spread: string }
  invScenario: 'bear' | 'base' | 'bull'
  taxRegime: 'standard' | 'ifici'
  tipoImovelInv: 'residencial' | 'comercial'

  setDeals: (deals: Deal[]) => void
  addDeal: (deal: Deal) => void
  updateDeal: (id: number, updates: Partial<Deal>) => void
  setActiveDeal: (id: number | null) => void
  setShowNewDeal: (v: boolean) => void
  setNewDeal: (d: { imovel: string; valor: string }) => void
  setPipelineView: (v: 'lista' | 'kanban') => void
  setPipelineSearch: (s: string) => void
  setDealTab: (t: 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos') => void
  setDealRiskLoading: (v: boolean) => void
  setDealRiskAnalysis: (v: Record<string, unknown> | null) => void
  setDealNegoLoading: (v: boolean) => void
  setDealNego: (v: Record<string, unknown> | null) => void
  setMakeOfferOpen: (v: boolean) => void
  setOfferMsg: (s: string) => void
  setDealRoomMsg: (s: string) => void
  setInvestorData: (d: Partial<DealState['investorData']>) => void
  setInvScenario: (s: 'bear' | 'base' | 'bull') => void
  setTaxRegime: (r: 'standard' | 'ifici') => void
  setTipoImovelInv: (t: 'residencial' | 'comercial') => void
}

const DEFAULT_DEALS: Deal[] = [
  { id: 1, ref: 'AG-2026-001', imovel: 'Villa Quinta da Marinha · Cascais', valor: '€ 3.800.000', fase: 'CPCV Assinado', comprador: 'James Whitfield', cpcvDate: '2026-04-04', escrituraDate: '2026-05-15', checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k => [k, CHECKLISTS[k].map(() => false)])) },
  { id: 2, ref: 'AG-2026-002', imovel: 'Penthouse Chiado · Lisboa', valor: '€ 2.100.000', fase: 'Due Diligence', comprador: 'Sophie Laurent', cpcvDate: '2026-04-07', escrituraDate: '', checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k => [k, CHECKLISTS[k].map(() => false)])) },
  { id: 3, ref: 'AG-2026-003', imovel: 'Herdade Comporta · Grândola', valor: '€ 6.500.000', fase: 'Proposta Aceite', comprador: 'Khalid Al-Rashid', cpcvDate: '', escrituraDate: '', checklist: Object.fromEntries(Object.keys(CHECKLISTS).map(k => [k, CHECKLISTS[k].map(() => false)])) },
]

export const useDealStore = create<DealState>((set) => ({
  deals: DEFAULT_DEALS,
  activeDeal: null,
  showNewDeal: false,
  newDeal: { imovel: '', valor: '' },
  pipelineView: 'lista',
  pipelineSearch: '',
  dealTab: 'checklist',
  dealRiskLoading: false,
  dealRiskAnalysis: null,
  dealNegoLoading: false,
  dealNego: null,
  makeOfferOpen: false,
  offerMsg: '',
  dealRoomMsg: '',
  investorData: { rendaMensal: '', apreciacao: '4', horizonte: '10', ltv: '70', spread: '1.0' },
  invScenario: 'base',
  taxRegime: 'standard',
  tipoImovelInv: 'residencial',

  setDeals: (deals) => set({ deals }),
  addDeal: (deal) => set((state) => ({ deals: [...state.deals, deal] })),
  updateDeal: (id, updates) => set((state) => ({
    deals: state.deals.map(d => d.id === id ? { ...d, ...updates } : d),
  })),
  setActiveDeal: (id) => set({ activeDeal: id }),
  setShowNewDeal: (v) => set({ showNewDeal: v }),
  setNewDeal: (d) => set({ newDeal: d }),
  setPipelineView: (v) => set({ pipelineView: v }),
  setPipelineSearch: (s) => set({ pipelineSearch: s }),
  setDealTab: (t: 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos') => set({ dealTab: t }),
  setDealRiskLoading: (v) => set({ dealRiskLoading: v }),
  setDealRiskAnalysis: (v) => set({ dealRiskAnalysis: v }),
  setDealNegoLoading: (v) => set({ dealNegoLoading: v }),
  setDealNego: (v) => set({ dealNego: v }),
  setMakeOfferOpen: (v) => set({ makeOfferOpen: v }),
  setOfferMsg: (s) => set({ offerMsg: s }),
  setDealRoomMsg: (s) => set({ dealRoomMsg: s }),
  setInvestorData: (d) => set((state) => ({ investorData: { ...state.investorData, ...d } })),
  setInvScenario: (s) => set({ invScenario: s }),
  setTaxRegime: (r) => set({ taxRegime: r }),
  setTipoImovelInv: (t) => set({ tipoImovelInv: t }),
}))
