// lib/financial-rails/sepaClient.ts
// SEPA Credit Transfer via GoCardless Payments API
// GoCardless: https://developer.gocardless.com/api-reference/
// Requires: GOCARDLESS_ACCESS_TOKEN (Live or Sandbox)
// For SWIFT: uses Currencycloud API (https://developer.currencycloud.com)

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export interface SepaTransferRequest {
  idempotency_key: string           // REQUIRED
  amount_cents: bigint              // integer EUR cents
  creditor_name: string
  creditor_iban: string
  creditor_bic?: string
  creditor_address_line1?: string
  creditor_address_city?: string
  creditor_address_country: string  // ISO 3166-1 alpha-2, e.g., 'PT' or 'ES'
  remittance_info: string           // payment reference (max 140 chars)
  tenant_id: string
  deal_id?: string
  payment_type: 'ESCROW_DISBURSEMENT' | 'COMMISSION_PAYMENT' | 'TAX_PAYMENT' | 'REFUND'
}

export interface SepaTransferResult {
  transfer_id: string
  provider: 'GOCARDLESS'
  provider_payment_id: string
  status: 'PENDING_SUBMISSION' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED'
  amount_cents: bigint
  creditor_iban: string
  remittance_info: string
  estimated_arrival?: string        // ISO date
  created_at: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; rail: string; reason: string; action_required: string }
type RailError = { status: 'ERROR'; rail: string; error: string; code?: string }

const GC_BASE_URL = process.env.GOCARDLESS_BASE_URL ?? 'https://api.gocardless.com'
const GC_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    rail: 'GoCardless SEPA',
    reason: 'GOCARDLESS_ACCESS_TOKEN not set',
    action_required: 'Register at https://manage.gocardless.com/sign-up, complete FCA/Bafin authorisation, and set GOCARDLESS_ACCESS_TOKEN in Vercel environment',
  }
}

export async function initiateSEPATransfer(req: SepaTransferRequest): Promise<SepaTransferResult | NotConfigured | RailError> {
  if (!GC_TOKEN) return notConfigured()

  // Idempotency check
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('sepa_transfer_log')
      .select('transfer_id, provider_payment_id, status')
      .eq('idempotency_key', req.idempotency_key)
      .limit(1)

    type ExRow = { transfer_id: string; provider_payment_id: string; status: string }
    const existingTransfer = (existing as ExRow[] | null)?.[0]
    if (existingTransfer) {
      log.info('[sepaClient] returning existing SEPA transfer (idempotent)', { idempotency_key: req.idempotency_key })
      return {
        transfer_id: existingTransfer.transfer_id,
        provider: 'GOCARDLESS',
        provider_payment_id: existingTransfer.provider_payment_id,
        status: existingTransfer.status as SepaTransferResult['status'],
        amount_cents: req.amount_cents,
        creditor_iban: req.creditor_iban,
        remittance_info: req.remittance_info,
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }

  try {
    // GoCardless Payments API — create payment
    const payload = {
      payments: {
        amount: Number(req.amount_cents),
        currency: 'EUR',
        description: req.remittance_info.substring(0, 140),
        metadata: {
          deal_id: req.deal_id ?? '',
          tenant_id: req.tenant_id,
          payment_type: req.payment_type,
          idempotency_key: req.idempotency_key,
        },
        links: {
          mandate: process.env.GOCARDLESS_DEFAULT_MANDATE_ID,  // may be undefined for push payments
        },
      },
    }

    const response = await fetch(`${GC_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GC_TOKEN}`,
        'Content-Type': 'application/json',
        'GoCardless-Version': '2015-07-06',
        'Idempotency-Key': req.idempotency_key,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json() as {
      payments?: { id: string; status: string; charge_date: string }
      error?: { type: string; message: string; code: number; errors: Array<{ reason: string; message: string }> }
    }

    if (!response.ok || data.error) {
      const errMsg = data.error?.message ?? data.error?.errors?.[0]?.message ?? `HTTP ${response.status}`
      log.warn('[sepaClient] GoCardless error', { error: errMsg })
      return { status: 'ERROR', rail: 'GoCardless SEPA', error: errMsg }
    }

    const payment = data.payments!
    const result: SepaTransferResult = {
      transfer_id: randomUUID(),
      provider: 'GOCARDLESS',
      provider_payment_id: payment.id,
      status: 'PENDING_SUBMISSION',
      amount_cents: req.amount_cents,
      creditor_iban: req.creditor_iban,
      remittance_info: req.remittance_info,
      estimated_arrival: payment.charge_date,
      created_at: new Date().toISOString(),
    }

    // Persist
    void (supabaseAdmin as any)
      .from('sepa_transfer_log')
      .insert({
        transfer_id: result.transfer_id,
        tenant_id: req.tenant_id,
        idempotency_key: req.idempotency_key,
        provider: 'GOCARDLESS',
        provider_payment_id: result.provider_payment_id,
        status: result.status,
        amount_cents: Number(req.amount_cents),
        creditor_iban: req.creditor_iban,
        remittance_info: req.remittance_info,
        deal_id: req.deal_id ?? null,
        payment_type: req.payment_type,
        estimated_arrival: result.estimated_arrival ?? null,
      })
      .catch((e: unknown) => log.warn('[sepaClient] persist error', { e }))

    log.info('[sepaClient] SEPA transfer initiated', { transfer_id: result.transfer_id, provider_payment_id: payment.id })
    return result
  } catch (e) {
    log.warn('[sepaClient] SEPA transfer error', { e })
    return { status: 'ERROR', rail: 'GoCardless SEPA', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!GC_TOKEN
}
