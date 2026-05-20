// AGENCY GROUP — SH-ROS Control Tower: Self-Healing Loading Skeleton
export default function SelfHealingLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-48 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-80 bg-[#1A1A24] rounded animate-pulse" />
        {/* KPI cards skeleton (4 cards) */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="h-4 w-44 bg-[#1A1A24] rounded animate-pulse" />
          </div>
          {/* Table header */}
          <div className="px-4 py-2 bg-[#0A0A0F] border-b border-slate-800 flex gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 w-20 bg-[#1A1A24] rounded animate-pulse" />
            ))}
          </div>
          {/* Table rows */}
          <div className="divide-y divide-slate-800/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="h-10 bg-[#1A1A24] rounded border border-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
