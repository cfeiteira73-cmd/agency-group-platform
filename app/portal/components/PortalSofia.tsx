'use client'
import { useState, useRef, useEffect, useCallback, type ReactNode, type RefObject } from 'react'
import { useUIStore } from '../stores/uiStore'
import { PORTAL_PROPERTIES } from './constants'
import { useSofiaVoice } from './useSofiaVoice'

interface PortalSofiaProps {
  sofiaSessionId: string | null
  sofiaConnected: boolean
  sofiaLoading: boolean
  sofiaSpeaking: boolean
  sofiaText: string
  sofiaError: string | null
  sofiaScriptLoading: boolean
  sofiaPropSel: string
  sofiaLang: 'PT' | 'EN' | 'FR' | 'AR'
  sofiaVideoRef: RefObject<HTMLVideoElement | null>
  setSofiaText: (s: string) => void
  setSofiaPropSel: (s: string) => void
  setSofiaLang: (l: 'PT' | 'EN' | 'FR' | 'AR') => void
  onConnect: () => Promise<void>
  onDisconnect: () => void
  onSpeak: () => Promise<void>
  onGenerateScript: () => Promise<void>
}

type SofiaMode = 'avatar' | 'chat'
type AssistantMode = 'deal' | 'market' | 'legal' | 'investor'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

const ASSISTANT_MODES: Record<AssistantMode, { label: string; icon: string; color: string; systemHint: string }> = {
  deal:     { label: 'Deal Assistant',    icon: '🏠', color: '#1c4a35', systemHint: 'Foco em análise de imóveis, deal flow e oportunidades de mercado.' },
  market:   { label: 'Market Expert',     icon: '📊', color: '#3a7bd5', systemHint: 'Foco em tendências de mercado, preços por zona e análise comparativa.' },
  legal:    { label: 'Legal Guide',       icon: '⚖️', color: '#c9a96e', systemHint: 'Foco em aspectos jurídicos — CPCV, escritura, NHR, Golden Visa, IMT, IMI.' },
  investor: { label: 'Investor Matcher',  icon: '💼', color: '#9b59b6', systemHint: 'Foco em match de investidores, ROI, yield, estratégia de saída e family offices.' },
}

const QUICK_ACTIONS = [
  { label: 'Avaliar imóvel',    prompt: 'Preciso avaliar um imóvel. Ajuda-me a calcular o valor de mercado com base na zona, área e características.' },
  { label: 'Analisar comprador', prompt: 'Tenho um potencial comprador. Ajuda-me a perceber o seu perfil, motivação e melhores imóveis para apresentar.' },
  { label: 'Redigir proposta',  prompt: 'Preciso de redigir uma proposta formal de compra. Que elementos deve incluir e como estruturá-la?' },
  { label: 'Off-market opp',   prompt: 'Procuro oportunidades off-market em Portugal. Como devo abordar proprietários e onde procurar?' },
  { label: 'Market report',    prompt: 'Cria um market report resumido do mercado imobiliário português para apresentar a um investidor internacional.' },
]

const CONVERSATION_STARTERS = [
  { icon: '🏡', text: 'Qual o melhor imóvel para um investidor francês com €1,5M de budget em Lisboa?' },
  { icon: '📈', text: 'Qual a yield média em Cascais vs Algarve em 2026?' },
  { icon: '⚖️', text: 'Explica-me as etapas de uma transação imobiliária em Portugal — do CPCV à escritura.' },
  { icon: '🌍', text: 'Como abordar um HNWI do Médio Oriente interessado em imóveis premium?' },
  { icon: '💰', text: 'Calcula a rentabilidade de um apartamento T3 em Lisboa a €900K para alojamento local.' },
  { icon: '🔎', text: 'Que zonas de Portugal têm maior potencial de valorização nos próximos 3 anos?' },
]

