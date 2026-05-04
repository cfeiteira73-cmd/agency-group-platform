// =============================================================================
// Agency Group — DRE Auto-Ingest Cron
// GET /api/cron/dre-ingest
// Scheduled: weekdays at 09:00 UTC via vercel.json
//
// PIPELINE:
//   1. Fetch DRE signals from internal /api/off-market/signals endpoint
//   2. For each property-relevant signal (insolvency / inheritance):
//      a. Check if already ingested (dedup on source_reference)
//      b. Create offmarket_leads row
//      c. Auto-score via /api/offmarket-leads/score (non-blocking)
//   3. Log execution to automations_log
//
// This cron converts raw DRE intelligence into actionable pipeline leads
// without any manual agent intervention.
//
// AUTH: CRON_SECRET
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import { cronCorrelationId }         from '@/lib/observability/correlation'

export const runtime    = 'nodejs'
export const maxDuration = 120

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()
  return token === secret
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DRESignal {
  id:                      string
  type:                    string
  priority:                number
  probability_score:       number
  property_address:        string | null
  property_zone:           string | null
  estimated_value:         number | null
  owner_name:              string | null
  signal_date:             string
  source:                  string
  source_url:              string | null
  source_reference:        string | null
  raw_summary:             string
  recommended_action:      string
  property_relevance_reason: string
}

interface IngestResult {
  signal_id:         string
  signal_type:       string
  lead_id:           string | null
  action:            'created' | 'skipped' | 'error'
  reason?:           string
}

// ---------------------------------------------------------------------------
// Step 1 — Fetch DRE signals from internal endpoint
// ---------------------------------------------------------------------------

