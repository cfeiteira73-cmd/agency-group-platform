// app/control-tower/graph/loading.tsx
// Route-level loading state for the Causal Graph Explorer
// Shown by Next.js App Router while the page RSC is streaming in

import { GraphSkeleton } from './page'

export default function GraphLoading() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0a0a0f] text-slate-100">
      {/* Static header mirrors the real page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Causal Graph Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Revenue attribution · Root cause · Agent decisions
          </p>
        </div>
      </div>

      <GraphSkeleton />
    </div>
  )
}