function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n')
  const result: ReactNode[] = []
  let keyIdx = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // H3
    if (line.startsWith('### ')) {
      result.push(<div key={keyIdx++} style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: '#1c4a35', marginTop: '12px', marginBottom: '4px' }}>{line.slice(4)}</div>)
    // H2
    } else if (line.startsWith('## ')) {
      result.push(<div key={keyIdx++} style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 700, color: '#0e0e0d', marginTop: '14px', marginBottom: '5px' }}>{line.slice(3)}</div>)
    // H1
    } else if (line.startsWith('# ')) {
      result.push(<div key={keyIdx++} style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 700, color: '#0e0e0d', marginTop: '16px', marginBottom: '6px' }}>{line.slice(2)}</div>)
    // Bullet
    } else if (line.match(/^[-*•] /)) {
      result.push(
        <div key={keyIdx++} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: '#c9a96e', flexShrink: 0, marginTop: '1px' }}>·</span>
          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.6 }}>{inlineFormat(line.slice(2))}</span>
        </div>
      )
    // Numbered list
    } else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1] ?? ''
      result.push(
        <div key={keyIdx++} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', flexShrink: 0, marginTop: '2px', minWidth: '16px' }}>{num}.</span>
          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.6 }}>{inlineFormat(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
    // Horizontal rule
    } else if (line.match(/^---+$/)) {
      result.push(<hr key={keyIdx++} style={{ border: 'none', borderTop: '1px solid rgba(14,14,13,.1)', margin: '10px 0' }} />)
    // Empty line → spacing
    } else if (line.trim() === '') {
      result.push(<div key={keyIdx++} style={{ height: '6px' }} />)
    // Normal paragraph
    } else {
      result.push(<div key={keyIdx++} style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.7, marginBottom: '2px' }}>{inlineFormat(line)}</div>)
    }
  }
  return result
}

