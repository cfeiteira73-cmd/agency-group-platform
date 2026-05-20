'use client'

import { useEffect } from 'react'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[CT/settings]', error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div className="bg-[#111118] border border-red-800/40 rounded-lg p-6 max-w-md w-full text-center space-y-3">
        <div className="text-2xl">⚙</div>
        <p className="text-red-400 text-sm font-medium">Settings failed to load</p>
        <p className="text-slate-500 text-xs font-mono">{error.message || 'Unexpected error'}</p>
        {error.digest && (
          <p className="text-slate-700 text-[10px] font-mono">digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
