// TypeScript strict — 0 errors
// lib/security/secretsVault.ts
// Secrets management abstraction — env-based, pluggable for HashiCorp Vault / AWS Secrets Manager

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SecretKey =
  | 'ANTHROPIC_API_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'CASAFARI_API_KEY'
  | 'IDEALISTA_API_KEY'
  | 'RESEND_API_KEY'
  | 'HEYGEN_API_KEY'
  | 'CRON_SECRET'
  | 'INTERNAL_API_SECRET'
  | 'STRIPE_WEBHOOK_SECRET'

export interface SecretMetadata {
  key: SecretKey
  present: boolean
  is_placeholder: boolean
  last_rotated?: string
  source: 'env' | 'vault'
}

// ─── Placeholder detection ────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = ['PREENCHER', 'YOUR_KEY_HERE', 'REPLACE_ME', 'TODO', 'FIXME', '']

function _isPlaceholder(value: string | undefined): boolean {
  if (value === undefined || value === '') return true
  const upper = value.trim().toUpperCase()
  return PLACEHOLDER_PATTERNS.some(p => upper === p || upper.startsWith('PREENCHER'))
}

// ─── getSecret ────────────────────────────────────────────────────────────────

export function getSecret(key: SecretKey): string | undefined {
  const value = process.env[key]
  if (_isPlaceholder(value)) return undefined
  return value
}

// ─── isSecretValid ────────────────────────────────────────────────────────────

export function isSecretValid(key: SecretKey): boolean {
  const value = process.env[key]
  if (!value || _isPlaceholder(value)) return false
  return true
}

// ─── validateRequiredSecrets ──────────────────────────────────────────────────

const REQUIRED_SECRETS: SecretKey[] = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
]

export function validateRequiredSecrets(): {
  valid: boolean
  missing: SecretKey[]
  placeholders: SecretKey[]
  all_secrets: SecretMetadata[]
} {
  const all_secrets = getSecretsStatus()
  const missing: SecretKey[] = []
  const placeholders: SecretKey[] = []

  for (const key of REQUIRED_SECRETS) {
    const meta = all_secrets.find(s => s.key === key)
    if (!meta) continue
    if (!meta.present) {
      missing.push(key)
    } else if (meta.is_placeholder) {
      placeholders.push(key)
    }
  }

  return {
    valid:       missing.length === 0 && placeholders.length === 0,
    missing,
    placeholders,
    all_secrets,
  }
}

// ─── maskSecret ───────────────────────────────────────────────────────────────

export function maskSecret(value: string): string {
  if (value.length <= 8) return '****'
  const head = value.slice(0, 4)
  const tail = value.slice(-4)
  return `${head}****${tail}`
}

// ─── getSecretsStatus ─────────────────────────────────────────────────────────

const ALL_KEYS: SecretKey[] = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'CASAFARI_API_KEY',
  'IDEALISTA_API_KEY',
  'RESEND_API_KEY',
  'HEYGEN_API_KEY',
  'CRON_SECRET',
  'INTERNAL_API_SECRET',
  'STRIPE_WEBHOOK_SECRET',
]

export function getSecretsStatus(): SecretMetadata[] {
  return ALL_KEYS.map(key => {
    const raw = process.env[key]
    const present = raw !== undefined && raw !== ''
    const is_placeholder = present ? _isPlaceholder(raw) : false

    return {
      key,
      present,
      is_placeholder,
      source: 'env' as const,
    }
  })
}
