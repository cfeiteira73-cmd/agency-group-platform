// =============================================================================
// Agency Group — Self-Healing Control Tower
// app/control-tower/self-healing/page.tsx
//
// RSC page — no 'use client' — ISR 15s
// Displays: Heal Rate KPI, Load Mode, Active Predictions, Recent Cycles,
//           Remediation History, Escalations
//
// TypeScript strict — 0 errors
// =============================================================================

import { Suspense }                   from 'react'
import Link                           from 'next/link'
import type { HealingCycleResult, OrchestratorStats } from '@/lib/remediation/selfHealingOrchestrator'
import type { PredictionReport }      from '@/lib/remediation/predictiveFailureEngine'
import type { LoadMode }              from '@/lib/runtime/loadGovernor'

export const revalidate = 15   // ISR 15s — near-real-time for self-healing status

// ─── Data fetchers ────────────────────────────────────────────────────────────

const BASE    = process.env.INTERNAL_API_BASE  ?? 'http://localhost:3000'
const TOKEN   = process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''
const TENANT  = process.env.DEFAULT_TENANT_ID  ?? 'agency-group'

const HEADERS = { Authorization: `Bearer ${TOKEN}` }

async function fetchStatus(): Promise<{
  orchestrator: OrchestratorStats
  load_mode:    LoadMode
}> {
  try {
    const res = await fetch(
      `${BASE}/api/remediation/status?tenant_id=${encodeURIComponent(TENANT)}`,
      { headers: HEADERS, next: { revalidate: 15 } },
    )
    if (!res.ok) throw new Error(`status ${res.status}`)
    return res.json() as Promise<{ orchestrator: OrchestratorStats; load_mode: LoadMode }>
  } catch {
    return {
      load_mode:    'NORMAL',
      orchestrator: {
        tenant_id:             TENANT,
        cycles_run:            0,
        cycles_healed:         0,
        cycles_escalated:      0,
        avg_cycle_duration_ms: 0,
        heal_rate:             0,
        last_cycle_at:         null,
      },
    }
  }
}

async function fetchPredictions(): Promise<PredictionReport | null> {
  try {
    const res = await fetch(
      `${BASE}/api/remediation/predictions?tenant_id=${encodeURIComponent(TENANT)}`,
      { headers: HEADERS, next: { revalidate: 15 } },
    )
    if (!res.ok) return null
    return res.json() as Promise<PredictionReport>
  } catch {
    return null
  }
}

async function fetchHistory(): Promise<HealingCycleResult[]> {
  try {
    const res = await fetch(
      `${BASE}/api/remediation/history?tenant_id=${encodeURIComponent(TENANT)}&limit=20`,
      { headers: HEADERS, next: { revalidate: 15 } },
    )
    if (!res.ok) return []
    const body = await res.json() as { actions?: HealingCycleResult[] }
    return body.actions ?? []
  } catch {
    return []
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?:  string
  color?: 'green' | 'amber' | 'red' | 'blue' | 'purple'
}) {
  const vc =
    color === 'green'  ? 'text-green-400'  :
    color === 'amber'  ? 'text-amber-400'  :
    color === 'red'    ? 'text-red-400'    :
    color === 'blue'   ? 'text-blue-400'   :
    color === 'purple' ? 'text-purple-400' :
    'text-slate-100'

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium truncate">{label}</p>
      <p className={`text-3xl font-bold leading-none ${vc}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function LoadModeBadge({ mode }: { mode: LoadMode }) {
  const cfg: Record<LoadMode, { label: string; cls: string }> = {
    NORMAL:    { label: 'NORMAL',    cls: 'bg-green-900/40  text-green-300  border-green-800'  },
    STRESSED:  { label: 'STRESSED',  cls: 'bg-amber-900/40  text-amber-300  border-amber-800'  },
    CRITICAL:  { label: 'CRITICAL',  cls: 'bg-red-900/40    text-red-300    border-red-800'    },
    EMERGENCY: { label: 'EMERGENCY', cls: 'bg-red-900/80    text-red-200    border-red-700 animate-pulse' },
  }
  const { label, cls } = cfg[mode] ?? cfg.NORMAL
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  )
}

function SeverityBadge({ s }: { s: string }) {
  const cls =
    s === 'P0' ? 'bg-red-900/40 text-red-300 border-red-800' :
    s === 'P1' ? 'bg-orange-900/40 text-orange-300 border-orange-800' :
    s === 'P2' ? 'bg-amber-900/40 text-amber-300 border-amber-800' :
    'bg-slate-800 text-slate-400 border-slate-700'
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${cls}`}>{s}</span>
}

