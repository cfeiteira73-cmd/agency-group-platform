// lib/ai/contracts/index.ts
// Zod schemas defining the structured output contract for each AI agent.
// Use validateAgentOutput() to parse and validate before acting on AI responses.

import { z } from 'zod'

// ─── Sofia Chat ───────────────────────────────────────────────────────────────
export const SofiaResponseSchema = z.object({
  message: z.string().min(1).max(2000),
  intent: z.enum(['price_inquiry', 'visit_request', 'document_request', 'offer_inquiry', 'general']).optional(),
  suggestedNextStep: z.string().max(200).optional(),
  leadScore: z.number().min(0).max(100).optional(),
  language: z.enum(['pt', 'en', 'fr', 'de', 'zh', 'ar']).optional(),
})
export type SofiaResponse = z.infer<typeof SofiaResponseSchema>

// ─── Lead Score ───────────────────────────────────────────────────────────────
export const LeadScoreSchema = z.object({
  score: z.number().min(0).max(100),
  tier: z.enum(['HOT', 'WARM', 'COLD', 'FROZEN']),
  reasoning: z.string().max(500),
  nextBestAction: z.string().max(200),
  confidence: z.number().min(0).max(1),
})
export type LeadScore = z.infer<typeof LeadScoreSchema>

// ─── Deal Risk ────────────────────────────────────────────────────────────────
export const DealRiskSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  topRisks: z.array(z.string().max(200)).max(5),
  mitigationActions: z.array(z.string().max(200)).max(5),
  probabilityToClose: z.number().min(0).max(1),
  estimatedDaysToClose: z.number().min(0).max(3650).optional(),
})
export type DealRisk = z.infer<typeof DealRiskSchema>

// ─── Follow-up Message ────────────────────────────────────────────────────────
export const FollowupMessageSchema = z.object({
  subject: z.string().max(200).optional(),  // email only
  body: z.string().min(1).max(3000),
  channel: z.enum(['email', 'whatsapp', 'sms']),
  language: z.enum(['pt', 'en', 'fr', 'de', 'zh']),
  tone: z.enum(['formal', 'warm', 'urgent']).optional(),
})
export type FollowupMessage = z.infer<typeof FollowupMessageSchema>

// ─── AVM Pricing ─────────────────────────────────────────────────────────────
export const AVMOutputSchema = z.object({
  estimatedValue: z.number().positive(),
  confidenceInterval: z.object({
    low: z.number().positive(),
    high: z.number().positive(),
  }),
  pricePerSqm: z.number().positive(),
  comparableCount: z.number().min(0),
  methodology: z.string().max(500),
  confidence: z.number().min(0).max(1),
  valuationDate: z.string(),  // ISO date
})
export type AVMOutput = z.infer<typeof AVMOutputSchema>

// ─── CRM Analysis Summary ─────────────────────────────────────────────────────
export const CRMAnalysisSchema = z.object({
  dealsProcessed: z.number().min(0),
  tasksCreated: z.number().min(0),
  followupsGenerated: z.number().min(0),
  summary: z.string().max(2000),
  highPriorityActions: z.array(z.string().max(200)).max(10),
  estimatedRevenueImpact: z.number().optional(),
})
export type CRMAnalysis = z.infer<typeof CRMAnalysisSchema>

// ─── Validation helper ────────────────────────────────────────────────────────
export function validateAgentOutput<T>(
  schema: z.ZodSchema<T>,
  rawOutput: string,
  agentId: string
): { success: true; data: T } | { success: false; error: string; raw: string } {
  try {
    // Try to parse as JSON first
    let parsed: unknown
    try {
      parsed = JSON.parse(rawOutput)
    } catch {
      // If not JSON, try to extract JSON from markdown code blocks
      const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1])
      } else {
        return { success: false, error: 'Output is not valid JSON', raw: rawOutput.slice(0, 500) }
      }
    }
    const result = schema.safeParse(parsed)
    if (result.success) {
      return { success: true, data: result.data }
    }
    const error = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    console.warn(`[AIContracts] Validation failed for ${agentId}:`, error)
    return { success: false, error, raw: rawOutput.slice(0, 500) }
  } catch (e) {
    return { success: false, error: String(e), raw: rawOutput.slice(0, 500) }
  }
}

// ─── SH-ROS Agent Output Envelope ────────────────────────────────────────────
// Every agent execution MUST produce this envelope for full observability.
// Domain-specific schemas (SofiaResponseSchema, etc.) are wrapped INSIDE `output`.

export const AgentExecutionEnvelopeSchema = z.object({
  correlation_id:  z.string(),
  agent_id:        z.string(),
  tenant_id:       z.string().default('agency-group'),
  input_hash:      z.string().optional(),           // SHA-256 of serialised input (PII-safe)
  decision:        z.string(),                       // human-readable decision summary
  confidence:      z.number().min(0).max(1).optional(),
  fallback_used:   z.boolean().default(false),
  cost_tokens:     z.object({
    input:  z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }).optional(),
  latency_ms:      z.number().nonnegative(),
  revenue_impact:  z.number().optional(),            // EUR delta, positive = gain
  output:          z.unknown(),                      // domain-specific payload
  error:           z.string().optional(),
  created_at:      z.string().datetime(),
})

export type AgentExecutionEnvelope = z.infer<typeof AgentExecutionEnvelopeSchema>

/**
 * Builds a validated AgentExecutionEnvelope.
 * Call this at the END of every agent handler to produce a canonical audit record.
 *
 * @example
 *   const envelope = buildAgentEnvelope({
 *     correlation_id: corrId,
 *     agent_id: 'sofia-chat',
 *     tenant_id: 'agency-group',
 *     decision: 'Lead qualified — budget €1.2M, Cascais, timeline 3 months',
 *     confidence: 0.87,
 *     fallback_used: false,
 *     cost_tokens: { input: 450, output: 120 },
 *     latency_ms: 1240,
 *     revenue_impact: 60000,
 *     output: sofiaResponse,
 *   })
 */
export function buildAgentEnvelope(
  params: Omit<AgentExecutionEnvelope, 'created_at'> & { created_at?: string }
): AgentExecutionEnvelope {
  return AgentExecutionEnvelopeSchema.parse({
    ...params,
    created_at: params.created_at ?? new Date().toISOString(),
  })
}
