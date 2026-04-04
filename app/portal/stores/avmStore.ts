import { create } from 'zustand'

interface AVMState {
  avmResult: Record<string, unknown> | null
  avmLoading: boolean
  avmZona: string
  avmTipo: string
  avmArea: string
  avmEstado: string
  avmVista: string
  avmPiscina: string
  avmGaragem: string
  avmEpc: string
  avmAndar: string
  avmOrientacao: string
  avmAnoConstr: string
  avmTerraco: string
  avmCasasBanho: string
  avmUso: string

  setAvmResult: (v: Record<string, unknown> | null) => void
  setAvmLoading: (v: boolean) => void
  setAvmZona: (s: string) => void
  setAvmTipo: (s: string) => void
  setAvmArea: (s: string) => void
  setAvmEstado: (s: string) => void
  setAvmVista: (s: string) => void
  setAvmPiscina: (s: string) => void
  setAvmGaragem: (s: string) => void
  setAvmEpc: (s: string) => void
  setAvmAndar: (s: string) => void
  setAvmOrientacao: (s: string) => void
  setAvmAnoConstr: (s: string) => void
  setAvmTerraco: (s: string) => void
  setAvmCasasBanho: (s: string) => void
  setAvmUso: (s: string) => void
  setAvmField: (field: keyof Omit<AVMState, 'avmResult' | 'avmLoading' | keyof AVMActions>, value: string) => void
}

type AVMActions = {
  setAvmResult: AVMState['setAvmResult']
  setAvmLoading: AVMState['setAvmLoading']
  setAvmZona: AVMState['setAvmZona']
  setAvmTipo: AVMState['setAvmTipo']
  setAvmArea: AVMState['setAvmArea']
  setAvmEstado: AVMState['setAvmEstado']
  setAvmVista: AVMState['setAvmVista']
  setAvmPiscina: AVMState['setAvmPiscina']
  setAvmGaragem: AVMState['setAvmGaragem']
  setAvmEpc: AVMState['setAvmEpc']
  setAvmAndar: AVMState['setAvmAndar']
  setAvmOrientacao: AVMState['setAvmOrientacao']
  setAvmAnoConstr: AVMState['setAvmAnoConstr']
  setAvmTerraco: AVMState['setAvmTerraco']
  setAvmCasasBanho: AVMState['setAvmCasasBanho']
  setAvmUso: AVMState['setAvmUso']
  setAvmField: AVMState['setAvmField']
}

export const useAVMStore = create<AVMState>((set) => ({
  avmResult: null,
  avmLoading: false,
  avmZona: 'Lisboa — Chiado',
  avmTipo: 'T2',
  avmArea: '',
  avmEstado: 'Bom',
  avmVista: 'interior',
  avmPiscina: 'nao',
  avmGaragem: 'sem',
  avmEpc: 'C',
  avmAndar: '1-2',
  avmOrientacao: '',
  avmAnoConstr: '2005',
  avmTerraco: '0',
  avmCasasBanho: '1',
  avmUso: 'habitacao',

  setAvmResult: (v) => set({ avmResult: v }),
  setAvmLoading: (v) => set({ avmLoading: v }),
  setAvmZona: (s) => set({ avmZona: s }),
  setAvmTipo: (s) => set({ avmTipo: s }),
  setAvmArea: (s) => set({ avmArea: s }),
  setAvmEstado: (s) => set({ avmEstado: s }),
  setAvmVista: (s) => set({ avmVista: s }),
  setAvmPiscina: (s) => set({ avmPiscina: s }),
  setAvmGaragem: (s) => set({ avmGaragem: s }),
  setAvmEpc: (s) => set({ avmEpc: s }),
  setAvmAndar: (s) => set({ avmAndar: s }),
  setAvmOrientacao: (s) => set({ avmOrientacao: s }),
  setAvmAnoConstr: (s) => set({ avmAnoConstr: s }),
  setAvmTerraco: (s) => set({ avmTerraco: s }),
  setAvmCasasBanho: (s) => set({ avmCasasBanho: s }),
  setAvmUso: (s) => set({ avmUso: s }),
  setAvmField: (field, value) => set({ [field]: value } as Partial<AVMState>),
}))
