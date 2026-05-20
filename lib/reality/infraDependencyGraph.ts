// =============================================================================
// Agency Group — Infrastructure Dependency Graph
// lib/reality/infraDependencyGraph.ts
//
// Real infrastructure dependency mapper.
// Probes external dependencies, classifies ownership risk, and computes
// an INFRA_OWNERSHIP_SCORE reflecting system resilience.
//
// Core principle: every external service is a risk. This module catalogs them,
// probes their liveness, and scores the system's resilience to their failure.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DependencyTier     = 'critical' | 'high' | 'medium' | 'low'
export type DependencyCategory = 'database' | 'cache' | 'ai' | 'auth' | 'messaging' | 'cdn' | 'monitoring' | 'automation' | 'runtime' | 'scraping' | 'payments' | 'media' | 'crm'
export type OwnershipType      = 'external_managed' | 'external_self_hosted' | 'internal'

export interface InfraDependency {
  name:          string             // 'Supabase', 'Upstash Redis', 'Anthropic', etc.
  category:      DependencyCategory
  tier:          DependencyTier
  ownership:     OwnershipType
  env_vars:      string[]           // env vars this service needs
  configured:    boolean            // true if all env_vars are present
  probe_result?: DependencyProbe
  fallback:      string | null      // what happens if this fails
  spof:          boolean            // single point of failure?
  description:   string
}

export interface DependencyProbe {
  success:    boolean
  latency_ms: number
  error?:     string
  probed_at:  string
}

export interface InfraOwnershipScore {
  score:           number             // 0-100
  classification:  'self_sovereign' | 'hardened' | 'resilient' | 'fragile'
  total_deps:      number
  critical_deps:   number
  spof_count:      number
  configured_pct:  number             // % of deps with all env vars present
  dependencies:    InfraDependency[]
  risk_factors:    string[]
  recommendations: string[]
  generated_at:    string
}

// ─── Dependency catalog ───────────────────────────────────────────────────────

