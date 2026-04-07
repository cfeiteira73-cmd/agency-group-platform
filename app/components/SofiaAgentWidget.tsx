'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

const QUICK_REPLIES = [
  { label: '🏠 Quero Comprar', msg: 'Quero comprar um imóvel em Portugal' },
  { label: '📈 Investimento', msg: 'Tenho interesse em investimento imobiliário em Portugal' },
  { label: '💰 Avaliação Grátis', msg: 'Quero uma avaliação gratuita do meu imóvel' },
  { label: '🌍 NHR / IFICI', msg: 'Tenho dúvidas sobre o regime NHR e IFICI' },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function SofiaAgentWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Olá! Sou a Sofia, assistente da Agency Group 👋\n\nEstou aqui para ajudar a encontrar o imóvel perfeito em Portugal. Em que posso ajudar?',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(1)
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setShowQuickReplies(false)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/sofia-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ messages: newMessages }),
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
              updated[updated.length - 1] = { role: 'assistant', content: fullText }
              return updated
            })
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Desculpe, ocorreu um erro. Contacte-nos em geral@agencygroup.pt ou +351 919 948 986 🙏',
          }
          return updated
        })
      }
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  return (
    <>
      {/* ── KEYFRAMES ── */}
      <style>{`
        @keyframes ag-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.2)} }
        @keyframes ag-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ag-slideup { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ag-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .ag-btn:hover { transform: scale(1.05) !important; box-shadow: 0 12px 40px rgba(28,74,53,0.6), 0 0 0 6px rgba(201,169,110,0.15) !important; }
        .ag-qr:hover { background: rgba(201,169,110,0.15) !important; border-color: rgba(201,169,110,0.6) !important; }
        .ag-send:hover:not(:disabled) { transform: scale(1.08) !important; }
      `}</style>

      {/* ── FLOATING BUTTON ── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>

        {/* Tooltip pill */}
        {!open && (
          <div style={{
            background: '#1c4a35', color: '#fff', fontSize: 12, fontWeight: 700,
            padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', border: '1px solid rgba(201,169,110,0.25)',
            animation: 'ag-fadein 0.4s ease',
          }}>
            💬 Sofia · Online 24/7
          </div>
        )}

        {/* Circle button */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="ag-btn"
          aria-label={open ? 'Fechar assistente Sofia' : 'Abrir assistente Sofia'}
          style={{
            width: 62, height: 62, borderRadius: '50%',
            background: open ? '#1c4a35' : 'linear-gradient(135deg,#1c4a35 0%,#0d2b1f 100%)',
            border: '2.5px solid #c9a96e',
            boxShadow: '0 8px 32px rgba(28,74,53,0.5), 0 0 0 4px rgba(201,169,110,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease',
            fontSize: 26, position: 'relative', outline: 'none',
          }}
        >
          <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>
            {open ? '✕' : '🤖'}
          </span>
          {/* Green online dot */}
          {!open && (
            <span style={{
              position: 'absolute', top: 2, right: 2, width: 14, height: 14,
              borderRadius: '50%', background: '#22c55e', border: '2.5px solid #0d1f17',
              animation: 'ag-pulse 2s infinite',
            }} />
          )}
          {/* Unread badge */}
          {!open && unread > 0 && (
            <span style={{
              position: 'absolute', top: -5, left: -5, width: 22, height: 22,
              borderRadius: '50%', background: '#ef4444', border: '2.5px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#fff',
            }}>
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* ── CHAT MODAL ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 100, right: 24,
          width: 385, maxWidth: 'calc(100vw - 48px)',
          height: 560, maxHeight: 'calc(100vh - 120px)',
          background: '#0c1f15',
          borderRadius: 20, border: '1px solid rgba(201,169,110,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column',
          zIndex: 9998, overflow: 'hidden',
          animation: 'ag-slideup 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* ── HEADER ── */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg,#1c4a35 0%,#0d2b1f 100%)',
            borderBottom: '1px solid rgba(201,169,110,0.15)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(201,169,110,0.12)', border: '2px solid rgba(201,169,110,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>🤖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Sofia</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>
                Agency Group · AMI 22506
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'ag-pulse 2s infinite' }} />
              <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>Online</span>
            </div>
          </div>

          {/* ── MESSAGES ── */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 14px 4px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'ag-fadein 0.2s ease',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'rgba(28,74,53,0.5)',
                    border: '1px solid rgba(201,169,110,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, flexShrink: 0, marginRight: 7, alignSelf: 'flex-end',
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#1c4a35,#2d6b50)'
                    : 'rgba(255,255,255,0.06)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(28,74,53,0.6)'
                    : '1px solid rgba(255,255,255,0.07)',
                  color: '#fff', fontSize: 13, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                  {loading && i === messages.length - 1 && msg.role === 'assistant' && msg.content === '' && (
                    <span style={{ display: 'flex', gap: 4, padding: '2px 0' }}>
                      {[0,1,2].map(j => (
                        <span key={j} style={{
                          width: 6, height: 6, borderRadius: '50%', background: '#c9a96e',
                          display: 'inline-block',
                          animation: `ag-bounce 1s infinite ${j * 0.15}s`,
                        }} />
                      ))}
                    </span>
                  )}
                  {loading && i === messages.length - 1 && msg.role === 'assistant' && msg.content !== '' && (
                    <span style={{
                      display: 'inline-block', width: 2, height: 13, background: '#c9a96e',
                      marginLeft: 2, verticalAlign: 'middle', animation: 'ag-blink 1s infinite',
                    }} />
                  )}
                </div>
              </div>
            ))}

            {/* Quick replies */}
            {showQuickReplies && !loading && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2, paddingLeft: 35 }}>
                {QUICK_REPLIES.map(qr => (
                  <button
                    key={qr.label}
                    type="button"
                    onClick={() => sendMessage(qr.msg)}
                    className="ag-qr"
                    style={{
                      padding: '6px 11px', borderRadius: 20,
                      border: '1px solid rgba(201,169,110,0.3)',
                      background: 'rgba(201,169,110,0.06)',
                      color: '#c9a96e', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── INPUT ── */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.25)', display: 'flex', gap: 8,
            alignItems: 'center', flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Escreva uma mensagem..."
              disabled={loading}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                padding: '9px 14px', color: '#fff', fontSize: 13, outline: 'none',
                opacity: loading ? 0.5 : 1, transition: 'border-color 0.15s ease',
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="ag-send"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg,#c9a96e,#e0c08a)'
                  : 'rgba(255,255,255,0.07)',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                fontSize: 15, transition: 'all 0.15s ease', flexShrink: 0,
                color: input.trim() && !loading ? '#0c1f15' : 'rgba(255,255,255,0.3)',
              }}
            >
              ➤
            </button>
          </div>

          {/* Footer */}
          <div style={{
            padding: '5px 14px 7px', textAlign: 'center',
            fontSize: 10, color: 'rgba(255,255,255,0.18)', flexShrink: 0,
            letterSpacing: '0.02em',
          }}>
            Sofia AI · Agency Group · agencygroup.pt
          </div>
        </div>
      )}
    </>
  )
}
