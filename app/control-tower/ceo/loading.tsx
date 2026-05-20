export default function CEOLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-48 bg-[#1A1A24] rounded animate-pulse" />
          <div className="h-3 w-72 bg-[#1A1A24] rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-10 gap-4">
        <div className="col-span-6 h-52 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        <div className="col-span-4 h-52 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      </div>
      <div className="h-40 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
    </div>
  )
}
