export default function OrchestrationLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 bg-slate-800/50 rounded w-48" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-800/50 rounded-lg" />
        ))}
      </div>
      <div className="h-56 bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
