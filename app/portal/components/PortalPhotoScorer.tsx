'use client'

import { useState } from 'react'

interface PhotoResult {
  overall_score: number
  photo_count: number
  value_impact_pct: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendations: string[]
  scores: Array<{
    url: string; quality: number; staging: number; issues: string[]; strengths: string[]
  }>
}

const GRADE_COLORS = {
  A: 'text-green-700 bg-green-50 border-green-200',
  B: 'text-blue-700 bg-blue-50 border-blue-200',
  C: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  D: 'text-orange-700 bg-orange-50 border-orange-200',
  F: 'text-red-700 bg-red-50 border-red-200',
}

export function PortalPhotoScorer() {
  const [urls, setUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PhotoResult | null>(null)
  const [error, setError] = useState('')

  async function analyzePhotos() {
    const photos = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'))
    if (photos.length === 0) {
      setError('Adiciona pelo menos 1 URL de foto válida (https://...)')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/avm/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult(await res.json() as PhotoResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na análise')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c9a96e] to-[#a8843a] flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Avaliação de Fotos IA</h2>
          <p className="text-sm text-gray-500">Impacto das fotos no valor do imóvel</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="photo-urls" className="block text-sm font-medium text-gray-700 mb-2">
            URLs das fotos (1 por linha, máx. 8)
          </label>
          <textarea
            id="photo-urls"
            value={urls}
            onChange={e => setUrls(e.target.value)}
            rows={4}
            placeholder="https://images.supabase.co/foto1.jpg&#10;https://images.supabase.co/foto2.jpg"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#c9a96e]"
            disabled={loading}
          />
        </div>

        <button
          type="button"
          onClick={analyzePhotos}
          disabled={loading}
          className="w-full bg-[#c9a96e] text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-[#a8843a] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          aria-busy={loading}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              A analisar fotos...
            </>
          ) : 'Analisar Fotos'}
        </button>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {result && (
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-3">
              <div className={`text-center p-3 rounded-xl border ${GRADE_COLORS[result.grade]}`}>
                <p className="text-3xl font-black">{result.grade}</p>
                <p className="text-xs font-medium mt-1">Classificação</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-800">{result.overall_score}</p>
                <p className="text-xs text-gray-500">Score /100</p>
              </div>
              <div className={`text-center p-3 rounded-xl ${result.value_impact_pct >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-2xl font-bold ${result.value_impact_pct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {result.value_impact_pct >= 0 ? '+' : ''}{result.value_impact_pct.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Impacto valor</p>
              </div>
            </div>

            {result.recommendations.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">Recomendações</h3>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                      <span aria-hidden="true">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
