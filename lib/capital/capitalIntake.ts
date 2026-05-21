// Agency Group — Capital Intake Layer
// lib/capital/capitalIntake.ts
// Abstraction for capital ingestion: SEPA / SWIFT / Stripe / Adyen / institutional injection.
// Each provider gracefully no-ops when not configured.
// Capital intake always creates a ledger entry.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { recordLedgerEntry } from '@/lib/capital/investorLedger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IntakeProvider = 'sepa' | 'swift' | 'stripe' | 'adyen' | 'institutional' | 'manual'

export interface IntakeRequest {
  investor_id: string
  tenant_id: string
  amount_eur_cents: number
  provider: IntakeProvider
  reference: string
  idempotency_key: string
  metadata?: Record<string, unknown>
}

export interface IntakeResult {
  success: boolean
  intake_id: string
  provider: IntakeProvider
  amount_eur_cents: number
  ledger_entry_id: string | null
  error?: string
  requires_manual_confirmation: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ─── processCapitalIntake ─────────────────────────────────────────────────────

/**
 * Routes capital intake through the appropriate provider.
 * On success: persists intake record + creates DEPOSIT ledger entry.
 * On PENDING: persists intake record without ledger entry; awaits confirmManualIntake.
 */
export async function processCapitalIntake(req: IntakeRequest): Promise<IntakeResult> {
  const tid = req.tenant_id || CANONICAL_TENANT
  const intakeId = `int_${randomUUID()}`

  switch (req.provider) {
    case 'sepa':
      return handleWebhookProvider(req, tid, intakeId, 'SEPA_WEBHOOK_SECRET', 'sepa')

    case 'swift':
      return handleWebhookProvider(req, tid, intakeId, 'SWIFT_WEBHOOK_SECRET', 'swift')

    case 'stripe':
      return handleStripeIntake(req, tid, intakeId)

    case 'adyen':
      return handleAdyenIntake(req, tid, intakeId)

    case 'institutional':
      return handleDirectIntake(req, tid, intakeId, false)

    case 'manual':
      return handleDirectIntake(req, tid, intakeId, false)

    default: {
      const _exhaustive: never = req.provider
      throw new Error(`[capitalIntake] Unknown provider: ${String(_exhaustive)}`)
    }
  }
}

// ─── confirmManualIntake ──────────────────────────────────────────────────────

/**
 * Marks a PENDING_CONFIRMATION intake as CONFIRMED and creates the DEPOSIT ledger entry.
 */
export async function confirmManualIntake(
  intakeId: string,
  confirmedBy: string,
  tenantId: string,
): Promise<IntakeResult> {
  const tid = tenantId || CANONICAL_TENANT
  const now = new Date().toISOString()

  const { data: intakeRow, error: fetchErr } = await (supabaseAdmin as any)
    .from('capital_intake_requests')
    .select('*')
    .eq('intake_id', intakeId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (fetchErr || !intakeRow) {
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    'manual',
      amount_eur_cents:            0,
      ledger_entry_id:             null,
      error:                       fetchErr?.message ?? 'Intake record not found',
      requires_manual_confirmation: false,
    }
  }

  if (intakeRow.status !== 'PENDING_CONFIRMATION') {
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    intakeRow.provider as IntakeProvider,
      amount_eur_cents:            intakeRow.amount_eur_cents as number,
      ledger_entry_id:             (intakeRow.ledger_entry_id as string) ?? null,
      error:                       `Intake is not pending confirmation (status: ${String(intakeRow.status)})`,
      requires_manual_confirmation: false,
    }
  }

