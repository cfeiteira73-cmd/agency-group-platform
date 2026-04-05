import { create } from 'zustand'

interface FinancialState {
  // Mortgage
  mortResult: Record<string, unknown> | null
  mortLoading: boolean
  mortSpreadVal: number
  mortMontante: string
  mortEntrada: number
  mortPrazo: number
  mortUso: 'habitacao_propria' | 'investimento'
  mortRendimento: string
  mortSubTab: 'cenarios' | 'amortizacao' | 'share'

  // NHR
  nhrResult: Record<string, unknown> | null
  nhrLoading: boolean
  nhrPais: string
  nhrTipo: string
  nhrRend: string
  nhrFonte: boolean
  nhrSubTab: 'elegib' | 'processo' | 'share'

  // IMT
  imtValor: string
  imtTipo: 'hpp' | 'second' | 'invest'
  imtComprador: 'singular' | 'empresa'
  imtResult: Record<string, unknown> | null
  imtLoading: boolean

  // Commissions
  commLoading: boolean
  commResult: Record<string, unknown> | null

  // CMA
  cmaLoading: boolean
  cmaResult: Record<string, unknown> | null
  cmaPropertyId: string | null

  // Mortgage setters
  setMortResult: (v: Record<string, unknown> | null) => void
  setMortLoading: (v: boolean) => void
  setMortSpreadVal: (n: number) => void
  setMortMontante: (s: string) => void
  setMortEntrada: (n: number) => void
  setMortPrazo: (n: number) => void
  setMortUso: (u: 'habitacao_propria' | 'investimento') => void
  setMortRendimento: (s: string) => void
  setMortSubTab: (t: 'cenarios' | 'amortizacao' | 'share') => void

  // NHR setters
  setNhrResult: (v: Record<string, unknown> | null) => void
  setNhrLoading: (v: boolean) => void
  setNhrPais: (s: string) => void
  setNhrTipo: (s: string) => void
  setNhrRend: (s: string) => void
  setNhrFonte: (v: boolean) => void
  setNhrSubTab: (t: 'elegib' | 'processo' | 'share') => void

  // IMT setters
  setImtValor: (s: string) => void
  setImtTipo: (t: 'hpp' | 'second' | 'invest') => void
  setImtComprador: (c: 'singular' | 'empresa') => void
  setImtResult: (v: Record<string, unknown> | null) => void
  setImtLoading: (v: boolean) => void

  // Commission setters
  setCommLoading: (v: boolean) => void
  setCommResult: (v: Record<string, unknown> | null) => void

  // CMA setters
  setCmaLoading: (v: boolean) => void
  setCmaResult: (v: Record<string, unknown> | null) => void
  setCmaPropertyId: (id: string | null) => void
}

export const useFinancialStore = create<FinancialState>((set) => ({
  mortResult: null,
  mortLoading: false,
  mortSpreadVal: 1.0,
  mortMontante: '',
  mortEntrada: 20,
  mortPrazo: 30,
  mortUso: 'habitacao_propria',
  mortRendimento: '',
  mortSubTab: 'cenarios',

  nhrResult: null,
  nhrLoading: false,
  nhrPais: 'UK',
  nhrTipo: 'salario',
  nhrRend: '',
  nhrFonte: true,
  nhrSubTab: 'elegib',

  imtValor: '',
  imtTipo: 'hpp',
  imtComprador: 'singular',
  imtResult: null,
  imtLoading: false,

  commLoading: false,
  commResult: null,

  cmaLoading: false,
  cmaResult: null,
  cmaPropertyId: null,

  setMortResult: (v) => set({ mortResult: v }),
  setMortLoading: (v) => set({ mortLoading: v }),
  setMortSpreadVal: (n) => set({ mortSpreadVal: n }),
  setMortMontante: (s) => set({ mortMontante: s }),
  setMortEntrada: (n) => set({ mortEntrada: n }),
  setMortPrazo: (n) => set({ mortPrazo: n }),
  setMortUso: (u) => set({ mortUso: u }),
  setMortRendimento: (s) => set({ mortRendimento: s }),
  setMortSubTab: (t) => set({ mortSubTab: t }),

  setNhrResult: (v) => set({ nhrResult: v }),
  setNhrLoading: (v) => set({ nhrLoading: v }),
  setNhrPais: (s) => set({ nhrPais: s }),
  setNhrTipo: (s) => set({ nhrTipo: s }),
  setNhrRend: (s) => set({ nhrRend: s }),
  setNhrFonte: (v) => set({ nhrFonte: v }),
  setNhrSubTab: (t) => set({ nhrSubTab: t }),

  setImtValor: (s) => set({ imtValor: s }),
  setImtTipo: (t) => set({ imtTipo: t }),
  setImtComprador: (c) => set({ imtComprador: c }),
  setImtResult: (v) => set({ imtResult: v }),
  setImtLoading: (v) => set({ imtLoading: v }),

  setCommLoading: (v) => set({ commLoading: v }),
  setCommResult: (v) => set({ commResult: v }),

  setCmaLoading: (v) => set({ cmaLoading: v }),
  setCmaResult: (v) => set({ cmaResult: v }),
  setCmaPropertyId: (id) => set({ cmaPropertyId: id }),
}))
