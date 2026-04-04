import { create } from 'zustand'

interface MarketingState {
  mktInput: { zona: string; tipo: string; area: string; preco: string; quartos: string; features: string; descricao: string }
  mktFormat: string
  mktLang: string
  mktLangs: string[]
  mktResult: Record<string, unknown> | null
  mktLoading: boolean
  mktPersona: string
  mktPhotos: string[]
  mktVideoUrl: string
  mktListingUrl: string
  mktTourUrl: string
  mktInputTab: 'dados' | 'media' | 'url' | 'tour'
  mktAutoFilling: boolean
  mktSeoScore: number | null
  mktPhotoInsights: string | null
  mktCalendarOpen: boolean
  mktPostingSchedule: Record<string, { day: string; time: string; reason: string }> | null
  mktCharCounts: Record<string, Record<string, number>> | null
  mktCharLimits: Record<string, number> | null
  isListening: boolean
  copied: boolean
  dragOver: boolean

  // Home Staging
  hsImage: string | null
  hsImageName: string
  hsStyle: string
  hsRoomType: string
  hsVariations: number
  hsStrength: number
  hsLoading: boolean
  hsError: string | null
  hsResults: { base64: string; seed: number }[]
  hsSelected: number
  hsSlider: number
  hsDragOver: boolean

  setMktInput: (input: Partial<MarketingState['mktInput']>) => void
  setMktFormat: (s: string) => void
  setMktLang: (s: string) => void
  setMktLangs: (l: string[]) => void
  setMktResult: (v: Record<string, unknown> | null) => void
  setMktLoading: (v: boolean) => void
  setMktPersona: (s: string) => void
  setMktPhotos: (p: string[]) => void
  setMktVideoUrl: (s: string) => void
  setMktListingUrl: (s: string) => void
  setMktTourUrl: (s: string) => void
  setMktInputTab: (t: MarketingState['mktInputTab']) => void
  setMktAutoFilling: (v: boolean) => void
  setMktSeoScore: (v: number | null) => void
  setMktPhotoInsights: (s: string | null) => void
  setMktCalendarOpen: (v: boolean) => void
  setMktPostingSchedule: (v: MarketingState['mktPostingSchedule']) => void
  setMktCharCounts: (v: MarketingState['mktCharCounts']) => void
  setMktCharLimits: (v: MarketingState['mktCharLimits']) => void
  setIsListening: (v: boolean) => void
  setCopied: (v: boolean) => void
  setDragOver: (v: boolean) => void

  setHsImage: (s: string | null) => void
  setHsImageName: (s: string) => void
  setHsStyle: (s: string) => void
  setHsRoomType: (s: string) => void
  setHsVariations: (n: number) => void
  setHsStrength: (n: number) => void
  setHsLoading: (v: boolean) => void
  setHsError: (s: string | null) => void
  setHsResults: (r: { base64: string; seed: number }[]) => void
  setHsSelected: (n: number) => void
  setHsSlider: (n: number) => void
  setHsDragOver: (v: boolean) => void
}

export const useMarketingStore = create<MarketingState>((set) => ({
  mktInput: { zona: '', tipo: '', area: '', preco: '', quartos: '', features: '', descricao: '' },
  mktFormat: 'idealista',
  mktLang: 'pt',
  mktLangs: ['pt', 'en', 'fr'],
  mktResult: null,
  mktLoading: false,
  mktPersona: 'hnwi',
  mktPhotos: [],
  mktVideoUrl: '',
  mktListingUrl: '',
  mktTourUrl: '',
  mktInputTab: 'dados',
  mktAutoFilling: false,
  mktSeoScore: null,
  mktPhotoInsights: null,
  mktCalendarOpen: false,
  mktPostingSchedule: null,
  mktCharCounts: null,
  mktCharLimits: null,
  isListening: false,
  copied: false,
  dragOver: false,

  hsImage: null,
  hsImageName: '',
  hsStyle: 'moderno',
  hsRoomType: 'sala',
  hsVariations: 1,
  hsStrength: 0.68,
  hsLoading: false,
  hsError: null,
  hsResults: [],
  hsSelected: 0,
  hsSlider: 50,
  hsDragOver: false,

  setMktInput: (input) => set((state) => ({ mktInput: { ...state.mktInput, ...input } })),
  setMktFormat: (s) => set({ mktFormat: s }),
  setMktLang: (s) => set({ mktLang: s }),
  setMktLangs: (l) => set({ mktLangs: l }),
  setMktResult: (v) => set({ mktResult: v }),
  setMktLoading: (v) => set({ mktLoading: v }),
  setMktPersona: (s) => set({ mktPersona: s }),
  setMktPhotos: (p) => set({ mktPhotos: p }),
  setMktVideoUrl: (s) => set({ mktVideoUrl: s }),
  setMktListingUrl: (s) => set({ mktListingUrl: s }),
  setMktTourUrl: (s) => set({ mktTourUrl: s }),
  setMktInputTab: (t) => set({ mktInputTab: t }),
  setMktAutoFilling: (v) => set({ mktAutoFilling: v }),
  setMktSeoScore: (v) => set({ mktSeoScore: v }),
  setMktPhotoInsights: (s) => set({ mktPhotoInsights: s }),
  setMktCalendarOpen: (v) => set({ mktCalendarOpen: v }),
  setMktPostingSchedule: (v) => set({ mktPostingSchedule: v }),
  setMktCharCounts: (v) => set({ mktCharCounts: v }),
  setMktCharLimits: (v) => set({ mktCharLimits: v }),
  setIsListening: (v) => set({ isListening: v }),
  setCopied: (v) => set({ copied: v }),
  setDragOver: (v) => set({ dragOver: v }),

  setHsImage: (s) => set({ hsImage: s }),
  setHsImageName: (s) => set({ hsImageName: s }),
  setHsStyle: (s) => set({ hsStyle: s }),
  setHsRoomType: (s) => set({ hsRoomType: s }),
  setHsVariations: (n) => set({ hsVariations: n }),
  setHsStrength: (n) => set({ hsStrength: n }),
  setHsLoading: (v) => set({ hsLoading: v }),
  setHsError: (s) => set({ hsError: s }),
  setHsResults: (r) => set({ hsResults: r }),
  setHsSelected: (n) => set({ hsSelected: n }),
  setHsSlider: (n) => set({ hsSlider: n }),
  setHsDragOver: (v) => set({ hsDragOver: v }),
}))
