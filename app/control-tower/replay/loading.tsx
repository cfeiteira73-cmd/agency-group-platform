// app/control-tower/replay/loading.tsx
// Route-level loading state for the Replay Console
// Shown by Next.js App Router while the page RSC is streaming in

import { ReplaySkeleton } from './page'

export default function ReplayLoading() {
  return (
    <div className="space-y-6">
      {/* Static header mirrors the real page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Replay Console</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Event replay · DLQ recovery · Historical corridor replay
          </p>
        </div>
      </div>

      <ReplaySkeleton />
    </div>
  )
}
