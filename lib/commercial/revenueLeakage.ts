// =============================================================================
// Agency Group — Revenue Leakage Detection
// lib/commercial/revenueLeakage.ts
//
// Scans the pipeline for revenue that is "leaking" — deals stuck, leads
// uncontacted, CPCV-ready leads not actioned, high-score contacts idle.
//
// DETECTION CATEGORIES:
//   HIGH_SCORE_NO_CONTACT    — score ≥70, never contacted
//   CPCV_READY_NO_ACTION     — readiness ≥80 + cpcv_prob ≥65, no proposal in 7d
//   DEAL_STUCK               — deal in same stage >threshold days (stage-specific)
//   HUMAN_FAILURE_OPEN       — human_failure_flag=true, not resolved in 48h
//   DORMANT_HIGH_VALUE        — score ≥70, last_contact > 14 days
//
// USAGE:
//   const leaks = await detectRevenueLeakage()
//   const summary = summariseLeakage(leaks)
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeakageCategory =
  | 'HIGH_SCORE_NO_CONTACT'
  | 'CPCV_READY_NO_ACTION'
  | 'DEAL_STUCK'
  | 'HUMAN_FAILURE_OPEN'
  | 'DORMANT_HIGH_VALUE'

export type LeakageSeverity = 'critical' | 'high' | 'medium'

export interface LeakItem {
  id:          string
  category:    LeakageCategory
  severity:    LeakageSeverity
  lead_name:   string | null
  score:       number | null
  revenue_est: number | null
  description: string
  days_stale:  number
  action:      string         // recommended next action
  detected_at: string
}

export interface LeakageSummary {
  total:               number
  critical:            number
  high:                number
  medium:              number
  estimated_revenue:   number   // sum of revenue_est for all leaks
  by_category:         Record<LeakageCategory, number>
  top_items:           LeakItem[]  // top 10 by severity + revenue
  generated_at:        string
}

// ---------------------------------------------------------------------------
// Thresholds (will eventually come from platform_config)
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  highScoreMin:          70,
  cpCvReadinessMin:      80,
  cpcvProbMin:           65,
  dormantDays:           14,
  humanFailureHours:     48,
  cpvNoActionDays:        7,
  dealStuckDays: {
    'Angariação':         21,
    'Proposta Enviada':   10,
    'Proposta Aceite':     7,
    'Due Diligence':      21,
    'CPCV Assinado':      45,
    'Financiamento':      30,
    'Escritura Marcada':  14,
  } as Record<string, number>,
}

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

async function detectHighScoreNoContact(): Promise<LeakItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  const { data, error } = await s
    .from('offmarket_leads')
    .select('id, nome, score, revenue_per_lead_estimate, created_at, contacto')
    .gte('score', THRESHOLDS.highScoreMin)
    .is('contacto', null)
    .not('score', 'is', null)
    .not('status', 'in', '("closed_won","closed_lost","not_interested")')
    .order('score', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return (data as Array<{
    id: string; nome: string | null; score: number; revenue_per_lead_estimate: number | null; created_at: string
  }>).map(r => {
    const days = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000)
    return {
      id:          r.id,
      category:    'HIGH_SCORE_NO_CONTACT' as LeakageCategory,
      severity:    r.score >= 80 ? 'critical' : 'high' as LeakageSeverity,
      lead_name:   r.nome,
      score:       r.score,
      revenue_est: r.revenue_per_lead_estimate,
      description: `Score ${r.score} — sem contacto há ${days} dias`,
      days_stale:  days,
      action:      'Contactar imediatamente via WhatsApp ou chamada',
      detected_at: new Date().toISOString(),
    }
  })
}

