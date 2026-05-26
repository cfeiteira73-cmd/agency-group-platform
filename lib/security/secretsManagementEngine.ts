// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Secrets Management Engine — Abstraction over Vault/AWS Secrets Manager
// Wave 44 Agent 1 — Production Lock
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

let log: { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logger } = require('@/lib/observability/logger')
  log = logger
} catch {
  log = {
    info: (m: string, c?: Record<string, unknown>) => console.log('[secrets]', m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => console.warn('[secrets]', m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => console.error('[secrets]', m, c ?? {}),
  }
}

// ── Types ──────────────────────────────────────────────────────────────

export type SecretName =
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'OPENAI_API_KEY'
  | 'RESEND_API_KEY'
  | 'IDEALISTA_API_KEY'
  | 'CASAFARI_API_KEY'
  | 'KYC_PROVIDER_KEY'
  | 'INTERNAL_API_KEY'
  | 'JWT_SIGNING_KEY'
  | 'ENCRYPTION_KEY_PRIMARY'
  | 'ENCRYPTION_KEY_SECONDARY'

export interface SecretRecord {
  name: SecretName
  version: number
  rotated_at: string
  expires_at: string | null
  source: 'ENV' | 'VAULT' | 'AWS_SECRETS_MANAGER'
  is_active: boolean
}

const ALL_SECRETS: SecretName[] = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'IDEALISTA_API_KEY',
  'CASAFARI_API_KEY',
  'KYC_PROVIDER_KEY',
  'INTERNAL_API_KEY',
  'JWT_SIGNING_KEY',
  'ENCRYPTION_KEY_PRIMARY',
  'ENCRYPTION_KEY_SECONDARY',
]

// 90 days in milliseconds
const ROTATION_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Synchronously read a secret from environment variables.
 * Throws if the secret is missing or empty — never logs the value.
 */
export function getSecret(name: SecretName): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`[secrets] MISSING_SECRET: ${name} — check Vault/env configuration`)
  }
  return value
}

/**
 * Record that a secret was rotated. Fire-and-forget upsert to audit log.
 */
export async function recordSecretRotation(name: SecretName, rotatedBy: string): Promise<void> {
  void (supabaseAdmin as any)
    .from('secret_rotation_log')
    .upsert(
      {
        secret_name: name,
        rotated_at: new Date().toISOString(),
        rotated_by: rotatedBy,
        source: 'ENV',
        is_active: true,
      },
      { onConflict: 'secret_name' },
    )
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[secrets] Failed to record rotation', { secret_name: name, error })
      else log.info('[secrets] Rotation recorded', { secret_name: name, rotated_by: rotatedBy })
    })
    .catch((e: unknown) => console.warn('[secretsManagementEngine] recordSecretRotation', e))
}

/**
 * Returns metadata about all secrets. Never returns values.
 */
export async function getSecretInventory(): Promise<SecretRecord[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('secret_rotation_log')
    .select('secret_name, version, rotated_at, expires_at, source, is_active')
    .order('rotated_at', { ascending: false })

  if (error) {
    log.warn('[secrets] Failed to fetch inventory', { error })
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    name: row.secret_name as SecretName,
    version: (row.version as number) ?? 1,
    rotated_at: row.rotated_at as string,
    expires_at: (row.expires_at as string | null) ?? null,
    source: (row.source as 'ENV' | 'VAULT' | 'AWS_SECRETS_MANAGER') ?? 'ENV',
    is_active: (row.is_active as boolean) ?? true,
  }))
}

/**
 * Check all 11 secrets for presence and recent rotation.
 */
export async function checkSecretsHealth(): Promise<{
  healthy: boolean
  missing: SecretName[]
  expiring_soon: SecretName[]
}> {
  const missing: SecretName[] = []
  for (const name of ALL_SECRETS) {
    const value = process.env[name]
    if (!value || value.trim() === '') {
      missing.push(name)
    }
  }

  // Check rotation log for secrets that haven't been rotated in >90 days
  const { data: rotationData } = await (supabaseAdmin as any)
    .from('secret_rotation_log')
    .select('secret_name, rotated_at')

  const rotationMap = new Map<string, Date>()
  for (const row of rotationData ?? []) {
    rotationMap.set(row.secret_name as string, new Date(row.rotated_at as string))
  }

  const expiring_soon: SecretName[] = []
  const now = Date.now()
  for (const name of ALL_SECRETS) {
    const lastRotated = rotationMap.get(name)
    if (lastRotated) {
      const ageMs = now - lastRotated.getTime()
      if (ageMs > ROTATION_THRESHOLD_MS) {
        expiring_soon.push(name)
      }
    }
  }

  return {
    healthy: missing.length === 0 && expiring_soon.length === 0,
    missing,
    expiring_soon,
  }
}
