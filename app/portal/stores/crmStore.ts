import { create } from 'zustand'
import type { CRMContact, Activity, Task, Drip, Visita } from '../components/types'

interface CRMState {
  crmContacts: CRMContact[]
  crmSearch: string
  activeCrmId: number | null
  crmProfileTab: 'overview' | 'timeline' | 'tasks' | 'notes' | 'matching' | 'postclosing'
  crmBulkMode: boolean
  crmSelectedIds: Set<number>
  crmView: 'list' | 'kanban'
  crmShowFilters: boolean
  crmNatFilter: string
  crmZonaFilter: string
  crmStatusFilter: string
  showNewContact: boolean
  showWaModal: boolean
  waModalContact: number | null
  waLang: 'PT' | 'EN' | 'FR' | 'DE' | 'AR'
  showAddActivity: boolean
  newActivity: { type: Activity['type']; note: string; date: string }
  showAddTask: boolean
  newTask: { title: string; dueDate: string; type: Task['type'] }
  voiceActive: boolean
  voiceText: string
  smartImportText: string
  smartImportLoading: boolean
  showSmartImport: boolean
  newContact: {
    name: string; email: string; phone: string; nationality: string
    budgetMin: string; budgetMax: string; tipos: string; zonas: string
    origin: string; notes: string
  }
  crmNextStep: Record<string, unknown> | null
  crmNextStepLoading: boolean
  dripCampaigns: Drip[]
  expandedDrip: string | null
  campTab: 'email' | 'whatsapp'
  emailDraftLoading: boolean
  emailDraft: Record<string, string> | null
  emailDraftPurpose: string
  visitas: Visita[]
  visitasTab: 'lista' | 'agenda' | 'stats'
  showNewVisita: boolean
  newVisita: { propertyId: string; propertyName: string; contactId: number; contactName: string; date: string; time: string; notes: string }
  visitaFeedbackId: number | null
  visitaFeedback: { interesse: number; observacoes: string; nextStep: string }
  visitaAiLoading: boolean
  visitaAiResult: Record<string, unknown> | null
  meetingPrepLoading: boolean
  meetingPrep: Record<string, unknown> | null

  setCrmContacts: (contacts: CRMContact[]) => void
  addContact: (contact: CRMContact) => void
  updateContact: (id: number, updates: Partial<CRMContact>) => void
  setCrmSearch: (s: string) => void
  setActiveCrmId: (id: number | null) => void
  setCrmProfileTab: (t: CRMState['crmProfileTab']) => void
  setCrmBulkMode: (v: boolean) => void
  setCrmSelectedIds: (ids: Set<number>) => void
  setCrmView: (v: 'list' | 'kanban') => void
  setCrmShowFilters: (v: boolean) => void
  setCrmNatFilter: (s: string) => void
  setCrmZonaFilter: (s: string) => void
  setCrmStatusFilter: (s: string) => void
  setShowNewContact: (v: boolean) => void
  setShowWaModal: (v: boolean) => void
  setWaModalContact: (id: number | null) => void
  setWaLang: (l: CRMState['waLang']) => void
  setShowAddActivity: (v: boolean) => void
  setNewActivity: (a: Partial<CRMState['newActivity']>) => void
  setShowAddTask: (v: boolean) => void
  setNewTask: (t: Partial<CRMState['newTask']>) => void
  setVoiceActive: (v: boolean) => void
  setVoiceText: (s: string) => void
  setSmartImportText: (s: string) => void
  setSmartImportLoading: (v: boolean) => void
  setShowSmartImport: (v: boolean) => void
  setNewContact: (c: Partial<CRMState['newContact']>) => void
  setCrmNextStep: (v: Record<string, unknown> | null) => void
  setCrmNextStepLoading: (v: boolean) => void
  setDripCampaigns: (d: Drip[]) => void
  setExpandedDrip: (id: string | null) => void
  setCampTab: (t: 'email' | 'whatsapp') => void
  setEmailDraftLoading: (v: boolean) => void
  setEmailDraft: (d: Record<string, string> | null) => void
  setEmailDraftPurpose: (s: string) => void
  setVisitas: (v: Visita[]) => void
  setVisitasTab: (t: 'lista' | 'agenda' | 'stats') => void
  setShowNewVisita: (v: boolean) => void
  setNewVisita: (v: Partial<CRMState['newVisita']>) => void
  setVisitaFeedbackId: (id: number | null) => void
  setVisitaFeedback: (f: Partial<CRMState['visitaFeedback']>) => void
  setVisitaAiLoading: (v: boolean) => void
  setVisitaAiResult: (v: Record<string, unknown> | null) => void
  setMeetingPrepLoading: (v: boolean) => void
  setMeetingPrep: (v: Record<string, unknown> | null) => void
}

// No default contacts or visits — always start empty so no fake data ever shows.
// Real data is loaded from Supabase by useLiveData on portal mount.

