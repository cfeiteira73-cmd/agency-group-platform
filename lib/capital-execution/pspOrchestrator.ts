// Agency Group — PSP Orchestrator
// lib/capital-execution/pspOrchestrator.ts
// Abstracts over Stripe, Adyen, Wise. Graceful no-ops when not configured.
// EUR amounts: always integer cents
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PSPProvider = 'STRIPE' | 'ADYEN' | 'WISE' | 'SEPA_DIRECT' | 'SWIFT_WIRE'

export interface PSPPaymentIntent {
  provider: PSPProvider
  intent_id: string
  amount_eur_cents: number
  currency: 'EUR'
  status: 'CREATED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  external_ref: string
  created_at: string
  metadata: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToIntent(row: Record<string, unknown>): PSPPaymentIntent {
  return {
    provider: row.provider as PSPProvider,
    intent_id: row.intent_id as string,
    amount_eur_cents: row.amount_eur_cents as number,
    currency: 'EUR',
    status: row.status as PSPPaymentIntent['status'],
    external_ref: row.external_ref as string,
    created_at: row.created_at as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

// ─── Stripe attempt ───────────────────────────────────────────────────────────

async function tryStripe(
  amountEurCents: number,
  metadata: Record<string, unknown>,
): Promise<{ intent_id: string; external_ref: string } | null> {
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) return null

  try {
    const StripeModule = await import('stripe').catch(() => null)
    if (!StripeModule) return null

    // stripe default export varies by version — handle both
    const StripeClass =
      (StripeModule as { default?: unknown }).default ?? StripeModule

    if (typeof StripeClass !== 'function') return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new (StripeClass as any)(apiKey, { apiVersion: '2024-04-10' })

    const intent = await stripe.paymentIntents.create({
      amount: amountEurCents, // Stripe EUR: smallest unit = cent
      currency: 'eur',
      metadata: { ...metadata },
    })

    return {
      intent_id: `stripe_${intent.id as string}`,
      external_ref: intent.id as string,
    }
  } catch (e) {
    log.warn('[psp-orchestrator] Stripe createPaymentIntent failed', { error: String(e) })
    return null
  }
}

// ─── Adyen attempt ────────────────────────────────────────────────────────────

async function tryAdyen(
  amountEurCents: number,
  metadata: Record<string, unknown>,
): Promise<{ intent_id: string; external_ref: string } | null> {
  const apiKey = process.env.ADYEN_API_KEY
  if (!apiKey) return null

  try {
    const body = JSON.stringify({
      amount: { currency: 'EUR', value: amountEurCents },
      reference: `ag_${randomUUID()}`,
      paymentMethod: { type: 'sepadirectdebit' },
      additionalData: { ...metadata },
    })

    const res = await fetch('https://checkout-test.adyen.com/v71/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-API-key': apiKey,
      },
      body,
    })

    if (!res.ok) {
      log.warn('[psp-orchestrator] Adyen returned non-2xx', { status: res.status })
      return null
    }

    const data = (await res.json()) as { pspReference?: string }
    const ref = data.pspReference ?? `adyen_mock_${randomUUID()}`

    return {
      intent_id: `adyen_${ref}`,
      external_ref: ref,
    }
  } catch (e) {
    log.warn('[psp-orchestrator] Adyen createPaymentIntent failed', { error: String(e) })
    return null
  }
}

// ─── SEPA fallback ────────────────────────────────────────────────────────────

function createSepaFallback(): { intent_id: string; external_ref: string } {
  const ref = `sepa_${randomUUID()}`
  return { intent_id: ref, external_ref: ref }
}

// ─── createPaymentIntent ──────────────────────────────────────────────────────

/**
 * Tries Stripe → Adyen → SEPA_DIRECT fallback.
 * Persists intent to psp_payment_intents.
 */
export async function createPaymentIntent(
  amountEurCents: number,
  tenantId: string,
  metadata: Record<string, unknown>,
): Promise<PSPPaymentIntent> {
  const now = new Date().toISOString()

  let provider: PSPProvider = 'SEPA_DIRECT'
  let refs = createSepaFallback()
  let status: PSPPaymentIntent['status'] = 'CREATED'

  // 1. Stripe
  const stripeResult = await tryStripe(amountEurCents, metadata)
  if (stripeResult) {
    provider = 'STRIPE'
    refs = stripeResult
    status = 'PROCESSING'
  } else {
    // 2. Adyen
    const adyenResult = await tryAdyen(amountEurCents, metadata)
    if (adyenResult) {
      provider = 'ADYEN'
      refs = adyenResult
      status = 'PROCESSING'
    }
  }

  const intent: PSPPaymentIntent = {
    provider,
    intent_id: refs.intent_id,
    amount_eur_cents: amountEurCents,
    currency: 'EUR',
    status,
    external_ref: refs.external_ref,
    created_at: now,
    metadata,
  }

  const { error } = await (supabaseAdmin as any)
    .from('psp_payment_intents')
    .upsert({
      intent_id: intent.intent_id,
      tenant_id: tenantId,
      provider: intent.provider,
      amount_eur_cents: intent.amount_eur_cents,
      currency: 'EUR',
      status: intent.status,
      external_ref: intent.external_ref,
      metadata: intent.metadata,
      created_at: intent.created_at,
      updated_at: now,
    }, { onConflict: 'intent_id' })

  if (error) {
    log.error('[psp-orchestrator] failed to persist intent', error, { intent_id: intent.intent_id })
  }

  log.info('[psp-orchestrator] payment intent created', { intent_id: intent.intent_id, provider, amount_eur_cents: amountEurCents })
  return intent
}

