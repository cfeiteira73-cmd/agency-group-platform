// AGENCY GROUP — SH-ROS Omega Control Tower: Economics | AMI: 22506
import { economicBenchmarkEngine } from "@/lib/economics/economicBenchmarks"
import { agentProfitabilityEngine } from "@/lib/economics/agentProfitability"
import { opportunityCostAnalyzer } from "@/lib/economics/opportunityCost"
import { KPICard } from "@/app/control-tower/_components/KPICard"
import { StatusBadge } from "@/app/control-tower/_components/StatusBadge"

export const revalidate = 60

const ORG_ID = process.env.DEFAULT_ORG_ID ?? "default"

export default async function EconomicsPage() {
  const [benchmark, agentScores, opCost] = await Promise.allSettled([
    economicBenchmarkEngine.benchmarkOrg(ORG_ID, 90),
    agentProfitabilityEngine.rankOrg(ORG_ID, 90),
    opportunityCostAnalyzer.analyzeOrg(ORG_ID),
  ])

  const bm = benchmark.status === "fulfilled" ? benchmark.value : null
  const agents = agentScores.status === "fulfilled" ? agentScores.value : []
  const oc = opCost.status === "fulfilled" ? opCost.value : null

  const fmt = (v: number) =>
    v >= 1_000_000 ? `EUR ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000 ? `EUR ${(v / 1_000).toFixed(1)}K`
    : `EUR ${v.toFixed(0)}`

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Economic Intelligence</h1>
        <p className="text-slate-400 text-sm mt-1">Revenue attribution / pipeline economics / agent profitability</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Pipeline Value" value={bm ? fmt(bm.total_pipeline_eur) : "—"} sub="90d active deals" color="blue" />
        <KPICard title="Closed Revenue" value={bm ? fmt(bm.total_closed_eur) : "—"} sub="90d closed_won" color="green" />
        <KPICard title="Close Rate" value={bm ? `${bm.close_rate}%` : "—"} sub={`Market: ${((bm?.market_avg_close_rate ?? 0.18) * 100).toFixed(0)}%`} color={bm?.benchmark_vs_market === "above" ? "green" : bm?.benchmark_vs_market === "below" ? "red" : "amber"} />
        <KPICard title="Opportunity Cost" value={oc ? fmt(oc.total_estimated_opportunity_cost_eur) : "—"} sub={`${oc?.stalled_deals ?? 0} stalled deals`} color={oc && oc.stalled_deals > 10 ? "red" : "amber"} />
      </div>
      {bm && (
        <div className="bg-[#111118] border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold mb-4">Pipeline Metrics — 90d</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div><div className="text-slate-400">Avg Deal Size</div><div className="text-white font-bold mt-1">{fmt(bm.avg_deal_size_eur)}</div></div>
            <div><div className="text-slate-400">Avg Days to Close</div><div className="text-white font-bold mt-1">{bm.avg_days_to_close}d</div><div className="text-slate-500 text-xs">Market: {bm.market_avg_days_to_close}d</div></div>
            <div><div className="text-slate-400">Pipeline Velocity</div><div className="text-white font-bold mt-1">{fmt(bm.pipeline_velocity_eur_per_day)}/day</div></div>
            <div><div className="text-slate-400">Efficiency Score</div><div className={`font-bold mt-1 ${bm.efficiency_score >= 60 ? "text-emerald-400" : "text-amber-400"}`}>{bm.efficiency_score}/100</div><div className="text-slate-500 text-xs">vs market: {bm.benchmark_vs_market}</div></div>
          </div>
        </div>
      )}
      {oc && oc.recovery_actions.length > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold mb-4">Recovery Actions <span className="ml-2 text-xs text-amber-400 font-normal">{fmt(oc.stalled_value_eur)} at risk / avg {oc.avg_stall_days}d stalled</span></h2>
          <div className="space-y-2">
            {oc.recovery_actions.map((a) => (
              <div key={a.deal_id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#0A0A0F] border border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge variant={a.urgency === "critical" ? "failed" : a.urgency === "high" ? "processing" : "pending"} />
                  <span className="text-slate-300 text-sm truncate">{a.recommended_action}</span>
                </div>
                <span className="text-emerald-400 text-sm font-mono ml-4 shrink-0">{fmt(a.estimated_recovery_eur)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {agents.length > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold mb-4">Agent Profitability Ranking</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 text-xs border-b border-slate-800"><th className="text-left pb-2 pr-4">#</th><th className="text-left pb-2 pr-4">Agent</th><th className="text-right pb-2 pr-4">Revenue</th><th className="text-right pb-2 pr-4">Deals</th><th className="text-right pb-2 pr-4">Conv.</th><th className="text-right pb-2 pr-4">Avg Close</th><th className="text-right pb-2">Score</th></tr></thead>
              <tbody>
                {agents.slice(0, 10).map((a) => (
                  <tr key={a.agent_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="py-2 pr-4 text-slate-500">{a.profitability_rank}</td>
                    <td className="py-2 pr-4 text-slate-300 font-mono text-xs max-w-[180px] truncate">{a.agent_id}</td>
                    <td className="py-2 pr-4 text-right text-emerald-400 font-mono">{fmt(a.revenue_generated_eur)}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{a.deals_closed}</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{a.conversion_rate}%</td>
                    <td className="py-2 pr-4 text-right text-slate-300">{a.avg_close_days}d</td>
                    <td className="py-2 text-right"><span className={`font-bold ${a.profitability_tier === "elite" ? "text-emerald-400" : a.profitability_tier === "high" ? "text-blue-400" : a.profitability_tier === "standard" ? "text-yellow-400" : "text-red-400"}`}>{a.economic_efficiency_score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

