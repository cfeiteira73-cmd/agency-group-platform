// =============================================================================
// Agency Group — Incident Impact Analyzer
// lib/incidents/impactAnalyzer.ts
//
// Quantifies the economic impact of an incident by combining:
//   • Pre-incident economics baseline  (getCachedTenantEconomics)
//   • Real-time cost window during incident  (getRollingCostWindow)
//   • Live traffic throughput profile  (getRealWorldLoadProfile)
//
// Fail-open: missing economics data → returns zeros + confidence=0.2
// Never throws to caller.
//
// TypeScript strict — 0 errors
// =============================================================================

import { getCachedTenantEconomics }  from '@/lib/billing/economicsCache'
import { getRollingCostWindow }       from '@/lib/economics/costStreamEngine'
import { getRealWorldLoadProfile }    from '@/lib/reality/humanTrafficRouter'
import type { IncidentRow, IncidentSeverity } from '@/lib/incidents/incidentIngestor'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface IncidentImpact {
  incident_id:              string
  tenant_id:                string
  analyzed_at:              string
  duration_minutes:         number         // estimated incident duration
  revenue_loss_eur:         number         // estimated lost revenue
  cost_overrun_eur:         number         // extra costs incurred
  ai_cost_spike_eur:        number         // AI cost above baseline
  infra_cost_waste_eur:     number         // infra cost above baseline
  affected_tenant_count:    number         // always 1 for single-tenant
  sla_breach_risk:          'none' | 'low' | 'medium' | 'high' | 'critical'
  recovery_cost_eur:        number         // estimated cost to fix (engineering time proxy)
  total_economic_impact_eur: number        // sum of all negative impacts
  confidence:               number         // 0–1
}

// ─── SLA breach risk mapping ──────────────────────────────────────────────────

function severityToSlaRisk(
  severity: IncidentSeverity,
): IncidentImpact['sla_breach_risk'] {
  switch (severity) {
    case 'P0': return 'critical'
    case 'P1': return 'high'
    case 'P2': return 'medium'
    case 'P3': return 'low'
    default:   return 'none'
  }
}

// ─── Zero/fallback impact ─────────────────────────────────────────────────────

function zeroImpact(incident: IncidentRow, durationMinutes: number): IncidentImpact {
  return {
    incident_id:               incident.incident_id,
    tenant_id:                 incident.tenant_id,
    analyzed_at:               new Date().toISOString(),
    duration_minutes:          durationMinutes,
    revenue_loss_eur:          0,
    cost_overrun_eur:          0,
    ai_cost_spike_eur:         0,
    infra_cost_waste_eur:      0,
    affected_tenant_count:     1,
    sla_breach_risk:           severityToSlaRisk(incident.severity),
    recovery_cost_eur:         Math.round(durationMinutes * 0.50 * 100) / 100,
    total_economic_impact_eur: Math.round(durationMinutes * 0.50 * 100) / 100,
    confidence:                0.2,
  }
}

// ─── Duration estimation ──────────────────────────────────────────────────────

/**
 * Returns estimated incident duration in minutes.
 * Uses resolved_at − detected_at when resolved; otherwise now − detected_at.
 * Capped at 480 minutes (8 hours).
 */
function estimateDurationMinutes(incident: IncidentRow): number {
  const detectedMs  = new Date(incident.detected_at).getTime()
  const resolvedMs  = incident.resolved_at
    ? new Date(incident.resolved_at).getTime()
    : Date.now()

  const rawMinutes = Math.max(0, (resolvedMs - detectedMs) / 60_000)
  return Math.min(rawMinutes, 480)
}

// ─── Revenue degradation factor ───────────────────────────────────────────────

/**
 * Returns a multiplier (0–1) representing how much revenue is lost due to
 * degraded latency. Applied to the full revenue_loss computation.
 *
 *   p95 < 1000ms  → 0    (no degradation)
 *   p95 1000–3000 → 0.30 (30% degradation)
 *   p95 > 3000ms  → 0.70 (70% degradation)
 */
function latencyDegradationFactor(p95LatencyMs: number): number {
  if (p95LatencyMs > 3000) return 0.70
  if (p95LatencyMs > 1000) return 0.30
  return 0
}

// ─── analyzeImpact ────────────────────────────────────────────────────────────

/**
 * Analyses the economic impact of an incident.
 *
 * Steps:
 *  1. Compute duration from detected_at → resolved_at (or now), cap at 480 min.
 *  2. Fetch economics baseline + cost window + traffic profile in parallel.
 *  3. Estimate revenue loss, cost overrun, AI / infra spikes, recovery cost.
 *  4. Return IncidentImpact with a confidence score.
 *
 * Fail-open: if economics/traffic data are unavailable, falls back to the
 * incident's metrics_snapshot (if present), then to zeros.
 * Never throws.
 */
