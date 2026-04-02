'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTED = [
  'Show me properties in Lisbon under €2M',
  'Que imóveis têm em Cascais?',
  'What is the NHR tax regime?',
  'Quelles propriétés avez-vous en Algarve?',
]

const GREETING = 'Olá! Sou a Sofia, consultora da Agency Group. Posso ajudar a encontrar o seu imóvel ideal em Portugal, explicar o processo de compra, o regime NHR/IFICI e muito mais. Em que posso ajudar?'

export default function AvatarWidget() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'avatar' | 'chat'>('chat') // start as chat, upgrade to avatar when ready
  const [avatarReady, setAvatarReady] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: GREETING }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [unread, setUnread] = useState(1)
  const [avatarSpeaking, setAvatarSpeaking] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ─── Start HeyGen streaming session ───────────────────────────────────────
  const startAvatar = useCallback(async () => {
    if (avatarReady || avatarLoading) return
    setAvatarLoading(true)

    try {
      // 1. Create session via our proxy (keeps API key server-side)
      const sessionRes = await fetch('/api/heygen/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality: 'medium' }),
      })

      if (!sessionRes.ok) {
        console.warn('HeyGen not configured — falling back to chat mode')
        setMode('chat')
        setAvatarLoading(false)
        return
      }

      const sessionData = await sessionRes.json()
      if (!sessionData?.data?.session_id) {
        setMode('chat')
        setAvatarLoading(false)
        return
      }

      const { session_id, sdp: offerSDP, ice_servers2: iceServers } = sessionData.data
      setSessionId(session_id)

      // 2. Set up WebRTC peer connection
      const pc = new RTCPeerConnection({ iceServers: iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] })
      peerRef.current = pc

      // 3. Handle incoming video/audio track
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0]
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setAvatarReady(true)
          setAvatarLoading(false)
          setMode('avatar')
          // Send initial greeting via avatar
          speakText(session_id, GREETING)
        }
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setMode('chat')
          setAvatarReady(false)
        }
      }

      // 4. Set remote offer + create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offerSDP))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // 5. Send answer back to HeyGen
      await fetch('/api/heygen/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          sessionId: session_id,
          sdp: answer,
        }),
      })

    } catch (err) {
      console.error('Avatar init error:', err)
      setMode('chat')
      setAvatarLoading(false)
    }
  }, [avatarReady, avatarLoading])

  // ─── Make avatar speak ──────────────────────────────────────────────────────
  const speakText = useCallback(async (sid: string, text: string) => {
    if (!sid) return
    setAvatarSpeaking(true)
    try {
      await fetch('/api/heygen/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, text }),
      })
    } finally {
      // Give it time to finish speaking (rough estimate)
      setTimeout(() => setAvatarSpeaking(false), text.length * 60 + 1000)
    }
  }, [])

  // ─── Stop avatar session ────────────────────────────────────────────────────
  const stopAvatar = useCallback(async () => {
    if (sessionId) {
      await fetch('/api/heygen/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    }
    peerRef.current?.close()
    peerRef.current = null
    setSessionId(null)
    setAvatarReady(false)
    setMode('chat')
    if (videoRef.current) videoRef.current.srcObject = null
  }, [sessionId])

  // ─── Send message to Sofia (Claude) ────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    const userMsg = text.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages.filter(m => m.content), { role: 'user', content: userMsg }] }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('API error')

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
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const json = JSON.parse(data)
              const delta = json.delta?.text ?? json.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                fullText += delta
                setMessages(prev => {
                  const msgs = [...prev]
                  msgs[msgs.length - 1] = { role: 'assistant', content: fullText }
                  return msgs
                })
              }
            } catch { /* ignore */ }
          }
        }
      }

      // If avatar is active, make it speak the response
      if (avatarReady && sessionId && fullText) {
        // Strip markdown for cleaner speech
        const speechText = fullText
          .replace(/\*\*/g, '').replace(/\*/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/#+\s/g, '').replace(/`/g, '')
          .slice(0, 500) // HeyGen has limits
        speakText(sessionId, speechText)
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = { role: 'assistant', content: 'Desculpe, ocorreu um erro. Contacte-nos pelo WhatsApp.' }
          return msgs
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, streaming, avatarReady, sessionId, speakText])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const G = '#c9a96e'

  return (
    <>
      {/* ── FAB ── */}
      <button
        onClick={() => { setOpen(o => !o); if (!open && mode === 'avatar') startAvatar() }}
        aria-label="Falar com Sofia"
        style={{
          position: 'fixed', bottom: '80px', right: '24px', zIndex: 900,
          width: 56, height: 56, background: G, border: 'none', borderRadius: '50%',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(201,169,110,.45)', transition: 'transform .2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0c1f15" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c1f15" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
        {!open && unread > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#e74c3c', color: '#fff', width: 18, height: 18, borderRadius: '50%', fontSize: '.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</div>
        )}
      </button>

      {/* ── CHAT/AVATAR PANEL ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 148, right: 24, zIndex: 901,
          width: mode === 'avatar' ? 400 : 360, maxWidth: 'calc(100vw - 48px)',
          background: '#0a1a10', border: '1px solid rgba(201,169,110,.25)',
          boxShadow: '0 16px 60px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: 'column',
          maxHeight: mode === 'avatar' ? 600 : 520,
          animation: 'fadeInUp .25s ease',
          transition: 'width .3s, max-height .3s',
        }}>
          <style>{`
            @keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
            .chat-msg { animation: fadeInUp .2s ease; }
            .typing-dot { animation: blink 1.2s infinite; }
            .typing-dot:nth-child(2) { animation-delay:.2s; }
            .typing-dot:nth-child(3) { animation-delay:.4s; }
            @keyframes blink { 0%,80%,100% { opacity:.2; } 40% { opacity:1; } }
            .speaking-ring { animation: pulse 1.5s ease-in-out infinite; }
            @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(201,169,110,.4); } 50% { box-shadow:0 0 0 8px rgba(201,169,110,0); } }
          `}</style>

          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,169,110,.12)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div className={avatarSpeaking ? 'speaking-ring' : ''} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #c9a96e, #a07840)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
            }}>
              {mode === 'avatar' && avatarReady ? '🎥' : '🤖'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Jost', sans-serif", fontWeight: 600, fontSize: '.75rem', color: '#f4f0e6' }}>Sofia — Agency Group</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: avatarSpeaking ? '#f39c12' : streaming ? '#f39c12' : '#27ae60' }}/>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.45)' }}>
                  {avatarSpeaking ? 'A falar...' : streaming ? 'A escrever...' : avatarLoading ? 'A iniciar avatar...' : 'Online'}
                </span>
              </div>
            </div>

            {/* Avatar toggle button */}
            <button
              onClick={() => {
                if (mode === 'avatar') { stopAvatar() }
                else { startAvatar() }
              }}
              title={mode === 'avatar' ? 'Desactivar avatar' : 'Activar avatar de vídeo'}
              style={{
                background: mode === 'avatar' ? 'rgba(201,169,110,.15)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${mode === 'avatar' ? 'rgba(201,169,110,.4)' : 'rgba(255,255,255,.1)'}`,
                color: mode === 'avatar' ? G : 'rgba(244,240,230,.4)',
                padding: '4px 8px', cursor: 'pointer', fontSize: '.45rem', letterSpacing: '.08em',
                fontFamily: "'Jost', sans-serif", flexShrink: 0,
              }}
            >
              {avatarLoading ? '⏳' : mode === 'avatar' ? '📹 VÍDEO ON' : '📹 VÍDEO'}
            </button>

            <a href="https://wa.me/351919948986?text=Olá, gostaria de falar com um consultor" target="_blank" rel="noopener noreferrer"
              style={{ background: '#25D366', color: '#fff', padding: '5px 10px', fontFamily: "'Jost', sans-serif", fontSize: '.5rem', fontWeight: 700, letterSpacing: '.1em', textDecoration: 'none', flexShrink: 0 }}>
              WA
            </a>
          </div>

          {/* ── VIDEO section (avatar mode) ── */}
          {mode === 'avatar' && (
            <div style={{ position: 'relative', background: '#000', flexShrink: 0, height: 220 }}>
              <video
                ref={videoRef}
                autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {avatarLoading && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(0,0,0,.8)',
                }}>
                  <div style={{ width: 40, height: 40, border: `3px solid rgba(201,169,110,.3)`, borderTopColor: G, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '.7rem', color: 'rgba(244,240,230,.5)', fontFamily: "'Jost', sans-serif" }}>A iniciar avatar...</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              {avatarSpeaking && (
                <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.6)', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} style={{ width: 3, background: G, borderRadius: 2, animation: `soundbar 0.8s ease-in-out infinite`, animationDelay: `${i * 0.15}s`, height: 8 }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '.55rem', color: 'rgba(244,240,230,.7)', fontFamily: "'Jost', sans-serif" }}>Sofia</span>
                  <style>{`@keyframes soundbar { 0%,100% { height:4px; } 50% { height:14px; } }`}</style>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} className="chat-msg" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%',
                  background: msg.role === 'user' ? G : 'rgba(255,255,255,.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(201,169,110,.12)',
                  padding: '9px 13px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.68rem', lineHeight: 1.55,
                  color: msg.role === 'user' ? '#0c1f15' : '#f4f0e6', whiteSpace: 'pre-wrap',
                }}>
                  {msg.content || (streaming && i === messages.length - 1
                    ? <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {[0,1,2].map(j => <span key={j} className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(244,240,230,.4)', display: 'inline-block' }}/>)}
                      </span>
                    : '—'
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SUGGESTED.slice(0, 4).map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.2)',
                  color: 'rgba(201,169,110,.85)', padding: '5px 9px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.52rem', cursor: 'pointer', textAlign: 'left',
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(201,169,110,.12)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Escreva a sua pergunta..."
              disabled={streaming}
              style={{
                flex: 1, background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(201,169,110,.2)', color: '#f4f0e6',
                padding: '9px 11px', fontFamily: "'Jost', sans-serif", fontSize: '.68rem', outline: 'none',
              }}
            />
            <button onClick={() => send(input)} disabled={streaming || !input.trim()} style={{
              background: input.trim() && !streaming ? G : 'rgba(201,169,110,.2)',
              border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
              padding: '0 12px', transition: 'background .2s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !streaming ? '#0c1f15' : 'rgba(201,169,110,.4)'} strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
