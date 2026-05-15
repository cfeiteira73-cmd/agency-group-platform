// AGENCY GROUP — Distributed API: Health | AMI: 22506
// GET /api/distributed/health — full distributed system health snapshot
// Returns: regions, circuit breakers, worker states, backpressure, Kafka clusters
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import {
  multiRegionRouter,
  globalFailoverController,
  distributedBackpressureController,
  kafkaClusterAdapter,
  regionalWorkerCoordinator,
} from '@/lib/runtime/distributed'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Collect all distributed system state in parallel
    const [
      region_health,
      routing_stats,
      circuit_breakers,
      active_failovers,
      backpressure_snapshot,
      kafka_health,
      regional_lag,
      worker_health,
      region_states,
    ] = await Promise.all([
      Promise.resolve(multiRegionRouter.getRegionHealth()),
      Promise.resolve(multiRegionRouter.getRoutingStats()),
      Promise.resolve(globalFailoverController.getCircuitBreakerState()),
      Promise.resolve(globalFailoverController.getActiveFailovers()),
      Promise.resolve(distributedBackpressureController.getSnapshot()),
      Promise.resolve(kafkaClusterAdapter.getClusterHealth()),
      Promise.resolve(kafkaClusterAdapter.getRegionalLag()),
      regionalWorkerCoordinator.scanHeartbeats(),
      Promise.resolve(regionalWorkerCoordinator.getAllRegionStates()),
    ])

    // Compute overall health score
    const unavailable_regions = region_health.filter(r => r.status === 'unavailable').length
    const open_circuits        = circuit_breakers.filter(b => b.state === 'open').length
    const paused_orgs          = backpressure_snapshot.paused_count
    const unhealthy_workers    = worker_health.filter(w => !w.is_healthy).length

    const overall_status =
      unavailable_regions >= 2 || open_circuits >= 2 ? 'critical' :
      unavailable_regions >= 1 || open_circuits >= 1 ? 'degraded' :
      paused_orgs > 0 || unhealthy_workers > 0 ? 'warning' : 'healthy'

    return NextResponse.json({
      overall_status,
      correlation_id,
      evaluated_at: new Date().toISOString(),

      regions: {
        health:      region_health,
        routing:     routing_stats,
      },

      circuit_breakers: {
        states:          circuit_breakers,
        active_failovers,
        open_count:      open_circuits,
      },

      backpressure: {
        ...backpressure_snapshot,
        paused_count:    paused_orgs,
        throttled_count: backpressure_snapshot.throttled_count,
      },

      kafka: {
        clusters:       kafka_health,
        regional_lag,
        distributed_mode_active: routing_stats.kafka_active,
      },

      workers: {
        health:          worker_health,
        region_states,
        unhealthy_count: unhealthy_workers,
      },
    }, {
      headers: {
        'X-Correlation-ID': correlation_id,
        'Cache-Control':    'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Distributed health check failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
