import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

function metric(name: string, value: number, labels?: Record<string, string>, help?: string, type?: string): string {
  const labelStr = labels ? '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}' : ''
  const lines: string[] = []
  if (help) lines.push(`# HELP ${name} ${help}`)
  if (type) lines.push(`# TYPE ${name} ${type}`)
  lines.push(`${name}${labelStr} ${isFinite(value) ? value : 0}`)
  return lines.join('\n')
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const lines: string[] = []
  const start = Date.now()

  // Read metrics from DB in parallel
  const [
    oppCount, investorCount, escrowResult, kycResult,
    traceResult, anomalyResult, drResult, snapshotResult
  ] = await Promise.allSettled([
    (supabaseAdmin as any).from('raw_opportunity_stream').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    (supabaseAdmin as any).from('investor_capital_profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    (supabaseAdmin as any).from('escrow_positions').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    (supabaseAdmin as any).from('kyc_records').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').eq('tenant_id', TENANT_ID),
    (supabaseAdmin as any).from('trace_spans').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gte('started_at', new Date(Date.now() - 3_600_000).toISOString()),
    (supabaseAdmin as any).from('anomaly_alerts').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).is('resolved_at', null),
    (supabaseAdmin as any).from('dr_test_results').select('status').eq('tenant_id', TENANT_ID).order('scheduled_at', { ascending: false }).limit(1),
    (supabaseAdmin as any).from('performance_snapshots').select('system_health_score, api_error_rate_pct, supply_ingestion_rate_per_hour').eq('tenant_id', TENANT_ID).order('captured_at', { ascending: false }).limit(1),
  ])

  const opportunities = oppCount.status === 'fulfilled' ? (oppCount.value.count ?? 0) : 0
  const investors = investorCount.status === 'fulfilled' ? (investorCount.value.count ?? 0) : 0
  const escrows = escrowResult.status === 'fulfilled' ? (escrowResult.value.count ?? 0) : 0
  const kycApproved = kycResult.status === 'fulfilled' ? (kycResult.value.count ?? 0) : 0
  const tracesLastHour = traceResult.status === 'fulfilled' ? (traceResult.value.count ?? 0) : 0
  const activeAnomalies = anomalyResult.status === 'fulfilled' ? (anomalyResult.value.count ?? 0) : 0
  const lastDrStatus = drResult.status === 'fulfilled' ? (drResult.value.data?.[0]?.status ?? 'UNKNOWN') : 'UNKNOWN'
  const perfSnapshot = snapshotResult.status === 'fulfilled' ? (snapshotResult.value.data?.[0] ?? null) : null
  const systemHealth = perfSnapshot?.system_health_score ?? 0
  const apiErrorRate = perfSnapshot?.api_error_rate_pct ?? 0
  const supplyRate = perfSnapshot?.supply_ingestion_rate_per_hour ?? 0
  const scrapeMs = Date.now() - start

  // --- Prometheus metrics ---
  lines.push(metric('ag_opportunities_total', opportunities, { tenant: 'default' }, 'Total opportunities ingested', 'gauge'))
  lines.push(metric('ag_investors_total', investors, { tenant: 'default' }, 'Total registered investors', 'gauge'))
  lines.push(metric('ag_escrow_positions_total', escrows, { tenant: 'default' }, 'Total escrow positions', 'gauge'))
  lines.push(metric('ag_kyc_approved_total', kycApproved, { tenant: 'default' }, 'Total KYC-approved subjects', 'gauge'))
  lines.push(metric('ag_traces_last_hour', tracesLastHour, { tenant: 'default' }, 'Trace spans in last hour', 'gauge'))
  lines.push(metric('ag_active_anomalies', activeAnomalies, { tenant: 'default' }, 'Active unresolved anomaly alerts', 'gauge'))
  lines.push(metric('ag_system_health_score', systemHealth, { tenant: 'default' }, 'System health score 0-100', 'gauge'))
  lines.push(metric('ag_api_error_rate_pct', apiErrorRate, { tenant: 'default' }, 'API error rate percentage', 'gauge'))
  lines.push(metric('ag_supply_ingestion_rate', supplyRate, { tenant: 'default' }, 'Supply ingestion rate per hour', 'gauge'))
  lines.push(metric('ag_dr_last_test_passed', lastDrStatus === 'PASSED' ? 1 : 0, { tenant: 'default' }, 'DR test last result (1=passed)', 'gauge'))
  lines.push(metric('ag_scrape_duration_ms', scrapeMs, {}, 'Metrics scrape duration milliseconds', 'gauge'))

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
