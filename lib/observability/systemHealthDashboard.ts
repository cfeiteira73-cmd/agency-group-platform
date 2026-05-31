// Agency Group — System Health Dashboard
// lib/observability/systemHealthDashboard.ts
// Wave 54 Phase 2 — Unified observability aggregator
//
// Aggregates all monitoring subsystems into a single dashboard view:
// health checks, dependency graph, incident forensics, error rates,
// service map, correlation IDs, distributed traces, alert readiness.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runRealityMonitor } from '@/lib/monitoring/realityMonitor'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'

export interface ServiceNode {
  service_id: string
  name: string
  type: 'DATABASE' | 'CACHE' | 'PSP' | 'AI' | 'EMAIL' | 'MARKET_DATA' | 'SOC' | 'CDN' | 'AUTH' | 'QUEUE'
  status: ServiceStatus
  latency_ms: number | null
  dependencies: string[]
  last_checked: string
}

export interface DependencyGraph {
  nodes: ServiceNode[]
  critical_path: string[]
  degraded_services: string[]
  down_services: string[]
}

export interface IncidentForensic {
  incident_id: string
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  service: string
  description: string
  started_at: string
  duration_ms: number | null
  resolved: boolean
  correlation_id: string | null
}

export interface AlertReadiness {
  email_alert: boolean        // Resend configured
  slack_alert: boolean        // Slack SOC webhook
  pagerduty_alert: boolean    // PagerDuty
  datadog_siem: boolean       // Datadog
  overall_alert_score: number // 0-100
}

export interface ErrorRateSummary {
  last_hour_errors: number
  last_24h_errors: number
  error_rate_pct: number
  top_error_types: Array<{ type: string; count: number }>
}

