// AGENCY GROUP — Control Tower: Distributed System | AMI: 22506
// Multi-region health, circuit breakers, worker coordination, Kafka, backpressure
// =============================================================================

import { Suspense } from 'react'
import {
  multiRegionRouter,
  globalFailoverController,
  distributedBackpressureController,
  kafkaClusterAdapter,
  regionalWorkerCoordinator,
} from '@/lib/runtime/distributed'
import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 30  // ISR 30s

// ─── Queue status counts ──────────────────────────────────────────────────────

type QueueStatusRow = { status: string; count: number }

async function getQueueStatusCounts(): Promise<QueueStatusRow[]> {
  const statuses = ['pending', 'processing', 'completed', 'failed', 'dlq'] as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any
  const rows = await Promise.all(
    statuses.map(async (s) => {
      const { count } = await sb
        .from('runtime_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', s)
      return { status: s, count: count ?? 0 }
    })
  )
  return rows
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getDistributedState() {
  const [worker_health, region_states, queue_counts] = await Promise.all([
    regionalWorkerCoordinator.scanHeartbeats(),
    Promise.resolve(regionalWorkerCoordinator.getAllRegionStates()),
    getQueueStatusCounts(),
  ])

  return {
    region_health:    multiRegionRouter.getRegionHealth(),
    routing_stats:    multiRegionRouter.getRoutingStats(),
    circuit_breakers: globalFailoverController.getCircuitBreakerState(),
    active_failovers: globalFailoverController.getActiveFailovers(),
    backpressure:     distributedBackpressureController.getSnapshot(),
    kafka:            kafkaClusterAdapter.getClusterHealth(),
    regional_lag:     kafkaClusterAdapter.getRegionalLag(),
    worker_health,
    region_states,
    distributed_mode: kafkaClusterAdapter.isDistributedModeActive(),
    queue_counts,
    current_region:   process.env.VERCEL_REGION ?? process.env.AWS_REGION ?? 'eu-west',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: string) {
  const color =
    status === 'healthy' || status === 'closed'  ? 'bg-emerald-500' :
    status === 'degraded' || status === 'half-open' ? 'bg-amber-500' :
    'bg-red-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-2`} />
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DistributedSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-28 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ─── Content ──────────────────────────────────────────────────────────────────

async function DistributedContent() {
  const state = await getDistributedState()

  const open_circuits     = state.circuit_breakers.filter(b => b.state === 'open').length
  const unavailable       = state.region_health.filter(r => r.status === 'unavailable').length
  const unhealthy_workers = state.worker_health.filter(w => !w.is_healthy).length

  const total_queued = state.queue_counts.reduce((s, r) => s + r.count, 0)

  const overall =
    unavailable >= 2 || open_circuits >= 2     ? 'CRITICAL' :
    unavailable >= 1 || open_circuits >= 1     ? 'DEGRADED' :
    state.backpressure.paused_count > 0        ? 'WARNING' : 'HEALTHY'

  const overall_color =
    overall === 'CRITICAL' ? 'text-red-400' :
    overall === 'DEGRADED' ? 'text-amber-400' :
    overall === 'WARNING'  ? 'text-yellow-400' : 'text-emerald-400'

  return (
    <>
      {/* Overall status badge */}
      <div className={`flex items-center gap-2 text-sm font-bold ${overall_color}`}>
        <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
        {overall}
      </div>

      {/* Active Failovers Alert */}
      {state.active_failovers.length > 0 && (
        <div className="bg-red-950/40 border border-red-800 rounded-lg p-4">
          <p className="text-red-300 font-semibold mb-2">🚨 Active Failovers ({state.active_failovers.length})</p>
          {state.active_failovers.map(f => (
            <div key={f.failover_id} className="text-sm text-red-400/80">
              {f.from_region} → {f.to_region} · trigger: {f.trigger} · since {new Date(f.started_at).toLocaleTimeString()}
            </div>
          ))}
        </div>
      )}

      {/* Regions + Circuit Breakers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {state.region_health.map(region => {
          const breaker = state.circuit_breakers.find(b => b.region === region.region)
          const worker_state = state.region_states.find(s => s.region === region.region)
          const lag = state.regional_lag[region.region] ?? 0

          return (
            <div key={region.region} className={`bg-[#111118] border rounded-lg p-4 ${
              region.status === 'unavailable' ? 'border-red-800/60' :
              region.status === 'degraded'   ? 'border-amber-800/60' : 'border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-200 font-semibold">{region.region}</span>
                <div className="flex items-center text-xs">
                  {statusDot(region.status)}
                  <span className="text-slate-400">{region.status}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Queue lag</span>
                  <span className={`font-mono ${region.queue_lag > 5000 ? 'text-red-400' : 'text-slate-300'}`}>
                    {region.queue_lag.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Latency p95</span>
                  <span className={`font-mono ${region.latency_p95_ms > 2000 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {region.latency_p95_ms}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kafka lag</span>
                  <span className="text-slate-300 font-mono">{lag.toLocaleString()}</span>
                </div>
                {breaker && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Circuit</span>
                    <div className="flex items-center">
                      {statusDot(breaker.state)}
                      <span className={`font-mono ${
                        breaker.state === 'open'      ? 'text-red-400' :
                        breaker.state === 'half-open' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{breaker.state}</span>
                    </div>
                  </div>
                )}
                {breaker && breaker.consecutive_errors > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Errors</span>
                    <span className="text-amber-400 font-mono">{breaker.consecutive_errors} consecutive</span>
                  </div>
                )}
                {worker_state && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Workers</span>
                      <span className="text-slate-300 font-mono">{worker_state.active_workers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shards</span>
                      <span className="text-slate-300 font-mono">
                        {worker_state.assigned_shards}/{worker_state.total_shards}
                        {worker_state.unassigned_shards > 0 && (
                          <span className="text-red-400 ml-1">({worker_state.unassigned_shards} unassigned)</span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Backpressure + Kafka */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Backpressure */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Backpressure</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Paused orgs',    value: state.backpressure.paused_count,    warn: state.backpressure.paused_count > 0 },
              { label: 'Throttled orgs', value: state.backpressure.throttled_count, warn: state.backpressure.throttled_count > 5 },
              { label: 'Total org states', value: state.backpressure.org_states.length, warn: false },
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-slate-500">{row.label}</span>
                <span className={`font-mono font-semibold ${row.warn ? 'text-amber-400' : 'text-slate-300'}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/50 text-xs text-slate-500">
            Watermarks: org 100→1K events · region 10K→100K events
          </div>
        </div>

        {/* Kafka Clusters */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Kafka Clusters
            <span className={`ml-2 text-xs font-normal ${state.distributed_mode ? 'text-emerald-400' : 'text-slate-500'}`}>
              {state.distributed_mode ? '● Active' : '○ Fallback mode (DB queue)'}
            </span>
          </h2>
          {state.kafka.length === 0 ? (
            <p className="text-slate-500 text-sm">No Kafka clusters registered — using DB queue fallback</p>
          ) : (
            <div className="space-y-3">
              {state.kafka.map(cluster => (
                <div key={cluster.cluster_id} className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    {statusDot(cluster.status)}
                    <span className="text-slate-200 font-medium">{cluster.cluster_id}</span>
                    <span className="text-slate-500 text-xs">{cluster.region}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500 ml-4">
                    <span>Brokers: {cluster.broker_count}</span>
                    <span>Topics: {cluster.topic_count}</span>
                    <span className={cluster.consumer_lag > 1000 ? 'text-amber-400' : ''}>
                      Lag: {cluster.consumer_lag}
                    </span>
                    <span>p99: {cluster.latency_p99_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Worker Health */}
      {state.worker_health.length > 0 && (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Workers ({state.worker_health.length})
            {unhealthy_workers > 0 && (
              <span className="ml-2 text-xs text-red-400 font-normal">{unhealthy_workers} unhealthy</span>
            )}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {state.worker_health.map(w => (
              <div key={w.worker_id} className={`p-3 rounded-md text-xs ${
                w.is_healthy ? 'bg-slate-800/30' : 'bg-red-950/30 border border-red-900/50'
              }`}>
                <div className="flex items-center gap-1 mb-1">
                  {statusDot(w.is_healthy ? 'healthy' : 'unavailable')}
                  <span className="text-slate-300 font-mono truncate">{w.worker_id.slice(-12)}</span>
                </div>
                <div className="text-slate-500 space-y-0.5">
                  <div>Region: {w.region}</div>
                  <div>Partitions: {w.partition_count}</div>
                  <div className={w.error_rate > 0.1 ? 'text-amber-400' : ''}>
                    Errors: {(w.error_rate * 100).toFixed(1)}%
                  </div>
                  <div className={!w.is_healthy ? 'text-red-400' : ''}>
                    Age: {Math.round(w.last_heartbeat_age_ms / 1000)}s
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section A — Region Routing KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Current Region</p>
          <p className="text-xl font-bold text-white font-mono">{state.current_region}</p>
          <p className="text-xs text-slate-500 mt-1">
            {process.env.VERCEL_REGION ? 'VERCEL_REGION' : process.env.AWS_REGION ? 'AWS_REGION' : 'default fallback'}
          </p>
        </div>
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Partition Strategy</p>
          <p className="text-base font-bold text-white font-mono">{'{tenant_id}:{event_type}'}</p>
          <p className="text-xs text-slate-500 mt-1">FNV-1a · 128 partitions · consistent hash</p>
        </div>
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ordering Guarantee</p>
          <p className="text-base font-bold text-emerald-400">Lamport + Global Seq</p>
          <p className="text-xs text-slate-500 mt-1">Causal ordering · per-tenant monotonic</p>
        </div>
      </div>

      {/* Section B — Event Envelope Spec */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Event Envelope — Field Spec</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left py-2 pr-4 font-medium">Field</th>
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {[
                { field: 'event_id',         type: 'UUID',         desc: 'Global idempotency key — never reused' },
                { field: 'event_type',        type: 'string',       desc: 'LEAD_CREATED · DEAL_WON · KPI_ANOMALY …' },
                { field: 'tenant_id',         type: 'UUID',         desc: 'Org isolation — mandatory, never null' },
                { field: 'region',            type: 'string',       desc: `Active region: ${state.current_region}` },
                { field: 'partition_key',     type: 'string',       desc: '{tenant_id}:{event_type} — Kafka/Redis routing' },
                { field: 'logical_timestamp', type: 'number',       desc: 'Lamport clock · Redis INCR · lamport:{tenant_id} · 200ms timeout · fallback: Date.now()' },
                { field: 'idempotency_key',   type: 'string',       desc: 'SHA-256 of event_id + tenant_id (64 hex chars)' },
                { field: 'replay_token',      type: 'string',       desc: 'Tamper-evident token for safe replay · 32-char SHA-256 prefix' },
                { field: 'global_seq',        type: 'number',       desc: 'Redis INCR on global_seq:{tenant_id} — per-tenant monotonic' },
                { field: 'schema_version',    type: '\'vFINAL\'',   desc: 'Envelope contract version — immutable after commit' },
              ].map(row => (
                <tr key={row.field} className="hover:bg-slate-800/20">
                  <td className="py-2 pr-4 font-mono text-cyan-400">{row.field}</td>
                  <td className="py-2 pr-4 font-mono text-amber-400/80">{row.type}</td>
                  <td className="py-2 text-slate-400">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section C — Backend Configuration */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Event Backbone Configuration</h2>
        <div className="space-y-3">
          {[
            {
              role:    'Primary',
              backend: 'Kafka',
              detail:  'Multi-cluster · exactly-once semantics · idempotent producer · transactional API',
              color:   'text-emerald-400',
              active:  state.distributed_mode,
            },
            {
              role:    'Fallback',
              backend: 'NATS JetStream',
              detail:  'At-least-once · push consumers · ack timeout 30s · per-subject streams',
              color:   'text-sky-400',
              active:  !state.distributed_mode && state.kafka.length === 0,
            },
            {
              role:    'Edge Buffer',
              backend: 'Redis Streams',
              detail:  'XADD/XREADGROUP · consumer groups · trimmed at 10K per stream · 200ms Lamport clock',
              color:   'text-violet-400',
              active:  true,  // always available as edge buffer
            },
          ].map(row => (
            <div key={row.backend} className="flex items-start gap-3 text-sm">
              <span className={`w-16 shrink-0 text-xs font-medium text-slate-500 pt-0.5`}>{row.role}</span>
              <span className={`font-semibold font-mono w-28 shrink-0 ${row.color}`}>{row.backend}</span>
              <span className="text-slate-400 text-xs">{row.detail}</span>
              <span className={`ml-auto shrink-0 text-xs font-medium ${row.active ? 'text-emerald-400' : 'text-slate-600'}`}>
                {row.active ? '● active' : '○ standby'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/50 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <span>Logical clock: Lamport · Redis INCR · <span className="font-mono text-slate-400">lamport:{'{tenant_id}'}</span></span>
          <span>Timeout: 200ms · Fallback: <span className="font-mono text-slate-400">Date.now()</span></span>
        </div>
      </div>

      {/* Section D — Queue Health */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Queue Health
          <span className="ml-2 text-xs font-normal text-slate-500">runtime_events · total {total_queued.toLocaleString()}</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {state.queue_counts.map(row => {
            const color =
              row.status === 'completed'  ? 'text-emerald-400' :
              row.status === 'pending'    ? 'text-sky-400' :
              row.status === 'processing' ? 'text-amber-400' :
              row.status === 'failed'     ? 'text-red-400' :
              row.status === 'dlq'        ? 'text-red-600' : 'text-slate-400'
            const bgColor =
              row.status === 'failed' || row.status === 'dlq'
                ? 'bg-red-950/20 border border-red-900/30'
                : 'bg-slate-800/20'
            return (
              <div key={row.status} className={`rounded-md p-3 text-center ${bgColor}`}>
                <p className={`text-2xl font-bold font-mono ${color}`}>{row.count.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">{row.status}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <p className="text-slate-600 text-xs text-right">
        FNV-1a · 128 partitions · eu-west[0–42] · us-east[43–85] · ap-south[86–127]
      </p>
    </>
  )
}

export default function DistributedPage() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100">
      {/* Static header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Distributed Infrastructure</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            3 regions · circuit breakers · workers · Kafka · backpressure
          </p>
        </div>
      </div>
      <Suspense fallback={<DistributedSkeleton />}>
        <DistributedContent />
      </Suspense>
    </div>
  )
}
