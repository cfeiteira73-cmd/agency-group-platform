'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { track } from '@/lib/gtm'

// ─── Sofia Avatar — usa /sofia.jpg se existir, fallback ao monograma "S" dourado ──
function SofiaAvatar({ size = 44, open = false }: { size?: number; open?: boolean }) {
  const [imgError, setImgError] = useState(false)

  if (open) {
    return (
      <span style={{ fontSize: size * 0.4, color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>✕</span>
    )
  }

  return !imgError ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/sofia.avif"
      alt="Sofia — Agency Group AI"
      onError={() => setImgError(true)}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', objectPosition: 'top center',
        display: 'block',
      }}
    />
  ) : (
    // Monograma premium quando não há foto
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #c9a96e 0%, #a07840 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: '#0d1f17',
      letterSpacing: '-0.5px', fontFamily: 'Georgia, serif',
      flexShrink: 0,
    }}>
      S
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
  type?: 'text' | 'cards' | 'cta'
}

interface QuickReply {
  label: string
  value: string
  emoji?: string
}

type Branch = 'buy' | 'invest' | 'sell' | 'explore' | null
type ConvStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

// ─── Constants ────────────────────────────────────────────────────────────────
const THINKING_MSGS = [
  'A verificar listagens disponíveis...',
  'A analisar dados de mercado...',
  'A personalizar recomendações...',
  'A calcular valorização da zona...',
  'A pesquisar imóveis exclusivos...',
  'A preparar análise de investimento...',
]

const STEP_QUICK_REPLIES: Record<string, QuickReply[]> = {
  initial: [
    { label: '🏡 Quanto vale o meu imóvel?', value: 'Quero avaliar o meu imóvel e perceber quanto vale no mercado actual', emoji: '🏡' },
    { label: '🏠 Comprar imóvel', value: 'Quero comprar um imóvel em Portugal', emoji: '🏠' },
    { label: '📈 Investir em Portugal', value: 'Tenho interesse em investimento imobiliário em Portugal', emoji: '📈' },
    { label: '🌍 Explorar o mercado', value: 'Estou a explorar o mercado imobiliário português', emoji: '🌍' },
  ],
  seller: [
    { label: '📍 Partilhar zona e tipologia', value: 'O meu imóvel fica em [zona]. É um [tipo] com [quartos] quartos e [área]m²', emoji: '📍' },
    { label: '📞 Falar com consultor', value: 'Prefiro falar directamente com o consultor responsável pela minha zona', emoji: '📞' },
  ],
  location: [
    { label: '🏙️ Lisboa', value: 'Lisboa e arredores', emoji: '🏙️' },
    { label: '🌊 Cascais', value: 'Cascais e Costa do Estoril', emoji: '🌊' },
    { label: '☀️ Algarve', value: 'Algarve', emoji: '☀️' },
    { label: '🏛️ Porto', value: 'Porto e Norte', emoji: '🏛️' },
    { label: '🏝️ Madeira', value: 'Madeira ou Açores', emoji: '🏝️' },
    { label: '✨ Orientar-me', value: 'Estou aberto a sugestões de zona', emoji: '✨' },
  ],
  budget: [
    { label: '< €500K', value: 'Orçamento até €500.000', emoji: '💶' },
    { label: '€500K – €1M', value: 'Orçamento entre €500.000 e €1.000.000', emoji: '💶' },
    { label: '€1M – €2M', value: 'Orçamento entre €1.000.000 e €2.000.000', emoji: '💶' },
    { label: '€2M – €5M', value: 'Orçamento entre €2.000.000 e €5.000.000', emoji: '💶' },
    { label: '€5M+', value: 'Orçamento acima de €5.000.000', emoji: '💎' },
  ],
  timeline: [
    { label: '⚡ Agora mesmo', value: 'Estou pronto para comprar agora, nos próximos 1-2 meses', emoji: '⚡' },
    { label: '📅 3-6 meses', value: 'Estou a planear para os próximos 3 a 6 meses', emoji: '📅' },
    { label: '🗓️ Este ano', value: 'Estou a planear para este ano, talvez 6 a 12 meses', emoji: '🗓️' },
    { label: '🔭 Sem prazo definido', value: 'Estou só a explorar, sem prazo definido', emoji: '🔭' },
  ],
  contact: [
    { label: '💬 WhatsApp', value: 'Prefiro ser contactado via WhatsApp', emoji: '💬' },
    { label: '📧 Email', value: 'Prefiro ser contactado por email', emoji: '📧' },
    { label: '📞 Chamada', value: 'Prefiro receber uma chamada telefónica', emoji: '📞' },
  ],
}

