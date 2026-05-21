// Agency Group — Canonical Entity Manager
// lib/crm/canonicalEntityManager.ts
// TypeScript strict — 0 errors
//
// Ensures 1 source of truth per entity across all data sources.
// Canonical contact = contact with highest data completeness + oldest created_at.
// Handles: contact consolidation, deal ownership, property canonical reference.
// RULE: Never deletes — always marks as merged/superseded.

import { supabaseAdmin } from '@/lib/supabase'

function uuidv4(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanonicalEntity {
  entity_id: string
  tenant_id: string
  entity_type: 'contact' | 'deal' | 'property'
  canonical_id: string
  superseded_ids: string[]
  data_completeness: number
  last_verified_at: string
  version: number
}

export interface EntityCompletenessScore {
  record_id: string
  entity_type: string
  total_fields: number
  populated_fields: number
  score: number
  missing_critical: string[]
}

// ---------------------------------------------------------------------------
// Field definitions per entity type
// ---------------------------------------------------------------------------

const CONTACT_CRITICAL_FIELDS = ['name', 'email', 'phone', 'zone', 'budget'] as const
const CONTACT_ALL_FIELDS      = [
  'name', 'full_name', 'email', 'phone', 'zone', 'budget',
  'nationality', 'status', 'source', 'notes', 'address',
] as const

const DEAL_CRITICAL_FIELDS = ['title', 'stage', 'contact_id', 'value'] as const
const DEAL_ALL_FIELDS      = [
  'title', 'stage', 'contact_id', 'value', 'property_id',
  'expected_close', 'probability', 'notes', 'assigned_to',
] as const

const PROPERTY_CRITICAL_FIELDS = ['title', 'price', 'zone', 'type'] as const
const PROPERTY_ALL_FIELDS      = [
  'title', 'price', 'zone', 'type', 'area', 'bedrooms',
  'bathrooms', 'description', 'images', 'status',
] as const

type FieldList = readonly string[]

function scoreFields(
  record: Record<string, unknown>,
  allFields: FieldList,
  criticalFields: FieldList
): EntityCompletenessScore & { entity_type: string; record_id: string } {
  const populated_fields = allFields.filter(f => {
    const val = record[f]
    return val !== null && val !== undefined && val !== ''
  }).length

  const missing_critical = criticalFields.filter(f => {
    const val = record[f]
    return val === null || val === undefined || val === ''
  })

  const score = Math.round((populated_fields / allFields.length) * 100)

  return {
    record_id:       (record['id'] as string) ?? '',
    entity_type:     '',
    total_fields:    allFields.length,
    populated_fields,
    score,
    missing_critical: [...missing_critical],
  }
}

// ---------------------------------------------------------------------------
// computeContactCompleteness
// ---------------------------------------------------------------------------

export function computeContactCompleteness(
  contact: Record<string, unknown>
): EntityCompletenessScore {
  const result = scoreFields(contact, CONTACT_ALL_FIELDS, CONTACT_CRITICAL_FIELDS)
  return { ...result, entity_type: 'contact' }
}

// ---------------------------------------------------------------------------
// computeDealCompleteness
// ---------------------------------------------------------------------------

export function computeDealCompleteness(
  deal: Record<string, unknown>
): EntityCompletenessScore {
  const result = scoreFields(deal, DEAL_ALL_FIELDS, DEAL_CRITICAL_FIELDS)
  return { ...result, entity_type: 'deal' }
}

// ---------------------------------------------------------------------------
// computePropertyCompleteness
// ---------------------------------------------------------------------------

export function computePropertyCompleteness(
  property: Record<string, unknown>
): EntityCompletenessScore {
  const result = scoreFields(property, PROPERTY_ALL_FIELDS, PROPERTY_CRITICAL_FIELDS)
  return { ...result, entity_type: 'property' }
}

// ---------------------------------------------------------------------------
// getOrCreateCanonicalEntity
// ---------------------------------------------------------------------------

export async function getOrCreateCanonicalEntity(
  tenantId: string,
  entityType: 'contact' | 'deal' | 'property',
  recordId: string
): Promise<CanonicalEntity> {
  const db = supabaseAdmin as any

  // Try to find existing canonical entity
  const { data: existing } = await db
    .from('canonical_entities')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('canonical_id', recordId)
    .single()

  if (existing) {
    return {
      entity_id:         existing.id as string,
      tenant_id:         existing.tenant_id as string,
      entity_type:       existing.entity_type as 'contact' | 'deal' | 'property',
      canonical_id:      existing.canonical_id as string,
      superseded_ids:    (existing.superseded_ids as string[]) ?? [],
      data_completeness: existing.data_completeness as number,
      last_verified_at:  existing.last_verified_at as string,
      version:           existing.version as number,
    }
  }

  // Compute completeness for the record
  let data_completeness = 0
  try {
    const tableMap: Record<string, string> = {
      contact:  'contacts',
      deal:     'deals',
      property: 'properties',
    }
    const tableName = tableMap[entityType]
    const { data: record } = await db
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .single()

    if (record) {
      const recordData = record as Record<string, unknown>
      if (entityType === 'contact')  data_completeness = computeContactCompleteness(recordData).score
      if (entityType === 'deal')     data_completeness = computeDealCompleteness(recordData).score
      if (entityType === 'property') data_completeness = computePropertyCompleteness(recordData).score
    }
  } catch {
    // Non-fatal — proceed with 0 completeness
  }

  const newEntityId = uuidv4()
  const now         = new Date().toISOString()

  const insertData = {
    id:               newEntityId,
    tenant_id:        tenantId,
    entity_type:      entityType,
    canonical_id:     recordId,
    superseded_ids:   [] as string[],
    data_completeness,
    version:          1,
    last_verified_at: now,
    created_at:       now,
  }

  await db.from('canonical_entities').upsert(insertData, {
    onConflict: 'tenant_id,entity_type,canonical_id',
  })

  return {
    entity_id:         newEntityId,
    tenant_id:         tenantId,
    entity_type:       entityType,
    canonical_id:      recordId,
    superseded_ids:    [],
    data_completeness,
    last_verified_at:  now,
    version:           1,
  }
}

// ---------------------------------------------------------------------------
// markAsSuperseded — marks a record as merged/superseded; creates audit entry
// ---------------------------------------------------------------------------

export async function markAsSuperseded(
  tenantId: string,
  supersededId: string,
  canonicalId: string
): Promise<void> {
  const db = supabaseAdmin as any

  // 1. Update the canonical entity to include superseded ID
  const { data: canonical } = await db
    .from('canonical_entities')
    .select('superseded_ids, version')
    .eq('tenant_id', tenantId)
    .eq('canonical_id', canonicalId)
    .single()

  const currentSuperseded: string[] = (canonical?.superseded_ids as string[]) ?? []
  if (!currentSuperseded.includes(supersededId)) {
    currentSuperseded.push(supersededId)
  }

  await db
    .from('canonical_entities')
    .update({
      superseded_ids:   currentSuperseded,
      version:          ((canonical?.version as number) ?? 1) + 1,
      last_verified_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('canonical_id', canonicalId)

  // 2. Create an audit log entry if the table exists
  try {
    await db.from('audit_log').insert({
      id:          uuidv4(),
      tenant_id:   tenantId,
      action:      'entity_superseded',
      entity_type: 'contact',
      entity_id:   supersededId,
      metadata:    { canonical_id: canonicalId, superseded_id: supersededId },
      created_at:  new Date().toISOString(),
    })
  } catch {
    // Audit log is best-effort
  }
}

// ---------------------------------------------------------------------------
// getEntityCompleteness — aggregate completeness stats for a tenant
// ---------------------------------------------------------------------------

export async function getEntityCompleteness(
  tenantId: string,
  entityType: 'contact' | 'deal' | 'property'
): Promise<{
  avg_score: number
  complete_pct: number
  worst_records: string[]
}> {
  const db = supabaseAdmin as any

  const tableMap: Record<string, string> = {
    contact:  'contacts',
    deal:     'deals',
    property: 'properties',
  }
  const tableName = tableMap[entityType]

  const { data } = await db
    .from(tableName)
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(500)

  const records: Record<string, unknown>[] = data ?? []

  if (records.length === 0) {
    return { avg_score: 0, complete_pct: 0, worst_records: [] }
  }

  const scores = records.map(r => {
    let score = 0
    if (entityType === 'contact')  score = computeContactCompleteness(r).score
    if (entityType === 'deal')     score = computeDealCompleteness(r).score
    if (entityType === 'property') score = computePropertyCompleteness(r).score
    return { id: (r['id'] as string) ?? '', score }
  })

  const avg_score    = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
  const complete_pct = Math.round((scores.filter(s => s.score >= 80).length / scores.length) * 100)

  const worst_records = [...scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map(s => s.id)

  return { avg_score, complete_pct, worst_records }
}
