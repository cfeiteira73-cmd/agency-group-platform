export default function ForensicsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-7 w-56 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-72 bg-[#1A1A24] rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-36 bg-[#1A1A24] rounded-xl border border-slate-800 animate-pulse" />
      ))}
    </div>
  )
}
