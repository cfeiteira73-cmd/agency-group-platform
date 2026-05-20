// AGENCY GROUP — SH-ROS Control Tower: Learning loading skeleton
export default function LearningLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="h-5 w-36 bg-[#1A1A24] rounded animate-pulse" />
          <div className="h-3 w-72 bg-[#1A1A24] rounded animate-pulse" />
        </div>

        {/* KPI row — 4 cols */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Sparklines — 2 cols */}
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        </div>

        {/* Weights table */}
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>

        {/* Calibration table */}
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
