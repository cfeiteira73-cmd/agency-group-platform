export default function AITimelineLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="mb-8">
        <div className="h-6 w-48 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[#1A1A24] rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <div className="h-4 w-32 bg-[#1A1A24] rounded animate-pulse" />
        </div>
        <div className="space-y-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 border-b border-slate-800/30 bg-[#1A1A24] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
