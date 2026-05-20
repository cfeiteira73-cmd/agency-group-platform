// app/control-tower/economics/[tenant_id]/loading.tsx
// Route-level loading state for the Per-Tenant Economics Drill-Down
// Shown by Next.js App Router while the page RSC is streaming in

import { EconomicsSkeleton } from './page'

export default function EconomicsLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 font-mono">
      {/* Back link placeholder */}
      <div className="inline-flex items-center gap-2 text-xs text-slate-700 mb-6">
        ← All Tenants
      </div>

      {/* Static header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-900" />
          <span className="text-xs text-slate-700 uppercase tracking-widest">SH-ROS Control Tower</span>
        </div>
        <div className="h-8 w-64 bg-zinc-800/50 rounded animate-pulse" />
      </div>

      <EconomicsSkeleton />
    </div>
  )
}
