// AGENCY GROUP — SH-ROS Control Tower: Recovery Loading Skeleton
export default function RecoveryLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-[#1A1A24] rounded animate-pulse" />
            <div className="h-3 w-80 bg-[#1A1A24] rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-[#1A1A24] rounded animate-pulse" />
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-5 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Recovery rows skeleton */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="h-4 w-40 bg-[#1A1A24] rounded animate-pulse" />
          </div>
          <div className="divide-y divide-slate-800/50">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="h-12 bg-[#1A1A24] rounded border border-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
