// lib/financial-rails/pspRouter.ts
// Payment Service Provider router — Stripe primary, Adyen fallback
// Real production payment processing for property transaction escrow

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export type PspProvider = 'STRIPE' | 'ADYEN'

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REQUIRES_ACTION'
  | 'CANCELLED'
  | 'REFUNDED'

export interface PspPaymentRequest {
  idempotency_key: string          // REQUIRED — prevents duplicates
  amount_cents: bigint             // integer EUR cents
  currency: 'EUR'
  description: string
  metadata: {
    deal_id: string
    tenant_id: string
    payment_type: 'ESCROW_DEPOSIT' | 'COMMISSION' | 'TAX_PREPAYMENT'
    reference: string
  }
  customer_email?: string
  customer_name?: string
}

export interface PspPaymentResult {
  payment_id: string
  provider: PspProvider
  provider_payment_id: string
  status: PaymentStatus
  amount_cents: bigint
  currency: 'EUR'
  created_at: string
  next_action?: string            // URL for 3DS/redirect
  error_code?: string
  error_message?: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; rail: string; reason: string; action_required: string }
type RailError = { status: 'ERROR'; rail: string; error: string; code?: string }

// ── Stripe integration ─────────────────────────────────────────────────────────

async function createStripePaymentIntent(req: PspPaymentRequest): Promise<PspPaymentResult | NotConfigured | RailError> {
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    return {
      status: 'NOT_CONFIGURED',
      rail: 'Stripe',
      reason: 'STRIPE_SECRET_KEY not set',
      action_required: 'Create Stripe account at https://stripe.com, complete KYB verification, and set STRIPE_SECRET_KEY in Vercel environment',
    }
  }

  // Idempotency check in DB first
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('payment_rail_transactions')
      .select('payment_id, provider_payment_id, status')
      .eq('idempotency_key', req.idempotency_key)
      .limit(1)

    type ExistingRow = { payment_id: string; provider_payment_id: string; status: string }
    const existingPayment = (existing as ExistingRow[] | null)?.[0]
    if (existingPayment) {
      log.info('[pspRouter] returning existing payment (idempotent)', { idempotency_key: req.idempotency_key })
      return {
        payment_id: existingPayment.payment_id,
        provider: 'STRIPE',
        provider_payment_id: existingPayment.provider_payment_id,
        status: existingPayment.status as PaymentStatus,
        amount_cents: req.amount_cents,
        currency: 'EUR',
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* table may not exist yet */ }

  try {
    // Use Stripe REST API directly (no SDK dependency to install)
    const body = new URLSearchParams({
      amount: String(req.amount_cents),
      currency: 'eur',
      description: req.description,
      'metadata[deal_id]': req.metadata.deal_id,
      'metadata[tenant_id]': req.metadata.tenant_id,
      'metadata[payment_type]': req.metadata.payment_type,
      'metadata[reference]': req.metadata.reference,
    })
    if (req.customer_email) body.set('receipt_email', req.customer_email)

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': req.idempotency_key,
        'Stripe-Version': '2024-06-20',
      },
      body: body.toString(),
    })

    const data = await response.json() as {
      id: string
      status: string
      next_action?: { redirect_to_url?: { url: string } }
      last_payment_error?: { code: string; message: string }
    }

    if (!response.ok) {
      const err = data.last_payment_error
      log.warn('[pspRouter] Stripe error', { code: err?.code, message: err?.message })
      return { status: 'ERROR', rail: 'Stripe', error: err?.message ?? `HTTP ${response.status}`, code: err?.code }
    }

    const result: PspPaymentResult = {
      payment_id: randomUUID(),
      provider: 'STRIPE',
      provider_payment_id: data.id,
      status: mapStripeStatus(data.status),
      amount_cents: req.amount_cents,
      currency: 'EUR',
      created_at: new Date().toISOString(),
      next_action: data.next_action?.redirect_to_url?.url,
    }

    // Persist to DB
    void (supabaseAdmin as any)
      .from('payment_rail_transactions')
      .insert({
        payment_id: result.payment_id,
        tenant_id: req.metadata.tenant_id,
        idempotency_key: req.idempotency_key,
        provider: 'STRIPE',
        provider_payment_id: result.provider_payment_id,
        status: result.status,
        amount_cents: Number(req.amount_cents),
        currency: 'EUR',
        deal_id: req.metadata.deal_id,
        payment_type: req.metadata.payment_type,
        metadata: req.metadata,
      })
      .catch((e: unknown) => log.warn('[pspRouter] persist error', { e }))

    log.info('[pspRouter] Stripe payment created', { payment_id: result.payment_id, status: result.status })
    return result
  } catch (e) {
    log.warn('[pspRouter] Stripe call failed', { e })
    return { status: 'ERROR', rail: 'Stripe', error: e instanceof Error ? e.message : 'unknown' }
  }
}

