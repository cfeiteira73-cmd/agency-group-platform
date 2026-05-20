export default function SettingsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 bg-slate-800/50 rounded w-32" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-slate-800/30 rounded-lg p-4 space-y-3">
          <div className="h-4 bg-slate-800/70 rounded w-40" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-12 bg-slate-800/50 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
