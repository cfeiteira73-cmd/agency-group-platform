// Agency Group — Runtime Secret Scanner
// lib/security/runtimeSecretScanner.ts
// TypeScript strict — 0 errors
//
// Scans for plaintext secrets in: environment variables, log entries,
// API responses, request payloads. Detects hardcoded tokens.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretPatternType =
  | 'aws_access_key'
  | 'aws_secret_key'
  | 'supabase_service_key'
  | 'stripe_secret_key'
  | 'openai_api_key'
  | 'github_token'
  | 'jwt_token'
  | 'generic_api_key'
  | 'database_url_with_password'

export interface SecretScanResult {
  scan_id: string
  scan_target: 'env' | 'logs' | 'payload' | 'response'
  findings: SecretFinding[]
  scanned_at: string
  risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical'
}

export interface SecretFinding {
  pattern_type: SecretPatternType
  location: string        // e.g. 'env.OPENAI_API_KEY', 'payload.body.token'
  masked_value: string    // Shows pattern match, never full value
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendation: string
}

// ---------------------------------------------------------------------------
// Pattern registry
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: Record<SecretPatternType, RegExp> = {
  aws_access_key: /AKIA[0-9A-Z]{16}/,
  aws_secret_key: /(?<=[^A-Za-z0-9/+=]|^)[A-Za-z0-9/+=]{40}(?=[^A-Za-z0-9/+=]|$)/,
  supabase_service_key: /eyJ[A-Za-z0-9_-]{100,}/,
  stripe_secret_key: /sk_(live|test)_[A-Za-z0-9]{24,}/,
  openai_api_key: /sk-[A-Za-z0-9]{32,}/,
  github_token: /ghp_[A-Za-z0-9]{36}/,
  jwt_token: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  generic_api_key: /[A-Za-z0-9_-]{32,64}/,
  database_url_with_password: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/,
}

// Severity mapping
const PATTERN_SEVERITY: Record<SecretPatternType, SecretFinding['severity']> = {
  aws_access_key: 'critical',
  aws_secret_key: 'critical',
  supabase_service_key: 'critical',
  stripe_secret_key: 'critical',
  openai_api_key: 'high',
  github_token: 'high',
  jwt_token: 'medium',
  generic_api_key: 'low',
  database_url_with_password: 'critical',
}

// Recommendations
const PATTERN_RECOMMENDATION: Record<SecretPatternType, string> = {
  aws_access_key: 'Rotate AWS access key immediately and remove from plaintext storage',
  aws_secret_key: 'Rotate AWS secret key and store in AWS Secrets Manager',
  supabase_service_key: 'Rotate Supabase service role key; never expose in client-side code',
  stripe_secret_key: 'Rotate Stripe secret key immediately via Stripe dashboard',
  openai_api_key: 'Rotate OpenAI API key and store in Vault or AWS Secrets Manager',
  github_token: 'Revoke GitHub token immediately via GitHub settings',
  jwt_token: 'JWT token leaked — rotate signing secret and invalidate all active sessions',
  generic_api_key: 'Audit this key — if sensitive, rotate and move to secret store',
  database_url_with_password: 'Rotate database password immediately; use connection pooler with secret reference',
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Env variable names that are EXPECTED to contain secrets — skip scanning their values */
const KNOWN_SECRET_VAR_NAMES = new Set([
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'HEYGEN_API_KEY',
  'CRON_SECRET',
  'INTERNAL_API_SECRET',
  'CASAFARI_API_KEY',
  'IDEALISTA_API_KEY',
  'VAULT_TOKEN',
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'AUTH_SECRET',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'GITHUB_TOKEN',
  'AWS_SECRET_ACCESS_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
])

function maskMatch(value: string, match: string): string {
  if (match.length <= 8) return '****'
  return match.slice(0, 4) + '****' + match.slice(-4)
}

function computeRiskLevel(findings: SecretFinding[]): SecretScanResult['risk_level'] {
  if (findings.length === 0) return 'none'
  if (findings.some(f => f.severity === 'critical')) return 'critical'
  if (findings.some(f => f.severity === 'high')) return 'high'
  if (findings.some(f => f.severity === 'medium')) return 'medium'
  return 'low'
}

/**
 * Scans a single string value for secret patterns.
 * context: dotted path like 'env.SOME_VAR' or 'payload.headers.authorization'
 * Skips generic_api_key unless in a suspicious context.
 */
function scanString(value: string, context: string, strict: boolean): SecretFinding[] {
  const findings: SecretFinding[] = []

  for (const [patternType, regex] of Object.entries(SECRET_PATTERNS) as [SecretPatternType, RegExp][]) {
    // Skip generic_api_key in non-strict mode to reduce false positives
    if (patternType === 'generic_api_key' && !strict) continue

    const match = regex.exec(value)
    if (match && match[0]) {
      findings.push({
        pattern_type: patternType,
        location: context,
        masked_value: maskMatch(value, match[0]),
        severity: PATTERN_SEVERITY[patternType],
        recommendation: PATTERN_RECOMMENDATION[patternType],
      })
      break // One finding per location per scan
    }
  }

  return findings
}

/**
 * Deep-walks an unknown object and scans string values.
 */
function deepScanObject(
  obj: unknown,
  path: string,
  findings: SecretFinding[],
  depth = 0,
): void {
  if (depth > 10) return // Guard against deeply nested objects
  if (obj === null || obj === undefined) return

  if (typeof obj === 'string') {
    const hits = scanString(obj, path, false)
    findings.push(...hits)
    return
  }

  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      deepScanObject(val, `${path}.${key}`, findings, depth + 1)
    }
  }
}

