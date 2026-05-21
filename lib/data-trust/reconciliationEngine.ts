// Agency Group — Cross-Source Reconciliation Engine
// lib/data-trust/reconciliationEngine.ts
// Casafari vs Idealista vs CRM vs execution reality check.
// Detects: price discrepancies, duplicates across sources, missing cross-reference.
// NEVER auto-merges. Only flags + recommends.

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconciliationDiscrepancy {
  discrepancy_id: string
  entity_type: 'property' | 'contact' | 'deal'
  entity_id: string
  field: string
  source_a: string
  value_a: unknown
  source_b: string
  value_b: unknown
  delta_percentage: number | null
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  recommendation: string
}

export interface ReconciliationReport {
  tenant_id: string
  generated_at: string
  properties_checked: number
  contacts_checked: number
  discrepancies_found: number
  discrepancies: ReconciliationDiscrepancy[]
  data_health_score: number
  action_required: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDiscrepancyId(
  entityType: string,
  entityId: string,
  field: string,
  sourceA: string,
  sourceB: string,
): string {
  return createHash('sha256')
    .update(`${entityType}:${entityId}:${field}:${sourceA}:${sourceB}`)
    .digest('hex')
    .slice(0, 32)
}

function deltaPercentage(a: unknown, b: unknown): number | null {
  const numA = Number(a)
  const numB = Number(b)
  if (isNaN(numA) || isNaN(numB) || numA === 0) return null
  return Math.abs(((numB - numA) / numA) * 100)
}

// ─── runReconciliation ────────────────────────────────────────────────────────

/**
 * Runs 4 reconciliation checks across the data layer.
 * Returns a ReconciliationReport. Never merges data — only flags.
 */
export async function runReconciliation(tenantId: string): Promise<ReconciliationReport> {
  const generatedAt = new Date().toISOString()
  const discrepancies: ReconciliationDiscrepancy[] = []
  let properties_checked = 0
  let contacts_checked = 0

  // ── Check 1: Property price consistency across sources ─────────────────────
  try {
    const { data: properties, error } = await (supabaseAdmin as any)
      .from('properties')
      .select('id, external_id, source, price, reference')
      .eq('tenant_id', tenantId)
      .not('source', 'is', null)

    if (error) {
      log.warn('[reconciliationEngine] properties query failed', { error })
    } else {
      const rows = (properties ?? []) as Array<{
        id: string
        external_id: string | null
        source: string
        price: number | null
        reference: string | null
      }>

      properties_checked = rows.length

      // Group by external_id (cross-source reference)
      const byExternalId = new Map<string, typeof rows>()
      for (const row of rows) {
        const key = row.external_id ?? row.reference ?? row.id
        if (!byExternalId.has(key)) byExternalId.set(key, [])
        byExternalId.get(key)!.push(row)
      }

      // Check price delta within each group
      for (const [ref, group] of byExternalId) {
        if (group.length < 2) continue
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i]
            const b = group[j]
            if (a.price == null || b.price == null) continue
            const delta = deltaPercentage(a.price, b.price)
            if (delta !== null && delta > 5) {
              const severity: ReconciliationDiscrepancy['severity'] =
                delta > 20 ? 'CRITICAL' : delta > 10 ? 'HIGH' : 'MEDIUM'
              discrepancies.push({
                discrepancy_id: makeDiscrepancyId(
                  'property',
                  ref,
                  'price',
                  a.source,
                  b.source,
                ),
                entity_type: 'property',
                entity_id: ref,
                field: 'price',
                source_a: a.source,
                value_a: a.price,
                source_b: b.source,
                value_b: b.price,
                delta_percentage: Math.round(delta * 100) / 100,
                severity,
                recommendation: `Price discrepancy of ${delta.toFixed(1)}% between ${a.source} and ${b.source} for property ${ref}. Verify with source systems before listing.`,
              })
            }
          }
        }
      }
    }
  } catch (err) {
    log.warn('[reconciliationEngine] check 1 failed', { err })
  }

  // ── Check 2: Contact deduplication status ──────────────────────────────────
  try {
    const { data: contacts, error: contactError } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, email, phone')
      .eq('tenant_id', tenantId)
      .limit(5000)

    if (!contactError) {
      const contactRows = (contacts ?? []) as Array<{
        id: string
        email: string | null
        phone: string | null
      }>
      contacts_checked = contactRows.length

      // Detect email-based duplicates
      const emailMap = new Map<string, string[]>()
      for (const c of contactRows) {
        if (!c.email) continue
        const key = c.email.toLowerCase().trim()
        if (!emailMap.has(key)) emailMap.set(key, [])
        emailMap.get(key)!.push(c.id)
      }

      for (const [email, ids] of emailMap) {
        if (ids.length < 2) continue
        discrepancies.push({
          discrepancy_id: makeDiscrepancyId('contact', email, 'email', ids[0], ids[1]),
          entity_type: 'contact',
          entity_id: ids[0],
          field: 'email',
          source_a: 'crm_record',
          value_a: email,
          source_b: 'crm_record',
          value_b: `duplicate_ids: ${ids.join(', ')}`,
          delta_percentage: null,
          severity: 'HIGH',
          recommendation: `Contact email '${email}' appears in ${ids.length} records (${ids.join(', ')}). Review and merge via CRM deduplication workflow.`,
        })
      }

      // Check dedup_reports table if it exists
      try {
        const { data: dedupData } = await (supabaseAdmin as any)
          .from('dedup_reports')
          .select('pending_merges, entity_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .limit(50)

        const dedupRows = (dedupData ?? []) as Array<{
          pending_merges: number
          entity_id: string
        }>
        for (const dr of dedupRows) {
          discrepancies.push({
            discrepancy_id: makeDiscrepancyId(
              'contact',
              dr.entity_id,
              'dedup',
              'dedup_reports',
              'crm',
            ),
            entity_type: 'contact',
            entity_id: dr.entity_id,
            field: 'deduplication',
            source_a: 'dedup_engine',
            value_a: 'pending_merge',
            source_b: 'crm',
            value_b: dr.pending_merges,
            delta_percentage: null,
            severity: 'MEDIUM',
            recommendation: `Contact ${dr.entity_id} has ${dr.pending_merges} pending merge(s) in dedup_reports. Complete deduplication to maintain data integrity.`,
          })
        }
      } catch {
        // dedup_reports table may not exist — silently skip
      }
    }
  } catch (err) {
    log.warn('[reconciliationEngine] check 2 failed', { err })
  }

  // ── Check 3: Deal-property linkage ─────────────────────────────────────────
  try {
    const { data: deals, error: dealError } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, property_id')
      .eq('tenant_id', tenantId)

    if (!dealError) {
      const dealRows = (deals ?? []) as Array<{
        id: string
        property_id: string | null
      }>

      // Deals with no property_id
      const unlinked = dealRows.filter((d) => !d.property_id)
      for (const deal of unlinked) {
        discrepancies.push({
          discrepancy_id: makeDiscrepancyId(
            'deal',
            deal.id,
            'property_id',
            'deals',
            'properties',
          ),
          entity_type: 'deal',
          entity_id: deal.id,
          field: 'property_id',
          source_a: 'deals',
          value_a: null,
          source_b: 'properties',
          value_b: 'expected_reference',
          delta_percentage: null,
          severity: 'HIGH',
          recommendation: `Deal ${deal.id} has no property_id. Link to a property record or archive if no longer active.`,
        })
      }

      // Deals where property_id not found in properties table
      if (dealRows.length > 0) {
        const propertyIds = dealRows
          .map((d) => d.property_id)
          .filter(Boolean) as string[]

        if (propertyIds.length > 0) {
          const { data: existingProps } = await (supabaseAdmin as any)
            .from('properties')
            .select('id')
            .eq('tenant_id', tenantId)
            .in('id', propertyIds.slice(0, 500))

          const existingIds = new Set(
            ((existingProps ?? []) as Array<{ id: string }>).map((p) => p.id),
          )

          for (const deal of dealRows) {
            if (
              deal.property_id &&
              !existingIds.has(deal.property_id) &&
              propertyIds.includes(deal.property_id)
            ) {
              discrepancies.push({
                discrepancy_id: makeDiscrepancyId(
                  'deal',
                  deal.id,
                  'property_id_ref',
                  'deals',
                  'properties',
                ),
                entity_type: 'deal',
                entity_id: deal.id,
                field: 'property_id',
                source_a: 'deals',
                value_a: deal.property_id,
                source_b: 'properties',
                value_b: 'not_found',
                delta_percentage: null,
                severity: 'CRITICAL',
                recommendation: `Deal ${deal.id} references property_id ${deal.property_id} which does not exist in the properties table. Investigate data deletion or migration issue.`,
              })
            }
          }
        }
      }
    }
  } catch (err) {
    log.warn('[reconciliationEngine] check 3 failed', { err })
  }

  // ── Check 4: Match score consistency — potential pipeline leaks ────────────
  try {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString()

    const { data: matches, error: matchError } = await (supabaseAdmin as any)
      .from('matches')
      .select('id, score, deal_id, created_at')
      .eq('tenant_id', tenantId)
      .gt('score', 80)
      .lt('created_at', thirtyDaysAgo)
      .is('deal_id', null)
      .limit(100)

    if (!matchError) {
      const matchRows = (matches ?? []) as Array<{
        id: string
        score: number
        deal_id: string | null
        created_at: string
      }>

      for (const match of matchRows) {
        discrepancies.push({
          discrepancy_id: makeDiscrepancyId(
            'deal',
            match.id,
            'pipeline_leak',
            'matches',
            'deals',
          ),
          entity_type: 'deal',
          entity_id: match.id,
          field: 'deal_conversion',
          source_a: 'matches',
          value_a: `score:${match.score}`,
          source_b: 'deals',
          value_b: 'no_deal_created',
          delta_percentage: null,
          severity: 'MEDIUM',
          recommendation: `High-score match ${match.id} (score: ${match.score}) created on ${match.created_at.slice(0, 10)} has no linked deal after 30 days. Review with agent to confirm conversion or disqualify.`,
        })
      }
    }
  } catch (err) {
    log.warn('[reconciliationEngine] check 4 failed', { err })
  }

  // ── Compute data_health_score ──────────────────────────────────────────────
  const criticalCount = discrepancies.filter((d) => d.severity === 'CRITICAL').length
  const highCount = discrepancies.filter((d) => d.severity === 'HIGH').length
  const mediumCount = discrepancies.filter((d) => d.severity === 'MEDIUM').length
  const lowCount = discrepancies.filter((d) => d.severity === 'LOW').length

  const data_health_score = Math.max(
    0,
    100 - criticalCount * 20 - highCount * 10 - mediumCount * 5 - lowCount * 1,
  )

  const action_required = criticalCount > 0 || highCount > 0

  const report: ReconciliationReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    properties_checked,
    contacts_checked,
    discrepancies_found: discrepancies.length,
    discrepancies,
    data_health_score,
    action_required,
  }

  // Persist to reconciliation_reports (fire-and-forget)
  void (supabaseAdmin as any)
    .from('reconciliation_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      properties_checked,
      contacts_checked,
      discrepancies_found: discrepancies.length,
      data_health_score,
      action_required,
      discrepancies,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[reconciliationEngine] persist failed', { error })
    })
    .catch((e: unknown) => console.warn('[reconciliationEngine]', e))

  return report
}
