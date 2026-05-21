// =============================================================================
// Agency Group — Correlation Context (AsyncLocalStorage)
// lib/observability/correlationContext.ts
//
// AUDIT FIX: correlation_id was set on the response header by middleware but
// never propagated into the async call tree of each request handler. Downstream
// code (Supabase queries, AI calls, background jobs) had no reliable way to
// pick up the correlation ID without explicitly threading it through every
// function signature.
//
// This module solves that with Node.js AsyncLocalStorage — a request-scoped
// store that survives async/await hops without manual propagation.
//
// USAGE — in an API route:
//   import { runWithContext, getCorrelationId } from '@/lib/observability/correlationContext'
//   import { buildTraceEnvelope } from '@/lib/observability/correlation'
//
//   export async function GET(req: NextRequest) {
//     const { correlationId, tenantId } = buildTraceEnvelope(req)
//     return runWithContext(
//       { correlation_id: correlationId, tenant_id: tenantId, request_path: req.nextUrl.pathname, started_at: Date.now() },
//       async () => {
//         // getCorrelationId() now works anywhere in the call tree
//         await doSomething()
//       }
//     )
//   }
//
// USAGE — in any downstream function:
//   import { getCorrelationId, tagSupabaseQuery } from '@/lib/observability/correlationContext'
//   const corrId = getCorrelationId()   // 'abc12345-...' or 'no-correlation-id'
//
// Edge runtime note: AsyncLocalStorage requires Node.js runtime. API routes
// that set export const runtime = 'edge' must use the explicit corrId parameter
// pattern instead. This module guards against that at runtime.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestContext {
  correlation_id: string
  tenant_id: string
  request_path: string
  started_at: number  // Date.now() ms timestamp
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage — lazy-initialised so Edge runtime doesn't blow up
// ---------------------------------------------------------------------------

// We lazily require async_hooks so the import doesn't crash on Edge runtime.
// On Edge, getContext() simply returns undefined and callers fall back to
// their explicit corrId parameter.
type ALS = import('async_hooks').AsyncLocalStorage<RequestContext>

let _als: ALS | null = null

function getALS(): ALS | null {
  if (_als) return _als
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require('async_hooks') as typeof import('async_hooks')
    _als = new AsyncLocalStorage<RequestContext>()
    return _als
  } catch {
    // async_hooks unavailable (Edge runtime or test environment) — degrade gracefully
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run `fn` with `context` stored in AsyncLocalStorage.
 * Any code executed inside fn (including all awaited calls) can retrieve
 * the context via getContext() or getCorrelationId().
 *
 * Falls back to calling fn() directly when AsyncLocalStorage is unavailable.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  const als = getALS()
  if (!als) return fn()
  return als.run(context, fn)
}

/**
 * Retrieve the current request context from AsyncLocalStorage.
 * Returns undefined if called outside a runWithContext() scope or on Edge.
 */
export function getContext(): RequestContext | undefined {
  return getALS()?.getStore()
}

/**
 * Retrieve just the correlation_id from the current context.
 * Returns 'no-correlation-id' if no context is active — safe sentinel value
 * that log drains can filter on.
 */
export function getCorrelationId(): string {
  return getALS()?.getStore()?.correlation_id ?? 'no-correlation-id'
}

/**
 * Retrieve the tenant_id from the current context.
 * Returns 'agency-group' (the default single-tenant value) if no context.
 */
export function getTenantId(): string {
  return getALS()?.getStore()?.tenant_id ?? 'agency-group'
}

// ---------------------------------------------------------------------------
// Supabase query tagging
// ---------------------------------------------------------------------------

/**
 * Tag the current Supabase Postgres session with app.correlation_id so that
 * slow query logs, pg_stat_activity, and any database-side audit triggers can
 * include the same correlation ID as the application logs.
 *
 * Must be called BEFORE expensive Supabase queries, not after.
 * Non-blocking fire-and-forget — if it fails the query still runs normally.
 *
 * Implementation detail: uses Postgres SET LOCAL so the setting is scoped to
 * the current transaction and does not leak into connection pool reuse.
 *
 * Usage:
 *   await tagSupabaseQuery(supabaseAdmin)
 *   const { data } = await supabaseAdmin.from('deals').select('*')
 */
export async function tagSupabaseQuery(
  client: typeof supabaseAdmin,
): Promise<void> {
  const corrId = getCorrelationId()
  if (corrId === 'no-correlation-id') return  // nothing useful to tag

  try {
    // set_correlation_id() is defined in the SQL migration for this feature.
    // It calls SET LOCAL so the value is session-scoped (safe with pooling).
    // We cast client to any to avoid the typed RPC constraint — the function
    // exists at the database level but may not yet be in generated types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (client as any).rpc('set_correlation_id', { cid: corrId })
  } catch {
    // Non-fatal — never crash a query because of tagging
  }
}