// ---------------------------------------------------------------------------
// scanEnvironmentVariables
// ---------------------------------------------------------------------------

export async function scanEnvironmentVariables(): Promise<SecretScanResult> {
  const scanId = randomUUID()
  const scannedAt = new Date().toISOString()
  const findings: SecretFinding[] = []

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue

    // Skip known secret vars — their presence is expected, not a leak
    if (KNOWN_SECRET_VAR_NAMES.has(key)) continue

    // Scan unexpected env vars that contain what looks like a secret
    const hits = scanString(value, `env.${key}`, false)
    findings.push(...hits)
  }

  const risk_level = computeRiskLevel(findings)

  if (findings.length > 0) {
    log.warn('[runtimeSecretScanner] scanEnvironmentVariables — findings detected', {
      finding_count: findings.length,
      risk_level,
    } as any)
  }

  return { scan_id: scanId, scan_target: 'env', findings, scanned_at: scannedAt, risk_level }
}

// ---------------------------------------------------------------------------
// scanPayload
// ---------------------------------------------------------------------------

export async function scanPayload(
  payload: unknown,
  context: string,
): Promise<SecretScanResult> {
  const scanId = randomUUID()
  const scannedAt = new Date().toISOString()
  const findings: SecretFinding[] = []

  deepScanObject(payload, context, findings)

  const risk_level = computeRiskLevel(findings)

  return { scan_id: scanId, scan_target: 'payload', findings, scanned_at: scannedAt, risk_level }
}

// ---------------------------------------------------------------------------
// scanLogEntry (synchronous — used in log middleware)
// ---------------------------------------------------------------------------

export function scanLogEntry(logText: string): SecretFinding[] {
  return scanString(logText, 'log_entry', false)
}

// ---------------------------------------------------------------------------
// runFullScan
// ---------------------------------------------------------------------------

export async function runFullScan(tenantId: string): Promise<SecretScanResult> {
  const db = supabaseAdmin as any
  const scanId = randomUUID()
  const scannedAt = new Date().toISOString()
  const allFindings: SecretFinding[] = []

  // 1. Scan env vars
  const envScan = await scanEnvironmentVariables()
  allFindings.push(...envScan.findings)

  // 2. Scan recent log entries from Supabase (if table exists)
  try {
    const { data: logRows } = await db
      .from('system_logs')
      .select('message, context')
      .order('created_at', { ascending: false })
      .limit(100) as { data: Array<{ message: string; context: unknown }> | null }

    for (const row of logRows ?? []) {
      if (row.message) {
        allFindings.push(...scanString(row.message, 'system_logs.message', false))
      }
      if (row.context) {
        const contextStr = typeof row.context === 'string' ? row.context : JSON.stringify(row.context)
        allFindings.push(...scanString(contextStr, 'system_logs.context', false))
      }
    }
  } catch {
    // system_logs table may not exist — graceful no-op
  }

  // Deduplicate findings by location + pattern_type
  const seen = new Set<string>()
  const dedupedFindings = allFindings.filter(f => {
    const key = `${f.location}:${f.pattern_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const risk_level = computeRiskLevel(dedupedFindings)

  // Persist scan result
  const scanRow = {
    id: scanId,
    tenant_id: tenantId,
    scan_target: 'env',
    findings: dedupedFindings,
    risk_level,
    scanned_at: scannedAt,
  }

  void (db as any)
    .from('secret_scan_results')
    .insert(scanRow)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        log.warn('[runtimeSecretScanner] runFullScan — persist failed', {
          scan_id: scanId,
          error: error.message,
        } as any)
      }
    })

  log.info('[runtimeSecretScanner] runFullScan — complete', {
    tenant_id: tenantId,
    scan_id: scanId,
    finding_count: dedupedFindings.length,
    risk_level,
  } as any)

  return {
    scan_id: scanId,
    scan_target: 'env',
    findings: dedupedFindings,
    scanned_at: scannedAt,
    risk_level,
  }
}
