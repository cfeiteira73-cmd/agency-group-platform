// Agency Group — Investor KYC Engine
// lib/compliance/investorKyc.ts
// Identity verification workflow per investor.
// Integrates with KYC providers (Jumio / Onfido / Sumsub) via webhook events.
// Locally stores ONLY: status flags, risk score, jurisdiction, provider reference.
// NEVER stores raw documents, biometrics, or passport numbers locally.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type KycStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUSPENDED'

export type InvestorType =
  | 'RETAIL'
  | 'ACCREDITED'
  | 'INSTITUTIONAL'
  | 'FAMILY_OFFICE'
  | 'SOVEREIGN_FUND'

export interface InvestorKycRecord {
  kyc_id: string
  investor_id: string
  tenant_id: string
  status: KycStatus
  investor_type: InvestorType
  risk_score: number
  jurisdiction: string
  country_of_residence: string
  is_eu_resident: boolean
  is_pep: boolean
  aml_cleared: boolean
  kyc_provider: string | null
  provider_reference: string | null
  approved_at: string | null
  expires_at: string | null
  last_reviewed_at: string | null
  metadata: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EU_COUNTRIES: Set<string> = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI',
  'FR','GR','HR','HU','IE','IT','LT','LU','LV','MT',
  'NL','PL','PT','RO','SE','SI','SK',
])

const HIGH_RISK_JURISDICTIONS: Set<string> = new Set([
  'RU','IR','KP','BY','SY','CU','VE','LY','SD','YE',
])

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Row → Record mapper ──────────────────────────────────────────────────────

