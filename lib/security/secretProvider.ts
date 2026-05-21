// Agency Group — Secret Provider
// lib/security/secretProvider.ts
// TypeScript strict — 0 errors
//
// Multi-backend secret abstraction.
// Priority: HashiCorp Vault → AWS Secrets Manager → GCP Secret Manager → local env fallback.
// Zero errors when none configured — always falls through to env.

import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretBackend = 'vault' | 'aws_secrets_manager' | 'gcp_secret_manager' | 'env'

export interface SecretMetadata {
  secret_name: string
  backend: SecretBackend
  version: string
  created_at: string
  expires_at: string | null
  last_rotated_at: string | null
  rotation_ttl_days: number | null
}

export interface SecretValue {
  value: string
  metadata: SecretMetadata
}

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

export function detectBackend(): SecretBackend {
  if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN) return 'vault'
  if (process.env.AWS_SECRETS_MANAGER_REGION && process.env.AWS_ACCESS_KEY_ID) return 'aws_secrets_manager'
  if (process.env.GCP_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS) return 'gcp_secret_manager'
  return 'env'
}

// ---------------------------------------------------------------------------
// Mask helper
// ---------------------------------------------------------------------------

export function maskSecretValue(value: string): string {
  if (value.length <= 4) return '****'
  return '****' + value.slice(-4)
}

// ---------------------------------------------------------------------------
// Backend implementations (graceful no-op when not configured)
// ---------------------------------------------------------------------------

async function getFromVault(secretName: string): Promise<string | null> {
  const vaultAddr = process.env.VAULT_ADDR
  const vaultToken = process.env.VAULT_TOKEN
  if (!vaultAddr || !vaultToken) return null

  try {
    const url = `${vaultAddr}/v1/secret/data/${encodeURIComponent(secretName)}`
    const resp = await fetch(url, {
      headers: { 'X-Vault-Token': vaultToken },
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return null

    const json = await resp.json() as { data?: { data?: Record<string, unknown> } }
    const data = json?.data?.data
    if (!data) return null

    // Convention: secret stored as { value: "..." } or { [secretName]: "..." }
    const val = data['value'] ?? data[secretName]
    return val != null ? String(val) : null
  } catch (err) {
    log.warn('[secretProvider] Vault fetch failed (non-fatal)', {
      secret_name: secretName,
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return null
  }
}

async function getFromAWSSecretsManager(secretName: string): Promise<string | null> {
  const region = process.env.AWS_SECRETS_MANAGER_REGION
  if (!region || !process.env.AWS_ACCESS_KEY_ID) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const awsMod: {
      SecretsManagerClient: new (o: any) => any
      GetSecretValueCommand: new (o: any) => any
    } | null = (() => { try { return require('@aws-sdk/client-secrets-manager') } catch { return null } })()
    const { SecretsManagerClient, GetSecretValueCommand } = awsMod ?? { SecretsManagerClient: null, GetSecretValueCommand: null }

    if (!SecretsManagerClient || !GetSecretValueCommand) return null

    const client = new SecretsManagerClient({ region })
    const resp = await client.send(new GetSecretValueCommand({ SecretId: secretName }))
    return resp.SecretString ?? null
  } catch (err) {
    log.warn('[secretProvider] AWS Secrets Manager fetch failed (non-fatal)', {
      secret_name: secretName,
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return null
  }
}

async function getFromGCPSecretManager(secretName: string): Promise<string | null> {
  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const gcpMod: {
      SecretManagerServiceClient: new () => {
        accessSecretVersion: (opts: { name: string }) => Promise<[{ payload?: { data?: Buffer | string } }]>
      }
    } | null = (() => { try { return require('@google-cloud/secret-manager') } catch { return null } })()
    const { SecretManagerServiceClient } = gcpMod ?? { SecretManagerServiceClient: null }
    if (!SecretManagerServiceClient) return null

    const client = new SecretManagerServiceClient()
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`
    const [version] = await client.accessSecretVersion({ name })
    const payload = version.payload?.data
    if (!payload) return null
    return Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
  } catch (err) {
    log.warn('[secretProvider] GCP Secret Manager fetch failed (non-fatal)', {
      secret_name: secretName,
      error: err instanceof Error ? err.message : String(err),
    } as any)
    return null
  }
}

function getFromEnv(secretName: string): string | null {
  const val = process.env[secretName]
  return val !== undefined && val !== '' ? val : null
}

// ---------------------------------------------------------------------------
// getSecret — tries backends in priority order
// ---------------------------------------------------------------------------

export async function getSecret(secretName: string): Promise<SecretValue> {
  const now = new Date().toISOString()

  // 1. Try Vault
  const vaultValue = await getFromVault(secretName)
  if (vaultValue !== null) {
    return {
      value: vaultValue,
      metadata: {
        secret_name: secretName,
        backend: 'vault',
        version: 'latest',
        created_at: now,
        expires_at: null,
        last_rotated_at: null,
        rotation_ttl_days: null,
      },
    }
  }

  // 2. Try AWS Secrets Manager
  const awsValue = await getFromAWSSecretsManager(secretName)
  if (awsValue !== null) {
    return {
      value: awsValue,
      metadata: {
        secret_name: secretName,
        backend: 'aws_secrets_manager',
        version: 'latest',
        created_at: now,
        expires_at: null,
        last_rotated_at: null,
        rotation_ttl_days: null,
      },
    }
  }

  // 3. Try GCP Secret Manager
  const gcpValue = await getFromGCPSecretManager(secretName)
  if (gcpValue !== null) {
    return {
      value: gcpValue,
      metadata: {
        secret_name: secretName,
        backend: 'gcp_secret_manager',
        version: 'latest',
        created_at: now,
        expires_at: null,
        last_rotated_at: null,
        rotation_ttl_days: null,
      },
    }
  }

  // 4. Env fallback — never throws
  const envValue = getFromEnv(secretName) ?? ''
  if (!envValue) {
    log.warn('[secretProvider] Secret not found in any backend', {
      secret_name: secretName,
      backend: 'env',
    } as any)
  }

  return {
    value: envValue,
    metadata: {
      secret_name: secretName,
      backend: 'env',
      version: 'env',
      created_at: now,
      expires_at: null,
      last_rotated_at: null,
      rotation_ttl_days: null,
    },
  }
}

// ---------------------------------------------------------------------------
// listSecrets — metadata only, never values
// ---------------------------------------------------------------------------

const KNOWN_SECRET_NAMES = [
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
] as const

export async function listSecrets(): Promise<SecretMetadata[]> {
  const backend = detectBackend()
  const now = new Date().toISOString()

  return KNOWN_SECRET_NAMES.map(name => ({
    secret_name: name,
    backend,
    version: 'latest',
    created_at: now,
    expires_at: null,
    last_rotated_at: null,
    rotation_ttl_days: null,
  }))
}
