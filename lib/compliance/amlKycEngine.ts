// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — AML/KYC Engine v1.0
// lib/compliance/amlKycEngine.ts
//
// Integration layer for KYC/AML providers (SumSub/Onfido abstraction):
//   - Provider-agnostic KYC initiation
//   - Webhook processing for SUMSUB + ONFIDO
//   - AML risk assessment (FATF lists, PEP, transaction thresholds)
//   - MiFID II tier classification
//   - EU AML threshold enforcement (€15,000)
//
// TypeScript strict — 0 errors
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Logger shim ──────────────────────────────────────────────────────────────

let log: { info: (msg: string, ctx?: unknown) => void; warn: (msg: string, ctx?: unknown) => void; error: (msg: string, ctx?: unknown) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('@/lib/observability/logger') as { logger: typeof log }
  log = logger
} catch {
  log = {
    info: (msg, ctx) => console.log('[amlKycEngine]', msg, ctx ?? ''),
    warn: (msg, ctx) => console.warn('[amlKycEngine]', msg, ctx ?? ''),
    error: (msg, ctx) => console.error('[amlKycEngine]', msg, ctx ?? ''),
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type KycStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'MANUAL_REVIEW'
  | 'EXPIRED'

export type AmlRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE'

export type KycProvider = 'SUMSUB' | 'ONFIDO' | 'MANUAL'

export interface KycRecord {
  kyc_id: string
  tenant_id: string
  subject_id: string
  subject_type: 'INVESTOR' | 'BUYER' | 'SELLER' | 'BROKER'
  provider: KycProvider
  provider_reference: string | null
  status: KycStatus
  aml_risk: AmlRisk
  nationality: string | null
  country_of_residence: string | null
  is_pep: boolean
  is_sanctioned: boolean
  mifid_tier: 'RETAIL' | 'PROFESSIONAL' | 'ELIGIBLE_COUNTERPARTY'
  documents_verified: string[]
  initiated_at: string
  approved_at: string | null
  expires_at: string | null // KYC validity: 1 year
  risk_factors: string[]
  check_notes: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

// FATF high-risk and non-cooperative jurisdictions (subset)
export const HIGH_RISK_COUNTRIES = ['IR', 'KP', 'SY', 'YE', 'LY', 'SO', 'SD', 'MM']

// EU AML threshold: €15,000 triggers enhanced due diligence
const AML_THRESHOLD_CENTS = BigInt(1_500_000) // €15,000 in cents

// High-value threshold: €500,000
const HIGH_VALUE_THRESHOLD_CENTS = BigInt(50_000_000) // €500,000 in cents

// ─── initiateKyc ─────────────────────────────────────────────────────────────

export async function initiateKyc(
  subjectId: string,
  subjectType: KycRecord['subject_type'],
  nationality: string,
  countryOfResidence: string,
  tenantId: string,
): Promise<KycRecord> {
  const kycId = randomUUID()

  // Determine provider
  let provider: KycProvider = 'MANUAL'
  if (process.env.SUMSUB_API_KEY) {
    provider = 'SUMSUB'
  } else if (process.env.ONFIDO_API_KEY) {
    provider = 'ONFIDO'
  }

  // Assess initial risk factors
  const riskFactors: string[] = []
  if (HIGH_RISK_COUNTRIES.includes(nationality.toUpperCase())) {
    riskFactors.push(`High-risk nationality: ${nationality}`)
  }
  if (HIGH_RISK_COUNTRIES.includes(countryOfResidence.toUpperCase())) {
    riskFactors.push(`High-risk country of residence: ${countryOfResidence}`)
  }

  const record: KycRecord = {
    kyc_id:              kycId,
    tenant_id:           tenantId,
    subject_id:          subjectId,
    subject_type:        subjectType,
    provider,
    provider_reference:  null,
    status:              'PENDING',
    aml_risk:            riskFactors.length > 0 ? 'HIGH' : 'MEDIUM',
    nationality:         nationality || null,
    country_of_residence:countryOfResidence || null,
    is_pep:              false,
    is_sanctioned:       false,
    mifid_tier:          'RETAIL',
    documents_verified:  [],
    initiated_at:        new Date().toISOString(),
    approved_at:         null,
    expires_at:          null,
    risk_factors:        riskFactors,
    check_notes:         null,
  }

  const { error } = await (supabaseAdmin as any).from('kyc_records').insert(record)
  if (error) {
    log.error('Failed to insert KYC record', { error, kycId })
    throw new Error(`KYC insert failed: ${error.message}`)
  }

  // Fire-and-forget: notify external provider
  if (provider !== 'MANUAL') {
    void _notifyKycProvider(provider, kycId, subjectId, nationality).catch(e =>
      console.warn('[amlKycEngine] provider notification failed', e),
    )
  }

  log.info('KYC initiated', { kycId, subjectId, provider })
  return record
}

// ─── _notifyKycProvider (internal) ───────────────────────────────────────────

async function _notifyKycProvider(
  provider: KycProvider,
  kycId: string,
  subjectId: string,
  nationality: string,
): Promise<void> {
  if (provider === 'SUMSUB') {
    const apiKey = process.env.SUMSUB_API_KEY!
    const baseUrl = process.env.SUMSUB_BASE_URL ?? 'https://api.sumsub.com'
    const body = JSON.stringify({ externalUserId: subjectId, nationality, tags: ['real_estate', kycId] })
    await fetch(`${baseUrl}/resources/applicants?levelName=basic-kyc-level`, {
      method: 'POST',
      headers: { 'X-App-Token': apiKey, 'Content-Type': 'application/json' },
      body,
    })
  } else if (provider === 'ONFIDO') {
    const apiKey = process.env.ONFIDO_API_KEY!
    const body = JSON.stringify({ first_name: subjectId, last_name: kycId })
    await fetch('https://api.onfido.com/v3.6/applicants', {
      method: 'POST',
      headers: { Authorization: `Token token=${apiKey}`, 'Content-Type': 'application/json' },
      body,
    })
  }
}

// ─── processKycWebhook ────────────────────────────────────────────────────────

export async function processKycWebhook(
  provider: KycProvider,
  webhookPayload: Record<string, unknown>,
): Promise<{ kyc_id: string; new_status: KycStatus; aml_risk: AmlRisk }> {
  let providerReference = ''
  let newStatus: KycStatus = 'MANUAL_REVIEW'

  if (provider === 'SUMSUB') {
    const applicantId = webhookPayload['applicantId'] as string
    const reviewResult = webhookPayload['reviewResult'] as Record<string, unknown> | undefined
    const reviewAnswer = reviewResult?.['reviewAnswer'] as string | undefined
    providerReference = applicantId
    if (reviewAnswer === 'GREEN') newStatus = 'APPROVED'
    else if (reviewAnswer === 'RED') newStatus = 'REJECTED'
    else newStatus = 'MANUAL_REVIEW'
  } else if (provider === 'ONFIDO') {
    const obj = webhookPayload['object'] as Record<string, unknown> | undefined
    providerReference = (obj?.['id'] as string) ?? ''
    const objStatus = obj?.['status'] as string | undefined
    if (objStatus === 'complete') newStatus = 'APPROVED'
    else if (objStatus === 'consider') newStatus = 'MANUAL_REVIEW'
    else if (objStatus === 'clear') newStatus = 'APPROVED'
    else newStatus = 'MANUAL_REVIEW'
  } else {
    // MANUAL: extract manually
    providerReference = (webhookPayload['reference'] as string) ?? ''
    const status = webhookPayload['status'] as string
    if (status === 'approved') newStatus = 'APPROVED'
    else if (status === 'rejected') newStatus = 'REJECTED'
  }

  // Find KYC record by provider_reference
  const { data: kycData, error: kycErr } = await (supabaseAdmin as any)
    .from('kyc_records')
    .select('*')
    .eq('provider_reference', providerReference)
    .order('initiated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (kycErr || !kycData) {
    log.warn('KYC webhook: record not found', { providerReference })
    throw new Error(`KYC record not found for provider_reference: ${providerReference}`)
  }

  const record = kycData as KycRecord
  const expiresAt = newStatus === 'APPROVED'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : null

  const amlRisk = assessAmlRisk({ ...record, status: newStatus })

  void (supabaseAdmin as any).from('kyc_records').update({
    status:     newStatus,
    aml_risk:   amlRisk,
    approved_at:newStatus === 'APPROVED' ? new Date().toISOString() : null,
    expires_at: expiresAt,
  }).eq('kyc_id', record.kyc_id).then(({ error: e }: { error: { message: string } | null }) => {
    if (e) console.warn('[amlKycEngine] webhook update', e.message)
  })

  log.info('KYC webhook processed', { kycId: record.kyc_id, newStatus, amlRisk })
  return { kyc_id: record.kyc_id, new_status: newStatus, aml_risk: amlRisk }
}

// ─── checkKycRequired ─────────────────────────────────────────────────────────

export async function checkKycRequired(
  subjectId: string,
  transactionValueCents: bigint,
): Promise<{ required: boolean; reason: string; existing_kyc: KycRecord | null }> {
  const { data } = await (supabaseAdmin as any)
    .from('kyc_records')
    .select('*')
    .eq('subject_id', subjectId)
    .order('initiated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const existingKyc = (data as KycRecord | null)

  // No KYC at all
  if (!existingKyc) {
    return { required: true, reason: 'No KYC record found — KYC required before transaction', existing_kyc: null }
  }

  // Expired
  if (existingKyc.status === 'EXPIRED' || existingKyc.status === 'REJECTED') {
    return { required: true, reason: `KYC status is ${existingKyc.status} — renewal required`, existing_kyc: existingKyc }
  }

  // Check expiry date
  if (existingKyc.expires_at && new Date(existingKyc.expires_at) < new Date()) {
    return { required: true, reason: 'KYC expired — renewal required', existing_kyc: existingKyc }
  }

  // EU AML threshold: €15,000
  if (transactionValueCents > AML_THRESHOLD_CENTS) {
    const risk = assessAmlRisk(existingKyc, transactionValueCents)
    if (risk === 'HIGH' || risk === 'UNACCEPTABLE') {
      return {
        required: true,
        reason: `Transaction value €${(Number(transactionValueCents) / 100).toLocaleString()} exceeds AML threshold with ${risk} risk`,
        existing_kyc: existingKyc,
      }
    }
  }

  return { required: false, reason: 'KYC is current and valid', existing_kyc: existingKyc }
}

// ─── assessAmlRisk ────────────────────────────────────────────────────────────

export function assessAmlRisk(record: KycRecord, transactionValueCents?: bigint): AmlRisk {
  // UNACCEPTABLE: sanctioned entity
  if (record.is_sanctioned) return 'UNACCEPTABLE'

  // HIGH: PEP, high-risk nationality, or very high-value transaction
  if (record.is_pep) return 'HIGH'
  if (record.nationality && HIGH_RISK_COUNTRIES.includes(record.nationality.toUpperCase())) return 'HIGH'
  if (record.country_of_residence && HIGH_RISK_COUNTRIES.includes(record.country_of_residence.toUpperCase())) return 'HIGH'
  if (transactionValueCents !== undefined && transactionValueCents > HIGH_VALUE_THRESHOLD_CENTS) return 'HIGH'

  // MEDIUM: transaction between €15k–€500k with no prior KYC history
  if (
    transactionValueCents !== undefined &&
    transactionValueCents > AML_THRESHOLD_CENTS &&
    transactionValueCents <= HIGH_VALUE_THRESHOLD_CENTS &&
    (!record.approved_at)
  ) {
    return 'MEDIUM'
  }

  // LOW: approved, low-risk country, small transaction
  return 'LOW'
}

// ─── getKycSummary ────────────────────────────────────────────────────────────

export async function getKycSummary(tenantId: string): Promise<{
  total: number
  approved_pct: number
  pending_count: number
  high_risk_count: number
  expiring_soon_count: number
}> {
  const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const [allRes, approvedRes, pendingRes, highRiskRes, expiringSoonRes] = await Promise.all([
    (supabaseAdmin as any)
      .from('kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    (supabaseAdmin as any)
      .from('kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'APPROVED'),

    (supabaseAdmin as any)
      .from('kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['PENDING', 'MANUAL_REVIEW']),

    (supabaseAdmin as any)
      .from('kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('aml_risk', ['HIGH', 'UNACCEPTABLE']),

    (supabaseAdmin as any)
      .from('kyc_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'APPROVED')
      .gt('expires_at', now)
      .lt('expires_at', thirtyDaysOut),
  ])

  const total = allRes.count ?? 0
  const approved = approvedRes.count ?? 0

  return {
    total,
    approved_pct:       total > 0 ? Math.round((approved / total) * 100) : 0,
    pending_count:      pendingRes.count ?? 0,
    high_risk_count:    highRiskRes.count ?? 0,
    expiring_soon_count:expiringSoonRes.count ?? 0,
  }
}