function toRecord(row: Record<string, unknown>): InvestorKycRecord {
  return {
    kyc_id:             String(row['kyc_id'] ?? ''),
    investor_id:        String(row['investor_id'] ?? ''),
    tenant_id:          String(row['tenant_id'] ?? ''),
    status:             (row['status'] as KycStatus) ?? 'NOT_STARTED',
    investor_type:      (row['investor_type'] as InvestorType) ?? 'RETAIL',
    risk_score:         Number(row['risk_score'] ?? 0),
    jurisdiction:       String(row['jurisdiction'] ?? ''),
    country_of_residence: String(row['country_of_residence'] ?? ''),
    is_eu_resident:     Boolean(row['is_eu_resident']),
    is_pep:             Boolean(row['is_pep']),
    aml_cleared:        Boolean(row['aml_cleared']),
    kyc_provider:       row['kyc_provider'] != null ? String(row['kyc_provider']) : null,
    provider_reference: row['provider_reference'] != null ? String(row['provider_reference']) : null,
    approved_at:        row['approved_at'] != null ? String(row['approved_at']) : null,
    expires_at:         row['expires_at'] != null ? String(row['expires_at']) : null,
    last_reviewed_at:   row['last_reviewed_at'] != null ? String(row['last_reviewed_at']) : null,
    metadata:           (row['metadata'] as Record<string, unknown>) ?? {},
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a KYC record for an investor in NOT_STARTED state.
 * Sets is_eu_resident based on the EU country list.
 */
export async function initializeKyc(
  investorId: string,
  tenantId: string,
  investorType: InvestorType,
  jurisdiction: string,
  countryOfResidence: string,
): Promise<InvestorKycRecord> {
  const kyc_id = `kyc_${randomUUID()}`
  const is_eu_resident = EU_COUNTRIES.has(countryOfResidence.toUpperCase())

  const row = {
    kyc_id,
    investor_id: investorId,
    tenant_id: tenantId,
    status: 'NOT_STARTED' as KycStatus,
    investor_type: investorType,
    risk_score: 0,
    jurisdiction,
    country_of_residence: countryOfResidence,
    is_eu_resident,
    is_pep: false,
    aml_cleared: false,
    kyc_provider: null,
    provider_reference: null,
    approved_at: null,
    expires_at: null,
    last_reviewed_at: null,
    metadata: {},
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('investor_kyc_records')
    .insert(row)
    .select()
    .single()

  if (error) {
    log.error('[investorKyc] initializeKyc failed', error, { investor_id: investorId })
    throw new Error(`initializeKyc: ${error.message}`)
  }

  log.info('[investorKyc] KYC record initialized', {
    investor_id: investorId,
    kyc_id,
    investor_type: investorType,
  })

  return toRecord(data as Record<string, unknown>)
}

/**
 * Updates KYC status, records an audit event.
 * If APPROVED: sets approved_at + expires_at (+1 year).
 * If REJECTED/SUSPENDED: adds +20 to risk_score.
 */
export async function updateKycStatus(
  investorId: string,
  tenantId: string,
  newStatus: KycStatus,
  providerRef: string | null,
  notes: string,
): Promise<InvestorKycRecord> {
  // Fetch current record
  const current = await getKycRecord(investorId, tenantId)
  if (!current) {
    throw new Error(`updateKycStatus: KYC record not found for investor ${investorId}`)
  }

  const now = new Date()
  const updates: Record<string, unknown> = {
    status: newStatus,
    last_reviewed_at: now.toISOString(),
    provider_reference: providerRef ?? current.provider_reference,
  }

  if (newStatus === 'APPROVED') {
    updates['approved_at'] = now.toISOString()
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    updates['expires_at'] = expiresAt.toISOString()
  }

  if (newStatus === 'REJECTED' || newStatus === 'SUSPENDED') {
    updates['risk_score'] = Math.min(100, current.risk_score + 20)
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('investor_kyc_records')
    .update(updates)
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    log.error('[investorKyc] updateKycStatus failed', error, { investor_id: investorId, newStatus })
    throw new Error(`updateKycStatus: ${error.message}`)
  }

  // Record audit event — fire-and-forget
  void (supabaseAdmin as any)
    .from('kyc_audit_events')
    .insert({
      tenant_id: tenantId,
      investor_id: investorId,
      event_type: 'STATUS_CHANGE',
      from_status: current.status,
      to_status: newStatus,
      provider_reference: providerRef,
      notes,
      recorded_at: now.toISOString(),
    })
    .then(() => null)
    .catch((e: unknown) => console.warn('[investorKyc] audit event write failed', e))

  log.info('[investorKyc] KYC status updated', {
    investor_id: investorId,
    from: current.status,
    to: newStatus,
  })

  return toRecord(data as Record<string, unknown>)
}

/**
 * Computes a risk score (0–100) for an investor based on known risk factors.
 * Does NOT persist the score — call updateKycStatus to persist.
 */
export async function computeRiskScore(
  investorId: string,
  tenantId: string,
): Promise<number> {
  const record = await getKycRecord(investorId, tenantId)
  if (!record) return 0

  let score = 0

  if (!record.is_eu_resident) score += 30
  if (record.is_pep) score += 20
  if (HIGH_RISK_JURISDICTIONS.has(record.jurisdiction.toUpperCase())) score += 10
  if (!record.aml_cleared) score += 10

  return Math.min(100, score)
}

/**
 * Reads the KYC record for an investor from investor_kyc_records.
 */
export async function getKycRecord(
  investorId: string,
  tenantId: string,
): Promise<InvestorKycRecord | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_kyc_records')
    .select('*')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null // not found
    log.error('[investorKyc] getKycRecord failed', error, { investor_id: investorId })
    return null
  }

  return data ? toRecord(data as Record<string, unknown>) : null
}

/**
 * Returns true only if:
 *  - status = APPROVED
 *  - expires_at > now()
 *  - aml_cleared = true
 */
export async function isKycApproved(
  investorId: string,
  tenantId: string,
): Promise<boolean> {
  const record = await getKycRecord(investorId, tenantId)
  if (!record) return false
  if (record.status !== 'APPROVED') return false
  if (!record.aml_cleared) return false
  if (!record.expires_at) return false
  return new Date(record.expires_at) > new Date()
}

/**
 * Returns all PENDING and UNDER_REVIEW KYC records for a tenant.
 */
export async function listPendingKyc(tenantId: string): Promise<InvestorKycRecord[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_kyc_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['PENDING', 'UNDER_REVIEW'])
    .order('last_reviewed_at', { ascending: false })

  if (error) {
    log.error('[investorKyc] listPendingKyc failed', error, { tenant_id: tenantId })
    return []
  }

  return ((data as Record<string, unknown>[]) ?? []).map(toRecord)
}

export { TENANT_ID as DEFAULT_TENANT_ID }
