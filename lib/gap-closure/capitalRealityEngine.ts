// Agency Group — Capital Reality Engine
// lib/gap-closure/capitalRealityEngine.ts
// TypeScript strict — 0 errors
//
// Detects whether capital flows are REAL (backed by external bank confirmation)
// or SIMULATED (internal only).

import { randomUUID, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapitalRealityStatus =
  | 'REAL'
  | 'SIMULATED'
  | 'UNVERIFIED'
  | 'PENDING_CONFIRMATION'

export interface CapitalRealityCheck {
  check_id: string
  tenant_id: string
  entry_id: string
  entry_type: string
  amount_eur_cents: number
  reality_status: CapitalRealityStatus
  bank_confirmation_ref: string | null
  escrow_funding_confirmed: boolean
  settlement_confirmed: boolean
  external_proof_url: string | null
  blocking_execution: boolean
  checked_at: string
}

export interface CapitalRealitySummary {
  tenant_id: string
  total_entries: number
  real_entries: number
  simulated_entries: number
  unverified_entries: number
  real_capital_eur_cents: number
  simulated_capital_eur_cents: number
  real_ratio_pct: number
  can_proceed_to_execution: boolean
}

// ─── checkCapitalEntry ────────────────────────────────────────────────────────

/**
 * Reads an investor_ledger_entry and determines its capital reality status.
 * Persists result to capital_reality_checks fire-and-forget.
 */
export async function checkCapitalEntry(
  entryId: string,
  tenantId: string,
): Promise<CapitalRealityCheck> {
  const checkId = randomUUID()
  const checkedAt = new Date().toISOString()

  let entryType = 'UNKNOWN'
  let amountEurCents = 0
  let metadata: Record<string, unknown> = {}

  // Read ledger entry
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('entry_type, amount_eur_cents, metadata')
      .eq('entry_id', entryId)
      .limit(1)

    if (!error && data && data.length > 0) {
      const row = data[0] as Record<string, unknown>
      entryType = (row.entry_type as string | null) ?? 'UNKNOWN'
      amountEurCents =
        typeof row.amount_eur_cents === 'number' ? row.amount_eur_cents : 0
      metadata =
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {}
    }
  } catch (e) {
    log.warn('[capital-reality] Failed to read ledger entry', {
      entry_id: entryId,
      error: String(e),
    })
  }

  // Check for existing bank confirmation
  let bankConfirmationRef: string | null = null
  let externalProofUrl: string | null = null

  try {
    const { data: confirmData, error: confirmErr } = await (supabaseAdmin as any)
      .from('capital_reality_confirmations')
      .select('bank_ref, external_proof_url')
      .eq('entry_id', entryId)
      .eq('tenant_id', tenantId)
      .limit(1)

    if (!confirmErr && confirmData && confirmData.length > 0) {
      const row = confirmData[0] as Record<string, unknown>
      bankConfirmationRef = (row.bank_ref as string | null) ?? null
      externalProofUrl = (row.external_proof_url as string | null) ?? null
    }
  } catch (e) {
    log.warn('[capital-reality] Failed to read capital confirmations', {
      entry_id: entryId,
      error: String(e),
    })
  }

  // Determine reality status
  let realityStatus: CapitalRealityStatus

  if (bankConfirmationRef !== null) {
    realityStatus = 'REAL'
  } else if (metadata.source === 'internal_simulation') {
    realityStatus = 'SIMULATED'
  } else if (amountEurCents > 0 && entryType !== 'UNKNOWN') {
    realityStatus = 'PENDING_CONFIRMATION'
  } else {
    realityStatus = 'UNVERIFIED'
  }

  const check: CapitalRealityCheck = {
    check_id: checkId,
    tenant_id: tenantId,
    entry_id: entryId,
    entry_type: entryType,
    amount_eur_cents: amountEurCents,
    reality_status: realityStatus,
    bank_confirmation_ref: bankConfirmationRef,
    escrow_funding_confirmed: realityStatus === 'REAL',
    settlement_confirmed: false,
    external_proof_url: externalProofUrl,
    blocking_execution: realityStatus === 'SIMULATED',
    checked_at: checkedAt,
  }

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('capital_reality_checks')
    .upsert(
      {
        check_id: checkId,
        tenant_id: tenantId,
        entry_id: entryId,
        entry_type: entryType,
        amount_eur_cents: amountEurCents,
        reality_status: realityStatus,
        bank_confirmation_ref: bankConfirmationRef,
        escrow_funding_confirmed: check.escrow_funding_confirmed,
        settlement_confirmed: false,
        external_proof_url: externalProofUrl,
        blocking_execution: check.blocking_execution,
        checked_at: checkedAt,
      },
      { onConflict: 'check_id' },
    )
    .catch((e: unknown) =>
      log.warn('[capital-reality] Failed to persist check', { error: String(e) }),
    )

  log.info('[capital-reality] Capital entry checked', {
    entry_id: entryId,
    tenant_id: tenantId,
    reality_status: realityStatus,
  })

  return check
}

// ─── confirmCapitalReal ───────────────────────────────────────────────────────

/**
 * Records external bank confirmation for a capital entry.
 * Uses SHA-256 hash of (entryId + bankRef + tenantId) as idempotency key.
 */
