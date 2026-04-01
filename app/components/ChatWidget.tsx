'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'Qual o processo de compra em Portugal?',
  'Qual a rentabilidade em Cascais?',
  'O que é o regime NHR/IFICI?',
  'Quanto é a vossa comissão?',
  'Que imóveis têm em Lisboa até €1M?',
  'Quais as zonas mais valorizadas?',
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou a Sofia, consultora digital da Agency Group 🇵🇹\n\nPosso ajudá-lo a encontrar o imóvel ideal em Portugal, responder sobre o processo de compra, rentabilidades e muito mais.\n\nEm que posso ajudar?' }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [unread, setUnread] = useState(1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    const userMsg = text.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.filter(m => m.content),
            { role: 'user', content: userMsg }
          ]
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const json = JSON.parse(data)
              const delta = json.delta?.text ?? json.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                setMessages(prev => {
                  const msgs = [...prev]
                  msgs[msgs.length - 1] = {
                    role: 'assistant',
                    content: msgs[msgs.length - 1].content + delta
                  }
                  return msgs
                })
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: 'Desculpe, ocorreu um erro. Por favor contacte-nos diretamente pelo WhatsApp.'
          }
          return msgs
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, streaming])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Falar com Sofia"
        style={{
          position: 'fixed', bottom: '80px', right: '24px', zIndex: 900,
          width: '56px', height: '56px',
          background: '#c9a96e',
          border: 'none', borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(201,169,110,.45)',
          transition: 'transform .2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0c1f15" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c1f15" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#e74c3c', color: '#fff',
            width: '18px', height: '18px', borderRadius: '50%',
            fontSize: '.5rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono', monospace",
          }}>{unread}</div>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '148px', right: '24px', zIndex: 901,
          width: '360px', maxWidth: 'calc(100vw - 48px)',
          background: '#0a1a10',
          border: '1px solid rgba(201,169,110,.25)',
          boxShadow: '0 16px 60px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '520px',
          animation: 'fadeInUp .25s ease',
        }}>
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .chat-msg { animation: fadeInUp .2s ease; }
            .typing-dot { animation: blink 1.2s infinite; }
            .typing-dot:nth-child(2) { animation-delay: .2s; }
            .typing-dot:nth-child(3) { animation-delay: .4s; }
            @keyframes blink { 0%,80%,100% { opacity: .2; } 40% { opacity: 1; } }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(201,169,110,.12)',
            display: 'flex', alignItems: 'center', gap: '12px',
            flexShrink: 0,
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #c9a96e, #a07840)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', flexShrink: 0,
            }}>🤖</div>
            <div>
              <div style={{
                fontFamily: "'Jost', sans-serif", fontWeight: 600,
                fontSize: '.75rem', color: '#f4f0e6',
              }}>Sofia — Agency Group</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: streaming ? '#f39c12' : '#27ae60',
                }}/>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.42rem',
                  letterSpacing: '.1em', color: 'rgba(244,240,230,.45)',
                }}>{streaming ? 'A escrever...' : 'Online'}</span>
              </div>
            </div>
            <a
              href="https://wa.me/351919948986?text=Olá, gostaria de falar com um consultor"
              target="_blank" rel="noopener noreferrer"
              style={{
                marginLeft: 'auto',
                background: '#25D366', color: '#fff',
                padding: '5px 10px',
                fontFamily: "'Jost', sans-serif", fontSize: '.5rem',
                fontWeight: 700, letterSpacing: '.1em',
                textDecoration: 'none', flexShrink: 0,
              }}
            >WA</a>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} className="chat-msg" style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user'
                    ? '#c9a96e'
                    : 'rgba(255,255,255,.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(201,169,110,.12)',
                  padding: '10px 14px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
                  lineHeight: 1.55,
                  color: msg.role === 'user' ? '#0c1f15' : '#f4f0e6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content || (streaming && i === messages.length - 1 ? (
                    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(244,240,230,.4)', display: 'inline-block' }}/>
                      <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(244,240,230,.4)', display: 'inline-block' }}/>
                      <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(244,240,230,.4)', display: 'inline-block' }}/>
                    </span>
                  ) : '—')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when not yet chatted) */}
          {messages.length <= 1 && (
            <div style={{
              padding: '0 12px 12px',
              display: 'flex', flexWrap: 'wrap', gap: '6px',
            }}>
              {SUGGESTED.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: 'rgba(201,169,110,.08)',
                  border: '1px solid rgba(201,169,110,.2)',
                  color: 'rgba(201,169,110,.85)',
                  padding: '5px 10px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.55rem',
                  cursor: 'pointer', textAlign: 'left',
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(201,169,110,.12)',
            display: 'flex', gap: '8px', flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escreva a sua pergunta..."
              disabled={streaming}
              style={{
                flex: 1, background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(201,169,110,.2)',
                color: '#f4f0e6', padding: '10px 12px',
                fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              style={{
                background: input.trim() && !streaming ? '#c9a96e' : 'rgba(201,169,110,.2)',
                border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
                padding: '0 14px',
                transition: 'background .2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() && !streaming ? '#0c1f15' : 'rgba(201,169,110,.4)'}
                strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