function mapStripeStatus(stripeStatus: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    'requires_payment_method': 'PENDING',
    'requires_confirmation': 'PENDING',
    'requires_action': 'REQUIRES_ACTION',
    'processing': 'PROCESSING',
    'succeeded': 'SUCCEEDED',
    'canceled': 'CANCELLED',
  }
  return map[stripeStatus] ?? 'PENDING'
}

// ── Adyen integration ─────────────────────────────────────────────────────────

async function createAdyenPayment(req: PspPaymentRequest): Promise<PspPaymentResult | NotConfigured | RailError> {
  const apiKey = process.env.ADYEN_API_KEY
  const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT
  if (!apiKey || !merchantAccount) {
    return {
      status: 'NOT_CONFIGURED',
      rail: 'Adyen',
      reason: 'ADYEN_API_KEY or ADYEN_MERCHANT_ACCOUNT not set',
      action_required: 'Create Adyen account at https://www.adyen.com, complete onboarding, and set ADYEN_API_KEY + ADYEN_MERCHANT_ACCOUNT in Vercel environment',
    }
  }

  const adyenEnv = process.env.ADYEN_ENV ?? 'live'  // 'test' or 'live'
  const baseUrl = adyenEnv === 'test'
    ? 'https://checkout-test.adyen.com/v71'
    : 'https://checkout-live.adyen.com/v71'

  try {
    const payload = {
      merchantAccount,
      amount: { value: Number(req.amount_cents), currency: 'EUR' },
      reference: req.idempotency_key,
      description: req.description,
      metadata: req.metadata,
    }

    const response = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': req.idempotency_key,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json() as {
      pspReference: string
      resultCode: string
      action?: { url: string }
      refusalReason?: string
      refusalReasonCode?: string
    }

    if (!response.ok) {
      return { status: 'ERROR', rail: 'Adyen', error: data.refusalReason ?? `HTTP ${response.status}`, code: data.refusalReasonCode }
    }

    const result: PspPaymentResult = {
      payment_id: randomUUID(),
      provider: 'ADYEN',
      provider_payment_id: data.pspReference,
      status: mapAdyenStatus(data.resultCode),
      amount_cents: req.amount_cents,
      currency: 'EUR',
      created_at: new Date().toISOString(),
      next_action: data.action?.url,
    }

    void (supabaseAdmin as any)
      .from('payment_rail_transactions')
      .insert({
        payment_id: result.payment_id,
        tenant_id: req.metadata.tenant_id,
        idempotency_key: req.idempotency_key,
        provider: 'ADYEN',
        provider_payment_id: result.provider_payment_id,
        status: result.status,
        amount_cents: Number(req.amount_cents),
        currency: 'EUR',
        deal_id: req.metadata.deal_id,
        payment_type: req.metadata.payment_type,
        metadata: req.metadata,
      })
      .catch((e: unknown) => log.warn('[pspRouter] adyen persist error', { e }))

    log.info('[pspRouter] Adyen payment created', { payment_id: result.payment_id, status: result.status })
    return result
  } catch (e) {
    return { status: 'ERROR', rail: 'Adyen', error: e instanceof Error ? e.message : 'unknown' }
  }
}

function mapAdyenStatus(adyenCode: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    'Authorised': 'SUCCEEDED',
    'Pending': 'PENDING',
    'Received': 'PROCESSING',
    'RedirectShopper': 'REQUIRES_ACTION',
    'Refused': 'FAILED',
    'Cancelled': 'CANCELLED',
  }
  return map[adyenCode] ?? 'PENDING'
}

// ── Router (Stripe primary → Adyen fallback) ───────────────────────────────────

export async function routePayment(
  req: PspPaymentRequest,
  preferredProvider?: PspProvider,
): Promise<PspPaymentResult | NotConfigured | RailError> {
  const provider = preferredProvider ?? (process.env.PSP_PRIMARY as PspProvider | undefined) ?? 'STRIPE'

  if (provider === 'STRIPE') {
    const result = await createStripePaymentIntent(req)
    if (result.status === 'NOT_CONFIGURED' || result.status === 'ERROR') {
      log.warn('[pspRouter] Stripe unavailable, trying Adyen fallback', { status: result.status })
      return createAdyenPayment(req)
    }
    return result
  }

  return createAdyenPayment(req)
}

export function getAvailableProviders(): { provider: PspProvider; configured: boolean }[] {
  return [
    { provider: 'STRIPE', configured: !!process.env.STRIPE_SECRET_KEY },
    { provider: 'ADYEN', configured: !!(process.env.ADYEN_API_KEY && process.env.ADYEN_MERCHANT_ACCOUNT) },
  ]
}
