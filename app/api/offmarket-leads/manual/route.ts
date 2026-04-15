// =============================================================================
// Agency Group — Manual Lead Intake (World-Class Minimal)
// POST /api/offmarket-leads/manual
//
// INPUT MÍNIMO (2 campos obrigatórios):
//   cidade        * required
//   tipo_ativo    * required
//   price_ask       optional (K€ — frontend envia em K, aqui converte)
//   area_m2         optional
//   descricao       optional (mapeado para notes)
//   localizacao     optional
//   contacto        optional
//   contact_phone_owner  optional
//   owner_name      optional
//   urgency         optional (default: unknown)
//   source          optional (default: manual)
//   source_network_type  optional
//
// AUTO-PIPELINE (sem botão extra):
//   1. Cria lead com gate_status = accepted_raw
//   2. Score automático
//   3. Price Intel automático (se price_ask + area_m2)
//   4. Match Buyers automático
//   5. Deal Eval automático
//
// DUPLICATE CHECK:
//   Antes de criar, verifica se existe lead semelhante (mesma cidade + tipo + preço ±20%)
//   Se encontrar, avisa mas não bloqueia.
//
// RETURNS:
//   lead_id, score, deal_evaluation_score, master_attack_rank,
//   matched_buyers_count, next_action, pipeline_status, duplicate_warning
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Auth ─────────────────────────────────────────────────────────────────────
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && incoming === cronSecret) return true
  const session = await auth()
  return !!session
}

