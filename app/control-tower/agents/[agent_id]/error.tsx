'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AgentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[CT/agents/[agent_id]]', error) }, [error])

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500 font-mono">
        <Link href="/control-tower/agents" className="hover:text-slate-300 transition-colors">
          ← Agents
        </Link>
      </div>
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="bg-[#111118] border border-red-800/40 rounded-lg p-6 max-w-md w-full text-center space-y-3">
          <div className="text-2xl">🤖</div>
          <p className="text-red-400 text-sm font-medium">Agent detail failed to load</p>
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
    </div>
  )
}
