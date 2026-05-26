// lib/financial-rails/swiftClient.ts
// SWIFT international wire transfer via Currencycloud API
// Currencycloud (Visa): https://developer.currencycloud.com/
// Used for non-SEPA cross-border payments (USD, GBP, non-EU)

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export interface SwiftTransferRequest {
  idempotency_key: string
  amount_cents: bigint            // in payment currency cents
  currency: string                // 'USD' | 'GBP' | 'CHF' | 'AED' | etc.
  beneficiary_name: string
  beneficiary_account_number: string
  beneficiary_routing_code?: string
  beneficiary_iban?: string
  beneficiary_swift_bic?: string
  beneficiary_bank_name: string
  beneficiary_bank_country: string
  beneficiary_address?: string
  remittance_reference: string    // payment reference
  tenant_id: string
  deal_id?: string
  payment_reason: 'PROPERTY_PURCHASE' | 'COMMISSION' | 'DEPOSIT' | 'REFUND'
}

export interface SwiftTransferResult {
  transfer_id: string
  provider: 'CURRENCYCLOUD'
  provider_payment_id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  amount_cents: bigint
  currency: string
  exchange_rate?: number
  eur_equivalent_cents?: bigint
  estimated_arrival?: string
  created_at: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; rail: string; reason: string; action_required: string }
type RailError = { status: 'ERROR'; rail: string; error: string }

const CC_API_KEY = process.env.CURRENCYCLOUD_API_KEY
const CC_LOGIN_ID = process.env.CURRENCYCLOUD_LOGIN_ID
const CC_BASE_URL = process.env.CURRENCYCLOUD_BASE_URL ?? 'https://api.currencycloud.com'

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    rail: 'Currencycloud SWIFT',
    reason: 'CURRENCYCLOUD_API_KEY or CURRENCYCLOUD_LOGIN_ID not set',
    action_required: 'Register at https://www.currencycloud.com, complete regulatory onboarding (FCA), and set CURRENCYCLOUD_API_KEY + CURRENCYCLOUD_LOGIN_ID in Vercel environment',
  }
}

async function getCurrencycloudToken(): Promise<string> {
  const response = await fetch(`${CC_BASE_URL}/v2/authenticate/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: CC_LOGIN_ID, api_key: CC_API_KEY }),
  })
  if (!response.ok) throw new Error(`Currencycloud auth failed: ${response.status}`)
  const data = await response.json() as { auth_token: string }
  return data.auth_token
}

export async function initiateSWIFTTransfer(req: SwiftTransferRequest): Promise<SwiftTransferResult | NotConfigured | RailError> {
  if (!CC_API_KEY || !CC_LOGIN_ID) return notConfigured()

  // Idempotency check
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('swift_transfer_log')
      .select('transfer_id, provider_payment_id, status')
      .eq('idempotency_key', req.idempotency_key)
      .limit(1)

    type ExRow = { transfer_id: string; provider_payment_id: string; status: string }
    const ex = (existing as ExRow[] | null)?.[0]
    if (ex) {
      return {
        transfer_id: ex.transfer_id,
        provider: 'CURRENCYCLOUD',
        provider_payment_id: ex.provider_payment_id,
        status: ex.status as SwiftTransferResult['status'],
        amount_cents: req.amount_cents,
        currency: req.currency,
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }

  try {
    const token = await getCurrencycloudToken()

    // Create beneficiary
    const beneficiaryResponse = await fetch(`${CC_BASE_URL}/v2/beneficiaries/create`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bank_account_holder_name: req.beneficiary_name,
        bank_country: req.beneficiary_bank_country,
        currency: req.currency,
        name: req.beneficiary_name,
        bic_swift: req.beneficiary_swift_bic,
        iban: req.beneficiary_iban,
        account_number: req.beneficiary_account_number,
        routing_code_type_1: req.beneficiary_routing_code ? 'sort_code' : undefined,
        routing_code_value_1: req.beneficiary_routing_code,
      }),
    })

    const beneficiary = await beneficiaryResponse.json() as { id: string }
    if (!beneficiaryResponse.ok) {
      return { status: 'ERROR', rail: 'Currencycloud SWIFT', error: `Beneficiary creation failed: ${beneficiaryResponse.status}` }
    }

    // Create payment
    const paymentResponse = await fetch(`${CC_BASE_URL}/v2/payments/create`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: req.currency,
        beneficiary_id: beneficiary.id,
        amount: (Number(req.amount_cents) / 100).toFixed(2),
        reason: req.payment_reason,
        reference: req.remittance_reference,
        unique_request_id: req.idempotency_key,
      }),
    })

    const payment = await paymentResponse.json() as {
      id: string
      status: string
      payment_date?: string
      failure_reason?: string
    }
    if (!paymentResponse.ok) {
      return { status: 'ERROR', rail: 'Currencycloud SWIFT', error: payment.failure_reason ?? `HTTP ${paymentResponse.status}` }
    }

    const result: SwiftTransferResult = {
      transfer_id: randomUUID(),
      provider: 'CURRENCYCLOUD',
      provider_payment_id: payment.id,
      status: 'PENDING',
      amount_cents: req.amount_cents,
      currency: req.currency,
      estimated_arrival: payment.payment_date,
      created_at: new Date().toISOString(),
    }

    void (supabaseAdmin as any)
      .from('swift_transfer_log')
      .insert({
        transfer_id: result.transfer_id,
        tenant_id: req.tenant_id,
        idempotency_key: req.idempotency_key,
        provider: 'CURRENCYCLOUD',
        provider_payment_id: result.provider_payment_id,
        status: result.status,
        amount_cents: Number(req.amount_cents),
        currency: req.currency,
        deal_id: req.deal_id ?? null,
        payment_reason: req.payment_reason,
        estimated_arrival: result.estimated_arrival ?? null,
      })
      .catch((e: unknown) => log.warn('[swiftClient] persist error', { e }))

    log.info('[swiftClient] SWIFT transfer initiated', { transfer_id: result.transfer_id })
    return result
  } catch (e) {
    return { status: 'ERROR', rail: 'Currencycloud SWIFT', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!(CC_API_KEY && CC_LOGIN_ID)
}