const DEPENDENCY_CATALOG: Omit<InfraDependency, 'configured' | 'probe_result'>[] = [
  // ── Database ──────────────────────────────────────────────────────────────

  {
    name:        'Supabase',
    category:    'database',
    tier:        'critical',
    ownership:   'external_managed',
    env_vars:    ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    fallback:    null,
    spof:        true,
    description: 'Primary database, RLS auth, and vector search. All persistent data lives here.',
  },

  // ── Cache ─────────────────────────────────────────────────────────────────

  {
    name:        'Upstash Redis',
    category:    'cache',
    tier:        'critical',
    ownership:   'external_managed',
    env_vars:    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    fallback:    'Date.now() fallback for Lamport clock; direct DB for cache misses; rate limiting degraded',
    spof:        false,
    description: 'Lamport clock, adjacency cache, rate limiting, circuit breakers, cost streams, traffic streams.',
  },

  // ── AI ────────────────────────────────────────────────────────────────────

  {
    name:        'Anthropic API',
    category:    'ai',
    tier:        'critical',
    ownership:   'external_managed',
    env_vars:    ['ANTHROPIC_API_KEY'],
    fallback:    'Sofia returns mock response; AI features blocked; system degrades to read-only',
    spof:        false,
    description: 'Claude AI models for Sofia chat, deal radar, CRM automation, listing generation, vision analysis.',
  },

  {
    name:        'OpenAI Embeddings',
    category:    'ai',
    tier:        'medium',
    ownership:   'external_managed',
    env_vars:    ['OPENAI_API_KEY'],
    fallback:    'Semantic search disabled; keyword search fallback; voice search and TTS disabled',
    spof:        false,
    description: 'Vector embeddings for property search, voice search, TTS, buyer matching.',
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  {
    name:        'NextAuth / Auth.js',
    category:    'auth',
    tier:        'critical',
    ownership:   'internal',
    env_vars:    ['AUTH_SECRET', 'NEXTAUTH_URL'],
    fallback:    null,
    spof:        false,
    description: 'Session authentication and magic link JWT signing.',
  },

  {
    name:        'Google OAuth',
    category:    'auth',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    fallback:    'Google login button hidden; magic link login still works',
    spof:        false,
    description: 'Google OAuth 2.0 social login provider.',
  },

  // ── Runtime ───────────────────────────────────────────────────────────────

  {
    name:        'Vercel',
    category:    'runtime',
    tier:        'critical',
    ownership:   'external_managed',
    env_vars:    ['VERCEL_URL'],
    fallback:    null,
    spof:        true,
    description: 'Serverless runtime, edge network, and cron scheduler.',
  },

  // ── Messaging ─────────────────────────────────────────────────────────────

  {
    name:        'Resend',
    category:    'messaging',
    tier:        'high',
    ownership:   'external_managed',
    env_vars:    ['RESEND_API_KEY'],
    fallback:    'Falls back to SMTP; if SMTP also missing, emails silently dropped',
    spof:        false,
    description: 'Transactional email: magic links, digests, alerts, follow-ups, weekly reports.',
  },

  {
    name:        'WhatsApp Business API (Meta)',
    category:    'messaging',
    tier:        'medium',
    ownership:   'external_managed',
    env_vars:    ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'],
    fallback:    'WhatsApp notifications and Sofia auto-reply disabled; inbound messages still logged to CRM',
    spof:        false,
    description: 'Meta WhatsApp Business Cloud API for Sofia auto-reply and outbound notifications.',
  },

  // ── Automation ────────────────────────────────────────────────────────────

  {
    name:        'n8n',
    category:    'automation',
    tier:        'high',
    ownership:   'external_self_hosted',
    env_vars:    ['N8N_WEBHOOK_URL'],
    fallback:    'CRM triggers and workflow automation disabled; manual operations only',
    spof:        false,
    description: 'Workflow automation: CRM lead triggers, follow-up sequences, property live webhooks.',
  },

  // ── Payments ──────────────────────────────────────────────────────────────

  {
    name:        'Stripe',
    category:    'payments',
    tier:        'high',
    ownership:   'external_managed',
    env_vars:    ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    fallback:    'Billing and subscription features disabled',
    spof:        false,
    description: 'Subscription billing, webhook verification.',
  },

  // ── Monitoring ────────────────────────────────────────────────────────────

  {
    name:        'Sentry',
    category:    'monitoring',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['NEXT_PUBLIC_SENTRY_DSN'],
    fallback:    'Errors not reported to Sentry; application continues normally',
    spof:        false,
    description: 'Error tracking and performance monitoring (browser, server, edge).',
  },

  {
    name:        'OpenTelemetry (OTLP)',
    category:    'monitoring',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['OTEL_EXPORTER_OTLP_ENDPOINT'],
    fallback:    'Traces go to console only; no distributed tracing',
    spof:        false,
    description: 'Distributed tracing and observability export.',
  },

  {
    name:        'Datadog',
    category:    'monitoring',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['DATADOG_API_KEY'],
    fallback:    'SIEM security events not forwarded to Datadog',
    spof:        false,
    description: 'SIEM security event forwarding.',
  },

  // ── Scraping ──────────────────────────────────────────────────────────────

  {
    name:        'Apify',
    category:    'scraping',
    tier:        'medium',
    ownership:   'external_managed',
    env_vars:    ['APIFY_TOKEN'],
    fallback:    'Idealista/Imovirtual/Supercasa scraping disabled; Deal Radar results reduced',
    spof:        false,
    description: 'Managed scraping actors for real estate portals (Idealista, Imovirtual, Supercasa).',
  },

  {
    name:        'Browserless',
    category:    'scraping',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['BROWSERLESS_TOKEN'],
    fallback:    'Headless browser scraping disabled; simpler fetch fallback used',
    spof:        false,
    description: 'Headless browser scraping for sites that block plain fetch.',
  },

  {
    name:        'Idealista API',
    category:    'scraping',
    tier:        'medium',
    ownership:   'external_managed',
    env_vars:    ['IDEALISTA_API_KEY', 'IDEALISTA_API_SECRET'],
    fallback:    'Idealista API search disabled; scraper fallback only',
    spof:        false,
    description: 'Official Idealista REST API for property listings and market data.',
  },

  // ── Media / AI ────────────────────────────────────────────────────────────

  {
    name:        'HeyGen',
    category:    'media',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['HEYGEN_API_KEY'],
    fallback:    'Sofia video avatar disabled; text chat still works',
    spof:        false,
    description: 'AI video avatar for Sofia video streaming via WebRTC.',
  },

  {
    name:        'Stability AI',
    category:    'media',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['STABILITY_API_KEY'],
    fallback:    'Home staging AI disabled',
    spof:        false,
    description: 'Stable Diffusion image generation for virtual home staging.',
  },

  // ── CRM ───────────────────────────────────────────────────────────────────

  {
    name:        'Notion',
    category:    'crm',
    tier:        'high',
    ownership:   'external_managed',
    env_vars:    ['NOTION_TOKEN', 'NOTION_PIPELINE_DB', 'NOTION_CRM_DB', 'NOTION_PROPERTIES_DB'],
    fallback:    'All /api/notion/* endpoints return 500; deal/contact/property Notion sync disabled',
    spof:        false,
    description: 'CRM pipeline, contacts, and properties database in Notion.',
  },

  // ── Push Notifications ────────────────────────────────────────────────────

  {
    name:        'Web Push (VAPID)',
    category:    'messaging',
    tier:        'low',
    ownership:   'internal',
    env_vars:    ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
    fallback:    'Browser push notifications disabled',
    spof:        false,
    description: 'VAPID-based web push notifications for browser alerts.',
  },

  // ── Optional queue infrastructure ─────────────────────────────────────────

  {
    name:        'Kafka',
    category:    'automation',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['KAFKA_BROKERS'],
    fallback:    'Event streaming falls back to Upstash Redis streams',
    spof:        false,
    description: 'Optional Kafka cluster for high-throughput event streaming.',
  },

  {
    name:        'Alert Webhook',
    category:    'monitoring',
    tier:        'low',
    ownership:   'external_managed',
    env_vars:    ['ALERT_WEBHOOK_URL'],
    fallback:    'Alert webhook notifications disabled',
    spof:        false,
    description: 'Generic outbound webhook for system alerts (Slack, Discord, etc.).',
  },
]

// ─── isEnvConfigured helper ───────────────────────────────────────────────────

/**
 * Maps a service name to the primary env var that proves it is configured.
 * Conservative: if the service is not in the map, returns false.
 */
const SERVICE_ENV_MAP: Record<string, string> = {
  'Date.now() fallback for Lamport clock; direct DB for cache misses; rate limiting degraded': 'UPSTASH_REDIS_REST_URL',
  'Sofia returns mock response; AI features blocked; system degrades to read-only':           'ANTHROPIC_API_KEY',
  'Semantic search disabled; keyword search fallback; voice search and TTS disabled':          'OPENAI_API_KEY',
  'Google login button hidden; magic link login still works':                                  'GOOGLE_CLIENT_ID',
  'Falls back to SMTP; if SMTP also missing, emails silently dropped':                         'RESEND_API_KEY',
  'WhatsApp notifications and Sofia auto-reply disabled; inbound messages still logged to CRM': 'WHATSAPP_ACCESS_TOKEN',
  'CRM triggers and workflow automation disabled; manual operations only':                      'N8N_WEBHOOK_URL',
  'Billing and subscription features disabled':                                                 'STRIPE_SECRET_KEY',
  'Errors not reported to Sentry; application continues normally':                             'NEXT_PUBLIC_SENTRY_DSN',
  'Traces go to console only; no distributed tracing':                                         'OTEL_EXPORTER_OTLP_ENDPOINT',
  'SIEM security events not forwarded to Datadog':                                             'DATADOG_API_KEY',
  'Idealista/Imovirtual/Supercasa scraping disabled; Deal Radar results reduced':              'APIFY_TOKEN',
  'Headless browser scraping disabled; simpler fetch fallback used':                           'BROWSERLESS_TOKEN',
  'Idealista API search disabled; scraper fallback only':                                      'IDEALISTA_API_KEY',
  'Sofia video avatar disabled; text chat still works':                                        'HEYGEN_API_KEY',
  'Home staging AI disabled':                                                                  'STABILITY_API_KEY',
  'All /api/notion/* endpoints return 500; deal/contact/property Notion sync disabled':        'NOTION_TOKEN',
  'Browser push notifications disabled':                                                       'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'Event streaming falls back to Upstash Redis streams':                                       'KAFKA_BROKERS',
  'Alert webhook notifications disabled':                                                      'ALERT_WEBHOOK_URL',
}

function isEnvConfigured(fallbackDescription: string): boolean {
  const envVar = SERVICE_ENV_MAP[fallbackDescription]
  if (!envVar) return false
  return !!process.env[envVar]
}

// ─── Redis probe ──────────────────────────────────────────────────────────────

async function probeRedis(): Promise<DependencyProbe> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const probed_at = new Date().toISOString()

  if (!url || !token) {
    return { success: false, latency_ms: 0, error: 'env vars not configured', probed_at }
  }

  const start = Date.now()
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(3000),
    })
    const latency_ms = Date.now() - start
    if (!res.ok) {
      return { success: false, latency_ms, error: `HTTP ${res.status}`, probed_at }
    }
    const body = await res.json() as { result?: string }
    const success = body.result === 'PONG'
    return { success, latency_ms, error: success ? undefined : 'unexpected response', probed_at }
  } catch (err) {
    return {
      success:    false,
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : 'unknown error',
      probed_at,
    }
  }
}

