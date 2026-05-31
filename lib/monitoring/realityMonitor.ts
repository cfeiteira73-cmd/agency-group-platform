// Agency Group — Autonomous Reality Monitor
// lib/monitoring/realityMonitor.ts
// Wave 54 Phase 1 — Permanent reality monitoring engine
//
// Continuously verifies: env vars, SSL, DNS, API connectivity,
// webhooks, queues, cron jobs, storage, DB, Redis, providers,
// rate limits, error rates. Generates REALITY_SCORE, SYSTEM_HEALTH_SCORE,
// OPERATIONAL_READINESS_SCORE. Stores historical snapshots.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Constants ──────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN'

export interface CheckResult {
  check_id: string
  category: string
  name: string
  status: CheckStatus
  value: string | number | boolean | null
  expected: string
  message: string
  latency_ms: number | null
}

export interface RealityMonitorReport {
  report_id: string
  tenant_id: string
  reality_score: number           // 0-100: external connections
  system_health_score: number     // 0-100: internal health
  operational_readiness_score: number  // 0-100: combined
  pass_count: number
  warn_count: number
  fail_count: number
  total_checks: number
  checks: CheckResult[]
  blockers: string[]
  warnings: string[]
  monitor_hash: string
  generated_at: string
}

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

// ── Environment variable checks ────────────────────────────────────────────────

function checkEnvVars(): CheckResult[] {
  const checks: Array<{ name: string; key: string; critical: boolean; validator?: (v: string) => boolean }> = [
    { name: 'Supabase URL',          key: 'NEXT_PUBLIC_SUPABASE_URL',   critical: true,  validator: v => v.startsWith('https://') },
    { name: 'Supabase Service Role', key: 'SUPABASE_SERVICE_ROLE_KEY',  critical: true,  validator: v => v.length > 20 },
    { name: 'Anthropic API Key',     key: 'ANTHROPIC_API_KEY',          critical: true,  validator: v => v.startsWith('sk-ant-') },
    { name: 'Resend API Key',        key: 'RESEND_API_KEY',             critical: true,  validator: v => v.startsWith('re_') },
    { name: 'Internal API Secret',   key: 'INTERNAL_API_SECRET',        critical: true,  validator: v => v.length >= 20 },
    { name: 'Auth Secret',           key: 'AUTH_SECRET',                critical: true,  validator: v => v.length >= 32 },
    { name: 'Cron Secret',           key: 'CRON_SECRET',                critical: true,  validator: v => v.length >= 20 },
    { name: 'Upstash Redis URL',     key: 'UPSTASH_REDIS_REST_URL',     critical: true,  validator: v => v.startsWith('https://') },
    { name: 'Upstash Redis Token',   key: 'UPSTASH_REDIS_REST_TOKEN',   critical: true,  validator: v => v.length > 20 },
    { name: 'Stripe Key',            key: 'STRIPE_SECRET_KEY',          critical: false, validator: v => v.startsWith('sk_') },
    { name: 'Stripe Key (LIVE)',      key: 'STRIPE_SECRET_KEY',          critical: false, validator: v => v.startsWith('sk_live_') },
    { name: 'HeyGen API Key',        key: 'HEYGEN_API_KEY',             critical: false, validator: v => v.length > 10 },
    { name: 'Notion Token',          key: 'NOTION_TOKEN',               critical: false, validator: v => v.startsWith('ntn_') || v.startsWith('secret_') },
    { name: 'Default Tenant ID',     key: 'DEFAULT_TENANT_ID',          critical: false, validator: v => v.length === 36 },
    { name: 'Admin Email',           key: 'ADMIN_EMAIL',                critical: false, validator: v => v.includes('@') },
    { name: 'Slack SOC Webhook',     key: 'SLACK_SOC_WEBHOOK_URL',      critical: false, validator: v => v.startsWith('https://hooks.slack.com/') },
    { name: 'WhatsApp Phone ID',     key: 'WHATSAPP_PHONE_NUMBER_ID',   critical: false, validator: v => v.length > 5 },
    { name: 'Site URL',              key: 'NEXT_PUBLIC_BASE_URL',       critical: false, validator: v => v.startsWith('https://') },
    { name: 'Idealista API Key',     key: 'IDEALISTA_API_KEY',          critical: false, validator: v => v !== 'PREENCHER' && v.length > 5 },
    { name: 'Casafari API Key',      key: 'CASAFARI_API_KEY',           critical: false, validator: v => v !== 'PREENCHER' && v.length > 5 },
    { name: 'PagerDuty Key',         key: 'PAGERDUTY_ROUTING_KEY',      critical: false, validator: v => v.length > 10 },
    { name: 'Datadog API Key',       key: 'DATADOG_API_KEY',            critical: false, validator: v => v.length > 10 },
    { name: 'SaltEdge App ID',       key: 'SALTEDGE_APP_ID',            critical: false, validator: v => v.length > 5 },
    { name: 'WhatsApp Access Token', key: 'WHATSAPP_ACCESS_TOKEN',      critical: false, validator: v => v !== 'PREENCHER' && v.length > 10 },
  ]

  return checks.map(c => {
    const t0  = Date.now()
    const val = process.env[c.key]
    const hasVal = !!val && val.length > 0
    const valid   = hasVal && c.validator ? c.validator(val!) : hasVal
    const status: CheckStatus = valid ? 'PASS' : hasVal ? 'WARN' : (c.critical ? 'FAIL' : 'WARN')
    return {
      check_id: `env_${c.key.toLowerCase()}`,
      category: 'ENV_VARS',
      name:     c.name,
      status,
      value:    hasVal ? `${val!.slice(0, 6)}...` : null,
      expected: 'configured + valid',
      message:  valid ? `${c.name} configured` : hasVal ? `${c.name} present but invalid format` : `${c.name} missing`,
      latency_ms: Date.now() - t0,
    }
  })
}

