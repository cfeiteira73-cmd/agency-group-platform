// =============================================================================
// Agency Group — SH-ROS System Org Validator
// lib/bootstrap/systemOrgValidator.ts
//
// Validates SYSTEM_ORG_ID at startup and on-demand.
// RULES (non-negotiable):
//   1. SYSTEM_ORG_ID must be set
//   2. Must be a valid UUID v4
//   3. Must exist in Supabase tenants.id
//   4. Fails CLOSED — if any check fails, revenue dashboard is blocked
//
// Used by:
//   - instrumentation.ts (boot guard, fire-and-forget P1 incident)
//   - /api/system/org-check (runtime diagnostic endpoint)
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── UUID v4 validation ───────────────────────────────────────────────────────

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUIDv4(value: string): boolean {
  return UUID_V4_REGEX.test(value)
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface OrgValidationResult {
  ok:           boolean
  org_id:       string | null
  tenant_slug:  string | null
  tenant_name:  string | null
  error:        string | null
  checked_at:   string
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate SYSTEM_ORG_ID in 3 layers:
 *   1. ENV var must be set
 *   2. Must be UUID v4
 *   3. Must exist in Supabase tenants table
 *
 * Returns a structured result — never throws.
 * Callers must treat `ok: false` as FAIL-CLOSED (revenue dashboard blocked).
 */
export async function validateSystemOrgId(): Promise<OrgValidationResult> {
  const checked_at = new Date().toISOString()
  const orgId = process.env.SYSTEM_ORG_ID

  // Layer 1: env var must be set
  if (!orgId || orgId.trim() === '') {
    return {
      ok:          false,
      org_id:      null,
      tenant_slug: null,
      tenant_name: null,
      error:       'SYSTEM_ORG_ID is not set — add it to Vercel env vars',
      checked_at,
    }
  }

  // Layer 2: must be a valid UUID v4
  if (!isValidUUIDv4(orgId)) {
    return {
      ok:          false,
      org_id:      orgId,
      tenant_slug: null,
      tenant_name: null,
      error:       `SYSTEM_ORG_ID "${orgId}" is not a valid UUID v4`,
      checked_at,
    }
  }

  // Layer 3: must exist in tenants table
  try {
    // NOTE: The org table is 'organizations', not 'tenants'.
    // The Wave 11 schema truth map listed it as 'tenants' but the actual DB table is 'organizations'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('organizations')
      .select('id, slug, name')
      .eq('id', orgId)
      .single() as { data: { id: string; slug: string; name: string } | null; error: unknown }

    if (error || !data) {
      return {
        ok:          false,
        org_id:      orgId,
        tenant_slug: null,
        tenant_name: null,
        error:       `SYSTEM_ORG_ID "${orgId}" not found in organizations table — run: SELECT id, slug FROM organizations;`,
        checked_at,
      }
    }

    return {
      ok:          true,
      org_id:      orgId,
      tenant_slug: data.slug,
      tenant_name: data.name,
      error:       null,
      checked_at,
    }
  } catch (e) {
    return {
      ok:          false,
      org_id:      orgId,
      tenant_slug: null,
      tenant_name: null,
      error:       `Supabase lookup failed: ${e instanceof Error ? e.message : String(e)}`,
      checked_at,
    }
  }
}