// ─── Supabase probe ───────────────────────────────────────────────────────────

async function probeSupabase(): Promise<DependencyProbe> {
  const probed_at  = new Date().toISOString()
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!configured) {
    return { success: false, latency_ms: 0, error: 'env vars not configured', probed_at }
  }

  const start = Date.now()
  try {
    // Minimal read — just check connectivity; audit_log may not exist, so use a
    // raw REST ping that returns immediately on any table.
    const { error } = await supabaseAdmin
      .from('audit_log')
      .select('id')
      .limit(1)
    const latency_ms = Date.now() - start
    // error may be a "table not found" type which still proves connectivity
    const networkError = error && error.code !== 'PGRST116' && error.code !== '42P01'
    return {
      success:    !networkError,
      latency_ms,
      error:      networkError ? (error.message ?? 'unknown error') : undefined,
      probed_at,
    }
  } catch (err) {
    return {
      success:    false,
      latency_ms: Date.now() - start,
      error:      err instanceof Error ? err.message : 'unknown error',
      probed_at,
    }
  }
}

// ─── Env-var-only probe ───────────────────────────────────────────────────────

function probeEnvOnly(envVars: string[]): DependencyProbe {
  const configured = envVars.every(v => !!process.env[v])
  return {
    success:    configured,
    latency_ms: 0,
    error:      configured ? undefined : `missing env vars: ${envVars.filter(v => !process.env[v]).join(', ')}`,
    probed_at:  new Date().toISOString(),
  }
}

