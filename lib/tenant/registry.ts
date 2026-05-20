// =============================================================================
// Agency Group — Tenant Registry
// lib/tenant/registry.ts
//
// CRUD operations for the tenants table.
// Supabase-backed. Service role key required (admin-only operations).
//
// DDL (run once in Supabase SQL editor):
// -- CREATE TABLE tenants (
// --   id uuid primary key default gen_random_uuid(),
// --   slug text not null unique,
// --   name text not null,
// --   plan text not null default 'starter',
// --   status text not null default 'active',
// --   owner_email text not null,
// --   settings jsonb default '{}',
// --   feature_flags jsonb default '{}',
// --   created_at timestamptz not null default now(),
// --   updated_at timestamptz not null default now(),
// --   CONSTRAINT tenants_plan_check CHECK (plan IN ('starter','growth','enterprise','unlimited')),
// --   CONSTRAINT tenants_status_check CHECK (status IN ('active','suspended','cancelled'))
// -- );
// -- CREATE INDEX idx_tenants_slug ON tenants(slug);
// -- CREATE INDEX idx_tenants_status ON tenants(status);
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { TenantPlanId, TenantStatus } from './context'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tenant {
  id:            string
  slug:          string
  name:          string
  plan:          TenantPlanId
  status:        TenantStatus
  owner_email:   string
  settings:      Record<string, unknown>
  feature_flags: Record<string, unknown>
  created_at:    string
  updated_at:    string
}

export interface CreateTenantInput {
  slug:        string
  name:        string
  plan?:       TenantPlanId
  owner_email: string
  settings?:   Record<string, unknown>
  feature_flags?: Record<string, unknown>
}

export interface UpdateTenantInput {
  name?:          string
  plan?:          TenantPlanId
  status?:        TenantStatus
  settings?:      Record<string, unknown>
  feature_flags?: Record<string, unknown>
}

// ─── Client ───────────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getTenant(slug: string): Promise<Tenant | null> {
  try {
    const db = getDb()
    const { data, error } = await db
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single()
    if (error || !data) return null
    return data as unknown as Tenant
  } catch { return null }
}

export async function listTenants(status?: TenantStatus): Promise<Tenant[]> {
  try {
    const db = getDb()
    let q = db.from('tenants').select('*').order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error || !data) return []
    return data as unknown as Tenant[]
  } catch { return [] }
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant | null> {
  try {
    const db = getDb()
    const { data, error } = await db
      .from('tenants')
      .insert({
        slug:          input.slug,
        name:          input.name,
        plan:          input.plan ?? 'starter',
        owner_email:   input.owner_email,
        status:        'active',
        settings:      input.settings ?? {},
        feature_flags: input.feature_flags ?? {},
      })
      .select()
      .single()
    if (error || !data) {
      console.error('[TenantRegistry] createTenant error:', error?.message)
      return null
    }
    return data as unknown as Tenant
  } catch { return null }
}

export async function updateTenant(slug: string, input: UpdateTenantInput): Promise<Tenant | null> {
  try {
    const db = getDb()
    const { data, error } = await db
      .from('tenants')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('slug', slug)
      .select()
      .single()
    if (error || !data) return null
    return data as unknown as Tenant
  } catch { return null }
}

export async function suspendTenant(slug: string): Promise<boolean> {
  const result = await updateTenant(slug, { status: 'suspended' })
  return result !== null
}

// Bootstrap: ensure agency-group tenant exists
export async function ensureDefaultTenant(): Promise<void> {
  try {
    const existing = await getTenant('agency-group')
    if (existing) return
    await createTenant({
      slug:        'agency-group',
      name:        'Agency Group',
      plan:        'unlimited',
      owner_email: 'geral@agencygroup.pt',
      feature_flags: {
        vault: true,
        graph: true,
        ai_learning: true,
        causal_trace: true,
        event_replay: true,
      },
    })
  } catch { /* non-blocking */ }
}