export const useCRMStore = create<CRMState>((set) => ({
  crmContacts: [],
  crmSearch: '',
  activeCrmId: null,
  crmProfileTab: 'overview',
  crmBulkMode: false,
  crmSelectedIds: new Set(),
  crmView: 'list',
  crmShowFilters: false,
  crmNatFilter: '',
  crmZonaFilter: '',
  crmStatusFilter: '',
  showNewContact: false,
  showWaModal: false,
  waModalContact: null,
  waLang: 'PT',
  showAddActivity: false,
  newActivity: { type: 'call', note: '', date: new Date().toISOString().split('T')[0] },
  showAddTask: false,
  newTask: { title: '', dueDate: '', type: 'call' },
  voiceActive: false,
  voiceText: '',
  smartImportText: '',
  smartImportLoading: false,
  showSmartImport: false,
  newContact: { name: '', email: '', phone: '', nationality: '', budgetMin: '', budgetMax: '', tipos: '', zonas: '', origin: 'Website', notes: '' },
  crmNextStep: null,
  crmNextStepLoading: false,
  dripCampaigns: [
    { id: 'd1', name: 'Boas-Vindas Novo Lead', status: 'active', emails: 5, days: 14, openRate: '42%' },
    { id: 'd2', name: 'Follow-Up Imóvel', status: 'paused', emails: 4, days: 10, openRate: '38%' },
    { id: 'd3', name: 'Reactivação Lead Frio', status: 'draft', emails: 3, days: 21, openRate: '29%' },
  ],
  expandedDrip: null,
  campTab: 'email',
  emailDraftLoading: false,
  emailDraft: null,
  emailDraftPurpose: 'Follow-up geral',
  visitas: [],
  visitasTab: 'lista',
  showNewVisita: false,
  newVisita: { propertyId: '', propertyName: '', contactId: 0, contactName: '', date: '', time: '10:00', notes: '' },
  visitaFeedbackId: null,
  visitaFeedback: { interesse: 3, observacoes: '', nextStep: '' },
  visitaAiLoading: false,
  visitaAiResult: null,
  meetingPrepLoading: false,
  meetingPrep: null,

  setCrmContacts: (contacts) => set({ crmContacts: contacts }),
  addContact: (contact) => set((state) => ({ crmContacts: [...state.crmContacts, contact] })),
  updateContact: (id, updates) => set((state) => ({
    crmContacts: state.crmContacts.map(c => c.id === id ? { ...c, ...updates } : c),
  })),
  setCrmSearch: (s) => set({ crmSearch: s }),
  setActiveCrmId: (id) => set({ activeCrmId: id }),
  setCrmProfileTab: (t) => set({ crmProfileTab: t }),
  setCrmBulkMode: (v) => set({ crmBulkMode: v }),
  setCrmSelectedIds: (ids) => set({ crmSelectedIds: ids }),
  setCrmView: (v) => set({ crmView: v }),
  setCrmShowFilters: (v) => set({ crmShowFilters: v }),
  setCrmNatFilter: (s) => set({ crmNatFilter: s }),
  setCrmZonaFilter: (s) => set({ crmZonaFilter: s }),
  setCrmStatusFilter: (s) => set({ crmStatusFilter: s }),
  setShowNewContact: (v) => set({ showNewContact: v }),
  setShowWaModal: (v) => set({ showWaModal: v }),
  setWaModalContact: (id) => set({ waModalContact: id }),
  setWaLang: (l) => set({ waLang: l }),
  setShowAddActivity: (v) => set({ showAddActivity: v }),
  setNewActivity: (a) => set((state) => ({ newActivity: { ...state.newActivity, ...a } })),
  setShowAddTask: (v) => set({ showAddTask: v }),
  setNewTask: (t) => set((state) => ({ newTask: { ...state.newTask, ...t } })),
  setVoiceActive: (v) => set({ voiceActive: v }),
  setVoiceText: (s) => set({ voiceText: s }),
  setSmartImportText: (s) => set({ smartImportText: s }),
  setSmartImportLoading: (v) => set({ smartImportLoading: v }),
  setShowSmartImport: (v) => set({ showSmartImport: v }),
  setNewContact: (c) => set((state) => ({ newContact: { ...state.newContact, ...c } })),
  setCrmNextStep: (v) => set({ crmNextStep: v }),
  setCrmNextStepLoading: (v) => set({ crmNextStepLoading: v }),
  setDripCampaigns: (d) => set({ dripCampaigns: d }),
  setExpandedDrip: (id) => set({ expandedDrip: id }),
  setCampTab: (t) => set({ campTab: t }),
  setEmailDraftLoading: (v) => set({ emailDraftLoading: v }),
  setEmailDraft: (d) => set({ emailDraft: d }),
  setEmailDraftPurpose: (s) => set({ emailDraftPurpose: s }),
  setVisitas: (v) => set({ visitas: v }),
  setVisitasTab: (t) => set({ visitasTab: t }),
  setShowNewVisita: (v) => set({ showNewVisita: v }),
  setNewVisita: (v) => set((state) => ({ newVisita: { ...state.newVisita, ...v } })),
  setVisitaFeedbackId: (id) => set({ visitaFeedbackId: id }),
  setVisitaFeedback: (f) => set((state) => ({ visitaFeedback: { ...state.visitaFeedback, ...f } })),
  setVisitaAiLoading: (v) => set({ visitaAiLoading: v }),
  setVisitaAiResult: (v) => set({ visitaAiResult: v }),
  setMeetingPrepLoading: (v) => set({ meetingPrepLoading: v }),
  setMeetingPrep: (v) => set({ meetingPrep: v }),
}))
