// =============================================================================
// Agency Group — Contact Enrichment Engine
// POST /api/contact-enrichment/run
//
// Computa contact_confidence_score e actualiza contact_research_status
// para um lead específico ou batch.
//
// Input:
//   body.lead_id  — string UUID (single lead)
//   body.batch    — boolean (process top 20 leads sem contacto)
//
// Output:
//   lead_id, contact_research_status, contact_confidence_score,
//   recommended_action, next_contact_channel
//
// Lógica de confiança:
//   contact_phone_owner presente = +50
//   contact_email_owner presente = +30
//   contacto (listing agent) presente = +20
//   contact_source = linkedin/land_registry = +15
//   contact_source = referral = +20
//   owner_name identificado = +10
//   contact_attempts_count ≥1 = prova que contacto foi tentado = +5
//   Máximo = 100 → status = confirmed
//   40-79 = partial
//   <40 = none/failed
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export const runtime = 'nodejs'

type ContactStatus = 'pending' | 'researching' | 'found' | 'failed' | 'skipped'
type NextChannel = 'phone' | 'whatsapp' | 'email' | 'sms' | 'visit' | 'letter'

interface EnrichmentResult {
  lead_id: string
  nome: string | null
  contact_confidence_score: number
  contact_research_status: ContactStatus
  recommended_action: string
  next_contact_channel: NextChannel | null
  sources_available: string[]
}

function computeConfidence(lead: Record<string, unknown>): {
  score: number
  status: ContactStatus
  sources: string[]
} {
  let score = 0
  const sources: string[] = []

  // Owner direct phone (+50)
  if (lead.contact_phone_owner) {
    score += 50
    sources.push('owner_phone')
  }
  // Owner direct email (+30)
  if (lead.contact_email_owner) {
    score += 30
    sources.push('owner_email')
  }
  // Listing agent contact (+20)
  if (lead.contacto) {
    score += 20
    sources.push('listing_agent')
  }
  // Source quality bonus
  const src = lead.contact_source as string | null
  if (src === 'referral') {
    score += 20
    sources.push('referral')
  } else if (src === 'land_registry') {
    score += 15
    sources.push('land_registry')
  } else if (src === 'linkedin') {
    score += 15
    sources.push('linkedin')
  } else if (src === 'listing_agent') {
    // already counted above, no extra
  }
  // Owner name identified (+10)
  if (lead.owner_name) {
    score += 10
    sources.push('owner_identified')
  }
  // Contact already attempted (+5 — proves number exists)
  if ((lead.contact_attempts_count as number ?? 0) >= 1) {
    score += 5
    sources.push('previous_attempt')
  }

  const finalScore = Math.min(100, score)
  let status: ContactStatus
  if (finalScore >= 80) {
    status = 'found'
  } else if (finalScore >= 40) {
    status = 'researching' // partial info, keep investigating
  } else {
    status = 'pending' // nothing found yet
  }

  return { score: finalScore, status, sources }
}

function computeNextChannel(lead: Record<string, unknown>): NextChannel | null {
  const last = lead.last_attempt_channel as string | null
  const attempts = (lead.contact_attempts_count as number) ?? 0

  if (!last || attempts === 0) {
    // First attempt: prefer phone if available, else WhatsApp
    if (lead.contact_phone_owner || lead.contacto) return 'phone'
    if (lead.contact_email_owner) return 'email'
    return 'phone'
  }
  // Rotation: phone → whatsapp → email → sms → visit
  const rotation: NextChannel[] = ['phone', 'whatsapp', 'email', 'sms', 'visit']
  const currentIdx = rotation.indexOf(last as NextChannel)
  if (currentIdx === -1 || currentIdx >= rotation.length - 1) return 'phone'
  return rotation[currentIdx + 1]
}

