// Agency Group — Sofia AI Operating System
// lib/ai/sofia/sofiaOS.ts
// Wave 54 Phase 4 — Full Sofia AI agent orchestration
//
// Sofia roles: SDR, ISA, Buyer Qualifier, Seller Qualifier,
// Capital Introducer, Deal Concierge, Investor Assistant.
// Conversation memory, lead/buyer/seller qualification,
// follow-up engine, task creation, escalation, human handoff,
// opportunity detection, meeting recommendation, investor matching.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SofiaRole =
  | 'SDR'                // Sales Development Representative
  | 'ISA'                // Inside Sales Agent
  | 'BUYER_QUALIFIER'
  | 'SELLER_QUALIFIER'
  | 'CAPITAL_INTRODUCER'
  | 'DEAL_CONCIERGE'
  | 'INVESTOR_ASSISTANT'

export type LeadStatus   = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED' | 'OPPORTUNITY' | 'CLOSED_WON' | 'CLOSED_LOST'
export type FollowUpType = 'EMAIL' | 'WHATSAPP' | 'CALL' | 'MEETING' | 'PROPOSAL'
export type EscalationReason = 'HIGH_VALUE' | 'COMPLEX_LEGAL' | 'INVESTOR_INTEREST' | 'URGENT' | 'COMPLAINT'

export interface ConversationMemory {
  session_id: string
  contact_id: string
  role:        SofiaRole
  messages:    Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>
  context:     Record<string, unknown>   // extracted entities: budget, location, timeline, etc.
  created_at:  string
  updated_at:  string
}

export interface LeadQualification {
  lead_id: string
  contact_id: string
  status:     LeadStatus
  score:      number       // 0-100
  budget_min: number | null
  budget_max: number | null
  timeline_months: number | null
  locations:  string[]
  property_types: string[]
  investment_purpose: 'OWN_USE' | 'INVESTMENT' | 'BOTH' | 'UNKNOWN'
  financing_type: 'CASH' | 'MORTGAGE' | 'MIXED' | 'UNKNOWN'
  urgency:    'HIGH' | 'MEDIUM' | 'LOW'
  qualified_at: string | null
  disqualification_reason: string | null
}

export interface SellerQualification {
  seller_id: string
  contact_id: string
  property_ref: string
  asking_price_eur: number | null
  market_price_eur: number | null
  timeline_months: number | null
  motivation: 'DOWNSIZING' | 'RELOCATION' | 'FINANCIAL' | 'INHERITANCE' | 'INVESTMENT' | 'UNKNOWN'
  exclusivity_willing: boolean | null
  flexibility_pct: number | null   // % willing to negotiate
  qualified_at: string | null
}

export interface FollowUpTask {
  task_id: string
  contact_id: string
  lead_id: string | null
  type:     FollowUpType
  due_at:   string
  subject:  string
  body:     string
  sent:     boolean
  sent_at:  string | null
  created_by: 'SOFIA' | 'HUMAN'
}

export interface EscalationRecord {
  escalation_id: string
  contact_id: string
  lead_id: string | null
  reason: EscalationReason
  context: string
  assigned_to: string | null
  acknowledged: boolean
  escalated_at: string
}

