import { create } from 'zustand'
import type { PortfolioProperty } from '../components/types'

interface PortfolioState {
  portItems: string[]
  portResult: Record<string, unknown> | null
  portLoading: boolean
  portfolioProperties: PortfolioProperty[]
  showPropertyPicker: boolean
  portfolioTab: 'comparar' | 'simulador'

  // Investor Pitch
  ipProperty: string
  ipInvestorType: 'private' | 'family_office' | 'institutional' | 'hnwi'
  ipHorizon: 3 | 5 | 10
  ipIrr: 8 | 12 | 15 | 20
  ipLang: 'PT' | 'EN' | 'FR' | 'AR'
  ipLoading: boolean
  ipResult: Record<string, unknown> | null
  ipError: string | null

  setPortItems: (items: string[]) => void
  setPortResult: (v: Record<string, unknown> | null) => void
  setPortLoading: (v: boolean) => void
  setPortfolioProperties: (p: PortfolioProperty[]) => void
  addPortfolioProperty: (p: PortfolioProperty) => void
  removePortfolioProperty: (id: string) => void
  updatePortfolioProperty: (id: string, updates: Partial<PortfolioProperty>) => void
  setShowPropertyPicker: (v: boolean) => void
  setPortfolioTab: (t: 'comparar' | 'simulador') => void

  setIpProperty: (s: string) => void
  setIpInvestorType: (t: PortfolioState['ipInvestorType']) => void
  setIpHorizon: (n: 3 | 5 | 10) => void
  setIpIrr: (n: 8 | 12 | 15 | 20) => void
  setIpLang: (l: PortfolioState['ipLang']) => void
  setIpLoading: (v: boolean) => void
  setIpResult: (v: Record<string, unknown> | null) => void
  setIpError: (s: string | null) => void
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portItems: ['', ''],
  portResult: null,
  portLoading: false,
  portfolioProperties: [],
  showPropertyPicker: false,
  portfolioTab: 'comparar',

  ipProperty: '',
  ipInvestorType: 'private',
  ipHorizon: 5,
  ipIrr: 12,
  ipLang: 'EN',
  ipLoading: false,
  ipResult: null,
  ipError: null,

  setPortItems: (items) => set({ portItems: items }),
  setPortResult: (v) => set({ portResult: v }),
  setPortLoading: (v) => set({ portLoading: v }),
  setPortfolioProperties: (p) => set({ portfolioProperties: p }),
  addPortfolioProperty: (p) => set((state) => ({ portfolioProperties: [...state.portfolioProperties, p] })),
  removePortfolioProperty: (id) => set((state) => ({ portfolioProperties: state.portfolioProperties.filter(p => p.id !== id) })),
  updatePortfolioProperty: (id, updates) => set((state) => ({
    portfolioProperties: state.portfolioProperties.map(p => p.id === id ? { ...p, ...updates } : p),
  })),
  setShowPropertyPicker: (v) => set({ showPropertyPicker: v }),
  setPortfolioTab: (t) => set({ portfolioTab: t }),

  setIpProperty: (s) => set({ ipProperty: s }),
  setIpInvestorType: (t) => set({ ipInvestorType: t }),
  setIpHorizon: (n) => set({ ipHorizon: n }),
  setIpIrr: (n) => set({ ipIrr: n }),
  setIpLang: (l) => set({ ipLang: l }),
  setIpLoading: (v) => set({ ipLoading: v }),
  setIpResult: (v) => set({ ipResult: v }),
  setIpError: (s) => set({ ipError: s }),
}))
