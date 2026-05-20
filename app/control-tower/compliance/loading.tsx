// AGENCY GROUP — SH-ROS Control Tower: Compliance loading skeleton
export default function ComplianceLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-28 bg-[#1A1A24] rounded animate-pulse" />
            <div className="h-3 w-64 bg-[#1A1A24] rounded animate-pulse" />
          </div>
        </div>

        {/* SOC2 banner */}
        <div className="h-14 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

        {/* Policy violations / passing banner */}
        <div className="h-12 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />

        {/* 2×2 module grid */}
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Audit entries table */}
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