export interface SystemHealthDashboard {
  dashboard_id: string
  tenant_id: string
  overall_health: ServiceStatus
  health_score: number
  reality_score: number
  dependency_graph: DependencyGraph
  alert_readiness: AlertReadiness
  error_summary: ErrorRateSummary
  recent_incidents: IncidentForensic[]
  service_count: number
  healthy_count: number
  degraded_count: number
  down_count: number
  dashboard_hash: string
  generated_at: string
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

// ── Dependency graph builder ───────────────────────────────────────────────────

function buildDependencyGraph(checks: Array<{ check_id: string; name: string; status: string; latency_ms: number | null; category: string }>): DependencyGraph {
  const serviceMap: Record<string, ServiceNode> = {
    supabase:    { service_id: 'supabase',   name: 'Supabase DB',      type: 'DATABASE',    status: 'UNKNOWN', latency_ms: null, dependencies: [],              last_checked: new Date().toISOString() },
    redis:       { service_id: 'redis',      name: 'Upstash Redis',    type: 'CACHE',       status: 'UNKNOWN', latency_ms: null, dependencies: [],              last_checked: new Date().toISOString() },
    stripe:      { service_id: 'stripe',     name: 'Stripe PSP',       type: 'PSP',         status: 'UNKNOWN', latency_ms: null, dependencies: ['supabase'],    last_checked: new Date().toISOString() },
    anthropic:   { service_id: 'anthropic',  name: 'Anthropic AI',     type: 'AI',          status: 'UNKNOWN', latency_ms: null, dependencies: ['supabase'],    last_checked: new Date().toISOString() },
    resend:      { service_id: 'resend',     name: 'Resend Email',     type: 'EMAIL',       status: 'UNKNOWN', latency_ms: null, dependencies: [],              last_checked: new Date().toISOString() },
    idealista:   { service_id: 'idealista',  name: 'Idealista API',    type: 'MARKET_DATA', status: 'UNKNOWN', latency_ms: null, dependencies: ['supabase'],    last_checked: new Date().toISOString() },
    casafari:    { service_id: 'casafari',   name: 'Casafari API',     type: 'MARKET_DATA', status: 'UNKNOWN', latency_ms: null, dependencies: ['idealista'],   last_checked: new Date().toISOString() },
    pagerduty:   { service_id: 'pagerduty',  name: 'PagerDuty SOC',    type: 'SOC',         status: 'UNKNOWN', latency_ms: null, dependencies: [],              last_checked: new Date().toISOString() },
    datadog:     { service_id: 'datadog',    name: 'Datadog SIEM',     type: 'SOC',         status: 'UNKNOWN', latency_ms: null, dependencies: [],              last_checked: new Date().toISOString() },
    vercel:      { service_id: 'vercel',     name: 'Vercel CDN',       type: 'CDN',         status: 'UNKNOWN', latency_ms: null, dependencies: ['supabase'],    last_checked: new Date().toISOString() },
    auth:        { service_id: 'auth',       name: 'Auth (Magic Link)', type: 'AUTH',       status: 'UNKNOWN', latency_ms: null, dependencies: ['supabase','redis'], last_checked: new Date().toISOString() },
    whatsapp:    { service_id: 'whatsapp',   name: 'WhatsApp (Sofia)', type: 'QUEUE',       status: 'UNKNOWN', latency_ms: null, dependencies: ['supabase'],    last_checked: new Date().toISOString() },
  }

  // Map check results to services
  for (const check of checks) {
    const latency = check.latency_ms
    const live: ServiceStatus = check.status === 'PASS' ? 'HEALTHY' : check.status === 'WARN' ? 'DEGRADED' : 'DOWN'
    if (check.check_id.includes('db_connectivity')) { serviceMap['supabase']!.status = live; serviceMap['supabase']!.latency_ms = latency }
    if (check.check_id.includes('redis'))            { serviceMap['redis']!.status    = live; serviceMap['redis']!.latency_ms    = latency }
    if (check.check_id.includes('stripe'))           { serviceMap['stripe']!.status   = live }
    if (check.check_id.includes('anthropic'))        { serviceMap['anthropic']!.status = live; serviceMap['anthropic']!.latency_ms = latency }
    if (check.check_id.includes('resend'))           { serviceMap['resend']!.status    = live }
    if (check.check_id.includes('idealista'))        { serviceMap['idealista']!.status = live }
    if (check.check_id.includes('casafari'))         { serviceMap['casafari']!.status  = live }
    if (check.check_id.includes('pagerduty'))        { serviceMap['pagerduty']!.status = live }
    if (check.check_id.includes('datadog'))          { serviceMap['datadog']!.status   = live }
    if (check.check_id.includes('site_ping'))        { serviceMap['vercel']!.status    = live; serviceMap['vercel']!.latency_ms = latency }
    if (check.check_id.includes('whatsapp'))         { serviceMap['whatsapp']!.status  = live }
  }

  const nodes        = Object.values(serviceMap)
  const degraded     = nodes.filter(n => n.status === 'DEGRADED').map(n => n.service_id)
  const down         = nodes.filter(n => n.status === 'DOWN' || n.status === 'UNKNOWN').map(n => n.service_id)
  const criticalPath = ['auth', 'supabase', 'redis', 'stripe']  // revenue critical path

  return { nodes, critical_path: criticalPath, degraded_services: degraded, down_services: down }
}

// ── Alert readiness ────────────────────────────────────────────────────────────

function buildAlertReadiness(): AlertReadiness {
  const hasEmail    = !!process.env.RESEND_API_KEY
  const hasSlack    = !!process.env.SLACK_SOC_WEBHOOK_URL
  const hasPD       = !!process.env.PAGERDUTY_ROUTING_KEY
  const hasDatadog  = !!process.env.DATADOG_API_KEY

  const score = [hasEmail, hasSlack, hasPD, hasDatadog].filter(Boolean).length * 25

  return { email_alert: hasEmail, slack_alert: hasSlack, pagerduty_alert: hasPD, datadog_siem: hasDatadog, overall_alert_score: score }
}

// ── Error summary from DB ──────────────────────────────────────────────────────

async function fetchErrorSummary(tenantId: string): Promise<ErrorRateSummary> {
  try {
    const oneDayAgo = new Date(Date.now() - 86400_000).toISOString()
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()

    const { data: dayData } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            gte: (col2: string, val2: string) => Promise<{ data: Array<Record<string, unknown>> | null }>
          }
        }
      }
    }).from('audit_log')
      .select('result, action, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneDayAgo)

    const dayErrors   = (dayData ?? []).filter(r => r['result'] === 'error' || r['result'] === 'blocked')
    const hourErrors  = dayErrors.filter(r => (r['created_at'] as string) >= oneHourAgo)

    const typeCounts: Record<string, number> = {}
    for (const e of dayErrors) {
      const k = String(e['action'] ?? 'unknown')
      typeCounts[k] = (typeCounts[k] ?? 0) + 1
    }
    const topErrors = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))

    const total       = dayData?.length ?? 0
    const errorCount  = dayErrors.length
    const errorRate   = total > 0 ? parseFloat(((errorCount / total) * 100).toFixed(2)) : 0

    return { last_hour_errors: hourErrors.length, last_24h_errors: errorCount, error_rate_pct: errorRate, top_error_types: topErrors }
  } catch {
    return { last_hour_errors: 0, last_24h_errors: 0, error_rate_pct: 0, top_error_types: [] }
  }
}

