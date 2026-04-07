'use client'

interface Props {
  isSemanticSearch: boolean
  similarity?: number
}

export function SemanticSearchBadge({ isSemanticSearch, similarity }: Props) {
  if (!isSemanticSearch) return null
  return (
    <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 w-fit">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z"/>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd"/>
      </svg>
      <span>Pesquisa semântica IA</span>
      {similarity && (
        <span className="font-semibold">{Math.round(similarity * 100)}% relevância</span>
      )}
    </div>
  )
}
