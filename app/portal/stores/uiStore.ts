import { create } from 'zustand'
import type { SectionId } from '../components/types'

// Status written by useLiveData after each bootstrap attempt.
export interface LiveDataStatus {
  isInitialLoad: boolean
  failedEndpoints: string[]   // endpoint keys that failed (network or HTTP error)
  hasPartialFailure: boolean  // ≥1 endpoint failed, ≥1 succeeded
  hasFullFailure: boolean     // ALL endpoints failed
  lastSuccessAt: number | null  // epoch ms of last successful bootstrap
  has401: boolean             // any endpoint returned 401 (session expired)
}

const LIVE_DATA_STATUS_DEFAULT: LiveDataStatus = {
  isInitialLoad: true,
  failedEndpoints: [],
  hasPartialFailure: false,
  hasFullFailure: false,
  lastSuccessAt: null,
  has401: false,
}

interface UIState {
  darkMode: boolean
  sidebarOpen: boolean
  section: SectionId
  showNotifPanel: boolean
  fabOpen: boolean
  cmdkOpen: boolean
  cmdkQuery: string

  // Live data slices
  properties: unknown[]
  signals: unknown[]
  activities: unknown[]
  marketSnapshots: unknown[]

  // Live data bootstrap status (written by useLiveData hook)
  liveDataStatus: LiveDataStatus

  setDarkMode: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  setSection: (s: SectionId) => void
  toggleNotifPanel: () => void
  setShowNotifPanel: (v: boolean) => void
  setFabOpen: (v: boolean) => void
  setCmdkOpen: (v: boolean) => void
  setCmdkQuery: (q: string) => void

  // Live data setters
  setProperties: (v: unknown[]) => void
  setSignals: (v: unknown[]) => void
  setActivities: (v: unknown[]) => void
  setMarketSnapshots: (v: unknown[]) => void
  setLiveDataStatus: (s: LiveDataStatus) => void
}

export const useUIStore = create<UIState>((set) => ({
  darkMode: true,
  sidebarOpen: false,
  section: 'dashboard',
  showNotifPanel: false,
  fabOpen: false,
  cmdkOpen: false,
  cmdkQuery: '',

  properties: [],
  signals: [],
  activities: [],
  marketSnapshots: [],
  liveDataStatus: LIVE_DATA_STATUS_DEFAULT,

  setDarkMode: (v) => set({ darkMode: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSection: (s) => set({ section: s }),
  toggleNotifPanel: () => set((state) => ({ showNotifPanel: !state.showNotifPanel })),
  setShowNotifPanel: (v) => set({ showNotifPanel: v }),
  setFabOpen: (v) => set({ fabOpen: v }),
  setCmdkOpen: (v) => set({ cmdkOpen: v }),
  setCmdkQuery: (q) => set({ cmdkQuery: q }),

  setProperties: (v) => set({ properties: v }),
  setSignals: (v) => set({ signals: v }),
  setActivities: (v) => set({ activities: v }),
  setMarketSnapshots: (v) => set({ marketSnapshots: v }),
  setLiveDataStatus: (s) => set({ liveDataStatus: s }),
}))
