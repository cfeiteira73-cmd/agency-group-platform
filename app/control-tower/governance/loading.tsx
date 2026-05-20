// AGENCY GROUP — SH-ROS Control Tower: Governance Loading Skeleton
export default function GovernanceLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-48 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-72 bg-[#1A1A24] rounded animate-pulse" />
        {/* KPI stat cards skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Grid panels skeleton */}
        <div className="grid grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Token governor skeleton */}
        <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        {/* Table rows skeleton */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="h-4 w-40 bg-[#1A1A24] rounded animate-pulse" />
          </div>
          <div className="space-y-0 divide-y divide-slate-800/50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-3">
                <div className="h-10 bg-[#1A1A24] rounded border border-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
