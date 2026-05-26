import { supabaseAdmin } from '@/lib/supabase'

export interface ServiceLevelObjective {
  slo_id: string
  name: string
  description: string
  target_pct: number // e.g., 99.9
  window_days: number
  metric_query: string // description of what to measure
  current_value: number | null
  status: 'MEETING' | 'AT_RISK' | 'BREACHED' | 'UNKNOWN'
  error_budget_remaining_pct: number | null
}

export const SYSTEM_SLOS: Omit<ServiceLevelObjective, 'current_value' | 'status' | 'error_budget_remaining_pct'>[] = [
  { slo_id: 'api-availability', name: 'API Availability', description: 'API endpoints return 2xx/3xx', target_pct: 99.9, window_days: 30, metric_query: 'trace_spans success rate' },
  { slo_id: 'supply-freshness', name: 'Supply Data Freshness', description: 'New opportunities ingested within 24h', target_pct: 99.5, window_days: 7, metric_query: 'ingestion_runs last_run < 24h' },
  { slo_id: 'capital-execution', name: 'Capital Execution Success', description: 'Pipeline stages advance without stall > 48h', target_pct: 99.0, window_days: 30, metric_query: 'capital_execution_pipelines completion rate' },
  { slo_id: 'ml-accuracy', name: 'ML Model Accuracy', description: 'ML drift score < 0.2', target_pct: 95.0, window_days: 7, metric_query: 'ml_reality_alignments drift_score' },
  { slo_id: 'data-quality', name: 'Data Source Quality', description: 'Source validation rejection rate < 10%', target_pct: 90.0, window_days: 7, metric_query: 'validated_data_points rejection_rate' },
  { slo_id: 'kyc-compliance', name: 'KYC Processing SLA', description: 'KYC decisions within 48h', target_pct: 95.0, window_days: 30, metric_query: 'kyc_records processing time' },
  { slo_id: 'gdpr-deadline', name: 'GDPR Response SLA', description: 'GDPR requests completed within 30 days', target_pct: 100.0, window_days: 30, metric_query: 'gdpr_requests deadline compliance' },
  { slo_id: 'escrow-integrity', name: 'Escrow Integrity', description: 'Zero orphan escrow positions', target_pct: 100.0, window_days: 30, metric_query: 'escrow_positions orphan_count = 0' },
]

export async function measureSlo(sloId: string, tenantId: string): Promise<Pick<ServiceLevelObjective, 'current_value' | 'status' | 'error_budget_remaining_pct'>> {
  try {
    if (sloId === 'api-availability') {
      const { count: total } = await (supabaseAdmin as any).from('trace_spans').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('started_at', new Date(Date.now() - 86_400_000 * 7).toISOString())
      const { count: errors } = await (supabaseAdmin as any).from('trace_spans').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'FAILED').gte('started_at', new Date(Date.now() - 86_400_000 * 7).toISOString())
      const t = total ?? 0, e = errors ?? 0
      const val = t > 0 ? ((t - e) / t) * 100 : 100
      const slo = SYSTEM_SLOS.find(s => s.slo_id === sloId)!
      const status: ServiceLevelObjective['status'] = val >= slo.target_pct ? 'MEETING' : val >= slo.target_pct * 0.99 ? 'AT_RISK' : 'BREACHED'
      const errorBudget = ((val - slo.target_pct) / (100 - slo.target_pct)) * 100
      return { current_value: Math.round(val * 100) / 100, status, error_budget_remaining_pct: Math.round(errorBudget * 100) / 100 }
    }
    // For other SLOs: return UNKNOWN (real measurement would require specific queries)
    return { current_value: null, status: 'UNKNOWN', error_budget_remaining_pct: null }
  } catch {
    return { current_value: null, status: 'UNKNOWN', error_budget_remaining_pct: null }
  }
}

export async function getSloReport(tenantId: string): Promise<ServiceLevelObjective[]> {
  const results = await Promise.allSettled(SYSTEM_SLOS.map(s => measureSlo(s.slo_id, tenantId)))
  return SYSTEM_SLOS.map((slo, i) => ({
    ...slo,
    ...(results[i].status === 'fulfilled' ? results[i].value : { current_value: null, status: 'UNKNOWN' as const, error_budget_remaining_pct: null }),
  }))
}
