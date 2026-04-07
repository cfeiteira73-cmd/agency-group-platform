'use client'
import { useState, useRef, useEffect } from 'react'
import { getOrCreateSessionId } from '@/lib/session'

interface Property {
  id: string
  title: string
  type: string
  zone: string
  area: number
  bedrooms: number
  price: number
  pricePerSqm: number
  features: string[]
  description: string
  rentalYield: number
}

interface SearchResult {
  results: Property[]
  totalFound: number
  aiMessage: string
  criteria: Record<string, unknown>
}

const EXAMPLE_QUERIES = [
  'Villa com piscina em Cascais até €3M',
  'Apartamento T2 em Lisboa para rendimento',
  'Algo como a Comporta mas mais barato',
  'Moradia familiar no Algarve com jardim',
  '€2M villa near Cascais golf course',
  'Penthouse Lisboa vista rio',
]

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    const val = price / 1_000_000
    return `€${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`
  }
  return `€${Math.round(price / 1000)}K`
}

export function AIPropertySearch() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const inputRef    = useRef<HTMLInputElement>(null)
  const abortRef    = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    setVoiceSupported(!!SpeechRecognitionAPI)
  }, [])

  async function handleSearch(searchQuery?: string) {
    const q = (searchQuery ?? query).trim()
    if (!q) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, language: 'pt', sessionId: getOrCreateSessionId() }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Search failed')
      }
      const data = await res.json() as SearchResult
      setResults(data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Erro na pesquisa. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  function startVoiceSearch() {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition as typeof SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof SpeechRecognition
    if (!SpeechRecognitionAPI) return
    const recognition = new SpeechRecognitionAPI()
    recognitionRef.current = recognition
    recognition.lang = 'pt-PT'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript).join('')
      setQuery(transcript)
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false)
        void handleSearch(transcript)
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend   = () => setIsListening(false)
    recognition.start()
  }

  function stopVoiceSearch() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void handleSearch()
  }

  function handleExampleClick(eq: string) {
    setQuery(eq)
    void handleSearch(eq)
  }

  return (
    <section
      style={{ width: '100%', maxWidth: '860px', margin: '0 auto', padding: '0 0 8px' }}
      aria-label="Pesquisa inteligente de imóveis por linguagem natural"
    >
      {/* ── Search bar ── */}
      <div style={{ position: 'relative', paddingBottom: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#ffffff',
          border: '2px solid #1c4a35',
          borderRadius: '16px',
          padding: '14px 20px',
          boxShadow: '0 8px 32px rgba(14,14,13,.12), 0 2px 8px rgba(14,14,13,.06)',
          transition: 'border-color .25s',
        }}>
          {/* Lupa */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c4a35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o imóvel que procura em linguagem natural..."
            aria-label="Pesquisa de imóveis por linguagem natural"
            autoComplete="off"
            style={{
              flex: 1,
              fontSize: '1rem',
              color: '#1a1a1a',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              minWidth: 0,
            }}
          />

          {/* Mic button */}
          {voiceSupported && (
            <button
              type="button"
              onClick={isListening ? stopVoiceSearch : startVoiceSearch}
              aria-label={isListening ? 'Parar gravação de voz' : 'Pesquisar por voz'}
              aria-pressed={isListening}
              style={{
                flexShrink: 0,
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: 'none',
                background: isListening ? '#ef4444' : 'transparent',
                color: isListening ? '#fff' : '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background .2s, color .2s',
                position: 'relative',
              }}
            >
              {isListening && (
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.3)',
                  animation: 'ping 1s cubic-bezier(0,0,.2,1) infinite',
                }} aria-hidden="true" />
              )}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }} aria-hidden="true">
                {isListening
                  ? <><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 21a9 9 0 000-18"/></>
                  : <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 01-14 0M12 19v3M9 22h6"/></>
                }
              </svg>
            </button>
          )}

          {/* Search button */}
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={loading || !query.trim()}
            aria-label="Pesquisar imóveis"
            style={{
              flexShrink: 0,
              background: loading || !query.trim() ? 'rgba(28,74,53,.4)' : '#1c4a35',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '.78rem',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              fontWeight: 500,
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background .2s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading
              ? <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-hidden="true" />
              : <span>Pesquisar</span>
            }
          </button>
        </div>

        {/* Listening indicator */}
        {isListening && (
          <div style={{ textAlign: 'center', marginTop: '6px' }} aria-live="assertive">
            <span style={{ fontSize: '.75rem', color: '#ef4444', fontWeight: 500 }}>
              🎙️ A ouvir... fale agora
            </span>
          </div>
        )}

        {/* Sofia AI badge */}
        <div style={{
          position: 'absolute',
          top: '-12px',
          right: '16px',
          background: '#c9a96e',
          color: '#fff',
          fontSize: '.6rem',
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          letterSpacing: '.12em',
          padding: '4px 12px',
          borderRadius: '20px',
        }} aria-hidden="true">
          ✦ Sofia AI
        </div>
      </div>

      {/* ── Example queries ── */}
      {!results && !loading && (
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }} role="group" aria-label="Exemplos de pesquisa">
          {EXAMPLE_QUERIES.map(eq => (
            <button
              key={eq}
              type="button"
              onClick={() => handleExampleClick(eq)}
              style={{
                fontSize: '.78rem',
                color: '#1c4a35',
                border: '1px solid rgba(28,74,53,.25)',
                background: 'transparent',
                padding: '6px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color .2s, color .2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#c9a96e'; (e.currentTarget as HTMLButtonElement).style.color = '#c9a96e' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(28,74,53,.25)'; (e.currentTarget as HTMLButtonElement).style.color = '#1c4a35' }}
            >
              {eq}
            </button>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p style={{ marginTop: '16px', color: '#b03a2e', fontSize: '.85rem', textAlign: 'center' }} role="alert">
          {error}
        </p>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ marginTop: '32px', textAlign: 'center', color: '#1c4a35' }} aria-live="polite" aria-busy="true">
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(28,74,53,.2)', borderTopColor: '#1c4a35', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: '12px' }} aria-hidden="true" />
          <p style={{ fontSize: '.85rem', fontWeight: 500 }}>Sofia está a analisar o seu pedido...</p>
        </div>
      )}

      {/* ── Results ── */}
      {results && !loading && (
        <div style={{ marginTop: '24px' }} aria-live="polite">

          {/* AI summary */}
          {results.aiMessage && (
            <div style={{
              background: '#f4f0e6',
              borderLeft: '4px solid #c9a96e',
              borderRadius: '0 12px 12px 0',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}>
              <span style={{ color: '#c9a96e', fontSize: '1.2rem', flexShrink: 0 }} aria-hidden="true">✦</span>
              <p style={{ fontSize: '.88rem', color: '#1c4a35', lineHeight: 1.65, margin: 0 }}>{results.aiMessage}</p>
            </div>
          )}

          {/* Count */}
          <p style={{ fontSize: '.82rem', color: '#888', marginBottom: '16px' }}>
            {results.totalFound === 0
              ? 'Nenhuma propriedade encontrada. Tente ajustar a pesquisa.'
              : `${results.totalFound} propriedade${results.totalFound !== 1 ? 's' : ''} encontrada${results.totalFound !== 1 ? 's' : ''}`}
          </p>

          {/* Property cards */}
          {results.results.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '16px',
            }}>
              {results.results.map(property => (
                <a
                  key={property.id}
                  href={`/imoveis/${property.id}`}
                  aria-label={`${property.title} — ${formatPrice(property.price)} — ${property.zone}`}
                  style={{
                    display: 'block',
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid rgba(14,14,13,.08)',
                    overflow: 'hidden',
                    textDecoration: 'none',
                    transition: 'border-color .2s, box-shadow .2s, transform .2s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.borderColor = '#c9a96e'
                    el.style.boxShadow = '0 8px 24px rgba(14,14,13,.1)'
                    el.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.borderColor = 'rgba(14,14,13,.08)'
                    el.style.boxShadow = 'none'
                    el.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Card header */}
                  <div style={{
                    height: '160px',
                    background: 'linear-gradient(135deg, #1c4a35 0%, #2d6b4f 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '16px',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: '12px', right: '12px',
                      background: 'rgba(255,255,255,.15)', color: '#fff',
                      fontSize: '.68rem', padding: '3px 10px', borderRadius: '20px',
                    }}>
                      {property.type}
                    </span>
                    <p style={{ color: '#c9a96e', fontSize: '1.25rem', fontWeight: 700, margin: 0, fontFamily: "'DM Mono', monospace" }}>
                      {formatPrice(property.price)}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,.75)', fontSize: '.75rem', margin: '2px 0 0' }}>
                      {property.zone}
                    </p>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '16px' }}>
                    <h3 style={{
                      fontFamily: "'Cormorant', serif",
                      fontSize: '1rem', fontWeight: 600,
                      color: '#1c4a35', margin: '0 0 6px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {property.title}
                    </h3>
                    <p style={{
                      fontSize: '.78rem', color: '#888', margin: '0 0 12px',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {property.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(14,14,13,.06)' }}>
                      <span style={{ fontSize: '.75rem', color: '#aaa' }}>
                        {property.bedrooms}Q · {property.area}m²
                      </span>
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#c9a96e' }}>
                        {property.rentalYield}% yield
                      </span>
                    </div>

                    {/* Feature tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }} aria-label="Características">
                      {property.features.slice(0, 3).map(f => (
                        <span key={f} style={{
                          fontSize: '.68rem', background: '#f4f0e6',
                          color: '#1c4a35', padding: '2px 10px', borderRadius: '20px',
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href="/imoveis" style={{
              fontSize: '.82rem', color: '#1c4a35',
              textDecoration: 'underline', textUnderlineOffset: '3px',
            }}>
              Ver todos os imóveis →
            </a>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0 } }
      `}</style>
    </section>
  )
}
