// Agency Group — Intrusion Detection System
// lib/security/intrusionDetection.ts
// Detects anomalous patterns: replay storms, webhook abuse, prompt injection, unusual AI spend.
// Redis-backed counters. TypeScript strict — 0 errors

import { emitSiemEvent } from './siem'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreatSignal {
  type: 'replay_storm' | 'webhook_flood' | 'prompt_injection' | 'privilege_escalation' | 'unusual_ai_spend' | 'token_exhaustion'
  severity: 'low' | 'medium' | 'high' | 'critical'
  tenantId?: string
  source: string
  evidence: string
  detectedAt: string
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  REPLAY_STORM_PER_MINUTE:   20,         // >20 replays/min = storm
  WEBHOOK_FLOOD_PER_MINUTE:  100,        // >100 webhook hits/min = flood
  AI_SPEND_SPIKE_MULTIPLIER: 5,          // >5x baseline = unusual
  PROMPT_INJECTION_PATTERNS: [           // patterns to detect
    /\[INST\]|\[\/INST\]/i,
    /<\|im_start\|>|<\|im_end\|>/i,
    /###\s*(system|human|assistant|user)\s*:/i,
    /ignore previous instructions/i,
    /you are now (DAN|jailbreak|unrestricted)/i,
  ] as RegExp[],
} as const

// ─── Upstash Redis helpers ─────────────────────────────────────────────────────

type RedisCmd = [string, ...string[]]

async function redisCmd(commands: RedisCmd[]): Promise<unknown[]> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return commands.map(() => null)

  const res = await fetch(`${url}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`)
  const json = await res.json() as Array<{ result: unknown }>
  return json.map((r) => r.result)
}

/** Returns current Unix minute as a string (for bucketed rate windows). */
function currentMinuteBucket(): string {
  return String(Math.floor(Date.now() / 60_000))
}

// ─── Detection functions ──────────────────────────────────────────────────────

/**
 * Detect a replay storm for a given tenant.
 * Increments Redis counter `ids:replay:{tenantId}:{minute}` with 60s TTL.
 * Returns a ThreatSignal if count exceeds REPLAY_STORM_PER_MINUTE.
 */
