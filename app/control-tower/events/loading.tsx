// AGENCY GROUP — SH-ROS Control Tower: Events loading skeleton
export default function EventsLoading() {
  return (
    <div className="min-h-screen bg-[#0D0D14] p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-28 bg-[#1A1A24] rounded animate-pulse" />
            <div className="h-3 w-32 bg-[#1A1A24] rounded animate-pulse" />
          </div>
        </div>

        {/* Event table rows */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="h-9 bg-[#0A0A0F] border-b border-slate-800 animate-pulse" />
          {/* Rows */}
          <div className="space-y-0">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-10 border-b border-slate-800/50 bg-[#1A1A24] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
