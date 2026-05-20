// =============================================================================
// Agency Group — Persistent Circuit Breaker
// lib/ops/circuitBreaker.ts
//
// Upstash Redis-backed circuit breaker that survives cold starts and deploys.
// Falls back to in-memory Map when Redis is not configured (dev/test).
//
// CIRCUIT STATES:
//   closed    → normal operation — all calls pass through
//   open      → failure threshold exceeded — calls are rejected immediately
//   half_open → recovery probe — one call allowed through to test stability
//
// THRESHOLDS (hardcoded safe defaults):
//   Open after  5 consecutive failures
//   Half-open after 60 seconds
//   Close after 3 consecutive successes in half-open
//
// REDIS KEY:
//   cb:{component}  — JSON-serialised CircuitBreakerState, TTL = 1 hour
//
// DESIGN:
//   • Fire-and-forget state writes (non-blocking)
//   • Never throws — all public functions return safe defaults on error
//   • TypeScript strict — 0 errors
// =============================================================================

import { classifyCircuitState } from './selfHealing'
import type { CircuitState }    from './selfHealing'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CircuitBreakerState {
  failures:   number        // consecutive failure count
  successes:  number        // consecutive success count (while half_open)
  state:      CircuitState  // 'closed' | 'open' | 'half_open'
  opened_at:  number | null // epoch ms when circuit opened, null if closed
}

