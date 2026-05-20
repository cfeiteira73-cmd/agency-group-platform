// AGENCY GROUP — SH-ROS Control Tower: Learning | AMI: 22506
export const revalidate = 30

import { Suspense } from 'react'
import { SparklineBar } from '../_components/SparklineBar'

interface AgentWeight {
  agent_id: string
  action_type: string
  weight: number
  delta_30d: number
  last_updated: string
  outcome_count: number
}

interface CalibrationStat {
  agent_id: string
  predicted_avg: number
  actual_avg: number
  error: number
  sample_size: number
  last_calibrated: string
}

interface LearningData {
  total_outcomes: number
  avg_confidence_error: number | null
  avg_roi_mape: number | null
  drifted_agents: string[]
  weights: AgentWeight[]
  calibration: CalibrationStat[]
  roi_sparkline_30d: number[]
  accuracy_sparkline_30d: number[]
  governance_log: Array<{
    agent_id: string
    action_type: string
    delta: number
    approved_by: string | null
    timestamp: string
  }>
}

async function fetchLearningData(org_id: string): Promise<LearningData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/learning?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json() as Promise<LearningData>
  } catch { return null }
}

async function LearningContent() {
  const data = await fetchLearningData('default')

  return (
    <>
      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Learning data unavailable</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Outcome Records', value: data.total_outcomes, color: 'text-slate-100' },
              { label: 'Avg Confidence Error', value: data.avg_confidence_error != null ? `${(data.avg_confidence_error * 100).toFixed(1)}%` : '—', color: data.avg_confidence_error != null && data.avg_confidence_error < 0.1 ? 'text-green-400' : 'text-amber-400' },
              { label: 'ROI MAPE', value: data.avg_roi_mape != null ? `${data.avg_roi_mape.toFixed(1)}%` : '—', color: data.avg_roi_mape != null && data.avg_roi_mape < 15 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Drifted Agents', value: data.drifted_agents.length, color: data.drifted_agents.length > 0 ? 'text-red-400' : 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#111118] border border-slate-800 rounded-lg p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Drifted agents alert */}
          {data.drifted_agents.length > 0 && (
            <div className="bg-[#111118] border border-amber-900/40 rounded-lg p-4">
              <p className="text-xs text-amber-400 font-medium mb-2">⚠ Score Drift Detected</p>
              <div className="flex flex-wrap gap-2">
                {data.drifted_agents.map(id => (
                  <span key={id} className="text-[10px] font-mono bg-amber-950/40 border border-amber-800/40 text-amber-300 px-2 py-1 rounded">
                    {id}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-2">Drift threshold: &gt;15% score change over 7d window</p>
            </div>
          )}

          {/* Sparklines */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Prediction Accuracy — Last 30d</p>
              <SparklineBar data={data.accuracy_sparkline_30d} height={40} color="#10B981" />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-600 font-mono">30d ago</span>
                <span className="text-[10px] text-slate-600 font-mono">today</span>
              </div>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">ROI Accuracy (1-MAPE) — Last 30d</p>
              <SparklineBar data={data.roi_sparkline_30d} height={40} color="#8B5CF6" />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-600 font-mono">30d ago</span>
                <span className="text-[10px] text-slate-600 font-mono">today</span>
              </div>
            </div>
          </div>

          {/* Agent Weights */}
          {data.weights.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Reinforcement Weights [0.5 – 1.5]</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Agent', 'Action', 'Weight', 'Δ 30d', 'Outcomes', 'Updated'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.weights.map((w, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2 font-mono text-blue-400 text-[10px]">{w.agent_id}</td>
                      <td className="px-3 py-2 text-slate-300 text-[10px] font-mono">{w.action_type}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-blue-500"
                              style={{ width: `${((w.weight - 0.5) / 1.0) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-200">{w.weight.toFixed(3)}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-2 font-mono text-xs ${w.delta_30d > 0 ? 'text-green-400' : w.delta_30d < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {w.delta_30d > 0 ? '+' : ''}{w.delta_30d.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">{w.outcome_count}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(w.last_updated).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Calibration */}
          {data.calibration.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Platt Scaling Calibration</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Agent', 'Predicted', 'Actual', 'Error', 'Samples', 'Calibrated'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.calibration.map((c, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2 font-mono text-blue-400 text-[10px]">{c.agent_id}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{(c.predicted_avg * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{(c.actual_avg * 100).toFixed(1)}%</td>
                      <td className={`px-3 py-2 font-mono ${c.error < 0.05 ? 'text-green-400' : c.error < 0.1 ? 'text-amber-400' : 'text-red-400'}`}>
                        {(c.error * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">{c.sample_size}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(c.last_calibrated).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Governance log */}
          {data.governance_log.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">🛡 Governance Log — Weight Changes</p>
              <div className="space-y-2">
                {data.governance_log.map((entry, i) => (
                  <div key={i} className="flex items-center gap-4 py-1.5 border-b border-slate-800/50 last:border-0 text-xs">
                    <span className="font-mono text-blue-400 text-[10px] w-32 truncate">{entry.agent_id}</span>
                    <span className="text-slate-400 font-mono text-[10px]">{entry.action_type}</span>
                    <span className={`font-mono font-bold ${entry.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.delta > 0 ? '+' : ''}{entry.delta.toFixed(3)}
                    </span>
                    <span className="text-slate-600 text-[10px]">
                      {entry.approved_by ? `✓ ${entry.approved_by}` : '⚡ auto'}
                    </span>
                    <span className="ml-auto text-slate-600 font-mono text-[10px]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function LearningSkeleton() {
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        <div className="h-24 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
    </>
  )
}

export default function LearningPage() {
  return (
    <div className="space-y-5">
      {/* Header — renders immediately */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Learning Engine</h1>
        <p className="text-xs text-slate-500 font-mono mt-0.5">Outcome tracking · Platt calibration · Reinforcement weights</p>
      </div>

      {/* Data streams in */}
      <Suspense fallback={<LearningSkeleton />}>
        <LearningContent />
      </Suspense>
    </div>
  )
}
