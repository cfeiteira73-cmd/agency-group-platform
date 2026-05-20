export default function ObservabilityLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-7 w-36 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-72 bg-[#1A1A24] rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <div className="h-4 w-48 bg-[#1A1A24] rounded animate-pulse" />
        </div>
        <div className="space-y-0">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 border-b border-slate-800/30 bg-[#1A1A24] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