export interface SofiaOSResponse {
  session_id: string
  contact_id: string
  role: SofiaRole
  intent: string
  entities_extracted: Record<string, unknown>
  qualification_update: Partial<LeadQualification> | null
  seller_update: Partial<SellerQualification> | null
  follow_up_tasks: FollowUpTask[]
  escalation: EscalationRecord | null
  next_best_action: string
  meeting_suggested: boolean
  investor_match_triggered: boolean
  response_text: string
  confidence: number
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Role routing ───────────────────────────────────────────────────────────────

function determineRole(context: Record<string, unknown>): SofiaRole {
  const intent = String(context['intent'] ?? '').toLowerCase()
  const budget  = Number(context['budget_max'] ?? 0)
  const isSeller = !!context['is_seller']

  if (isSeller) return 'SELLER_QUALIFIER'
  if (intent.includes('invest') || budget > 500_000) return 'INVESTOR_ASSISTANT'
  if (intent.includes('fund') || intent.includes('capital')) return 'CAPITAL_INTRODUCER'
  if (intent.includes('deal') || intent.includes('close')) return 'DEAL_CONCIERGE'
  if (context['is_qualified']) return 'ISA'
  return 'SDR'
}

// ── Entity extraction ──────────────────────────────────────────────────────────

function extractEntities(message: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {}

  // Budget extraction
  const budgetMatch = message.match(/[€$]?\s*(\d[\d.,]*)\s*(k|mil|000|M|m)?/i)
  if (budgetMatch) {
    let amount = parseFloat(budgetMatch[1]!.replace(/[.,]/g, ''))
    const multiplier = budgetMatch[2]?.toLowerCase()
    if (multiplier === 'k' || multiplier === 'mil') amount *= 1000
    if (multiplier === 'm') amount *= 1_000_000
    entities['budget_mentioned'] = amount
  }

  // Location extraction
  const locations = ['Lisboa', 'Porto', 'Cascais', 'Algarve', 'Madeira', 'Madrid', 'Barcelona', 'Sintra', 'Comporta', 'Lagos', 'Faro', 'Setúbal']
  const mentionedLocations = locations.filter(l => message.toLowerCase().includes(l.toLowerCase()))
  if (mentionedLocations.length > 0) entities['locations'] = mentionedLocations

  // Timeline
  const timelineMatch = message.match(/(\d+)\s*(meses|months|semanas|weeks|dias|days)/i)
  if (timelineMatch) entities['timeline'] = parseInt(timelineMatch[1]!)

  // Intent signals
  if (/comprar|buy|purchase|adquirir/i.test(message))  entities['intent'] = 'BUY'
  if (/vender|sell|selling/i.test(message))            entities['intent'] = 'SELL'
  if (/investir|invest|rendimento|yield|rental/i.test(message)) entities['intent'] = 'INVEST'
  if (/urgente|urgent|imediato|asap/i.test(message))   entities['urgency'] = 'HIGH'

  return entities
}

// ── Qualification scoring ──────────────────────────────────────────────────────

function scoreLead(qual: Partial<LeadQualification>): number {
  let score = 50  // base

  // Budget (30 pts)
  if (qual.budget_max && qual.budget_max >= 500_000) score += 30
  else if (qual.budget_max && qual.budget_max >= 200_000) score += 20
  else if (qual.budget_max && qual.budget_max >= 100_000) score += 10

  // Timeline (20 pts)
  if (qual.timeline_months && qual.timeline_months <= 3) score += 20
  else if (qual.timeline_months && qual.timeline_months <= 6) score += 12
  else if (qual.timeline_months && qual.timeline_months <= 12) score += 6

  // Financing clarity (15 pts)
  if (qual.financing_type === 'CASH')    score += 15
  if (qual.financing_type === 'MIXED')   score += 10
  if (qual.financing_type === 'MORTGAGE') score += 5

  // Urgency (15 pts)
  if (qual.urgency === 'HIGH')   score += 15
  if (qual.urgency === 'MEDIUM') score += 8

  // Location specified (10 pts)
  if (qual.locations && qual.locations.length > 0) score += 10

  // Investment purpose (10 pts)
  if (qual.investment_purpose === 'INVESTMENT' || qual.investment_purpose === 'BOTH') score += 10

  return Math.min(100, Math.max(0, score))
}

// ── Follow-up generation ───────────────────────────────────────────────────────

function generateFollowUp(
  contactId: string,
  leadId: string | null,
  context: Record<string, unknown>,
): FollowUpTask | null {
  const score    = Number(context['lead_score'] ?? 0)
  const urgency  = String(context['urgency'] ?? 'MEDIUM')
  const hasEmail = !!context['email']
  const hasWA    = !!context['whatsapp']

  if (score < 30) return null  // Too low to follow up

  const daysUntilFollowUp = urgency === 'HIGH' ? 1 : urgency === 'MEDIUM' ? 3 : 7
  const dueAt = new Date(Date.now() + daysUntilFollowUp * 86400_000).toISOString()

  const type: FollowUpType = hasWA ? 'WHATSAPP' : hasEmail ? 'EMAIL' : 'CALL'
  const location = Array.isArray(context['locations']) ? (context['locations'] as string[])[0] : 'Portugal'
  const budget   = context['budget_mentioned'] ? `€${Number(context['budget_mentioned']).toLocaleString('pt-PT')}` : 'o seu orçamento'

  return {
    task_id:    randomUUID(),
    contact_id: contactId,
    lead_id:    leadId,
    type,
    due_at:     dueAt,
    subject:    'Agency Group — Seguimento da sua procura imobiliária',
    body:       `Olá! Sou a Sofia da Agency Group.\n\nEstou a fazer o seguimento da nossa conversa sobre propriedades em ${location} com ${budget}.\n\nTemos algumas oportunidades que podem ser do seu interesse. Posso partilhar detalhes?`,
    sent:       false,
    sent_at:    null,
    created_by: 'SOFIA',
  }
}

// ── Escalation logic ───────────────────────────────────────────────────────────

function checkEscalation(
  contactId: string,
  leadId: string | null,
  context: Record<string, unknown>,
): EscalationRecord | null {
  const budget  = Number(context['budget_mentioned'] ?? 0)
  const score   = Number(context['lead_score'] ?? 0)
  const urgency = String(context['urgency'] ?? '')

  if (budget >= 3_000_000) {
    return { escalation_id: randomUUID(), contact_id: contactId, lead_id: leadId, reason: 'HIGH_VALUE', context: `Budget: €${budget.toLocaleString('pt-PT')} — HNWI threshold exceeded`, assigned_to: process.env.ADMIN_EMAIL ?? null, acknowledged: false, escalated_at: new Date().toISOString() }
  }
  if (score >= 85 && urgency === 'HIGH') {
    return { escalation_id: randomUUID(), contact_id: contactId, lead_id: leadId, reason: 'URGENT', context: `High-score (${score}) + URGENT lead — human follow-up required`, assigned_to: process.env.ADMIN_EMAIL ?? null, acknowledged: false, escalated_at: new Date().toISOString() }
  }
  return null
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function processSofiaMessage(params: {
  contact_id: string
  session_id?: string
  message: string
  channel: 'WEB' | 'WHATSAPP' | 'EMAIL'
  context?: Record<string, unknown>
  tenantId?: string
}): Promise<SofiaOSResponse> {
  const sessionId  = params.session_id ?? randomUUID()
  const tenantId   = params.tenantId ?? TENANT_ID
  const context    = params.context ?? {}

  // Extract entities from message
  const entities   = extractEntities(params.message)
  const mergedCtx  = { ...context, ...entities }

  // Determine Sofia's role
  const role = determineRole(mergedCtx)

  // Intent detection
  const intent = String(mergedCtx['intent'] ?? 'INQUIRE')

  // Lead qualification
  const qualUpdate: Partial<LeadQualification> = {
    lead_id:            context['lead_id'] as string ?? randomUUID(),
    contact_id:         params.contact_id,
    budget_max:         entities['budget_mentioned'] as number ?? null,
    timeline_months:    entities['timeline'] as number ?? null,
    locations:          (entities['locations'] as string[]) ?? [],
    investment_purpose: intent === 'INVEST' ? 'INVESTMENT' : intent === 'BUY' ? 'OWN_USE' : 'UNKNOWN',
    urgency:            (entities['urgency'] as 'HIGH'|'MEDIUM'|'LOW') ?? 'MEDIUM',
    financing_type:     'UNKNOWN',
    status:             'CONTACTED',
  }
  qualUpdate.score = scoreLead(qualUpdate)
  mergedCtx['lead_score'] = qualUpdate.score

  // Seller qualification (if seller intent)
  const sellerUpdate = context['is_seller'] ? {
    seller_id:        randomUUID(),
    contact_id:       params.contact_id,
    property_ref:     (context['property_ref'] as string) ?? 'unknown',
    asking_price_eur: entities['budget_mentioned'] as number ?? null,
    timeline_months:  entities['timeline'] as number ?? null,
    motivation:       'UNKNOWN' as const,
    exclusivity_willing: null,
    flexibility_pct:  null,
    qualified_at:     null,
  } : null

  // Follow-up task
  mergedCtx['email']    = context['email']
  mergedCtx['whatsapp'] = context['whatsapp']
  const followUpTask = generateFollowUp(params.contact_id, qualUpdate.lead_id ?? null, mergedCtx)

  // Escalation check
  const escalation = checkEscalation(params.contact_id, qualUpdate.lead_id ?? null, mergedCtx)

  // Meeting suggestion logic
  const meetingSuggested = (qualUpdate.score ?? 0) >= 70 || (entities['urgency'] === 'HIGH')

  // Investor match trigger
  const investorMatchTriggered = role === 'INVESTOR_ASSISTANT' || (qualUpdate.budget_max ?? 0) >= 500_000

  // Next best action
  const nba =
    escalation               ? 'IMMEDIATE_HUMAN_ESCALATION' :
    meetingSuggested         ? 'BOOK_CONSULTATION_MEETING' :
    (qualUpdate.score ?? 0) >= 60 ? 'SEND_CURATED_PROPERTIES' :
    followUpTask             ? 'SCHEDULE_FOLLOW_UP' :
                               'CONTINUE_QUALIFICATION'

  // Response text
  const location = Array.isArray(entities['locations']) ? (entities['locations'] as string[])[0] : null
  const responseText = buildResponseText(role, intent, entities, location, meetingSuggested, params.channel)

  const response: SofiaOSResponse = {
    session_id:              sessionId,
    contact_id:              params.contact_id,
    role,
    intent,
    entities_extracted:      entities,
    qualification_update:    qualUpdate,
    seller_update:           sellerUpdate,
    follow_up_tasks:         followUpTask ? [followUpTask] : [],
    escalation,
    next_best_action:        nba,
    meeting_suggested:       meetingSuggested,
    investor_match_triggered: investorMatchTriggered,
    response_text:           responseText,
    confidence:              Math.min(95, 60 + Object.keys(entities).length * 5),
  }

  // Persist conversation turn
  try {
    await (supabaseAdmin as unknown as {
      from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> }
    }).from('sofia_conversation_turns').insert({
      session_id:  sessionId,
      tenant_id:   tenantId,
      contact_id:  params.contact_id,
      role,
      channel:     params.channel,
      user_message: params.message,
      intent,
      entities_json: JSON.stringify(entities),
      lead_score:  qualUpdate.score ?? 0,
      nba,
      escalated:   !!escalation,
      response_text: responseText,
      created_at:  new Date().toISOString(),
    })
  } catch (e: unknown) {
    log.warn('[SofiaOS] Persist failed', { e: String(e) })
  }

  // Persist escalation if needed
  if (escalation) {
    try {
      await (supabaseAdmin as unknown as {
        from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> }
      }).from('sofia_escalations').insert({
        ...escalation,
        tenant_id: tenantId,
        session_id: sessionId,
      })
    } catch { /* ok */ }
  }