function inlineFormat(text: string): ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: '#0e0e0d' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function PortalSofia({
  sofiaSessionId: _sofiaSessionId,
  sofiaConnected,
  sofiaLoading,
  sofiaSpeaking,
  sofiaText,
  sofiaError,
  sofiaScriptLoading,
  sofiaPropSel,
  sofiaLang,
  sofiaVideoRef,
  setSofiaText,
  setSofiaPropSel,
  setSofiaLang,
  onConnect,
  onDisconnect,
  onSpeak,
  onGenerateScript,
}: PortalSofiaProps) {
  const { darkMode } = useUIStore()
  const { speak, toggleVoice, speaking: voiceSpeaking, voiceEnabled } = useSofiaVoice()

  const [sofiaMode, setSofiaMode] = useState<SofiaMode>('chat')
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('deal')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  const border = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.08)'
  const bg = darkMode ? '#0c1f15' : '#fff'
  const textPrimary = darkMode ? '#f4f0e6' : '#0e0e0d'
  const textMuted = darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)'
  const panelBg = darkMode ? '#0f2117' : '#fff'

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendChatMessage = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content || chatLoading) return

    const now = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    const userMsg: ChatMessage = { id: Date.now() * 1000 + Math.floor(Math.random() * 1000), role: 'user', content, timestamp: now }

    // Snapshot history before adding the new user message (avoid stale closure)
    const historySnapshot = chatMessages
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }))

    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    // Placeholder assistant message that will be updated as chunks arrive
    // Use a sufficiently unique ID: timestamp * 1000 + random to avoid collisions
    const assistantId = Date.now() * 1000 + Math.floor(Math.random() * 1000)
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: now,
      isStreaming: true,
    }
    setChatMessages(prev => [...prev, placeholderMsg])

    try {
      const modeConfig = ASSISTANT_MODES[assistantMode]
      const res = await fetch('/api/sofia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...historySnapshot, { role: 'user', content }],
          systemHint: modeConfig.systemHint,
          mode: assistantMode,
          lang: sofiaLang,
        }),
      })

      // Handle non-streaming error responses (4xx/5xx JSON)
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        const errText = errData.error ?? `Erro ${res.status}`
        setChatMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: errText, isStreaming: false } : m
        ))
        return
      }

      // SSE streaming
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''
      let streamDone = false

      try {
        while (!streamDone) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const payload = trimmed.slice(6)
            if (payload === '[DONE]') {
              streamDone = true
              break
            }
            try {
              const parsed = JSON.parse(payload) as { text?: string; error?: string }
              if (parsed.error) {
                accumulated = parsed.error
              } else if (parsed.text) {
                accumulated += parsed.text
              }
              // Update message content in real-time
              setChatMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ))
            } catch {
              // Ignore malformed SSE chunks
            }
          }
        }
      } finally {
        reader.cancel().catch(() => {/* ignore cancel errors */})
      }

      // Mark streaming done
      setChatMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ))
      // Speak the final accumulated response
      speak(accumulated)
    } catch {
      setChatMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Erro de ligação. Verifica a tua ligação à internet.', isStreaming: false }
          : m
      ))
    } finally {
      setChatLoading(false)
    }
  }, [chatMessages, chatLoading, assistantMode, sofiaLang])

  const exportConversation = useCallback(() => {
    if (chatMessages.length === 0) return
    const text = chatMessages.map(m => `[${m.timestamp}] ${m.role === 'user' ? 'Você' : 'Sofia'}: ${m.content}`).join('\n\n')
    navigator.clipboard.writeText(text)
  }, [chatMessages])

  const clearConversation = useCallback(() => {
    setChatMessages([])
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .sofia-mode-btn { padding: 7px 16px; border: 1px solid rgba(14,14,13,.12); background: transparent; font-family: var(--font-dm-mono),monospace; font-size: .52rem; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; color: rgba(14,14,13,.5); transition: all .2s; }
        .sofia-mode-btn.active { background: #1c4a35; color: #f4f0e6; border-color: #1c4a35; }
        .sofia-chip { padding: 6px 14px; border: 1px solid rgba(14,14,13,.12); background: transparent; font-family: var(--font-dm-mono),monospace; font-size: .52rem; letter-spacing: .06em; cursor: pointer; color: rgba(14,14,13,.5); transition: all .2s; white-space: nowrap; border-radius: 6px; }
        .sofia-chip:hover { background: rgba(28,74,53,.06); border-color: rgba(28,74,53,.3); color: #1c4a35; }
        .chat-bubble-user { background: #1c4a35; color: #f4f0e6; border-radius: 12px 12px 2px 12px; padding: 10px 14px; max-width: 80%; align-self: flex-end; font-family: 'Jost',sans-serif; font-size: .84rem; line-height: 1.6; }
        .chat-bubble-ai { background: ${darkMode ? 'rgba(244,240,230,.06)' : '#f8f7f4'}; border: 1px solid ${border}; border-radius: 12px 12px 12px 2px; padding: 12px 16px; max-width: 88%; align-self: flex-start; }
        .chat-input-area { border: 1px solid ${border}; background: ${darkMode ? 'rgba(244,240,230,.04)' : '#fff'}; font-family: 'Jost',sans-serif; font-size: .84rem; color: ${textPrimary}; padding: 10px 14px; resize: none; outline: none; line-height: 1.5; flex: 1; border-radius: 8px; }
        .chat-input-area::placeholder { color: ${textMuted}; }
        .mode-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; font-family: var(--font-dm-mono),monospace; font-size: .52rem; letter-spacing: .06em; cursor: pointer; border: 1px solid transparent; transition: all .2s; border-radius: 4px; }
        .mode-pill.active { background: rgba(28,74,53,.1); border-color: rgba(28,74,53,.25); color: #1c4a35; }
        .mode-pill:not(.active) { color: rgba(14,14,13,.4); }
        .mode-pill:not(.active):hover { background: rgba(14,14,13,.04); }
      `}</style>

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#1c4a35,#c9a96e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#f4f0e6', fontWeight: 300, flexShrink: 0 }}>S</div>
          <div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: textPrimary }}>Sofia <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>IA</em></div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: sofiaConnected ? '#4a9c7a' : textMuted, letterSpacing: '.06em' }}>
              {sofiaConnected ? '● AVATAR CONECTADO' : sofiaLoading ? '● A conectar...' : sofiaMode === 'chat' ? '● CHAT ACTIVO' : '○ Avatar Offline'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', border: `1px solid ${border}`, overflow: 'hidden' }}>
            <button type="button" className={`sofia-mode-btn${sofiaMode === 'avatar' ? ' active' : ''}`} onClick={() => setSofiaMode('avatar')}>▶ Avatar</button>
            <button type="button" className={`sofia-mode-btn${sofiaMode === 'chat' ? ' active' : ''}`} onClick={() => setSofiaMode('chat')}>💬 Chat IA</button>
          </div>

          {/* Language selector */}
          {(['PT', 'EN', 'FR', 'AR'] as const).map(l => (
            <button type="button" key={l}
              style={{ padding: '4px 10px', background: sofiaLang === l ? '#c9a96e' : 'transparent', border: `1px solid ${sofiaLang === l ? '#c9a96e' : border}`, color: sofiaLang === l ? '#0c1f15' : textMuted, fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', borderRadius: '4px', transition: 'all .2s' }}
              onClick={() => setSofiaLang(l)}>
              {l}
            </button>
          ))}

          {/* Voice toggle — only in chat mode */}
          {sofiaMode === 'chat' && (
            <button
              type="button"
              onClick={toggleVoice}
              title={voiceEnabled ? 'Desativar voz da Sofia' : 'Ativar voz da Sofia'}
              aria-label={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}
              className={`p-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-[#1c4a35] focus-visible:outline-offset-2 ${
                voiceEnabled
                  ? 'bg-[#1c4a35] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={{ padding: '6px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: voiceEnabled ? '#1c4a35' : 'rgba(14,14,13,.06)', color: voiceEnabled ? '#f4f0e6' : 'rgba(14,14,13,.4)', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {voiceSpeaking ? (
                <svg className="w-4 h-4 animate-pulse" style={{ width: '16px', height: '16px', animation: 'pulse 1s infinite' }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              ) : voiceEnabled ? (
                <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                  <path d="M12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                </svg>
              )}
            </button>
          )}

          {sofiaMode === 'avatar' && sofiaConnected && (
            <button type="button" style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(220,38,38,.3)', color: '#dc2626', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', letterSpacing: '.08em', borderRadius: '6px', transition: 'all .2s' }} onClick={onDisconnect}>
              ■ Desconectar
            </button>
          )}
          {sofiaMode === 'avatar' && !sofiaConnected && (
            <div style={{ padding: '5px 12px', background: 'rgba(201,169,110,.1)', border: '1px solid rgba(201,169,110,.3)', borderRadius: '6px', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.48rem', color: '#c9a96e', letterSpacing: '.1em' }}>
              ⚙ EM ATUALIZAÇÃO
            </div>
          )}
        </div>
      </div>

      {/* ── AVATAR MODE ── */}
      {sofiaMode === 'avatar' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Video panel */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1f15', position: 'relative' }}>
            {sofiaConnected ? (
              <video
                ref={sofiaVideoRef as RefObject<HTMLVideoElement>}
                autoPlay
                playsInline
                style={{ width: '100%', maxWidth: '500px', height: 'auto', borderRadius: '4px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', maxWidth: '380px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(28,74,53,.5),rgba(201,169,110,.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(201,169,110,.2)' }}>
                  <span style={{ fontFamily: "'Cormorant',serif", fontSize: '2rem', color: '#c9a96e' }}>S</span>
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.5rem', letterSpacing: '.2em', color: '#c9a96e', marginBottom: '10px', textTransform: 'uppercase' }}>Avatar em Atualização</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: 'rgba(244,240,230,.7)', marginBottom: '16px', lineHeight: 1.5 }}>
                  O fornecedor de Avatar IA (HeyGen) migrou para uma nova plataforma em Março 2026.
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(244,240,230,.35)', lineHeight: 1.8, marginBottom: '24px' }}>
                  A integração com LiveAvatar está a ser configurada.<br/>
                  Usa o <strong style={{ color: '#c9a96e' }}>Chat IA</strong> enquanto isso — mesma Sofia, sem avatar.
                </div>
                <button
                  type="button"
                  onClick={() => setSofiaMode('chat')}
                  style={{ padding: '10px 24px', background: '#c9a96e', color: '#0c1f15', border: 'none', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.55rem', letterSpacing: '.15em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '4px', fontWeight: 600 }}
                >
                  Ir para Chat IA
                </button>
              </div>
            )}
            {sofiaSpeaking && (
              <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ width: '4px', background: '#c9a96e', borderRadius: '2px', animation: `soundBar .5s ease-in-out ${i * 0.1}s infinite alternate` }} />
                ))}
              </div>
            )}
          </div>

          {/* Controls panel */}
          <div style={{ width: '300px', flexShrink: 0, borderLeft: `1px solid ${border}`, padding: '20px', background: panelBg, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div>
              <label className="p-label">Imóvel para Apresentar</label>
              <select className="p-sel" value={sofiaPropSel} onChange={e => setSofiaPropSel(e.target.value)}>
                <option value="">— Selecionar imóvel</option>
                {(PORTAL_PROPERTIES as Record<string, unknown>[]).map(p => (
                  <option key={String(p.id)} value={String(p.id)}>{String(p.nome || p.title)}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="p-label" style={{ marginBottom: 0 }}>Script</label>
                <button type="button"
                  style={{ background: 'transparent', border: 'none', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#1c4a35', cursor: 'pointer' }}
                  onClick={onGenerateScript}
                  disabled={sofiaScriptLoading || !sofiaPropSel}>
                  {sofiaScriptLoading ? '✦ A gerar...' : '✦ Gerar Script IA'}
                </button>
              </div>
              <textarea
                className="p-inp"
                rows={8}
                placeholder="Escreva o texto para a Sofia apresentar..."
                value={sofiaText}
                onChange={e => setSofiaText(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button type="button" className="p-btn" onClick={onSpeak} disabled={!sofiaConnected || sofiaSpeaking || !sofiaText.trim()}>
              {sofiaSpeaking ? '✦ A falar...' : '▶ Falar'}
            </button>

            {sofiaError && (
              <div style={{ padding: '10px 12px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.15)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#dc2626', borderRadius: '8px' }}>
                {sofiaError}
              </div>
            )}

            <div style={{ padding: '12px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)', borderRadius: '10px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.08em', marginBottom: '8px', textTransform: 'uppercase' }}>Casos de Uso</div>
              {['Apresentação Virtual', 'Tour Remoto HNWI', 'Pitch Investidor', 'WhatsApp Vídeo'].map(u => (
                <div key={u} style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.5)', padding: '4px 0', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                  ✓ {u}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CHAT MODE ── */}
      {sofiaMode === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Assistant mode selector + actions bar */}
          <div style={{ padding: '10px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, background: bg, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: textMuted, letterSpacing: '.1em', textTransform: 'uppercase', marginRight: '4px' }}>Modo</div>
            {(Object.entries(ASSISTANT_MODES) as [AssistantMode, typeof ASSISTANT_MODES[AssistantMode]][]).map(([k, v]) => (
              <button type="button" key={k} className={`mode-pill${assistantMode === k ? ' active' : ''}`} onClick={() => setAssistantMode(k)}>
                <span>{v.icon}</span> {v.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              {chatMessages.length > 0 && (
                <>
                  <button type="button"
                    onClick={exportConversation}
                    style={{ padding: '4px 10px', background: 'rgba(28,74,53,.06)', border: `1px solid rgba(28,74,53,.15)`, color: '#1c4a35', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', letterSpacing: '.06em', borderRadius: '6px', transition: 'all .2s' }}
                    title="Copiar conversa para clipboard">
                    ↗ Exportar
                  </button>
                  <button type="button"
                    onClick={clearConversation}
                    style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${border}`, color: textMuted, fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}>
                    × Limpar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Empty state: conversation starters */}
            {chatMessages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '24px', padding: '20px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#1c4a35,#c9a96e)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontFamily: "'Cormorant',serif", fontSize: '1.5rem', color: '#f4f0e6' }}>S</div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: textPrimary, marginBottom: '4px' }}>Sofia <em style={{ color: '#c9a96e' }}>Assistente IA</em></div>
                  <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: textMuted, letterSpacing: '.08em' }}>
                    Modo: {ASSISTANT_MODES[assistantMode].icon} {ASSISTANT_MODES[assistantMode].label}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '560px', width: '100%' }}>
                  {CONVERSATION_STARTERS.map((s, i) => (
                    <button type="button" key={i}
                      onClick={() => sendChatMessage(s.text)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 14px', background: darkMode ? 'rgba(244,240,230,.04)' : '#f8f7f4', border: `1px solid ${border}`, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', borderRadius: '10px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1c4a35'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(28,74,53,.06)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = border; (e.currentTarget as HTMLButtonElement).style.background = darkMode ? 'rgba(244,240,230,.04)' : '#f8f7f4' }}>
                      <span style={{ fontSize: '.9rem', flexShrink: 0 }}>{s.icon}</span>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: darkMode ? 'rgba(244,240,230,.6)' : 'rgba(14,14,13,.65)', lineHeight: 1.4 }}>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg,#1c4a35,#c9a96e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant',serif", fontSize: '.5rem', color: '#f4f0e6', flexShrink: 0 }}>S</div>
                  )}
                  <span style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: textMuted }}>{msg.timestamp}</span>
                </div>
                {msg.role === 'user' ? (
                  <div className="chat-bubble-user">{msg.content}</div>
                ) : (
                  <div className="chat-bubble-ai">
                    {msg.isStreaming && msg.content === ''
                      ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
                          {[0, 1, 2].map(i => (
                            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c9a96e', animation: `dotPulse .8s ease-in-out ${i * 0.2}s infinite` }} />
                          ))}
                        </div>
                      )
                      : (
                        <>
                          {renderMarkdown(msg.content)}
                          {msg.isStreaming && (
                            <span
                              style={{ display: 'inline-block', width: '2px', height: '1em', background: '#c9a96e', marginLeft: '2px', verticalAlign: 'text-bottom', animation: 'cursorBlink .7s step-end infinite' }}
                            />
                          )}
                        </>
                      )
                    }
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator — only show when there's no streaming placeholder already visible */}
            {chatLoading && !chatMessages.some(m => m.isStreaming) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg,#1c4a35,#c9a96e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant',serif", fontSize: '.5rem', color: '#f4f0e6' }}>S</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '10px 14px', background: darkMode ? 'rgba(244,240,230,.06)' : '#f8f7f4', border: `1px solid ${border}`, borderRadius: '12px 12px 12px 2px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c9a96e', animation: `dotPulse .8s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick actions chips */}
          <div style={{ padding: '8px 20px', borderTop: `1px solid ${border}`, display: 'flex', gap: '6px', overflowX: 'auto', flexShrink: 0, background: bg }}>
            {QUICK_ACTIONS.map((a, i) => (
              <button type="button" key={i} className="sofia-chip" onClick={() => sendChatMessage(a.prompt)} disabled={chatLoading}>{a.label}</button>
            ))}
          </div>

          {/* Input area */}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${border}`, background: bg, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={chatInputRef}
                className="chat-input-area"
                rows={2}
                placeholder={`Pergunta à Sofia (${ASSISTANT_MODES[assistantMode].label})...`}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendChatMessage(chatInput)
                  }
                }}
                disabled={chatLoading}
              />
              <button type="button"
                onClick={() => sendChatMessage(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: '10px 18px',
                  background: chatLoading || !chatInput.trim() ? 'rgba(28,74,53,.3)' : '#1c4a35',
                  color: '#c9a96e',
                  border: 'none',
                  fontFamily: 'var(--font-dm-mono),monospace',
                  fontSize: '.52rem',
                  letterSpacing: '.1em',
                  cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer',
                  flexShrink: 0,
                  alignSelf: 'stretch',
                  transition: 'background .2s',
                }}>
                {chatLoading ? '✦' : '→'}
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: textMuted, marginTop: '5px', letterSpacing: '.04em' }}>
              Enter para enviar · Shift+Enter para nova linha · {ASSISTANT_MODES[assistantMode].icon} {ASSISTANT_MODES[assistantMode].label}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: .3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes soundBar {
          from { height: 6px; }
          to { height: 22px; }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