function StageIcon({ s }: { s: string }) {
  if (s === 'complete')          return <span className="text-green-400" title="Complete">✓</span>
  if (s === 'skipped')           return <span className="text-slate-600" title="Skipped">–</span>
  if (s === 'approval_required') return <span className="text-amber-400" title="Pending Approval">⏳</span>
  return <span className="text-red-400" title="Failed">✗</span>
}

// ─── Main async content ───────────────────────────────────────────────────────

async function SelfHealingContent() {
  const [statusData, predictions, history] = await Promise.all([
    fetchStatus(),
    fetchPredictions(),
    fetchHistory(),
  ])

  const { orchestrator, load_mode } = statusData
  const healPct = Math.round(orchestrator.heal_rate * 100)
  const healColor: 'green' | 'amber' | 'red' =
    healPct >= 80 ? 'green' : healPct >= 50 ? 'amber' : 'red'

  const highPredictions = predictions?.predictions.filter(
    (p) => p.probability >= 0.6,
  ) ?? []

  const recentCycles = history.slice(0, 10)
  const escalations  = history.filter((r) => r.escalated).slice(0, 5)

  return (
    <div className="flex flex-col gap-6">

      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-3">
          Engine Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Heal Rate"
            value={`${healPct}%`}
            sub={`${orchestrator.cycles_healed} / ${orchestrator.cycles_run} cycles`}
            color={healColor}
          />
          <KpiCard
            label="Avg Cycle"
            value={`${orchestrator.avg_cycle_duration_ms}ms`}
            sub="target < 5 000ms for P0"
            color={orchestrator.avg_cycle_duration_ms < 5000 ? 'green' : 'amber'}
          />
          <KpiCard
            label="Escalations"
            value={String(orchestrator.cycles_escalated)}
            sub="required human approval"
            color={orchestrator.cycles_escalated > 0 ? 'amber' : 'green'}
          />
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 flex flex-col gap-1">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
              Load Mode
            </p>
            <div className="mt-1">
              <LoadModeBadge mode={load_mode} />
            </div>
            {orchestrator.last_cycle_at && (
              <p className="text-xs text-slate-600 mt-1">
                Last cycle: {new Date(orchestrator.last_cycle_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Predictions ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-slate-500 uppercase tracking-widest font-medium">
            Active Predictions
            {highPredictions.length > 0 && (
              <span className="ml-2 bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {highPredictions.length}
              </span>
            )}
          </h2>
          {predictions && (
            <span className="text-xs text-slate-600">
              risk score: {Math.round(predictions.overall_risk_score * 100)}%
            </span>
          )}
        </div>

        {highPredictions.length === 0 ? (
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 text-sm text-slate-500">
            No high-probability failure predictions detected.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {highPredictions.map((p) => (
              <div key={p.prediction_id} className="bg-[#111118] border border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-xs font-bold uppercase">
                        {p.failure_type}
                      </span>
                      {p.time_to_failure_hours !== null && (
                        <span className="text-slate-400 text-xs">
                          in ~{Math.round(p.time_to_failure_hours * 60)}min
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300">
                      {p.signals_detected.join(' · ') || p.failure_type}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">{p.recommended_prevention}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-lg font-bold ${
                      p.probability >= 0.8 ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {Math.round(p.probability * 100)}%
                    </p>
                    <p className="text-[10px] text-slate-500">probability</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Cycles ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-3">
          Recent Healing Cycles
        </h2>
        {recentCycles.length === 0 ? (
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 text-sm text-slate-500">
            No healing cycles recorded yet.
          </div>
        ) : (
          <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-500 px-4 py-2 font-medium">Incident</th>
                  <th className="text-left text-xs text-slate-500 px-4 py-2 font-medium">Stages</th>
                  <th className="text-left text-xs text-slate-500 px-4 py-2 font-medium">Action</th>
                  <th className="text-right text-xs text-slate-500 px-4 py-2 font-medium">Duration</th>
                  <th className="text-right text-xs text-slate-500 px-4 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {recentCycles.map((cycle) => (
                  <tr key={cycle.cycle_id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">
                      {cycle.incident_id.slice(0, 16)}…
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 text-xs">
                        <StageIcon s={cycle.stages.ingestion}    />
                        <StageIcon s={cycle.stages.causal}       />
                        <StageIcon s={cycle.stages.impact}       />
                        <StageIcon s={cycle.stages.decision}     />
                        <StageIcon s={cycle.stages.remediation}  />
                        <StageIcon s={cycle.stages.verification} />
                        <StageIcon s={cycle.stages.learning}     />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {cycle.action_taken?.action_type ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-slate-400">
                      {cycle.duration_ms}ms
                    </td>
                    <td className="px-4 py-2 text-right">
                      {cycle.escalated ? (
                        <span className="text-amber-400 text-xs font-bold">ESCALATED</span>
                      ) : cycle.healed ? (
                        <span className="text-green-400 text-xs font-bold">HEALED</span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Pending Approval Queue ─────────────────────────────────────────── */}
      {history.filter((c) => c.stages.remediation === 'approval_required').length > 0 && (
        <div className="bg-[#1A1A24] border border-amber-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">⏳ Pending Manual Approval</h3>
          <div className="space-y-2">
            {history
              .filter((c) => c.stages.remediation === 'approval_required')
              .map((c) => (
                <div
                  key={c.incident_id}
                  className="flex items-center justify-between p-3 bg-[#0D0D14] rounded border border-amber-900/30"
                >
                  <div>
                    <p className="text-xs font-mono text-slate-300">{c.incident_id}</p>
                    <p className="text-xs text-amber-400 mt-0.5">
                      Awaiting approval · {c.action_taken?.action_type ?? '—'}
                    </p>
                  </div>
                  <Link
                    href="/control-tower/governance"
                    className="text-xs bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 px-3 py-1.5 rounded transition-colors"
                  >
                    Review →
                  </Link>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Escalations ────────────────────────────────────────────────────── */}
      {escalations.length > 0 && (
        <section>
          <h2 className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-3">
            Pending Escalations
            <span className="ml-2 bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {escalations.length}
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {escalations.map((cycle) => (
              <div
                key={cycle.cycle_id}
                className="bg-[#111118] border border-amber-800/40 rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">
                    Incident: <span className="font-mono text-xs">{cycle.incident_id}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Action: <span className="text-amber-300">{cycle.decision?.action_type ?? '—'}</span>
                    {' · '}
                    Approval ID: <span className="font-mono">{cycle.approval_id ?? '—'}</span>
                  </p>
                </div>
                <Link
                  href={`/control-tower/governance`}
                  className="shrink-0 text-xs text-amber-400 hover:text-amber-200 underline"
                >
                  Review →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Safety note ────────────────────────────────────────────────────── */}
      <p className="text-xs text-slate-700 mt-2">
        ⚕ P0 → AUTO · P1 → AUTO (low-risk only) · ROLLBACK/ISOLATE → MANUAL APPROVAL · P2/P3 → MONITORING ONLY · confidence &lt; 0.3 → ESCALATE
      </p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SelfHealingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#111118] border border-slate-800 rounded-lg p-4 h-20" />
        ))}
      </div>
      <div className="bg-[#111118] border border-slate-800 rounded-lg h-32" />
      <div className="bg-[#111118] border border-slate-800 rounded-lg h-48" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SelfHealingPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>⚕</span> Self-Healing Engine
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Autonomous incident detection, remediation, and learning loop
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/control-tower/incidents"
            className="text-xs px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Incidents
          </Link>
          <Link
            href="/control-tower/governance"
            className="text-xs px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Governance
          </Link>
        </div>
      </div>

      {/* Content */}
      <Suspense fallback={<SelfHealingSkeleton />}>
        <SelfHealingContent />
      </Suspense>
    </div>
  )
}
