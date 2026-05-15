// AGENCY GROUP — Control Tower: Observability | AMI: 22506
// Phase Ω∞-7: p50/p95/p99 latency profiles + replay storm detection + heatmap

import { KPICard } from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'
import { latencyHeatmapEngine } from '@/lib/observability/latencyHeatmap'

export const revalidate = 30

async function getObservabilityData() {
  const org_id = process.env.DEFAULT_ORG_ID ?? 'default'

  const [summary, replayStorm] = await Promise.allSettled([
    latencyHeatmapEngine.getOrgLatencySummary(org_id, 24),
    latencyHeatmapEngine.detectReplayStorm(org_id),
  ])

  return {
    latencyProfiles: summary.status === 'fulfilled' ? summary.value : [],
    replayStorm: replayStorm.status === 'fulfilled' ? replayStorm.value : null,
  }
}

export default async function ObservabilityPage() {
  const data = await getObservabilityData()
  const { latencyProfiles, replayStorm } = data

  const totalWorkflows = latencyProfiles.length
  const degradedWorkflows = latencyProfiles.filter(p => p.p99 > 5000).length
  const avgP95 = totalWorkflows > 0
    ? Math.round(latencyProfiles.reduce((s, p) => s + p.p95, 0) / totalWorkflows)
    : 0
  const worstP99 = latencyProfiles.length > 0 ? latencyProfiles[0].p99 : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Observability</h1>
        <p className="text-slate-400 text-sm mt-1">p50/p95/p99 workflow latency · Replay storm detection · SLO compliance</p>
      </div>

      {/* Replay storm alert */}
      {replayStorm?.detected && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 font-bold text-sm">⚠ REPLAY STORM DETECTED</span>
          </div>
          <p className="text-red-300 text-sm">
            {replayStorm.replay_rate_per_minute} replays/min (threshold: {replayStorm.threshold}/min)
          </p>
          <p className="text-red-400 text-xs mt-1">{replayStorm.recommendation}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Workflows Tracked" value={totalWorkflows} color="blue" />
        <KPICard title="Avg p95 (ms)" value={avgP95.toLocaleString()} color="amber" />
        <KPICard title="Worst p99 (ms)" value={worstP99.toLocaleString()} color={worstP99 > 10000 ? 'red' : 'green'} />
        <KPICard title="Degraded" value={`${degradedWorkflows}/${totalWorkflows}`} color={degradedWorkflows > 0 ? 'red' : 'green'} />
      </div>

      {/* Latency profiles table */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-slate-200 font-semibold text-sm">Workflow Latency Profiles — Last 24h</span>
          <span className="text-slate-500 text-xs">SLO target: 5,000ms</span>
        </div>

        {latencyProfiles.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">
            No workflow executions recorded yet. Execute a workflow to populate latency data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800/50">
                  <th className="px-4 py-2 text-left font-medium">Workflow</th>
                  <th className="px-4 py-2 text-right font-medium">p50</th>
                  <th className="px-4 py-2 text-right font-medium">p75</th>
                  <th className="px-4 py-2 text-right font-medium">p95</th>
                  <th className="px-4 py-2 text-right font-medium">p99</th>
                  <th className="px-4 py-2 text-right font-medium">p999</th>
                  <th className="px-4 py-2 text-right font-medium">Count</th>
                  <th className="px-4 py-2 text-right font-medium">SLO Breach</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {latencyProfiles.map((profile, i) => (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-[#1A1A24] transition-colors">
                    <td className="px-4 py-2.5 text-slate-300 font-mono">{profile.workflow_id}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{profile.p50}ms</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{profile.p75}ms</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{profile.p95}ms</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${profile.p99 > 5000 ? 'text-red-400' : 'text-slate-200'}`}>
                      {profile.p99}ms
                    </td>
                    <td className={`px-4 py-2.5 text-right ${profile.p999 > 10000 ? 'text-red-500' : 'text-slate-400'}`}>
                      {profile.p999}ms
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{profile.count.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${profile.slo_breach_pct > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {profile.slo_breach_pct}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge
                        variant={profile.p99 > 10000 ? 'failed' : profile.p99 > 5000 ? 'warning' : 'completed'}
                        label={profile.p99 > 10000 ? 'DEGRADED' : profile.p99 > 5000 ? 'SLOW' : 'OK'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Replay status */}
      {replayStorm && !replayStorm.detected && (
        <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-4 flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✓</span>
          <div>
            <p className="text-slate-200 text-sm font-medium">Replay system normal</p>
            <p className="text-slate-500 text-xs">
              {replayStorm.replay_rate_per_minute} replays/min · threshold: {replayStorm.threshold}/min
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
