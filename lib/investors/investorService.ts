// =============================================================================
// Agency Group — Investor Service (DB layer)
// lib/investors/investorService.ts
//
// All DB operations for the investors domain.
// Uses supabaseAdmin with the `(as any)` cast pattern — generated types lag
// behind recently migrated tables (investors, investor_matches, properties).
//
// SERVER ONLY — never import in client components.
// AMI: 22506
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { InvestorProfile, InvestorMatchResult, PropertyInput } from './types'
import { rankInvestorsForProperty } from './matchEngine'

// Typed shorthand — avoids scattering eslint-disable comments everywhere
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

// ---------------------------------------------------------------------------
// Helper: throw on Supabase error
// ---------------------------------------------------------------------------

function assertNoError(error: unknown, ctx: string): void {
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error)
    throw new Error(`[investorService] ${ctx}: ${msg}`)
  }
}

// ---------------------------------------------------------------------------
// createInvestor
// ---------------------------------------------------------------------------

export async function createInvestor(
  data: Partial<InvestorProfile>,
  tenantId: string,
): Promise<InvestorProfile> {
  const now = new Date().toISOString()

  const { data: row, error } = await db
    .from('investors')
    .insert({
      ...data,
      tenant_id:  tenantId,
      status:     data.status ?? 'active',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  assertNoError(error, 'createInvestor')
  return row as InvestorProfile
}

// ---------------------------------------------------------------------------
// getInvestors
// ---------------------------------------------------------------------------

export async function getInvestors(
  tenantId: string,
  filters?: { status?: string; risk_tolerance?: string; limit?: number; offset?: number },
): Promise<InvestorProfile[]> {
  let query = db
    .from('investors')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.risk_tolerance) {
    query = query.eq('risk_tolerance', filters.risk_tolerance)
  }

  const limit  = filters?.limit  ?? 100
  const offset = filters?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  assertNoError(error, 'getInvestors')
  return (data ?? []) as InvestorProfile[]
}

// ---------------------------------------------------------------------------
// getInvestor
// ---------------------------------------------------------------------------

export async function getInvestor(
  id: string,
  tenantId: string,
): Promise<InvestorProfile | null> {
  const { data, error } = await db
    .from('investors')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) {
    // PGRST116 = row not found — not a real error
    if ((error as { code?: string }).code === 'PGRST116') return null
    assertNoError(error, 'getInvestor')
  }

  return (data ?? null) as InvestorProfile | null
}

// ---------------------------------------------------------------------------
// updateInvestor
// ---------------------------------------------------------------------------

export async function updateInvestor(
  id: string,
  data: Partial<InvestorProfile>,
  tenantId: string,
): Promise<InvestorProfile> {
  const { data: row, error } = await db
    .from('investors')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  assertNoError(error, 'updateInvestor')
  return row as InvestorProfile
}

// ---------------------------------------------------------------------------
// runMatchingForProperty
// Fetches property + active investors → scores → upserts top matches (score ≥ 50)
// ---------------------------------------------------------------------------

export async function runMatchingForProperty(
  propertyId: string,
  tenantId: string,
): Promise<InvestorMatchResult[]> {
  // ── 1. Fetch property ─────────────────────────────────────────────────────
  const { data: propertyRow, error: propErr } = await db
    .from('properties')
    .select('id, preco, zona, bairro, tipo, preco_m2')
    .eq('id', propertyId)
    .single()

  assertNoError(propErr, `runMatchingForProperty/fetchProperty(${propertyId})`)

  if (!propertyRow) {
    throw new Error(`[investorService] runMatchingForProperty: property ${propertyId} not found`)
  }

  const property: PropertyInput = {
    id:       propertyRow.id as string,
    preco:    (propertyRow.preco as number) ?? 0,
    zona:     (propertyRow.zona  as string | null) ?? null,
    bairro:   (propertyRow.bairro as string | null) ?? null,
    tipo:     (propertyRow.tipo  as string | null) ?? null,
    preco_m2: (propertyRow.preco_m2 as number | null) ?? null,
  }

  // ── 2. Fetch all active investors for this tenant ─────────────────────────
  const investors = await getInvestors(tenantId, { status: 'active', limit: 500 })

  if (investors.length === 0) {
    return []
  }

  // ── 3. Score all investors against this property ──────────────────────────
  const ranked = rankInvestorsForProperty(property, investors)

  // ── 4. Upsert top matches (score ≥ 50) into investor_matches ─────────────
  const toUpsert = ranked.filter(r => r.match_score >= 50)

  if (toUpsert.length > 0) {
    const now = new Date().toISOString()
    const rows = toUpsert.map(r => ({
      investor_id:   r.investor_id,
      property_id:   r.property_id,
      tenant_id:     tenantId,
      match_score:   r.match_score,
      capital_fit:   r.dimensions.capital_fit,
      yield_fit:     r.dimensions.yield_fit,
      geography_fit: r.dimensions.geography_fit,
      risk_fit:      r.dimensions.risk_fit,
      type_fit:      r.dimensions.type_fit,
      computed_at:   r.computed_at,
      updated_at:    now,
    }))

    const { error: upsertErr } = await db
      .from('investor_matches')
      .upsert(rows, { onConflict: 'investor_id,property_id' })

    if (upsertErr) {
      // Non-fatal — log but don't throw (matching already computed)
      console.error('[investorService] runMatchingForProperty/upsert error:', upsertErr, {
        property_id: propertyId,
        tenant_id:   tenantId,
        count:       rows.length,
      })
    } else {
      // Update last_matched_at on the property's top investors
      void db
        .from('investors')
        .update({ last_matched_at: now, updated_at: now })
        .in('id', toUpsert.map(r => r.investor_id))
        .eq('tenant_id', tenantId)
    }
  }

  return ranked
}

// ---------------------------------------------------------------------------
// getMatchesForInvestor
// Returns all stored matches for an investor, ordered by score desc
// ---------------------------------------------------------------------------

export async function getMatchesForInvestor(
  investorId: string,
  tenantId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('investor_matches')
    .select('*, properties(*)')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('match_score', { ascending: false })
    .limit(limit)

  assertNoError(error, `getMatchesForInvestor(${investorId})`)
  return (data ?? []) as Record<string, unknown>[]
}

// ---------------------------------------------------------------------------
// getMatchesForProperty
// Returns all stored matches for a property, ordered by score desc
// ---------------------------------------------------------------------------

export async function getMatchesForProperty(
  propertyId: string,
  tenantId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await db
    .from('investor_matches')
    .select('*, investors(*)')
    .eq('property_id', propertyId)
    .eq('tenant_id', tenantId)
    .order('match_score', { ascending: false })
    .limit(limit)

  assertNoError(error, `getMatchesForProperty(${propertyId})`)
  return (data ?? []) as Record<string, unknown>[]
}
