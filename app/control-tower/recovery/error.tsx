'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RecoveryError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[CT Error Boundary]', error)
  }, [error])

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="bg-[#1A1A24] border border-red-900/40 rounded-xl p-8 max-w-md w-full text-center space-y-4">
        <div className="text-3xl">⚠</div>
        <h2 className="text-base font-semibold text-red-300">
          Recovery unavailable
        </h2>
        <p className="text-sm text-slate-500">
          {error.message || 'An unexpected error occurred loading this section.'}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-slate-700">
            ref: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
