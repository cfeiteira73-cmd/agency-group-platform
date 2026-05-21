// =============================================================================
// Agency Group — AI Cost Tracker
// lib/ai/costTracker.ts
//
// Claude/Anthropic model cost registry (USD per million tokens).
// Single source of truth for all cost calculations in the AI gateway.
//
// Update MODEL_PRICING when Anthropic changes rates.
// TypeScript strict — 0 errors
// =============================================================================

// Pricing as of 2026 (update when Anthropic changes)
export const MODEL_PRICING: Record<string, { input_per_m: number; output_per_m: number }> = {
  'claude-opus-4-5':            { input_per_m: 15.00,  output_per_m: 75.00 },
  'claude-opus-4-6':            { input_per_m: 15.00,  output_per_m: 75.00 },
  'claude-sonnet-4-5':          { input_per_m: 3.00,   output_per_m: 15.00 },
  'claude-sonnet-4-6':          { input_per_m: 3.00,   output_per_m: 15.00 },
  'claude-haiku-3-5':           { input_per_m: 0.80,   output_per_m: 4.00  },
  'claude-haiku-4-5':           { input_per_m: 0.80,   output_per_m: 4.00  },
  'claude-haiku-4-5-20251001':  { input_per_m: 0.80,   output_per_m: 4.00  },
  'claude-3-5-sonnet-20241022': { input_per_m: 3.00,   output_per_m: 15.00 },
  'claude-3-5-haiku-20241022':  { input_per_m: 0.80,   output_per_m: 4.00  },
  'claude-3-opus-20240229':     { input_per_m: 15.00,  output_per_m: 75.00 },
  // default fallback
  'default':                    { input_per_m: 3.00,   output_per_m: 15.00 },
}

export interface AICostBreakdown {
  input_cost_usd: number
  output_cost_usd: number
  total_cost_usd: number
}

/**
 * Compute exact USD cost for a completed AI call.
 * Uses 6-decimal precision to avoid floating-point loss on small calls.
 */
export function computeAICost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): AICostBreakdown {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['default']!
  const input_cost_usd  = Math.round((inputTokens  / 1_000_000) * pricing.input_per_m  * 1_000_000) / 1_000_000
  const output_cost_usd = Math.round((outputTokens / 1_000_000) * pricing.output_per_m * 1_000_000) / 1_000_000
  const total_cost_usd  = Math.round((input_cost_usd + output_cost_usd) * 1_000_000) / 1_000_000
  return { input_cost_usd, output_cost_usd, total_cost_usd }
}

/**
 * Estimate total USD cost before making a call (for budget pre-check).
 * Uses rough token counts — actual cost is computed after the call completes.
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): number {
  const { total_cost_usd } = computeAICost(model, estimatedInputTokens, estimatedOutputTokens)
  return total_cost_usd
}
