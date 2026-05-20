// AGENCY GROUP — SH-ROS Omega Control Tower: Forensics | AMI: 22506
import { Suspense } from "react"
import { frictionDetector } from "@/lib/operations/frictionDetector"
import { bottleneckPredictor } from "@/lib/operations/bottleneckPredictor"
import { operationalAnomalyDetector } from "@/lib/operations/operationalAnomaly"
import { KPICard } from "@/app/control-tower/_components/KPICard"
import { StatusBadge } from "@/app/control-tower/_components/StatusBadge"

export const revalidate = 30

const ORG_ID = process.env.DEFAULT_ORG_ID ?? "default"

function ForensicsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-36 bg-[#1A1A24] rounded-xl border border-slate-800 animate-pulse" />
      ))}
    </div>
  )
}

async function ForensicsContent() {
  const [anomalyReport, frictions, bottlenecks] = await Promise.allSettled([
    operationalAnomalyDetector.generateAnomalyReport(ORG_ID),
    frictionDetector.detectFrictionPoints(ORG_ID, 60),
    bottleneckPredictor.predictBottlenecks(ORG_ID),
  ])

  const ar = anomalyReport.status === "fulfilled" ? anomalyReport.value : { critical: 0, high: 0, anomalies: [] }
  const fp = frictions.status === "fulfilled" ? frictions.value : []
  const bp = bottlenecks.status === "fulfilled" ? bottlenecks.value : []

  const fmt = (v: number) =>
    v >= 1_000_000 ? `EUR ${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000 ? `EUR ${(v / 1_000).toFixed(1)}K`
    : `EUR ${v.toFixed(0)}`

  const urgentBP = bp.filter((b) => b.predicted_onset_days < 14 && b.probability > 0.6)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Critical Anomalies" value={String(ar.critical)} sub="require immediate action" color={ar.critical > 0 ? "red" : "green"} />
        <KPICard title="High Anomalies" value={String(ar.high)} sub="elevated risk" color={ar.high > 2 ? "amber" : "green"} />
        <KPICard title="Friction Points" value={String(fp.length)} sub="pipeline blockages" color={fp.length > 3 ? "amber" : "green"} />
        <KPICard title="Urgent Bottlenecks" value={String(urgentBP.length)} sub="onset lt 14 days" color={urgentBP.length > 0 ? "red" : "green"} />
      </div>
      {ar.anomalies.length > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold mb-4">Operational Anomalies</h2>
          <div className="space-y-3">
            {ar.anomalies.map((a) => (
              <div key={a.id} className={`p-4 rounded-lg border ${a.severity === "critical" ? "border-red-800/60 bg-red-950/20" : a.severity === "high" ? "border-orange-800/60 bg-orange-950/20" : "border-slate-800 bg-slate-900/40"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge variant={a.severity === "critical" ? "failed" : a.severity === "high" ? "processing" : "pending"} />
                      <span className="text-slate-300 text-sm font-medium">{a.description}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{a.suggested_action}</p>
                  </div>
                  <div className="text-right shrink-0 text-xs">
                    <div className="text-slate-500">{a.affected_metric}</div>
                    <div className="text-white font-mono">{a.current_value} vs {a.expected_value}</div>
                    <div className={`font-mono ${a.deviation_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>{a.deviation_pct > 0 ? "+" : ""}{a.deviation_pct}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {fp.length > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold mb-4">Pipeline Friction Points</h2>
          <div className="space-y-2">
            {fp.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-[#0A0A0F] border border-slate-800">
                <div className="min-w-0">
                  <div className="text-slate-300 text-sm font-medium truncate">{f.location}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{f.suggested_fix}</div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="text-amber-400 font-mono text-sm">{fmt(f.estimated_revenue_at_risk_eur)}</div>
                  <div className="text-slate-500 text-xs">{f.occurrence_count} deals / {f.avg_delay_days}d avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {bp.length > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-xl p-6">
          <h2 className="text-slate-200 font-semibold mb-4">Bottleneck Predictions</h2>
          <div className="space-y-3">
            {bp.slice(0, 8).map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-4 items-start py-2 border-b border-slate-800/50">
                <div>
                  <div className="text-slate-300 text-sm font-medium">{b.predicted_bottleneck}</div>
                  <div className="text-slate-500 text-xs mt-1">{b.contributing_factors[0]}</div>
                  <div className="text-slate-600 text-xs">{b.preventive_actions[0]}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${b.probability > 0.7 ? "text-red-400" : "text-amber-400"}`}>{Math.round(b.probability * 100)}%</div>
                  <div className="text-slate-500 text-xs">in {b.predicted_onset_days}d</div>
                  <div className="text-slate-400 text-xs">{b.estimated_deals_blocked} deals</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ar.anomalies.length === 0 && fp.length === 0 && bp.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-slate-400">No anomalies, friction points, or bottleneck risks detected.</div>
          <div className="text-slate-600 text-sm mt-1">System operating within normal parameters.</div>
        </div>
      )}
    </>
  )
}

export default function ForensicsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Forensics &amp; Operational Intelligence</h1>
        <p className="text-slate-400 text-sm mt-1">Anomaly detection / friction points / bottleneck predictions</p>
      </div>
      <Suspense fallback={<ForensicsSkeleton />}>
        <ForensicsContent />
      </Suspense>
    </div>
  )
}

