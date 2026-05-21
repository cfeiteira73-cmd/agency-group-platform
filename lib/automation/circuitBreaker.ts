// Agency Group — Dynamic Circuit Breaker
// lib/automation/circuitBreaker.ts
// CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) states.
// State persisted in circuit_breaker_states table. Shared across serverless instances.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  name: string
  failureThreshold: number
  successThreshold: number
  timeoutMs: number
  halfOpenTimeout: number
}

export interface CircuitBreakerStatus {
  name: string
  state: CircuitState
  failure_count: number
  success_count: number
  last_failure_at: string | null
  opened_at: string | null
  tenant_id: string
}

// ─── getCircuitState ──────────────────────────────────────────────────────────

/**
 * Reads circuit state from circuit_breaker_states.
 * Returns CLOSED default if not found.
 */
export async function getCircuitState(
  name: string,
  tenantId: string,
): Promise<CircuitBreakerStatus> {
  const { data } = await (supabaseAdmin as any)
    .from('circuit_breaker_states')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('name', name)
    .single()

  if (!data) {
    return {
      name,
      state: 'CLOSED',
      failure_count: 0,
      success_count: 0,
      last_failure_at: null,
      opened_at: null,
      tenant_id: tenantId,
    }
  }

  return {
    name: data.name as string,
    state: data.state as CircuitState,
    failure_count: (data.failure_count as number) ?? 0,
    success_count: (data.success_count as number) ?? 0,
    last_failure_at: (data.last_failure_at as string | null) ?? null,
    opened_at: (data.opened_at as string | null) ?? null,
    tenant_id: data.tenant_id as string,
  }
}

// ─── upsertCircuitState ───────────────────────────────────────────────────────

async function upsertCircuitState(
  name: string,
  tenantId: string,
  patch: Partial<Omit<CircuitBreakerStatus, 'name' | 'tenant_id'>>,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('circuit_breaker_states')
    .upsert(
      {
        tenant_id: tenantId,
        name,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,name' },
    )

  if (error) {
    log.info('[circuitBreaker] upsert error', { name, error: error.message })
  }
}

// ─── recordSuccess ────────────────────────────────────────────────────────────

/**
 * Records a successful execution.
 * HALF_OPEN + successes >= threshold → CLOSED. CLOSED → reset failure_count.
 */
export async function recordSuccess(name: string, tenantId: string): Promise<void> {
  const current = await getCircuitState(name, tenantId)

  if (current.state === 'HALF_OPEN') {
    const newSuccessCount = current.success_count + 1
    // For HALF_OPEN we use a fixed threshold of 1 success to close — caller can configure
    void upsertCircuitState(name, tenantId, {
      success_count: newSuccessCount,
      state: 'CLOSED',
      failure_count: 0,
      opened_at: null,
    })
    log.info('[circuitBreaker] HALF_OPEN → CLOSED', { name })
  } else if (current.state === 'CLOSED') {
    void upsertCircuitState(name, tenantId, {
      failure_count: 0,
      success_count: current.success_count + 1,
    })
  }
}

// ─── recordFailure ────────────────────────────────────────────────────────────

/**
 * Records a failure. Increments failure_count.
 * If failure_count >= failureThreshold → OPEN.
 * Returns the new circuit state.
 */
export async function recordFailure(
  name: string,
  tenantId: string,
  config: CircuitBreakerConfig,
): Promise<CircuitState> {
  const current = await getCircuitState(name, tenantId)
  const newFailureCount = current.failure_count + 1
  const now = new Date().toISOString()

  const shouldOpen = newFailureCount >= config.failureThreshold

  const patch: Partial<Omit<CircuitBreakerStatus, 'name' | 'tenant_id'>> = {
    failure_count: newFailureCount,
    last_failure_at: now,
    success_count: 0,
  }

  if (shouldOpen) {
    patch.state = 'OPEN'
    patch.opened_at = now
    log.info('[circuitBreaker] OPEN — failure threshold reached', { name, newFailureCount })
  }

  void upsertCircuitState(name, tenantId, patch)

  return shouldOpen ? 'OPEN' : current.state
}

// ─── shouldAllow ──────────────────────────────────────────────────────────────

/**
 * Determines whether a request should be allowed through.
 * CLOSED → true
 * OPEN → check if halfOpenTimeout elapsed → set HALF_OPEN → true
 * OPEN (timeout not elapsed) → false
 * HALF_OPEN → true (let through for testing)
 */
export async function shouldAllow(
  name: string,
  tenantId: string,
  config: CircuitBreakerConfig,
): Promise<boolean> {
  const current = await getCircuitState(name, tenantId)

  if (current.state === 'CLOSED') return true
  if (current.state === 'HALF_OPEN') return true

  // OPEN — check timeout
  if (current.opened_at) {
    const openedAt = new Date(current.opened_at).getTime()
    const elapsed = Date.now() - openedAt

    if (elapsed >= config.halfOpenTimeout) {
      log.info('[circuitBreaker] OPEN → HALF_OPEN (timeout elapsed)', { name, elapsed })
      void upsertCircuitState(name, tenantId, {
        state: 'HALF_OPEN',
        success_count: 0,
        failure_count: 0,
      })
      return true
    }
  }

  return false
}

// ─── executeWithCircuitBreaker ────────────────────────────────────────────────

/**
 * Wraps fn with circuit breaker logic.
 * Throws with code 'CIRCUIT_OPEN' if circuit is not allowing requests.
 */
export async function executeWithCircuitBreaker<T>(
  name: string,
  tenantId: string,
  fn: () => Promise<T>,
  config: CircuitBreakerConfig,
): Promise<T> {
  const allowed = await shouldAllow(name, tenantId, config)

  if (!allowed) {
    const err = new Error(`Circuit breaker OPEN: ${name}`) as Error & { code: string }
    err.code = 'CIRCUIT_OPEN'
    throw err
  }

  try {
    const result = await fn()
    void recordSuccess(name, tenantId).catch(e =>
      console.warn('[circuitBreaker] recordSuccess error', e),
    )
    return result
  } catch (err) {
    void recordFailure(name, tenantId, config).catch(e =>
      console.warn('[circuitBreaker] recordFailure error', e),
    )
    throw err
  }
}

// ─── getAllCircuits ───────────────────────────────────────────────────────────

/**
 * Returns all circuit breaker states for a tenant.
 */
export async function getAllCircuits(tenantId: string): Promise<CircuitBreakerStatus[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('circuit_breaker_states')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })

  if (error) {
    log.info('[circuitBreaker] getAllCircuits error', { error: error.message })
    return []
  }

  return ((data as Record<string, unknown>[]) ?? []).map(row => ({
    name: row.name as string,
    state: row.state as CircuitState,
    failure_count: (row.failure_count as number) ?? 0,
    success_count: (row.success_count as number) ?? 0,
    last_failure_at: (row.last_failure_at as string | null) ?? null,
    opened_at: (row.opened_at as string | null) ?? null,
    tenant_id: row.tenant_id as string,
  }))
}

// ─── resetCircuit ─────────────────────────────────────────────────────────────

/**
 * Forces circuit back to CLOSED (manual override).
 */
export async function resetCircuit(name: string, tenantId: string): Promise<void> {
  await upsertCircuitState(name, tenantId, {
    state: 'CLOSED',
    failure_count: 0,
    success_count: 0,
    last_failure_at: null,
    opened_at: null,
  })
  log.info('[circuitBreaker] manual reset → CLOSED', { name, tenantId })
}