export async function detectReplayStorm(tenantId: string): Promise<ThreatSignal | null> {
  const key = `ids:replay:${tenantId}:${currentMinuteBucket()}`
  try {
    const results = await redisCmd([
      ['INCR', key],
      ['EXPIRE', key, '60', 'NX'],
    ])
    const count = results[0] as number

    if (count > THRESHOLDS.REPLAY_STORM_PER_MINUTE) {
      return {
        type:        'replay_storm',
        severity:    'high',
        tenantId,
        source:      'replay-authorization-engine',
        evidence:    `${count} replays detected in the current minute (threshold: ${THRESHOLDS.REPLAY_STORM_PER_MINUTE})`,
        detectedAt:  new Date().toISOString(),
      }
    }
    return null
  } catch (err) {
    console.warn('[IDS] detectReplayStorm error — failing open:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Detect a webhook flood from a given source IP.
 * Increments Redis counter `ids:webhook:{sourceIp}:{minute}` with 60s TTL.
 * Returns a ThreatSignal if count exceeds WEBHOOK_FLOOD_PER_MINUTE.
 */
export async function detectWebhookFlood(sourceIp: string): Promise<ThreatSignal | null> {
  const key = `ids:webhook:${sourceIp}:${currentMinuteBucket()}`
  try {
    const results = await redisCmd([
      ['INCR', key],
      ['EXPIRE', key, '60', 'NX'],
    ])
    const count = results[0] as number

    if (count > THRESHOLDS.WEBHOOK_FLOOD_PER_MINUTE) {
      return {
        type:       'webhook_flood',
        severity:   'high',
        source:     sourceIp,
        evidence:   `${count} webhook requests from ${sourceIp} in the current minute (threshold: ${THRESHOLDS.WEBHOOK_FLOOD_PER_MINUTE})`,
        detectedAt: new Date().toISOString(),
      }
    }
    return null
  } catch (err) {
    console.warn('[IDS] detectWebhookFlood error — failing open:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Synchronously test content for prompt injection patterns.
 * Returns a ThreatSignal if any PROMPT_INJECTION_PATTERNS match.
 */
export function detectPromptInjection(content: string, source: string): ThreatSignal | null {
  for (const pattern of THRESHOLDS.PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      return {
        type:       'prompt_injection',
        severity:   'critical',
        source,
        evidence:   `Matched injection pattern: ${pattern.toString()}`,
        detectedAt: new Date().toISOString(),
      }
    }
  }
  return null
}

/**
 * Detect unusual AI spend by comparing currentTokens to a 7-day rolling average.
 * Stores rolling samples in Redis key `ids:ai_spend:{tenantId}` (list, TTL 7 days).
 * Returns a ThreatSignal if spend > AI_SPEND_SPIKE_MULTIPLIER × average.
 */
export async function detectUnusualAISpend(
  tenantId: string,
  currentTokens: number,
): Promise<ThreatSignal | null> {
  const key = `ids:ai_spend:${tenantId}`
  const sevenDaysSec = String(7 * 24 * 60 * 60)

  try {
    // Fetch existing samples, push new one, reset TTL
    const results = await redisCmd([
      ['LRANGE', key, '0', '-1'],
    ])

    const rawSamples = results[0] as string[] | null
    const samples = (rawSamples ?? []).map((s) => parseFloat(s)).filter(isFinite)

    // Push new sample and update TTL (fire-and-forget pipeline)
    void redisCmd([
      ['RPUSH', key, String(currentTokens)],
      ['EXPIRE', key, sevenDaysSec],
    ])

    if (samples.length < 3) return null // Not enough data yet

    const average = samples.reduce((a, b) => a + b, 0) / samples.length

    if (average > 0 && currentTokens > THRESHOLDS.AI_SPEND_SPIKE_MULTIPLIER * average) {
      return {
        type:       'unusual_ai_spend',
        severity:   'medium',
        tenantId,
        source:     'ai-spend-monitor',
        evidence:   `${currentTokens} tokens used — ${THRESHOLDS.AI_SPEND_SPIKE_MULTIPLIER}x above 7-day avg of ${Math.round(average)}`,
        detectedAt: new Date().toISOString(),
      }
    }
    return null
  } catch (err) {
    console.warn('[IDS] detectUnusualAISpend error — failing open:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// ─── Full IDS scan ────────────────────────────────────────────────────────────

/**
 * Run all applicable IDS checks in parallel.
 * Emits a SIEM event for each signal found.
 * Returns all non-null signals.
 */
export async function runFullIDSCheck(params: {
  tenantId?: string
  sourceIp?: string
  content?: string
  currentAITokens?: number
  source: string
}): Promise<ThreatSignal[]> {
  const { tenantId, sourceIp, content, currentAITokens, source } = params

  const checks: Promise<ThreatSignal | null>[] = []

  if (tenantId) {
    checks.push(detectReplayStorm(tenantId))
    if (currentAITokens !== undefined) {
      checks.push(detectUnusualAISpend(tenantId, currentAITokens))
    }
  }

  if (sourceIp) {
    checks.push(detectWebhookFlood(sourceIp))
  }

  // Synchronous prompt injection check wrapped as resolved promise
  if (content) {
    checks.push(Promise.resolve(detectPromptInjection(content, source)))
  }

  const results = await Promise.all(checks)
  const signals = results.filter((s): s is ThreatSignal => s !== null)

  // Emit a SIEM event for each detected signal
  for (const signal of signals) {
    emitSiemEvent({
      event_type:  'intrusion_detected',
      severity:    signal.severity === 'critical' || signal.severity === 'high' ? 'critical' : 'warning',
      tenant_id:   signal.tenantId,
      source:      signal.source,
      description: `[IDS] ${signal.type}: ${signal.evidence}`,
      metadata: {
        threat_type: signal.type,
        evidence:    signal.evidence,
      },
    })
  }

  return signals
}
