'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCRMStore } from '../stores/crmStore'
import { useUIStore } from '../stores/uiStore'
import type { CRMContact, Activity } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedData {
  contactName?: string
  phone?: string
  email?: string
  budget?: { min: number; max: number }
  zonas?: string[]
  tipos?: string[]
  actionItems?: string[]
  followUpDate?: string
  summary?: string
  sentiment?: 'positivo' | 'neutro' | 'negativo'
  urgency?: 'alta' | 'media' | 'baixa'
}

interface VoiceNote {
  id: number
  date: string
  duration: number
  transcript: string
  type: string
  contactName?: string
  saved: boolean
  extracted?: ExtractedData
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'agora mesmo'
  if (mins < 60) return `há ${mins}m`
  if (hours < 24) return `há ${hours}h`
  return `há ${days}d`
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  chamada: 'Chamada',
  reuniao: 'Reunião',
  visita: 'Visita',
  negociacao: 'Negociação',
}

const SENTIMENT_COLORS: Record<string, string> = {
  positivo: '#1c4a35',
  neutro: '#8a8a88',
  negativo: '#e05454',
}

const URGENCY_BG: Record<string, string> = {
  alta: '#e05454',
  media: '#c9a96e',
  baixa: '#1c4a35',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalVoz() {
  const { crmContacts, setCrmContacts, updateContact, setSection, setActiveCrmId, setNewContact, setShowNewContact } = useCRMStore()
  const { section } = useUIStore()

  // Recording state
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [processing, setProcessing] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentNotes, setRecentNotes] = useState<VoiceNote[]>([])
  const [selectedContact, setSelectedContact] = useState<number | null>(null)
  const [noteType, setNoteType] = useState<'reuniao' | 'chamada' | 'visita' | 'negociacao'>('chamada')
  const [lang, setLang] = useState<'pt-PT' | 'en-US' | 'fr-FR'>('pt-PT')
  const [contactSearch, setContactSearch] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [viewingNote, setViewingNote] = useState<VoiceNote | null>(null)
  const [copied, setCopied] = useState(false)

  const recognitionRef = useRef<unknown>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Load recent notes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ag_voice_notes')
      if (stored) setRecentNotes(JSON.parse(stored))
    } catch {}
  }, [])

  // Persist recent notes
  useEffect(() => {
    if (recentNotes.length > 0) {
      try {
        localStorage.setItem('ag_voice_notes', JSON.stringify(recentNotes.slice(0, 10)))
      } catch {}
    }
  }, [recentNotes])

  // Timer during recording
  useEffect(() => {
    if (recording) {
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recording])

  // ── Recording logic ────────────────────────────────────────────────────────

  function startRecording() {
    setError(null)
    setTranscript('')
    setInterimTranscript('')
    setExtracted(null)
    setSaved(false)
    setSelectedContact(null)
    setRecordingSeconds(0)

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('O teu browser não suporta reconhecimento de voz. Usa Chrome ou Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (e: any) => {
      let final = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (final) setTranscript(prev => prev + final)
      setInterimTranscript(interim)
    }

    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setError('Permissão de microfone negada. Permite acesso ao microfone nas definições do browser.')
      } else if (e.error === 'no-speech') {
        // Non-fatal, just means silence
      } else {
        setError(`Erro de gravação: ${e.error}`)
      }
    }

    recognition.onend = () => {
      setRecording(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  function stopRecording() {
    ;(recognitionRef.current as any)?.stop()
    setRecording(false)
    setInterimTranscript('')
  }

  // ── AI Extraction ──────────────────────────────────────────────────────────

  async function extractData() {
    if (!transcript.trim()) {
      setError('Nenhuma transcrição para analisar.')
      return
    }
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/crm/extract-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, type: noteType }),
      })
      if (!res.ok) throw new Error('Erro ao extrair dados')
      const data = await res.json()
      setExtracted(data)
      // Pre-fill contact search if name found
      if (data.contactName) setContactSearch(data.contactName)
    } catch (err: any) {
      // Fallback: show empty extraction card so user can still save manually
      setExtracted({
        summary: transcript.slice(0, 200),
        sentiment: 'neutro',
        urgency: 'media',
        actionItems: [],
      })
      setError('Extracção IA indisponível — dados guardados manualmente.')
    } finally {
      setProcessing(false)
    }
  }

  // Auto-extract when recording stops and there's text
  useEffect(() => {
    if (!recording && transcript.trim().length > 20 && !extracted && !processing) {
      extractData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  // ── Save to CRM ────────────────────────────────────────────────────────────

  function saveToContact(contactId: number) {
    const duration = recordingSeconds
    const activity: Activity = {
      id: Date.now(),
      type:
        noteType === 'chamada' ? 'call'
        : noteType === 'visita' ? 'visit'
        : noteType === 'reuniao' ? 'note'
        : 'note',
      date: new Date().toISOString().split('T')[0],
      note: transcript,
      duration,
    }

    const contact = crmContacts.find(c => c.id === contactId)
    if (!contact) return

    const updated: CRMContact = {
      ...contact,
      activities: [activity, ...(contact.activities || [])],
      lastContact: activity.date,
    }
    updateContact(contactId, updated)

    const note: VoiceNote = {
      id: Date.now(),
      date: new Date().toISOString(),
      duration,
      transcript,
      type: noteType,
      contactName: contact.name,
      saved: true,
      extracted: extracted || undefined,
    }
    setRecentNotes(prev => [note, ...prev].slice(0, 10))
    setSaved(true)
  }

  function saveAsUnsaved() {
    const note: VoiceNote = {
      id: Date.now(),
      date: new Date().toISOString(),
      duration: recordingSeconds,
      transcript,
      type: noteType,
      saved: false,
      extracted: extracted || undefined,
    }
    setRecentNotes(prev => [note, ...prev].slice(0, 10))
    setSaved(true)
  }

  function createNewContact() {
    if (!extracted) return
    setNewContact({
      name: extracted.contactName || '',
      phone: extracted.phone || '',
      email: extracted.email || '',
      budgetMin: extracted.budget ? String(extracted.budget.min) : '',
      budgetMax: extracted.budget ? String(extracted.budget.max) : '',
      zonas: extracted.zonas?.join(', ') || '',
      tipos: extracted.tipos?.join(', ') || '',
      notes: extracted.summary || transcript.slice(0, 300),
    })
    setShowNewContact(true)
    ;(useUIStore.getState() as any).setSection?.('crm')
  }

  function copyTranscript() {
    navigator.clipboard.writeText(transcript).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function resetAll() {
    setTranscript('')
    setInterimTranscript('')
    setExtracted(null)
    setSaved(false)
    setError(null)
    setSelectedContact(null)
    setContactSearch('')
    setRecordingSeconds(0)
    setViewingNote(null)
  }

  // ── Filtered contacts for search ───────────────────────────────────────────

  const filteredContacts = crmContacts.filter(c =>
    contactSearch.length < 1 || c.name.toLowerCase().includes(contactSearch.toLowerCase())
  )

  // ─── Styles ───────────────────────────────────────────────────────────────

  const BG = '#f4f0e6'
  const GREEN = '#1c4a35'
  const GOLD = '#c9a96e'
  const TEXT = '#0e0e0d'
  const RED = '#e05454'
  const MUTED = '#8a8a88'
  const CARD_BG = '#ffffff'
  const BORDER = 'rgba(14,14,13,0.08)'

  const s = {
    wrap: {
      background: BG,
      minHeight: '100vh',
      padding: '0',
      fontFamily: "'Jost', sans-serif",
      color: TEXT,
    } as React.CSSProperties,

    inner: {
      maxWidth: 860,
      margin: '0 auto',
      padding: '32px 24px 80px',
    } as React.CSSProperties,

    header: {
      marginBottom: 32,
    } as React.CSSProperties,

    h1: {
      fontFamily: "'Cormorant', serif",
      fontSize: 38,
      fontWeight: 600,
      color: TEXT,
      margin: 0,
      lineHeight: 1.1,
    } as React.CSSProperties,

    subtitle: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 12,
      color: MUTED,
      marginTop: 6,
      letterSpacing: '0.04em',
    } as React.CSSProperties,

    card: {
      background: CARD_BG,
      borderRadius: 16,
      border: `1px solid ${BORDER}`,
      padding: '28px 28px',
      marginBottom: 20,
    } as React.CSSProperties,

    sectionTitle: {
      fontFamily: "'Cormorant', serif",
      fontSize: 18,
      fontWeight: 600,
      color: TEXT,
      marginBottom: 16,
      marginTop: 0,
    } as React.CSSProperties,

    // Lang pills
    langRow: {
      display: 'flex',
      gap: 8,
      marginBottom: 16,
    } as React.CSSProperties,

    langPill: (active: boolean) => ({
      padding: '6px 16px',
      borderRadius: 999,
      border: `1.5px solid ${active ? GREEN : BORDER}`,
      background: active ? GREEN : 'transparent',
      color: active ? '#fff' : MUTED,
      fontFamily: "'DM Mono', monospace",
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      letterSpacing: '0.06em',
      transition: 'all 0.15s',
    } as React.CSSProperties),

    // Note type tabs
    typeRow: {
      display: 'flex',
      gap: 8,
      marginBottom: 28,
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,

    typeTab: (active: boolean) => ({
      padding: '7px 18px',
      borderRadius: 8,
      border: `1.5px solid ${active ? GOLD : BORDER}`,
      background: active ? GOLD : 'transparent',
      color: active ? '#fff' : TEXT,
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      transition: 'all 0.15s',
    } as React.CSSProperties),

    // Mic button area
    micCenter: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 20,
      marginBottom: 28,
    } as React.CSSProperties,

    micWrap: {
      position: 'relative' as const,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,

    micBtn: (isRec: boolean) => ({
      width: 120,
      height: 120,
      borderRadius: '50%',
      border: 'none',
      background: isRec ? RED : GREEN,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isRec
        ? `0 0 0 0 ${RED}80`
        : `0 8px 32px ${GREEN}40`,
      transition: 'all 0.2s',
      zIndex: 2,
      position: 'relative' as const,
      animation: isRec ? 'micPulse 1.4s ease-in-out infinite' : 'none',
    } as React.CSSProperties),

    micLabel: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 11,
      color: MUTED,
      letterSpacing: '0.08em',
      textAlign: 'center' as const,
    } as React.CSSProperties,

    timerBadge: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 22,
      fontWeight: 700,
      color: RED,
      letterSpacing: '0.04em',
    } as React.CSSProperties,

    // Sound waves
    wavesRow: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 5,
      height: 28,
    } as React.CSSProperties,

    waveBar: (i: number) => ({
      width: 4,
      borderRadius: 2,
      background: RED,
      animationName: `wave${i + 1}`,
      animationDuration: `${0.5 + i * 0.15}s`,
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      animationDirection: 'alternate',
    } as React.CSSProperties),

    // Transcript
    transcriptBox: {
      background: '#faf8f2',
      borderRadius: 12,
      border: `1px solid ${BORDER}`,
      padding: '18px 20px',
      minHeight: 100,
      position: 'relative' as const,
    } as React.CSSProperties,

    transcriptText: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 13.5,
      color: TEXT,
      lineHeight: 1.7,
      margin: 0,
      whiteSpace: 'pre-wrap' as const,
    } as React.CSSProperties,

    interimText: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 13.5,
      color: MUTED,
      fontStyle: 'italic',
    } as React.CSSProperties,

    charCount: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      color: MUTED,
      textAlign: 'right' as const,
      marginTop: 8,
    } as React.CSSProperties,

    transcriptPlaceholder: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 12,
      color: MUTED,
      textAlign: 'center' as const,
      padding: '20px 0',
    } as React.CSSProperties,

    // Processing
    processingRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '16px 0 8px',
    } as React.CSSProperties,

    spinnerWrap: {
      width: 18,
      height: 18,
      flexShrink: 0,
    } as React.CSSProperties,

    processingText: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 12,
      color: GOLD,
      letterSpacing: '0.04em',
    } as React.CSSProperties,

    // Extracted card
    extractGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 12,
      marginBottom: 16,
    } as React.CSSProperties,

    extractItem: {
      background: '#faf8f2',
      borderRadius: 10,
      padding: '12px 14px',
      border: `1px solid ${BORDER}`,
    } as React.CSSProperties,

    extractLabel: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 9,
      color: MUTED,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 4,
    } as React.CSSProperties,

    extractValue: {
      fontFamily: "'Jost', sans-serif",
      fontSize: 14,
      color: TEXT,
      fontWeight: 500,
    } as React.CSSProperties,

    pill: (bg: string) => ({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 999,
      background: bg,
      color: '#fff',
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    } as React.CSSProperties),

    actionList: {
      margin: 0,
      paddingLeft: 18,
    } as React.CSSProperties,

    actionItem: {
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      color: TEXT,
      marginBottom: 4,
      lineHeight: 1.5,
    } as React.CSSProperties,

    summaryText: {
      fontFamily: "'Jost', sans-serif",
      fontSize: 14,
      color: TEXT,
      lineHeight: 1.6,
      background: '#faf8f2',
      borderRadius: 10,
      padding: '12px 14px',
      border: `1px solid ${BORDER}`,
      marginBottom: 16,
    } as React.CSSProperties,

    divider: {
      border: 'none',
      borderTop: `1px solid ${BORDER}`,
      margin: '16px 0',
    } as React.CSSProperties,

    // Save actions
    saveRow: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap' as const,
      marginTop: 16,
    } as React.CSSProperties,

    btnGreen: {
      padding: '10px 22px',
      borderRadius: 8,
      border: 'none',
      background: GREEN,
      color: '#fff',
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.15s',
    } as React.CSSProperties,

    btnGold: {
      padding: '10px 22px',
      borderRadius: 8,
      border: `1.5px solid ${GOLD}`,
      background: 'transparent',
      color: GOLD,
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.15s',
    } as React.CSSProperties,

    btnGhost: {
      padding: '10px 22px',
      borderRadius: 8,
      border: `1.5px solid ${BORDER}`,
      background: 'transparent',
      color: MUTED,
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'opacity 0.15s',
    } as React.CSSProperties,

    inp: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: 8,
      border: `1px solid ${BORDER}`,
      background: '#faf8f2',
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      color: TEXT,
      outline: 'none',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    sel: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: 8,
      border: `1px solid ${BORDER}`,
      background: '#faf8f2',
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      color: TEXT,
      outline: 'none',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    label: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      color: MUTED,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      display: 'block',
      marginBottom: 6,
    } as React.CSSProperties,

    savedBanner: {
      background: `${GREEN}15`,
      border: `1px solid ${GREEN}30`,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: "'Jost', sans-serif",
      fontSize: 14,
      color: GREEN,
      fontWeight: 500,
    } as React.CSSProperties,

    errorBanner: {
      background: `${RED}10`,
      border: `1px solid ${RED}30`,
      borderRadius: 10,
      padding: '12px 16px',
      fontFamily: "'Jost', sans-serif",
      fontSize: 13,
      color: RED,
      marginBottom: 16,
    } as React.CSSProperties,

    // Recent notes
    noteRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      padding: '14px 0',
      borderBottom: `1px solid ${BORDER}`,
      cursor: 'pointer',
      transition: 'background 0.1s',
    } as React.CSSProperties,

    noteIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: `${GREEN}12`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: 17,
    } as React.CSSProperties,

    noteTitle: {
      fontFamily: "'Jost', sans-serif",
      fontSize: 14,
      fontWeight: 600,
      color: TEXT,
      margin: '0 0 3px',
    } as React.CSSProperties,

    noteMeta: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      color: MUTED,
      letterSpacing: '0.04em',
    } as React.CSSProperties,

    noteExcerpt: {
      fontFamily: "'Jost', sans-serif",
      fontSize: 12,
      color: MUTED,
      marginTop: 4,
      lineHeight: 1.4,
    } as React.CSSProperties,

    // Modal overlay
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(14,14,13,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    } as React.CSSProperties,

    modal: {
      background: CARD_BG,
      borderRadius: 18,
      padding: '28px 28px',
      maxWidth: 600,
      width: '100%',
      maxHeight: '80vh',
      overflowY: 'auto' as const,
      boxShadow: '0 24px 80px rgba(14,14,13,0.2)',
    } as React.CSSProperties,
  }

  const noteTypeIcon: Record<string, string> = {
    chamada: '📞',
    reuniao: '🤝',
    visita: '🏠',
    negociacao: '⚖️',
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasTranscript = transcript.trim().length > 0
  const canRecord = !recording && !processing

  return (
    <div style={s.wrap}>
      {/* CSS Animations */}
      <style>{`
        @keyframes micPulse {
          0% { box-shadow: 0 0 0 0 rgba(224,84,84,0.5); }
          70% { box-shadow: 0 0 0 22px rgba(224,84,84,0); }
          100% { box-shadow: 0 0 0 0 rgba(224,84,84,0); }
        }
        @keyframes wave1 {
          from { height: 6px; }
          to   { height: 22px; }
        }
        @keyframes wave2 {
          from { height: 10px; }
          to   { height: 28px; }
        }
        @keyframes wave3 {
          from { height: 4px; }
          to   { height: 18px; }
        }
        @keyframes wave4 {
          from { height: 14px; }
          to   { height: 26px; }
        }
        @keyframes wave5 {
          from { height: 8px; }
          to   { height: 20px; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .voz-note-row:hover {
          background: rgba(201,169,110,0.05) !important;
        }
      `}</style>

      <div style={s.inner}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={s.header}>
          <h1 style={s.h1}>
            Nota de Voz <em style={{ color: GOLD, fontStyle: 'normal' }}>→ CRM</em>
          </h1>
          <p style={s.subtitle}>Fala · IA extrai · Guarda no CRM</p>
        </div>

        {/* ── Error Banner ────────────────────────────────────────────── */}
        {error && (
          <div style={s.errorBanner}>
            <strong>Atenção:</strong> {error}
          </div>
        )}

        {/* ── Main Recording Card ─────────────────────────────────────── */}
        <div style={s.card}>
          {/* Lang selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={s.langRow}>
              {(['pt-PT', 'en-US', 'fr-FR'] as const).map(l => (
                <button
                  key={l}
                  style={s.langPill(lang === l)}
                  onClick={() => setLang(l)}
                  disabled={recording}
                >
                  {l === 'pt-PT' ? 'PT' : l === 'en-US' ? 'EN' : 'FR'}
                </button>
              ))}
            </div>
            {hasTranscript && !recording && (
              <button style={s.btnGhost} onClick={resetAll}>
                Nova gravação
              </button>
            )}
          </div>

          {/* Note type tabs */}
          <div style={s.typeRow}>
            {(['chamada', 'reuniao', 'visita', 'negociacao'] as const).map(t => (
              <button
                key={t}
                style={s.typeTab(noteType === t)}
                onClick={() => setNoteType(t)}
                disabled={recording}
              >
                {noteTypeIcon[t]} {NOTE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Microphone button */}
          <div style={s.micCenter}>
            <div style={s.micWrap}>
              <button
                style={s.micBtn(recording)}
                onClick={recording ? stopRecording : startRecording}
                aria-label={recording ? 'Parar gravação' : 'Começar a gravar'}
              >
                {recording ? (
                  // Stop icon
                  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <rect x="9" y="9" width="16" height="16" rx="3" fill="white" />
                  </svg>
                ) : (
                  // Mic icon
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <rect x="14" y="6" width="10" height="16" rx="5" fill="white" />
                    <path d="M9 19c0 5.523 4.477 10 10 10s10-4.477 10-10" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="19" y1="29" x2="19" y2="34" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="14" y1="34" x2="24" y2="34" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>

            {/* Timer or label */}
            {recording ? (
              <div style={{ textAlign: 'center' }}>
                <div style={s.timerBadge}>{formatDuration(recordingSeconds)}</div>
                {/* Sound waves */}
                <div style={{ ...s.wavesRow, margin: '10px auto 0', justifyContent: 'center' }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      style={{
                        ...s.waveBar(i),
                        height: 6 + i * 4,
                        animation: `wave${i + 1} ${0.4 + i * 0.12}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p style={s.micLabel}>
                {hasTranscript ? 'Gravação concluída' : 'Começar a Gravar'}
              </p>
            )}
          </div>

          {/* Transcript area */}
          <div style={s.transcriptBox}>
            {!hasTranscript && !interimTranscript && !recording ? (
              <p style={s.transcriptPlaceholder}>
                Clica no microfone e começa a falar...<br />
                <span style={{ fontSize: 10, opacity: 0.6 }}>A transcrição aparece aqui em tempo real</span>
              </p>
            ) : (
              <>
                <p style={s.transcriptText}>
                  {transcript}
                  {interimTranscript && (
                    <span style={s.interimText}>{interimTranscript}</span>
                  )}
                </p>
              </>
            )}
          </div>
          {hasTranscript && (
            <p style={s.charCount}>{transcript.length} caracteres</p>
          )}
        </div>

        {/* ── Processing state ─────────────────────────────────────────── */}
        {processing && (
          <div style={{ ...s.card, animation: 'fadeIn 0.3s ease' }}>
            <div style={s.processingRow}>
              <div style={s.spinnerWrap}>
                <svg
                  width="18" height="18" viewBox="0 0 18 18"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                >
                  <circle cx="9" cy="9" r="7" stroke={GOLD} strokeWidth="2" strokeDasharray="32" strokeDashoffset="10" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <span style={s.processingText}>✦ IA a extrair dados estruturados...</span>
            </div>
          </div>
        )}

        {/* ── Extracted Data ───────────────────────────────────────────── */}
        {extracted && !processing && (
          <div style={{ ...s.card, animation: 'fadeIn 0.35s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ ...s.sectionTitle, marginBottom: 0, fontSize: 16 }}>
                ✦ Dados Extraídos pela IA
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {extracted.sentiment && (
                  <span style={s.pill(SENTIMENT_COLORS[extracted.sentiment] || MUTED)}>
                    {extracted.sentiment}
                  </span>
                )}
                {extracted.urgency && (
                  <span style={s.pill(URGENCY_BG[extracted.urgency] || MUTED)}>
                    {extracted.urgency === 'alta' ? '🔴' : extracted.urgency === 'media' ? '🟡' : '🟢'} {extracted.urgency}
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            {extracted.summary && (
              <div style={s.summaryText}>{extracted.summary}</div>
            )}

            {/* Contact info + budget grid */}
            <div style={s.extractGrid}>
              {extracted.contactName && (
                <div style={s.extractItem}>
                  <div style={s.extractLabel}>Contacto</div>
                  <div style={s.extractValue}>{extracted.contactName}</div>
                </div>
              )}
              {extracted.phone && (
                <div style={s.extractItem}>
                  <div style={s.extractLabel}>Telefone</div>
                  <div style={{ ...s.extractValue, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{extracted.phone}</div>
                </div>
              )}
              {extracted.email && (
                <div style={s.extractItem}>
                  <div style={s.extractLabel}>Email</div>
                  <div style={{ ...s.extractValue, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{extracted.email}</div>
                </div>
              )}
              {extracted.budget && (
                <div style={s.extractItem}>
                  <div style={s.extractLabel}>Budget</div>
                  <div style={{ ...s.extractValue, color: GREEN }}>
                    €{extracted.budget.min.toLocaleString('pt-PT')}
                    {extracted.budget.max ? ` – €${extracted.budget.max.toLocaleString('pt-PT')}` : ''}
                  </div>
                </div>
              )}
              {extracted.followUpDate && (
                <div style={s.extractItem}>
                  <div style={s.extractLabel}>Follow-Up</div>
                  <div style={{ ...s.extractValue, color: GOLD }}>{extracted.followUpDate}</div>
                </div>
              )}
            </div>

            {/* Zonas + Tipos */}
            {(extracted.zonas?.length || extracted.tipos?.length) ? (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                {extracted.zonas?.length ? (
                  <div style={s.extractItem}>
                    <div style={s.extractLabel}>Zonas</div>
                    <div style={s.extractValue}>{extracted.zonas.join(' · ')}</div>
                  </div>
                ) : null}
                {extracted.tipos?.length ? (
                  <div style={s.extractItem}>
                    <div style={s.extractLabel}>Tipos</div>
                    <div style={s.extractValue}>{extracted.tipos.join(' · ')}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Action items */}
            {extracted.actionItems && extracted.actionItems.length > 0 && (
              <>
                <hr style={s.divider} />
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...s.extractLabel, marginBottom: 8 }}>Próximas Acções</div>
                  <ul style={s.actionList}>
                    {extracted.actionItems.map((item, i) => (
                      <li key={i} style={s.actionItem}>{item}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <hr style={s.divider} />

            {/* Save actions */}
            {saved ? (
              <div style={s.savedBanner}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="#1c4a35" />
                  <path d="M5 9l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Guardado com sucesso no CRM!
              </div>
            ) : (
              <>
                {/* Contact selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>Associar a Contacto CRM</label>
                  <input
                    style={s.inp}
                    placeholder="Pesquisar contacto..."
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                  />
                  {contactSearch.length > 0 && filteredContacts.length > 0 && !selectedContact && (
                    <div style={{
                      background: CARD_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 10,
                      marginTop: 4,
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(14,14,13,0.1)',
                      zIndex: 10,
                      position: 'relative',
                    }}>
                      {filteredContacts.slice(0, 5).map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContact(c.id)
                            setContactSearch(c.name)
                          }}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: `1px solid ${BORDER}`,
                            fontFamily: "'Jost', sans-serif",
                            fontSize: 13,
                            color: TEXT,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#faf8f2')}
                          onMouseLeave={e => (e.currentTarget.style.background = CARD_BG)}
                        >
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: MUTED }}>
                            {c.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedContact && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{
                        background: `${GREEN}15`,
                        color: GREEN,
                        border: `1px solid ${GREEN}30`,
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                      }}>
                        ✓ {crmContacts.find(c => c.id === selectedContact)?.name}
                      </span>
                      <button
                        onClick={() => { setSelectedContact(null); setContactSearch('') }}
                        style={{ ...s.btnGhost, padding: '4px 10px', fontSize: 11 }}
                      >
                        Alterar
                      </button>
                    </div>
                  )}
                </div>

                <div style={s.saveRow}>
                  <button
                    style={{
                      ...s.btnGreen,
                      opacity: !selectedContact ? 0.4 : 1,
                      cursor: !selectedContact ? 'not-allowed' : 'pointer',
                    }}
                    disabled={!selectedContact}
                    onClick={() => selectedContact && saveToContact(selectedContact)}
                  >
                    Guardar como Actividade
                  </button>
                  <button style={s.btnGold} onClick={createNewContact}>
                    Criar Novo Contacto
                  </button>
                  <button style={s.btnGhost} onClick={copyTranscript}>
                    {copied ? '✓ Copiado!' : 'Copiar Transcrição'}
                  </button>
                  <button style={s.btnGhost} onClick={saveAsUnsaved}>
                    Guardar sem associar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Recent Voice Notes ───────────────────────────────────────── */}
        {recentNotes.length > 0 && (
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Notas Recentes</h3>
            {recentNotes.map((note, idx) => (
              <div
                key={note.id}
                className="voz-note-row"
                style={{
                  ...s.noteRow,
                  borderBottom: idx === recentNotes.length - 1 ? 'none' : `1px solid ${BORDER}`,
                }}
                onClick={() => setViewingNote(note)}
              >
                <div style={s.noteIcon}>
                  {noteTypeIcon[note.type] || '🎙️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={s.noteTitle}>
                      {NOTE_TYPE_LABELS[note.type] || 'Nota'}
                      {note.contactName ? ` · ${note.contactName}` : ''}
                    </p>
                    <span style={{
                      ...s.pill(note.saved ? GREEN : MUTED),
                      fontSize: 9,
                    }}>
                      {note.saved ? 'guardada' : 'rascunho'}
                    </span>
                  </div>
                  <p style={s.noteMeta}>
                    {timeAgo(note.date)} · {formatDuration(note.duration)}
                  </p>
                  <p style={s.noteExcerpt}>
                    {note.transcript.slice(0, 100)}{note.transcript.length > 100 ? '...' : ''}
                  </p>
                </div>
                <div style={{ color: MUTED, fontSize: 18, paddingTop: 2 }}>›</div>
              </div>
            ))}
          </div>
        )}

        {recentNotes.length === 0 && !hasTranscript && (
          <div style={{
            ...s.card,
            textAlign: 'center',
            padding: '40px 28px',
            opacity: 0.6,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 14, color: MUTED, margin: 0 }}>
              Nenhuma nota de voz ainda.<br />
              <span style={{ fontSize: 12 }}>Clica no microfone para começar.</span>
            </p>
          </div>
        )}
      </div>

      {/* ── View Note Modal ───────────────────────────────────────────── */}
      {viewingNote && (
        <div style={s.overlay} onClick={() => setViewingNote(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ ...s.sectionTitle, marginBottom: 4 }}>
                  {noteTypeIcon[viewingNote.type]} {NOTE_TYPE_LABELS[viewingNote.type]}
                  {viewingNote.contactName ? ` · ${viewingNote.contactName}` : ''}
                </h3>
                <p style={s.noteMeta}>
                  {new Date(viewingNote.date).toLocaleString('pt-PT')} · {formatDuration(viewingNote.duration)}
                </p>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 22,
                  color: MUTED,
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>

            {viewingNote.extracted?.summary && (
              <div style={{ ...s.summaryText, marginBottom: 16 }}>
                {viewingNote.extracted.summary}
              </div>
            )}

            <div style={s.transcriptBox}>
              <p style={s.transcriptText}>{viewingNote.transcript}</p>
            </div>

            {viewingNote.extracted && (
              <div style={{ marginTop: 16 }}>
                <div style={s.extractGrid}>
                  {viewingNote.extracted.contactName && (
                    <div style={s.extractItem}>
                      <div style={s.extractLabel}>Contacto</div>
                      <div style={s.extractValue}>{viewingNote.extracted.contactName}</div>
                    </div>
                  )}
                  {viewingNote.extracted.budget && (
                    <div style={s.extractItem}>
                      <div style={s.extractLabel}>Budget</div>
                      <div style={{ ...s.extractValue, color: GREEN }}>
                        €{viewingNote.extracted.budget.min.toLocaleString('pt-PT')} – €{viewingNote.extracted.budget.max.toLocaleString('pt-PT')}
                      </div>
                    </div>
                  )}
                  {viewingNote.extracted.followUpDate && (
                    <div style={s.extractItem}>
                      <div style={s.extractLabel}>Follow-Up</div>
                      <div style={{ ...s.extractValue, color: GOLD }}>{viewingNote.extracted.followUpDate}</div>
                    </div>
                  )}
                </div>
                {viewingNote.extracted.actionItems && viewingNote.extracted.actionItems.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={s.extractLabel}>Acções</div>
                    <ul style={s.actionList}>
                      {viewingNote.extracted.actionItems.map((a, i) => (
                        <li key={i} style={s.actionItem}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div style={{ ...s.saveRow, marginTop: 20 }}>
              <button
                style={s.btnGhost}
                onClick={() => {
                  navigator.clipboard.writeText(viewingNote.transcript)
                  setViewingNote(null)
                }}
              >
                Copiar Transcrição
              </button>
              <button style={s.btnGhost} onClick={() => setViewingNote(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