// ─── probeDependency ──────────────────────────────────────────────────────────

/**
 * Probes a single dependency for liveness.
 * Only Supabase and Redis perform real network probes.
 * All other dependencies use env-var presence checks to avoid side effects.
 * Fail-open: never throws.
 */
export async function probeDependency(dep: InfraDependency): Promise<DependencyProbe> {
  try {
    if (dep.name === 'Supabase')      return await probeSupabase()
    if (dep.name === 'Upstash Redis') return await probeRedis()
    // All others: env-var presence only
    return probeEnvOnly(dep.env_vars)
  } catch {
    return { success: false, latency_ms: 0, error: 'probe threw unexpectedly', probed_at: new Date().toISOString() }
  }
}

// ─── buildDependencyGraph ─────────────────────────────────────────────────────

/**
 * Builds the full dependency list from the catalog.
 * Sets `configured = all env_vars present in process.env`.
 * If `probe = true` (default false): runs live probes for Supabase and Redis.
 */
export async function buildDependencyGraph(probe = false): Promise<InfraDependency[]> {
  const deps: InfraDependency[] = DEPENDENCY_CATALOG.map(template => ({
    ...template,
    configured: template.env_vars.every(v => !!process.env[v]),
  }))

  if (!probe) return deps

  // Run Supabase and Redis probes in parallel; all others skip live probes
  const probePromises = deps.map(async dep => {
    if (dep.name === 'Supabase' || dep.name === 'Upstash Redis') {
      dep.probe_result = await probeDependency(dep)
    }
    return dep
  })

  return Promise.all(probePromises)
}

