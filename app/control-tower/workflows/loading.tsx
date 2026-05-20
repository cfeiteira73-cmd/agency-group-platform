// AGENCY GROUP — SH-ROS Control Tower: Workflows loading skeleton
export default function WorkflowsLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-24 bg-[#1A1A24] rounded animate-pulse" />
            <div className="h-3 w-52 bg-[#1A1A24] rounded animate-pulse" />
          </div>
        </div>

        {/* KPI row — 5 cols */}
        <div className="grid grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Registered workflows grid */}
        <div className="h-32 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

        {/* Recent runs table */}
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