async function fetchDRESignals(): Promise<DRESignal[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agencygroup.pt'

  try {
    const resp = await fetch(`${baseUrl}/api/off-market/signals?limit=50`, {
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN ?? ''}`,
        'Cache-Control': 'no-cache',
      },
    })

    if (!resp.ok) {
      console.error(`[dre-ingest] signals fetch ${resp.status}: ${await resp.text()}`)
      return []
    }

    const json = await resp.json()
    return (json.signals ?? []) as DRESignal[]
  } catch (err) {
    console.error('[dre-ingest] fetchDRESignals error:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Dedup: check if signal already ingested
// ---------------------------------------------------------------------------

async function isAlreadyIngested(signalRef: string | null): Promise<boolean> {
  if (!signalRef) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('offmarket_leads')
    .select('id')
    .eq('source', 'dre_parser')
    .eq('source_listing_id', signalRef)
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Step 3 — Map DRE signal type to owner_type + urgency
// ---------------------------------------------------------------------------

function mapSignalToLeadFields(signal: DRESignal): {
  owner_type: string
  urgency:    string
  tipo_ativo: string
  notes:      string
} {
  const type = signal.type

  let owner_type = 'individual'
  let urgency    = 'medium'
  let tipo_ativo = 'apartamento'  // default

  if (type === 'insolvency') {
    owner_type = 'empresa'
    urgency    = 'high'
  } else if (type === 'inheritance') {
    owner_type = 'herança'
    urgency    = 'medium'
  } else if (type === 'divorce') {
    urgency    = 'high'
  }

  // Heuristic tipo_ativo from address/summary
  const lower = (signal.property_address ?? signal.raw_summary ?? '').toLowerCase()
  if (lower.includes('moradia') || lower.includes('vivenda') || lower.includes('quinta'))
    tipo_ativo = 'moradia'
  else if (lower.includes('terreno') || lower.includes('lote'))
    tipo_ativo = 'terreno'
  else if (lower.includes('comercial') || lower.includes('loja') || lower.includes('armazém'))
    tipo_ativo = 'comercial'
  else if (lower.includes('prédio') || lower.includes('edificio'))
    tipo_ativo = 'prédio'

  const notes = [
    `Tipo DR: ${type}`,
    `Data publicação: ${signal.signal_date}`,
    `Relevância: ${signal.property_relevance_reason}`,
    `Resumo: ${signal.raw_summary.slice(0, 300)}`,
  ].join('\n')

  return { owner_type, urgency, tipo_ativo, notes }
}

// ---------------------------------------------------------------------------
// Step 4 — Create offmarket_lead
// ---------------------------------------------------------------------------

async function createOffmarketLead(signal: DRESignal): Promise<string | null> {
  const { owner_type, urgency, tipo_ativo, notes } = mapSignalToLeadFields(signal)

  const row = {
    nome:              signal.owner_name ?? `Sinal DR: ${signal.type}`,
    tipo_ativo,
    localizacao:       signal.property_address ?? null,
    cidade:            signal.property_zone ?? null,
    price_estimate:    signal.estimated_value ?? null,
    owner_type,
    urgency,
    source:            'dre_parser',
    source_url:        signal.source_url ?? null,
    source_listing_id: signal.source_reference ?? signal.id,
    status:            'new' as const,
    notes,
    score:             null,   // Will be set by auto-score step
    created_at:        new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('offmarket_leads')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('[dre-ingest] createOffmarketLead error:', error.message)
    return null
  }

  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Step 5 — Trigger score for new lead (fire-and-forget)
// ---------------------------------------------------------------------------

async function triggerAutoScore(leadId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agencygroup.pt'
  try {
    await fetch(
      `${baseUrl}/api/offmarket-leads/score?id=${leadId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
          'x-cron-secret': process.env.CRON_SECRET ?? '',
        },
      },
    )
  } catch {
    // Non-critical — lead will be scored on next batch run
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Log execution
// ---------------------------------------------------------------------------

async function logExecution(
  results:    IngestResult[],
  startedAt:  string,
  durationMs: number,
  errors:     string[],
): Promise<void> {
  const created = results.filter(r => r.action === 'created').length
  const skipped = results.filter(r => r.action === 'skipped').length

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('automations_log')
    .insert({
      workflow_name: 'dre_ingest_cron',
      trigger_type:  'cron',
      status:        errors.length === 0 ? 'success' : 'partial',
      started_at:    startedAt,
      completed_at:  new Date().toISOString(),
      duration_ms:   durationMs,
      outcome: {
        signals_fetched:  results.length,
        leads_created:    created,
        leads_skipped:    skipped,
      },
      error_message: errors.length > 0 ? errors.join('; ') : null,
    })
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId    = cronCorrelationId('dre-ingest')
  const startedAt = new Date().toISOString()
  const t0        = Date.now()
  const errors:   string[] = []
  const results:  IngestResult[] = []

  try {
    // 1. Fetch DRE signals
    const signals = await fetchDRESignals()

    if (signals.length === 0) {
      return NextResponse.json({
        ok:      true,
        message: 'No DRE signals available (API unavailable or cache miss)',
        results: [],
        duration_ms: Date.now() - t0,
      })
    }

    // 2. Process each signal
    for (const signal of signals) {
      const result: IngestResult = {
        signal_id:   signal.id,
        signal_type: signal.type,
        lead_id:     null,
        action:      'skipped',
      }

      try {
        // Dedup check
        const alreadyExists = await isAlreadyIngested(signal.source_reference ?? signal.id)
        if (alreadyExists) {
          result.action = 'skipped'
          result.reason = 'already_ingested'
          results.push(result)
          continue
        }

        // Create lead
        const leadId = await createOffmarketLead(signal)
        if (!leadId) {
          result.action = 'error'
          result.reason = 'insert_failed'
          errors.push(`signal ${signal.id}: insert failed`)
          results.push(result)
          continue
        }

        result.lead_id = leadId
        result.action  = 'created'

        // Trigger auto-score (non-blocking)
        triggerAutoScore(leadId).catch(() => {})

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.action = 'error'
        result.reason = msg
        errors.push(`signal ${signal.id}: ${msg}`)
      }

      results.push(result)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`fatal: ${msg}`)
  }

  const durationMs = Date.now() - t0

  // Log (best-effort)
  try {
    await logExecution(results, startedAt, durationMs, errors)
  } catch { /* silent */ }

  const created = results.filter(r => r.action === 'created').length
  const skipped = results.filter(r => r.action === 'skipped').length

  return NextResponse.json(
    {
      ok:      errors.length === 0,
      summary: {
        signals_processed: results.length,
        leads_created:     created,
        leads_skipped:     skipped,
        errors:            errors.length,
      },
      results,
      duration_ms:    durationMs,
      correlation_id: corrId,
      ...(errors.length > 0 ? { errors } : {}),
    },
    { status: errors.length > 0 && created === 0 ? 500 : 200, headers: { 'x-correlation-id': corrId } },
  )
}
