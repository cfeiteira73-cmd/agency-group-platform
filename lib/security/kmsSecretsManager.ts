// lib/security/kmsSecretsManager.ts
// Production secrets management: AWS Secrets Manager primary, HashiCorp Vault fallback, env var fallback
// AWS Docs: https://docs.aws.amazon.com/secretsmanager/latest/userguide/
// Vault Docs: https://developer.hashicorp.com/vault/api-docs/secret/kv/kv-v2

import log from '@/lib/logger'
import { createHmac, createHash } from 'crypto'

export type SecretProvider = 'AWS_SECRETS_MANAGER' | 'HASHICORP_VAULT' | 'ENV_VAR'

export interface SecretValue {
  key: string
  value: string
  provider: SecretProvider
  version?: string
  last_rotated?: string
  expires_at?: string
}

export interface SecretsHealthReport {
  checked_at: string
  provider: SecretProvider
  configured: boolean
  accessible: boolean
  secrets_accessible: number
  secrets_missing: number
  rotation_overdue: string[]
  status: 'HEALTHY' | 'DEGRADED' | 'NOT_CONFIGURED'
}

// Known secret keys required by the platform
export const REQUIRED_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXTAUTH_SECRET',
  'INTERNAL_API_SECRET',
  'CRON_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'GOCARDLESS_ACCESS_TOKEN',
] as const

export type RequiredSecret = typeof REQUIRED_SECRETS[number]

// ── AWS Secrets Manager ────────────────────────────────────────────────────────

const AWS_REGION = process.env.AWS_REGION ?? 'eu-west-1'
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const AWS_SECRETS_PREFIX = process.env.AWS_SECRETS_PREFIX ?? 'agency-group/'

function isAwsConfigured(): boolean {
  return !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY)
}

// AWS Signature V4 — used to sign requests without the heavy AWS SDK
function buildAwsAuthHeaders(
  method: string,
  url: string,
  body: string,
  service: string,
  region: string,
  accessKey: string,
  secretKey: string,
): Record<string, string> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').substring(0, 15) + 'Z'
  const dateStamp = amzDate.substring(0, 8)

  const parsedUrl = new URL(url)
  const canonicalUri = parsedUrl.pathname
  const canonicalQueryString = parsedUrl.search ? parsedUrl.search.substring(1) : ''
  const payloadHash = createHash('sha256').update(body).digest('hex')
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${parsedUrl.host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-amz-date'
  const canonicalRequest = [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`

  const hmac = (key: Buffer | string, data: string): Buffer =>
    createHmac('sha256', key).update(data).digest()

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), service),
    'aws4_request',
  )
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  return {
    'Content-Type': 'application/x-amz-json-1.1',
    'X-Amz-Date': amzDate,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

async function getSecretFromAws(secretName: string): Promise<string | null> {
  if (!isAwsConfigured()) return null

  const url = `https://secretsmanager.${AWS_REGION}.amazonaws.com/`
  const body = JSON.stringify({ SecretId: `${AWS_SECRETS_PREFIX}${secretName}` })

  const headers = buildAwsAuthHeaders(
    'POST', url, body, 'secretsmanager', AWS_REGION,
    AWS_ACCESS_KEY_ID!, AWS_SECRET_ACCESS_KEY!,
  )

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'X-Amz-Target': 'secretsmanager.GetSecretValue' },
      body,
    })

    if (!response.ok) {
      if (response.status === 404) return null
      const err = await response.text()
      log.warn('[kmsSecretsManager] AWS SM error', { secretName, status: response.status, err: err.substring(0, 200) })
      return null
    }

    const data = await response.json() as { SecretString?: string; SecretBinary?: string }
    return data.SecretString ?? null
  } catch (e) {
    log.warn('[kmsSecretsManager] AWS SM fetch error', { secretName, e })
    return null
  }
}

// ── HashiCorp Vault ────────────────────────────────────────────────────────────

const VAULT_ADDR = process.env.VAULT_ADDR
const VAULT_TOKEN = process.env.VAULT_TOKEN
const VAULT_MOUNT = process.env.VAULT_MOUNT ?? 'secret'
const VAULT_PATH_PREFIX = process.env.VAULT_PATH_PREFIX ?? 'agency-group'

