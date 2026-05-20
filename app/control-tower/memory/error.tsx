'use client'

import { useEffect } from 'react'

export default function MemoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[CT] Memory error:', error) }, [error])
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="bg-[#1A1A24] border border-red-900/40 rounded-xl p-8 max-w-md w-full text-center space-y-4">
        <div className="text-3xl">⚠</div>
        <h2 className="text-base font-semibold text-red-300">Memory unavailable</h2>
        <p className="text-sm text-slate-500">{error.message || 'Failed to load this section.'}</p>
        {error.digest && <p className="text-[10px] font-mono text-slate-700">ref: {error.digest}</p>}
        <button type="button" onClick={reset} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors">
          Try again
        </button>
      </div>
    </div>
  )
}