export class OperationalError extends Error {
  constructor(
    message: string,
    public readonly component: string,
  ) {
    super(message)
    this.name = 'OperationalError'
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FAILURE_THRESHOLD  = 5          // open after N consecutive failures
const SUCCESS_THRESHOLD  = 3          // close after N consecutive successes (half_open)
const HALF_OPEN_DELAY_MS = 60_000     // 60 seconds before probing
const REDIS_TTL_SEC      = 3_600      // 1-hour TTL — auto-resets stale circuits
const KEY_PREFIX         = 'cb:'

const DEFAULT_STATE: CircuitBreakerState = {
  failures:  0,
  successes: 0,
  state:     'closed',
  opened_at: null,
}

// ─── Upstash REST helper ──────────────────────────────────────────────────────

const UPSTASH_CONFIGURED =
  typeof process !== 'undefined' &&
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

async function upstashCmd(
  commands: Array<[string, ...string[]]>,
): Promise<Array<unknown>> {
  const url   = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(`${url}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`)
  const json = await res.json() as Array<{ result: unknown }>
  return json.map(r => r.result)
}

// ─── Redis read / write ───────────────────────────────────────────────────────

async function redisGet(key: string): Promise<CircuitBreakerState | null> {
  try {
    const results = await upstashCmd([['GET', key]])
    const raw = results[0]
    if (typeof raw !== 'string') return null
    return JSON.parse(raw) as CircuitBreakerState
  } catch (err) {
    console.warn('[circuitBreaker] Redis GET failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/** Fire-and-forget: never awaited by callers to keep writes non-blocking */
function redisSet(key: string, value: CircuitBreakerState): void {
  const payload = JSON.stringify(value)
  upstashCmd([['SETEX', key, String(REDIS_TTL_SEC), payload]]).catch(err => {
    console.warn('[circuitBreaker] Redis SET failed:', err instanceof Error ? err.message : String(err))
  })
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memoryStore = new Map<string, CircuitBreakerState>()

function memGet(component: string): CircuitBreakerState {
  return memoryStore.get(component) ?? { ...DEFAULT_STATE }
}

function memSet(component: string, state: CircuitBreakerState): void {
  memoryStore.set(component, state)
}

// ─── State helpers ────────────────────────────────────────────────────────────

function resolveNextState(current: CircuitBreakerState): CircuitState {
  const msSinceOpen =
    current.opened_at !== null ? Date.now() - current.opened_at : 0

  return classifyCircuitState(
    current.state,
    current.failures,
    current.successes,
    msSinceOpen,
    {
      failure_threshold:    FAILURE_THRESHOLD,
      success_threshold:    SUCCESS_THRESHOLD,
      half_open_timeout_ms: HALF_OPEN_DELAY_MS,
      error_rate_threshold: 0.5, // unused by classifyCircuitState but required by type
    },
  )
}

function redisKey(component: string): string {
  return `${KEY_PREFIX}${component}`
}

// ─── Core read ────────────────────────────────────────────────────────────────

/**
 * Read the current circuit state for `component`.
 * Re-evaluates time-based transitions (closed→open, open→half_open).
 * Returns DEFAULT_STATE on any error.
 */
export async function getCircuitState(
  component: string,
): Promise<CircuitBreakerState> {
  try {
    let current: CircuitBreakerState

    if (UPSTASH_CONFIGURED) {
      current = (await redisGet(redisKey(component))) ?? { ...DEFAULT_STATE }
    } else {
      current = memGet(component)
    }

    // Re-evaluate state transitions that depend on elapsed time
    const nextState = resolveNextState(current)
    if (nextState !== current.state) {
      const updated: CircuitBreakerState = {
        ...current,
        state:      nextState,
        // Reset counters on transition edges
        failures:   nextState === 'half_open' ? 0 : current.failures,
        successes:  nextState === 'half_open' ? 0 : current.successes,
        opened_at:  nextState === 'open' && current.opened_at === null
                      ? Date.now()
                      : nextState === 'closed'
                        ? null
                        : current.opened_at,
      }
      if (UPSTASH_CONFIGURED) {
        redisSet(redisKey(component), updated)
      } else {
        memSet(component, updated)
      }
      return updated
    }

    return current
  } catch (err) {
    console.warn('[circuitBreaker] getCircuitState error:', err instanceof Error ? err.message : String(err))
    return { ...DEFAULT_STATE }
  }
}

// ─── Record success ───────────────────────────────────────────────────────────

/**
 * Record a successful call for `component`.
 * In half_open: increments success counter, may close the circuit.
 * In closed:    resets failure counter.
 * Fire-and-forget: state write is non-blocking.
 */
export async function recordSuccess(component: string): Promise<void> {
  try {
    const current = await getCircuitState(component)

    const successes = current.state === 'half_open'
      ? current.successes + 1
      : 0

    const nextState = resolveNextState({
      ...current,
      failures:  0,
      successes,
    })

    const updated: CircuitBreakerState = {
      failures:  0,
      successes,
      state:     nextState,
      opened_at: nextState === 'closed' ? null : current.opened_at,
    }

    if (UPSTASH_CONFIGURED) {
      redisSet(redisKey(component), updated)
    } else {
      memSet(component, updated)
    }
  } catch (err) {
    // Never throw — log and continue
    console.warn('[circuitBreaker] recordSuccess error:', err instanceof Error ? err.message : String(err))
  }
}

// ─── Record failure ───────────────────────────────────────────────────────────

/**
 * Record a failed call for `component`.
 * Increments failure counter and may open the circuit.
 * Fire-and-forget: state write is non-blocking.
 */
export async function recordFailure(component: string): Promise<void> {
  try {
    const current = await getCircuitState(component)

    const failures = current.failures + 1

    const nextState = resolveNextState({
      ...current,
      failures,
      successes: 0,
    })

    const updated: CircuitBreakerState = {
      failures,
      successes:  0,
      state:      nextState,
      opened_at:  nextState === 'open' && current.opened_at === null
                    ? Date.now()
                    : current.opened_at,
    }

    if (UPSTASH_CONFIGURED) {
      redisSet(redisKey(component), updated)
    } else {
      memSet(component, updated)
    }
  } catch (err) {
    console.warn('[circuitBreaker] recordFailure error:', err instanceof Error ? err.message : String(err))
  }
}

// ─── isOpen ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the circuit is OPEN (all calls should be rejected immediately).
 * half_open is NOT open — one probe call is allowed through.
 */
export async function isOpen(component: string): Promise<boolean> {
  try {
    const s = await getCircuitState(component)
    return s.state === 'open'
  } catch {
    return false  // fail open — do not block calls on read errors
  }
}

// ─── withCircuitBreaker ───────────────────────────────────────────────────────

/**
 * Execute `fn` guarded by the circuit breaker for `component`.
 *
 * - If circuit is OPEN and `fallback` is provided → return fallback immediately.
 * - If circuit is OPEN and no fallback → throw OperationalError.
 * - Otherwise → call fn(), record success or failure, return result.
 *
 * Never throws when `fallback` is provided.
 */
export async function withCircuitBreaker<T>(
  component: string,
  fn: () => Promise<T>,
  fallback?: T,
): Promise<T> {
  const open = await isOpen(component)

  if (open) {
    console.warn(`[circuitBreaker] Circuit OPEN for "${component}" — rejecting call`)
    if (fallback !== undefined) return fallback
    throw new OperationalError(
      `Circuit breaker is OPEN for component "${component}"`,
      component,
    )
  }

  try {
    const result = await fn()
    // Non-blocking — do not await
    void recordSuccess(component)
    return result
  } catch (err) {
    // Non-blocking — do not await
    void recordFailure(component)
    if (fallback !== undefined) return fallback
    throw err
  }
}
