export default function AgentDetailLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 bg-slate-800/50 rounded w-32" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-6 bg-slate-800/50 rounded w-36" />
            <div className="h-5 bg-slate-800/50 rounded w-16" />
          </div>
          <div className="h-3 bg-slate-800/40 rounded w-52" />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-lg" />
        ))}
      </div>

      {/* Sparkline */}
      <div className="h-24 bg-slate-800/50 rounded-lg" />

      {/* Top Actions */}
      <div className="h-32 bg-slate-800/50 rounded-lg" />

      {/* Recent Executions table */}
      <div className="h-48 bg-slate-800/50 rounded-lg" />
    </div>
  )
}
