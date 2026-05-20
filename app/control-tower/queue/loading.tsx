// AGENCY GROUP — SH-ROS Control Tower: Queue loading skeleton
export default function QueueLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-32 bg-[#1A1A24] rounded animate-pulse" />
            <div className="h-3 w-40 bg-[#1A1A24] rounded animate-pulse" />
          </div>
        </div>

        {/* KPI row — 4 cols */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Priority breakdown + sparkline — 2 cols */}
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          <div className="h-40 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        </div>

        {/* DLQ rows — list heavy */}
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