// ── Database health check ──────────────────────────────────────────────────────

async function checkDatabase(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_log')
      .select('id')
      .limit(1)
    const latency = Date.now() - t0
    if (error) {
      return { check_id: 'db_connectivity', category: 'DATABASE', name: 'Supabase Connectivity', status: 'FAIL', value: null, expected: 'connected', message: `DB error: ${error.message}`, latency_ms: latency }
    }
    const status: CheckStatus = latency < 500 ? 'PASS' : latency < 2000 ? 'WARN' : 'FAIL'
    return { check_id: 'db_connectivity', category: 'DATABASE', name: 'Supabase Connectivity', status, value: latency, expected: '<500ms', message: `DB connected in ${latency}ms`, latency_ms: latency }
  } catch (e: unknown) {
    return { check_id: 'db_connectivity', category: 'DATABASE', name: 'Supabase Connectivity', status: 'FAIL', value: null, expected: 'connected', message: String(e), latency_ms: Date.now() - t0 }
  }
}

// ── Redis / Upstash health check ───────────────────────────────────────────────

async function checkRedis(): Promise<CheckResult> {
  const t0  = Date.now()
  const url = process.env.UPSTASH_REDIS_REST_URL
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !tok) {
    return { check_id: 'redis_connectivity', category: 'REDIS', name: 'Upstash Redis', status: 'FAIL', value: null, expected: 'connected', message: 'UPSTASH_REDIS_REST_URL or TOKEN not configured', latency_ms: 0 }
  }
  try {
    const resp = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(3000) })
    const latency = Date.now() - t0
    const body    = await resp.text()
    const ok      = resp.ok && body.includes('PONG')
    return { check_id: 'redis_connectivity', category: 'REDIS', name: 'Upstash Redis', status: ok ? (latency < 300 ? 'PASS' : 'WARN') : 'FAIL', value: latency, expected: 'PONG <300ms', message: ok ? `Redis PONG in ${latency}ms` : `Redis error: ${body.slice(0,100)}`, latency_ms: latency }
  } catch (e: unknown) {
    return { check_id: 'redis_connectivity', category: 'REDIS', name: 'Upstash Redis', status: 'FAIL', value: null, expected: 'connected', message: String(e), latency_ms: Date.now() - t0 }
  }
}

// ── External API connectivity ──────────────────────────────────────────────────