// ─── Context-aware proactive openers ─────────────────────────────────────────
function getProactiveOpener(pathname: string, isReturning: boolean, lastLocation?: string): string {
  if (isReturning && lastLocation) {
    return `Bem-vindo de volta. Da última vez explorou imóveis em **${lastLocation}**. Encontrei ${Math.floor(Math.random() * 3) + 2} novas oportunidades que podem interessar-lhe. Deseja ver?`
  }
  if (pathname.includes('/imoveis') || pathname.includes('/properties')) {
    return `Bom dia. Estou a ver que está a explorar o nosso portfolio. Posso ajudá-lo a encontrar imóveis por zona, orçamento ou perfil — o que procura?`
  }
  if (pathname.includes('/blog') || pathname.includes('/mercado')) {
    return `Bom dia. Vejo que está a aprofundar o mercado imobiliário português. Posso complementar com dados específicos sobre preços, yields ou regimes fiscais — é só perguntar.`
  }
  if (pathname.includes('/off-market')) {
    return `Compreendo que prefere um processo discreto. Posso qualificar o seu ativo e orientar todo o processo sem exposição pública. Como posso ajudar?`
  }
  if (pathname.includes('/avm') || pathname.includes('/avaliacao')) {
    return `Posso fazer uma avaliação inicial do seu imóvel com dados de transacções recentes da zona. Quer partilhar alguns dados?`
  }
  if (pathname.includes('/contact') || pathname.includes('/contacto')) {
    return `Posso ligá-lo ao consultor responsável pela zona que lhe interessa. O que procura?`
  }
  return `Posso ajudar a identificar oportunidades ou esclarecer um ativo. O que procura?`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SofiaAgentWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingMsg, setThinkingMsg] = useState('')
  const [unread, setUnread] = useState(0)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(STEP_QUICK_REPLIES.initial)
  const [step, setStep] = useState<ConvStep>(0)
  const [branch, setBranch] = useState<Branch>(null)
  const [locationPref, setLocationPref] = useState('')
  const [leadScore, setLeadScore] = useState(0)
  const [proactiveShown, setProactiveShown] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [msgCount, setMsgCount] = useState(0)
  const [sofiaEmail, setSofiaEmail] = useState('')
  const [sofiaEmailSent, setSofiaEmailSent] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const thinkingIdxRef = useRef(0)

  // ── Session persistence ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ag_sofia_session')
      if (saved) {
        const session = JSON.parse(saved) as { location?: string; msgCount?: number; timestamp?: number }
        const age = Date.now() - (session.timestamp ?? 0)
        if (age < 30 * 24 * 60 * 60 * 1000) {
          setIsReturning(true)
          if (session.location) setLocationPref(session.location)
          if (session.msgCount) setMsgCount(session.msgCount)
        }
      }
    } catch {}
  }, [])

  // ── Message history persistence ──────────────────────────────────────────
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('ag_sofia_messages')
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as Message[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {}
  }, [])

  // ── Proactive trigger — 15s on high-intent pages, 45s elsewhere ────────
  useEffect(() => {
    if (proactiveShown) return
    const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
    const highIntent = ['/imoveis', '/off-market', '/equipa', '/vender-imovel-portugal'].some(
      p => pathname.includes(p)
    )
    const delay = highIntent ? 15000 : 45000
    const timer = setTimeout(() => {
      if (!open) {
        setMessages(prev => {
          // Don't overwrite a restored history
          if (prev.length > 0) { setUnread(1); setProactiveShown(true); return prev }
          const currentPath = window.location.pathname
          const opener = getProactiveOpener(currentPath, isReturning, locationPref || undefined)
          const newMsgs = [{ role: 'assistant' as const, content: opener, timestamp: Date.now() }]
          try { localStorage.setItem('ag_sofia_messages', JSON.stringify(newMsgs)) } catch {}
          return newMsgs
        })
        setUnread(1)
        setProactiveShown(true)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [proactiveShown, open, isReturning, locationPref])

  // ── Immediate greeting when first opened manually ────────────────────────
  useEffect(() => {
    if (open && messages.length === 0) {
      const pathname = window.location.pathname
      const opener = getProactiveOpener(pathname, isReturning, locationPref || undefined)
      const newMsgs: Message[] = [{ role: 'assistant', content: opener, timestamp: Date.now() }]
      setMessages(newMsgs)
      try { localStorage.setItem('ag_sofia_messages', JSON.stringify(newMsgs)) } catch {}
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading])

  // ── Focus input when opened ──────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  // ── Show WhatsApp CTA after 3 exchanges ──────────────────────────────────
  useEffect(() => {
    const userMsgs = messages.filter(m => m.role === 'user').length
    if (userMsgs >= 3 && !showWhatsApp) setShowWhatsApp(true)
  }, [messages, showWhatsApp])

  // ── Update lead score based on message content ───────────────────────────
  const updateLeadScore = useCallback((msg: string) => {
    const lower = msg.toLowerCase()
    let score = 0
    if (/pronto|agora|urgente|imediatamente/.test(lower)) score += 30
    if (/€[23456789]m|milhões|million/.test(lower)) score += 25
    if (/cash|comptant|liquidez|sem crédito/.test(lower)) score += 20
    if (/cascais|chiado|príncipe real|comporta|quinta/.test(lower)) score += 15
    if (/investimento|yield|rentabilidade/.test(lower)) score += 15
    if (/3-6 meses|este ano/.test(lower)) score += 10
    // Seller intent = high value lead
    if (/vender|avaliar|quanto vale|avalia[çc]|sell|vente/.test(lower)) score += 35
    setLeadScore(prev => Math.min(prev + score, 100))
  }, [])

  // ── Advance conversation step and set next quick replies ─────────────────
  const advanceStep = useCallback((userMsg: string) => {
    const lower = userMsg.toLowerCase()

    if (step === 0) {
      if (/comprar|buy|purchase|acquérir/.test(lower)) { setBranch('buy'); setStep(1); setQuickReplies(STEP_QUICK_REPLIES.location) }
      else if (/investimento|invest|rendimento|yield/.test(lower)) { setBranch('invest'); setStep(1); setQuickReplies(STEP_QUICK_REPLIES.location) }
      else if (/vender|sell|avali|quanto vale|vente/.test(lower)) { setBranch('sell'); setStep(1); setQuickReplies(STEP_QUICK_REPLIES.seller) }
      else { setBranch('explore'); setStep(1); setQuickReplies(STEP_QUICK_REPLIES.location) }
    } else if (step === 1) {
      const zones = ['lisboa', 'cascais', 'algarve', 'porto', 'madeira', 'açores', 'comporta']
      const found = zones.find(z => lower.includes(z))
      if (found) {
        const loc = found.charAt(0).toUpperCase() + found.slice(1)
        setLocationPref(loc)
        try {
          localStorage.setItem('ag_sofia_session', JSON.stringify({ location: loc, msgCount: msgCount + 1, timestamp: Date.now() }))
        } catch {}
      }
      setStep(2)
      setQuickReplies(STEP_QUICK_REPLIES.budget)
    } else if (step === 2) {
      setStep(3)
      setQuickReplies(STEP_QUICK_REPLIES.timeline)
      if (/2m|3m|4m|5m|milhões/.test(lower)) setLeadScore(prev => Math.min(prev + 25, 100))
    } else if (step === 3) {
      setStep(4)
      setQuickReplies(STEP_QUICK_REPLIES.contact)
      if (/agora|now|pronto|immediately|1-2/.test(lower)) setLeadScore(prev => Math.min(prev + 30, 100))
    } else if (step === 4) {
      setStep(5)
      setQuickReplies([])
    } else {
      setQuickReplies([])
    }
  }, [step, msgCount])

  // ── Persist messages to localStorage (max 50) ────────────────────────────
  const persistMessages = useCallback((msgs: Message[]) => {
    try {
      const toStore = msgs.slice(-50)
      localStorage.setItem('ag_sofia_messages', JSON.stringify(toStore))
    } catch {}
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    persistMessages(newMessages)
    setInput('')
    setLoading(true)
    setQuickReplies([])

    updateLeadScore(text)
    advanceStep(text)
    setMsgCount(prev => prev + 1)

    const tIdx = thinkingIdxRef.current % THINKING_MSGS.length
    thinkingIdxRef.current++
    setThinkingMsg(THINKING_MSGS[tIdx])

    const withPlaceholder: Message[] = [...newMessages, { role: 'assistant', content: '', timestamp: Date.now() }]
    setMessages(withPlaceholder)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/sofia-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: newMessages,
          branch,
          step,
          locationPref,
          leadScore,
        }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue
          try {
            const { text: chunk } = JSON.parse(raw) as { text: string }
            fullText += chunk
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: fullText, timestamp: Date.now() }
              return updated
            })
          } catch {}
        }
      }

      // Persist final assistant reply
      setMessages(prev => {
        persistMessages(prev)
        return prev
      })

      setTimeout(() => {
        if (step === 0) setQuickReplies(STEP_QUICK_REPLIES.initial)
      }, 100)

    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'De momento estou indisponível. Pode falar directamente com a equipa:\n\n📞 +351 919 948 986',
            timestamp: Date.now(),
          }
          persistMessages(updated)
          return updated
        })
      }
    } finally {
      setLoading(false)
      setThinkingMsg('')
    }
  }, [messages, loading, branch, step, locationPref, leadScore, updateLeadScore, advanceStep, persistMessages])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── KEYFRAMES ── */}
      <style>{`
        @keyframes ag-pulse-ring {
          0% { transform: scale(1); opacity: .6; }
          70% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes ag-pulse-dot { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes ag-bounce-dot { 0%,80%,100%{transform:scale(0);opacity:0} 40%{transform:scale(1);opacity:1} }
        @keyframes ag-slide-up {
          from { opacity:0; transform:translateY(24px) scale(.96); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes ag-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ag-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,169,110,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(201,169,110,0); }
        }
        .ag-widget-btn { transition: transform .2s ease, box-shadow .2s ease !important; }
        .ag-widget-btn:hover { transform: scale(1.08) !important; }
        .ag-qr-btn { transition: all .15s ease !important; }
        .ag-qr-btn:hover { background: rgba(201,169,110,0.15) !important; border-color: rgba(201,169,110,0.6) !important; transform: translateY(-1px); }
        .ag-send-btn { transition: all .15s ease !important; }
        .ag-send-btn:hover:not(:disabled) { transform: scale(1.1) !important; }
        .ag-msg-input:focus { border-color: rgba(201,169,110,0.45) !important; }
        .ag-wa-btn:hover { background: rgba(37,211,102,0.15) !important; border-color: rgba(37,211,102,0.5) !important; }
        .ag-chat-scroll::-webkit-scrollbar { width: 4px; }
        .ag-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .ag-chat-scroll::-webkit-scrollbar-thumb { background: rgba(201,169,110,0.2); border-radius: 4px; }
      `}</style>

      {/* ═══════════════════════════════════════════════════════
          FLOATING LAUNCHER BUTTON
      ═══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
      }}>

        {/* Proactive tooltip pill */}
        {!open && unread > 0 && (
          <div
            onClick={() => { setOpen(true); track('sofia_started') }}
            style={{
              background: 'linear-gradient(135deg, #1c4a35, #0d2b1f)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              padding: '8px 14px', borderRadius: 22, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              border: '1px solid rgba(201,169,110,0.25)',
              animation: 'ag-fade-in 0.4s ease',
              maxWidth: 260, lineHeight: 1.4,
            }}
          >
            <span style={{ color: '#c9a96e', marginRight: 4 }}>Sofia:</span>
            A sua pesquisa privada começa aqui.
          </div>
        )}

        {/* Launcher button with pulse ring */}
        <div style={{ position: 'relative' }}>
          {/* Pulse ring when unread */}
          {!open && unread > 0 && (
            <span style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              background: 'transparent',
              border: '2px solid rgba(201,169,110,0.6)',
              animation: 'ag-pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite',
              pointerEvents: 'none',
            }} />
          )}

          <button
            type="button"
            onClick={() => {
              const next = !open
              setOpen(next)
              if (next) track('sofia_started')
            }}
            className="ag-widget-btn"
            aria-label={open ? 'Fechar assistente privada Sofia' : 'Sofia — Assistente Privada Agency Group'}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: open
                ? 'linear-gradient(135deg, #2d5a44, #1c4a35)'
                : 'linear-gradient(135deg, #1c4a35 0%, #0a2018 100%)',
              border: '2.5px solid rgba(201,169,110,0.7)',
              boxShadow: open
                ? '0 4px 20px rgba(0,0,0,0.3)'
                : '0 8px 32px rgba(28,74,53,0.55), 0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', outline: 'none', position: 'relative',
              animation: !open && unread === 0 ? 'ag-glow 3s ease-in-out infinite' : 'none',
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', transition: 'all 0.25s ease',
              border: open ? 'none' : '1.5px solid rgba(201,169,110,0.3)',
            }}>
              <SofiaAvatar size={42} open={open} />
            </div>

            {/* Online dot */}
            {!open && (
              <span style={{
                position: 'absolute', top: 3, right: 3,
                width: 14, height: 14, borderRadius: '50%',
                background: '#22c55e', border: '2.5px solid #0a2018',
                animation: 'ag-pulse-dot 2s ease-in-out infinite',
              }} />
            )}

            {/* Unread badge */}
            {!open && unread > 0 && (
              <span style={{
                position: 'absolute', top: -4, left: -4,
                minWidth: 22, height: 22, borderRadius: 11,
                background: '#ef4444', border: '2px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: '#fff', padding: '0 4px',
              }}>
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CHAT MODAL — Glassmorphism dark luxury
      ═══════════════════════════════════════════════════════ */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 100, right: 24,
          width: 400, maxWidth: 'calc(100vw - 40px)',
          height: 580, maxHeight: 'calc(100vh - 116px)',
          background: 'rgba(8, 18, 12, 0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 22,
          border: '1px solid rgba(201,169,110,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          zIndex: 9998, overflow: 'hidden',
          animation: 'ag-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>

          {/* ── HEADER ── */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(28,74,53,0.9) 0%, rgba(13,43,31,0.95) 100%)',
            borderBottom: '1px solid rgba(201,169,110,0.12)',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            {/* Sofia avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                border: '2px solid rgba(201,169,110,0.4)',
                overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <SofiaAvatar size={46} />
              </div>
              <span style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 12, height: 12, borderRadius: '50%',
                background: '#22c55e', border: '2px solid rgba(8,18,12,0.9)',
                animation: 'ag-pulse-dot 2s infinite',
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Sofia</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                  background: 'rgba(34,197,94,0.15)', color: '#4ade80',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}>● Online</span>
                {leadScore >= 50 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                    background: 'rgba(201,169,110,0.15)', color: '#c9a96e',
                    border: '1px solid rgba(201,169,110,0.25)',
                  }}>⭐ VIP</span>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 }}>
                Agency Group · AMI 22506 · IA 24/7
              </div>
            </div>

            {/* Clear chat history */}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('ag_sofia_messages')
                setMessages([])
              }}
              title="Limpar conversa"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.4)',
                flexShrink: 0, transition: 'all .15s ease',
              }}
              aria-label="Limpar histórico de chat"
            >🗑</button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.5)',
                flexShrink: 0, transition: 'all .15s ease',
              }}
              aria-label="Fechar chat"
            >✕</button>
          </div>

          {/* ── MESSAGES ── */}
          <div
            className="ag-chat-scroll"
            style={{
              flex: 1, overflowY: 'auto', padding: '16px 14px 8px',
              display: 'flex', flexDirection: 'column', gap: 10,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(201,169,110,0.2) transparent',
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'ag-fade-in 0.25s ease',
                gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      border: '1px solid rgba(201,169,110,0.25)',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <SofiaAvatar size={28} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: msg.role === 'user' ? '82%' : '88%',
                    padding: '11px 15px',
                    borderRadius: msg.role === 'user'
                      ? '18px 18px 4px 18px'
                      : '4px 18px 18px 18px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #1c4a35 0%, #2a6b4e 100%)'
                      : 'rgba(255,255,255,0.06)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(28,74,53,0.8)'
                      : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: msg.role === 'user'
                      ? '0 4px 16px rgba(28,74,53,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.2)',
                    color: '#f0f0f0', fontSize: 13.5, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {msg.content}
                    {/* Streaming cursor */}
                    {loading && i === messages.length - 1 && msg.role === 'assistant' && msg.content.length > 0 && (
                      <span style={{
                        display: 'inline-block', width: 2, height: 14,
                        background: '#c9a96e', marginLeft: 2, verticalAlign: 'middle',
                        animation: 'ag-blink 1s infinite',
                      }} />
                    )}
                    {/* Thinking dots when empty placeholder */}
                    {loading && i === messages.length - 1 && msg.role === 'assistant' && msg.content.length === 0 && (
                      <div>
                        <div style={{ display: 'flex', gap: 5, padding: '2px 0 4px', alignItems: 'center' }}>
                          {[0, 1, 2].map(j => (
                            <span key={j} style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: '#c9a96e', display: 'inline-block',
                              animation: `ag-bounce-dot 1.2s infinite ${j * 0.2}s`,
                            }} />
                          ))}
                        </div>
                        {thinkingMsg && (
                          <div style={{ fontSize: 11, color: 'rgba(201,169,110,0.5)', marginTop: 2, fontStyle: 'italic' }}>
                            {thinkingMsg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* ── QUICK REPLIES ── */}
            {!loading && quickReplies.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 7,
                paddingLeft: 36, marginTop: 4,
                animation: 'ag-fade-in 0.3s ease',
              }}>
                {quickReplies.map(qr => (
                  <button
                    key={qr.value}
                    type="button"
                    onClick={() => sendMessage(qr.value)}
                    className="ag-qr-btn"
                    style={{
                      padding: '7px 13px', borderRadius: 22,
                      border: '1px solid rgba(201,169,110,0.28)',
                      background: 'rgba(201,169,110,0.07)',
                      color: '#c9a96e', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── WHATSAPP CTA + EMAIL CAPTURE ── */}
            {showWhatsApp && !loading && (
              <div style={{
                margin: '6px 0', padding: '12px 14px',
                background: 'rgba(37,211,102,0.06)',
                border: '1px solid rgba(37,211,102,0.18)',
                borderRadius: 14, animation: 'ag-fade-in 0.4s ease',
              }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '0 0 10px', lineHeight: 1.4 }}>
                  💬 Continua esta conversa no WhatsApp — mais rápido, com fotos e tours exclusivos.
                </p>

                {/* Email capture (optional) */}
                {!sofiaEmailSent ? (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="email"
                        value={sofiaEmail}
                        onChange={e => setSofiaEmail(e.target.value)}
                        placeholder="Email (opcional)"
                        style={{
                          flex: 1, padding: '7px 10px',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8, color: '#fff',
                          fontSize: 12, outline: 'none',
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && sofiaEmail.includes('@')) {
                            fetch('/api/leads', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                email: sofiaEmail.trim(),
                                source: 'sofia_widget',
                                zona: locationPref || undefined,
                                use_type: branch === 'buy' ? 'habitacao' : branch === 'invest' ? 'investimento' : branch === 'sell' ? 'venda' : undefined,
                                message: leadScore >= 50 ? `[Sofia score: ${leadScore}${leadScore >= 70 ? ' — ALTA PRIORIDADE' : ''}]` : undefined,
                              }),
                            }).catch(err => console.error('[Sofia] lead POST failed:', err?.message ?? err))
                            track('lead_form_submit', { source: 'sofia_widget', lead_score: leadScore })
                            setSofiaEmailSent(true)
                          }
                        }}
                      />
                      {sofiaEmail.includes('@') && (
                        <button
                          type="button"
                          onClick={() => {
                            fetch('/api/leads', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                email: sofiaEmail.trim(),
                                source: 'sofia_widget',
                                zona: locationPref || undefined,
                                use_type: branch === 'buy' ? 'habitacao' : branch === 'invest' ? 'investimento' : branch === 'sell' ? 'venda' : undefined,
                                message: leadScore >= 50 ? `[Sofia score: ${leadScore}${leadScore >= 70 ? ' — ALTA PRIORIDADE' : ''}]` : undefined,
                              }),
                            }).catch(err => console.error('[Sofia] lead POST failed:', err?.message ?? err))
                            track('lead_form_submit', { source: 'sofia_widget', lead_score: leadScore })
                            setSofiaEmailSent(true)
                          }}
                          style={{
                            padding: '7px 10px', borderRadius: 8,
                            background: 'rgba(201,169,110,0.2)',
                            border: '1px solid rgba(201,169,110,0.4)',
                            color: '#c9a96e', fontSize: 11,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          ✓ Guardar
                        </button>
                      )}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: '4px 0 0', fontStyle: 'italic' }}>
                      Sem spam. Só para envio de imóveis seleccionados.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(28,74,53,0.3)',
                    border: '1px solid rgba(28,74,53,0.5)',
                    color: 'rgba(244,240,230,0.6)', fontSize: 11,
                    marginBottom: 10,
                  }}>
                    ✓ Email guardado — enviaremos imóveis seleccionados
                  </div>
                )}

                <a
                  href={`https://wa.me/351919948986?text=${encodeURIComponent(
                    `Olá, vim do agencygroup.pt. ${locationPref ? `Interesse em ${locationPref}.` : ''} ${branch === 'buy' ? 'Quero comprar.' : branch === 'invest' ? 'Quero investir.' : branch === 'sell' ? 'Quero vender.' : 'Quero saber mais.'}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ag-wa-btn"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 12,
                    background: 'rgba(37,211,102,0.12)',
                    border: '1px solid rgba(37,211,102,0.35)',
                    color: '#25D366', fontSize: 12, fontWeight: 700,
                    textDecoration: 'none', transition: 'all .15s ease',
                  }}
                >
                  <span style={{ fontSize: 16 }}>💬</span> Abrir WhatsApp
                </a>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── INPUT BAR ── */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Escreva uma mensagem..."
              disabled={loading}
              className="ag-msg-input"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '10px 16px',
                color: '#fff', fontSize: 13.5, outline: 'none',
                transition: 'border-color 0.2s ease',
                opacity: loading ? 0.5 : 1,
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="ag-send-btn"
              aria-label="Enviar mensagem"
              style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #c9a96e 0%, #e0c08a 100%)'
                  : 'rgba(255,255,255,0.07)',
                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
                color: input.trim() && !loading ? '#0a1a10' : 'rgba(255,255,255,0.25)',
                boxShadow: input.trim() && !loading ? '0 4px 16px rgba(201,169,110,0.35)' : 'none',
              }}
            >
              ➤
            </button>
          </div>

          {/* ── FOOTER ── */}
          <div style={{
            padding: '5px 16px 8px',
            textAlign: 'center', fontSize: 10, flexShrink: 0,
            color: 'rgba(255,255,255,0.18)', letterSpacing: '0.04em',
          }}>
            Sofia · Assistente Privada · Agency Group · AMI 22506
          </div>
        </div>
      )}
    </>
  )
}
