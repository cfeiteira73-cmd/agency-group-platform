// Agency Group — Secrets Rotation Engine
// lib/security/secretsRotation.ts
// Detects stale secrets, tracks rotation schedules, alerts on drift.
// TypeScript strict — 0 errors
//
// TABLE DDL (run once in Supabase):
// -- CREATE TABLE secret_rotation_log (
// --   id uuid primary key default gen_random_uuid(),
// --   secret_name text not null,
// --   rotated_at timestamptz not null default now(),
// --   rotated_by text,
// --   notes text
// -- );

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SecretMetadata {
  name: string
  lastRotatedAt: string | null  // ISO-8601 or null if unknown
  maxAgeDays: number            // e.g. 90 for API keys, 30 for JWTs
  environment: 'production' | 'preview' | 'development' | 'all'
  critical: boolean             // true = block on expiry
}

export interface RotationStatus {
  name: string
  status: 'ok' | 'warning' | 'expired' | 'unknown'
  daysUntilExpiry: number | null
  lastRotatedAt: string | null
  recommendation: string
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const SECRET_REGISTRY: SecretMetadata[] = [
  { name: 'ANTHROPIC_API_KEY',         maxAgeDays: 90,  environment: 'all',        critical: true,  lastRotatedAt: null },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', maxAgeDays: 180, environment: 'all',        critical: true,  lastRotatedAt: null },
  { name: 'WHATSAPP_ACCESS_TOKEN',     maxAgeDays: 60,  environment: 'production', critical: true,  lastRotatedAt: null },
  { name: 'RESEND_API_KEY',            maxAgeDays: 180, environment: 'all',        critical: false, lastRotatedAt: null },
  { name: 'CRON_SECRET',               maxAgeDays: 365, environment: 'all',        critical: true,  lastRotatedAt: null },
  { name: 'AUTH_SECRET',               maxAgeDays: 365, environment: 'all',        critical: true,  lastRotatedAt: null },
  { name: 'OPENAI_API_KEY',            maxAgeDays: 90,  environment: 'all',        critical: false, lastRotatedAt: null },
  { name: 'INTERNAL_API_TOKEN',        maxAgeDays: 180, environment: 'all',        critical: true,  lastRotatedAt: null },
]

// ─── Supabase client ──────────────────────────────────────────────────────────

function getRotationClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Compute the rotation status for a single secret.
 *
 * - null lastRotatedAt  → 'unknown'
 * - elapsed > maxAgeDays → 'expired'
 * - elapsed > 80% of maxAgeDays → 'warning'
 * - otherwise → 'ok'
 */
export function checkSecretStatus(secret: SecretMetadata): RotationStatus {
  const { name, lastRotatedAt, maxAgeDays, critical } = secret

  if (!lastRotatedAt) {
    return {
      name,
      status: 'unknown',
      daysUntilExpiry: null,
      lastRotatedAt: null,
      recommendation: 'Set rotation date in registry',
    }
  }

  const rotatedMs = new Date(lastRotatedAt).getTime()
  if (isNaN(rotatedMs)) {
    return {
      name,
      status: 'unknown',
      daysUntilExpiry: null,
      lastRotatedAt,
      recommendation: 'Invalid lastRotatedAt date — set a valid ISO-8601 string',
    }
  }

  const elapsedDays = (Date.now() - rotatedMs) / 86_400_000
  const daysUntilExpiry = Math.ceil(maxAgeDays - elapsedDays)

  if (elapsedDays > maxAgeDays) {
    return {
      name,
      status: 'expired',
      daysUntilExpiry,
      lastRotatedAt,
      recommendation: critical
        ? `CRITICAL: Rotate ${name} immediately — expired ${Math.abs(daysUntilExpiry)} day(s) ago`
        : `Rotate ${name} — expired ${Math.abs(daysUntilExpiry)} day(s) ago`,
    }
  }

  if (elapsedDays > maxAgeDays * 0.8) {
    return {
      name,
      status: 'warning',
      daysUntilExpiry,
      lastRotatedAt,
      recommendation: `Schedule rotation for ${name} — expires in ${daysUntilExpiry} day(s)`,
    }
  }

  return {
    name,
    status: 'ok',
    daysUntilExpiry,
    lastRotatedAt,
    recommendation: `No action needed — ${name} expires in ${daysUntilExpiry} day(s)`,
  }
}

/**
 * Audit all secrets in the registry and return their statuses.
 */
export function auditAllSecrets(): RotationStatus[] {
  return SECRET_REGISTRY.map(checkSecretStatus)
}

/**
 * Return only critical secrets that are expired or in warning state.
 */
export function getCriticalExpiries(): RotationStatus[] {
  return auditAllSecrets().filter((s) => {
    if (s.status !== 'expired' && s.status !== 'warning') return false
    const meta = SECRET_REGISTRY.find((m) => m.name === s.name)
    return meta?.critical === true
  })
}

/**
 * Fire-and-forget — records a rotation event in Supabase `secret_rotation_log`.
 * Never throws; logs a warning on failure.
 */
export async function recordRotation(
  secretName: string,
  rotatedAt?: string,
): Promise<void> {
  const client = getRotationClient()
  if (!client) {
    console.warn('[secretsRotation] Supabase not configured — skipping rotation log')
    return
  }

  try {
    const { error } = await client.from('secret_rotation_log').insert({
      secret_name: secretName,
      rotated_at:  rotatedAt ?? new Date().toISOString(),
    })
    if (error) {
      console.warn('[secretsRotation] Insert failed:', (error as { message: string }).message)
    }
  } catch (err) {
    console.warn('[secretsRotation] Unexpected error:', err instanceof Error ? err.message : String(err))
  }
}