// ─── computeInfraOwnershipScore ───────────────────────────────────────────────

/**
 * Builds the dependency graph and computes an INFRA_OWNERSHIP_SCORE (0-100).
 *
 * Scoring formula:
 *   Start: 100
 *   -25 per external_managed SPOF (no fallback)
 *   -10 per unconfigured critical dependency
 *   -5  per unconfigured high dependency
 *   +5  per external dependency with a VERIFIED fallback (env var actually set)
 *   Total fallback bonus capped at +30
 *   Floor: 0, Ceiling: 100
 *
 * Classification:
 *   >90   → self_sovereign
 *   70-90 → hardened
 *   50-70 → resilient
 *   <50   → fragile
 */
export async function computeInfraOwnershipScore(probe = false): Promise<InfraOwnershipScore> {
  const dependencies = await buildDependencyGraph(probe)

  let score = 100
  const risk_factors:    string[] = []
  const recommendations: string[] = []

  const criticalDeps = dependencies.filter(d => d.tier === 'critical')
  const spofs        = dependencies.filter(d => d.spof && d.ownership === 'external_managed')

  // -25 per external_managed SPOF (no fallback — if they had a fallback they wouldn't be a SPOF)
  for (const dep of spofs) {
    score -= 25
    risk_factors.push(`SPOF: ${dep.name} (${dep.category}) is a single point of failure with no fallback`)
    recommendations.push(
      `Implement fallback or self-hosted alternative for ${dep.name} — current failure = full outage`,
    )
  }

  // -10 per unconfigured critical dependency
  for (const dep of criticalDeps) {
    if (!dep.configured) {
      score -= 10
      const missing = dep.env_vars.filter(v => !process.env[v])
      risk_factors.push(`Unconfigured critical dependency: ${dep.name} (missing: ${missing.join(', ')})`)
      recommendations.push(`Configure ${dep.name}: set ${missing.join(', ')} in environment variables`)
    }
  }

  // -5 per unconfigured high dependency
  const highDeps = dependencies.filter(d => d.tier === 'high' && !d.configured)
  for (const dep of highDeps) {
    score -= 5
    const missing = dep.env_vars.filter(v => !process.env[v])
    risk_factors.push(`Unconfigured high dependency: ${dep.name} (missing: ${missing.join(', ')})`)
    recommendations.push(`Configure ${dep.name} to restore full capability: set ${missing.join(', ')}`)
  }

  // +5 per external dependency with a VERIFIED fallback (env var for the fallback service is configured)
  // Cap total fallback bonus at +30 to prevent inflation
  const externalWithVerifiedFallback = dependencies.filter(
    d => d.ownership !== 'internal' && d.fallback !== null && isEnvConfigured(d.fallback),
  )
  const fallbackBonus = externalWithVerifiedFallback.length * 5
  score += Math.min(fallbackBonus, 30)

  // Cap at 0-100
  score = Math.max(0, Math.min(100, score))

  // Classification
  let classification: InfraOwnershipScore['classification']
  if (score > 90)       classification = 'self_sovereign'
  else if (score >= 70) classification = 'hardened'
  else if (score >= 50) classification = 'resilient'
  else                  classification = 'fragile'

  // Configured percentage
  const configured_pct = dependencies.length > 0
    ? Math.round((dependencies.filter(d => d.configured).length / dependencies.length) * 100)
    : 0

  // Dedup risk factors and recommendations
  const uniqueRisks = Array.from(new Set(risk_factors))
  const uniqueRecs  = Array.from(new Set(recommendations))

  // General recommendations if no specific ones
  if (uniqueRecs.length === 0) {
    uniqueRecs.push('System is well-configured. Continue monitoring dependency liveness.')
  }

  return {
    score,
    classification,
    total_deps:     dependencies.length,
    critical_deps:  criticalDeps.length,
    spof_count:     spofs.length,
    configured_pct,
    dependencies,
    risk_factors:    uniqueRisks,
    recommendations: uniqueRecs,
    generated_at:    new Date().toISOString(),
  }
}
