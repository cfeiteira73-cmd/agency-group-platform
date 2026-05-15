// AGENCY GROUP — Control Tower: Incidents | AMI: 22506
// Phase Ω∞-7: P1-P4 incident management + SLO tracking

import { KPICard } from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'
import { incidentGovernanceEngine } from '@/lib/runtime/incidentGovernance'

export const revalidate = 15

async function getIncidentData() {
  try {
    const openIncidents = await incidentGovernanceEngine.listOpen()
    return { openIncidents }
  } catch {
    return { openIncidents: [] }
  }
}

const SEVERITY_COLORS: Record<string, string> = {
  P1: 'text-red-400 bg-red-900/30 border-red-700',
  P2: 'text-orange-400 bg-orange-900/20 border-orange-700',
  P3: 'text-amber-400 bg-amber-900/20 border-amber-700',
  P4: 'text-blue-400 bg-blue-900/20 border-blue-700',
}

const STATUS_VARIANT: Record<string, 'failed' | 'warning' | 'medium' | 'completed'> = {
  open: 'failed',
  investigating: 'warning',
  mitigating: 'warning',
  resolved: 'completed',
  postmortem: 'medium',
}

function minutesAgo(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000)
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m ago`
}

export default async function IncidentsPage() {
  const { openIncidents } = await getIncidentData()

  const p1Count = openIncidents.filter(i => i.severity === 'P1').length
  const p2Count = openIncidents.filter(i => i.severity === 'P2').length
  const sloBreached = openIncidents.filter(i => i.slo_breached).length
  const unacknowledged = openIncidents.filter(i => !i.acknowledged_at).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Incident Governance</h1>
          <p className="text-slate-400 text-sm mt-1">P1–P4 severity tracking · SLO compliance · MTTR monitoring</p>
        </div>
        {p1Count > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 border border-red-700 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-300 text-sm font-bold">{p1Count} P1 ACTIVE</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Open Incidents" value={openIncidents.length} color={openIncidents.length > 0 ? 'red' : 'green'} />
        <KPICard title="P1 / P2" value={`${p1Count} / ${p2Count}`} color={p1Count > 0 ? 'red' : p2Count > 0 ? 'amber' : 'green'} />
        <KPICard title="SLO Breached" value={sloBreached} color={sloBreached > 0 ? 'red' : 'green'} />
        <KPICard title="Unacknowledged" value={unacknowledged} color={unacknowledged > 0 ? 'amber' : 'green'} />
      </div>

      {/* Incident list */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <span className="text-slate-200 font-semibold text-sm">Active Incidents</span>
        </div>

        {openIncidents.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-emerald-400 text-3xl mb-2">✓</div>
            <p className="text-slate-300 font-medium">All systems operational</p>
            <p className="text-slate-500 text-xs mt-1">No open incidents</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {openIncidents.map((incident) => {
              const slo = {
                P1: { ack: 5, resolve: 60 },
                P2: { ack: 15, resolve: 240 },
                P3: { ack: 60, resolve: 1440 },
                P4: { ack: 240, resolve: 4320 },
              }[incident.severity]

              const detectedMins = Math.floor((Date.now() - new Date(incident.detected_at).getTime()) / 60_000)
              const timeToResolveRemaining = slo ? Math.max(0, slo.resolve - detectedMins) : null

              return (
                <div key={incident.incident_id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded border ${SEVERITY_COLORS[incident.severity]}`}>
                        {incident.severity}
                      </span>
                      <div>
                        <p className="text-slate-200 font-medium text-sm">{incident.title}</p>
                        {incident.impact_summary && (
                          <p className="text-slate-500 text-xs mt-0.5">{incident.impact_summary}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-slate-600 text-xs">Detected: {minutesAgo(incident.detected_at)}</span>
                          {incident.acknowledged_at ? (
                            <span className="text-slate-600 text-xs">ACK: {minutesAgo(incident.acknowledged_at)}</span>
                          ) : (
                            <span className="text-amber-500 text-xs font-medium">⚠ Not acknowledged</span>
                          )}
                          {incident.slo_breached && (
                            <span className="text-red-400 text-xs font-medium">SLO BREACHED</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge
                        variant={STATUS_VARIANT[incident.status] ?? 'medium'}
                        label={incident.status.toUpperCase()}
                      />
                      {timeToResolveRemaining !== null && timeToResolveRemaining < 60 && (
                        <span className="text-red-400 text-xs font-medium">
                          {timeToResolveRemaining}m to SLO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timeline (last 2 entries) */}
                  {incident.timeline.length > 0 && (
                    <div className="mt-3 pl-9 space-y-1">
                      {incident.timeline.slice(-2).map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                          <span className="shrink-0">{new Date(entry.ts).toLocaleTimeString()}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{entry.actor}</span>
                          <span className="text-slate-600">·</span>
                          <span>{entry.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SLO Reference */}
      <div className="bg-[#0F0F17] border border-slate-800 rounded-lg p-4">
        <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">SLO Targets</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['P1', 'P2', 'P3', 'P4'] as const).map(sev => {
            const thresholds = { P1: [5, 60], P2: [15, 240], P3: [60, 1440], P4: [240, 4320] }[sev]
            return (
              <div key={sev} className={`rounded px-3 py-2 border ${SEVERITY_COLORS[sev]}`}>
                <p className="font-bold text-sm">{sev}</p>
                <p className="text-xs mt-0.5 opacity-80">Ack: {thresholds[0]}min</p>
                <p className="text-xs opacity-80">Resolve: {thresholds[1]}min</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