function isVaultConfigured(): boolean {
  return !!(VAULT_ADDR && VAULT_TOKEN)
}

async function getSecretFromVault(secretName: string): Promise<string | null> {
  if (!isVaultConfigured()) return null

  try {
    const response = await fetch(
      `${VAULT_ADDR}/v1/${VAULT_MOUNT}/data/${VAULT_PATH_PREFIX}/${secretName}`,
      {
        headers: {
          'X-Vault-Token': VAULT_TOKEN!,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404) return null
      log.warn('[kmsSecretsManager] Vault error', { secretName, status: response.status })
      return null
    }

    const data = await response.json() as { data?: { data?: Record<string, string> } }
    return data.data?.data?.[secretName] ?? data.data?.data?.['value'] ?? null
  } catch (e) {
    log.warn('[kmsSecretsManager] Vault fetch error', { secretName, e })
    return null
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get a secret value. Priority: AWS Secrets Manager > HashiCorp Vault > env var
 */
export async function getSecret(key: string): Promise<SecretValue | null> {
  // Try AWS SM first
  if (isAwsConfigured()) {
    const value = await getSecretFromAws(key)
    if (value) {
      return { key, value, provider: 'AWS_SECRETS_MANAGER' }
    }
  }

  // Try Vault
  if (isVaultConfigured()) {
    const value = await getSecretFromVault(key)
    if (value) {
      return { key, value, provider: 'HASHICORP_VAULT' }
    }
  }

  // Fall back to env var
  const envValue = process.env[key]
  if (envValue) {
    return { key, value: envValue, provider: 'ENV_VAR' }
  }

  return null
}

/**
 * Get multiple secrets in parallel
 */
export async function getSecrets(keys: string[]): Promise<Record<string, SecretValue | null>> {
  const results = await Promise.allSettled(keys.map(k => getSecret(k)))
  return Object.fromEntries(
    keys.map((key, i) => {
      const r = results[i]
      return [key, r.status === 'fulfilled' ? r.value : null]
    })
  )
}

/**
 * Check health of secrets management system
 */
export async function checkSecretsHealth(): Promise<SecretsHealthReport> {
  const checkedAt = new Date().toISOString()

  let provider: SecretProvider = 'ENV_VAR'
  let configured = false
  let accessible = false

  if (isAwsConfigured()) {
    provider = 'AWS_SECRETS_MANAGER'
    configured = true
    // Test access with a lightweight call
    try {
      const testSecret = await getSecretFromAws(REQUIRED_SECRETS[0])
      accessible = testSecret !== null
    } catch { accessible = false }
  } else if (isVaultConfigured()) {
    provider = 'HASHICORP_VAULT'
    configured = true
    try {
      const testSecret = await getSecretFromVault(REQUIRED_SECRETS[0])
      accessible = testSecret !== null
    } catch { accessible = false }
  } else {
    configured = true  // env vars always available
    accessible = true
  }

  // For env vars: check each one directly
  let secretsAccessible = 0
  let secretsMissing = 0
  const rotationOverdue: string[] = []

  if (provider === 'ENV_VAR') {
    secretsAccessible = REQUIRED_SECRETS.filter(k => !!process.env[k]).length
    secretsMissing = REQUIRED_SECRETS.length - secretsAccessible
  } else {
    // For KMS providers, assume all secrets are accessible if the provider is accessible
    secretsAccessible = accessible ? REQUIRED_SECRETS.length : 0
    secretsMissing = accessible ? 0 : REQUIRED_SECRETS.length
  }

  return {
    checked_at: checkedAt,
    provider,
    configured,
    accessible,
    secrets_accessible: secretsAccessible,
    secrets_missing: secretsMissing,
    rotation_overdue: rotationOverdue,
    status: secretsMissing === 0 ? 'HEALTHY' : secretsAccessible > 0 ? 'DEGRADED' : 'NOT_CONFIGURED',
  }
}

export function getActiveProvider(): SecretProvider {
  if (isAwsConfigured()) return 'AWS_SECRETS_MANAGER'
  if (isVaultConfigured()) return 'HASHICORP_VAULT'
  return 'ENV_VAR'
}
