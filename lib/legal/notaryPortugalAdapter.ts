// lib/legal/notaryPortugalAdapter.ts
// Portugal notary system adapter
// Regulatory body: Ordem dos Notários (https://www.notarios.pt)
// Digital platform: IRN — Instituto dos Registos e do Notariado (https://www.irn.mj.pt)
// eNotary API: available via IRN digital transformation programme

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

export interface NotaryAppointmentRequestPT {
  idempotency_key: string
  deal_id: string
  tenant_id: string
  transaction_type: 'ESCRITURA_DE_COMPRA_E_VENDA' | 'CPCV' | 'PROCURACAO' | 'DISTRATE'
  seller_name: string
  seller_nif: string              // NIF — Número de Identificação Fiscal
  seller_address: string
  buyer_name: string
  buyer_nif: string
  buyer_address: string
  property_description: string
  property_article_matricial: string  // artigo matricial (land registry reference)
  property_fraction?: string          // fração (for apartments)
  property_municipality: string
  property_district: string
  sale_price_eur: number
  mortgage_bank?: string
  mortgage_amount_eur?: number
  requested_date_from: string     // ISO date
  preferred_notary_district?: string  // Lisbon | Porto | etc.
}

export interface NotaryAppointmentResultPT {
  appointment_id: string
  provider: 'IRN_PT' | 'NOTARY_DIRECT'
  status: 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED'
  notary_name?: string
  notary_address?: string
  appointment_date?: string
  appointment_time?: string
  deed_number?: string            // número de escritura
  estimated_fees_eur?: number
  imt_confirmation_required: boolean
  created_at: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; system: string; reason: string; action_required: string }
type LegalError = { status: 'ERROR'; system: string; error: string }

const IRN_API_KEY = process.env.IRN_PT_API_KEY
const IRN_BASE_URL = process.env.IRN_PT_BASE_URL ?? 'https://api.irn.mj.pt/v1'

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    system: 'IRN Portugal',
    reason: 'IRN_PT_API_KEY not set — formal IRN digital services agreement required',
    action_required: 'Contact IRN (Instituto dos Registos e do Notariado) at https://www.irn.mj.pt to obtain digital services API access for automated notary scheduling. Set IRN_PT_API_KEY and IRN_PT_BASE_URL in Vercel environment.',
  }
}

export async function requestNotaryAppointment(req: NotaryAppointmentRequestPT): Promise<NotaryAppointmentResultPT | NotConfigured | LegalError> {
  if (!IRN_API_KEY) return notConfigured()

  // Idempotency check
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('notary_appointments')
      .select('appointment_id, status, notary_name, appointment_date')
      .eq('idempotency_key', req.idempotency_key)
      .limit(1)

    type ExRow = { appointment_id: string; status: string; notary_name: string; appointment_date: string }
    const ex = (existing as ExRow[] | null)?.[0]
    if (ex) {
      return {
        appointment_id: ex.appointment_id,
        provider: 'IRN_PT',
        status: ex.status as NotaryAppointmentResultPT['status'],
        notary_name: ex.notary_name,
        appointment_date: ex.appointment_date,
        imt_confirmation_required: true,
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }

  try {
    const response = await fetch(`${IRN_BASE_URL}/notary/appointments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IRN_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Request-ID': req.idempotency_key,
      },
      body: JSON.stringify({
        transaction_type: req.transaction_type,
        seller: { name: req.seller_name, nif: req.seller_nif, address: req.seller_address },
        buyer: { name: req.buyer_name, nif: req.buyer_nif, address: req.buyer_address },
        property: {
          article_matricial: req.property_article_matricial,
          fraction: req.property_fraction,
          municipality: req.property_municipality,
          district: req.property_district,
          description: req.property_description,
        },
        transaction: {
          sale_price: req.sale_price_eur,
          mortgage_bank: req.mortgage_bank,
          mortgage_amount: req.mortgage_amount_eur,
        },
        scheduling: {
          requested_date_from: req.requested_date_from,
          preferred_district: req.preferred_notary_district,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.warn('[notaryPortugalAdapter] appointment request failed', { status: response.status, deal_id: req.deal_id })
      return { status: 'ERROR', system: 'IRN Portugal', error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` }
    }

    const data = await response.json() as {
      appointment_id: string
      notary_name: string
      notary_address: string
      appointment_date: string
      appointment_time: string
      estimated_fees: number
    }

    const result: NotaryAppointmentResultPT = {
      appointment_id: randomUUID(),
      provider: 'IRN_PT',
      status: 'CONFIRMED',
      notary_name: data.notary_name,
      notary_address: data.notary_address,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      estimated_fees_eur: data.estimated_fees,
      imt_confirmation_required: true,
      created_at: new Date().toISOString(),
    }

    void (supabaseAdmin as any)
      .from('notary_appointments')
      .insert({
        appointment_id: result.appointment_id,
        tenant_id: req.tenant_id,
        deal_id: req.deal_id,
        idempotency_key: req.idempotency_key,
        country: 'PT',
        transaction_type: req.transaction_type,
        provider: 'IRN_PT',
        status: result.status,
        notary_name: result.notary_name ?? null,
        notary_address: result.notary_address ?? null,
        appointment_date: result.appointment_date ?? null,
        appointment_time: result.appointment_time ?? null,
        estimated_fees_eur: result.estimated_fees_eur ?? null,
        provider_appointment_id: data.appointment_id,
        created_at: result.created_at,
      })
      .catch((e: unknown) => log.warn('[notaryPortugalAdapter] persist error', { e }))

    log.info('[notaryPortugalAdapter] appointment confirmed', { appointment_id: result.appointment_id, deal_id: req.deal_id })
    return result
  } catch (e) {
    log.warn('[notaryPortugalAdapter] error', { e })
    return { status: 'ERROR', system: 'IRN Portugal', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!IRN_API_KEY
}
