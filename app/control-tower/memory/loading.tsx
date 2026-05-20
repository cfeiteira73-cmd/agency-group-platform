// AGENCY GROUP — SH-ROS Control Tower: Memory loading skeleton
export default function MemoryLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="h-5 w-36 bg-[#1A1A24] rounded animate-pulse" />
          <div className="h-3 w-56 bg-[#1A1A24] rounded animate-pulse" />
        </div>

        {/* Memory tier cards — 3 cols */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Learning engine */}
        <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

        {/* Sparkline */}
        <div className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

        {/* Memory flow */}
        <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      </div>
    </div>
  )
}
