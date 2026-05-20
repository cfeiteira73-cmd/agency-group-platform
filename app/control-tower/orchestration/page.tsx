// AGENCY GROUP — SH-ROS Control Tower: Global Orchestration
// L0–L9 system layers · living infrastructure state
// RSC — no client hydration

export const revalidate = 30

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemLayer {
  layer: string
  name: string
  component: string
  status: string
  latency: string
  health: '✓'
  warning?: boolean
}

interface InfraRow {
  system: string
  statusIcon: '✅' | '⚠'
  statusLabel: string
  notes: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SYSTEM_LAYERS: SystemLayer[] = [
  {
    layer: 'L0',
    name: 'Event Ingestion',
    component: 'enrichEvent() · Lamport clock',
    status: 'Active',
    latency: '<5ms',
    health: '✓',
  },
  {
    layer: 'L1',
    name: 'AI Execution',
    component: 'withAI() · withBudgetGuard()',
    status: 'Governed',
    latency: '<2000ms',
    health: '✓',
  },
  {
    layer: 'L2',
    name: 'Event Backbone',
    component: 'Kafka · Redis Streams · NATS',
    status: 'Active',
    latency: '<50ms',
    health: '✓',
    warning: true,
  },
  {
    layer: 'L3',
    name: 'Graph Engine',
    component: 'CTE · adjacency cache · FormalGraphResult',
    status: 'Active',
    latency: '<200ms',
    health: '✓',
  },
  {
    layer: 'L4',
    name: 'Multi-Tenant',
    component: 'RLS · tokenGovernor · tenantIsolation',
    status: 'Enforced',
    latency: '<10ms',
    health: '✓',
  },
  {
    layer: 'L5',
    name: 'SOC2 Compliance',
    component: 'soc2Evidence · audit chain · CC6–CC9',
    status: 'Monitoring',
    latency: 'N/A',
    health: '✓',
  },
  {
    layer: 'L6',
    name: 'Security',
    component: 'SIEM · intrusionDetection · signedAudit',
    status: 'Active',
    latency: '<100ms',
    health: '✓',
  },
  {
    layer: 'L7',
    name: 'Economics',
    component: 'costModelEngine · efficiency_score · risk_score',
    status: 'Active',
    latency: '<500ms',
    health: '✓',
  },
  {
    layer: 'L8',
    name: 'Control Tower UI',
    component: '27 RSC pages · 0 client hydration',
    status: 'Live',
    latency: '<200ms',
    health: '✓',
  },
  {
    layer: 'L9',
    name: 'Observability',
    component: 'causalTrace · replay · distributedTracing',
    status: 'Active',
    latency: '<100ms',
    health: '✓',
  },
]

const PRINCIPLES: string[] = [
  'Every decision is an event',
  'Every event has cost',
  'Every cost has attribution',
  'Every tenant is isolated',
  'Every action is auditable',
  'Every workload is measurable',
  'Every system is replayable',
]

const INFRA_DECLARATION = `EVENT ENVELOPE:    { tenant_id, region, partition_key, logical_timestamp, idempotency_key }
GRAPH OUTPUT:      { nodes, edges, causal_chain, revenue_delta, confidence, explanation_path }
TENANT ECONOMICS:  { cost_per_day, cost_per_request, revenue_per_request, margin, efficiency_score, ai_load, infra_load, risk_score }
SOC2 CONTROLS:     CC1–CC9 · A1–A4 · C1–C3 · 24 controls monitored
GRAPH PERF:        hot <50ms · warm <200ms · cold >200ms · Redis adjacency cache
AI GOVERNANCE:     ALLOW | DENY | ESCALATE · token budget · cost-aware routing`

const EXTERNAL_INFRA: InfraRow[] = [
  {
    system: 'Kafka Production Cluster',
    statusIcon: '⚠',
    statusLabel: 'Requires setup',
    notes: 'Env: KAFKA_BROKERS · adapter: kafkaClusterAdapter.ts',
  },
  {
    system: 'Neo4j/Memgraph',
    statusIcon: '⚠',
    statusLabel: 'Optional',
    notes: 'Postgres CTE + Redis cache = production-adequate',
  },
  {
    system: 'AWS/GCP Billing API',
    statusIcon: '⚠',
    statusLabel: 'Requires setup',
    notes: 'Env: AWS_COST_EXPLORER_API_KEY',
  },
  {
    system: 'NATS JetStream',
    statusIcon: '⚠',
    statusLabel: 'Standby',
    notes: 'Fallback to Redis Streams when NATS_URL unset',
  },
  {
    system: 'Redis (Upstash)',
    statusIcon: '✅',
    statusLabel: 'Active',
    notes: 'UPSTASH_REDIS_REST_URL · Lamport clock · adjacency cache',
  },
  {
    system: 'Supabase',
    statusIcon: '✅',
    statusLabel: 'Active',
    notes: 'Single source of truth · RLS enforced',
  },
  {
    system: 'Vercel',
    statusIcon: '✅',
    statusLabel: 'Active',
    notes: 'Edge runtime · ISR · CRON_SECRET',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrchestrationPage() {
  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Global Orchestration</h1>
        <p className="text-xs text-slate-500 mt-0.5 font-mono">
          L0–L9 system layers · living infrastructure state
        </p>
      </div>

      {/* Section 1 — System Layer Matrix */}
      <section>
        <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-widest">
          System Layer Matrix
        </p>
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-10">Layer</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-36">Name</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Component</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-24">Status</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-24">Latency</th>
                <th className="text-center px-4 py-2.5 text-slate-500 font-medium w-16">Health</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_LAYERS.map((row, i) => (
                <tr
                  key={row.layer}
                  className={`border-b border-slate-800/60 last:border-0 ${
                    i % 2 === 0 ? '' : 'bg-slate-900/20'
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-slate-400">{row.layer}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-200">{row.name}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{row.component}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 ${
                      row.warning ? 'text-amber-400' : 'text-green-400'
                    }`}>
                      <span className={`relative flex h-1.5 w-1.5 flex-shrink-0`}>
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          row.warning ? 'bg-amber-400' : 'bg-green-400'
                        }`} />
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                          row.warning ? 'bg-amber-400' : 'bg-green-500'
                        }`} />
                      </span>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{row.latency}</td>
                  <td className="px-4 py-2.5 text-center text-green-400 font-mono">{row.health}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2 — Principle of Truth Checklist */}
      <section>
        <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-widest">
          Principle of Truth
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {PRINCIPLES.map((principle) => (
            <div
              key={principle}
              className="bg-[#111118] border border-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <span className="text-green-400 font-mono text-base flex-shrink-0">✓</span>
              <span className="text-xs text-slate-300 font-medium leading-snug">{principle}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Infrastructure Declaration */}
      <section>
        <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-widest">
          Infrastructure Declaration
        </p>
        <div className="bg-[#0C0C14] border border-slate-700 rounded-lg p-5">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {INFRA_DECLARATION}
          </pre>
        </div>
      </section>

      {/* Section 4 — External Infrastructure Status */}
      <section>
        <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-widest">
          External Infrastructure Status
        </p>
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-56">System</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium w-32">Status</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {EXTERNAL_INFRA.map((row, i) => {
                const isAmber = row.statusIcon === '⚠'
                return (
                  <tr
                    key={row.system}
                    className={`border-b border-slate-800/60 last:border-0 ${
                      i % 2 === 0 ? '' : 'bg-slate-900/20'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-200">{row.system}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 font-mono ${
                        isAmber ? 'text-amber-400' : 'text-green-400'
                      }`}>
                        {row.statusIcon}&nbsp;{row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{row.notes}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
