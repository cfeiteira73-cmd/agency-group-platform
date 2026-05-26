// lib/legal/landRegistryPortugalAdapter.ts
// Portugal Land Registry adapter
// Portal: Predial Online (https://www.predialonline.pt)
// Provider: IRN — Instituto dos Registos e do Notariado
// API: IRN Webservices (SOAP/REST bridge, requires IRN institutional access)

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'

export interface LandRegistrySubmissionPT {
  idempotency_key: string
  deal_id: string
  tenant_id: string
  submission_type: 'REGISTO_AQUISICAO' | 'REGISTO_HIPOTECA' | 'CANCELAMENTO_HIPOTECA' | 'REGISTO_USUFRUTO'
  property_article_matricial: string
  property_fraction?: string
  buyer_name: string
  buyer_nif: string
  deed_number: string             // número de escritura from notary
  deed_date: string               // ISO date
  notary_name: string
  notary_conservatory: string
  sale_price_eur: number
  imt_paid_amount_eur?: number    // IMT already paid
  imt_payment_reference?: string
}

export interface LandRegistryResultPT {
  submission_id: string
  provider: 'PREDIAL_ONLINE_PT'
  status: 'SUBMITTED' | 'PENDING_ANALYSIS' | 'REGISTERED' | 'REJECTED' | 'PENDING_CORRECTION'
  provisional_registration_number?: string   // número de registo provisório
  final_registration_date?: string
  registration_fee_eur?: number
  rejection_reason?: string
  certificate_url?: string        // URL to download registration certificate
  created_at: string
}

type NotConfigured = { status: 'NOT_CONFIGURED'; system: string; reason: string; action_required: string }
type LegalError = { status: 'ERROR'; system: string; error: string }

const IRN_REGISTRY_KEY = process.env.IRN_PT_REGISTRY_API_KEY
const IRN_REGISTRY_URL = process.env.IRN_PT_REGISTRY_URL ?? 'https://api.predialonline.pt/v1'

function notConfigured(): NotConfigured {
  return {
    status: 'NOT_CONFIGURED',
    system: 'Predial Online Portugal',
    reason: 'IRN_PT_REGISTRY_API_KEY not set — IRN institutional access required',
    action_required: 'Contact IRN at https://www.irn.mj.pt/sections/irn/a_irn/contactos for land registry API institutional access. Set IRN_PT_REGISTRY_API_KEY in Vercel environment.',
  }
}

export async function submitLandRegistration(req: LandRegistrySubmissionPT): Promise<LandRegistryResultPT | NotConfigured | LegalError> {
  if (!IRN_REGISTRY_KEY) return notConfigured()

  // Idempotency
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('land_registry_submissions')
      .select('submission_id, status, provisional_registration_number')
      .eq('idempotency_key', req.idempotency_key)
      .limit(1)

    type ExRow = { submission_id: string; status: string; provisional_registration_number: string }
    const ex = (existing as ExRow[] | null)?.[0]
    if (ex) {
      return {
        submission_id: ex.submission_id,
        provider: 'PREDIAL_ONLINE_PT',
        status: ex.status as LandRegistryResultPT['status'],
        provisional_registration_number: ex.provisional_registration_number,
        created_at: new Date().toISOString(),
      }
    }
  } catch { /* ignore */ }

  try {
    const response = await fetch(`${IRN_REGISTRY_URL}/registos/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IRN_REGISTRY_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': req.idempotency_key,
      },
      body: JSON.stringify({
        tipo_registo: req.submission_type,
        artigo_matricial: req.property_article_matricial,
        fracao: req.property_fraction,
        adquirente: { nome: req.buyer_name, nif: req.buyer_nif },
        escritura: {
          numero: req.deed_number,
          data: req.deed_date,
          notario: req.notary_name,
          conservatoria: req.notary_conservatory,
        },
        transacao: {
          valor: req.sale_price_eur,
          imt_pago: req.imt_paid_amount_eur,
          referencia_imt: req.imt_payment_reference,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.warn('[landRegistryPT] submission failed', { status: response.status, deal_id: req.deal_id })
      return { status: 'ERROR', system: 'Predial Online Portugal', error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` }
    }

    const data = await response.json() as {
      numero_registo_provisorio: string
      taxa_registo: number
      estado: string
    }

    const result: LandRegistryResultPT = {
      submission_id: randomUUID(),
      provider: 'PREDIAL_ONLINE_PT',
      status: 'SUBMITTED',
      provisional_registration_number: data.numero_registo_provisorio,
      registration_fee_eur: data.taxa_registo,
      created_at: new Date().toISOString(),
    }

    void (supabaseAdmin as any)
      .from('land_registry_submissions')
      .insert({
        submission_id: result.submission_id,
        tenant_id: req.tenant_id,
        deal_id: req.deal_id,
        idempotency_key: req.idempotency_key,
        country: 'PT',
        submission_type: req.submission_type,
        provider: 'PREDIAL_ONLINE_PT',
        status: result.status,
        provisional_registration_number: result.provisional_registration_number ?? null,
        registration_fee_eur: result.registration_fee_eur ?? null,
        created_at: result.created_at,
      })
      .catch((e: unknown) => log.warn('[landRegistryPT] persist error', { e }))

    log.info('[landRegistryPT] submitted', { submission_id: result.submission_id, ref: data.numero_registo_provisorio })
    return result
  } catch (e) {
    return { status: 'ERROR', system: 'Predial Online Portugal', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export function isConfigured(): boolean {
  return !!IRN_REGISTRY_KEY
}
