// AGENCY GROUP — SH-ROS Control Tower: Incidents Loading Skeleton
export default function IncidentsLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="h-8 w-64 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-96 bg-[#1A1A24] rounded animate-pulse" />
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Incident list skeleton */}
        <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <div className="h-4 w-32 bg-[#1A1A24] rounded animate-pulse" />
          </div>
          <div className="space-y-0 divide-y divide-slate-800/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-5 py-4">
                <div className="h-16 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
