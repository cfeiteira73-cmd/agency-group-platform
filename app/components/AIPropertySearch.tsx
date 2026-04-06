'use client'
import { useState, useRef, useEffect } from 'react'

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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Check Web Speech API support on mount (client-only)
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    setVoiceSupported(!!SpeechRecognitionAPI)
  }, [])

  async function handleSearch(searchQuery?: string) {
    const q = (searchQuery ?? query).trim()
    if (!q) return

    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError('')
    setResults(null)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, language: 'pt' }),
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

      // Auto-search on final result
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false)
        void handleSearch(transcript)
      }
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

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
      className="w-full max-w-4xl mx-auto px-4 py-8"
      aria-label="Pesquisa inteligente de imóveis por linguagem natural"
    >
      {/* Search input */}
      <div className="relative pb-2">
        <div className="flex items-center gap-3 bg-white border-2 border-[#1c4a35] rounded-2xl px-5 py-4 shadow-xl focus-within:border-[#c9a96e] transition-colors">
          <svg
            className="w-5 h-5 text-[#1c4a35] flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o imóvel que procura em linguagem natural..."
            className="flex-1 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            aria-label="Pesquisa de imóveis por linguagem natural"
            autoComplete="off"
          />
          {/* Microphone button — voice search */}
          {voiceSupported && (
            <button
              type="button"
              onClick={isListening ? stopVoiceSearch : startVoiceSearch}
              className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'text-gray-400 hover:text-[#1c4a35] hover:bg-gray-50'
              }`}
              aria-label={isListening ? 'Parar gravação de voz' : 'Pesquisar por voz'}
              aria-pressed={isListening}
            >
              {/* Pulse rings when listening */}
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" aria-hidden="true" />
                  <span className="absolute inset-0 rounded-full bg-red-300 animate-pulse opacity-20" aria-hidden="true" />
                </>
              )}
              {/* Microphone / Stop SVG */}
              <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {isListening ? (
                  // Stop icon
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                ) : (
                  // Mic icon
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                )}
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={loading || !query.trim()}
            className="bg-[#1c4a35] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#2d6b4f] disabled:opacity-50 transition-colors flex items-center gap-2"
            aria-label="Pesquisar imóveis"
          >
            {loading ? (
              <span
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            ) : (
              <span>Pesquisar</span>
            )}
          </button>
        </div>

        {/* Listening indicator — shown while recording */}
        {isListening && (
          <div className="absolute -bottom-1 left-0 right-0 text-center" aria-live="assertive">
            <span className="text-xs text-red-500 font-medium animate-pulse">
              🎙️ A ouvir... fale agora
            </span>
          </div>
        )}

        {/* Sofia AI badge */}
        <div
          className="absolute -top-3 right-4 bg-[#c9a96e] text-white text-xs font-bold px-3 py-1 rounded-full"
          aria-hidden="true"
        >
          ✦ Sofia AI
        </div>
      </div>

      {/* Example queries — shown when no results yet */}
      {!results && !loading && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Exemplos de pesquisa">
          {EXAMPLE_QUERIES.map(eq => (
            <button
              key={eq}
              type="button"
              onClick={() => handleExampleClick(eq)}
              className="text-sm text-[#1c4a35] border border-[#1c4a35]/30 hover:border-[#c9a96e] hover:text-[#c9a96e] px-3 py-1.5 rounded-full transition-colors"
            >
              {eq}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 text-red-600 text-sm text-center" role="alert">
          {error}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div
          className="mt-8 text-center text-[#1c4a35]"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="inline-block w-8 h-8 border-[3px] border-[#1c4a35] border-t-transparent rounded-full animate-spin mb-3"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">Sofia está a analisar o seu pedido...</p>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="mt-6" aria-live="polite">
          {/* AI-generated summary */}
          {results.aiMessage && (
            <div className="bg-[#f4f0e6] border-l-4 border-[#c9a96e] rounded-r-xl px-5 py-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-[#c9a96e] text-xl flex-shrink-0" aria-hidden="true">
                  ✦
                </span>
                <p className="text-sm text-[#1c4a35] leading-relaxed">{results.aiMessage}</p>
              </div>
            </div>
          )}

          {/* Results count */}
          <p className="text-sm text-gray-500 mb-4">
            {results.totalFound === 0
              ? 'Nenhuma propriedade encontrada. Tente ajustar a pesquisa.'
              : `${results.totalFound} propriedade${results.totalFound !== 1 ? 's' : ''} encontrada${results.totalFound !== 1 ? 's' : ''}`}
          </p>

          {/* Property cards */}
          {results.results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.results.map(property => (
                <a
                  key={property.id}
                  href={`/imoveis/${property.id}`}
                  className="group block bg-white rounded-2xl border border-gray-100 hover:border-[#c9a96e] hover:shadow-lg transition-all overflow-hidden"
                  aria-label={`${property.title} — ${formatPrice(property.price)} — ${property.zone}`}
                >
                  {/* Gradient header (placeholder image) */}
                  <div className="h-44 bg-gradient-to-br from-[#1c4a35] to-[#2d6b4f] relative flex items-end p-4">
                    <span className="text-white/50 text-xs absolute top-3 right-3 bg-white/10 px-2 py-1 rounded-full">
                      {property.type}
                    </span>
                    <div>
                      <p className="text-[#c9a96e] text-xl font-bold">
                        {formatPrice(property.price)}
                      </p>
                      <p className="text-white/80 text-xs">{property.zone}</p>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-[#1c4a35] text-sm group-hover:text-[#c9a96e] transition-colors line-clamp-1">
                      {property.title}
                    </h3>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">
                      {property.description}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <span className="text-xs text-gray-400">
                        {property.bedrooms}Q · {property.area}m²
                      </span>
                      <span className="text-xs font-semibold text-[#c9a96e]">
                        {property.rentalYield}% yield
                      </span>
                    </div>

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-1 mt-2" aria-label="Características">
                      {property.features.slice(0, 3).map(f => (
                        <span
                          key={f}
                          className="text-xs bg-[#f4f0e6] text-[#1c4a35] px-2 py-0.5 rounded-full"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* CTA to full portfolio */}
          <div className="mt-6 text-center">
            <a
              href="/imoveis"
              className="text-sm text-[#1c4a35] hover:text-[#c9a96e] underline transition-colors"
            >
              Ver todos os imóveis →
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
