export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-screen-2xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-32 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-48 bg-gray-800 rounded animate-pulse mt-1" />
          </div>
        </div>
        {/* Revenue row */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </div>
        {/* Second row */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3 h-64 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          <div className="xl:col-span-2 h-64 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
        </div>
        {/* Third row */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="h-48 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          <div className="h-48 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  )
}