async function detectCPCVReadyNoAction(): Promise<LeakItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  const sevenDaysAgo = new Date(Date.now() - THRESHOLDS.cpvNoActionDays * 86_400_000).toISOString()

  const { data, error } = await s
    .from('offmarket_leads')
    .select('id, nome, score, deal_readiness_score, cpcv_probability, revenue_per_lead_estimate, last_alerted_at, buyer_matched_at')
    .gte('deal_readiness_score', THRESHOLDS.cpCvReadinessMin)
    .gte('cpcv_probability', THRESHOLDS.cpcvProbMin)
    .not('buyer_matched_at', 'is', null)
    .not('status', 'in', '("closed_won","closed_lost","not_interested")')
    .or(`last_alerted_at.is.null,last_alerted_at.lt.${sevenDaysAgo}`)
    .order('deal_readiness_score', { ascending: false })
    .limit(30)

  if (error || !data) return []

  return (data as Array<{
    id: string; nome: string | null; score: number | null
    deal_readiness_score: number; cpcv_probability: number
    revenue_per_lead_estimate: number | null; last_alerted_at: string | null
  }>).map(r => {
    const days = r.last_alerted_at
      ? Math.floor((Date.now() - new Date(r.last_alerted_at).getTime()) / 86_400_000)
      : 99
    return {
      id:          r.id,
      category:    'CPCV_READY_NO_ACTION' as LeakageCategory,
      severity:    'critical' as LeakageSeverity,
      lead_name:   r.nome,
      score:       r.score,
      revenue_est: r.revenue_per_lead_estimate,
      description: `Readiness ${r.deal_readiness_score} · CPCV prob ${r.cpcv_probability}% — sem ação há ${days}d`,
      days_stale:  days,
      action:      'Enviar proposta de CPCV e agendar reunião de fecho',
      detected_at: new Date().toISOString(),
    }
  })
}

async function detectDealStuck(): Promise<LeakItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  const { data, error } = await s
    .from('deals')
    .select('id, ref, imovel, valor, fase, comprador, updated_at, agent_email')
    .not('status', 'in', '("Escritura Concluída","cancelled")')
    .order('updated_at', { ascending: true })
    .limit(100)

  if (error || !data) return []

  const leaks: LeakItem[] = []
  for (const deal of data as Array<{
    id: string | number; ref: string; imovel: string; valor: string | number | null
    fase: string; comprador: string | null; updated_at: string
  }>) {
    const threshold = THRESHOLDS.dealStuckDays[deal.fase] ?? 30
    const days = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86_400_000)
    if (days < threshold) continue

    const revenueRaw = typeof deal.valor === 'string'
      ? parseFloat(deal.valor.replace(/[^\d.]/g, ''))
      : (deal.valor ?? 0)
    const revenueEst = isNaN(revenueRaw) ? null : revenueRaw * 0.05  // 5% commission

    leaks.push({
      id:          String(deal.id),
      category:    'DEAL_STUCK' as LeakageCategory,
      severity:    days > threshold * 2 ? 'critical' : days > threshold * 1.5 ? 'high' : 'medium',
      lead_name:   deal.comprador ?? deal.imovel,
      score:       null,
      revenue_est: revenueEst,
      description: `Deal ${deal.ref} em "${deal.fase}" há ${days}d (limite: ${threshold}d)`,
      days_stale:  days,
      action:      `Retomar deal ${deal.ref} — contactar comprador e verificar bloqueios`,
      detected_at: new Date().toISOString(),
    })
  }

  return leaks
}

async function detectHumanFailureOpen(): Promise<LeakItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  const cutoff = new Date(Date.now() - THRESHOLDS.humanFailureHours * 3_600_000).toISOString()

  const { data, error } = await s
    .from('offmarket_leads')
    .select('id, nome, score, revenue_per_lead_estimate, execution_blocker_reason, updated_at')
    .eq('human_failure_flag', true)
    .lt('updated_at', cutoff)
    .not('status', 'in', '("closed_won","closed_lost","not_interested")')
    .order('score', { ascending: false })
    .limit(20)

  if (error || !data) return []

  return (data as Array<{
    id: string; nome: string | null; score: number | null
    revenue_per_lead_estimate: number | null
    execution_blocker_reason: string | null; updated_at: string
  }>).map(r => {
    const hours = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 3_600_000)
    return {
      id:          r.id,
      category:    'HUMAN_FAILURE_OPEN' as LeakageCategory,
      severity:    'critical' as LeakageSeverity,
      lead_name:   r.nome,
      score:       r.score,
      revenue_est: r.revenue_per_lead_estimate,
      description: `Falha humana há ${hours}h: ${r.execution_blocker_reason ?? 'sem motivo registado'}`,
      days_stale:  Math.floor(hours / 24),
      action:      'Resolver bloqueio imediatamente — escalação para manager',
      detected_at: new Date().toISOString(),
    }
  })
}

