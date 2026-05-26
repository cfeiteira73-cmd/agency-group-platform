// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/observability/rootCauseInferenceEngine.ts
// Rule-based root cause analysis correlating anomaly alerts to probable causes
// Wave 44 Agent 4 — Advanced Observability + Control Plane
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'
import type { AnomalyAlert, MetricName } from './anomalyDetectionEngine'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RootCauseCategory =
  | 'SUPPLY_DEGRADATION'
  | 'ML_DRIFT'
  | 'CAPITAL_PIPELINE_STALL'
  | 'DATABASE_PERFORMANCE'
  | 'EXTERNAL_API_FAILURE'
  | 'SECURITY_EVENT'
  | 'CONFIGURATION_ERROR'
  | 'DATA_QUALITY_ISSUE'
  | 'NETWORK_LATENCY'
  | 'UNKNOWN'

export interface RootCauseAnalysis {
  rca_id: string
  tenant_id: string
  trigger_alert_ids: string[]
  probable_cause: RootCauseCategory
  confidence: number
  evidence: string[]
  recommended_actions: string[]
  auto_recoverable: boolean
  analyzed_at: string
}

// ─── Cause → actions map ─────────────────────────────────────────────────────

const CAUSE_ACTIONS: Record<RootCauseCategory, string[]> = {
  SUPPLY_DEGRADATION: [
    'Check Idealista/Casafari API credentials',
    'Review ingestion_runs for failures',
    'Check rate limits',
  ],
  ML_DRIFT: [
    'Run ML retraining pipeline',
    'Check ml_reality_alignments drift_score',
    'Validate truth labels',
  ],
  CAPITAL_PIPELINE_STALL: [
    'Check PSP connectivity',
    'Review escrow_positions for PENDING_DEPOSIT > 48h',
    'Alert operations team',
  ],
  DATABASE_PERFORMANCE: [
    'Run VACUUM ANALYZE on key tables',
    'Check index usage',
    'Review slow query log',
  ],
  EXTERNAL_API_FAILURE: [
    'Check third-party API status pages',
    'Review error logs for 4xx/5xx from external calls',
    'Enable fallback data sources',
  ],
  SECURITY_EVENT: [
    'Review auth logs for suspicious activity',
    'Check for brute-force patterns',
    'Rotate affected credentials immediately',
  ],
  CONFIGURATION_ERROR: [
    'Validate environment variables',
    'Review recent deployments',
    'Diff configuration against last known-good state',
  ],
  DATA_QUALITY_ISSUE: [
    'Run data integrity checks on affected tables',
    'Review ETL pipeline for schema changes',
    'Validate upstream data sources',
  ],
  NETWORK_LATENCY: [
    'Check CDN / edge network status',
    'Review DNS resolution times',
    'Check cloud provider status page',
  ],
  UNKNOWN: [
    'Escalate to on-call engineering',
    'Collect full trace_id set from affected period',
    'Review all active anomaly alerts',
  ],
}

const CAUSE_AUTO_RECOVERABLE: Record<RootCauseCategory, boolean> = {
  SUPPLY_DEGRADATION: false,
  ML_DRIFT: false,
  CAPITAL_PIPELINE_STALL: false,
  DATABASE_PERFORMANCE: true,
  EXTERNAL_API_FAILURE: false,
  SECURITY_EVENT: false,
  CONFIGURATION_ERROR: false,
  DATA_QUALITY_ISSUE: false,
  NETWORK_LATENCY: true,
  UNKNOWN: false,
}

// ─── Rule Engine ─────────────────────────────────────────────────────────────

interface RuleResult {
  cause: RootCauseCategory
  confidence: number
  evidence: string[]
}