function buildRecommendedAction(lead: Record<string, unknown>, confidence: number): string {
  if (confidence >= 80) {
    const channel = lead.contact_phone_owner ? 'telefone direto' : (lead.contacto ? 'via agente' : 'email')
    return `✅ CONTACTO CONFIRMADO — ligar por ${channel} imediatamente`
  }
  if (confidence >= 60) {
    if (lead.contacto && !lead.contact_phone_owner) {
      return `🔍 PARCIAL — pedir contacto direto ao agente do anúncio`
    }
    return `🔍 PARCIAL — pesquisar no registo predial + LinkedIn`
  }
  if (confidence >= 40) {
    return `🔍 PESQUISA NECESSÁRIA — sem contacto direto · usar: registo predial (Conservatória), LinkedIn (nome + zona), rede de agentes`
  }
  return `⚠ SEM CONTACTO — acção manual necessária: (1) Pesquisar registo predial, (2) LinkedIn por zona/tipo, (3) Perguntar rede`
}

async function enrichSingleLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  s: any,
  leadId: string,
): Promise<EnrichmentResult> {
  const { data: lead, error } = await s
    .from('offmarket_leads')
    .select(`
      id, nome, contacto, contact_phone_owner, contact_email_owner,
      contact_source, contact_attempts_count, last_attempt_channel,
      owner_name, contact_research_status
    `)
    .eq('id', leadId)
    .single()

  if (error || !lead) {
    return {
      lead_id: leadId,
      nome: null,
      contact_confidence_score: 0,
      contact_research_status: 'failed',
      recommended_action: 'Lead não encontrada',
      next_contact_channel: null,
      sources_available: [],
    }
  }

  const { score, status, sources } = computeConfidence(lead)
  const nextChannel = computeNextChannel(lead)
  const action = buildRecommendedAction(lead, score)

  // Update the lead in DB
  await s
    .from('offmarket_leads')
    .update({
      contact_confidence_score: score,
      contact_research_status: status,
      next_contact_channel: nextChannel,
    })
    .eq('id', leadId)

  return {
    lead_id: leadId,
    nome: lead.nome,
    contact_confidence_score: score,
    contact_research_status: status,
    recommended_action: action,
    next_contact_channel: nextChannel,
    sources_available: sources,
  }
}

// Vercel crons use GET — run batch enrichment by default
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || incoming !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any
  const { data: leads, error } = await s
    .from('offmarket_leads')
    .select('id')
    .gte('score', 60)
    .in('contact_research_status', ['pending', 'researching'])
    .not('status', 'in', '("closed_won","closed_lost","not_interested")')
    .order('score', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'DB error', details: error }, { status: 500 })

  const results: EnrichmentResult[] = []
  for (const row of leads ?? []) {
    results.push(await enrichSingleLead(s, row.id))
  }
  const confirmed = results.filter(r => r.contact_research_status === 'found').length
  return NextResponse.json({ success: true, total_processed: results.length, confirmed, results })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth: portal token OR CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  const incomingCron = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
  const isCron = cronSecret && incomingCron === cronSecret

  if (!isCron) {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  try {
    const body = await req.json() as { lead_id?: string; batch?: boolean; limit?: number }
    const { lead_id, batch, limit = 20 } = body

    // ── Single lead enrichment ────────────────────────────────────────
    if (lead_id) {
      const result = await enrichSingleLead(s, lead_id)
      return NextResponse.json({ success: true, result })
    }

    // ── Batch enrichment ──────────────────────────────────────────────
    if (batch) {
      const { data: leads, error } = await s
        .from('offmarket_leads')
        .select('id')
        .gte('score', 60)
        .in('contact_research_status', ['pending', 'researching'])
        .not('status', 'in', '("closed_won","closed_lost","not_interested")')
        .order('score', { ascending: false })
        .limit(Math.min(50, limit))

      if (error) {
        return NextResponse.json({ error: 'DB query failed', details: error }, { status: 500 })
      }

      const results: EnrichmentResult[] = []
      for (const row of leads ?? []) {
        const r = await enrichSingleLead(s, row.id)
        results.push(r)
      }

      const confirmed  = results.filter(r => r.contact_research_status === 'found').length
      const partial    = results.filter(r => r.contact_research_status === 'researching').length
      const noContact  = results.filter(r => r.contact_research_status === 'pending').length

      return NextResponse.json({
        success: true,
        total_processed: results.length,
        confirmed,
        partial,
        no_contact: noContact,
        results,
      })
    }

    return NextResponse.json(
      { error: 'Provide lead_id (string) or batch: true' },
      { status: 400 },
    )
  } catch (err) {
    console.error('[contact-enrichment/run] Error:', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
