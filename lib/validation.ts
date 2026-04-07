import { z } from 'zod'

// ─── Property schemas ────────────────────────────────────────────────────────
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