// ── Normalise city ────────────────────────────────────────────────────────────
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ── Internal pipeline call ────────────────────────────────────────────────────
async function callInternal(path: string, leadId: string, siteUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${siteUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET ?? '',
      },
      body: JSON.stringify({ lead_id: leadId }),
      signal: AbortSignal.timeout(20000),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.agencygroup.pt').replace(/\/$/, '')

  try {
    const body = await req.json() as Record<string, unknown>

    // ── Validation: minimum required fields ──────────────────────────
    const cidade = typeof body.cidade === 'string' ? body.cidade.trim() : null
    const tipo_ativo = typeof body.tipo_ativo === 'string' ? body.tipo_ativo.trim() : null

    if (!cidade || cidade.length < 2) {
      return NextResponse.json({ error: 'cidade é obrigatório (mín. 2 caracteres)' }, { status: 400 })
    }
    if (!tipo_ativo || tipo_ativo.length < 2) {
      return NextResponse.json({ error: 'tipo_ativo é obrigatório (ex: Apartamento, Moradia, Terreno)' }, { status: 400 })
    }

    // ── Price normalization: frontend sends K€, store in € ────────────
    let price_ask: number | null = null
    if (typeof body.price_ask === 'number' && body.price_ask > 0) {
      // If value ≤ 50000 assume it's K€ (e.g. 750 → 750.000€)
      price_ask = body.price_ask <= 50000
        ? Math.round(body.price_ask * 1000)
        : Math.round(body.price_ask)
    }

    const area_m2 = typeof body.area_m2 === 'number' && body.area_m2 > 0 ? body.area_m2 : null
    const source = typeof body.source === 'string' ? body.source : 'manual'
    const urgency = typeof body.urgency === 'string' ? body.urgency : 'unknown'

    // ── Duplicate check (soft) ────────────────────────────────────────
    let duplicate_warning: string | null = null
    const cityNorm = normalizeCity(cidade)

    const { data: existingLeads } = await s
      .from('offmarket_leads')
      .select('id, nome, price_ask, area_m2, score')
      .ilike('cidade', `%${cidade}%`)
      .ilike('tipo_ativo', `%${tipo_ativo.split(' ')[0]}%`)
      .not('status', 'in', '("closed_won","closed_lost","not_interested")')
      .limit(5)

    if (existingLeads && existingLeads.length > 0 && price_ask) {
      const similar = existingLeads.filter((l: Record<string, unknown>) => {
        if (!l.price_ask) return false
        const priceDiff = Math.abs((l.price_ask as number) - price_ask!) / price_ask!
        return priceDiff < 0.2 // within ±20%
      })
      if (similar.length > 0) {
        const s0 = similar[0] as Record<string, unknown>
        duplicate_warning = `Possível duplicado detectado: lead "${s0.nome ?? s0.id}" em ${cidade} com preço semelhante (€${((s0.price_ask as number) / 1000).toFixed(0)}K). Lead criado mesmo assim.`
      }
    }

    // ── Build nome from city + type ──────────────────────────────────
    const nomeAuto = body.descricao
      ? String(body.descricao).substring(0, 80)
      : `${tipo_ativo} · ${cidade}`

    // ── Create lead ───────────────────────────────────────────────────
    const payload: Record<string, unknown> = {
      nome:               nomeAuto,
      tipo_ativo,
      cidade,
      city_normalized:    cityNorm,
      localizacao:        typeof body.localizacao === 'string' ? body.localizacao : null,
      area_m2,
      price_ask,
      contacto:           typeof body.contacto === 'string' ? body.contacto : null,
      contact_phone_owner: typeof body.contact_phone_owner === 'string' ? body.contact_phone_owner : null,
      contact_email_owner: typeof body.contact_email_owner === 'string' ? body.contact_email_owner : null,
      owner_name:         typeof body.owner_name === 'string' ? body.owner_name : null,
      owner_type:         typeof body.owner_type === 'string' ? body.owner_type : 'individual',
      urgency,
      source,
      source_url:         typeof body.source_url === 'string' ? body.source_url : null,
      source_network_type: typeof body.source_network_type === 'string' ? body.source_network_type : null,
      notes:              typeof body.notes === 'string' ? body.notes : null,
      assigned_to:        typeof body.assigned_to === 'string' ? body.assigned_to : null,
      status:             'new',
      score_status:       'pending_score',
      gate_status:        'accepted_raw',
      contact_research_status: (body.contacto || body.contact_phone_owner) ? 'researching' : 'pending',
    }

    const { data: lead, error: createErr } = await s
      .from('offmarket_leads')
      .insert(payload)
      .select('id, nome, cidade, tipo_ativo, price_ask, area_m2')
      .single()

    if (createErr || !lead) {
      console.error('[offmarket/manual] Create error:', createErr)
      return NextResponse.json({ error: createErr?.message ?? 'Erro ao criar lead' }, { status: 500 })
    }

    console.log(`[offmarket/manual] Lead criado: ${lead.id} — "${lead.nome}"`)

    // ── AUTO-PIPELINE (score → price-intel → match → eval) ────────────
    const pipeline: Record<string, boolean> = {
      score: false,
      price_intel: false,
      match_buyers: false,
      deal_eval: false,
      advisor_assigned: false,
    }

    // 1. Score
    try {
      const scoreRes = await fetch(`${siteUrl}/api/offmarket-leads/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET ?? '',
        },
        body: JSON.stringify({ lead_id: lead.id }),
        signal: AbortSignal.timeout(15000),
      })
      pipeline.score = scoreRes.ok
    } catch { /* graceful */ }

    // 2. Price Intel (only if price_ask + area_m2 available)
    if (lead.price_ask && lead.area_m2) {
      pipeline.price_intel = await callInternal(`/api/offmarket-leads/${lead.id}/price-intel`, lead.id, siteUrl)
    }

    // 3. Match Buyers
    pipeline.match_buyers = await callInternal(`/api/offmarket-leads/${lead.id}/match-buyers`, lead.id, siteUrl)

    // 4. Deal Eval
    pipeline.deal_eval = await callInternal(`/api/offmarket-leads/${lead.id}/deal-eval`, lead.id, siteUrl)

    // ── Fetch final state ────────────────────────────────────────────
    const { data: final } = await s
      .from('offmarket_leads')
      .select(`
        id, nome, cidade, score, deal_evaluation_score, master_attack_rank,
        money_priority_score, matched_buyers_count, best_buyer_match_score,
        execution_blocker_reason, cpcv_probability, deal_readiness_score,
        attack_recommendation, revenue_per_lead_estimate, gate_status,
        seller_intent_label, data_quality_score, incomplete_data_flag
      `)
      .eq('id', lead.id)
      .single()

    // ── Gate status update ───────────────────────────────────────────
    const score = final?.score ?? 0
    if (score >= 70 && !final?.incomplete_data_flag) {
      await s
        .from('offmarket_leads')
        .update({ gate_status: 'accepted_priority' })
        .eq('id', lead.id)
    }

    // ── Advisor auto-assignment ──────────────────────────────────────
    if (!payload.assigned_to) {
      const ADVISOR_MAP: { zones: string[]; advisor: string }[] = [
        { zones: ['cascais','estoril','sintra','oeiras'],                                            advisor: 'geral@agencygroup.pt' },
        { zones: ['chiado','príncipe real','lapa','santos','bairro alto','campo de ourique','estrela','belém'], advisor: 'geral@agencygroup.pt' },
        { zones: ['parque das nações','expo','oriente','beato','marvila'],                           advisor: 'geral@agencygroup.pt' },
        { zones: ['algarve','vilamoura','quinta do lago','vale do lobo','lagos','faro','albufeira','portimão'], advisor: 'geral@agencygroup.pt' },
        { zones: ['porto','foz','boavista','matosinhos','leça','gaia'],                             advisor: 'geral@agencygroup.pt' },
        { zones: ['comporta','troia','alcácer do sal','melides'],                                    advisor: 'geral@agencygroup.pt' },
        { zones: ['madeira','funchal','câmara de lobos','caniço'],                                   advisor: 'geral@agencygroup.pt' },
      ]
      const haystack = `${lead.cidade ?? ''} ${body.localizacao ?? ''}`.toLowerCase()
      let assignedAdvisor = 'geral@agencygroup.pt'
      for (const entry of ADVISOR_MAP) {
        if (entry.zones.some(z => haystack.includes(z))) { assignedAdvisor = entry.advisor; break }
      }
      await s.from('offmarket_leads').update({ assigned_to: assignedAdvisor }).eq('id', lead.id)
      pipeline.advisor_assigned = true
    }

    // ── next_action summary ──────────────────────────────────────────
    const blocker = final?.execution_blocker_reason ?? 'score_pending'
    const nextActionMap: Record<string, string> = {
      no_contact:       '🔍 OBTER CONTACTO DIRETO — prioridade máxima',
      no_meeting:       '📅 MARCAR VISITA — ligar em <24h',
      no_buyer:         '👤 SEM BUYER — verificar pool de compradores',
      no_price_intel:   '💶 SEM PRICE INTEL — fornecer preço + área',
      sla_breach:       '🚨 SLA EM RISCO — agir agora',
      cpcv_trigger:     '🟢 CPCV TRIGGER — fechar esta semana',
      ready_to_attack:  '⚡ PRONTO — contactar agora',
      score_pending:    '⏳ A PONTUAR — aguardar cron (07:00)',
    }

    return NextResponse.json({
      success:   true,
      lead_id:   lead.id,
      nome:      final?.nome ?? nomeAuto,
      pipeline,
      result: {
        score:                  final?.score ?? null,
        deal_evaluation_score:  final?.deal_evaluation_score ?? null,
        master_attack_rank:     final?.master_attack_rank ?? null,
        money_priority_score:   final?.money_priority_score ?? null,
        matched_buyers_count:   final?.matched_buyers_count ?? 0,
        best_buyer_match_score: final?.best_buyer_match_score ?? null,
        cpcv_probability:       final?.cpcv_probability ?? null,
        deal_readiness_score:   final?.deal_readiness_score ?? null,
        attack_recommendation:  final?.attack_recommendation ?? null,
        seller_intent_label:    final?.seller_intent_label ?? 'unknown',
        revenue_per_lead_estimate: final?.revenue_per_lead_estimate ?? null,
        gate_status:            final?.gate_status ?? 'accepted_raw',
        data_quality_score:     final?.data_quality_score ?? 0,
      },
      next_action:       nextActionMap[blocker] ?? `→ ${blocker}`,
      pipeline_status:   score >= 70 ? 'PRIORITÁRIO' : score >= 50 ? 'EM_AVALIAÇÃO' : 'BAIXA_PRIORIDADE',
      duplicate_warning: duplicate_warning ?? null,
      created_at:        new Date().toISOString(),
    }, { status: 201 })

  } catch (err) {
    console.error('[offmarket/manual] Error:', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
