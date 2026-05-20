export default function DistributedLoading() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-52 bg-[#1A1A24] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[#1A1A24] rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-[#111118] border border-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-28 bg-[#111118] border border-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-[#111118] border border-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
