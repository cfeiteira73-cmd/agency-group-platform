export default function AgentsLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-5 w-24 bg-[#1A1A24] rounded animate-pulse" />
      </div>
      <div className="flex items-center gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center">
            <div className="h-7 w-10 bg-[#1A1A24] rounded animate-pulse mb-1" />
            <div className="h-3 w-14 bg-[#1A1A24] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
