import { z } from 'zod'

// ─── Deal schemas ─────────────────────────────────────────────────────────────

const VALID_FASES = [
  'Angariação', 'Proposta Enviada', 'Proposta Aceite', 'Due Diligence',
  'CPCV Assinado', 'Financiamento', 'Escritura Marcada', 'Escritura Concluída',
  'Contacto', 'Qualificado', 'Visita', 'Proposta', 'Negociação',
  'CPCV', 'Escritura', 'Pós-Venda', 'Fechado', 'Perdido',
] as const

export const DealCreateSchema = z.object({
  imovel:      z.string().min(1).max(300),
  valor:       z.union([z.string().min(1).max(50), z.number().min(0).max(1e9)]),
  fase:        z.enum(VALID_FASES),
  comprador:   z.string().max(200).optional(),
  notas:       z.string().max(5000).optional(),
  ref:         z.string().max(50).optional(),
  property_id: z.string().uuid().optional(),
  agent_id:    z.string().max(200).optional(),
  agent_email: z.string().email().optional(),
})

export const DealUpdateSchema = z.object({
  id:           z.string().uuid().optional(),
  ref:          z.string().max(50).optional(),
  imovel:       z.string().min(1).max(300).optional(),
  valor:        z.union([z.string().max(50), z.number().min(0).max(1e9)]).optional(),
  fase:         z.enum(VALID_FASES).optional(),
  comprador:    z.string().max(200).optional(),
  notas:        z.string().max(5000).optional(),
  agent_id:     z.string().max(200).optional(),
  agent_email:  z.string().email().optional(),
  property_id:  z.string().uuid().optional(),
  contact_id:   z.string().uuid().optional(),
}).refine(d => d.id || d.ref, { message: 'id or ref is required' })

export const DealQuerySchema = z.object({
  fase:      z.string().max(100).optional(),
  stage:     z.string().max(100).optional(),
  agent_id:  z.string().max(200).optional(),
  min_value: z.coerce.number().min(0).optional(),
  search:    z.string().max(200).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(50),
})

// ─── Contact schemas ──────────────────────────────────────────────────────────

export const ContactCreateSchema = z.object({
  full_name:            z.string().min(1).max(200),
  email:                z.string().email().optional().nullable(),
  phone:                z.string().max(50).optional().nullable(),
  nationality:          z.string().max(100).optional().nullable(),
  language:             z.string().max(10).optional().default('pt'),
  budget_min:           z.coerce.number().min(0).max(1e9).optional().nullable(),
  budget_max:           z.coerce.number().min(0).max(1e9).optional().nullable(),
  preferred_locations:  z.array(z.string().max(100)).max(20).optional().default([]),
  typologies_wanted:    z.array(z.string().max(50)).max(10).optional().default([]),
  status:               z.enum(['lead','prospect','qualified','active','negotiating','client','vip','dormant','lost','referrer']).optional().default('lead'),
  notes:                z.string().max(5000).optional().nullable(),
  source:               z.string().max(100).optional().nullable(),
  lead_score:           z.coerce.number().int().min(0).max(100).optional().default(0),
})

export const ContactUpdateSchema = z.object({
  id:                   z.string().uuid(),
  full_name:            z.string().min(1).max(200).optional(),
  email:                z.string().email().optional().nullable(),
  phone:                z.string().max(50).optional().nullable(),
  nationality:          z.string().max(100).optional().nullable(),
  budget_min:           z.coerce.number().min(0).max(1e9).optional().nullable(),
  budget_max:           z.coerce.number().min(0).max(1e9).optional().nullable(),
  status:               z.enum(['lead','prospect','qualified','active','negotiating','client','vip','dormant','lost','referrer']).optional(),
  notes:                z.string().max(5000).optional().nullable(),
  lead_score:           z.coerce.number().int().min(0).max(100).optional(),
  next_followup_at:     z.string().datetime().optional().nullable(),
  gdpr_consent:         z.boolean().optional(),
  opt_out_marketing:    z.boolean().optional(),
  opt_out_whatsapp:     z.boolean().optional(),
})

// ─── Deal Pack schemas ────────────────────────────────────────────────────────

export const DealPackGenerateSchema = z.object({
  lead_id:      z.string().uuid(),
  property_id:  z.string().uuid().optional(),
  deal_id:      z.string().uuid().optional(),
  language:     z.enum(['pt','en','fr','de','es','it','zh','ar']).optional().default('pt'),
})

// ─── Notification schemas ─────────────────────────────────────────────────────

export const NotificationMarkReadSchema = z.object({
  ids:      z.array(z.string().uuid()).max(100).optional().default([]),
  markAll:  z.boolean().optional().default(false),
})

// ─── Analytics schemas ────────────────────────────────────────────────────────

export const ForecastQuerySchema = z.object({
  agent_email: z.string().email().optional(),
})

export const EventReplayQuerySchema = z.object({
  correlation_id: z.string().uuid().optional(),
  session_id:     z.string().uuid().optional(),
  event_type:     z.string().max(100).optional(),
  lead_id:        z.string().uuid().optional(),
  deal_id:        z.string().uuid().optional(),
  source_system:  z.enum(['api','n8n','cron','engine']).optional(),
  since:          z.string().datetime().optional(),
  until:          z.string().datetime().optional(),
  limit:          z.coerce.number().int().min(1).max(1000).default(100),
  order:          z.enum(['asc','desc']).default('asc'),
}).refine(
  d => d.correlation_id || d.session_id || d.event_type || d.lead_id || d.deal_id || d.since,
  { message: 'At least one filter is required' }
)

// ─── Property schemas ─────────────────────────────────────────────────────────
export const SearchSchema = z.object({
  query: z.string().max(500).optional(),
  zona: z.string().max(100).optional(),
  precoMin: z.coerce.number().min(0).max(100_000_000).optional(),
  precoMax: z.coerce.number().min(0).max(100_000_000).optional(),
  quartos: z.coerce.number().min(0).max(20).optional(),
  tipo: z.string().max(50).optional(),
  sessionId: z.string().max(100).optional(),
})

export const AVMSchema = z.object({
  zona: z.string().min(1).max(100),
  tipo: z.string().min(1).max(50),
  area: z.coerce.number().min(10).max(10_000),
  quartos: z.coerce.number().min(0).max(20),
  andar: z.coerce.number().min(0).max(50).optional(),
  estado: z.enum(['novo', 'renovado', 'usado', 'ruina']).optional(),
  garagem: z.boolean().optional(),
  piscina: z.boolean().optional(),
  fotos: z.array(z.string().url()).max(20).optional(),
})

export const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().max(100).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(20).optional(),
})

export const MortgageSchema = z.object({
  valor_imovel: z.coerce.number().min(10_000).max(100_000_000),
  entrada: z.coerce.number().min(0).max(100_000_000),
  prazo_anos: z.coerce.number().min(1).max(40),
  taxa: z.coerce.number().min(0).max(50).optional(),
  tipo_taxa: z.enum(['fixa', 'variavel', 'mista']).optional(),
})

export const NHRSchema = z.object({
  nationality: z.string().max(50).optional(),
  income_type: z.string().max(100).optional(),
  annual_income: z.coerce.number().min(0).max(100_000_000).optional(),
})

// ─── Validation helper ───────────────────────────────────────────────────────
export function validateBody<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: `Validation failed: ${errors}` }
}

export function validateQuery<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw: Record<string, string> = {}
  searchParams.forEach((v, k) => { raw[k] = v })
  return validateBody(schema, raw)
}
