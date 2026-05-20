// AGENCY GROUP — SH-ROS Control Tower: Economics loading skeleton
export default function EconomicsLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] p-8">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#1A1A24] animate-pulse" />
          <div className="h-3 w-40 bg-[#1A1A24] rounded animate-pulse" />
        </div>
        <div className="h-7 w-48 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-3 w-72 bg-[#1A1A24] rounded animate-pulse" />
      </div>

      {/* KPI row — 4 cols */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Revenue vs Cost bar */}
      <div className="h-16 bg-[#111118] border border-white/5 rounded-lg animate-pulse mb-6" />

      {/* Cost breakdown + usage — 2 cols */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="h-56 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
        <div className="h-56 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
      </div>

      {/* Revenue vs cost summary */}
      <div className="h-32 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
    </div>
  )
}
