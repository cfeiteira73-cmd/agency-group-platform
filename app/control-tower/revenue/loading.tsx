// AGENCY GROUP — SH-ROS Control Tower: Revenue loading skeleton
export default function RevenueLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="h-7 w-48 bg-[#1A1A24] rounded animate-pulse" />
          <div className="h-3 w-64 bg-[#1A1A24] rounded animate-pulse" />
        </div>

        {/* KPI row — 4 cols */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Secondary stat row */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Chart / funnel placeholder */}
        <div className="h-64 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

        {/* Table rows */}
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