export async function analyzeImpact(incident: IncidentRow): Promise<IncidentImpact> {
  const durationMinutes = estimateDurationMinutes(incident)
  const durationHours   = durationMinutes / 60

  // ── Parallel data fetches (all fail-open) ──────────────────────────────────

  const [economicsResult, costWindowResult, trafficResult] = await Promise.allSettled([
    getCachedTenantEconomics(incident.tenant_id),
    getRollingCostWindow(incident.tenant_id, 3600),      // 1-hour cost window
    getRealWorldLoadProfile(incident.tenant_id, 3600),   // 1-hour traffic window
  ])

  // ── Check if we have usable data ──────────────────────────────────────────

  const economics  = economicsResult.status  === 'fulfilled' ? economicsResult.value  : null
  const costWindow = costWindowResult.status === 'fulfilled' ? costWindowResult.value : null
  const traffic    = trafficResult.status    === 'fulfilled' ? trafficResult.value    : null

  const hasEconomics = economics  !== null && (economics.revenue_per_request > 0 || economics.cost_per_day > 0)
  const hasCostData  = costWindow !== null && costWindow.event_count > 0
  const hasTraffic   = traffic    !== null && traffic.sample_count > 0

  // ── Fail-open: try metrics_snapshot if primary data missing ───────────────

  if (!hasEconomics && !hasCostData && !hasTraffic) {
    // Attempt to derive from metrics_snapshot
    const snap = incident.metrics_snapshot as Record<string, unknown> | null | undefined
    if (snap && typeof snap['cost_eur'] === 'number' && (snap['cost_eur'] as number) > 0) {
      const snapCost        = snap['cost_eur'] as number
      const recoveryCost    = Math.round(durationMinutes * 0.50 * 100) / 100
      const totalImpact     = Math.round((snapCost + recoveryCost) * 100) / 100
      return {
        incident_id:               incident.incident_id,
        tenant_id:                 incident.tenant_id,
        analyzed_at:               new Date().toISOString(),
        duration_minutes:          Math.round(durationMinutes * 10) / 10,
        revenue_loss_eur:          0,
        cost_overrun_eur:          Math.round(snapCost * 100) / 100,
        ai_cost_spike_eur:         0,
        infra_cost_waste_eur:      0,
        affected_tenant_count:     1,
        sla_breach_risk:           severityToSlaRisk(incident.severity),
        recovery_cost_eur:         recoveryCost,
        total_economic_impact_eur: totalImpact,
        confidence:                0.2,
      }
    }
    return zeroImpact(incident, Math.round(durationMinutes * 10) / 10)
  }

  // ── Revenue loss estimation ────────────────────────────────────────────────
  //
  //  revenue_loss = revenue_per_request × throughput_rps × duration_seconds × degradation_factor
  //
  //  Throughput from real traffic profile (or 0 if unavailable).
  //  Degradation factor from p95 latency.

  const revenuePerRequest = economics?.revenue_per_request ?? 0
  const throughputRps     = hasTraffic ? (traffic!.throughput_rps) : 0
  const p95Latency        = hasTraffic ? (traffic!.p95_latency_ms) : 0
  const degradation       = latencyDegradationFactor(p95Latency)

  const durationSeconds   = durationMinutes * 60
  const rawRevenueLoss    = revenuePerRequest * throughputRps * durationSeconds
  const revenueLoss       = Math.round(rawRevenueLoss * degradation * 100) / 100

  // ── Cost overrun ──────────────────────────────────────────────────────────
  //
  //  baseline_cost_during_window = cost_per_day / 24 × duration_hours
  //  cost_overrun = actual_cost_in_window - baseline_cost_during_window

  const costPerDay             = economics?.cost_per_day ?? 0
  const baselineCostForPeriod  = (costPerDay / 24) * durationHours
  const actualCostInWindow     = hasCostData ? costWindow!.total_cost_eur : 0
  const costOverrun            = Math.max(0, Math.round((actualCostInWindow - baselineCostForPeriod) * 10_000) / 10_000)

  // ── AI cost spike ─────────────────────────────────────────────────────────
  //
  //  baseline expected AI cost = ai_load × cost_per_day / 24 × duration_hours
  //  spike = max(0, actual_ai_cost - baseline_ai_cost)

  const aiLoad              = economics?.ai_load ?? 0
  const baselineAiCost      = aiLoad * (costPerDay / 24) * durationHours
  const actualAiCost        = hasCostData ? costWindow!.ai_cost_eur : 0
  const aiCostSpike         = Math.max(0, Math.round((actualAiCost - baselineAiCost) * 10_000) / 10_000)

  // ── Infra cost waste ──────────────────────────────────────────────────────

  const infraLoad           = economics?.infra_load ?? 0
  const baselineInfraCost   = infraLoad * (costPerDay / 24) * durationHours
  const actualInfraCost     = hasCostData ? costWindow!.infra_cost_eur : 0
  const infraCostWaste      = Math.max(0, Math.round((actualInfraCost - baselineInfraCost) * 10_000) / 10_000)

  // ── Recovery cost ─────────────────────────────────────────────────────────
  //  €0.50/minute engineering cost proxy

  const recoveryCost = Math.round(durationMinutes * 0.50 * 100) / 100

  // ── Total economic impact ─────────────────────────────────────────────────

  const totalImpact = Math.round((revenueLoss + costOverrun + recoveryCost) * 100) / 100

  // ── Confidence score ──────────────────────────────────────────────────────
  //  Start at 0.4 base; +0.2 for each of: economics, cost window, traffic

  let confidence = 0.4
  if (hasEconomics) confidence += 0.2
  if (hasCostData)  confidence += 0.2
  if (hasTraffic)   confidence += 0.2
  confidence = Math.round(confidence * 100) / 100

  return {
    incident_id:               incident.incident_id,
    tenant_id:                 incident.tenant_id,
    analyzed_at:               new Date().toISOString(),
    duration_minutes:          Math.round(durationMinutes * 10) / 10,
    revenue_loss_eur:          revenueLoss,
    cost_overrun_eur:          costOverrun,
    ai_cost_spike_eur:         aiCostSpike,
    infra_cost_waste_eur:      infraCostWaste,
    affected_tenant_count:     1,
    sla_breach_risk:           severityToSlaRisk(incident.severity),
    recovery_cost_eur:         recoveryCost,
    total_economic_impact_eur: totalImpact,
    confidence,
  }
}