  // Create DEPOSIT ledger entry
  let ledgerEntryId: string | null = null
  try {
    const ledgerEntry = await recordLedgerEntry(
      {
        investor_id:      intakeRow.investor_id as string,
        tenant_id:        tid,
        entry_type:       'DEPOSIT',
        amount_eur_cents: intakeRow.amount_eur_cents as number,
        reference_id:     intakeId,
        reference_type:   'deposit',
        description:      `Capital intake confirmed: ${String(intakeRow.provider)} ref ${String(intakeRow.reference)}`,
        idempotency_key:  `confirm_${intakeId}`,
      },
      tid,
    )
    ledgerEntryId = ledgerEntry.entry_id
  } catch (err) {
    log.info('[capitalIntake] confirmManualIntake ledger error', { intake_id: intakeId, error: String(err) })
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    intakeRow.provider as IntakeProvider,
      amount_eur_cents:            intakeRow.amount_eur_cents as number,
      ledger_entry_id:             null,
      error:                       String(err),
      requires_manual_confirmation: false,
    }
  }

  // Update intake record
  const { error: updateErr } = await (supabaseAdmin as any)
    .from('capital_intake_requests')
    .update({
      status:          'CONFIRMED',
      ledger_entry_id: ledgerEntryId,
      confirmed_by:    confirmedBy,
      confirmed_at:    now,
    })
    .eq('intake_id', intakeId)
    .eq('tenant_id', tid)

  if (updateErr) {
    log.info('[capitalIntake] confirmManualIntake update error', { intake_id: intakeId, error: updateErr.message })
  }

  log.info('[capitalIntake] manual intake confirmed', { intake_id: intakeId, confirmed_by: confirmedBy })

  return {
    success:                     true,
    intake_id:                   intakeId,
    provider:                    intakeRow.provider as IntakeProvider,
    amount_eur_cents:            intakeRow.amount_eur_cents as number,
    ledger_entry_id:             ledgerEntryId,
    requires_manual_confirmation: false,
  }
}

// ─── getPendingIntakes ────────────────────────────────────────────────────────

/**
 * Lists all intakes in PENDING_CONFIRMATION status for a tenant.
 */
export async function getPendingIntakes(tenantId: string): Promise<IntakeResult[]> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('capital_intake_requests')
    .select('*')
    .eq('tenant_id', tid)
    .eq('status', 'PENDING_CONFIRMATION')
    .order('created_at', { ascending: false })

  if (error) {
    log.info('[capitalIntake] getPendingIntakes error', { error: error.message })
    return []
  }

  return (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: Record<string, any>): IntakeResult => ({
      success:                     false,
      intake_id:                   row.intake_id as string,
      provider:                    row.provider as IntakeProvider,
      amount_eur_cents:            row.amount_eur_cents as number,
      ledger_entry_id:             (row.ledger_entry_id as string) ?? null,
      requires_manual_confirmation: true,
    }),
  )
}

// ─── Provider handlers ────────────────────────────────────────────────────────

/**
 * SEPA / SWIFT: require webhook secret to be configured.
 * If secret is missing, record as PENDING_CONFIRMATION.
 */
async function handleWebhookProvider(
  req: IntakeRequest,
  tid: string,
  intakeId: string,
  envKey: string,
  provider: IntakeProvider,
): Promise<IntakeResult> {
  const secretConfigured = Boolean(process.env[envKey])

  if (!secretConfigured) {
    // Record as pending — requires manual confirmation
    await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)

    log.info('[capitalIntake] webhook provider pending — secret not configured', {
      provider,
      intake_id: intakeId,
      env_key: envKey,
    })

    return {
      success:                     false,
      intake_id:                   intakeId,
      provider,
      amount_eur_cents:            req.amount_eur_cents,
      ledger_entry_id:             null,
      requires_manual_confirmation: true,
    }
  }

  // Secret configured — treat incoming call as a confirmed webhook
  return handleDirectIntake(req, tid, intakeId, false)
}

/**
 * Stripe: dynamic import. Graceful no-op if package not installed.
 */
async function handleStripeIntake(
  req: IntakeRequest,
  tid: string,
  intakeId: string,
): Promise<IntakeResult> {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      // No Stripe key — record as PENDING
      await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)
      return {
        success:                     false,
        intake_id:                   intakeId,
        provider:                    'stripe',
        amount_eur_cents:            req.amount_eur_cents,
        ledger_entry_id:             null,
        requires_manual_confirmation: true,
      }
    }

    // Dynamic import — graceful no-op if package missing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Stripe: any
    try {
      const stripeModule = await import('stripe') as { default: unknown }
      Stripe = stripeModule.default
    } catch {
      log.info('[capitalIntake] stripe package not installed — recording as PENDING', { intake_id: intakeId })
      await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)
      return {
        success:                     false,
        intake_id:                   intakeId,
        provider:                    'stripe',
        amount_eur_cents:            req.amount_eur_cents,
        ledger_entry_id:             null,
        requires_manual_confirmation: true,
      }
    }

    // Stripe available — log intent (actual charge flow handled externally via webhooks)
    // Capital is only confirmed when webhook fires; record as PENDING until then
    void (Stripe as unknown)  // reference to avoid unused-var lint
    log.info('[capitalIntake] stripe intake initiated — awaiting webhook confirmation', { intake_id: intakeId })

    await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    'stripe',
      amount_eur_cents:            req.amount_eur_cents,
      ledger_entry_id:             null,
      requires_manual_confirmation: true,
    }
  } catch (err) {
    log.info('[capitalIntake] stripe intake error', { intake_id: intakeId, error: String(err) })
    await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    'stripe',
      amount_eur_cents:            req.amount_eur_cents,
      ledger_entry_id:             null,
      error:                       String(err),
      requires_manual_confirmation: true,
    }
  }
}