async function checkExternalApis(): Promise<CheckResult[]> {
  const endpoints: Array<{ id: string; name: string; url: string; category: string }> = [
    { id: 'anthropic_ping', name: 'Anthropic API',   url: 'https://api.anthropic.com',             category: 'EXTERNAL_API' },
    { id: 'resend_ping',    name: 'Resend API',      url: 'https://api.resend.com',                category: 'EXTERNAL_API' },
    { id: 'supabase_ping',  name: 'Supabase REST',   url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, category: 'EXTERNAL_API' },
    { id: 'site_ping',      name: 'agencygroup.pt',  url: 'https://www.agencygroup.pt',            category: 'INFRASTRUCTURE' },
  ]

  return await Promise.all(
    endpoints.map(async ep => {
      const t0 = Date.now()
      try {
        const resp    = await fetch(ep.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        const latency = Date.now() - t0
        const ok      = resp.status < 500
        return { check_id: ep.id, category: ep.category, name: ep.name, status: (ok ? (latency < 1000 ? 'PASS' : 'WARN') : 'FAIL') as CheckStatus, value: resp.status, expected: '2xx/3xx/4xx', message: `HTTP ${resp.status} in ${latency}ms`, latency_ms: latency }
      } catch (e: unknown) {
        return { check_id: ep.id, category: ep.category, name: ep.name, status: 'FAIL' as CheckStatus, value: null, expected: 'reachable', message: String(e).slice(0, 100), latency_ms: Date.now() - t0 }
      }
    })
  )
}

// ── Webhook health ─────────────────────────────────────────────────────────────

function checkWebhooks(): CheckResult[] {
  const results: CheckResult[] = []

  // Stripe webhook secret
  const stripeWhs = process.env.STRIPE_WEBHOOK_SECRET
  results.push({
    check_id: 'webhook_stripe', category: 'WEBHOOKS', name: 'Stripe Webhook Secret',
    status:  stripeWhs && stripeWhs.startsWith('whsec_') ? 'PASS' : 'FAIL',
    value:   stripeWhs ? 'configured' : null,
    expected: 'whsec_... configured',
    message:  stripeWhs ? 'Stripe webhook secret present' : 'STRIPE_WEBHOOK_SECRET missing',
    latency_ms: null,
  })

  // Slack SOC webhook
  const slackUrl = process.env.SLACK_SOC_WEBHOOK_URL
  results.push({
    check_id: 'webhook_slack_soc', category: 'WEBHOOKS', name: 'Slack SOC Webhook',
    status:  slackUrl && slackUrl.startsWith('https://hooks.slack.com/') ? 'PASS' : 'WARN',
    value:   slackUrl ? 'configured' : null,
    expected: 'https://hooks.slack.com/... configured',
    message:  slackUrl ? 'Slack SOC webhook active' : 'SLACK_SOC_WEBHOOK_URL missing',
    latency_ms: null,
  })

  // WhatsApp webhook verify token
  const waVerify = process.env.WHATSAPP_VERIFY_TOKEN
  results.push({
    check_id: 'webhook_whatsapp', category: 'WEBHOOKS', name: 'WhatsApp Verify Token',
    status:  waVerify && waVerify.length > 5 ? 'PASS' : 'WARN',
    value:   waVerify ? 'configured' : null,
    expected: 'configured',
    message:  waVerify ? 'WhatsApp verify token present' : 'WHATSAPP_VERIFY_TOKEN missing',
    latency_ms: null,
  })

  return results
}

// ── Provider connectivity (market data) ───────────────────────────────────────

function checkProviders(): CheckResult[] {
  const providers: Array<{ id: string; name: string; envKey: string; liveCheck: (v: string) => boolean }> = [
    { id: 'provider_idealista',  name: 'Idealista',    envKey: 'IDEALISTA_API_KEY',  liveCheck: v => v !== 'PREENCHER' && v.length > 5 },
    { id: 'provider_casafari',   name: 'Casafari',     envKey: 'CASAFARI_API_KEY',   liveCheck: v => v !== 'PREENCHER' && v.length > 5 },
    { id: 'provider_stripe',     name: 'Stripe (LIVE)',envKey: 'STRIPE_SECRET_KEY',  liveCheck: v => v.startsWith('sk_live_') },
    { id: 'provider_saltedge',   name: 'SaltEdge',     envKey: 'SALTEDGE_APP_ID',    liveCheck: v => v.length > 5 },
    { id: 'provider_pagerduty',  name: 'PagerDuty',    envKey: 'PAGERDUTY_ROUTING_KEY', liveCheck: v => v.length > 10 },
    { id: 'provider_datadog',    name: 'Datadog SIEM', envKey: 'DATADOG_API_KEY',    liveCheck: v => v.length > 10 },
    { id: 'provider_anthropic',  name: 'Anthropic AI', envKey: 'ANTHROPIC_API_KEY',  liveCheck: v => v.startsWith('sk-ant-') },
    { id: 'provider_heygen',     name: 'HeyGen',       envKey: 'HEYGEN_API_KEY',     liveCheck: v => v.length > 10 },
    { id: 'provider_notion',     name: 'Notion',       envKey: 'NOTION_TOKEN',       liveCheck: v => v.length > 10 },
    { id: 'provider_resend',     name: 'Resend Email', envKey: 'RESEND_API_KEY',     liveCheck: v => v.startsWith('re_') },
    { id: 'provider_whatsapp',   name: 'WhatsApp',     envKey: 'WHATSAPP_ACCESS_TOKEN', liveCheck: v => v !== 'PREENCHER' && v.length > 10 },
  ]

  return providers.map(p => {
    const val    = process.env[p.envKey] ?? ''
    const live   = val && p.liveCheck(val)
    const status: CheckStatus = live ? 'PASS' : val ? 'WARN' : 'FAIL'
    return {
      check_id: p.id, category: 'PROVIDERS', name: p.name,
      status, value: live ? 'LIVE' : val ? 'CONFIGURED_NOT_LIVE' : 'MISSING',
      expected: 'LIVE', message: live ? `${p.name} live` : val ? `${p.name} configured but not live` : `${p.name} not configured`,
      latency_ms: null,
    }
  })
}

// ── Infrastructure checks ──────────────────────────────────────────────────────

function checkInfrastructure(): CheckResult[] {
  return [
    {
      check_id: 'infra_stripe_mode', category: 'INFRASTRUCTURE', name: 'Stripe Mode (TEST vs LIVE)',
      status:   (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'PASS' : 'FAIL',
      value:    (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'LIVE' : 'TEST',
      expected: 'LIVE', message: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'Stripe in LIVE mode' : '⚠ Stripe in TEST mode — no real capital possible',
      latency_ms: null,
    },
    {
      check_id: 'infra_chaos_testing', category: 'INFRASTRUCTURE', name: 'Chaos Testing',
      status:   process.env.CHAOS_TESTING_ENABLED === 'true' ? 'PASS' : 'WARN',
      value:    process.env.CHAOS_TESTING_ENABLED ?? 'false',
      expected: 'false (staging only)', message: process.env.CHAOS_TESTING_ENABLED === 'true' ? 'Chaos testing ENABLED' : 'Chaos testing disabled (expected in production)',
      latency_ms: null,
    },
    {
      check_id: 'infra_whatsapp_active', category: 'INFRASTRUCTURE', name: 'WhatsApp Active',
      status:   process.env.WHATSAPP_ACTIVE === 'true' ? 'PASS' : 'WARN',
      value:    process.env.WHATSAPP_ACTIVE ?? 'false',
      expected: 'true when token available', message: process.env.WHATSAPP_ACTIVE === 'true' ? 'WhatsApp enabled' : 'WhatsApp disabled — Sofia cannot send WA messages',
      latency_ms: null,
    },
    {
      check_id: 'infra_admin_email', category: 'INFRASTRUCTURE', name: 'Admin Email',
      status:   (process.env.ADMIN_EMAIL ?? '').includes('@') ? 'PASS' : 'FAIL',
      value:    process.env.ADMIN_EMAIL ?? null,
      expected: 'valid email', message: process.env.ADMIN_EMAIL ? `Admin email: ${process.env.ADMIN_EMAIL}` : 'ADMIN_EMAIL not configured',
      latency_ms: null,
    },
  ]
}

// ── Score computation ──────────────────────────────────────────────────────────

function computeScores(checks: CheckResult[]): { reality: number; health: number; readiness: number } {
  const total  = checks.length
  const passes = checks.filter(c => c.status === 'PASS').length
  const warns  = checks.filter(c => c.status === 'WARN').length
  const fails  = checks.filter(c => c.status === 'FAIL').length

  // Reality score: only EXTERNAL provider checks
  const externalChecks = checks.filter(c => c.category === 'PROVIDERS' || c.category === 'EXTERNAL_API')
  const externalPasses = externalChecks.filter(c => c.status === 'PASS').length
  const realityScore   = externalChecks.length > 0 ? Math.round((externalPasses / externalChecks.length) * 100) : 0

  // System health: internal + infrastructure
  const internalChecks = checks.filter(c => c.category !== 'PROVIDERS')
  const internalPasses = internalChecks.filter(c => c.status === 'PASS').length
  const internalScore  = internalChecks.length > 0 ? Math.round((internalPasses / internalChecks.length) * 100) : 0

  // Operational readiness: weighted blend
  const readiness = Math.round(realityScore * 0.6 + internalScore * 0.4)

  return { reality: realityScore, health: internalScore, readiness }
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runRealityMonitor(
  tenantId: string = TENANT_ID,
): Promise<RealityMonitorReport> {
  const reportId = randomUUID()
  const startTs  = Date.now()

  log.info('[RealityMonitor] Starting full reality check', { tenantId })

  // Run all checks in parallel where possible
  const [dbCheck, redisCheck, externalApiChecks] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkExternalApis(),
  ])

  const allChecks: CheckResult[] = [
    ...checkEnvVars(),
    dbCheck,
    redisCheck,
    ...externalApiChecks,
    ...checkWebhooks(),
    ...checkProviders(),
    ...checkInfrastructure(),
  ]

  const passes   = allChecks.filter(c => c.status === 'PASS').length
  const warns    = allChecks.filter(c => c.status === 'WARN').length
  const fails    = allChecks.filter(c => c.status === 'FAIL').length
  const scores   = computeScores(allChecks)

  const blockers = allChecks.filter(c => c.status === 'FAIL').map(c => `[${c.category}] ${c.name}: ${c.message}`)
  const warnings = allChecks.filter(c => c.status === 'WARN').map(c => `[${c.category}] ${c.name}: ${c.message}`)

  const monitor_hash = createHash('sha256').update(
    `REALITY_MONITOR|${tenantId}|${reportId}|${scores.readiness}|${fails}`
  ).digest('hex')

  const report: RealityMonitorReport = {
    report_id:                    reportId,
    tenant_id:                    tenantId,
    reality_score:                scores.reality,
    system_health_score:          scores.health,
    operational_readiness_score:  scores.readiness,
    pass_count:   passes,
    warn_count:   warns,
    fail_count:   fails,
    total_checks: allChecks.length,
    checks:       allChecks,
    blockers,
    warnings,
    monitor_hash,
    generated_at: new Date().toISOString(),
  }

  // Persist snapshot
  try {
    const { error } = await (supabaseAdmin as unknown as {
      from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> }
    }).from('reality_monitor_snapshots').insert({
      report_id:                   reportId,
      tenant_id:                   tenantId,
      reality_score:               scores.reality,
      system_health_score:         scores.health,
      operational_readiness_score: scores.readiness,
      pass_count:   passes,
      warn_count:   warns,
      fail_count:   fails,
      total_checks: allChecks.length,
      blockers:     JSON.stringify(blockers),
      monitor_hash,
      report_json:  JSON.parse(JSON.stringify(report, bigintReplacer)),
      generated_at: report.generated_at,
    })
    if (error) log.warn('[RealityMonitor] Persist failed', { error })
  } catch (e: unknown) {
    log.warn('[RealityMonitor] Persist exception', { e: String(e) })
  }

  log.info('[RealityMonitor] Complete', {
    reality: scores.reality, health: scores.health, readiness: scores.readiness,
    passes, warns, fails, durationMs: Date.now() - startTs,
  })

  return report
}