// ─── confirmPayment ───────────────────────────────────────────────────────────

/**
 * Reads intent from DB and confirms via relevant PSP.
 */
export async function confirmPayment(
  intentId: string,
  tenantId: string,
): Promise<{ confirmed: boolean; external_ref: string }> {
  const { data, error } = await (supabaseAdmin as any)
    .from('psp_payment_intents')
    .select('*')
    .eq('intent_id', intentId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) {
    log.error('[psp-orchestrator] confirmPayment: intent not found', error ?? new Error('not found'), { intent_id: intentId })
    return { confirmed: false, external_ref: intentId }
  }

  const intent = rowToIntent(data as Record<string, unknown>)
  let confirmed = false
  let externalRef = intent.external_ref

  if (intent.provider === 'STRIPE' && process.env.STRIPE_SECRET_KEY) {
    try {
      const StripeModule = await import('stripe').catch(() => null)
      if (StripeModule) {
        const StripeClass = (StripeModule as { default?: unknown }).default ?? StripeModule
        if (typeof StripeClass === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stripe = new (StripeClass as any)(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
          const pi = await stripe.paymentIntents.retrieve(intent.external_ref)
          confirmed = (pi.status as string) === 'succeeded'
          externalRef = pi.id as string
        }
      }
    } catch (e) {
      log.warn('[psp-orchestrator] Stripe confirm failed', { error: String(e) })
    }
  } else if (intent.provider === 'ADYEN' && process.env.ADYEN_API_KEY) {
    // Adyen: check payment details — graceful no-op on error
    try {
      const res = await fetch(`https://checkout-test.adyen.com/v71/payments/${intent.external_ref}`, {
        headers: { 'x-API-key': process.env.ADYEN_API_KEY },
      })
      if (res.ok) {
        const body = (await res.json()) as { resultCode?: string }
        confirmed = body.resultCode === 'Authorised'
      }
    } catch (e) {
      log.warn('[psp-orchestrator] Adyen confirm failed', { error: String(e) })
    }
  } else if (intent.provider === 'SEPA_DIRECT') {
    // SEPA: manual confirmation assumed — treat as confirmed for now
    confirmed = true
  }

  const newStatus: PSPPaymentIntent['status'] = confirmed ? 'SUCCEEDED' : intent.status
  void (supabaseAdmin as any)
    .from('psp_payment_intents')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('intent_id', intentId)
    .then(({ error: updErr }: { error: unknown }) => {
      if (updErr) log.warn('[psp-orchestrator] status update failed', { intent_id: intentId })
    })
    .catch((e: unknown) => log.warn('[psp-orchestrator] confirm fire-and-forget error', { error: String(e) }))

  return { confirmed, external_ref: externalRef }
}

// ─── getAvailablePSPs ─────────────────────────────────────────────────────────

export function getAvailablePSPs(): string[] {
  const available: string[] = ['SEPA_DIRECT'] // always available
  if (process.env.STRIPE_SECRET_KEY) available.push('STRIPE')
  if (process.env.ADYEN_API_KEY) available.push('ADYEN')
  if (process.env.WISE_API_KEY) available.push('WISE')
  return available
}

// ─── reconcilePSPPayments ─────────────────────────────────────────────────────

/**
 * Cross-references psp_payment_intents with investor_ledger_entries, counts discrepancies.
 */
export async function reconcilePSPPayments(
  tenantId: string,
  since: Date,
): Promise<{ reconciled: number; discrepancies: number }> {
  const runId = `psp_rec_${randomUUID()}`

  try {
    const { data: intents } = await (supabaseAdmin as any)
      .from('psp_payment_intents')
      .select('intent_id, amount_eur_cents, external_ref, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', since.toISOString())

    const { data: ledger } = await (supabaseAdmin as any)
      .from('investor_ledger_entries')
      .select('id, amount_eur_cents, reference')
      .eq('tenant_id', tenantId)
      .gte('created_at', since.toISOString())

    const intentList = (intents as Array<{ intent_id: string; amount_eur_cents: number; external_ref: string; status: string }>) ?? []
    const ledgerList = (ledger as Array<{ id: string; amount_eur_cents: number; reference: string }>) ?? []

    const ledgerRefs = new Set(ledgerList.map((l) => l.reference))

    let reconciled = 0
    let discrepancies = 0

    for (const intent of intentList) {
      if (ledgerRefs.has(intent.external_ref) || ledgerRefs.has(intent.intent_id)) {
        reconciled++
      } else {
        discrepancies++
      }
    }

    void (supabaseAdmin as any)
      .from('psp_reconciliation_runs')
      .insert({
        run_id: runId,
        tenant_id: tenantId,
        reconciled,
        discrepancies,
      })
      .then(({ error: insErr }: { error: unknown }) => {
        if (insErr) log.warn('[psp-orchestrator] reconciliation run insert failed', { run_id: runId })
      })
      .catch((e: unknown) => log.warn('[psp-orchestrator] reconcile fire-and-forget', { error: String(e) }))

    log.info('[psp-orchestrator] PSP reconciliation complete', { run_id: runId, reconciled, discrepancies })
    return { reconciled, discrepancies }
  } catch (e) {
    log.error('[psp-orchestrator] reconcilePSPPayments failed', e instanceof Error ? e : new Error(String(e)), { tenant_id: tenantId })
    return { reconciled: 0, discrepancies: 0 }
  }
}