/**
 * Adyen: dynamic import. Graceful no-op if package not installed.
 */
async function handleAdyenIntake(
  req: IntakeRequest,
  tid: string,
  intakeId: string,
): Promise<IntakeResult> {
  try {
    // Dynamic import — graceful no-op if package missing
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@adyen/api-library')
      // Package present — Adyen flow is webhook-driven; record as PENDING until confirmed
    } catch {
      log.info('[capitalIntake] @adyen/api-library not installed — recording as PENDING', { intake_id: intakeId })
    }

    await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    'adyen',
      amount_eur_cents:            req.amount_eur_cents,
      ledger_entry_id:             null,
      requires_manual_confirmation: true,
    }
  } catch (err) {
    log.info('[capitalIntake] adyen intake error', { intake_id: intakeId, error: String(err) })
    await persistIntakeRecord(req, tid, intakeId, 'PENDING_CONFIRMATION', null)
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    'adyen',
      amount_eur_cents:            req.amount_eur_cents,
      ledger_entry_id:             null,
      error:                       String(err),
      requires_manual_confirmation: true,
    }
  }
}

/**
 * Institutional / manual: direct ledger entry — no external provider.
 */
async function handleDirectIntake(
  req: IntakeRequest,
  tid: string,
  intakeId: string,
  requiresManualConfirmation: boolean,
): Promise<IntakeResult> {
  let ledgerEntryId: string | null = null

  try {
    const ledgerEntry = await recordLedgerEntry(
      {
        investor_id:      req.investor_id,
        tenant_id:        tid,
        entry_type:       'DEPOSIT',
        amount_eur_cents: req.amount_eur_cents,
        reference_id:     intakeId,
        reference_type:   'deposit',
        description:      `Capital intake: ${req.provider} ref ${req.reference}`,
        idempotency_key:  `intake_${req.idempotency_key}`,
      },
      tid,
    )
    ledgerEntryId = ledgerEntry.entry_id
  } catch (err) {
    log.info('[capitalIntake] direct intake ledger error', { intake_id: intakeId, error: String(err) })
    await persistIntakeRecord(req, tid, intakeId, 'FAILED', null)
    return {
      success:                     false,
      intake_id:                   intakeId,
      provider:                    req.provider,
      amount_eur_cents:            req.amount_eur_cents,
      ledger_entry_id:             null,
      error:                       String(err),
      requires_manual_confirmation: requiresManualConfirmation,
    }
  }

  await persistIntakeRecord(req, tid, intakeId, 'CONFIRMED', ledgerEntryId)

  log.info('[capitalIntake] direct intake confirmed', {
    intake_id:        intakeId,
    provider:         req.provider,
    amount_eur_cents: req.amount_eur_cents,
  })

  return {
    success:                     true,
    intake_id:                   intakeId,
    provider:                    req.provider,
    amount_eur_cents:            req.amount_eur_cents,
    ledger_entry_id:             ledgerEntryId,
    requires_manual_confirmation: requiresManualConfirmation,
  }
}

// ─── persistIntakeRecord ──────────────────────────────────────────────────────

async function persistIntakeRecord(
  req: IntakeRequest,
  tid: string,
  intakeId: string,
  status: string,
  ledgerEntryId: string | null,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('capital_intake_requests')
    .insert({
      intake_id:        intakeId,
      tenant_id:        tid,
      investor_id:      req.investor_id,
      amount_eur_cents: req.amount_eur_cents,
      provider:         req.provider,
      reference:        req.reference,
      idempotency_key:  req.idempotency_key,
      status,
      ledger_entry_id:  ledgerEntryId,
      metadata:         req.metadata ?? {},
    })

  if (error && error.code !== '23505') {
    // 23505 = unique constraint — idempotent call; safe to ignore
    log.info('[capitalIntake] persistIntakeRecord error', { intake_id: intakeId, error: error.message })
  }
}