export async function confirmCapitalReal(
  entryId: string,
  bankRef: string,
  tenantId: string,
  externalProofUrl?: string,
): Promise<void> {
  const confirmationHash = createHash('sha256')
    .update(`${entryId}:${bankRef}:${tenantId}`)
    .digest('hex')

  const confirmedAt = new Date().toISOString()

  try {
    const { error: insertErr } = await (supabaseAdmin as any)
      .from('capital_reality_confirmations')
      .insert({
        tenant_id: tenantId,
        entry_id: entryId,
        bank_ref: bankRef,
        confirmation_hash: confirmationHash,
        external_proof_url: externalProofUrl ?? null,
        confirmed_at: confirmedAt,
        confirmed_by: 'api',
      })

    if (insertErr) {
      // Unique constraint on confirmation_hash means already confirmed — idempotent
      if ((insertErr as { code?: string }).code === '23505') {
        log.info('[capital-reality] Confirmation already exists (idempotent)', {
          entry_id: entryId,
          confirmation_hash: confirmationHash,
        })
        return
      }
      throw insertErr
    }
  } catch (e) {
    log.error('[capital-reality] Failed to insert capital confirmation', e, {
      entry_id: entryId,
      bank_ref: bankRef,
    })
    throw e
  }

  // Update capital_reality_checks to REAL
  void (supabaseAdmin as any)
    .from('capital_reality_checks')
    .update({
      reality_status: 'REAL',
      bank_confirmation_ref: bankRef,
      escrow_funding_confirmed: true,
      blocking_execution: false,
      external_proof_url: externalProofUrl ?? null,
    })
    .eq('entry_id', entryId)
    .eq('tenant_id', tenantId)
    .catch((e: unknown) =>
      log.warn('[capital-reality] Failed to update checks to REAL', { error: String(e) }),
    )

  log.info('[capital-reality] Capital entry confirmed as REAL', {
    entry_id: entryId,
    tenant_id: tenantId,
    bank_ref: bankRef,
    confirmation_hash: confirmationHash,
  })
}

// ─── getCapitalRealitySummary ─────────────────────────────────────────────────

/**
 * Aggregates all capital_reality_checks for a tenant.
 * Computes real/simulated/unverified counts and amounts.
 */
export async function getCapitalRealitySummary(
  tenantId: string,
): Promise<CapitalRealitySummary> {
  let rows: Array<{
    reality_status: CapitalRealityStatus
    amount_eur_cents: number
  }> = []

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('capital_reality_checks')
      .select('reality_status, amount_eur_cents')
      .eq('tenant_id', tenantId)

    if (!error && Array.isArray(data)) {
      rows = data as typeof rows
    }
  } catch (e) {
    log.warn('[capital-reality] Failed to read capital_reality_checks', {
      tenant_id: tenantId,
      error: String(e),
    })
  }

  let realEntries = 0
  let simulatedEntries = 0
  let unverifiedEntries = 0
  let realCapitalCents = 0
  let simulatedCapitalCents = 0

  for (const row of rows) {
    const amount =
      typeof row.amount_eur_cents === 'number' ? row.amount_eur_cents : 0

    switch (row.reality_status) {
      case 'REAL':
        realEntries++
        realCapitalCents += amount
        break
      case 'SIMULATED':
        simulatedEntries++
        simulatedCapitalCents += amount
        break
      default:
        unverifiedEntries++
        break
    }
  }

  const totalEntries = rows.length
  const totalCapital = realCapitalCents + simulatedCapitalCents
  const realRatioPct = totalCapital > 0 ? (realCapitalCents / totalCapital) * 100 : 0

  return {
    tenant_id: tenantId,
    total_entries: totalEntries,
    real_entries: realEntries,
    simulated_entries: simulatedEntries,
    unverified_entries: unverifiedEntries,
    real_capital_eur_cents: realCapitalCents,
    simulated_capital_eur_cents: simulatedCapitalCents,
    real_ratio_pct: Math.round(realRatioPct * 100) / 100,
    can_proceed_to_execution: realRatioPct >= 80,
  }
}

// ─── blockSimulatedExecution ──────────────────────────────────────────────────

/**
 * Returns blocked=true if simulated capital exceeds 20% of total.
 */
export async function blockSimulatedExecution(tenantId: string): Promise<{
  blocked: boolean
  reason: string
  simulated_amount_eur_cents: number
}> {
  const summary = await getCapitalRealitySummary(tenantId)

  const blocked = !summary.can_proceed_to_execution

  const reason = blocked
    ? `Simulated capital ratio is ${(100 - summary.real_ratio_pct).toFixed(2)}% — exceeds 20% threshold. Real capital ratio: ${summary.real_ratio_pct.toFixed(2)}%.`
    : `Capital reality check passed. Real capital ratio: ${summary.real_ratio_pct.toFixed(2)}% (>= 80% required).`

  log.info('[capital-reality] Execution block check', {
    tenant_id: tenantId,
    blocked,
    real_ratio_pct: summary.real_ratio_pct,
    simulated_amount_eur_cents: summary.simulated_capital_eur_cents,
  })

  return {
    blocked,
    reason,
    simulated_amount_eur_cents: summary.simulated_capital_eur_cents,
  }
}