async function detectDormantHighValue(): Promise<LeakItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  const cutoff = new Date(Date.now() - THRESHOLDS.dormantDays * 86_400_000).toISOString()

  const { data, error } = await s
    .from('offmarket_leads')
    .select('id, nome, score, revenue_per_lead_estimate, last_alerted_at, contacto')
    .gte('score', THRESHOLDS.highScoreMin)
    .not('contacto', 'is', null)           // has been contacted at least once
    .lt('last_alerted_at', cutoff)
    .not('status', 'in', '("closed_won","closed_lost","not_interested")')
    .order('score', { ascending: false })
    .limit(40)

  if (error || !data) return []

  return (data as Array<{
    id: string; nome: string | null; score: number
    revenue_per_lead_estimate: number | null; last_alerted_at: string | null
  }>).map(r => {
    const days = r.last_alerted_at
      ? Math.floor((Date.now() - new Date(r.last_alerted_at).getTime()) / 86_400_000)
      : THRESHOLDS.dormantDays + 1
    return {
      id:          r.id,
      category:    'DORMANT_HIGH_VALUE' as LeakageCategory,
      severity:    r.score >= 85 ? 'high' : 'medium' as LeakageSeverity,
      lead_name:   r.nome,
      score:       r.score,
      revenue_est: r.revenue_per_lead_estimate,
      description: `Score ${r.score} sem actividade há ${days}d`,
      days_stale:  days,
      action:      'Re-engajamento: enviar deal pack actualizado ou update de mercado',
      detected_at: new Date().toISOString(),
    }
  })
}

// ---------------------------------------------------------------------------
// Main export: detectRevenueLeakage
// ---------------------------------------------------------------------------

export async function detectRevenueLeakage(): Promise<LeakItem[]> {
  const [noContact, cpcvReady, stuck, humanFail, dormant] = await Promise.allSettled([
    detectHighScoreNoContact(),
    detectCPCVReadyNoAction(),
    detectDealStuck(),
    detectHumanFailureOpen(),
    detectDormantHighValue(),
  ])

  const all: LeakItem[] = [
    ...(noContact.status  === 'fulfilled' ? noContact.value  : []),
    ...(cpcvReady.status  === 'fulfilled' ? cpcvReady.value  : []),
    ...(stuck.status      === 'fulfilled' ? stuck.value      : []),
    ...(humanFail.status  === 'fulfilled' ? humanFail.value  : []),
    ...(dormant.status    === 'fulfilled' ? dormant.value    : []),
  ]

  // Deduplicate by id (a lead can appear in multiple categories — keep highest severity)
  const seen = new Map<string, LeakItem>()
  const SEVERITY_ORDER: Record<LeakageSeverity, number> = { critical: 3, high: 2, medium: 1 }
  for (const item of all) {
    const existing = seen.get(item.id)
    if (!existing || SEVERITY_ORDER[item.severity] > SEVERITY_ORDER[existing.severity]) {
      seen.set(item.id, item)
    }
  }

  // Sort: critical first, then by revenue_est desc
  return [...seen.values()].sort((a, b) => {
    const sd = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    if (sd !== 0) return sd
    return (b.revenue_est ?? 0) - (a.revenue_est ?? 0)
  })
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

export function summariseLeakage(items: LeakItem[]): LeakageSummary {
  const byCategory: Record<LeakageCategory, number> = {
    HIGH_SCORE_NO_CONTACT: 0,
    CPCV_READY_NO_ACTION:  0,
    DEAL_STUCK:            0,
    HUMAN_FAILURE_OPEN:    0,
    DORMANT_HIGH_VALUE:    0,
  }

  let critical = 0, high = 0, medium = 0, estimatedRevenue = 0

  for (const item of items) {
    byCategory[item.category]++
    if (item.severity === 'critical') critical++
    else if (item.severity === 'high') high++
    else medium++
    estimatedRevenue += item.revenue_est ?? 0
  }

  return {
    total:             items.length,
    critical,
    high,
    medium,
    estimated_revenue: estimatedRevenue,
    by_category:       byCategory,
    top_items:         items.slice(0, 10),
    generated_at:      new Date().toISOString(),
  }
}
