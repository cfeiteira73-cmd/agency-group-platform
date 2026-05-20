// AGENCY GROUP — SH-ROS Control Tower: Overview loading skeleton
export default function ControlTowerOverviewLoading() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-1.5">
        <div className="h-5 w-36 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-3 w-56 bg-[#1A1A24] rounded animate-pulse" />
      </div>

      {/* KPI row — 4 cols */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>

      {/* Sparkline + status — 2 cols */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        <div className="h-32 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      </div>

      {/* System layers — 7 cols */}
      <div>
        <div className="h-3 w-40 bg-[#1A1A24] rounded animate-pulse mb-3" />
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
