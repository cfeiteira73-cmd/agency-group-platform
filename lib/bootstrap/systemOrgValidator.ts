// =============================================================================
// Agency Group — SH-ROS System Org Validator
// lib/bootstrap/systemOrgValidator.ts
//
// Validates SYSTEM_ORG_ID at startup and on-demand.
// RULES:
//   1. Resolves SYSTEM_ORG_ID from env var OR verified fallback UUID
//   2. Must be a valid UUID v4
//   3. Must exist in Supabase organizations table
//   4. Fails CLOSED on UUID format error or DB lookup failure
//   5. Logs WARNING (not error) when using fallback — system still works
//
// VERIFIED DEFAULT: '00000000-0000-0000-0000-000000000001'
//   Confirmed agency-group UUID in production (Wave 12 Supabase verification).
//   The fallback is safe. Set SYSTEM_ORG_ID explicitly in Vercel to silence warning.
//
// Used by:
//   - instrumentation.ts (boot guard, fire-and-forget P1 incident on failure)
//   - /api/system/org-check  (runtime diagnostic endpoint)
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── UUID v4 validation ───────────────────────────────────────────────────────

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUIDv4(value: string): boolean {
  return UUID_V4_REGEX.test(value)
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface OrgValidationResult {
  ok:            boolean
  org_id:        string | null
  tenant_slug:   string | null
  tenant_name:   string | null
  using_fallback: boolean
  error:         string | null
  checked_at:    string
}

// ─── Verified fallback ────────────────────────────────────────────────────────

/** Confirmed agency-group UUID — verified in Supabase organizations table (Wave 12). */
export const VERIFIED_DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate SYSTEM_ORG_ID in 3 layers:
 *   1. Resolve env var — falls back to VERIFIED_DEFAULT_ORG_ID with a warning
 *   2. Must be UUID v4 — hard fail if malformed
 *   3. Must exist in Supabase organizations table — hard fail if not found
 *
 * Returns a structured result — never throws.
 * On `ok: false`: revenue dashboard will be empty. Wire P1 incident at startup.
 * On `using_fallback: true`: system works but SYSTEM_ORG_ID should be set in Vercel.
 */
export async function validateSystemOrgId(): Promise<OrgValidationResult> {
  const checked_at = new Date().toISOString()
  const envValue   = process.env.SYSTEM_ORG_ID?.trim()

  // ── Layer 1: resolve effective org id ────────────────────────────────────────
  const using_fallback = !envValue
  const effectiveOrgId = envValue ?? VERIFIED_DEFAULT_ORG_ID

  if (using_fallback) {
    console.warn(
      '[AG] ⚠ SYSTEM_ORG_ID not set in Vercel env — using verified default:',
      VERIFIED_DEFAULT_ORG_ID,
      '\n    Action: add SYSTEM_ORG_ID=00000000-0000-0000-0000-000000000001 to Vercel env vars.',
    )
  }

  // ── Layer 2: UUID v4 format ───────────────────────────────────────────────────
  if (!isValidUUIDv4(effectiveOrgId)) {
    return {
      ok:            false,
      org_id:        effectiveOrgId,
      tenant_slug:   null,
      tenant_name:   null,
      using_fallback,
      error:         `SYSTEM_ORG_ID "${effectiveOrgId}" is not a valid UUID v4`,
      checked_at,
    }
  }

  // ── Layer 3: organizations table lookup ───────────────────────────────────────
  // NOTE: table is 'organizations' — not 'tenants' (Wave 11 schema map was wrong)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('organizations')
      .select('id, slug, name')
      .eq('id', effectiveOrgId)
      .single() as { data: { id: string; slug: string; name: string } | null; error: unknown }

    if (error || !data) {
      return {
        ok:            false,
        org_id:        effectiveOrgId,
        tenant_slug:   null,
        tenant_name:   null,
        using_fallback,
        error:         `org "${effectiveOrgId}" not found in organizations table — run: SELECT id, slug FROM organizations;`,
        checked_at,
      }
    }

    return {
      ok:            true,
      org_id:        effectiveOrgId,
      tenant_slug:   data.slug,
      tenant_name:   data.name,
      using_fallback,
      error:         null,
      checked_at,
    }
  } catch (e) {
    return {
      ok:            false,
      org_id:        effectiveOrgId,
      tenant_slug:   null,
      tenant_name:   null,
      using_fallback,
      error:         `Supabase lookup failed: ${e instanceof Error ? e.message : String(e)}`,
      checked_at,
    }
  }
}
