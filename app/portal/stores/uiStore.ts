import { create } from 'zustand'
import type { SectionId } from '../components/types'

interface UIState {
  darkMode: boolean
  sidebarOpen: boolean
  section: SectionId
  showNotifPanel: boolean
  fabOpen: boolean
  cmdkOpen: boolean
  cmdkQuery: string

  setDarkMode: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  setSection: (s: SectionId) => void
  toggleNotifPanel: () => void
  setShowNotifPanel: (v: boolean) => void
  setFabOpen: (v: boolean) => void
  setCmdkOpen: (v: boolean) => void
  setCmdkQuery: (q: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  darkMode: true,
  sidebarOpen: false,
  section: 'dashboard',
  showNotifPanel: false,
  fabOpen: false,
  cmdkOpen: false,
  cmdkQuery: '',

  setDarkMode: (v) => set({ darkMode: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSection: (s) => set({ section: s }),
  toggleNotifPanel: () => set((state) => ({ showNotifPanel: !state.showNotifPanel })),
  setShowNotifPanel: (v) => set({ showNotifPanel: v }),
  setFabOpen: (v) => set({ fabOpen: v }),
  setCmdkOpen: (v) => set({ cmdkOpen: v }),
  setCmdkQuery: (q) => set({ cmdkQuery: q }),
}))
