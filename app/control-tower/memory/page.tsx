// AGENCY GROUP — SH-ROS Control Tower: Memory | AMI: 22506
export const revalidate = 30

import { Suspense } from 'react'
import { SparklineBar } from '../_components/SparklineBar'

interface MemoryData {
  hot: {
    entries: number
    orgs: number
    oldest_entry_ms: number | null
  }
  warm: {
    entries_90d: number
    entries_7d: number
    entries_1d: number
    size_estimate_kb: number
  }
  cold: {
    total_entries: number
    semantic_index_size: number
    vector_available: boolean
    oldest_entry: string | null
    compressed_entries: number
  }
  learning: {
    total_outcomes: number
    calibrated_agents: number
    last_calibration: string | null
    avg_confidence_error: number | null
  }
  sparkline_cold_writes: number[]
}

async function fetchMemoryData(org_id: string): Promise<MemoryData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/memory?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json() as Promise<MemoryData>
  } catch { return null }
}

function MemoryTier({
  tier, icon, color, children,
}: { tier: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`bg-[#111118] border ${color} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">{tier} Memory</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function MetricRow({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono' : ''} text-slate-200`}>{value}</span>
    </div>
  )
}

async function MemoryContent() {
  const data = await fetchMemoryData('default')

  return (
    <>
      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Memory data unavailable</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">GET /api/control-tower/memory</p>
        </div>
      ) : (
        <>
          {/* Memory Tiers */}
          <div className="grid grid-cols-3 gap-4">
            <MemoryTier tier="HOT" icon="🔥" color="border-red-900/40">
              <MetricRow label="Active entries" value={data.hot.entries} />
              <MetricRow label="Active orgs" value={data.hot.orgs} />
              <MetricRow
                label="Oldest entry"
                value={data.hot.oldest_entry_ms != null
                  ? `${Math.round(data.hot.oldest_entry_ms / 1000)}s ago`
                  : '—'}
              />
              <div className="mt-3 pt-2 border-t border-slate-800">
                <p className="text-[10px] text-slate-600">In-process LRU cache. Lost on restart.</p>
              </div>
            </MemoryTier>

            <MemoryTier tier="WARM" icon="🌡" color="border-amber-900/40">
              <MetricRow label="Last 24h" value={data.warm.entries_1d} />
              <MetricRow label="Last 7d" value={data.warm.entries_7d} />
              <MetricRow label="Last 90d" value={data.warm.entries_90d} />
              <MetricRow
                label="Est. size"
                value={data.warm.size_estimate_kb < 1024
                  ? `${data.warm.size_estimate_kb} KB`
                  : `${(data.warm.size_estimate_kb / 1024).toFixed(1)} MB`}
              />
              <div className="mt-3 pt-2 border-t border-slate-800">
                <p className="text-[10px] text-slate-600">Supabase learning_events. 90-day window.</p>
              </div>
            </MemoryTier>

            <MemoryTier tier="COLD" icon="❄️" color="border-blue-900/40">
              <MetricRow label="Total entries" value={data.cold.total_entries} />
              <MetricRow label="Semantic index" value={`${data.cold.semantic_index_size} docs`} />
              <MetricRow label="Vector search" value={data.cold.vector_available ? '✓ pgvector' : '✗ unavailable'} />
              <MetricRow label="Compressed" value={data.cold.compressed_entries} />
              <MetricRow
                label="Oldest entry"
                value={data.cold.oldest_entry
                  ? new Date(data.cold.oldest_entry).toLocaleDateString()
                  : '—'}
              />
              <div className="mt-3 pt-2 border-t border-slate-800">
                <p className="text-[10px] text-slate-600">Long-term strategic memory. TF-IDF + pgvector.</p>
              </div>
            </MemoryTier>
          </div>

          {/* Learning Engine */}
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-medium mb-3">📈 Learning Engine</p>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Outcome Records', value: data.learning.total_outcomes },
                { label: 'Calibrated Agents', value: data.learning.calibrated_agents },
                { label: 'Avg Confidence Error', value: data.learning.avg_confidence_error != null ? `${(data.learning.avg_confidence_error * 100).toFixed(1)}%` : '—' },
                { label: 'Last Calibration', value: data.learning.last_calibration ? new Date(data.learning.last_calibration).toLocaleTimeString() : 'Never' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-mono font-semibold text-slate-200 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cold write sparkline */}
          {data.sparkline_cold_writes.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Cold Memory Writes — Last 24h</p>
              <SparklineBar data={data.sparkline_cold_writes} height={40} color="#3B82F6" />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-600 font-mono">24h ago</span>
                <span className="text-[10px] text-slate-600 font-mono">now</span>
              </div>
            </div>
          )}

          {/* Memory flow diagram */}
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-medium mb-4">Memory Flow</p>
            <div className="flex items-center justify-center gap-4">
              {[
                { label: 'HOT', sub: 'in-process LRU', color: 'border-red-700 text-red-300', count: data.hot.entries },
                { label: '→', sub: '', color: 'text-slate-600', count: null },
                { label: 'WARM', sub: 'Supabase 90d', color: 'border-amber-700 text-amber-300', count: data.warm.entries_90d },
                { label: '→', sub: '', color: 'text-slate-600', count: null },
                { label: 'COLD', sub: 'Long-term + vector', color: 'border-blue-700 text-blue-300', count: data.cold.total_entries },
              ].map(({ label, sub, color, count }, i) => (
                label === '→'
                  ? <span key={i} className="text-slate-600 text-xl font-mono">→</span>
                  : (
                    <div key={i} className={`border rounded-lg p-3 text-center min-w-[120px] ${color}`}>
                      <p className="text-sm font-bold font-mono">{label}</p>
                      {count != null && <p className="text-xl font-bold mt-1">{count}</p>}
                      <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
                    </div>
                  )
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function MemorySkeleton() {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      <div className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
    </>
  )
}

export default function MemoryPage() {
  return (
    <div className="space-y-5">
      {/* Header — renders immediately */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Memory System</h1>
        <p className="text-xs text-slate-500 font-mono mt-0.5">HOT → WARM → COLD memory hierarchy</p>
      </div>

      {/* Data streams in */}
      <Suspense fallback={<MemorySkeleton />}>
        <MemoryContent />
      </Suspense>
    </div>
  )
}