function applyRules(alerts: AnomalyAlert[]): RuleResult {
  const metrics = new Set<MetricName>(alerts.map((a) => a.metric_name))

  // Rule 1: supply + opportunity score anomalies → SUPPLY_DEGRADATION
  if (metrics.has('supply_ingestion_count') && metrics.has('opportunity_score_avg')) {
    return {
      cause: 'SUPPLY_DEGRADATION',
      confidence: 0.85,
      evidence: [
        `supply_ingestion_count anomaly detected (z=${alerts.find((a) => a.metric_name === 'supply_ingestion_count')?.z_score?.toFixed(2)})`,
        `opportunity_score_avg anomaly detected (z=${alerts.find((a) => a.metric_name === 'opportunity_score_avg')?.z_score?.toFixed(2)})`,
        'Correlated drop in ingestion and scoring suggests upstream supply degradation',
      ],
    }
  }

  // Rule 2: deal_close_rate drop + opportunity_score_avg anomaly → ML_DRIFT
  if (metrics.has('deal_close_rate') && metrics.has('opportunity_score_avg')) {
    return {
      cause: 'ML_DRIFT',
      confidence: 0.8,
      evidence: [
        `deal_close_rate anomaly detected (z=${alerts.find((a) => a.metric_name === 'deal_close_rate')?.z_score?.toFixed(2)})`,
        `opportunity_score_avg anomaly detected (z=${alerts.find((a) => a.metric_name === 'opportunity_score_avg')?.z_score?.toFixed(2)})`,
        'Divergence between scores and close rate suggests ML model drift',
      ],
    }
  }

  // Rule 3: capital_flow_cents + escrow_balance_cents anomalies → CAPITAL_PIPELINE_STALL
  if (metrics.has('capital_flow_cents') && metrics.has('escrow_balance_cents')) {
    return {
      cause: 'CAPITAL_PIPELINE_STALL',
      confidence: 0.75,
      evidence: [
        `capital_flow_cents anomaly detected (z=${alerts.find((a) => a.metric_name === 'capital_flow_cents')?.z_score?.toFixed(2)})`,
        `escrow_balance_cents anomaly detected (z=${alerts.find((a) => a.metric_name === 'escrow_balance_cents')?.z_score?.toFixed(2)})`,
        'Concurrent capital flow and escrow anomalies indicate pipeline stall',
      ],
    }
  }

  // Rule 4: api_response_ms spike
  if (metrics.has('api_response_ms')) {
    const apiAlert = alerts.find((a) => a.metric_name === 'api_response_ms')
    const absZ = Math.abs(apiAlert?.z_score ?? 0)

    // High z-score on API latency with other DB-related signals → DATABASE_PERFORMANCE
    if (absZ > 3) {
      return {
        cause: 'DATABASE_PERFORMANCE',
        confidence: 0.7,
        evidence: [
          `api_response_ms anomaly detected (z=${apiAlert?.z_score?.toFixed(2)}, level=${apiAlert?.level})`,
          'Severe API latency spike consistent with database query degradation',
        ],
      }
    } else {
      return {
        cause: 'NETWORK_LATENCY',
        confidence: 0.6,
        evidence: [
          `api_response_ms anomaly detected (z=${apiAlert?.z_score?.toFixed(2)}, level=${apiAlert?.level})`,
          'Moderate API latency spike consistent with network latency',
        ],
      }
    }
  }

  // Rule 5: error_rate_pct spike → EXTERNAL_API_FAILURE
  if (metrics.has('error_rate_pct')) {
    return {
      cause: 'EXTERNAL_API_FAILURE',
      confidence: 0.65,
      evidence: [
        `error_rate_pct anomaly detected (z=${alerts.find((a) => a.metric_name === 'error_rate_pct')?.z_score?.toFixed(2)})`,
        'Elevated error rate consistent with external API failure',
      ],
    }
  }

  // Default
  return {
    cause: 'UNKNOWN',
    confidence: 0.3,
    evidence: [
      `${alerts.length} anomaly alert(s) could not be correlated to a known pattern`,
      `Metrics affected: ${[...metrics].join(', ')}`,
    ],
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Infer root cause from a set of anomaly alert IDs.
 * Fetches the alerts, runs the rule engine, persists the RCA, and returns it.
 */
export async function inferRootCause(
  alertIds: string[],
  tenantId: string
): Promise<RootCauseAnalysis> {
  const rcaId = randomUUID()
  const analyzedAt = new Date().toISOString()

  let alerts: AnomalyAlert[] = []
  try {
    const { data } = await (supabaseAdmin as any)
      .from('anomaly_alerts')
      .select('*')
      .in('alert_id', alertIds)

    alerts = (data ?? []) as AnomalyAlert[]
  } catch (e) {
    log.warn('[rootCauseInferenceEngine] failed to fetch alerts', { err: String(e) })
  }

  const ruleResult = applyRules(alerts.length > 0 ? alerts : [])
  const actions = CAUSE_ACTIONS[ruleResult.cause]
  const autoRecoverable = CAUSE_AUTO_RECOVERABLE[ruleResult.cause]

  const rca: RootCauseAnalysis = {
    rca_id: rcaId,
    tenant_id: tenantId,
    trigger_alert_ids: alertIds,
    probable_cause: ruleResult.cause,
    confidence: ruleResult.confidence,
    evidence: ruleResult.evidence,
    recommended_actions: actions,
    auto_recoverable: autoRecoverable,
    analyzed_at: analyzedAt,
  }

  void (supabaseAdmin as any)
    .from('root_cause_analyses')
    .insert({
      rca_id: rcaId,
      tenant_id: tenantId,
      trigger_alert_ids: alertIds,
      probable_cause: ruleResult.cause,
      confidence: ruleResult.confidence,
      evidence: ruleResult.evidence,
      recommended_actions: actions,
      auto_recoverable: autoRecoverable,
      analyzed_at: analyzedAt,
    })
    .catch((e: unknown) =>
      console.warn('[rootCauseInferenceEngine] RCA persist failed:', e)
    )

  return rca
}

/**
 * Return recent RCA history for a tenant.
 */
export async function getRecentRcaHistory(
  tenantId: string,
  limit = 20
): Promise<RootCauseAnalysis[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('root_cause_analyses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('analyzed_at', { ascending: false })
      .limit(limit)

    if (error) {
      log.warn('[rootCauseInferenceEngine] getRecentRcaHistory error', { err: error })
      return []
    }

    return (data ?? []) as RootCauseAnalysis[]
  } catch (e) {
    log.warn('[rootCauseInferenceEngine] getRecentRcaHistory exception', { err: String(e) })
    return []
  }
}
