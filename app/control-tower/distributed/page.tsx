// AGENCY GROUP — Control Tower: Distributed System | AMI: 22506
// Multi-region health, circuit breakers, worker coordination, Kafka, backpressure
// =============================================================================

import {
  multiRegionRouter,
  globalFailoverController,
  distributedBackpressureController,
  kafkaClusterAdapter,
  regionalWorkerCoordinator,
} from '@/lib/runtime/distributed'

export const revalidate = 15  // ISR 15s

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getDistributedState() {
  const [worker_health, region_states] = await Promise.all([
    regionalWorkerCoordinator.scanHeartbeats(),
    Promise.resolve(regionalWorkerCoordinator.getAllRegionStates()),
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DistributedPage() {
  const state = await getDistributedState()

  const open_circuits     = state.circuit_breakers.filter(b => b.state === 'open').length
  const unavailable       = state.region_health.filter(r => r.status === 'unavailable').length
  const unhealthy_workers = state.worker_health.filter(w => !w.is_healthy).length

  const overall =
    unavailable >= 2 || open_circuits >= 2     ? 'CRITICAL' :
    unavailable >= 1 || open_circuits >= 1     ? 'DEGRADED' :
    state.backpressure.paused_count > 0        ? 'WARNING' : 'HEALTHY'

  const overall_color =
    overall === 'CRITICAL' ? 'text-red-400' :
    overall === 'DEGRADED' ? 'text-amber-400' :
    overall === 'WARNING'  ? 'text-yellow-400' : 'text-emerald-400'

  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Distributed Infrastructure</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            3 regions · circuit breakers · workers · Kafka · backpressure
          </p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-bold ${overall_color}`}>
          <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
          {overall}
        </div>
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

      {/* Footer */}
      <p className="text-slate-600 text-xs text-right">
        FNV-1a · 128 partitions · eu-west[0–42] · us-east[43–85] · ap-south[86–127]
      </p>
    </div>
  )
}
