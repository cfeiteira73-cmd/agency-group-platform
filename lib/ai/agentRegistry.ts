// lib/ai/agentRegistry.ts
// Central registry of all AI agents. Single Source of Truth for model, budget, SLA, fallback.

export type AgentRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type FallbackPolicy = 'static_message' | 'skip' | 'queue_for_retry' | 'human_escalation'

export interface AgentConfig {
  id: string
  displayName: string
  model: string
  circuitName: string
  maxTokens: number
  maxRetries: number
  timeoutMs: number
  latencySLA: number
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
  monthlyTokenBudget?: number
  riskLevel: AgentRiskLevel
  fallbackPolicy: FallbackPolicy
  staticFallback?: string
  capabilities: string[]
  allowedTools?: string[]
  revenueContext?: string
}

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  'sofia-chat': {
    id: 'sofia-chat',
    displayName: 'Sofia — Public Chat',
    model: 'claude-sonnet-4-6',
    circuitName: 'anthropic-opus',
    maxTokens: 500,
    maxRetries: 2,
    timeoutMs: 15000,
    latencySLA: 3000,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    riskLevel: 'low',
    fallbackPolicy: 'static_message',
    staticFallback: 'Olá! Sou a Sofia. Contacte-nos: +351 919 948 986',
    capabilities: ['lead_qualification', 'property_matching', 'market_data'],
    revenueContext: 'sofia_chat',
  },
  'sofia-whatsapp': {
    id: 'sofia-whatsapp',
    displayName: 'Sofia — WhatsApp Auto-Reply',
    model: 'claude-haiku-3-5-20241022',
    circuitName: 'anthropic-haiku',
    maxTokens: 160,
    maxRetries: 1,
    timeoutMs: 8000,
    latencySLA: 5000,
    costPer1kInputTokens: 0.001,
    costPer1kOutputTokens: 0.005,
    riskLevel: 'low',
    fallbackPolicy: 'skip',
    capabilities: ['intent_classification', 'short_reply'],
    revenueContext: 'whatsapp',
  },
  'crm-orchestrator': {
    id: 'crm-orchestrator',
    displayName: 'Sofia — Agentic CRM Loop',
    model: 'claude-opus-4-5',
    circuitName: 'anthropic-opus',
    maxTokens: 4096,
    maxRetries: 2,
    timeoutMs: 120000,
    latencySLA: 60000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    monthlyTokenBudget: 5000000,
    riskLevel: 'high',
    fallbackPolicy: 'queue_for_retry',
    capabilities: ['deal_analysis', 'lead_scoring', 'followup_generation', 'task_creation'],
    allowedTools: ['get_stalled_deals', 'get_deal_details', 'score_lead', 'generate_followup', 'create_task', 'update_deal_stage', 'get_matching_properties', 'complete_analysis'],
    revenueContext: 'crm_automation',
  },
  'deal-risk': {
    id: 'deal-risk',
    displayName: 'Deal Risk Analyzer',
    model: 'claude-opus-4-5',
    circuitName: 'anthropic-opus',
    maxTokens: 2048,
    maxRetries: 2,
    timeoutMs: 60000,
    latencySLA: 30000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    riskLevel: 'high',
    fallbackPolicy: 'queue_for_retry',
    capabilities: ['risk_assessment', 'deal_scoring', 'negotiation_advice'],
    revenueContext: 'deal_risk',
  },
  'avm-pricing': {
    id: 'avm-pricing',
    displayName: 'AVM Pricing Engine',
    model: 'claude-opus-4-5',
    circuitName: 'anthropic-opus',
    maxTokens: 1024,
    maxRetries: 3,
    timeoutMs: 30000,
    latencySLA: 10000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    riskLevel: 'critical',
    fallbackPolicy: 'human_escalation',
    capabilities: ['property_valuation', 'market_comparison', 'price_forecasting'],
    revenueContext: 'avm',
  },
  'followup-generator': {
    id: 'followup-generator',
    displayName: 'Follow-up Message Generator',
    model: 'claude-opus-4-5',
    circuitName: 'anthropic-opus',
    maxTokens: 500,
    maxRetries: 2,
    timeoutMs: 20000,
    latencySLA: 15000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    riskLevel: 'medium',
    fallbackPolicy: 'queue_for_retry',
    capabilities: ['email_generation', 'whatsapp_message', 'sms_generation'],
    revenueContext: 'followup',
  },

  // ─── Circuit-level budget entries ─────────────────────────────────────────
  // withAI() passes the circuit name as agentId. Without these entries the
  // policyEngine falls through to the unregistered-component pass-through,
  // bypassing budget enforcement. These entries register the circuits so
  // monthly token budgets are tracked and the policy gate is meaningful.
  'anthropic-opus': {
    id: 'anthropic-opus',
    displayName: 'Anthropic Opus (circuit)',
    model: 'claude-opus-4-5',
    circuitName: 'anthropic-opus',
    maxTokens: 4096,
    maxRetries: 2,
    timeoutMs: 120000,
    latencySLA: 60000,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    monthlyTokenBudget: 10_000_000,   // 10M tokens/month hard cap across all opus calls
    riskLevel: 'high',
    fallbackPolicy: 'queue_for_retry',
    capabilities: ['vision', 'complex_reasoning', 'photo_scoring', 'risk_analysis'],
    revenueContext: 'opus_circuit',
  },
  'anthropic-haiku': {
    id: 'anthropic-haiku',
    displayName: 'Anthropic Haiku (circuit)',
    model: 'claude-haiku-4-5',
    circuitName: 'anthropic-haiku',
    maxTokens: 2048,
    maxRetries: 2,
    timeoutMs: 30000,
    latencySLA: 10000,
    costPer1kInputTokens: 0.001,
    costPer1kOutputTokens: 0.005,
    monthlyTokenBudget: 50_000_000,   // 50M tokens/month — haiku is cheap, high volume
    riskLevel: 'low',
    fallbackPolicy: 'skip',
    capabilities: ['short_reply', 'intent_classification', 'deal_pack_generation'],
    revenueContext: 'haiku_circuit',
  },
  'anthropic': {
    id: 'anthropic',
    displayName: 'Anthropic Generic (circuit)',
    model: 'claude-sonnet-4-6',
    circuitName: 'anthropic',
    maxTokens: 2048,
    maxRetries: 2,
    timeoutMs: 60000,
    latencySLA: 30000,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    monthlyTokenBudget: 20_000_000,
    riskLevel: 'medium',
    fallbackPolicy: 'queue_for_retry',
    capabilities: ['general'],
    revenueContext: 'generic_circuit',
  },
}

export function getAgentConfig(agentId: string): AgentConfig | null {
  return AGENT_REGISTRY[agentId] ?? null
}

export function getAgentsByCapability(capability: string): AgentConfig[] {
  return Object.values(AGENT_REGISTRY).filter(a => a.capabilities.includes(capability))
}

export function getAgentsByRiskLevel(level: AgentRiskLevel): AgentConfig[] {
  return Object.values(AGENT_REGISTRY).filter(a => a.riskLevel === level)
}