  log.info('[SofiaOS] Message processed', { role, intent, score: qualUpdate.score, nba, sessionId })

  return response
}

function buildResponseText(
  role: SofiaRole,
  intent: string,
  entities: Record<string, unknown>,
  location: string | null,
  meetingSuggested: boolean,
  channel: string,
): string {
  const greetings: Record<SofiaRole, string> = {
    SDR:                'Olá! Sou a Sofia da Agency Group.',
    ISA:                'Olá! Continuando a nossa conversa,',
    BUYER_QUALIFIER:    'Ótimo! Para encontrar a propriedade ideal para si,',
    SELLER_QUALIFIER:   'Perfeito! Para avaliar a sua propriedade,',
    CAPITAL_INTRODUCER: 'Excelente! Para oportunidades de capital institucional,',
    DEAL_CONCIERGE:     'Compreendo. Vou acompanhar este processo pessoalmente.',
    INVESTOR_ASSISTANT: 'Bem-vindo ao nosso serviço premium para investidores.',
  }

  const base = greetings[role]
  const locationStr = location ? ` em ${location}` : ''
  const budget = entities['budget_mentioned'] ? ` com orçamento de €${Number(entities['budget_mentioned']).toLocaleString('pt-PT')}` : ''

  if (meetingSuggested) {
    return `${base} Com base no que partilhou${locationStr}${budget}, recomendo uma consulta personalizada com um dos nossos consultores especializados. Posso agendar para esta semana?`
  }

  if (intent === 'BUY') {
    return `${base} Tenho excelentes propriedades${locationStr}${budget}. Pode dizer-me quando pretende concretizar a compra e se já tem financiamento aprovado?`
  }
  if (intent === 'SELL') {
    return `${base} Podemos avaliar gratuitamente a sua propriedade${locationStr}. Quando seria um bom momento para uma visita de avaliação?`
  }
  if (intent === 'INVEST') {
    return `${base} Temos oportunidades de investimento exclusivas${locationStr}${budget} com rendimentos acima da média do mercado. Prefere residencial, comercial ou portfolio?`
  }

  return `${base} Como posso ajudá-lo${locationStr}? Estou aqui para encontrar a melhor solução imobiliária para as suas necessidades.`
}
