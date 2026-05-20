export default function TenantsLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 font-mono">
      <div className="mb-8">
        <div className="h-6 w-48 bg-[#1A1A24] rounded animate-pulse" />
        <div className="h-4 w-32 bg-[#1A1A24] rounded animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-[#111118] border border-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="bg-[#111118] border border-white/5 rounded-lg overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 border-b border-white/5 bg-[#1A1A24] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
