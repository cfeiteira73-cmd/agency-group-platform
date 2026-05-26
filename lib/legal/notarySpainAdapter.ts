// lib/legal/notarySpainAdapter.ts
// Spain notary system adapter
// Regulatory body: Consejo General del Notariado (https://www.notariado.org)
// Platform: SIGNO (Sistema Integrado de Gestión Notarial)
// API access via Agencia Notarial de Certificación (ANCERT)

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

export interface NotaryAppointmentRequestES {
  idempotency_key: string
  deal_id: string
  tenant_id: string
  transaction_type: 'COMPRAVENTA' | 'ARRAS_PENITENCIALES' | 'HIPOTECA' | 'CANCELACION_HIPOTECA'
  seller_name: string
  seller_dni_nif: string
  seller_address: string
  buyer_name: string
  buyer_dni_nif: string
  buyer_address: string
  property_finca_registral: string  // finca registral number
  property_catastral_ref: string    // referencia catastral
  property_municipality: string
  property_province: string
  property_autonomous_community: string  // for ITP rate selection
  sale_price_eur: number
  mortgage_entity?: string
  mortgage_amount_eur?: number
  requested_date_from: string
  preferred_province?: string
}

export interface NotaryAppointmentResultES {
  appointment_id: string
  provider: 'ANCERT_ES' | 'NOTARY_DIRECT'
  status: 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED'
  notary_name?: string
  notary_address?: string
  appointment_date?: string
  appointment_time?: string
  protocol_number?: string     // número de protocolo
  estimated_fees_eur?: number
  created_at: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; system: string; reason: string; action_required: string }
type LegalError = { status: 'ERROR'; system: string; error: string }

const ANCERT_API_KEY = process.env.ANCERT_ES_API_KEY
const ANCERT_BASE_URL = process.env.ANCERT_ES_BASE_URL ?? 'https://api.ancert.com/v2'

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    system: 'ANCERT Spain',
    reason: 'ANCERT_ES_API_KEY not set — Consejo General del Notariado API agreement required',
    action_required: 'Contact Agencia Notarial de Certificación (ANCERT) at https://www.ancert.com to obtain B2B API access for automated notary scheduling. Set ANCERT_ES_API_KEY in Vercel environment.',
  }
}

export async function requestNotaryAppointmentES(req: NotaryAppointmentRequestES): Promise<NotaryAppointmentResultES | NotConfigured | LegalError> {
  if (!ANCERT_API_KEY) return notConfigured()

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
        provider: 'ANCERT_ES',
        status: ex.status as NotaryAppointmentResultES['status'],
        notary_name: ex.notary_name,
        appointment_date: ex.appointment_date,
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }

  try {
    const response = await fetch(`${ANCERT_BASE_URL}/citas/solicitar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANCERT_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': req.idempotency_key,
      },
      body: JSON.stringify({
        tipo_acto: req.transaction_type,
        vendedor: { nombre: req.seller_name, nif: req.seller_dni_nif, domicilio: req.seller_address },
        comprador: { nombre: req.buyer_name, nif: req.buyer_dni_nif, domicilio: req.buyer_address },
        finca: {
          referencia_registral: req.property_finca_registral,
          referencia_catastral: req.property_catastral_ref,
          municipio: req.property_municipality,
          provincia: req.property_province,
          comunidad_autonoma: req.property_autonomous_community,
        },
        operacion: {
          precio: req.sale_price_eur,
          entidad_hipotecaria: req.mortgage_entity,
          importe_hipoteca: req.mortgage_amount_eur,
        },
        preferencias: {
          fecha_desde: req.requested_date_from,
          provincia_preferida: req.preferred_province,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { status: 'ERROR', system: 'ANCERT Spain', error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` }
    }

    const data = await response.json() as {
      cita_id: string
      notario: string
      direccion: string
      fecha: string
      hora: string
      honorarios_estimados: number
    }

    const result: NotaryAppointmentResultES = {
      appointment_id: randomUUID(),
      provider: 'ANCERT_ES',
      status: 'CONFIRMED',
      notary_name: data.notario,
      notary_address: data.direccion,
      appointment_date: data.fecha,
      appointment_time: data.hora,
      estimated_fees_eur: data.honorarios_estimados,
      created_at: new Date().toISOString(),
    }

    void (supabaseAdmin as any)
      .from('notary_appointments')
      .insert({
        appointment_id: result.appointment_id,
        tenant_id: req.tenant_id,
        deal_id: req.deal_id,
        idempotency_key: req.idempotency_key,
        country: 'ES',
        transaction_type: req.transaction_type,
        provider: 'ANCERT_ES',
        status: result.status,
        notary_name: result.notary_name ?? null,
        notary_address: result.notary_address ?? null,
        appointment_date: result.appointment_date ?? null,
        appointment_time: result.appointment_time ?? null,
        estimated_fees_eur: result.estimated_fees_eur ?? null,
        provider_appointment_id: data.cita_id,
        created_at: result.created_at,
      })
      .catch((e: unknown) => log.warn('[notarySpainAdapter] persist error', { e }))

    log.info('[notarySpainAdapter] appointment confirmed', { appointment_id: result.appointment_id, deal_id: req.deal_id })
    return result
  } catch (e) {
    return { status: 'ERROR', system: 'ANCERT Spain', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!ANCERT_API_KEY
}