// ── Recent incidents ───────────────────────────────────────────────────────────

async function fetchRecentIncidents(tenantId: string): Promise<IncidentForensic[]> {
  try {
    const { data } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            order: (col2: string, opts: object) => {
              limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>
            }
          }
        }
      }
    }).from('security_incidents')
      .select('id,incident_type,severity,created_at,resolved_at,description')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5)

    return (data ?? []).map(r => ({
      incident_id:    String(r['id'] ?? randomUUID()),
      severity:       (['P0','P1','P2','P3'].includes(String(r['severity'])) ? r['severity'] : 'P2') as 'P0'|'P1'|'P2'|'P3',
      service:        String(r['incident_type'] ?? 'unknown'),
      description:    String(r['description'] ?? 'No description'),
      started_at:     String(r['created_at'] ?? new Date().toISOString()),
      duration_ms:    r['resolved_at'] ? new Date(r['resolved_at'] as string).getTime() - new Date(r['created_at'] as string).getTime() : null,
      resolved:       !!r['resolved_at'],
      correlation_id: null,
    }))
  } catch {
    return []
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runSystemHealthDashboard(
  tenantId: string = TENANT_ID,
): Promise<SystemHealthDashboard> {
  const dashId  = randomUUID()
  const startTs = Date.now()

  log.info('[SystemHealthDashboard] Building unified health view', { tenantId })

  const [realityReport, errorSummary, recentIncidents] = await Promise.all([
    runRealityMonitor(tenantId),
    fetchErrorSummary(tenantId),
    fetchRecentIncidents(tenantId),
  ])

  const depGraph     = buildDependencyGraph(realityReport.checks)
  const alertReady   = buildAlertReadiness()

  const healthyCount  = depGraph.nodes.filter(n => n.status === 'HEALTHY').length
  const degradedCount = depGraph.nodes.filter(n => n.status === 'DEGRADED').length
  const downCount     = depGraph.nodes.filter(n => n.status === 'DOWN' || n.status === 'UNKNOWN').length

  const healthScore = realityReport.system_health_score
  const overallHealth: ServiceStatus =
    downCount > 2         ? 'DOWN' :
    downCount > 0 ||
    degradedCount > 3     ? 'DEGRADED' :
    degradedCount > 0     ? 'DEGRADED' :
                            'HEALTHY'

  const dashHash = createHash('sha256').update(
    `DASHBOARD|${tenantId}|${dashId}|${healthScore}|${downCount}`
  ).digest('hex')

  const dashboard: SystemHealthDashboard = {
    dashboard_id:     dashId,
    tenant_id:        tenantId,
    overall_health:   overallHealth,
    health_score:     healthScore,
    reality_score:    realityReport.reality_score,
    dependency_graph: depGraph,
    alert_readiness:  alertReady,
    error_summary:    errorSummary,
    recent_incidents: recentIncidents,
    service_count:    depGraph.nodes.length,
    healthy_count:    healthyCount,
    degraded_count:   degradedCount,
    down_count:       downCount,
    dashboard_hash:   dashHash,
    generated_at:     new Date().toISOString(),
  }

  // Persist
  try {
    const { error } = await (supabaseAdmin as unknown as {
      from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> }
    }).from('system_health_dashboards').insert({
      dashboard_id:   dashId,
      tenant_id:      tenantId,
      overall_health: overallHealth,
      health_score:   healthScore,
      reality_score:  realityReport.reality_score,
      service_count:  depGraph.nodes.length,
      healthy_count:  healthyCount,
      degraded_count: degradedCount,
      down_count:     downCount,
      alert_score:    alertReady.overall_alert_score,
      dashboard_hash: dashHash,
      report_json:    JSON.parse(JSON.stringify(dashboard, bigintReplacer)),
      generated_at:   dashboard.generated_at,
    })
    if (error) log.warn('[SystemHealthDashboard] Persist failed', { error })
  } catch (e: unknown) {
    log.warn('[SystemHealthDashboard] Persist exception', { e: String(e) })
  }

  log.info('[SystemHealthDashboard] Complete', {
    overallHealth, healthScore, healthy: healthyCount, down: downCount,
    durationMs: Date.now() - startTs,
  })

  return dashboard
}
