// lib/ai/contracts/prompts.ts
// System prompt suffixes that instruct Claude to return structured JSON matching our contracts.
// Append these to system prompts when structured output is required.

export const STRUCTURED_OUTPUT_INSTRUCTIONS = {
  lead_score: `
IMPORTANT: Respond ONLY with valid JSON matching this schema exactly:
{"score": 0-100, "tier": "HOT|WARM|COLD|FROZEN", "reasoning": "...", "nextBestAction": "...", "confidence": 0-1}`,

  deal_risk: `
IMPORTANT: Respond ONLY with valid JSON matching this schema exactly:
{"riskScore": 0-100, "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL", "topRisks": ["..."], "mitigationActions": ["..."], "probabilityToClose": 0-1, "estimatedDaysToClose": number}`,

  followup_message: `
IMPORTANT: Respond ONLY with valid JSON matching this schema exactly:
{"subject": "...", "body": "...", "channel": "email|whatsapp|sms", "language": "pt|en|fr|de|zh", "tone": "formal|warm|urgent"}`,

  avm: `
IMPORTANT: Respond ONLY with valid JSON matching this schema exactly:
{"estimatedValue": number, "confidenceInterval": {"low": number, "high": number}, "pricePerSqm": number, "comparableCount": number, "methodology": "...", "confidence": 0-1, "valuationDate": "YYYY-MM-DD"}`,

  crm_analysis: `
IMPORTANT: Respond ONLY with valid JSON matching this schema exactly:
{"dealsProcessed": number, "tasksCreated": number, "followupsGenerated": number, "summary": "...", "highPriorityActions": ["..."], "estimatedRevenueImpact": number}`,
} as const
