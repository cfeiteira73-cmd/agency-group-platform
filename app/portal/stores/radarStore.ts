import { create } from 'zustand'

interface RadarState {
  radarResult: Record<string, unknown> | null
  radarLoading: boolean
  radarUrl: string
  radarMode: 'url' | 'search'
  searchZona: string
  searchPrecoMin: string
  searchPrecoMax: string
  searchTipos: string[]
  searchScoreMin: string
  searchFontes: string[]
  searchResults: Record<string, unknown> | null
  searchLoading: boolean
  showHeatMap: boolean

  setRadarResult: (v: Record<string, unknown> | null) => void
  setRadarLoading: (v: boolean) => void
  setRadarUrl: (s: string) => void
  setRadarMode: (m: 'url' | 'search') => void
  setSearchZona: (s: string) => void
  setSearchPrecoMin: (s: string) => void
  setSearchPrecoMax: (s: string) => void
  setSearchTipos: (t: string[]) => void
  setSearchScoreMin: (s: string) => void
  setSearchFontes: (f: string[]) => void
  setSearchResults: (v: Record<string, unknown> | null) => void
  setSearchLoading: (v: boolean) => void
  setShowHeatMap: (v: boolean) => void
}

function getLS(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

function getLSJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : fallback
  } catch {
    return fallback
  }
}

export const useRadarStore = create<RadarState>((set) => ({
  radarResult: null,
  radarLoading: false,
  radarUrl: '',
  radarMode: 'url',
  searchZona: 'Lisboa',
  searchPrecoMin: getLS('radar_precoMin', '50000'),
  searchPrecoMax: getLS('radar_precoMax', '500000000'),
  searchTipos: getLSJson<string[]>('radar_tipos', ['apartamento', 'moradia']),
  searchScoreMin: getLS('radar_scoreMin', '65'),
  searchFontes: getLSJson<string[]>('radar_fontes', ['idealista', 'imovirtual', 'eleiloes', 'banca']),
  searchResults: null,
  searchLoading: false,
  showHeatMap: false,

  setRadarResult: (v) => set({ radarResult: v }),
  setRadarLoading: (v) => set({ radarLoading: v }),
  setRadarUrl: (s) => set({ radarUrl: s }),
  setRadarMode: (m) => set({ radarMode: m }),
  setSearchZona: (s) => set({ searchZona: s }),
  setSearchPrecoMin: (s) => { localStorage.setItem('radar_precoMin', s); set({ searchPrecoMin: s }) },
  setSearchPrecoMax: (s) => { localStorage.setItem('radar_precoMax', s); set({ searchPrecoMax: s }) },
  setSearchTipos: (t) => { localStorage.setItem('radar_tipos', JSON.stringify(t)); set({ searchTipos: t }) },
  setSearchScoreMin: (s) => { localStorage.setItem('radar_scoreMin', s); set({ searchScoreMin: s }) },
  setSearchFontes: (f) => { localStorage.setItem('radar_fontes', JSON.stringify(f)); set({ searchFontes: f }) },
  setSearchResults: (v) => set({ searchResults: v }),
  setSearchLoading: (v) => set({ searchLoading: v }),
  setShowHeatMap: (v) => set({ showHeatMap: v }),
}))
