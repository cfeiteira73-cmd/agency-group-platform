export default function EventDetailLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 bg-slate-800/50 rounded w-40" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-6 bg-slate-800/50 rounded w-24" />
            <div className="h-5 bg-slate-800/50 rounded w-16" />
            <div className="h-5 bg-slate-800/50 rounded w-14" />
          </div>
          <div className="h-3 bg-slate-800/40 rounded w-64" />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-lg" />
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-slate-800/50 rounded-lg" />
        <div className="h-48 bg-slate-800/50 rounded-lg" />
      </div>

      {/* Table */}
      <div className="h-40 bg-slate-800/50 rounded-lg" />
    </div>
  )
}
